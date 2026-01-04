
import React, { useMemo, useState } from 'react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Line, ComposedChart
} from 'recharts';
import { ExposureHour, ExposureKm, Incident, AppSettings, TargetScenarioType, GlobalKmRecord } from '../types';
import { calculateKPIs, generateParetoData } from '../utils/calculations';
import { getMissingExposureImpact, getMissingKmKeys } from '../utils/importHelpers';
import { TARGET_SCENARIOS } from '../constants';
import { AlertTriangle, Activity, TrendingDown, Truck, Users, Clock, Target, Trophy, Info, Zap, BarChart2, Leaf, Siren, Scale, TrendingUp, CalendarCheck, ShieldCheck, Microscope, ListChecks } from 'lucide-react';
import { HeatmapMatrix } from './HeatmapMatrix';

interface DashboardProps {
  incidents: Incident[];
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
  globalKmRecords: GlobalKmRecord[];
  settings: AppSettings;
  onNavigateToExposure?: (site?: string) => void;
  onDrillDown?: (criteria: { type?: string, period?: string, category?: 'LTI' | 'Recordable' | 'Transit' }) => void;
}

// Helper Card Component
const KPICard = ({ title, value, target, subtext, icon: Icon, colorClass, borderClass, onClick, tooltip, footer, blocked, reverseLogic }: any) => {
  const isNull = value === null || value === undefined || blocked;
  
  let statusColor = "text-gray-400";
  if (!isNull && target !== undefined) {
      // Standard: Lower is better. Reverse: Higher is better (e.g. HIPO Ratio sometimes, but here we want High HIPO reporting, so > target is good)
      const isGood = reverseLogic ? value >= target : value <= target;
      const isWarning = reverseLogic ? value >= target * 0.8 && value < target : value <= target * 1.2 && value > target;
      
      if (isGood) statusColor = "text-green-700 bg-green-100 px-1.5 py-0.5 rounded";
      else if (isWarning) statusColor = "text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded";
      else statusColor = "text-red-700 bg-red-100 px-1.5 py-0.5 rounded";
  }

  // String target handling (e.g. "Bajo")
  if (typeof target === 'string' && typeof value === 'string') {
       if (value === target) statusColor = "text-green-700 bg-green-100 px-1.5 py-0.5 rounded";
       else statusColor = "text-red-700 bg-red-100 px-1.5 py-0.5 rounded";
  }
  
  return (
    <div 
        onClick={blocked ? undefined : onClick}
        className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${borderClass} border-t border-r border-b border-gray-100 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer h-full min-h-[140px] relative ${blocked ? 'opacity-70' : ''}`}
        title={tooltip}
    >
      <div className="flex justify-between items-start mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</p>
          <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      
      <div className="flex items-baseline mb-2">
            {isNull ? (
                <span className="text-3xl font-bold text-gray-300 select-none" title={blocked ? "Tasa bloqueada: Faltan horas hombre" : "Falta denominador"}>&mdash;</span>
            ) : (
                <h3 className="text-3xl font-bold text-gray-900 truncate">{value}</h3>
            )}
            {!isNull && target !== undefined && (
                <div className="ml-3">
                    <span className={`text-[10px] font-bold uppercase ${statusColor} flex items-center`}>
                        <Target className="w-3 h-3 mr-1" /> Meta: {target}
                    </span>
                </div>
            )}
      </div>
      
      <div className="text-xs text-gray-500 mt-auto pt-2 border-t border-gray-50">
          {blocked ? <span className="text-red-500 font-bold">Datos incompletos</span> : subtext}
      </div>
      {footer && !blocked && <div className="mt-2 text-xs font-medium text-blue-600">{footer}</div>}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    incidents, exposureHours, exposureKm, globalKmRecords, settings, 
    onNavigateToExposure, onDrillDown 
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TargetScenarioType>('Metas 2026');
  const [paretoView, setParetoView] = useState<'location' | 'type'>('type');
  
  const targets = TARGET_SCENARIOS[selectedScenario];
  
  // MAIN METRICS Calculation
  const metrics = useMemo(() => calculateKPIs(incidents, exposureHours, exposureKm, settings, targets, globalKmRecords), [incidents, exposureHours, exposureKm, settings, targets, globalKmRecords]);
  
  // Sorted Impact Analysis (Missing HH)
  const missingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);
  
  // If ANY missing HH keys exist, we block the main rates.
  const isRatesBlocked = missingImpact.length > 0;
  
  // Check if IFAT KM is missing (Global Check)
  const isIfatBlocked = !metrics.totalKM || metrics.totalKM === 0;

  // CHART DATA GENERATORS
  const paretoData = useMemo(() => generateParetoData(incidents, paretoView), [incidents, paretoView]);
  
  // Risk Trend Data
  const trendData = useMemo(() => {
    const periods = Array.from(new Set([
        ...exposureHours.map(e => e.period),
        ...incidents.map(i => `${i.year}-${String(i.month).padStart(2, '0')}`)
    ])).sort();

    return periods.map(period => {
        const [year, month] = period.split('-').map(Number);
        const sliceIncidents = incidents.filter(i => i.year === year && i.month === month);
        const sliceHours = exposureHours.filter(e => e.period === period);
        
        // Pass empty array for global km in trend calc as it's not time-sliced yet in this view
        const m = calculateKPIs(sliceIncidents, sliceHours, [], settings);
        
        return {
            name: period,
            Risk: m.risk_index_total,
            TRIR: m.trir,
            LTIR: m.ltir,
            TargetTRIR: targets.trir
        };
    });
  }, [incidents, exposureHours, settings, targets]);


  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* 1. TOP BAR: Scenario & Alerts */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <div>
               <h2 className="text-xl font-bold text-gray-800 flex items-center">
                   <Activity className="w-6 h-6 mr-2 text-blue-600" />
                   Tablero de Control HSE
               </h2>
               <p className="text-xs text-gray-500 mt-1">
                   {!isRatesBlocked ? 'Datos de exposición completos.' : 'Faltan Horas Hombre: Tasas bloqueadas para asegurar integridad.'}
               </p>
           </div>
           
           <div className="flex items-center space-x-4">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                    <span className="text-xs font-bold text-gray-500 mx-2 uppercase flex items-center">
                        <Trophy className="w-4 h-4 mr-1 text-yellow-500" /> Objetivos:
                    </span>
                    <select 
                        value={selectedScenario} 
                        onChange={(e) => setSelectedScenario(e.target.value as TargetScenarioType)}
                        className="text-sm border-none bg-transparent font-bold text-gray-800 focus:ring-0 cursor-pointer"
                    >
                        <option value="Metas 2026">Metas 2026 (Oficial)</option>
                        <option value="Realista">Realista (Benchmark)</option>
                        <option value="Desafiante">Desafiante (-20%)</option>
                        <option value="Excelencia">Excelencia (World Class)</option>
                    </select>
                </div>
           </div>
      </div>

      {/* MISSING HH ALERTS (Ordered by Priority) */}
      {isRatesBlocked && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {missingImpact.map((item, idx) => (
                  <div key={item.site} className={`bg-red-50 border rounded-xl p-4 flex flex-col shadow-sm relative ${idx === 0 ? 'border-red-400 ring-1 ring-red-200' : 'border-red-200'}`}>
                      {idx === 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                              Prioridad Alta
                          </span>
                      )}
                      <div className="flex items-start mb-2">
                          <AlertTriangle className={`w-5 h-5 mr-2 flex-shrink-0 ${idx === 0 ? 'text-red-700 animate-pulse' : 'text-red-600'}`} />
                          <div>
                              <h3 className="text-sm font-bold text-red-900">{item.site}</h3>
                              <p className="text-xs text-red-800 font-medium">Faltan Horas-Hombre para calcular tasas en este sitio. Ingrese el promedio mensual.</p>
                          </div>
                      </div>
                      <div className="flex-1 mb-3">
                          <p className="text-[10px] text-red-600 mb-1 bg-red-100/50 p-2 rounded">
                              Faltan: {item.missingPeriods.slice(0, 5).join(', ')}{item.missingPeriods.length > 5 ? ` y ${item.missingPeriods.length - 5} más` : ''}
                          </p>
                          {(item.affectedIncidentsCount > 0) && (
                              <p className="text-[10px] text-red-500 italic mt-1 ml-1">
                                  Impacto: Afecta {item.affectedIncidentsCount} incidentes{item.affectedSevereCount > 0 ? ` (incl. ${item.affectedSevereCount} severos)` : ''}.
                              </p>
                          )}
                      </div>
                      <button 
                        onClick={() => onNavigateToExposure && onNavigateToExposure(item.site)}
                        className="w-full text-center px-4 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 shadow-sm transition-colors"
                      >
                          Completar HH
                      </button>
                  </div>
              ))}
          </div>
      )}

      {/* 2. KPI CARDS - PRIMARY ROW */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2">Indicadores de Desempeño Principal</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
              title="TRIR (Total Recordable)" 
              value={metrics.trir} 
              target={targets.trir}
              icon={Activity}
              colorClass="bg-blue-100 text-blue-600"
              borderClass="border-blue-400"
              subtext={`Meta 2026: ≤ ${TARGET_SCENARIOS['Metas 2026'].trir}`}
              footer={`Forecast: ${metrics.forecast_trir ?? '-'}`}
              tooltip="Total Recordable Incident Rate. Proyección lineal basada en YTD."
              blocked={isRatesBlocked}
          />
          <KPICard 
              title="LTIR (Lost Time)" 
              value={metrics.ltir} 
              target={targets.ltir}
              icon={TrendingDown}
              colorClass="bg-red-100 text-red-600"
              borderClass="border-red-400"
              subtext={`Meta 2026: ≤ ${TARGET_SCENARIOS['Metas 2026'].ltir}`}
              footer={`LTI Cases: ${metrics.totalLTI}`}
              blocked={isRatesBlocked}
          />
           <KPICard 
              title="Indice Frecuencia (IF)" 
              value={metrics.frequencyRate} 
              target={targets.if} 
              icon={Zap}
              colorClass="bg-orange-100 text-orange-600"
              borderClass="border-orange-400"
              subtext={`Meta 2026: ≤ ${TARGET_SCENARIOS['Metas 2026'].if}`}
              footer={`Base ${settings.base_if.toLocaleString()} HH`}
              blocked={isRatesBlocked}
          />
          <KPICard 
              title="Incidentes Totales" 
              value={metrics.totalIncidents} 
              target={undefined}
              icon={Clock}
              colorClass="bg-gray-100 text-gray-600"
              borderClass="border-gray-400"
              subtext={selectedScenario === 'Metas 2026' ? `Obj: Reducción ${targets.total_incidents_reduction}%` : 'Volumen total'}
              blocked={false}
          />
      </div>

      {/* 3. NEW: TRENDS & ACTIONS (No more fixed objectives) */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2 pt-2">Gestión de Tendencias y Acciones</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* A. EVOLUTION (IMPROVING/DETERIORATING) - MAIN INDICATOR */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                   <h3 className="font-bold text-gray-800 text-sm flex items-center">
                      <Microscope className="w-4 h-4 mr-2 text-purple-600" /> Evolución de Sitios
                  </h3>
                  <span className="text-[10px] text-gray-400">Trimestre actual vs previo</span>
              </div>
              <div className="p-2 space-y-2">
                  {metrics.siteEvolutions.length === 0 ? (
                      <div className="text-center p-4 text-gray-400 italic text-xs">Sin histórico suficiente</div>
                  ) : (
                      metrics.siteEvolutions.sort((a,b) => b.variationPct - a.variationPct).map(item => (
                          <div key={item.site} className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-100 text-xs">
                              <span className="font-bold text-gray-700 truncate w-1/3" title={item.site}>{item.site}</span>
                              <div className="flex items-center space-x-2 text-gray-500 w-1/3 justify-center">
                                  <span>{item.prevAvg}</span>
                                  <span className="text-gray-300">→</span>
                                  <span className="font-bold text-gray-800">{item.currentAvg}</span>
                              </div>
                              <div className="w-1/3 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      item.status === 'deteriorating' ? 'bg-red-100 text-red-700' :
                                      item.status === 'improving' ? 'bg-green-100 text-green-700' :
                                      'bg-gray-100 text-gray-600'
                                  }`}>
                                      {item.variationPct > 0 ? '+' : ''}{item.variationPct}%
                                  </span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* B. TREND ALERTS (EARLY WARNINGS) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2 text-red-500" /> Alertas Tempranas
                  </h3>
                  <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded">Tendencia 3 Meses</span>
              </div>
              <div className="p-4 flex flex-col items-center justify-center">
                  {metrics.trendAlerts.length === 0 ? (
                      <div className="text-center">
                          <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-gray-500">No se detectan tendencias crecientes sostenidas.</p>
                      </div>
                  ) : (
                      <div className="w-full space-y-3">
                          {metrics.trendAlerts.map(alert => (
                              <div key={alert.site} className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-center justify-between">
                                  <div className="flex items-center">
                                      <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
                                      <div>
                                          <p className="text-xs font-bold text-red-900">{alert.site}</p>
                                          <p className="text-[10px] text-red-700">Incremento sostenido últimos 3 meses</p>
                                      </div>
                                  </div>
                                  <div className="flex items-center space-x-1 text-[10px] font-mono font-bold text-red-800">
                                      {alert.history.map((h, i) => (
                                          <React.Fragment key={i}>
                                              <span>{h.count}</span>
                                              {i < 2 && <span className="text-red-400">→</span>}
                                          </React.Fragment>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>

          {/* C. AUTOMATED ACTIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center">
                      <ListChecks className="w-4 h-4 mr-2 text-orange-500" /> Acciones Sugeridas
                  </h3>
                  <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded">Automático</span>
              </div>
              <div className="p-3">
                  {metrics.suggestedActions.length === 0 ? (
                      <div className="text-center py-10">
                          <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2 opacity-50" />
                          <p className="text-xs text-gray-500">No se requieren acciones correctivas urgentes en este período.</p>
                      </div>
                  ) : (
                      <div className="space-y-3">
                          {metrics.suggestedActions.map((action, idx) => (
                              <div key={`${action.site}-${idx}`} className="bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                      <h4 className="text-xs font-bold text-gray-800">{action.title}</h4>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                          action.reason === 'deterioration' ? 'bg-red-50 text-red-600' :
                                          'bg-orange-50 text-orange-600'
                                      }`}>
                                          {action.reason === 'trend_alert' ? 'Tendencia' : 'Deterioro'}
                                      </span>
                                  </div>
                                  <ul className="text-[10px] text-gray-600 space-y-1 ml-2 list-disc marker:text-blue-400">
                                      {action.actions.map((act, i) => (
                                          <li key={i}>{act}</li>
                                      ))}
                                  </ul>
                                  <p className="text-[8px] text-gray-400 italic mt-2 text-right">Generado por análisis histórico</p>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* 4. OPERATIONAL MANAGEMENT (Top 5 & Days Safe) */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2 pt-2">Gestión Operativa</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* A. TOP 5 SITES */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center">
                      <Trophy className="w-4 h-4 mr-2 text-yellow-500" /> Top 5 Sitios (YTD)
                  </h3>
                  <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-bold">Volumen de Incidentes</span>
              </div>
              <div className="p-0">
                  <table className="min-w-full text-xs">
                      <tbody>
                          {metrics.top5Sites.length === 0 ? (
                              <tr><td className="p-4 text-center text-gray-400 italic">Sin datos disponibles</td></tr>
                          ) : (
                              metrics.top5Sites.map((item, idx) => (
                                  <tr key={item.site} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors" title="Filtrar por sitio">
                                      <td className="px-4 py-3 font-bold text-gray-500 w-8 text-center">{idx + 1}</td>
                                      <td className="px-4 py-3 font-medium text-gray-800">{item.site}</td>
                                      <td className="px-4 py-3 text-right font-bold text-blue-600">{item.count}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* B. DAYS WITHOUT ACCIDENTS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
                   <h3 className="font-bold text-gray-800 text-sm flex items-center">
                      <CalendarCheck className="w-4 h-4 mr-2 text-green-600" /> Días sin Accidentes
                  </h3>
                  <span className="text-[10px] text-gray-400">Desde último evento</span>
              </div>
              <div className="p-2 space-y-2">
                  {metrics.daysSinceList.length === 0 ? (
                      <div className="text-center p-4 text-gray-400 italic text-xs">Sin registros históricos</div>
                  ) : (
                      metrics.daysSinceList.map(item => (
                          <div key={item.site} className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-100">
                              <span className="text-xs font-bold text-gray-700 truncate w-1/2" title={item.site}>{item.site}</span>
                              <div className="flex items-center space-x-3">
                                  <span className="text-[10px] text-gray-400">{item.lastDate}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold min-w-[3rem] text-center ${
                                      item.status === 'critical' ? 'bg-red-100 text-red-700' :
                                      item.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                  }`}>
                                      {item.days}
                                  </span>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      </div>

      {/* 5. KPI CARDS - SECONDARY ROW (Specifics) */}
      <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-2 pt-2">Indicadores Específicos y Ambientales</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
              title="Tasa Incidencia (%)" 
              value={metrics.incidenceRatePct !== null ? `${metrics.incidenceRatePct}%` : null} 
              target={`${targets.incidence_rate_pct}%`}
              icon={Users}
              colorClass="bg-indigo-100 text-indigo-600"
              borderClass="border-indigo-400"
              subtext="Total Incidentes / Fuerza Laboral"
              blocked={isRatesBlocked}
          />
          <KPICard 
              title="HIPO Rate" 
              value={metrics.hipoRate} 
              target={targets.hipo_rate_min}
              icon={Siren}
              colorClass="bg-yellow-100 text-yellow-600"
              borderClass="border-yellow-400"
              subtext={`${metrics.hipoCount} eventos de Alto Potencial`}
              footer="Target: ≥ 1 cada 5 (0.2)"
              reverseLogic={true}
              blocked={false}
          />
           <KPICard 
              title="Ambientales (May/Men)" 
              value={`${metrics.envIncidentsMajor} / ${metrics.envIncidentsMinor}`} 
              target={undefined}
              icon={Leaf}
              colorClass="bg-green-100 text-green-600"
              borderClass="border-green-400"
              subtext={`Meta: 0 Mayores, ≤ ${targets.env_minor} Menores`}
              blocked={false}
          />
          <KPICard 
              title="Índice Probabilidad" 
              value={metrics.probabilityIndexLabel} 
              target={targets.probability_index_target}
              icon={Scale}
              colorClass="bg-purple-100 text-purple-600"
              borderClass="border-purple-400"
              subtext="Nivel promedio ponderado"
              blocked={false}
          />
      </div>

      {/* 6. CHART ROW: RISK & TREND */}
      <div id="dashboard-charts-container" className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-2 rounded-xl min-w-0">
          
          {/* Risk Index Trend - FIXED CONTAINER */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-w-0 flex flex-col">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                   <Zap className="w-4 h-4 mr-2 text-orange-500" /> Evolución Índice de Riesgo
               </h3>
               {/* Fixed Height Wrapper with style overrides to ensure Recharts finds dimensions */}
               <div className="h-96 w-full min-w-0 relative" style={{ height: '384px', width: '100%' }}>
                   {trendData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={trendData}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                               <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false}/>
                               <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false}/>
                               <YAxis yAxisId="right" orientation="right" fontSize={10} tickLine={false} axisLine={false}/>
                               <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 2px 10px rgba(0,0,0,0.1)'}}/>
                               <Legend />
                               <Bar yAxisId="left" dataKey="Risk" name="Puntos Riesgo" fill="#fb923c" radius={[4,4,0,0]} barSize={20} />
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="TRIR" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} />}
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
                           Sin datos para visualizar tendencias.
                       </div>
                   )}
               </div>
          </div>

          {/* Pareto Chart - FIXED CONTAINER */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-w-0 flex flex-col">
               <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center">
                       <BarChart2 className="w-4 h-4 mr-2 text-blue-500" /> Pareto 80/20
                   </h3>
                   <div className="flex space-x-2 text-xs">
                       <button onClick={() => setParetoView('type')} className={`px-2 py-1 rounded ${paretoView==='type'?'bg-blue-100 text-blue-700':'bg-gray-100'}`}>Por Tipo</button>
                       <button onClick={() => setParetoView('location')} className={`px-2 py-1 rounded ${paretoView==='location'?'bg-blue-100 text-blue-700':'bg-gray-100'}`}>Por Ubicación</button>
                   </div>
               </div>
               {/* Fixed Height Wrapper with style overrides */}
               <div className="h-96 w-full min-w-0 relative" style={{ height: '384px', width: '100%' }}>
                   {paretoData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={paretoData} onClick={(d) => d && d.activePayload && onDrillDown && onDrillDown({ type: d.activePayload[0].payload.name })}>
                               <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                               <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={40}/>
                               <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false}/>
                               <YAxis yAxisId="right" orientation="right" unit="%" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]}/>
                               <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}}/>
                               <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="#64748b" barSize={30} radius={[4,4,0,0]} />
                               <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="% Acumulado" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
                           Sin datos para visualizar Pareto.
                       </div>
                   )}
               </div>
          </div>
      </div>

      {/* 7. HEATMAP MATRIX ROW (Full Width) */}
      <div className="min-w-0">
          <div className="min-h-[500px] w-full">
              <HeatmapMatrix incidents={incidents} />
          </div>
      </div>

      {/* 8. TRANSIT MODULE */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <div className="flex items-center mb-6">
              <Truck className="w-6 h-6 mr-3 text-purple-600" />
              <div>
                  <h3 className="text-lg font-bold text-slate-800">Módulo de Gestión Vial</h3>
                  <p className="text-xs text-slate-500">Separación estricta: Tránsito Laboral (IFAT) vs In Itinere (Commuting).</p>
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* IFAT */}
              <div className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${isIfatBlocked ? 'border-gray-400' : 'border-purple-500'}`}>
                  <h4 className="text-xs font-bold text-purple-600 uppercase mb-2">IFAT Rate (Laboral)</h4>
                  <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-slate-900">{metrics.ifatRate ?? '—'}</span>
                      <span className="ml-2 text-xs text-slate-500">/ 1M KM</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                      Target 2026: ≤ {TARGET_SCENARIOS['Metas 2026'].ifat_km} • {metrics.cnt_transit_laboral} eventos
                  </div>
                  {isIfatBlocked && (
                      <div className="mt-2">
                          <p className="text-[10px] text-red-600 font-bold mb-1">Faltan KM recorridos para calcular IFAT.</p>
                          <button 
                            onClick={() => onNavigateToExposure && onNavigateToExposure()}
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2 py-1 rounded font-bold"
                          >
                              Cargar KM (Global)
                          </button>
                      </div>
                  )}
                  <div className="mt-2 bg-blue-50 text-blue-800 text-[9px] px-2 py-1 rounded flex items-center">
                      <Info className="w-3 h-3 mr-1" /> Cálculo basado en KM Globales.
                  </div>
              </div>

              {/* IN ITINERE */}
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-400">
                  <h4 className="text-xs font-bold text-indigo-500 uppercase mb-2">In Itinere (Commuting)</h4>
                  <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-slate-900">{metrics.cnt_in_itinere}</span>
                      <span className="ml-2 text-xs text-slate-500">Eventos</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                      No afecta IFAT ni TRIR
                  </div>
                  {(!isRatesBlocked) && (
                      <div className="mt-2 text-xs text-indigo-600 font-medium">
                          Tasa (HH): {metrics.rate_in_itinere_hh ?? '-'}
                      </div>
                  )}
              </div>

              {/* TIP */}
              <div className="flex items-center justify-center p-4 text-center text-xs text-slate-400 italic">
                  <Info className="w-4 h-4 mr-2" />
                  "Los accidentes In Itinere se registran como indicador independiente y no penalizan el desempeño de planta (Safety)."
              </div>
          </div>
      </div>

    </div>
  );
};
