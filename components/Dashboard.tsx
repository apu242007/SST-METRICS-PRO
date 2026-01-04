
import React, { useMemo, useState } from 'react';
import { 
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Line, ComposedChart
} from 'recharts';
import { ExposureHour, ExposureKm, Incident, AppSettings, TargetScenarioType, GlobalKmRecord } from '../types';
import { calculateKPIs, generateParetoData } from '../utils/calculations';
import { getMissingExposureImpact, getMissingKmKeys } from '../utils/importHelpers';
import { TARGET_SCENARIOS, KPI_DEFINITIONS } from '../constants';
import { AlertTriangle, Activity, TrendingDown, Truck, Users, Clock, Target, Trophy, Info, Zap, BarChart2, Leaf, Siren, Scale, TrendingUp, CalendarCheck, ShieldCheck, Microscope, ListChecks, Flame, FileCheck, CheckSquare, HeartPulse, Calculator, X } from 'lucide-react';
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
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
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
    incidents, exposureHours, exposureKm, globalKmRecords, settings, 
    onNavigateToExposure, onDrillDown 
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TargetScenarioType>('Metas 2026');
  const [paretoView, setParetoView] = useState<'location' | 'type'>('type');
  const [selectedMetric, setSelectedMetric] = useState<any | null>(null);
  
  const targets = TARGET_SCENARIOS[selectedScenario];
  
  // MAIN METRICS Calculation
  const metrics = useMemo(() => calculateKPIs(incidents, exposureHours, exposureKm, settings, targets, globalKmRecords), [incidents, exposureHours, exposureKm, settings, targets, globalKmRecords]);
  
  // Sorted Impact Analysis (Missing HH)
  const missingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);
  const isRatesBlocked = missingImpact.length > 0;
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
        
        const m = calculateKPIs(sliceIncidents, sliceHours, [], settings);
        
        return {
            name: period,
            Risk: m.risk_index_total,
            TRIR: m.trir,
            LTIR: m.ltif, // Using LTIF here for trend
            TargetTRIR: targets.trir
        };
    });
  }, [incidents, exposureHours, settings, targets]);

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
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1.5">
                    <span className="text-xs font-bold text-gray-500 mx-2 uppercase flex items-center">
                        <Target className="w-4 h-4 mr-1 text-yellow-500" /> Metas:
                    </span>
                    <select 
                        value={selectedScenario} 
                        onChange={(e) => setSelectedScenario(e.target.value as TargetScenarioType)}
                        className="text-sm border-none bg-transparent font-bold text-gray-800 focus:ring-0 cursor-pointer"
                    >
                        <option value="Realista 2025">Realista (2025)</option>
                        <option value="Metas 2026">Metas 2026</option>
                    </select>
                </div>
           </div>
      </div>

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
      <div className="space-y-4">
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
      </div>

      {/* B. PROCESS SAFETY */}
      <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
              <Flame className="w-4 h-4 mr-2" /> Seguridad de Procesos (API RP 754)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <KPICard 
                  title="T1 PSER (Tier 1)" 
                  value={metrics.t1_pser} 
                  target={targets.t1_pser}
                  icon={AlertTriangle}
                  colorClass="bg-red-100 text-red-700"
                  borderClass="border-red-600"
                  subtext={`${metrics.t1_count} eventos mayores`}
                  blocked={isRatesBlocked}
                  onClick={() => handleCardClick('t1_pser', metrics.t1_pser, metrics.t1_count, metrics.totalManHours)}
              />
              <KPICard 
                  title="T2 PSER (Tier 2)" 
                  value={metrics.t2_pser} 
                  target={targets.t2_pser}
                  icon={AlertTriangle}
                  colorClass="bg-orange-100 text-orange-700"
                  borderClass="border-orange-500"
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

      {/* C & D. REGULATORY & MANAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* C. Regulatory */}
          <div className="space-y-4">
               <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
                  <Scale className="w-4 h-4 mr-2" /> Regulatorio (SRT Argentina)
              </h3>
              <div className="grid grid-cols-2 gap-4">
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
                      onClick={() => handleCardClick('slg24h', metrics.slg24h, incidents.filter(i => i.is_verified).length, incidents.length)} // Simplified for mock
                  />
              </div>
          </div>

          {/* D. System Efficacy */}
          <div className="space-y-4">
               <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center border-b border-gray-200 pb-2">
                  <CheckSquare className="w-4 h-4 mr-2" /> Eficacia del Sistema (ISO 45001)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                  <KPICard 
                      title="Legal (LCER)" 
                      value={`${metrics.lcer}%`} 
                      target={`${targets.lcer}%`}
                      icon={Scale}
                      colorClass="bg-purple-100 text-purple-600"
                      borderClass="border-purple-400"
                      subtext="Cumplimiento"
                      reverseLogic={true}
                      blocked={false}
                      onClick={() => handleCardClick('lcer', metrics.lcer, metrics.lcer, 100)}
                  />
                  <KPICard 
                      title="Auditoría (IAP)" 
                      value={`${metrics.iap}%`} 
                      target={`${targets.iap}%`}
                      icon={ListChecks}
                      colorClass="bg-blue-100 text-blue-600"
                      borderClass="border-blue-400"
                      subtext="Ejecución Plan"
                      reverseLogic={true}
                      blocked={false}
                      onClick={() => handleCardClick('iap', metrics.iap, metrics.iap, 100)}
                  />
                  <KPICard 
                      title="Acciones (CAPA)" 
                      value={`${metrics.capa_otc}%`} 
                      target={`${targets.capa_otc}%`}
                      icon={Zap}
                      colorClass="bg-yellow-100 text-yellow-600"
                      borderClass="border-yellow-400"
                      subtext="Cierre en Tiempo"
                      reverseLogic={true}
                      blocked={false}
                      onClick={() => handleCardClick('capa_otc', metrics.capa_otc, metrics.capa_otc, 100)}
                  />
              </div>
          </div>
      </div>

      {/* 6. CHARTS ROW (Risk Trend & Pareto) */}
      <div id="dashboard-charts-container" className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-2 rounded-xl min-w-0">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-w-0 flex flex-col">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                   <TrendingUp className="w-4 h-4 mr-2 text-orange-500" /> Evolución Índice de Riesgo
               </h3>
               <div className="h-64 w-full min-w-0 relative">
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
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="TRIR" name="TRIR" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} />}
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="LTIF" name="LTIF" stroke="#ef4444" strokeWidth={2} dot={{r:3}} />}
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">
                           Sin datos para visualizar tendencias.
                       </div>
                   )}
               </div>
          </div>

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
               <div className="h-64 w-full min-w-0 relative">
                   {paretoData.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                           <ComposedChart data={paretoData} onClick={(d: any) => d && d.activePayload && onDrillDown && onDrillDown({ type: d.activePayload[0].payload.name })}>
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
      
      {/* 7. HEATMAP & TRANSIT */}
      <div className="min-w-0">
          <div className="min-h-[500px] w-full">
              <HeatmapMatrix incidents={incidents} />
          </div>
      </div>
      
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
                          <button onClick={() => onNavigateToExposure && onNavigateToExposure()} className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-2 py-1 rounded font-bold">Cargar KM</button>
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
