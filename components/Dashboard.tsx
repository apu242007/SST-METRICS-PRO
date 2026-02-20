
import React, { useMemo, useState } from 'react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Line, ComposedChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, ScatterChart, Scatter, ZAxis, BarChart, Area, AreaChart,
  ReferenceLine
} from 'recharts';
import { ExposureHour, ExposureKm, Incident, AppSettings, TargetScenarioType, GlobalKmRecord } from '../types';
import { 
  calculateKPIs, generateParetoData, generateSeverityDistribution,
  generateTemporalHeatmap,
  generateWaterfallData, generateScatterPlotData,
  generateRadarChartData, generateYearComparisonByType,
  generateMonthlyComparison, generateTypesByMonthComparison,
  getExposureHoursSummary, fillMissingExposureHours
} from '../utils/calculations';
import { getMissingExposureImpact, getMissingExposureKeys } from '../utils/importHelpers';
import { TARGET_SCENARIOS, KPI_DEFINITIONS } from '../constants';
import { AlertTriangle, Activity, TrendingDown, Truck, Users, Clock, Target, Trophy, Info, BarChart2, Leaf, Siren, Scale, TrendingUp, CalendarCheck, ShieldCheck, Microscope, Flame, FileCheck, HeartPulse, Calculator, X, CheckCircle2, ChevronDown, ChevronUp, Table as TableIcon, PieChart as PieIcon, Layers, Calendar } from 'lucide-react';
import { HeatmapMatrix } from './HeatmapMatrix';

interface DashboardFilters {
  site: string;
  year: string;
  month: string;
}

interface DashboardProps {
  incidents: Incident[];
  allIncidents?: Incident[]; // Para gráficos de comparación entre años
  exposureHours: ExposureHour[];
  allExposureHours?: ExposureHour[]; // Para tabla de resumen sin filtro de año
  exposureKm: ExposureKm[];
  globalKmRecords: GlobalKmRecord[];
  settings: AppSettings;
  filters?: DashboardFilters; // Filtros globales (sitio, mes)
  onNavigateToExposure?: (site?: string) => void;
  onOpenKmModal?: () => void; // NEW PROP
  onDrillDown?: (criteria: { type?: string, period?: string, category?: 'LTI' | 'Recordable' | 'Transit' }) => void;
}

// Data for the Target Evolution Table
const TARGET_COMPARISON_DATA = [
  { label: 'TRIR (OSHA)', m25: '2.5', m26: '1.2', var: '↓ 52%' },
  { label: 'LTIF (IOGP)', m25: '5.0', m26: '2.5', var: '↓ 50%' },
  { label: 'DART (OSHA)', m25: '1.2', m26: '0.6', var: '↓ 50%' },
  { label: 'SR (Severidad)', m25: '0.20', m26: '0.15', var: '↓ 25%' },
  { label: 'FAR (Fatalidad)', m25: '2', m26: '0', var: '↓ 100% (objetivo “cero”)' },
  { label: 'T1 PSER (Tier 1)', m25: '0.5', m26: '0.1', var: '↓ 80%' },
  { label: 'T2 PSER (Tier 2)', m25: '1.5', m26: '1.0', var: '↓ 33%' },
  { label: 'SLG-24H', m25: '100%', m26: '100%', var: '= (sin cambios)' },
];

// Helper Card Component
const KPICard = ({ title, value, target, subtext, icon: Icon, colorClass, borderClass, onClick, tooltip, footer, blocked, reverseLogic, unit }: any) => {
  const isNull = value === null || value === undefined || blocked;
  
  let statusColor = "text-gray-400";
  if (!isNull && target !== undefined) {
      // Standard: Lower is better. Reverse: Higher is better (e.g. Audit Compliance)
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
                <div className="flex items-baseline">
                    <h3 className="text-3xl font-bold text-gray-900 truncate">{value}</h3>
                    {unit && <span className="ml-1 text-sm text-gray-400 font-medium">{unit}</span>}
                </div>
            )}
            {!isNull && target !== undefined && (
                <div className="ml-auto">
                    <span className={`text-[10px] font-bold uppercase ${statusColor} flex items-center`}>
                        <Target className="w-3 h-3 mr-1" /> Meta: {target}
                    </span>
                </div>
            )}
      </div>
      
      <div className="text-xs text-gray-500 mt-auto pt-2 border-t border-gray-50 flex justify-between items-center">
          {blocked ? <span className="text-red-500 font-bold">Datos incompletos</span> : <span>{subtext}</span>}
          {footer && !blocked && <span className="font-medium text-blue-600">{footer}</span>}
      </div>
    </div>
  );
};

