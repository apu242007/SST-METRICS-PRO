import React, { useMemo } from 'react';
import { 
  Area, AreaChart, ResponsiveContainer, 
  Bar, ComposedChart, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Incident, ExposureHour, GlobalKmRecord, AppSettings } from '../types';
import { calculateKPIs, generateParetoData } from '../utils/calculations';
import { TARGET_SCENARIOS } from '../constants';
import { 
  Activity, TrendingDown, Truck, Shield, 
  Zap, Siren, ArrowUpRight, AlertCircle
} from 'lucide-react';
import { HeatmapMatrix } from './HeatmapMatrix';

const MegaCard = ({ title, value, unit, icon: Icon, color, status, target, subtext }: any) => {
  const isDanger = status === 'danger';
  const isGood = status === 'good';
  
  return (
    <div className="mega-card-saas group relative overflow-hidden">
        {/* Background Decor */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full opacity-20 transition-all duration-700 group-hover:scale-150 bg-${color}-500`}></div>
        
        <div className="flex justify-between items-start mb-12 relative z-10">
            <div className={`p-5 rounded-[1.75rem] bg-${color}-50 text-${color}-600 shadow-sm border border-${color}-100/50`}>
                <Icon className="w-8 h-8" />
            </div>
            {target && (
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target 2025</span>
                    <span className="text-sm font-black text-slate-800">{target}</span>
                </div>
            )}
        </div>

        <div className="relative z-10 flex-1">
            <p className="text-xs font-black uppercase tracking-widest mb-2 text-slate-400">{title}</p>
            <div className="flex items-baseline gap-2">
                <h3 className="text-7xl font-black tracking-tighter tabular-nums text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {value ?? '0'}
                </h3>
                {unit && <span className="text-xl font-bold text-slate-300">{unit}</span>}
            </div>
        </div>

        <div className="mt-12 flex items-center justify-between relative z-10 pt-8 border-t border-slate-100">
            <div className="flex items-center gap-2">
                {isDanger ? <AlertCircle className="w-4 h-4 text-rose-500" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                <p className="text-[11px] font-bold text-slate-500 tracking-tight">{subtext}</p>
            </div>
            <div className={`status-badge ${
                isDanger ? 'bg-rose-50 border-rose-100 text-rose-600' : 
                isGood ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                'bg-amber-50 border-amber-100 text-amber-600'
            }`}>
                {status === 'danger' ? 'Crítico' : status === 'good' ? 'Óptimo' : 'En Observación'}
            </div>
        </div>
    </div>
  );
};

export const Dashboard: React.FC<{incidents: Incident[], exposureHours: ExposureHour[], globalKmRecords: GlobalKmRecord[], settings: AppSettings}> = ({ 
    incidents, exposureHours, globalKmRecords, settings 
}) => {
  const targets = TARGET_SCENARIOS['Realista 2025'];
  const metrics = useMemo(() => calculateKPIs(incidents, exposureHours, [], settings, targets, globalKmRecords), [incidents, exposureHours, settings, globalKmRecords]);
  const paretoData = useMemo(() => generateParetoData(incidents, 'type'), [incidents]);

  const determineStatus = (val: number | null, target: number) => {
    if (!val || val === 0) return 'good';
    return val <= target ? 'good' : (val <= target * 1.5 ? 'warning' : 'danger');
  };

  return (
    <div className="space-y-12 pb-20">
      
      {/* 1. MEGA CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <MegaCard 
            title="TRIR (Tasa)" 
            value={metrics.trir} 
            unit="pts"
            color="indigo"
            target={targets.trir}
            status={determineStatus(metrics.trir, targets.trir)}
            icon={Activity}
            subtext={`Forecast: ${metrics.forecast_trir ?? '0.00'}`}
          />
          <MegaCard 
            title="LTIF (Incapacitantes)" 
            value={metrics.ltif} 
            unit="pts"
            color="rose"
            target={targets.ltif}
            status={determineStatus(metrics.ltif, targets.ltif)}
            icon={TrendingDown}
            subtext={`${metrics.totalLTI} eventos con baja registrados.`}
          />
          <div className="flex flex-col gap-6">
              <div className="mega-card-saas p-8 flex items-center gap-6 group hover:-translate-y-2">
                  <div className="p-5 bg-slate-900 text-white rounded-3xl group-hover:scale-110 transition-transform"><Truck className="w-7 h-7" /></div>
                  <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IFAT (Vial)</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900">{metrics.ifatRate ?? '0.00'}</span>
                        <span className="text-xs font-bold text-slate-400">Rate</span>
                      </div>
                  </div>
              </div>
              <div className="mega-card-saas p-8 flex items-center gap-6 group hover:-translate-y-2 bg-emerald-600 text-white border-transparent">
                  <div className="p-5 bg-white/20 rounded-3xl group-hover:rotate-12 transition-transform"><Shield className="w-7 h-7" /></div>
                  <div>
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Compliance</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black">{metrics.slg24h}%</span>
                        <span className="text-xs font-bold text-white/40">SLG-24h</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* 2. ANALYTICS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-8 mega-card-saas p-12 h-[600px] flex flex-col">
              <div className="flex justify-between items-start mb-10">
                  <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Concentración del <span className="text-indigo-600">Riesgo</span></h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Análisis de Pareto 80/20</p>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl"><Zap className="w-6 h-6 text-indigo-600" /></div>
              </div>
              
              <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={paretoData}>
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} stroke="#94A3B8" fontWeight="bold" />
                          <YAxis yAxisId="left" fontSize={10} tickLine={false} axisLine={false} stroke="#94A3B8" />
                          <Tooltip contentStyle={{borderRadius: '2rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                          <Bar yAxisId="left" dataKey="count" radius={[12, 12, 0, 0]} barSize={60}>
                              {paretoData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#4F46E5' : '#E2E8F0'} />
                              ))}
                          </Bar>
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="lg:col-span-4 mega-card-saas bg-slate-900 p-12 flex flex-col justify-between text-white border-transparent">
               <div className="relative z-10">
                   <div className="flex items-center gap-4 mb-10">
                       <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20"><Siren className="w-7 h-7 text-indigo-400" /></div>
                       <h3 className="text-3xl font-black tracking-tighter">Process Safety</h3>
                   </div>
                   
                   <div className="space-y-12">
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Tier 1 Events</span>
                                <span className="text-6xl font-black">{metrics.t1_count}</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-1000" style={{width: `${Math.min(100, (metrics.t1_pser || 0) * 100)}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Tier 2 Events</span>
                                <span className="text-6xl font-black">{metrics.t2_count}</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 transition-all duration-1000" style={{width: `${Math.min(100, (metrics.t2_pser || 0) * 50)}%`}}></div>
                            </div>
                        </div>
                   </div>
               </div>
               
               <p className="text-[10px] text-slate-500 italic leading-relaxed pt-10 border-t border-white/5">"Tier 1 representa la pérdida de contención mayor según API RP 754."</p>
          </div>
      </div>
      
      <HeatmapMatrix incidents={incidents} exposureHours={exposureHours} />
    </div>
  );
};