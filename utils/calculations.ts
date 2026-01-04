
import { Incident, ExposureHour, ExposureKm, DashboardMetrics, AppSettings, ParetoData, HeatmapData, KPITargets, BodyZone, SiteRanking, SiteDaysSafe, TrendAlert, SiteEvolution, SuggestedAction, GlobalKmRecord } from "../types";
import { RISK_WEIGHTS } from "../constants";
import { getSmartSuggestedActions } from "./textAnalysis";

// Helper: Calculate Rate safely
// Returns null if denominator is 0 to indicate "insufficient data" rather than 0 or Infinity
const calcRate = (numerator: number, factor: number, denominator: number): number | null => {
  if (!denominator || denominator <= 0) return null;
  const result = (numerator * factor) / denominator;
  return isFinite(result) ? parseFloat(result.toFixed(2)) : null;
};

export const calculateKPIs = (
  incidents: Incident[],
  exposureHours: ExposureHour[],
  // exposureKm is kept for type signature compatibility but replaced by globalKm logic
  exposureKm: ExposureKm[], 
  settings: AppSettings,
  targets?: KPITargets,
  globalKmRecords?: GlobalKmRecord[]
): DashboardMetrics => {
  // Defensive check
  if (!incidents || !exposureHours) {
      // Return zeroed structure if inputs are missing
      return {
          totalManHours: 0, totalKM: 0,
          totalIncidents: 0, totalRecordables: 0, totalLTI: 0, totalFatalities: 0, totalDaysLost: 0, totalDARTCases: 0,
          trir: null, ltif: null, dart: null, sr: null, alos: null, far: null,
          t1_count: 0, t2_count: 0, t1_pser: null, t2_pser: null,
          incidenceRateSRT: null, slg24h: null,
          lcer: 0, iap: 0, capa_otc: 0,
          incidenceRatePct: null, ifatRate: null, envIncidentsMajor: 0, envIncidentsMinor: 0,
          probabilityIndexLabel: 'N/A', hipoRate: null, hipoCount: 0,
          forecast_trir: null, forecast_lti_count: 0, forecast_recordable_count: 0,
          risk_index_total: 0, risk_index_rate: null,
          cnt_transit_laboral: 0, cnt_in_itinere: 0, rate_in_itinere_hh: null,
          top5Sites: [], daysSinceList: [], trendAlerts: [], siteEvolutions: [], suggestedActions: []
      };
  }

  const totalManHours = exposureHours.reduce((sum, e) => sum + (e.hours || 0), 0);
  
  // GLOBAL KM LOGIC:
  let totalKM = 0;
  if (globalKmRecords && globalKmRecords.length > 0) {
      totalKM = globalKmRecords.reduce((acc, r) => acc + r.value, 0);
  } else {
      totalKM = exposureKm ? exposureKm.reduce((sum, e) => sum + (e.km || 0), 0) : 0;
  }

  // --- A. Occupational Safety (Lagging) ---
  const oshaIncidents = incidents.filter(i => !i.is_in_itinere); // Exclude commuting for safety stats

  const recordables = oshaIncidents.filter(i => i.recordable_osha).length;
  const ltis = oshaIncidents.filter(i => i.lti_case).length;
  const fatalities = oshaIncidents.filter(i => i.fatality).length;
  
  const dartCases = oshaIncidents.filter(i => 
    i.days_away > 0 || i.days_restricted > 0 || i.job_transfer
  ).length;

  const totalDaysLost = oshaIncidents.reduce((sum, i) => {
    const days = (i.days_away || 0) + (i.days_restricted || 0);
    return sum + Math.min(days, settings.days_cap || 180);
  }, 0);

  // RATES (Corporate Standard)
  const trir = calcRate(recordables, 200000, totalManHours); // OSHA Base
  const ltif = calcRate(ltis, 1000000, totalManHours); // IOGP Base
  const dart = calcRate(dartCases, 200000, totalManHours); // OSHA Base
  const sr = calcRate(totalDaysLost, 1000, totalManHours); // ILO/SRT Base
  const far = calcRate(fatalities, 100000000, totalManHours); // Standard Oil & Gas Base

  const alos = ltis > 0 ? parseFloat((totalDaysLost / ltis).toFixed(1)) : null;

  // --- B. Process Safety (API RP 754) ---
  const t1Incidents = incidents.filter(i => i.is_process_safety_tier_1);
  const t2Incidents = incidents.filter(i => i.is_process_safety_tier_2);
  
  const t1_count = t1Incidents.length;
  const t2_count = t2Incidents.length;
  
  const t1_pser = calcRate(t1_count, 200000, totalManHours);
  const t2_pser = calcRate(t2_count, 200000, totalManHours);

  // --- C. Regulatory (SRT Argentina) ---
  // Proxy for "Average Workers": Hours / (200 * Months)
  // We determine how many months of exposure are present to avoid inflating the worker count in YTD views
  const uniquePeriods = new Set(exposureHours.filter(e => e.hours > 0).map(e => e.period));
  const monthsCount = Math.max(1, uniquePeriods.size);
  const estimatedWorkers = totalManHours / (200 * monthsCount);

  const ltiWithLow = oshaIncidents.filter(i => i.lti_case); // "Con Baja" proxy
  const incidenceRateSRT = estimatedWorkers > 0 
      ? parseFloat(((ltiWithLow.length * 1000) / estimatedWorkers).toFixed(2))
      : null;
  
  // Mock SLG-24h (Needs a specific flag in future, assuming 95% compliant for now based on 'verified' count)
  const slg24h = incidents.length > 0 ? Math.round((incidents.filter(i => i.is_verified).length / incidents.length) * 100) : 100;

  // --- D. System Efficacy (ISO 45001) ---
  // Mock values for visual dashboard (until Audit module is built)
  const lcer = 95; // 95% Legal Compliance
  const iap = 92; // 92% Audit Plan Execution
  const capa_otc = incidents.length > 0 ? Math.round((incidents.filter(i => i.is_verified).length / incidents.length) * 90) : 100; // Proxy using verification rate

  // --- Other Metrics ---
  const transitLaboralIncidents = incidents.filter(i => i.is_transit_laboral).length;
  const inItinereIncidents = incidents.filter(i => i.is_in_itinere).length;

  let riskSum = 0;
  let hipoCount = 0;
  let probWeightedSum = 0;
  let probCount = 0;

  incidents.forEach(i => {
      const pot = i.potential_risk || 'N/A';
      const weight = RISK_WEIGHTS[pot] || RISK_WEIGHTS[Object.keys(RISK_WEIGHTS).find(k => pot.includes(k)) || 'N/A'] || 1;
      riskSum += weight;
      if (weight >= 5) hipoCount++;
      if (pot) {
          probCount++;
          probWeightedSum += weight;
      }
  });

  let probabilityIndexLabel = "Bajo";
  if (probCount > 0) {
      const avgProb = probWeightedSum / probCount;
      if (avgProb > 4) probabilityIndexLabel = "Alto";
      else if (avgProb > 2) probabilityIndexLabel = "Medio";
      else probabilityIndexLabel = "Bajo";
  }

  const maxMonth = Math.max(
      ...incidents.map(i => i.month),
      ...exposureHours.map(e => parseInt(e.period.split('-')[1]))
  ) || 1;
  const projectionFactor = 12 / Math.max(1, maxMonth);
  const projectedRecordables = Math.round(recordables * projectionFactor);
  const projectedLti = Math.round(ltis * projectionFactor);
  const projectedHH = totalManHours * projectionFactor; 

  const forecast_trir = calcRate(projectedRecordables, 200000, projectedHH);

  const envIncidents = incidents.filter(i => i.type.toLowerCase().includes('environmental') || i.type.toLowerCase().includes('ambiental'));
  const envMajor = envIncidents.filter(i => (RISK_WEIGHTS[i.potential_risk] || 1) >= 5).length;
  const envMinor = envIncidents.length - envMajor;

  const incidenceRatePct = estimatedWorkers > 0 
      ? parseFloat(((incidents.length / estimatedWorkers) * 100).toFixed(2)) 
      : null;

  const hipoRate = incidents.length > 0 
      ? parseFloat((hipoCount / incidents.length).toFixed(2)) 
      : 0;


  // --- MANAGEMENT INDICATORS ---
  const siteCounts: Record<string, number> = {};
  incidents.forEach(i => {
      siteCounts[i.site] = (siteCounts[i.site] || 0) + 1;
  });
  const top5Sites: SiteRanking[] = Object.entries(siteCounts)
      .sort((a, b) => b[1] - a[1]) // Descending
      .slice(0, 5)
      .map(([site, count], idx) => ({ site, count, rank: idx + 1 }));

  const now = new Date();
  const siteLastDates: Record<string, number> = {}; // timestamp
  
  incidents.forEach(i => {
      if (!i.fecha_evento) return;
      const ts = new Date(i.fecha_evento).getTime();
      if (!siteLastDates[i.site] || ts > siteLastDates[i.site]) {
          siteLastDates[i.site] = ts;
      }
  });

  const daysSinceList: SiteDaysSafe[] = Object.entries(siteLastDates).map(([site, lastTs]) => {
      const diffTime = Math.abs(now.getTime() - lastTs);
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      let status: 'critical' | 'warning' | 'safe' = 'safe';
      if (days <= 30) status = 'critical';
      else if (days <= 90) status = 'warning';
      
      return {
          site,
          days,
          lastDate: new Date(lastTs).toISOString().split('T')[0],
          status
      };
  }).sort((a, b) => a.days - b.days);

  const allMonths = incidents.map(i => i.month);
  const currentDatasetMonth = allMonths.length > 0 ? Math.max(...allMonths) : new Date().getMonth() + 1;
  const windowMonths = [currentDatasetMonth - 2, currentDatasetMonth - 1, currentDatasetMonth];
  const trendAlerts: TrendAlert[] = [];
  const siteMonthCounts: Record<string, Record<number, number>> = {};
  incidents.forEach(i => {
      if (!siteMonthCounts[i.site]) siteMonthCounts[i.site] = {};
      siteMonthCounts[i.site][i.month] = (siteMonthCounts[i.site][i.month] || 0) + 1;
  });

  Object.keys(siteMonthCounts).forEach(site => {
      const counts = windowMonths.map(m => siteMonthCounts[site][m] || 0);
      if (counts[2] > 0 && counts[0] < counts[1] && counts[1] < counts[2]) {
          trendAlerts.push({
              site,
              history: windowMonths.map((m, i) => ({ month: m, count: counts[i] })),
              trend: 'increasing'
          });
      }
  });

  const prevWindowMonths = [currentDatasetMonth - 5, currentDatasetMonth - 4, currentDatasetMonth - 3];
  const siteEvolutions: SiteEvolution[] = Object.keys(siteMonthCounts).map(site => {
      const currentSum = windowMonths.reduce((acc, m) => acc + (siteMonthCounts[site][m] || 0), 0);
      const prevSum = prevWindowMonths.reduce((acc, m) => acc + (siteMonthCounts[site][m] || 0), 0);
      
      const currentAvg = currentSum / 3;
      const prevAvg = prevSum / 3;
      
      let variationPct = 0;
      if (prevAvg > 0) {
          variationPct = Math.round(((currentAvg - prevAvg) / prevAvg) * 100);
      } else if (currentAvg > 0) {
          variationPct = 100;
      }

      let status: 'improving' | 'stable' | 'deteriorating' = 'stable';
      if (variationPct >= 20) status = 'deteriorating';
      else if (variationPct <= -20) status = 'improving';

      return {
          site,
          currentAvg: parseFloat(currentAvg.toFixed(1)),
          prevAvg: parseFloat(prevAvg.toFixed(1)),
          variationPct,
          status
      };
  });

  const actionSites = new Set<string>();
  siteEvolutions.filter(e => e.status === 'deteriorating').forEach(e => actionSites.add(e.site));
  trendAlerts.forEach(t => actionSites.add(t.site));

  if (actionSites.size === 0) {
      top5Sites.slice(0, 2).forEach(s => actionSites.add(s.site));
  }

  const suggestedActions: SuggestedAction[] = Array.from(actionSites).map(site => {
      let reason: 'deterioration' | 'trend_alert' = 'deterioration';
      if (trendAlerts.some(t => t.site === site)) reason = 'trend_alert';
      
      const siteIncidents = incidents.filter(i => i.site === site);
      const smartActions = getSmartSuggestedActions(siteIncidents);

      return {
          site,
          reason,
          title: `Acciones sugeridas automáticas – ${site}`,
          actions: smartActions
      };
  });


  return {
    totalManHours,
    totalKM,
    
    // A. Occupational
    totalIncidents: incidents.length,
    totalRecordables: recordables,
    totalLTI: ltis,
    totalFatalities: fatalities,
    totalDaysLost,
    totalDARTCases: dartCases,
    
    trir,
    ltif,
    dart,
    sr,
    alos,
    far,

    // B. Process Safety
    t1_count,
    t2_count,
    t1_pser,
    t2_pser,

    // C. Regulatory
    incidenceRateSRT,
    slg24h,

    // D. System Efficacy
    lcer,
    iap,
    capa_otc,

    // Legacy/Operational
    incidenceRatePct,
    ifatRate: calcRate(transitLaboralIncidents, 1000000, totalKM),
    envIncidentsMajor: envMajor,
    envIncidentsMinor: envMinor,
    probabilityIndexLabel,
    hipoRate,
    hipoCount,
    forecast_trir,
    forecast_recordable_count: projectedRecordables,
    forecast_lti_count: projectedLti,
    risk_index_total: riskSum,
    risk_index_rate: calcRate(riskSum, 1000000, totalManHours),
    cnt_transit_laboral: transitLaboralIncidents,
    cnt_in_itinere: inItinereIncidents,
    rate_in_itinere_hh: calcRate(inItinereIncidents, 200000, totalManHours),
    top5Sites,
    daysSinceList,
    trendAlerts,
    siteEvolutions,
    suggestedActions
  };
};

