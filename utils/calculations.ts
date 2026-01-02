
import { Incident, ExposureHour, ExposureKm, DashboardMetrics, AppSettings, ParetoData, HeatmapData, KPITargets, BodyZone } from "../types";
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

  // 1. Safety Incidents (Exclude In Itinere from safety stats usually, keep Work Transit)
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

  // 3. Risk Index & HIPO
  let riskSum = 0;
  let hipoCount = 0;
  
  // Weights for Probability Index estimation
  let probWeightedSum = 0;
  let probCount = 0;

  incidents.forEach(i => {
      // Risk Index
      const pot = i.potential_risk || 'N/A';
      const weight = RISK_WEIGHTS[pot] || RISK_WEIGHTS[Object.keys(RISK_WEIGHTS).find(k => pot.includes(k)) || 'N/A'] || 1;
      riskSum += weight;

      // HIPO Detection (High Potential)
      if (weight >= 5) hipoCount++;

      // Probability Index Helper
      if (pot) {
          probCount++;
          probWeightedSum += weight;
      }
  });

  // Probability Index Calculation (Average Risk Level mapped to Label)
  let probabilityIndexLabel = "Bajo";
  if (probCount > 0) {
      const avgProb = probWeightedSum / probCount;
      if (avgProb > 4) probabilityIndexLabel = "Alto";
      else if (avgProb > 2) probabilityIndexLabel = "Medio";
      else probabilityIndexLabel = "Bajo";
  }

  // 4. Forecast
  const maxMonth = Math.max(
      ...incidents.map(i => i.month),
      ...exposureHours.map(e => parseInt(e.period.split('-')[1]))
  ) || 1;
  const projectionFactor = 12 / Math.max(1, maxMonth);
  const projectedRecordables = Math.round(recordables * projectionFactor);
  const projectedLti = Math.round(ltis * projectionFactor);
  const projectedHH = totalManHours * projectionFactor; 

  const forecast_trir = calcRate(projectedRecordables, settings.base_trir, projectedHH);
  const maxAllowedTrirEvents = targets ? targets.max_events_trir : 0;
  const maxAllowedLtiEvents = targets ? targets.max_events_lti : 0;

  // 5. Environmental
  // Logic: Type 'Environmental'. Major if Potential Risk is High, else Minor.
  const envIncidents = incidents.filter(i => i.type.toLowerCase().includes('environmental') || i.type.toLowerCase().includes('ambiental'));
  const envMajor = envIncidents.filter(i => (RISK_WEIGHTS[i.potential_risk] || 1) >= 5).length;
  const envMinor = envIncidents.length - envMajor;

  // 6. Incidence Rate % (Tasa de Incidencia)
  // Formula: (Total Incidents / Avg Workers) * 100
  // Estimate Avg Workers = TotalManHours / 200 (approx monthly hours)
  const estimatedWorkers = totalManHours / 200; // Simplified estimation
  const incidenceRatePct = estimatedWorkers > 0 
      ? parseFloat(((incidents.length / estimatedWorkers) * 100).toFixed(2)) 
      : null;

  // 7. HIPO Rate (Ratio)
  // Formula: HIPO Events / Total Incidents
  const hipoRate = incidents.length > 0 
      ? parseFloat((hipoCount / incidents.length).toFixed(2)) 
      : 0;

  return {
    totalIncidents: incidents.length,
    totalRecordables: recordables,
    totalLTI: ltis,
    totalDaysLost,
    totalManHours,
    totalKM,
    
    // Standard Rates
    trir: calcRate(recordables, settings.base_trir, totalManHours),
    ltir: calcRate(ltis, settings.base_trir, totalManHours),
    dart: calcRate(dartCases, settings.base_trir, totalManHours),
    frequencyRate: calcRate(ltis, settings.base_if, totalManHours), 
    severityRate: calcRate(totalDaysLost, settings.base_if, totalManHours),
    
    // New KPIs
    incidenceRatePct,
    ifatRate: calcRate(transitLaboralIncidents, 1000000, totalKM), // IFAT (1M km)
    envIncidentsMajor: envMajor,
    envIncidentsMinor: envMinor,
    probabilityIndexLabel,
    hipoRate,
    hipoCount,

    // Forecasts
    forecast_trir,
    forecast_recordable_count: projectedRecordables,
    forecast_lti_count: projectedLti,
    remaining_trir_events: Math.max(0, maxAllowedTrirEvents - recordables),
    remaining_lti_events: Math.max(0, maxAllowedLtiEvents - ltis),

    // Risk
    risk_index_total: riskSum,
    risk_index_rate: calcRate(riskSum, 1000000, totalManHours),

    // Transit
    cnt_transit_laboral: transitLaboralIncidents,
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

// --- Body Zone Totals Calculator (New for 2025) ---
export const calculateBodyZoneTotals = (incidents: Incident[]): Record<BodyZone, number> => {
    const totals: Record<string, number> = {};
    
    incidents.forEach(inc => {
        // If zones are mapped, iterate
        if (inc.affected_zones && inc.affected_zones.length > 0 && !inc.affected_zones.includes('unknown')) {
            inc.affected_zones.forEach(zone => {
                totals[zone] = (totals[zone] || 0) + 1;
            });
        } else {
            // Fallback: If array is empty OR explicitly contains 'unknown'
            totals['unknown'] = (totals['unknown'] || 0) + 1;
        }
    });

    return totals as Record<BodyZone, number>;
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
      'IFAT': metrics.ifatRate ?? '—',
      'Incidence Rate %': metrics.incidenceRatePct ?? '—'
    };
  });

  return report.sort((a, b) => b.Period.localeCompare(a.Period));
};