// --- METRIC DETAIL MODAL ---
const MetricDetailModal = ({ detail, onClose }: { detail: any, onClose: () => void }) => {
    if (!detail) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center">
                        <Calculator className="w-5 h-5 text-blue-600 mr-2" />
                        <h3 className="font-bold text-gray-800">{detail.title}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar ventana de detalles"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Descripción</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{detail.description}</p>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-700 uppercase mb-3 flex items-center">
                            <Activity className="w-3 h-3 mr-1"/> Fórmula de Cálculo
                        </h4>
                        <p className="text-xs font-mono text-blue-900 bg-white p-2 rounded border border-blue-200 mb-4 text-center">
                            {detail.formula}
                        </p>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm border-b border-blue-200 pb-1">
                                <span className="text-blue-600 font-medium">{detail.numeratorLabel}:</span>
                                <span className="font-bold text-gray-800">{detail.num !== undefined ? detail.num.toLocaleString() : '-'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b border-blue-200 pb-1">
                                <span className="text-blue-600 font-medium">Factor:</span>
                                <span className="font-bold text-gray-800">x {detail.factor ? detail.factor.toLocaleString() : '1'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-blue-600 font-medium">{detail.denominatorLabel}:</span>
                                <span className="font-bold text-gray-800">{detail.den !== undefined ? detail.den.toLocaleString() : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Resultado Actual</span>
                        <span className="text-2xl font-bold text-blue-600">{detail.value !== null ? detail.value : '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    incidents, allIncidents, exposureHours, allExposureHours, exposureKm, globalKmRecords, settings,
    filters, onNavigateToExposure, onOpenKmModal, onDrillDown 
}) => {
  // Todos los datos sin filtrar (para comparativas 2025 vs 2026)
  const comparisonIncidents = allIncidents || incidents;
  const comparisonExposureHours = allExposureHours || exposureHours;

  // Datos filtrados SOLO por sitio (no por año/mes) — para gráficos multi-año por sitio
  const siteFilteredIncidents = useMemo(() => {
    if (!filters || filters.site === 'All') return comparisonIncidents;
    return comparisonIncidents.filter(i => i.site === filters.site);
  }, [comparisonIncidents, filters]);

  const siteFilteredExposureHours = useMemo(() => {
    if (!filters || filters.site === 'All') return comparisonExposureHours;
    return comparisonExposureHours.filter(h => h.site === filters.site);
  }, [comparisonExposureHours, filters]);
  
  const [selectedScenario, setSelectedScenario] = useState<TargetScenarioType>('Metas 2026');
  const [paretoView, setParetoView] = useState<'location' | 'type'>('type');
  const [selectedMetric, setSelectedMetric] = useState<any | null>(null);
  const [showTargetsTable, setShowTargetsTable] = useState(false);
  
  const targets = TARGET_SCENARIOS[selectedScenario];
  
  // MAIN METRICS Calculation
  const metrics = useMemo(() => calculateKPIs(incidents, exposureHours, exposureKm, settings, targets, globalKmRecords), [incidents, exposureHours, exposureKm, settings, targets, globalKmRecords]);
  
  // Sorted Impact Analysis (Missing HH)
  const missingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);
  const isRatesBlocked = missingImpact.length > 0;
  const isIfatBlocked = !metrics.totalKM || metrics.totalKM === 0;

  // CHART DATA GENERATORS
  const paretoData = useMemo(() => generateParetoData(incidents, paretoView), [incidents, paretoView]);
  
  // Risk Trend Data - filtrado por sitio (si hay), muestra todos los períodos
  const trendData = useMemo(() => {
    const periods = Array.from(new Set([
        ...siteFilteredExposureHours.map(e => e.period),
        ...siteFilteredIncidents.map(i => `${i.year}-${String(i.month).padStart(2, '0')}`)
    ])).sort();

    return periods.map(period => {
        const [year, month] = period.split('-').map(Number);
        const sliceIncidents = siteFilteredIncidents.filter(i => i.year === year && i.month === month);
        const sliceHours = siteFilteredExposureHours.filter(e => e.period === period);
        
        const m = calculateKPIs(sliceIncidents, sliceHours, [], settings);
        
        return {
            name: period,
            Risk: m.risk_index_total,
            TRIR: m.trir,
            LTIR: m.ltif,
            TargetTRIR: targets.trir
        };
    });
  }, [siteFilteredIncidents, siteFilteredExposureHours, settings, targets]);

  const handleCardClick = (kpiKey: keyof typeof KPI_DEFINITIONS, value: any, num: number, den: number) => {
      const def = KPI_DEFINITIONS[kpiKey];
      if (def) {
          setSelectedMetric({
              ...def,
              value,
              num,
              den
          });
      }
  };

  // Dynamic Status Logic for Process Safety
  const isT1Good = metrics.t1_pser !== null && metrics.t1_pser <= targets.t1_pser;
  const isT2Good = metrics.t2_pser !== null && metrics.t2_pser <= targets.t2_pser;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {selectedMetric && <MetricDetailModal detail={selectedMetric} onClose={() => setSelectedMetric(null)} />}

      {/* TOP BAR: Scenario & Alerts */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <div>
               <h2 className="text-xl font-bold text-gray-800 flex items-center">
                   <Activity className="w-6 h-6 mr-2 text-blue-600" />
                   Tablero Corporativo HSE
               </h2>
               <p className="text-xs text-gray-500 mt-1">
                   Estándares: OSHA (200k), IOGP (1M), API RP 754, ISO 45001.
               </p>
           </div>
           
           <div className="flex items-center space-x-4">
                <button 
                    onClick={() => setShowTargetsTable(!showTargetsTable)}
                    className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${showTargetsTable ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                >
                    <TableIcon className="w-4 h-4 mr-2" />
                    {showTargetsTable ? 'Ocultar Evolución' : 'Ver Plan Evolución'}
                    {showTargetsTable ? <ChevronUp className="w-3 h-3 ml-2"/> : <ChevronDown className="w-3 h-3 ml-2"/>}
                </button>

                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                    <span className="text-xs font-bold text-gray-500 mx-2 uppercase flex items-center">
                        <Target className="w-4 h-4 mr-1 text-yellow-500" /> Metas:
                    </span>
                    <select 
                        value={selectedScenario} 
                        onChange={(e) => setSelectedScenario(e.target.value as TargetScenarioType)}
                        className="text-sm border-none bg-transparent font-bold text-gray-800 focus:ring-0 cursor-pointer"
                        aria-label="Seleccionar escenario de metas"
                    >
                        <option value="Realista 2025">Realista (2025)</option>
                        <option value="Metas 2026">Metas 2026</option>
                    </select>
                </div>
           </div>
      </div>

      {/* COMPARISON TABLE COLLAPSIBLE */}
      {showTargetsTable && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-300">
              <div className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center">
                      <TrendingDown className="w-4 h-4 mr-2 text-green-600"/> Evolución de Metas Corporativas (2025 vs 2026)
                  </h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Indicador</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Meta 2025</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50">Meta 2026</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Variación</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {TARGET_COMPARISON_DATA.map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-3 text-gray-900 font-bold">{row.label}</td>
                                  <td className="px-6 py-3 text-right text-gray-600 font-mono">{row.m25}</td>
                                  <td className="px-6 py-3 text-right text-blue-700 font-mono font-bold bg-blue-50/30">{row.m26}</td>
                                  <td className={`px-6 py-3 text-right font-bold text-xs ${row.var.includes('↓') ? 'text-green-600' : 'text-gray-400'}`}>
                                      {row.var}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* MISSING HH ALERTS */}
      {isRatesBlocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
             <div className="flex items-center">
                 <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                 <div>
                     <h3 className="text-sm font-bold text-red-900">Datos Incompletos</h3>
                     <p className="text-xs text-red-800">Faltan Horas Hombre en {missingImpact.length} sitios. Las tasas están bloqueadas.</p>
                 </div>
             </div>
             <button onClick={() => onNavigateToExposure && onNavigateToExposure()} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700">Completar</button>
          </div>
      )}

      {/* A. OCCUPATIONAL SAFETY */}
      <div id="kpi-occupational-safety" className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <HeartPulse className="w-4 h-4 mr-2" /> Seguridad Ocupacional (Lagging)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <KPICard 
                  title="TRIR (OSHA)" 
                  value={metrics.trir} 
                  target={targets.trir}
                  icon={Activity}
                  colorClass="bg-blue-100 text-blue-600"
                  borderClass="border-blue-400"
                  subtext="Base 200k Horas"
                  footer={`Forecast: ${metrics.forecast_trir ?? '-'}`}
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('trir', metrics.trir, metrics.totalRecordables, metrics.totalManHours)}
              />
              <KPICard 
                  title="LTIF (IOGP)" 
                  value={metrics.ltif} 
                  target={targets.ltif}
                  icon={TrendingDown}
                  colorClass="bg-orange-100 text-orange-600"
                  borderClass="border-orange-400"
                  subtext="Base 1M Horas"
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('ltif', metrics.ltif, metrics.totalLTI, metrics.totalManHours)}
              />
              <KPICard 
                  title="DART (OSHA)" 
                  value={metrics.dart} 
                  target={targets.dart}
                  icon={AlertTriangle}
                  colorClass="bg-indigo-100 text-indigo-600"
                  borderClass="border-indigo-400"
                  subtext="Días Perd/Rest/Trans"
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('dart', metrics.dart, metrics.totalDARTCases, metrics.totalManHours)}
              />
              <KPICard 
                  title="SR (Severidad)" 
                  value={metrics.sr} 
                  target={targets.sr}
                  icon={Clock}
                  colorClass="bg-gray-100 text-gray-600"
                  borderClass="border-gray-400"
                  subtext="Días/1k Horas (ILO)"
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('sr', metrics.sr, metrics.totalDaysLost, metrics.totalManHours)}
              />
              <KPICard 
                  title="FAR (Fatalidad)" 
                  value={metrics.far} 
                  target={targets.far}
                  icon={Siren}
                  colorClass="bg-red-100 text-red-600"
                  borderClass="border-red-400"
                  subtext="Base 100M Horas"
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('far', metrics.far, metrics.totalFatalities, metrics.totalManHours)}
              />
          </div>
          {/* Descripción de KPIs OSHA */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 mt-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-blue-700">TRIR:</span> Tasa de incidentes registrables totales por 200,000 horas trabajadas (OSHA). &nbsp;
                  <span className="font-semibold text-orange-600">LTIF:</span> Frecuencia de lesiones con tiempo perdido por 1,000,000 horas (IOGP). &nbsp;
                  <span className="font-semibold text-indigo-600">DART:</span> Días de ausencia, restricción o transferencia por 200,000 horas. &nbsp;
                  <span className="font-semibold text-gray-600">SR:</span> Severidad - días perdidos por cada 1,000 horas trabajadas (OIT). &nbsp;
                  <span className="font-semibold text-red-600">FAR:</span> Tasa de accidentes fatales por 100,000,000 horas.
              </p>
          </div>
      </div>

      {/* B. PROCESS SAFETY */}
      <div id="kpi-process-safety" className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <Flame className="w-4 h-4 mr-2" /> Seguridad de Procesos (API RP 754)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <KPICard 
                  title="T1 PSER (Tier 1)" 
                  value={metrics.t1_pser} 
                  target={targets.t1_pser}
                  icon={isT1Good ? CheckCircle2 : AlertTriangle}
                  colorClass={isT1Good ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
                  borderClass={isT1Good ? "border-green-600" : "border-red-600"}
                  subtext={`${metrics.t1_count} eventos mayores`}
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('t1_pser', metrics.t1_pser, metrics.t1_count, metrics.totalManHours)}
              />
              <KPICard 
                  title="T2 PSER (Tier 2)" 
                  value={metrics.t2_pser} 
                  target={targets.t2_pser}
                  icon={isT2Good ? CheckCircle2 : AlertTriangle}
                  colorClass={isT2Good ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}
                  borderClass={isT2Good ? "border-green-500" : "border-orange-500"}
                  subtext={`${metrics.t2_count} eventos menores`}
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('t2_pser', metrics.t2_pser, metrics.t2_count, metrics.totalManHours)}
              />
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 col-span-2 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                      <p className="font-bold mb-1">Definiciones API 754:</p>
                      <ul className="list-disc ml-4 space-y-1">
                          <li>Tier 1: Pérdida de contención mayor (LOPC) con consecuencias severas.</li>
                          <li>Tier 2: LOPC de menor magnitud o activación de sistemas de seguridad.</li>
                      </ul>
                  </div>
              </div>
          </div>
      </div>

      {/* C. REGULATORY */}
      <div id="kpi-regulatory" className="space-y-4">
           <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <Scale className="w-4 h-4 mr-2" /> Regulatorio (SRT Argentina)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard 
                  title="Ind. Incidencia" 
                  value={metrics.incidenceRateSRT} 
                  target={undefined}
                  icon={Users}
                  colorClass="bg-teal-100 text-teal-600"
                  borderClass="border-teal-400"
                  subtext="Casos x 1000 / Trabajadores"
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('incidenceRateSRT', metrics.incidenceRateSRT, metrics.totalLTI, metrics.totalManHours / 200)}
              />
               <KPICard 
                  title="SLG-24h" 
                  value={`${metrics.slg24h}%`} 
                  target="100%"
                  icon={FileCheck}
                  colorClass="bg-green-100 text-green-600"
                  borderClass="border-green-400"
                  subtext="Denuncia SRT <= 24hs"
                  reverseLogic={true}
                  blocked={false}
                  onClick={() => handleCardClick('slg24h', metrics.slg24h, incidents.filter(i => i.is_verified).length, incidents.length)}
              />
              <KPICard 
                  title="ALOS (Días Promedio)" 
                  value={metrics.alos} 
                  target={undefined}
                  icon={Clock}
                  colorClass="bg-purple-100 text-purple-600"
                  borderClass="border-purple-400"
                  subtext="Promedio días de baja"
                  blocked={false}
                  unit="días"
              />
          </div>
          {/* Descripción de KPIs Regulatorios */}
          <div className="bg-gradient-to-r from-teal-50 to-green-50 p-4 rounded-lg border border-teal-200 mt-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-teal-600">Índice de Incidencia:</span> Casos reportables por cada 1,000 trabajadores (SRT). &nbsp;
                  <span className="font-semibold text-green-600">SLG-24h:</span> Porcentaje de incidentes denunciados a la SRT dentro de las 24 horas. &nbsp;
                  <span className="font-semibold text-purple-600">ALOS:</span> Promedio de días de baja por accidente (Average Length Of Stay).
              </p>
          </div>
      </div>

      {/* D. ENVIRONMENTAL SAFETY */}
      <div id="kpi-environmental-safety" className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <Leaf className="w-4 h-4 mr-2" /> Seguridad Ambiental
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard 
                  title="Incidentes Mayores" 
                  value={metrics.envIncidentsMajor} 
                  target={0}
                  icon={AlertTriangle}
                  colorClass="bg-red-100 text-red-600"
                  borderClass="border-red-400"
                  subtext="Alto Riesgo Ambiental"
                  blocked={false}
              />
              <KPICard 
                  title="Incidentes Menores" 
                  value={metrics.envIncidentsMinor} 
                  target={undefined}
                  icon={Leaf}
                  colorClass="bg-yellow-100 text-yellow-600"
                  borderClass="border-yellow-400"
                  subtext="Bajo Riesgo Ambiental"
                  blocked={false}
              />
              <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-400 flex flex-col justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Clasificación Riesgo</p>
                  <div className="flex items-baseline">
                      <span className={`text-2xl font-bold ${
                          metrics.probabilityIndexLabel === 'Alto' ? 'text-red-600' :
                          metrics.probabilityIndexLabel === 'Medio' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                          {metrics.probabilityIndexLabel}
                      </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Índice promedio de probabilidad</p>
              </div>
          </div>
          {/* Descripción de KPIs Ambientales */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200 mt-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-red-600">Incidentes Mayores:</span> Eventos con alto impacto ambiental (derrames significativos, emisiones, daño a ecosistemas). &nbsp;
                  <span className="font-semibold text-yellow-600">Incidentes Menores:</span> Eventos de bajo impacto controlados localmente. &nbsp;
                  <span className="font-semibold text-green-600">Clasificación Riesgo:</span> Nivel promedio de riesgo ambiental basado en la probabilidad de ocurrencia.
              </p>
          </div>
      </div>

      {/* E. LEADING INDICATORS (PROACTIVE) */}
      <div id="kpi-leading-indicators" className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <Microscope className="w-4 h-4 mr-2" /> Indicadores Proactivos (Leading)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard 
                  title="HIPO Count" 
                  value={metrics.hipoCount} 
                  target={0}
                  icon={AlertTriangle}
                  colorClass="bg-orange-100 text-orange-600"
                  borderClass="border-orange-400"
                  subtext="Alta Potencialidad"
                  blocked={false}
              />
              <KPICard 
                  title="HIPO Rate" 
                  value={`${((metrics.hipoRate ?? 0) * 100).toFixed(0)}%`}
                  target={undefined}
                  icon={TrendingUp}
                  colorClass="bg-amber-100 text-amber-600"
                  borderClass="border-amber-400"
                  subtext="% HIPO vs Total"
                  blocked={false}
              />
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl shadow-sm border-l-4 border-indigo-400">
                  <p className="text-xs font-bold text-indigo-600 uppercase mb-2">Pronóstico Anual</p>
                  <div className="space-y-1">
                      <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">TRIR:</span>
                          <span className="text-sm font-bold text-indigo-700">{metrics.forecast_trir ?? '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">LTI:</span>
                          <span className="text-sm font-bold text-indigo-700">{metrics.forecast_lti_count ?? '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-600">Registrables:</span>
                          <span className="text-sm font-bold text-indigo-700">{metrics.forecast_recordable_count ?? '-'}</span>
                      </div>
                  </div>
              </div>
          </div>
          {/* Descripción de Indicadores Proactivos */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-200 mt-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-semibold text-orange-600">HIPO Count:</span> Cantidad de incidentes de alta potencialidad (podrían haber causado lesiones graves). &nbsp;
                  <span className="font-semibold text-amber-600">HIPO Rate:</span> Porcentaje de eventos HIPO sobre el total de incidentes. &nbsp;
                  <span className="font-semibold text-indigo-600">Pronóstico:</span> Proyección anual basada en tendencia actual de tasas e incidentes.
              </p>
          </div>
      </div>

      {/* 6. CHARTS ROW (Risk Trend & Pareto) */}
      <div id="dashboard-charts-container" className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-2 rounded-xl min-w-0">
          <div id="chart-risk-trend" className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-w-0 flex flex-col">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                   <TrendingUp className="w-5 h-5 mr-2 text-orange-500" /> Evolución Índice de Riesgo
               </h3>
               <div className="h-64 w-full min-w-0 relative">
                   {trendData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={trendData}>
                               <defs>
                                   <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#fb923c" stopOpacity={0.8}/>
                                       <stop offset="95%" stopColor="#fb923c" stopOpacity={0.3}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
                               <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }}/>
                               <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }} label={{ value: 'Puntos Riesgo', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}/>
                               <YAxis yAxisId="right" orientation="right" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }} label={{ value: 'Tasas', angle: 90, position: 'insideRight', style: { fill: '#6b7280', fontSize: 11 } }}/>
                               <Tooltip 
                                   contentStyle={{
                                       backgroundColor: '#ffffff',
                                       borderRadius: '12px', 
                                       border: '1px solid #e5e7eb',
                                       boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                                       padding: '12px'
                                   }}
                                   labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }}
                               />
                               <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                               <Bar yAxisId="left" dataKey="Risk" name="Puntos Riesgo" fill="url(#colorRisk)" radius={[6,6,0,0]} barSize={24} />
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="TRIR" name="TRIR" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />}
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="LTIF" name="LTIF" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />}
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
                           Sin datos para visualizar tendencias.
                       </div>
                   )}
               </div>
          </div>

          <div id="chart-pareto" className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-w-0 flex flex-col">
               <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold text-gray-800 flex items-center">
                       <BarChart2 className="w-5 h-5 mr-2 text-blue-500" /> Análisis Pareto 80/20
                   </h3>
                   <div className="flex space-x-2 text-xs">
                       <button onClick={() => setParetoView('type')} className={`px-3 py-1.5 rounded-lg font-medium transition-all ${paretoView==='type'?'bg-blue-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Por Tipo</button>
                       <button onClick={() => setParetoView('location')} className={`px-3 py-1.5 rounded-lg font-medium transition-all ${paretoView==='location'?'bg-blue-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Por Ubicación</button>
                   </div>
               </div>
               <div className="h-64 w-full min-w-0 relative">
                   {paretoData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={paretoData} onClick={(d: any) => d && d.activePayload && onDrillDown && onDrillDown({ type: d.activePayload[0].payload.name })}>
                               <defs>
                                   <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#64748b" stopOpacity={0.9}/>
                                       <stop offset="95%" stopColor="#64748b" stopOpacity={0.5}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
                               <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }} interval={0} angle={-15} textAnchor="end" height={40}/>
                               <YAxis yAxisId="left" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }} label={{ value: 'Cantidad', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}/>
                               <YAxis yAxisId="right" orientation="right" unit="%" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }} domain={[0, 100]} label={{ value: '% Acumulado', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }}/>
                               <Tooltip 
                                   cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} 
                                   contentStyle={{
                                       backgroundColor: '#ffffff',
                                       borderRadius: '12px',
                                       border: '1px solid #e5e7eb',
                                       boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                       padding: '12px'
                                   }}
                               />
                               <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                               <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="url(#colorCount)" barSize={32} radius={[6,6,0,0]} />
                               <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="% Acumulado" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
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

      {/* NEW ADVANCED CHARTS SECTION */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-indigo-900 uppercase flex items-center mb-6">
              <Layers className="w-6 h-6 mr-2" /> Análisis Avanzado - Gráficos Ejecutivos
          </h2>

          {/* Row 1: Year Comparison + Waterfall side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* Comparación Año vs Año */}
              <div id="chart-severity-dist" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                      <BarChart2 className="w-5 h-5 mr-2 text-blue-600" /> Comparación por Tipo de Incidente
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">2025 vs 2026 - Análisis de tendencia por categoría</p>
                  <div className="h-72">
                      {(() => {
                          const comparisonData = generateYearComparisonByType(comparisonIncidents, 2025, 2026);
                          return comparisonData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart 
                                      data={comparisonData} 
                                      layout="vertical" 
                                      margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                                      barGap={2}
                                      barCategoryGap="20%"
                                  >
                                      <defs>
                                          <linearGradient id="color2025" x1="0" y1="0" x2="1" y2="0">
                                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.7}/>
                                          </linearGradient>
                                          <linearGradient id="color2026" x1="0" y1="0" x2="1" y2="0">
                                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                                              <stop offset="95%" stopColor="#34d399" stopOpacity={0.7}/>
                                          </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false}/>
                                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }}/>
                                      <YAxis 
                                          type="category" 
                                          dataKey="shortType" 
                                          fontSize={9} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#374151', fontWeight: 500 }} 
                                          width={110}
                                      />
                                      <Tooltip
                                          cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                                          content={({ active, payload }: any) => {
                                              if (active && payload && payload.length) {
                                                  const data = payload[0].payload;
                                                  const change = Number(data.percentChange);
                                                  const changeColor = change < 0 ? 'text-green-600' : change > 0 ? 'text-red-600' : 'text-gray-500';
                                                  const arrow = change < 0 ? '↓' : change > 0 ? '↑' : '→';
                                                  return (
                                                      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-xs">
                                                          <p className="font-bold text-gray-800 mb-2">{data.type}</p>
                                                          <div className="flex items-center gap-4">
                                                              <div className="flex items-center">
                                                                  <span className="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
                                                                  <span className="text-gray-600">2025: <span className="font-semibold text-gray-900">{data['2025']}</span></span>
                                                              </div>
                                                              <div className="flex items-center">
                                                                  <span className="w-3 h-3 rounded-full bg-emerald-500 mr-1"></span>
                                                                  <span className="text-gray-600">2026: <span className="font-semibold text-gray-900">{data['2026']}</span></span>
                                                              </div>
                                                          </div>
                                                          <p className={`mt-2 font-medium ${changeColor}`}>
                                                              {arrow} {Math.abs(change)}% vs año anterior
                                                          </p>
                                                      </div>
                                                  );
                                              }
                                              return null;
                                          }}
                                      />
                                      <Legend 
                                          verticalAlign="top" 
                                          height={36}
                                          iconType="square"
                                          iconSize={10}
                                          wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }}
                                      />
                                      <Bar dataKey="2025" name="2025" fill="url(#color2025)" radius={[0, 4, 4, 0]} barSize={12} />
                                      <Bar dataKey="2026" name="2026" fill="url(#color2026)" radius={[0, 4, 4, 0]} barSize={12} />
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para comparar</div>;
                      })()}
                  </div>
                  {/* Mini resumen */}
                  <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                      {(() => {
                          const data2025 = siteFilteredIncidents.filter(i => i.year === 2025).length;
                          const data2026 = siteFilteredIncidents.filter(i => i.year === 2026).length;
                          const diff = data2026 - data2025;
                          const pct = data2025 > 0 ? ((diff / data2025) * 100).toFixed(1) : 'N/A';
                          return (
                              <>
                                  <div className="bg-blue-50 rounded-lg p-2">
                                      <p className="text-xs text-blue-600 font-medium">2025</p>
                                      <p className="text-lg font-bold text-blue-700">{data2025}</p>
                                  </div>
                                  <div className="bg-emerald-50 rounded-lg p-2">
                                      <p className="text-xs text-emerald-600 font-medium">2026</p>
                                      <p className="text-lg font-bold text-emerald-700">{data2026}</p>
                                  </div>
                                  <div className={`${diff <= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-2`}>
                                      <p className="text-xs text-gray-600 font-medium">Variación</p>
                                      <p className={`text-lg font-bold ${diff <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                          {diff <= 0 ? '↓' : '↑'} {typeof pct === 'string' ? pct : Math.abs(Number(pct))}%
                                      </p>
                                  </div>
                              </>
                          );
                      })()}
                  </div>
              </div>

              {/* Waterfall Chart - Movido aquí */}
              <div id="chart-waterfall" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                      <BarChart2 className="w-5 h-5 mr-2 text-cyan-600" /> Contribución por Sitio al TRIR
                  </h3>
                  <div className="h-80">
                      {(() => {
                          const waterfallData = generateWaterfallData(siteFilteredIncidents, siteFilteredExposureHours, settings);
                          return waterfallData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={waterfallData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                      <defs>
                                          <linearGradient id="colorWaterfall" x1="0" y1="0" x2="1" y2="0">
                                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.9}/>
                                              <stop offset="95%" stopColor="#67e8f9" stopOpacity={0.7}/>
                                          </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false}/>
                                      <XAxis type="number" fontSize={11} tickLine={false} axisLine={{ stroke: '#d1d5db' }} tick={{ fill: '#6b7280' }}/>
                                      <YAxis 
                                          type="category" 
                                          dataKey="site" 
                                          fontSize={10} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#374151', fontWeight: 500 }} 
                                          width={100}
                                          tickFormatter={(value) => value.length > 14 ? value.substring(0, 14) + '...' : value}
                                      />
                                      <Tooltip
                                          formatter={(value: any) => [value.toFixed(2), 'TRIR']}
                                          contentStyle={{
                                              backgroundColor: '#ffffff',
                                              borderRadius: '12px',
                                              border: '1px solid #e5e7eb',
                                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                              padding: '12px'
                                          }}
                                      />
                                      <Bar dataKey="value" fill="url(#colorWaterfall)" radius={[0, 8, 8, 0]} barSize={20} />
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos</div>;
                      })()}
                  </div>
              </div>
          </div>

          {/* Row 2: Scatter Plot + Radar side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* 9. Scatter Plot */}
              <div id="chart-scatter" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                      <Target className="w-5 h-5 mr-2 text-orange-600" /> Frecuencia vs Severidad (por Sitio)
                  </h3>
                  <div className="h-72">
                      {(() => {
                          const scatterData = generateScatterPlotData(siteFilteredIncidents, siteFilteredExposureHours);
                          return scatterData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 30 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                                      <XAxis 
                                          type="number" 
                                          dataKey="frequency" 
                                          name="Frecuencia" 
                                          fontSize={11} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                          label={{ value: 'Cantidad de Incidentes', position: 'insideBottom', offset: -20, style: { fill: '#6b7280', fontSize: 11 } }} 
                                      />
                                      <YAxis 
                                          type="number" 
                                          dataKey="severity" 
                                          name="Severidad" 
                                          fontSize={11} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                          label={{ value: 'Días Promedio', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }} 
                                      />
                                      <ZAxis type="number" dataKey="hours" range={[100, 600]} />
                                      <Tooltip 
                                          cursor={{ strokeDasharray: '3 3', stroke: '#94a3b8' }} 
                                          content={({ active, payload }: any) => {
                                          if (active && payload && payload.length) {
                                              const data = payload[0].payload;
                                              return (
                                                  <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-xs">
                                                      <p className="font-bold text-gray-800 mb-2">{data.site}</p>
                                                      <p className="text-gray-600">Incidentes: <span className="font-semibold text-gray-900">{data.frequency}</span></p>
                                                      <p className="text-gray-600">Días Prom: <span className="font-semibold text-gray-900">{data.severity}</span></p>
                                                      <p className="text-gray-600">Horas: <span className="font-semibold text-gray-900">{data.hours.toLocaleString()}</span></p>
                                                  </div>
                                              );
                                          }
                                          return null;
                                      }}/>
                                      <Scatter data={scatterData} fill="#f59e0b" stroke="#fff" strokeWidth={2} />
                                  </ScatterChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos</div>;
                      })()}
                  </div>
              </div>

              {/* Radar Chart - Al lado del Scatter */}
              <div id="chart-radar" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                      <Target className="w-5 h-5 mr-2 text-indigo-600" /> Radar Comparativo (Top 5 Sitios)
                  </h3>
                  <div className="h-72">
                      {(() => {
                          const radarData = generateRadarChartData(siteFilteredIncidents, siteFilteredExposureHours, exposureKm, settings);
                          const sites = Array.from(new Set(radarData.map(d => d.site)));
                          const metrics = ['TRIR', 'LTIF', 'DART', 'HIPO', 'SLG24h'];
                          const radarFormatted = metrics.map(metric => {
                              const obj: any = { metric };
                              radarData.forEach(site => {
                                  obj[site.site] = site[metric as keyof typeof site];
                              });
                              return obj;
                          });
                          
                          const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

                          return radarFormatted.length > 0 && sites.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart data={radarFormatted} cx="50%" cy="50%" outerRadius="70%">
                                      <PolarGrid stroke="#d1d5db" strokeDasharray="3 3" />
                                      <PolarAngleAxis 
                                          dataKey="metric" 
                                          fontSize={12} 
                                          tick={{ fill: '#1f2937', fontWeight: 600 }}
                                          tickLine={false}
                                      />
                                      <PolarRadiusAxis 
                                          fontSize={9} 
                                          stroke="#e5e7eb" 
                                          tick={{ fill: '#9ca3af' }}
                                          axisLine={false}
                                          tickCount={4}
                                      />
                                      <Tooltip 
                                          contentStyle={{
                                              backgroundColor: '#ffffff',
                                              borderRadius: '12px',
                                              border: '1px solid #e5e7eb',
                                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                              padding: '12px',
                                              fontSize: '11px'
                                          }}
                                          formatter={(value: any) => [typeof value === 'number' ? value.toFixed(2) : value]}
                                      />
                                      <Legend 
                                          layout="horizontal"
                                          verticalAlign="bottom" 
                                          align="center"
                                          iconType="circle"
                                          iconSize={8}
                                          wrapperStyle={{ paddingTop: '10px', fontSize: '10px' }}
                                      />
                                      {sites.map((site, idx) => (
                                          <Radar 
                                              key={site} 
                                              name={site} 
                                              dataKey={site} 
                                              stroke={COLORS[idx % COLORS.length]} 
                                              fill={COLORS[idx % COLORS.length]} 
                                              fillOpacity={0.2}
                                              strokeWidth={2}
                                          />
                                      ))}
                                  </RadarChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos suficientes</div>;
                      })()}
                  </div>
                  {/* Descripción de métricas del Radar */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-200 mt-3">
                      <p className="text-xs text-gray-600 leading-relaxed">
                          <span className="font-semibold text-blue-600">TRIR:</span> Tasa de incidentes registrables (OSHA). &nbsp;
                          <span className="font-semibold text-orange-600">LTIF:</span> Frecuencia de lesiones con tiempo perdido. &nbsp;
                          <span className="font-semibold text-indigo-600">DART:</span> Días ausencia/restricción/transferencia. &nbsp;
                          <span className="font-semibold text-amber-600">HIPO:</span> Incidentes de alta potencialidad. &nbsp;
                          <span className="font-semibold text-green-600">SLG24h:</span> % de incidentes denunciados a la SRT dentro de 24hs.
                      </p>
                  </div>
              </div>
          </div>

          {/* Row 3: Comparación Mensual 2025 vs 2026 */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              {/* Gráfico de líneas: Eventos por mes */}
              <div id="chart-monthly-comparison" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-purple-600" /> Comparación Mensual de Eventos
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Cantidad de incidentes por mes - 2025 vs 2026</p>
                  <div className="h-72">
                      {(() => {
                          const monthlyData = generateMonthlyComparison(comparisonIncidents, 2025, 2026);
                          const hasData = monthlyData.some(m => m['2025'] > 0 || m['2026'] > 0);
                          return hasData ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={monthlyData} margin={{ left: 0, right: 20, top: 10, bottom: 5 }}>
                                      <defs>
                                          <linearGradient id="colorArea2025" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                                          </linearGradient>
                                          <linearGradient id="colorArea2026" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                                          </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
                                      <XAxis 
                                          dataKey="month" 
                                          fontSize={11} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                      />
                                      <YAxis 
                                          fontSize={11} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                          allowDecimals={false}
                                      />
                                      <Tooltip
                                          contentStyle={{
                                              backgroundColor: '#ffffff',
                                              borderRadius: '12px',
                                              border: '1px solid #e5e7eb',
                                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                              padding: '12px'
                                          }}
                                          content={({ active, payload, label }: any) => {
                                              if (active && payload && payload.length) {
                                                  const diff = payload[1]?.value - payload[0]?.value;
                                                  const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
                                                  const color = diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-gray-500';
                                                  return (
                                                      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-200 text-xs">
                                                          <p className="font-bold text-gray-800 mb-2">{label}</p>
                                                          <div className="flex items-center gap-3 mb-1">
                                                              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                                                              <span>2025: <strong>{payload[0]?.value || 0}</strong></span>
                                                          </div>
                                                          <div className="flex items-center gap-3 mb-1">
                                                              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                                              <span>2026: <strong>{payload[1]?.value || 0}</strong></span>
                                                          </div>
                                                          <p className={`mt-2 font-medium ${color}`}>
                                                              {arrow} Diferencia: {diff > 0 ? '+' : ''}{diff}
                                                          </p>
                                                      </div>
                                                  );
                                              }
                                              return null;
                                          }}
                                      />
                                      <Legend 
                                          verticalAlign="top" 
                                          height={30}
                                          iconType="square"
                                          wrapperStyle={{ fontSize: '11px' }}
                                      />
                                      <Area 
                                          type="monotone" 
                                          dataKey="2025" 
                                          name="2025" 
                                          stroke="#3b82f6" 
                                          strokeWidth={2}
                                          fill="url(#colorArea2025)" 
                                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                          activeDot={{ r: 6 }}
                                      />
                                      <Area 
                                          type="monotone" 
                                          dataKey="2026" 
                                          name="2026" 
                                          stroke="#10b981" 
                                          strokeWidth={2}
                                          fill="url(#colorArea2026)" 
                                          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                                          activeDot={{ r: 6 }}
                                      />
                                  </AreaChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para comparar</div>;
                      })()}
                  </div>
              </div>

              {/* Gráfico de barras agrupadas: Comparación 2025 vs 2026 TOTALES por mes */}
              <div id="chart-types-monthly" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                      <BarChart2 className="w-5 h-5 mr-2 text-amber-600" /> Total Incidentes por Mes (2025 vs 2026)
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Comparación de totales mensuales entre años</p>
                  <div className="h-72">
                      {(() => {
                          const monthlyData = generateMonthlyComparison(comparisonIncidents, 2025, 2026);
                          const hasData = monthlyData.some((m: any) => m['2025'] > 0 || m['2026'] > 0);
                          return hasData ? (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={monthlyData} margin={{ left: 0, right: 10, top: 10, bottom: 5 }}>
                                      <defs>
                                          <linearGradient id="colorBar2025" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                                              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.6}/>
                                          </linearGradient>
                                          <linearGradient id="colorBar2026" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                                              <stop offset="95%" stopColor="#34d399" stopOpacity={0.6}/>
                                          </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false}/>
                                      <XAxis 
                                          dataKey="month" 
                                          fontSize={10} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                      />
                                      <YAxis 
                                          fontSize={10} 
                                          tickLine={false} 
                                          axisLine={{ stroke: '#d1d5db' }} 
                                          tick={{ fill: '#6b7280' }}
                                          allowDecimals={false}
                                      />
                                      <Tooltip
                                          contentStyle={{
                                              backgroundColor: '#ffffff',
                                              borderRadius: '12px',
                                              border: '1px solid #e5e7eb',
                                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                              padding: '12px',
                                              fontSize: '11px'
                                          }}
                                          formatter={(value: any, name: string) => [value, `Año ${name}`]}
                                      />
                                      <Legend 
                                          verticalAlign="top" 
                                          height={30}
                                          iconType="square"
                                          iconSize={10}
                                          wrapperStyle={{ fontSize: '10px' }}
                                          formatter={(value: string) => `Año ${value}`}
                                      />
                                      <Bar 
                                          dataKey="2025"
                                          name="2025"
                                          fill="url(#colorBar2025)"
                                          radius={[4, 4, 0, 0]}
                                          barSize={16}
                                      />
                                      <Bar 
                                          dataKey="2026"
                                          name="2026"
                                          fill="url(#colorBar2026)"
                                          radius={[4, 4, 0, 0]}
                                          barSize={16}
                                      />
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para comparar</div>;
                      })()}
                  </div>
              </div>
          </div>
      </div>
      
      {/* 7. HEATMAP & TRANSIT */}
      <div className="min-w-0">
          <div className="min-h-[500px] w-full">
              <HeatmapMatrix incidents={siteFilteredIncidents} exposureHours={siteFilteredExposureHours} />
          </div>
      </div>

      {/* 7.5 RESUMEN HORAS HOMBRE POR SITIO Y MES */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
              <Clock className="w-5 h-5 mr-2 text-blue-500" /> Resumen Horas Hombre por Sitio y Mes
          </h3>
          <div className="overflow-x-auto">
              {(() => {
                  // Obtener todos los sitios conocidos de incidentes
                  const allKnownSites = Array.from(new Set(comparisonIncidents.map(i => i.site)));
                  // Usar función centralizada con TODOS los datos y sitios
                  const summary = getExposureHoursSummary(comparisonExposureHours, allKnownSites);
                  let { sites, periods, dataMap, siteTotals, periodTotals, grandTotal } = summary;
                  
                  // Aplicar filtro de sitio (si hay)
                  if (filters?.site && filters.site !== 'All') {
                      sites = sites.filter(s => s === filters.site);
                  }
                  
                  // Aplicar filtro de año (si hay) - filtrar períodos que empiecen con ese año
                  if (filters?.year && filters.year !== 'All') {
                      periods = periods.filter(p => p.startsWith(`${filters.year}-`));
                  }
                  
                  // Aplicar filtro de mes (si hay) - filtrar períodos que terminen en ese mes
                  if (filters?.month && filters.month !== 'All') {
                      const monthStr = String(filters.month).padStart(2, '0');
                      periods = periods.filter(p => p.endsWith(`-${monthStr}`));
                  }
                  
                  // Recalcular totales con los filtros aplicados
                  const filteredSiteTotals: Record<string, number> = {};
                  sites.forEach(site => {
                      filteredSiteTotals[site] = periods.reduce((acc, p) => acc + (dataMap[site]?.[p]?.value || 0), 0);
                  });
                  
                  const filteredPeriodTotals: Record<string, number> = {};
                  periods.forEach(period => {
                      filteredPeriodTotals[period] = sites.reduce((acc, s) => acc + (dataMap[s]?.[period]?.value || 0), 0);
                  });
                  
                  const filteredGrandTotal = Object.values(filteredSiteTotals).reduce((a, b) => a + b, 0);
                  
                  if (sites.length === 0 || periods.length === 0) {
                      return <p className="text-gray-400 text-sm text-center py-4">No hay horas hombre cargadas</p>;
                  }
                  
                  return (
                      <table className="w-full text-xs">
                          <thead>
                              <tr className="bg-gray-50">
                                  <th className="text-left p-2 font-bold text-gray-700 sticky left-0 bg-gray-50">Sitio</th>
                                  {periods.map(p => (
                                      <th key={p} className="text-right p-2 font-bold text-gray-600">{p}</th>
                                  ))}
                                  <th className="text-right p-2 font-bold text-blue-700 bg-blue-50">TOTAL</th>
                              </tr>
                          </thead>
                          <tbody>
                              {sites.map((site, idx) => (
                                  <tr key={site} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      <td className={`p-2 font-medium text-gray-800 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{site}</td>
                                      {periods.map(p => {
                                          const cell = dataMap[site]?.[p];
                                          return (
                                              <td key={p} className={`text-right p-2 font-mono ${cell?.isFilled ? 'text-blue-500 italic' : 'text-gray-600'}`}>
                                                  {cell?.value && cell.value > 0 ? cell.value.toLocaleString() : <span className="text-gray-300">-</span>}
                                              </td>
                                          );
                                      })}
                                      <td className="text-right p-2 font-bold text-blue-700 bg-blue-50 font-mono">
                                          {filteredSiteTotals[site]?.toLocaleString() || 0}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                          <tfoot>
                              <tr className="bg-gray-100 border-t-2 border-gray-300">
                                  <td className="p-2 font-bold text-gray-800 sticky left-0 bg-gray-100">TOTAL</td>
                                  {periods.map(p => (
                                      <td key={p} className="text-right p-2 font-bold text-gray-700 font-mono">
                                          {filteredPeriodTotals[p]?.toLocaleString() || 0}
                                      </td>
                                  ))}
                                  <td className="text-right p-2 font-bold text-green-700 bg-green-100 font-mono">
                                      {filteredGrandTotal.toLocaleString()}
                                  </td>
                              </tr>
                          </tfoot>
                      </table>
                  );
              })()}
          </div>
          <p className="text-xs text-gray-400 mt-3 flex items-center">
              <Info className="w-3 h-3 mr-1" /> 
              Valores en <span className="text-blue-500 italic mx-1">azul cursiva</span> = completados automáticamente. Este total se usa para calcular TRIR, LTIF, DART.
          </p>
      </div>

      {/* 8. MANAGEMENT INDICATORS */}
      
      {/* TOP 5 SITES RANKING */}
      {metrics.top5Sites && metrics.top5Sites.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
                  <Trophy className="w-5 h-5 mr-2 text-amber-500" /> Top 5 Sitios con Mayor Incidentalidad
              </h3>
              <div className="space-y-3">
                  {metrics.top5Sites.map((site, idx) => {
                      const maxCount = metrics.top5Sites[0].count;
                      const percentage = (site.count / maxCount) * 100;
                      const colorClass = idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-yellow-500' : 'bg-blue-500';
                      
                      return (
                          <div key={idx} className="flex items-center space-x-3">
                              <div className="flex-shrink-0 w-8 text-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${colorClass}`}>
                                      {site.rank}
                                  </span>
                              </div>
                              <div className="flex-grow">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-bold text-gray-800">{site.site}</span>
                                      <span className="text-sm font-mono text-gray-600">{site.count} incidentes</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-hidden">
                                      {/* Dynamic width requires inline style — unavoidable with Tailwind */}
                                      <div 
                                          className={`h-2 rounded-full absolute top-0 left-0 transition-all ${colorClass}`} 
                                          style={{ width: `${percentage}%` }}
                                      ></div>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* RISK CONSOLIDATED PANEL */}
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
              <Activity className="w-5 h-5 mr-2 text-purple-600" /> Panel Consolidado de Riesgo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Índice Riesgo Total</p>
                  <p className="text-3xl font-bold text-purple-700">{metrics.risk_index_total ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Puntos acumulados</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Índice Riesgo Rate</p>
                  <p className="text-3xl font-bold text-indigo-700">{metrics.risk_index_rate ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Normalizado</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Clasificación Promedio</p>
                  <p className={`text-2xl font-bold ${
                      metrics.probabilityIndexLabel === 'Alto' ? 'text-red-600' :
                      metrics.probabilityIndexLabel === 'Medio' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                      {metrics.probabilityIndexLabel}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Potencialidad</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-cyan-500">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">Incidentes HIPO</p>
                  <p className="text-3xl font-bold text-cyan-700">{metrics.hipoCount}</p>
                  <p className="text-xs text-gray-500 mt-1">{((metrics.hipoRate ?? 0) * 100).toFixed(0)}% del total</p>
              </div>
          </div>
      </div>

      {/* SUGGESTED ACTIONS */}
      {metrics.suggestedActions && metrics.suggestedActions.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-blue-800 uppercase flex items-center mb-4">
                  <ShieldCheck className="w-5 h-5 mr-2" /> Acciones Correctivas Sugeridas (IA)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {metrics.suggestedActions.map((suggestion, idx) => {
                      const reasonConfig = {
                          deterioration: { icon: TrendingDown, label: 'Deterioro Detectado', color: 'text-red-600' },
                          trend_alert: { icon: AlertTriangle, label: 'Tendencia Creciente', color: 'text-orange-600' }
                      }[suggestion.reason];
                      const Icon = reasonConfig.icon;

                      return (
                          <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                              <div className="flex items-start justify-between mb-3">
                                  <h4 className="font-bold text-gray-800 text-sm">{suggestion.site}</h4>
                                  <span className={`flex items-center text-xs font-bold ${reasonConfig.color}`}>
                                      <Icon className="w-3 h-3 mr-1" />
                                      {reasonConfig.label}
                                  </span>
                              </div>
                              <ul className="space-y-2">
                                  {suggestion.actions.slice(0, 3).map((action, actionIdx) => (
                                      <li key={actionIdx} className="flex items-start text-xs text-gray-700">
                                          <CheckCircle2 className="w-3 h-3 mr-2 mt-0.5 text-blue-500 flex-shrink-0" />
                                          <span>{action}</span>
                                      </li>
                                  ))}
                              </ul>
                              {suggestion.actions.length > 3 && (
                                  <p className="text-xs text-blue-600 font-bold mt-2">
                                      + {suggestion.actions.length - 3} acciones más
                                  </p>
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {metrics.trendAlerts && metrics.trendAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-red-800 uppercase flex items-center mb-4">
                  <Siren className="w-5 h-5 mr-2" /> Alertas de Tendencia Creciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.trendAlerts.map((alert, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
                          <h4 className="font-bold text-gray-800 mb-2">{alert.site}</h4>
                          <p className="text-xs text-gray-600 mb-2">Tendencia: 
                              <span className="ml-1 text-red-600 font-bold">↑ Creciente</span>
                          </p>
                          <div className="flex space-x-2 text-xs">
                              {alert.history.map((h, i) => (
                                  <div key={i} className="bg-gray-100 px-2 py-1 rounded">
                                      <span className="font-mono">{h.count}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* SITE EVOLUTION CARDS */}
      {metrics.siteEvolutions && metrics.siteEvolutions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
                  <BarChart2 className="w-5 h-5 mr-2 text-blue-600" /> Evolución por Sitio (Últimos 6 Meses)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics.siteEvolutions.slice(0, 6).map((evolution, idx) => {
                      const statusConfig = {
                          improving: { color: 'border-green-500', bg: 'bg-green-50', icon: '↓', textColor: 'text-green-700' },
                          stable: { color: 'border-gray-400', bg: 'bg-gray-50', icon: '→', textColor: 'text-gray-600' },
                          deteriorating: { color: 'border-red-500', bg: 'bg-red-50', icon: '↑', textColor: 'text-red-700' }
                      }[evolution.status];

                      return (
                          <div key={idx} className={`${statusConfig.bg} p-4 rounded-lg shadow-sm border-l-4 ${statusConfig.color}`}>
                              <h4 className="font-bold text-gray-800 mb-2">{evolution.site}</h4>
                              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                  <div>
                                      <p className="text-gray-500">Últimos 3m:</p>
                                      <p className="font-bold text-gray-800">{evolution.currentAvg}</p>
                                  </div>
                                  <div>
                                      <p className="text-gray-500">Previos 3m:</p>
                                      <p className="font-bold text-gray-800">{evolution.prevAvg}</p>
                                  </div>
                              </div>
                              <div className={`flex items-center justify-between ${statusConfig.textColor} font-bold text-sm`}>
                                  <span>{statusConfig.icon} {Math.abs(evolution.variationPct)}%</span>
                                  <span className="uppercase text-[10px]">{evolution.status === 'improving' ? 'Mejorando' : evolution.status === 'stable' ? 'Estable' : 'Deterioro'}</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* DAYS SINCE INCIDENT */}
      {metrics.daysSinceList && metrics.daysSinceList.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
                  <CalendarCheck className="w-5 h-5 mr-2 text-green-600" /> Días Sin Incidentes por Sitio
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {metrics.daysSinceList.slice(0, 10).map((item, idx) => {
                      const statusConfig = {
                          critical: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700' },
                          warning: { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700' },
                          safe: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700' }
                      }[item.status];

                      return (
                          <div key={idx} className={`${statusConfig.bg} p-3 rounded-lg border ${statusConfig.border} text-center`}>
                              <p className="text-xs font-bold text-gray-600 mb-1">{item.site}</p>
                              <p className={`text-2xl font-bold ${statusConfig.text}`}>{item.days}</p>
                              <p className="text-[10px] text-gray-500 uppercase">días</p>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}
      
       <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <div className="flex items-center mb-6">
              <Truck className="w-6 h-6 mr-3 text-purple-600" />
              <div>
                  <h3 className="text-lg font-bold text-slate-800">Módulo de Gestión Vial</h3>
                  <p className="text-xs text-slate-500">Separación estricta: Tránsito Laboral (IFAT) vs In Itinere (Commuting).</p>
              </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            onClick={() => onOpenKmModal ? onOpenKmModal() : (onNavigateToExposure && onNavigateToExposure())} 
                            className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2 py-1 rounded font-bold"
                          >
                            Cargar KM
                          </button>
                      </div>
                  )}
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-400">
                  <h4 className="text-xs font-bold text-indigo-500 uppercase mb-2">In Itinere (Commuting)</h4>
                  <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-slate-900">{metrics.cnt_in_itinere}</span>
                      <span className="ml-2 text-xs text-slate-500">Eventos</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">No afecta IFAT ni TRIR</div>
              </div>

               <div className="flex items-center justify-center p-4 text-center text-xs text-slate-400 italic">
                  <Info className="w-4 h-4 mr-2" />
                  "Los accidentes In Itinere se registran como indicador independiente y no penalizan el desempeño de planta (Safety)."
              </div>
          </div>
      </div>
    </div>
  );
};