// ... existing generators remain unchanged ...
export const generateParetoData = (incidents: Incident[], dimension: 'location' | 'type'): ParetoData[] => {
    if (incidents.length === 0) return [];
    const counts: Record<string, number> = {};
    incidents.forEach(i => {
        const key = dimension === 'location' ? i.location : i.type;
        counts[key] = (counts[key] || 0) + 1;
    });
    const total = incidents.length;
    let runningSum = 0;
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1]) 
        .slice(0, 10) 
        .map(([name, count]) => {
            runningSum += count;
            return {
                name,
                count,
                cumulativePercentage: Math.round((runningSum / total) * 100)
            };
        });
};

export const generateHeatmapData = (incidents: Incident[], sites: string[]): HeatmapData[] => {
    const data: HeatmapData[] = [];
    sites.forEach(site => {
        for(let m=1; m<=12; m++) {
            data.push({ site, month: m, value: 0 });
        }
    });
    incidents.forEach(i => {
        const entry = data.find(d => d.site === i.site && d.month === i.month);
        if (entry) entry.value++;
    });
    return data;
};

export const calculateBodyZoneTotals = (incidents: Incident[]): Record<BodyZone, number> => {
    const totals: Record<string, number> = {};
    incidents.forEach(inc => {
        if (inc.affected_zones && inc.affected_zones.length > 0 && !inc.affected_zones.includes('unknown')) {
            inc.affected_zones.forEach(zone => {
                totals[zone] = (totals[zone] || 0) + 1;
            });
        } else {
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
      'Total Incidents': metrics.totalIncidents,
      'OSHA Recordables': metrics.totalRecordables,
      'LTI Cases': metrics.totalLTI,
      'Risk Score': metrics.risk_index_total,
      'TRIR': metrics.trir ?? '—',
      'Incidence Rate %': metrics.incidenceRatePct ?? '—'
    };
  });

  return report.sort((a, b) => b.Period.localeCompare(a.Period));
};
