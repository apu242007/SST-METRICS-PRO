
import { Incident, ExposureHour, ExposureKm, DashboardMetrics, AppSettings, ParetoData, HeatmapData, KPITargets, BodyZone, SiteRanking, SiteDaysSafe, TrendAlert, SiteEvolution, SuggestedAction, GlobalKmRecord } from "../types";
import { RISK_WEIGHTS, EMPTY_DASHBOARD_METRICS } from "../constants";
import { getSmartSuggestedActions } from "./textAnalysis";

// Helper: Calculate Rate safely
// Returns null if denominator is 0 to indicate "insufficient data" rather than 0 or Infinity
const calcRate = (numerator: number, factor: number, denominator: number): number | null => {
  if (!denominator || denominator <= 0) return 0; // FIXED: Force 0 instead of null for UI consistency in dashboards
  const result = (numerator * factor) / denominator;
  return isFinite(result) ? parseFloat(result.toFixed(2)) : 0;
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
  
  // --- 1. DATA EXISTENCE CHECK (Backend Logic) ---
  // If we have no incidents AND no hours, we are in a "No Excel Loaded" or "Empty Filter" state.
  // We return zeros immediately to prevent "Ghost Numbers" from residual persisted state.
  if ((!incidents || incidents.length === 0) && (!exposureHours || exposureHours.length === 0)) {
      return EMPTY_DASHBOARD_METRICS;
  }

  // --- 2. EXPOSURE CALCULATION ---
  const totalManHours = exposureHours ? exposureHours.reduce((sum, e) => sum + (e.hours || 0), 0) : 0;
  
  // GLOBAL KM LOGIC:
  let totalKM = 0;
  if (globalKmRecords && globalKmRecords.length > 0) {
      totalKM = globalKmRecords.reduce((acc, r) => acc + r.value, 0);
  } else {
      totalKM = exposureKm ? exposureKm.reduce((sum, e) => sum + (e.km || 0), 0) : 0;
  }

  // --- 3. SAFETY CHECK FOR DIVISION ---
  // Even if we have incidents, if ManHours are 0, rates should be 0 (or infinite, but we handle as 0 for dashboard safety)
  // This logic prevents the 6.64 type errors if hours are missing but incidents exist.
  // However, specifically to fix "Ghost Data" (where user thinks it's empty but it's not), 
  // we proceed, but `calcRate` now defaults to 0 on zero-denominator.

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

  const alos = ltis > 0 ? parseFloat((totalDaysLost / ltis).toFixed(1)) : 0;

  // --- B. Process Safety (API RP 754) ---
  const t1Incidents = incidents.filter(i => i.is_process_safety_tier_1);
  const t2Incidents = incidents.filter(i => i.is_process_safety_tier_2);
  
  const t1_count = t1Incidents.length;
  const t2_count = t2Incidents.length;
  
  const t1_pser = calcRate(t1_count, 200000, totalManHours);
  const t2_pser = calcRate(t2_count, 200000, totalManHours);

  // --- C. Regulatory (SRT Argentina) ---
  const uniquePeriods = new Set(exposureHours.filter(e => e.hours > 0).map(e => e.period));
  const monthsCount = Math.max(1, uniquePeriods.size);
  const estimatedWorkers = totalManHours / (200 * monthsCount);

  const ltiWithLow = oshaIncidents.filter(i => i.lti_case); 
  const incidenceRateSRT = estimatedWorkers > 0 
      ? parseFloat(((ltiWithLow.length * 1000) / estimatedWorkers).toFixed(2))
      : 0;
  
  // SLG-24h
  const slg24h = incidents.length > 0 ? Math.round((incidents.filter(i => i.is_verified).length / incidents.length) * 100) : 100;

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

  // --- FORECAST LOGIC (Protected) ---
  let forecast_trir: number | null = 0;
  let projectedRecordables = 0;
  let projectedLti = 0;

  // Only calculate forecast if we have actual data to project from
  if (totalManHours > 0 && incidents.length > 0) {
      // Find the LATEST period in the dataset (e.g. 2026-03)
      const allPeriods = incidents.map(i => `${i.year}-${String(i.month).padStart(2,'0')}`);
      allPeriods.push(...exposureHours.map(e => e.period));
      const sortedPeriods = Array.from(new Set(allPeriods)).sort();
      const lastPeriod = sortedPeriods[sortedPeriods.length - 1]; // e.g. "2026-03"
      
      const [lastYear, lastMonth] = lastPeriod.split('-').map(Number);
      
      // If we have full year data, projection is actual. If partial year, project.
      const currentYear = new Date().getFullYear();
      const projectionFactor = (lastYear === currentYear) ? (12 / Math.max(1, lastMonth)) : 1;

      projectedRecordables = Math.round(recordables * projectionFactor);
      projectedLti = Math.round(ltis * projectionFactor);
      const projectedHH = totalManHours * projectionFactor; 
      forecast_trir = calcRate(projectedRecordables, 200000, projectedHH);
  }

  const envIncidents = incidents.filter(i => i.type.toLowerCase().includes('environmental') || i.type.toLowerCase().includes('ambiental'));
  const envMajor = envIncidents.filter(i => (RISK_WEIGHTS[i.potential_risk] || 1) >= 5).length;
  const envMinor = envIncidents.length - envMajor;

  const incidenceRatePct = estimatedWorkers > 0 
      ? parseFloat(((incidents.length / estimatedWorkers) * 100).toFixed(2)) 
      : 0;

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

  // --- TREND LOGIC (TIME BASED) ---
  // Fix: Aggregate by YYYY-MM, not just Month number, to support multi-year views correctly.
  
  const sitePeriodCounts: Record<string, Record<string, number>> = {};
  const allPeriodsSet = new Set<string>();
  
  incidents.forEach(i => {
      const period = `${i.year}-${String(i.month).padStart(2, '0')}`;
      allPeriodsSet.add(period);
      if (!sitePeriodCounts[i.site]) sitePeriodCounts[i.site] = {};
      sitePeriodCounts[i.site][period] = (sitePeriodCounts[i.site][period] || 0) + 1;
  });

  const sortedPeriods = Array.from(allPeriodsSet).sort();
  const last3Periods = sortedPeriods.slice(-3); // Get last 3 months of available data
  
  const trendAlerts: TrendAlert[] = [];
  
  if (last3Periods.length >= 3) {
      Object.keys(sitePeriodCounts).forEach(site => {
          const counts = last3Periods.map(p => sitePeriodCounts[site][p] || 0);
          // Strict increasing trend: 1 < 2 < 3
          if (counts[2] > 0 && counts[0] < counts[1] && counts[1] < counts[2]) {
              trendAlerts.push({
                  site,
                  history: last3Periods.map((p, i) => ({ month: parseInt(p.split('-')[1]), count: counts[i] })), // Keep simplified interface for UI
                  trend: 'increasing'
              });
          }
      });
  }

  // --- EVOLUTION LOGIC (Current 3 vs Prev 3) ---
  const currentWindow = sortedPeriods.slice(-3);
  const prevWindow = sortedPeriods.slice(-6, -3);
  
  const siteEvolutions: SiteEvolution[] = Object.keys(sitePeriodCounts).map(site => {
      const currentSum = currentWindow.reduce((acc, p) => acc + (sitePeriodCounts[site][p] || 0), 0);
      const prevSum = prevWindow.reduce((acc, p) => acc + (sitePeriodCounts[site][p] || 0), 0);
      
      const currentAvg = currentWindow.length > 0 ? currentSum / currentWindow.length : 0;
      const prevAvg = prevWindow.length > 0 ? prevSum / prevWindow.length : 0;
      
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

// ========== NEW CHART DATA GENERATORS ==========

// 1. Severity Distribution (Pie/Donut)
export const generateSeverityDistribution = (incidents: Incident[]) => {
  const typeCount: Record<string, number> = {};
  incidents.forEach(i => {
    typeCount[i.type] = (typeCount[i.type] || 0) + 1;
  });

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6'];
  
  return Object.entries(typeCount).map(([name, value], idx) => ({
    name,
    value,
    color: COLORS[idx % COLORS.length]
  })).sort((a, b) => b.value - a.value);
};

// Comparación de distribución por tipo entre dos años
export const generateYearComparisonByType = (incidents: Incident[], year1: number = 2025, year2: number = 2026) => {
  const incidents2025 = incidents.filter(i => i.year === year1);
  const incidents2026 = incidents.filter(i => i.year === year2);
  
  const typeCount2025: Record<string, number> = {};
  const typeCount2026: Record<string, number> = {};
  
  incidents2025.forEach(i => {
    typeCount2025[i.type] = (typeCount2025[i.type] || 0) + 1;
  });
  
  incidents2026.forEach(i => {
    typeCount2026[i.type] = (typeCount2026[i.type] || 0) + 1;
  });
  
  // Unir todos los tipos
  const allTypes = new Set([...Object.keys(typeCount2025), ...Object.keys(typeCount2026)]);
  
  return Array.from(allTypes).map(type => ({
    type,
    shortType: type.length > 15 ? type.substring(0, 15) + '...' : type,
    [String(year1)]: typeCount2025[type] || 0,
    [String(year2)]: typeCount2026[type] || 0,
    diff: (typeCount2026[type] || 0) - (typeCount2025[type] || 0),
    percentChange: typeCount2025[type] 
      ? (((typeCount2026[type] || 0) - typeCount2025[type]) / typeCount2025[type] * 100).toFixed(1)
      : typeCount2026[type] ? '+100' : '0'
  })).sort((a, b) => (b['2025'] + b['2026']) - (a['2025'] + a['2026']));
};

// Comparación mensual de eventos entre dos años
export const generateMonthlyComparison = (incidents: Incident[], year1: number = 2025, year2: number = 2026) => {
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const incidents1 = incidents.filter(i => i.year === year1);
  const incidents2 = incidents.filter(i => i.year === year2);
  
  return MONTHS.map((month, idx) => {
    const monthNum = idx + 1;
    const count1 = incidents1.filter(i => i.month === monthNum).length;
    const count2 = incidents2.filter(i => i.month === monthNum).length;
    const diff = count2 - count1;
    
    return {
      month,
      monthNum,
      [String(year1)]: count1,
      [String(year2)]: count2,
      diff,
      trend: diff < 0 ? 'down' : diff > 0 ? 'up' : 'equal'
    };
  });
};

// Tipos de incidentes por mes entre dos años
export const generateTypesByMonthComparison = (incidents: Incident[], year1: number = 2025, year2: number = 2026) => {
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  // Obtener los top 5 tipos más frecuentes
  const typeCount: Record<string, number> = {};
  incidents.forEach(i => {
    typeCount[i.type] = (typeCount[i.type] || 0) + 1;
  });
  
  const topTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type);
  
  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
  
  // Generar datos por mes
  const data = MONTHS.map((month, idx) => {
    const monthNum = idx + 1;
    const monthData: any = { month, monthNum };
    
    topTypes.forEach((type, typeIdx) => {
      const count1 = incidents.filter(i => i.year === year1 && i.month === monthNum && i.type === type).length;
      const count2 = incidents.filter(i => i.year === year2 && i.month === monthNum && i.type === type).length;
      
      const shortType = type.length > 12 ? type.substring(0, 12) + '..' : type;
      monthData[`${shortType}_${year1}`] = count1;
      monthData[`${shortType}_${year2}`] = count2;
    });
    
    return monthData;
  });
  
  return {
    data,
    types: topTypes.map((type, idx) => ({
      type,
      shortType: type.length > 12 ? type.substring(0, 12) + '..' : type,
      color: COLORS[idx]
    }))
  };
};

// 2. Temporal Heatmap Data
export const generateTemporalHeatmap = (incidents: Incident[]) => {
  const heatmapData: Record<string, Record<number, number>> = {};
  
  incidents.forEach(i => {
    if (!heatmapData[i.site]) heatmapData[i.site] = {};
    heatmapData[i.site][i.month] = (heatmapData[i.site][i.month] || 0) + 1;
  });

  const result = [];
  for (const site in heatmapData) {
    for (let month = 1; month <= 12; month++) {
      result.push({
        site,
        month,
        count: heatmapData[site][month] || 0
      });
    }
  }
  
  return result;
};

// 3. Body Map Analytics
export const generateBodyMapAnalytics = (incidents: Incident[]) => {
  const bodyPartCount: Record<string, number> = {};
  
  incidents.forEach(i => {
    if (i.affected_zones && i.affected_zones.length > 0) {
      i.affected_zones.forEach(zone => {
        const label = zone.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        bodyPartCount[label] = (bodyPartCount[label] || 0) + 1;
      });
    }
  });

  return Object.entries(bodyPartCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

// 4. Waterfall Chart Data (Site Contribution to TRIR)
export const generateWaterfallData = (
  incidents: Incident[], 
  exposureHours: ExposureHour[], 
  settings: AppSettings
) => {
  const totalHH = exposureHours.reduce((acc, e) => acc + e.hours, 0);
  const sites = Array.from(new Set(incidents.map(i => i.site)));
  
  let cumulative = 0;
  const data = sites.map(site => {
    const siteIncidents = incidents.filter(i => i.site === site && i.recordable_osha);
    const siteHours = exposureHours.filter(e => e.site === site).reduce((acc, e) => acc + e.hours, 0);
    
    const siteTRIR = siteHours > 0 ? (siteIncidents.length * 200000) / siteHours : 0;
    const start = cumulative;
    cumulative += siteTRIR;
    
    return {
      site,
      value: parseFloat(siteTRIR.toFixed(2)),
      start,
      end: cumulative
    };
  });

  return data.sort((a, b) => b.value - a.value).slice(0, 8);
};

// 5. Scatter Plot Data (Frequency vs Severity)
export const generateScatterPlotData = (
  incidents: Incident[], 
  exposureHours: ExposureHour[]
) => {
  const sites = Array.from(new Set(incidents.map(i => i.site)));
  
  return sites.map(site => {
    const siteIncidents = incidents.filter(i => i.site === site);
    const frequency = siteIncidents.length;
    const avgDays = siteIncidents.length > 0 
      ? siteIncidents.reduce((acc, i) => acc + (i.days_away || 0) + (i.days_restricted || 0), 0) / siteIncidents.length
      : 0;
    const totalHours = exposureHours.filter(e => e.site === site).reduce((acc, e) => acc + e.hours, 0);
    
    return {
      site,
      frequency,
      severity: parseFloat(avgDays.toFixed(1)),
      hours: totalHours
    };
  }).filter(d => d.frequency > 0);
};



// 6. Radar Chart Data (Site Comparison)
export const generateRadarChartData = (
  incidents: Incident[], 
  exposureHours: ExposureHour[], 
  exposureKm: ExposureKm[],
  settings: AppSettings
) => {
  const sites = Array.from(new Set(incidents.map(i => i.site))).slice(0, 5); // Top 5 sites
  
  return sites.map(site => {
    const siteIncidents = incidents.filter(i => i.site === site);
    const siteHours = exposureHours.filter(e => e.site === site);
    const siteKm = exposureKm.filter(e => e.site === site);
    
    const metrics = calculateKPIs(siteIncidents, siteHours, siteKm, settings);
    
    return {
      site,
      TRIR: metrics.trir || 0,
      LTIF: metrics.ltif || 0,
      DART: metrics.dart || 0,
      HIPO: (metrics.hipoRate || 0) * 100,
      SLG24h: metrics.slg24h || 0
    };
  });
};
