
import { Incident, ExposureHour, ExposureKm, DashboardMetrics, AppSettings, ParetoData, HeatmapData, KPITargets } from "../types";
import { RISK_WEIGHTS } from "../constants";

// Helper: Calculate Rate
const calcRate = (numerator: number, factor: number, denominator: number): number | null => {
  if (denominator <= 0) return null;
  return parseFloat(((numerator * factor) / denominator).toFixed(2));
};

export const calculateKPIs = (
  incidents: Incident[],
  exposureHours: ExposureHour[],
  exposureKm: ExposureKm[],
  settings: AppSettings,
  targets?: KPITargets
): DashboardMetrics => {
  const totalManHours = exposureHours.reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalKM = exposureKm.reduce((sum, e) => sum + (e.km || 0), 0);

  // 1. Safety Incidents (Exclude ALL Transit for Person-based KPIs)
  // Strict separation: IFAT logic separate from TRIR logic if desired, 
  // but typically In Itinere is excluded from TRIR, while Work Transit IS included in TRIR if injury occurred.
  // HOWEVER, user Prompt 5 says: "In Itinere se reporta aparte". Work Transit stays in IFAT.
  // We will adhere to standard: Exclude In Itinere from TRIR. Include Work Transit in TRIR if injury.
  const oshaIncidents = incidents.filter(i => !i.is_in_itinere);

  const recordables = oshaIncidents.filter(i => i.recordable_osha).length;
  const ltis = oshaIncidents.filter(i => i.lti_case).length;
  
  const dartCases = oshaIncidents.filter(i => 
    i.days_away > 0 || i.days_restricted > 0 || i.job_transfer
  ).length;

  const totalDaysLost = oshaIncidents.reduce((sum, i) => {
    const days = (i.days_away || 0) + (i.days_restricted || 0);
    return sum + Math.min(days, settings.days_cap || 180);
  }, 0);

  // 2. Transit Module
  const transitLaboralIncidents = incidents.filter(i => i.is_transit_laboral).length;
  const inItinereIncidents = incidents.filter(i => i.is_in_itinere).length;

  // 3. Risk Index Calculation
  let riskSum = 0;
  incidents.forEach(i => {
      // Fuzzy match potentiality
      const pot = i.potential_risk || 'N/A';
      const weight = RISK_WEIGHTS[pot] || RISK_WEIGHTS[Object.keys(RISK_WEIGHTS).find(k => pot.includes(k)) || 'N/A'] || 1;
      riskSum += weight;
  });

  // 4. Forecast / Projection (Linear extrapolation based on months passed)
  // Assuming data exists up to the max month found in incidents or exposure
  const maxMonth = Math.max(
      ...incidents.map(i => i.month),
      ...exposureHours.map(e => parseInt(e.period.split('-')[1]))
  ) || 1;
  
  const projectionFactor = 12 / Math.max(1, maxMonth);
  const projectedRecordables = Math.round(recordables * projectionFactor);
  const projectedLti = Math.round(ltis * projectionFactor);
  const projectedHH = totalManHours * projectionFactor; // Estimate annual HH

  const forecast_trir = calcRate(projectedRecordables, settings.base_trir, projectedHH);

  // Remaining Events (Burn-down)
  // How many more can occur to hit the Target?
  const maxAllowedTrirEvents = targets ? targets.max_events_trir : 0;
  const maxAllowedLtiEvents = targets ? targets.max_events_lti : 0;

  return {
    totalIncidents: incidents.length,
    totalRecordables: recordables,
    totalLTI: ltis,
    totalDaysLost,
    totalManHours,
    totalKM,
    
    // Rates
    trir: calcRate(recordables, settings.base_trir, totalManHours),
    ltir: calcRate(ltis, settings.base_trir, totalManHours),
    dart: calcRate(dartCases, settings.base_trir, totalManHours),
    frequencyRate: calcRate(ltis, settings.base_if, totalManHours), 
    severityRate: calcRate(totalDaysLost, settings.base_if, totalManHours),
    
    // Forecasts
    forecast_trir,
    forecast_recordable_count: projectedRecordables,
    forecast_lti_count: projectedLti,
    remaining_trir_events: Math.max(0, maxAllowedTrirEvents - recordables),
    remaining_lti_events: Math.max(0, maxAllowedLtiEvents - ltis),

    // Risk
    risk_index_total: riskSum,
    risk_index_rate: calcRate(riskSum, 1000000, totalManHours), // Risk Points per 1M HH

    // Transit
    cnt_transit_laboral: transitLaboralIncidents,
    ifat: calcRate(transitLaboralIncidents, 1000000, totalKM), 
    cnt_in_itinere: inItinereIncidents,
    rate_in_itinere_hh: calcRate(inItinereIncidents, settings.base_trir, totalManHours)
  };
};

// --- Pareto Generator ---
export const generateParetoData = (incidents: Incident[], dimension: 'location' | 'type'): ParetoData[] => {
    const counts: Record<string, number> = {};
    incidents.forEach(i => {
        const key = dimension === 'location' ? i.location : i.type;
        counts[key] = (counts[key] || 0) + 1;
    });

    const total = incidents.length;
    let runningSum = 0;
    
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1]) // Descending
        .slice(0, 10) // Top 10
        .map(([name, count]) => {
            runningSum += count;
            return {
                name,
                count,
                cumulativePercentage: Math.round((runningSum / total) * 100)
            };
        });
};

// --- Heatmap Generator ---
export const generateHeatmapData = (incidents: Incident[], sites: string[]): HeatmapData[] => {
    const data: HeatmapData[] = [];
    // Initialize matrix
    sites.forEach(site => {
        for(let m=1; m<=12; m++) {
            data.push({ site, month: m, value: 0 });
        }
    });

    // Fill data
    incidents.forEach(i => {
        const entry = data.find(d => d.site === i.site && d.month === i.month);
        if (entry) entry.value++;
    });

    return data;
};

export const generateDetailedKPIReport = (
  incidents: Incident[],
  exposureHours: ExposureHour[],
  exposureKm: ExposureKm[],
  settings: AppSettings
) => {
  const keys = new Set<string>();
  incidents.forEach(i => keys.add(`${i.year}-${String(i.month).padStart(2, '0')}|${i.site}`));
  exposureHours.forEach(e => keys.add(`${e.period}|${e.site}`));

  const report = Array.from(keys).map(key => {
    const [period, site] = key.split('|');
    const [yearStr, monthStr] = period.split('-');
    const year = parseInt(yearStr) || 0;
    const month = parseInt(monthStr) || 0;

    const sliceIncidents = incidents.filter(i => i.site === site && i.year === year && i.month === month);
    const sliceHours = exposureHours.filter(e => e.site === site && e.period === period);
    const sliceKm = exposureKm.filter(e => e.site === site && e.period === period);

    const metrics = calculateKPIs(sliceIncidents, sliceHours, sliceKm, settings);

    return {
      Period: period,
      Site: site,
      'Man Hours': metrics.totalManHours,
      'KM': sliceKm.reduce((acc, curr) => acc + curr.km, 0),
      'Total Incidents': metrics.totalIncidents,
      'OSHA Recordables': metrics.totalRecordables,
      'LTI Cases': metrics.totalLTI,
      'Risk Score': metrics.risk_index_total,
      'TRIR': metrics.trir ?? '—',
      'IFAT': metrics.ifat ?? '—',
      'In Itinere': metrics.cnt_in_itinere
    };
  });

  return report.sort((a, b) => b.Period.localeCompare(a.Period));
};
