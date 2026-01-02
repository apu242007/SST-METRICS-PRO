
import React, { useMemo, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, ComposedChart, ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { ExposureHour, ExposureKm, Incident, AppSettings, TargetScenarioType, ParetoData } from '../types';
import { calculateKPIs, generateParetoData } from '../utils/calculations';
import { getMissingExposureKeys, getMissingKmKeys, getMissingExposureImpact, groupMissingKeysBySite } from '../utils/importHelpers';
import { TARGET_SCENARIOS } from '../constants';
import { AlertTriangle, Activity, TrendingDown, Truck, Users, Clock, ShieldAlert, Target, Trophy, Info, Zap, BarChart2, Leaf, Siren, Scale, PersonStanding } from 'lucide-react';
import { HeatmapMatrix } from './HeatmapMatrix';
import { BodyMap } from './BodyMap';

interface DashboardProps {
  incidents: Incident[];
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
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
        className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${borderClass} border-t border-r border-b border-gray-100 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer h-full relative ${blocked ? 'opacity-70' : ''}`}
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
    incidents, exposureHours, exposureKm, settings, 
    onNavigateToExposure, onDrillDown 
}) => {
  const [selectedScenario, setSelectedScenario] = useState<TargetScenarioType>('Metas 2026');
  const [paretoView, setParetoView] = useState<'location' | 'type'>('type');
  
  const targets = TARGET_SCENARIOS[selectedScenario];
  
  // MAIN METRICS Calculation
  const metrics = useMemo(() => calculateKPIs(incidents, exposureHours, exposureKm, settings, targets), [incidents, exposureHours, exposureKm, settings, targets]);
  
  // Sorted Impact Analysis
  const missingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);
  const missingKmKeys = useMemo(() => getMissingKmKeys(incidents, exposureKm), [incidents, exposureKm]);
  
  // If ANY missing keys exist for the current set of incidents, we block the rates to prevent "Zero Denominator" or "Partial Denominator" distortion.
  const isRatesBlocked = missingImpact.length > 0;
  
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
              footer="Base 1.000.000 HH"
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

      {/* 3. KPI CARDS - SECONDARY ROW (Specifics) */}
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

      {/* 4. CHART ROW: RISK & TREND */}
      <div id="dashboard-charts-container" className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-2 rounded-xl">
          
          {/* Risk Index Trend - FIXED CONTAINER */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 min-w-0 flex flex-col">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                   <Zap className="w-4 h-4 mr-2 text-orange-500" /> Evolución Índice de Riesgo
               </h3>
               {/* Fixed Height Wrapper with w-full */}
               <div className="h-64 w-full relative">
                   {/* minWidth={0} and debounce={200} prevents Recharts from calculating negative/zero width during grid layout initialization */}
                   <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={200}>
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
               {/* Fixed Height Wrapper with w-full */}
               <div className="h-64 w-full relative">
                   {/* minWidth={0} and debounce={200} prevents Recharts from calculating negative/zero width during grid layout initialization */}
                   <ResponsiveContainer width="99%" height="100%" minWidth={0} debounce={200}>
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
               </div>
          </div>
      </div>

      {/* 5. BODY MAP & HEATMAP MATRIX ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* BODY MAP (1/3 Width) */}
          <div className="xl:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                 <h3 className="font-bold text-gray-800 flex items-center text-sm">
                     <PersonStanding className="w-5 h-5 mr-2 text-blue-500" /> Mapa de Lesiones
                 </h3>
                 <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">Acumulado</span>
              </div>
              <div className="h-[300px] flex items-center justify-center">
                  <BodyMap incidents={incidents} mode="heatmap" />
              </div>
              <div className="mt-2 flex justify-center space-x-2 text-[9px] text-gray-400">
                  <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-blue-200 mr-1"></span> Baja Frec.</span>
                  <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-yellow-400 mr-1"></span> Media</span>
                  <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Alta Frec.</span>
              </div>
          </div>

          {/* HEATMAP MATRIX (2/3 Width) */}
          <div className="xl:col-span-2 h-[400px]">
              <HeatmapMatrix incidents={incidents} />
          </div>
      </div>

      {/* 6. TRANSIT MODULE */}
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
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
                  <h4 className="text-xs font-bold text-purple-600 uppercase mb-2">IFAT Rate (Laboral)</h4>
                  <div className="flex items-baseline">
                      <span className="text-3xl font-bold text-slate-900">{metrics.ifatRate ?? '—'}</span>
                      <span className="ml-2 text-xs text-slate-500">/ 1M KM</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                      Target 2026: ≤ {TARGET_SCENARIOS['Metas 2026'].ifat_km} • {metrics.cnt_transit_laboral} eventos
                  </div>
                  {missingKmKeys.length > 0 && metrics.cnt_transit_laboral > 0 && (
                      <div className="mt-2 bg-orange-100 text-orange-800 text-[10px] px-2 py-1 rounded">
                          ! Faltan KM en {missingKmKeys.length} períodos
                      </div>
                  )}
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
