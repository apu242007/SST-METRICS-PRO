
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
  generateIncidentsByCliente,
  getExposureHoursSummary, fillMissingExposureHours,
  generateFieldDistribution, generateCombinedFactorDistribution, generateDaysToReportDistribution
} from '../utils/calculations';
import { getMissingExposureImpact, getMissingExposureKeys } from '../utils/importHelpers';
import { TARGET_SCENARIOS, KPI_DEFINITIONS } from '../constants';
import { AlertTriangle, Activity, TrendingDown, Truck, Users, Clock, Target, Trophy, Info, BarChart2, Leaf, Siren, Scale, TrendingUp, CalendarCheck, ShieldCheck, Microscope, Flame, FileCheck, HeartPulse, Calculator, X, CheckCircle2, ChevronDown, ChevronUp, Table as TableIcon, PieChart as PieIcon, Layers, Calendar } from 'lucide-react';
import { HeatmapMatrix } from './HeatmapMatrix';

interface DashboardFilters {
  site: string | string[];
  year: string | string[];
  month: string | string[];
  comCliente?: 'All' | 'SI' | 'NO';
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
  { label: 'FAR (Fatalidad)', m25: '0', m26: '0', var: '= Objetivo fijo "cero"' },
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

// ─── Mini filtro reutilizable para cada gráfico ───────────────────────────────
interface ChartFilterProps {
  years: number[];
  sites: string[];
  value: { year: string; site: string; year2?: string };
  onChange: (v: { year: string; site: string; year2?: string }) => void;
  showYear2?: boolean;
  showSite?: boolean;
}
const ChartFilter: React.FC<ChartFilterProps> = ({ years, sites, value, onChange, showYear2 = false, showSite = true }) => (
  <div className="flex flex-wrap items-center gap-1.5 mt-1">
    <select
      title="Filtrar por año"
      aria-label="Filtrar por año"
      className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
      value={value.year}
      onChange={e => onChange({ ...value, year: e.target.value })}
    >
      <option value="All">Año: Todos</option>
      {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
    </select>
    {showYear2 && (
      <select
        title="Filtrar por segundo año"
        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
        value={value.year2 ?? 'All'}
        onChange={e => onChange({ ...value, year2: e.target.value })}
      >
        <option value="All">Año 2: Todos</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    )}
    {showSite && sites.length > 1 && (
      <select
        title="Filtrar por sitio"
        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
        value={value.site}
        onChange={e => onChange({ ...value, site: e.target.value })}
      >
        <option value="All">Sitio: Todos</option>
        {sites.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )}
    {(value.year !== 'All' || value.site !== 'All' || (value.year2 && value.year2 !== 'All')) && (
      <button
        onClick={() => onChange({ year: 'All', site: 'All', year2: value.year2 !== undefined ? 'All' : undefined })}
        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"
      >✕</button>
    )}
  </div>
);

// ─── Filtro de sitio multi-selección para gráficos individuales ───────────────
interface ChartMultiSiteFilterProps {
  sites: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}
const ChartMultiSiteFilter: React.FC<ChartMultiSiteFilterProps> = ({ sites, selected, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (v: string) =>
    selected.includes(v) ? onChange(selected.filter(s => s !== v)) : onChange([...selected, v]);

  const label = selected.length === 0
    ? 'Sitio: Todos'
    : selected.length === 1
      ? `Sitio: ${selected[0]}`
      : `Sitio: ${selected.length} selec.`;

  const isActive = selected.length > 0;

  if (sites.length <= 1) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`text-[10px] border rounded px-1.5 py-0.5 flex items-center gap-1 min-w-[90px] transition-colors
          ${isActive
            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
            : 'bg-gray-50 border-gray-200 text-gray-600'
          }`}
      >
        <span className="flex-1 text-left truncate max-w-[110px]">{label}</span>
        <svg className={`w-2.5 h-2.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[160px] max-h-56 overflow-y-auto">
          <div className="flex justify-between px-3 py-1 border-b border-gray-100 text-[10px]">
            <button className="text-blue-500 hover:text-blue-700 font-semibold" onClick={() => onChange([])}>
              Todos
            </button>
            <button className="text-gray-400 hover:text-red-500 font-semibold" onClick={() => onChange(sites)}>
              Sel. todos
            </button>
          </div>
          {sites.map(s => (
            <label
              key={s}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] cursor-pointer transition-colors
                ${selected.includes(s) ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <input
                type="checkbox"
                className="accent-blue-600 w-3 h-3"
                checked={selected.includes(s)}
                onChange={() => toggle(s)}
              />
              <span className="truncate">{s}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ 
    incidents, allIncidents, exposureHours, allExposureHours, exposureKm, globalKmRecords, settings,
    filters, onNavigateToExposure, onOpenKmModal, onDrillDown 
}) => {
  // ── Datos base (todos, sin filtro global) ────────────────────────────────
  const allRawInc = allIncidents || incidents;
  const allRawHrs = allExposureHours || exposureHours;

  // ── Helpers para normalizar filtro global ─────────────────────────────────
  const _gSites  = useMemo(() => Array.isArray(filters?.site)  ? (filters!.site  as string[]) : (filters?.site  ? [filters!.site  as string] : []), [filters?.site]);
  const _gYears  = useMemo(() => Array.isArray(filters?.year)  ? (filters!.year  as string[]) : (filters?.year  ? [filters!.year  as string] : []), [filters?.year]);
  const _gMonths = useMemo(() => Array.isArray(filters?.month) ? (filters!.month as string[]).map(Number) : [], [filters?.month]);
  const _gComCli = filters?.comCliente ?? 'All';

  // ── comparisonIncidents: base de TODOS los gráficos — respeta filtro global
  const comparisonIncidents = useMemo(() => allRawInc.filter(i => {
    if (_gSites.length  > 0 && !_gSites.includes(i.site))          return false;
    if (_gYears.length  > 0 && !_gYears.includes(String(i.year))) return false;
    if (_gMonths.length > 0 && !_gMonths.includes(i.month))        return false;
    if (_gComCli !== 'All' && i.com_cliente !== (_gComCli === 'SI')) return false;
    return true;
  }), [allRawInc, _gSites, _gYears, _gMonths, _gComCli]);

  // ── comparisonExposureHours: base de horas — respeta filtro global ─────────
  const comparisonExposureHours = useMemo(() => allRawHrs.filter(h => {
    if (_gSites.length  > 0 && !_gSites.includes(h.site))                                      return false;
    if (_gYears.length  > 0 && !_gYears.some(y => h.period.startsWith(`${y}-`)))               return false;
    if (_gMonths.length > 0 && !_gMonths.some(m => h.period.endsWith(`-${String(m).padStart(2,'0')}`))) return false;
    return true;
  }), [allRawHrs, _gSites, _gYears, _gMonths]);

  // Valores únicos para los selectores de gráficos que respetan el filtro raíz
  const uniqueYears = useMemo(() => Array.from(new Set(comparisonIncidents.map(i => i.year))).sort(), [comparisonIncidents]);
  const uniqueSites = useMemo(() => Array.from(new Set(comparisonIncidents.map(i => i.site))).sort(), [comparisonIncidents]);
  // Valores únicos para los 3 gráficos EXENTOS del filtro raíz (usan allRawInc completo)
  const uniqueYearsAll = useMemo(() => Array.from(new Set(allRawInc.map(i => i.year))).sort(), [allRawInc]);
  const uniqueSitesAll = useMemo(() => Array.from(new Set(allRawInc.map(i => i.site))).sort(), [allRawInc]);

  // Helper: filtra incidentes y horas por { year, site }
  const applyChartFilter = (
    inc: typeof comparisonIncidents,
    hrs: typeof comparisonExposureHours,
    f: { year: string; site: string }
  ) => {
    const fi = inc.filter(i =>
      (f.year === 'All' || i.year === Number(f.year)) &&
      (f.site === 'All' || i.site === f.site)
    );
    const fh = hrs.filter(h =>
      (f.year === 'All' || h.period.startsWith(f.year + '-')) &&
      (f.site === 'All' || h.site === f.site)
    );
    return { fi, fh };
  };

  // Helper: aplica filtro de año + múltiples sitios
  const applyMultiFilter = (
    incs: typeof comparisonIncidents,
    hrs: typeof comparisonExposureHours,
    f: { year: string; sites: string[] }
  ) => {
    const fi = incs.filter(i =>
      (f.year === 'All' || String(i.year) === f.year) &&
      (f.sites.length === 0 || f.sites.includes(i.site))
    );
    const fh = hrs.filter(h =>
      (f.year === 'All' || h.period.startsWith(`${f.year}-`)) &&
      (f.sites.length === 0 || f.sites.includes(h.site))
    );
    return { fi, fh };
  };

  // ── Estados locales de filtro por gráfico ──────────────────────────────────
  const [trendFilter,  setTrendFilter]  = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  const [paretoFilter, setParetoFilter] = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  // site ahora es string[] para multi-selección; [] significa "Todos"
  const [compTypeFilter, setCompTypeFilter] = useState<{ year: string; sites: string[]; year2?: string }>({ year: '2025', sites: [], year2: '2026' });
  const [compTypeComCliente, setCompTypeComCliente] = useState<'All' | 'SI' | 'NO'>('All');
  const [waterfallFilter, setWaterfallFilter] = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  const [scatterFilter,   setScatterFilter]   = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  const [radarFilter,     setRadarFilter]     = useState<{ year: string; site: string; year2?: string }>({ year: 'All', site: 'All' });
  const [monthlyFilter,   setMonthlyFilter]   = useState<{ year: string; sites: string[]; year2?: string }>({ year: '2025', sites: [], year2: '2026' });
  const [monthlyComCliente, setMonthlyComCliente] = useState<'All' | 'SI' | 'NO'>('All');
  // Estado COMPLETAMENTE independiente para "Total Incidentes por Cliente" — nunca comparte estado con monthlyFilter
  const [clienteFilter,   setClienteFilter]   = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  const [heatmapFilter,     setHeatmapFilter]     = useState<{ year: string; sites: string[] }>({ year: 'All', sites: [] });
  const [heatmapComCliente, setHeatmapComCliente] = useState<'All' | 'SI' | 'NO'>('All');
  const [causalFilter, setCausalFilter] = useState<{
    year: string; sites: string[];
    ubicacion: string; tipoSiniestro: string; diagnostico: string; formaOcurrencia: string;
    funcion: string; gravedad: string; diagramaTrabajo: string;
    nivelEntrenamiento: string; naturalezaLesion: string; parteCuerpo: string;
  }>({
    year: 'All', sites: [],
    ubicacion: 'All', tipoSiniestro: 'All', diagnostico: 'All', formaOcurrencia: 'All',
    funcion: 'All', gravedad: 'All', diagramaTrabajo: 'All',
    nivelEntrenamiento: 'All', naturalezaLesion: 'All', parteCuerpo: 'All',
  });
  // ──────────────────────────────────────────────────────────────────────────
  
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
  const paretoData = useMemo(() => {
    const { fi } = applyMultiFilter(comparisonIncidents, comparisonExposureHours, paretoFilter);
    return generateParetoData(fi, paretoView);
  }, [comparisonIncidents, comparisonExposureHours, paretoFilter, paretoView]);

  // ── Comparación Mensual de Eventos — depende SÓLO de monthlyFilter ─────────
  const monthlyChartData = useMemo(() => {
    const my1 = monthlyFilter.year  !== 'All' ? Number(monthlyFilter.year)  : 2025;
    const my2 = monthlyFilter.year2 && monthlyFilter.year2 !== 'All' ? Number(monthlyFilter.year2) : 2026;
    let mbase = monthlyFilter.sites.length > 0
      ? comparisonIncidents.filter(i => monthlyFilter.sites.includes(i.site))
      : comparisonIncidents.slice();
    if (monthlyComCliente !== 'All') {
      const wantTrue = monthlyComCliente === 'SI';
      mbase = mbase.filter(i => i.com_cliente === wantTrue);
    }
    return { data: generateMonthlyComparison(mbase, my1, my2), my1, my2 };
  }, [comparisonIncidents, monthlyFilter, monthlyComCliente]);

  // ── Total Incidentes por Cliente — depende SÓLO de clienteFilter ────────────
  const clienteChartData = useMemo(() => {
    // Aplicar año Y sitio simultáneamente (AND lógico)
    // Bug anterior: if-else chain que ignoraba el año cuando el sitio estaba activo
    const cbase = comparisonIncidents.filter(i =>
      (clienteFilter.year === 'All' || i.year === Number(clienteFilter.year)) &&
      (clienteFilter.sites.length === 0 || clienteFilter.sites.includes(i.site))
    );
    return generateIncidentsByCliente(cbase);
  }, [comparisonIncidents, clienteFilter]);

  // Risk Trend Data — filtro local propio
  const trendData = useMemo(() => {
    const { fi, fh } = applyMultiFilter(comparisonIncidents, comparisonExposureHours, trendFilter);
    const periods = Array.from(new Set([
        ...fh.map(e => e.period),
        ...fi.map(i => `${i.year}-${String(i.month).padStart(2, '0')}`)
    ])).sort();

    return periods.map(period => {
        const [year, month] = period.split('-').map(Number);
        const sliceIncidents = fi.filter(i => i.year === year && i.month === month);
        const sliceHours = fh.filter(e => e.period === period);
        const m = calculateKPIs(sliceIncidents, sliceHours, [], settings);
        return {
            name: period,
            Risk: m.risk_index_total,
            TRIR: m.trir,
            LTIR: m.ltif,
            TargetTRIR: targets.trir
        };
    });
  }, [comparisonIncidents, comparisonExposureHours, trendFilter, settings, targets]);

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

  // ── Mapa de logos por cliente/sitio ──────────────────────────────────────────────
  // Para agregar un nuevo cliente: añadir entrada con el nombre EXACTO del sitio
  // tal como aparece en el filtro, apuntando al archivo en public/
  const CLIENT_LOGOS: Record<string, string> = {
    'JACWELL': 'jacwell.png',
    // 'OTRO_CLIENTE': 'otro-cliente.png',  ← plantilla para nuevos clientes
  };

  const DEFAULT_LOGO = 'logo-single.png';

  // Determinar qué logo mostrar según el filtro de sitio activo
  // Solo muestra logo de cliente cuando hay exactamente 1 sitio seleccionado
  const activeSite = (filters?.site && Array.isArray(filters.site) && filters.site.length === 1)
    ? filters.site[0].toUpperCase().trim()
    : (typeof filters?.site === 'string' && filters.site !== 'All')
      ? filters.site.toUpperCase().trim()
      : null;
  const logoFile = (activeSite && CLIENT_LOGOS[activeSite]) ? CLIENT_LOGOS[activeSite] : DEFAULT_LOGO;
  const logoSrc = `${import.meta.env.BASE_URL}${logoFile}`;
  const logoAlt = activeSite ? `Logo ${activeSite}` : 'Logo Tacker SRL';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {selectedMetric && <MetricDetailModal detail={selectedMetric} onClose={() => setSelectedMetric(null)} />}

      {/* TOP BAR: Scenario & Alerts */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <div className="flex items-center gap-3">
               {/* Logo dinámico: cambia según el cliente/sitio seleccionado en el filtro */}
               <img
                 key={logoSrc}
                 src={logoSrc}
                 alt={logoAlt}
                 className="h-10 w-auto object-contain flex-shrink-0 transition-opacity duration-300"
                 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
               />
               <div>
                   <h2 className="text-xl font-bold text-gray-800 flex items-center">
                       <Activity className="w-6 h-6 mr-2 text-blue-600" />
                       Tablero Corporativo HSE
                   </h2>
                   <p className="text-xs text-gray-500 mt-1">
                       Estándares: OSHA (200k), IOGP (1M), API RP 754, ISO 45001.
                   </p>
               </div>
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
                  {(() => {
                      // Map each indicator to its real current value from metrics
                      const blocked = isRatesBlocked;
                      const fmt = (v: number | null | undefined, decimals = 2) =>
                          v === null || v === undefined || blocked ? '—' : v.toFixed(decimals);
                      const realValues: Record<string, { value: string; good: boolean | null }> = {
                          'TRIR (OSHA)':     { value: fmt(metrics.trir), good: blocked ? null : metrics.trir !== null && metrics.trir !== undefined && metrics.trir <= 1.2 },
                          'LTIF (IOGP)':     { value: fmt(metrics.ltif), good: blocked ? null : metrics.ltif !== null && metrics.ltif !== undefined && metrics.ltif <= 2.5 },
                          'DART (OSHA)':     { value: fmt(metrics.dart), good: blocked ? null : metrics.dart !== null && metrics.dart !== undefined && metrics.dart <= 0.6 },
                          'SR (Severidad)':  { value: fmt(metrics.sr, 2), good: blocked ? null : metrics.sr !== null && metrics.sr !== undefined && metrics.sr <= 0.15 },
                          'FAR (Fatalidad)': { value: fmt(metrics.far, 2), good: blocked ? null : metrics.far !== null && metrics.far !== undefined && metrics.far === 0 },
                          'T1 PSER (Tier 1)':{ value: fmt(metrics.t1_pser), good: blocked ? null : metrics.t1_pser !== null && metrics.t1_pser !== undefined && metrics.t1_pser <= 0.1 },
                          'T2 PSER (Tier 2)':{ value: fmt(metrics.t2_pser), good: blocked ? null : metrics.t2_pser !== null && metrics.t2_pser !== undefined && metrics.t2_pser <= 1.0 },
                          'SLG-24H':         { value: `${metrics.slg24h ?? '—'}%`, good: metrics.slg24h !== null && metrics.slg24h !== undefined && metrics.slg24h >= 100 },
                      };
                      return (
                          <table className="min-w-full divide-y divide-gray-200 text-sm">
                              <thead className="bg-gray-50">
                                  <tr>
                                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Indicador</th>
                                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Meta 2025</th>
                                      <th className="px-6 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50/50">Meta 2026</th>
                                      <th className="px-6 py-3 text-right text-xs font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50/50">Real Actual</th>
                                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Var. Meta</th>
                                  </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                  {TARGET_COMPARISON_DATA.map((row, idx) => {
                                      const real = realValues[row.label];
                                      const statusCls = real?.good === null
                                          ? 'text-gray-400 font-mono'
                                          : real?.good
                                              ? 'text-green-700 font-mono font-bold bg-green-50'
                                              : 'text-red-700 font-mono font-bold bg-red-50';
                                      const statusIcon = real?.good === null ? '' : real?.good ? ' ✓' : ' ✗';
                                      return (
                                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                              <td className="px-6 py-3 text-gray-900 font-bold">{row.label}</td>
                                              <td className="px-6 py-3 text-right text-gray-600 font-mono">{row.m25}</td>
                                              <td className="px-6 py-3 text-right text-blue-700 font-mono font-bold bg-blue-50/30">{row.m26}</td>
                                              <td className={`px-6 py-3 text-right text-xs rounded-sm ${statusCls}`}>
                                                  {real?.value ?? '—'}{statusIcon}
                                              </td>
                                              <td className={`px-6 py-3 text-right font-bold text-xs ${row.var.includes('↓') || row.var.includes('=') ? 'text-green-600' : 'text-gray-400'}`}>
                                                  {row.var}
                                              </td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      );
                  })()}
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
               <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                 <h3 className="font-bold text-gray-800 flex items-center">
                     <TrendingUp className="w-5 h-5 mr-2 text-orange-500" /> Evolución Índice de Riesgo
                 </h3>
                 <div className="flex flex-wrap items-center gap-1.5 mt-1">
                   <select title="Filtrar por año" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                     value={trendFilter.year} onChange={e => setTrendFilter(prev => ({ ...prev, year: e.target.value }))}>
                     <option value="All">Año: Todos</option>
                     {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                   </select>
                   <ChartMultiSiteFilter sites={uniqueSites} selected={trendFilter.sites}
                     onChange={vals => setTrendFilter(prev => ({ ...prev, sites: vals }))} />
                   {(trendFilter.year !== 'All' || trendFilter.sites.length > 0) && (
                     <button onClick={() => setTrendFilter({ year: 'All', sites: [] })}
                       className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                   )}
                 </div>
               </div>
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
                               <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '8px' }} />
                               <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                               <Bar yAxisId="left" dataKey="Risk" name="Puntos Riesgo" fill="url(#colorRisk)" radius={[6,6,0,0]} barSize={24} />
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="TRIR" name="TRIR" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />}
                               {!isRatesBlocked && <Line yAxisId="right" type="monotone" dataKey="LTIF" name="LTIF" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />}
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">Sin datos para visualizar tendencias.</div>
                   )}
               </div>
          </div>

          <div id="chart-pareto" className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 min-w-0 flex flex-col">
               <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                 <div className="flex items-center gap-3">
                   <h3 className="font-bold text-gray-800 flex items-center">
                       <BarChart2 className="w-5 h-5 mr-2 text-blue-500" /> Análisis Pareto 80/20
                   </h3>
                   <div className="flex space-x-1 text-xs">
                       <button onClick={() => setParetoView('type')} className={`px-2 py-1 rounded font-medium transition-all ${paretoView==='type'?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Por Tipo</button>
                       <button onClick={() => setParetoView('location')} className={`px-2 py-1 rounded font-medium transition-all ${paretoView==='location'?'bg-blue-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Por Ubicación</button>
                   </div>
                 </div>
                 <div className="flex flex-wrap items-center gap-1.5 mt-1">
                   <select title="Filtrar por año" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                     value={paretoFilter.year} onChange={e => setParetoFilter(prev => ({ ...prev, year: e.target.value }))}>
                     <option value="All">Año: Todos</option>
                     {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                   </select>
                   <ChartMultiSiteFilter sites={uniqueSites} selected={paretoFilter.sites}
                     onChange={vals => setParetoFilter(prev => ({ ...prev, sites: vals }))} />
                   {(paretoFilter.year !== 'All' || paretoFilter.sites.length > 0) && (
                     <button onClick={() => setParetoFilter({ year: 'All', sites: [] })}
                       className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                   )}
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
                               <Tooltip cursor={{fill: 'rgba(59, 130, 246, 0.05)'}} contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px' }} />
                               <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />
                               <Bar yAxisId="left" dataKey="count" name="Cantidad" fill="url(#colorCount)" barSize={32} radius={[6,6,0,0]} />
                               <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="% Acumulado" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                           </ComposedChart>
                       </ResponsiveContainer>
                   ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm italic">Sin datos para visualizar Pareto.</div>
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
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <BarChart2 className="w-5 h-5 mr-2 text-blue-600" /> Comparación por Tipo de Incidente
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {/* Año 1 */}
                      <select
                        title="Filtrar por año 1"
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={compTypeFilter.year}
                        onChange={e => setCompTypeFilter(prev => ({ ...prev, year: e.target.value }))}
                      >
                        <option value="All">Año: Todos</option>
                        {uniqueYearsAll.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      {/* Año 2 */}
                      <select
                        title="Filtrar por año 2"
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={compTypeFilter.year2 ?? 'All'}
                        onChange={e => setCompTypeFilter(prev => ({ ...prev, year2: e.target.value }))}
                      >
                        <option value="All">Año 2: Todos</option>
                        {uniqueYearsAll.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      {/* Sitio: multi-select */}
                      <ChartMultiSiteFilter
                        sites={uniqueSitesAll}
                        selected={compTypeFilter.sites}
                        onChange={vals => setCompTypeFilter(prev => ({ ...prev, sites: vals }))}
                      />
                      {/* Com. Cliente */}
                      <select
                        title="Filtrar por comunicación con cliente"
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={compTypeComCliente}
                        onChange={e => setCompTypeComCliente(e.target.value as 'All' | 'SI' | 'NO')}
                      >
                        <option value="All">Com. Cliente: Todos</option>
                        <option value="SI">Com. Cliente: SI</option>
                        <option value="NO">Com. Cliente: NO</option>
                      </select>
                      {/* Botón limpiar */}
                      {(compTypeFilter.year !== 'All' || compTypeFilter.sites.length > 0 || (compTypeFilter.year2 && compTypeFilter.year2 !== 'All') || compTypeComCliente !== 'All') && (
                        <button
                          onClick={() => { setCompTypeFilter({ year: '2025', sites: [], year2: '2026' }); setCompTypeComCliente('All'); }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"
                        >✕</button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {compTypeFilter.year !== 'All' ? compTypeFilter.year : '2025'} vs {compTypeFilter.year2 && compTypeFilter.year2 !== 'All' ? compTypeFilter.year2 : '2026'} — Análisis de tendencia por categoría
                  </p>
                  <div className="h-72">
                      {(() => {
                          const y1 = compTypeFilter.year !== 'All' ? Number(compTypeFilter.year) : 2025;
                          const y2 = compTypeFilter.year2 && compTypeFilter.year2 !== 'All' ? Number(compTypeFilter.year2) : 2026;
                          // Filtro de sitios múltiple: si hay selección aplica includes, si está vacío = todos
                          // EXENTO del filtro raíz: usa allRawInc para mostrar todos los años/sitios
                          let base = compTypeFilter.sites.length > 0
                            ? allRawInc.filter(i => compTypeFilter.sites.includes(i.site))
                            : allRawInc.slice();
                          // Aplicar filtro Com. Cliente
                          if (compTypeComCliente !== 'All') {
                            const wantTrue = compTypeComCliente === 'SI';
                            base = base.filter(i => i.com_cliente === wantTrue);
                          }
                          const comparisonData = generateYearComparisonByType(base, y1, y2);
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
                                                                  <span className="text-gray-600">{y1}: <span className="font-semibold text-gray-900">{data[String(y1)]}</span></span>
                                                              </div>
                                                              <div className="flex items-center">
                                                                  <span className="w-3 h-3 rounded-full bg-emerald-500 mr-1"></span>
                                                                  <span className="text-gray-600">{y2}: <span className="font-semibold text-gray-900">{data[String(y2)]}</span></span>
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
                                      <Bar dataKey={String(y1)} name={String(y1)} fill="url(#color2025)" radius={[0, 4, 4, 0]} barSize={12} />
                                      <Bar dataKey={String(y2)} name={String(y2)} fill="url(#color2026)" radius={[0, 4, 4, 0]} barSize={12} />
                                  </BarChart>
                              </ResponsiveContainer>
                          ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">Sin datos para comparar</div>;
                      })()}
                  </div>
                  {/* Mini resumen */}
                  <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                      {(() => {
                          const cy1 = compTypeFilter.year !== 'All' ? Number(compTypeFilter.year) : 2025;
                          const cy2 = compTypeFilter.year2 && compTypeFilter.year2 !== 'All' ? Number(compTypeFilter.year2) : 2026;
                          let cbase = compTypeFilter.sites.length > 0
                            ? comparisonIncidents.filter(i => compTypeFilter.sites.includes(i.site))
                            : comparisonIncidents;
                          if (compTypeComCliente !== 'All') {
                            const wantTrue = compTypeComCliente === 'SI';
                            cbase = cbase.filter(i => i.com_cliente === wantTrue);
                          }
                          const dataY1 = cbase.filter(i => i.year === cy1).length;
                          const dataY2 = cbase.filter(i => i.year === cy2).length;
                          const diff = dataY2 - dataY1;
                          const pct = dataY1 > 0 ? ((diff / dataY1) * 100).toFixed(1) : 'N/A';
                          return (
                              <>
                                  <div className="bg-blue-50 rounded-lg p-2">
                                      <p className="text-xs text-blue-600 font-medium">{cy1}</p>
                                      <p className="text-lg font-bold text-blue-700">{dataY1}</p>
                                  </div>
                                  <div className="bg-emerald-50 rounded-lg p-2">
                                      <p className="text-xs text-emerald-600 font-medium">{cy2}</p>
                                      <p className="text-lg font-bold text-emerald-700">{dataY2}</p>
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

              {/* Waterfall Chart */}
              <div id="chart-waterfall" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <BarChart2 className="w-5 h-5 mr-2 text-cyan-600" /> Contribución por Sitio al TRIR
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <select title="Filtrar por año" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={waterfallFilter.year} onChange={e => setWaterfallFilter(prev => ({ ...prev, year: e.target.value }))}>
                        <option value="All">Año: Todos</option>
                        {uniqueYearsAll.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      <ChartMultiSiteFilter sites={uniqueSitesAll} selected={waterfallFilter.sites}
                        onChange={vals => setWaterfallFilter(prev => ({ ...prev, sites: vals }))} />
                      {(waterfallFilter.year !== 'All' || waterfallFilter.sites.length > 0) && (
                        <button onClick={() => setWaterfallFilter({ year: 'All', sites: [] })}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                      )}
                    </div>
                  </div>
                  <div className="h-80">
                      {(() => {
                          // EXENTO del filtro raíz: usa allRawInc/allRawHrs para mostrar todos los sitios
                          const { fi: wfInc, fh: wfHrs } = applyMultiFilter(allRawInc, allRawHrs, waterfallFilter);
                          const waterfallData = generateWaterfallData(wfInc, wfHrs, settings);
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
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-orange-600" /> Frecuencia vs Severidad (por Sitio)
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <select title="Filtrar por año" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={scatterFilter.year} onChange={e => setScatterFilter(prev => ({ ...prev, year: e.target.value }))}>
                        <option value="All">Año: Todos</option>
                        {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      <ChartMultiSiteFilter sites={uniqueSites} selected={scatterFilter.sites}
                        onChange={vals => setScatterFilter(prev => ({ ...prev, sites: vals }))} />
                      {(scatterFilter.year !== 'All' || scatterFilter.sites.length > 0) && (
                        <button onClick={() => setScatterFilter({ year: 'All', sites: [] })}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                      )}
                    </div>
                  </div>
                  <div className="h-72">
                      {(() => {
                          const { fi: scInc, fh: scHrs } = applyMultiFilter(comparisonIncidents, comparisonExposureHours, scatterFilter);
                          const scatterData = generateScatterPlotData(scInc, scHrs);
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
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Target className="w-5 h-5 mr-2 text-indigo-600" /> Radar Comparativo (Top 5 Sitios)
                    </h3>
                    <ChartFilter years={uniqueYears} sites={uniqueSites} value={radarFilter} onChange={setRadarFilter} showSite={false} />
                  </div>
                  <div className="h-72">
                      {(() => {
                          const { fi: rdInc, fh: rdHrs } = applyChartFilter(comparisonIncidents, comparisonExposureHours, radarFilter);
                          const radarData = generateRadarChartData(rdInc, rdHrs, exposureKm, settings);
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
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-purple-600" /> Comparación Mensual de Eventos
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <select title="Año 1" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={monthlyFilter.year} onChange={e => setMonthlyFilter(prev => ({ ...prev, year: e.target.value }))}>
                        <option value="All">Año: Todos</option>
                        {uniqueYearsAll.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      <select title="Año 2" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={monthlyFilter.year2 ?? 'All'} onChange={e => setMonthlyFilter(prev => ({ ...prev, year2: e.target.value }))}>
                        <option value="All">Año 2: Todos</option>
                        {uniqueYearsAll.map(y => <option key={y} value={String(y)}>{y}</option>)}
                      </select>
                      <ChartMultiSiteFilter sites={uniqueSitesAll} selected={monthlyFilter.sites}
                        onChange={vals => setMonthlyFilter(prev => ({ ...prev, sites: vals }))} />
                      <select title="Com. Cliente" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        value={monthlyComCliente} onChange={e => setMonthlyComCliente(e.target.value as 'All' | 'SI' | 'NO')}>
                        <option value="All">Com. Cliente: Todos</option>
                        <option value="SI">Com. Cliente: SI</option>
                        <option value="NO">Com. Cliente: NO</option>
                      </select>
                      {(monthlyFilter.year !== 'All' || monthlyFilter.sites.length > 0 || (monthlyFilter.year2 && monthlyFilter.year2 !== 'All') || monthlyComCliente !== 'All') && (
                        <button onClick={() => { setMonthlyFilter({ year: '2025', sites: [], year2: '2026' }); setMonthlyComCliente('All'); }}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Incidentes por mes</p>
                  <div className="h-72">
                      {(() => {
                          const { data: monthlyData, my1, my2 } = monthlyChartData;
                          const hasData = monthlyData.some((m: any) => (m[String(my1)] || 0) > 0 || (m[String(my2)] || 0) > 0);
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
                                          dataKey={String(my1)} 
                                          name={String(my1)} 
                                          stroke="#3b82f6" 
                                          strokeWidth={2}
                                          fill="url(#colorArea2025)" 
                                          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                          activeDot={{ r: 6 }}
                                      />
                                      <Area 
                                          type="monotone" 
                                          dataKey={String(my2)} 
                                          name={String(my2)} 
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

              {/* Gráfico de barras horizontales: Total Incidentes por Cliente */}
              <div id="chart-incidents-by-cliente" className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      <h3 className="font-bold text-gray-800 flex items-center">
                          <BarChart2 className="w-5 h-5 mr-2 text-amber-600" /> Total Incidentes por Cliente
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <select title="Filtrar por año" className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                          value={clienteFilter.year} onChange={e => setClienteFilter(prev => ({ ...prev, year: e.target.value }))}>
                          <option value="All">Año: Todos</option>
                          {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                        <ChartMultiSiteFilter sites={uniqueSites} selected={clienteFilter.sites}
                          onChange={vals => setClienteFilter(prev => ({ ...prev, sites: vals }))} />
                        {(clienteFilter.year !== 'All' || clienteFilter.sites.length > 0) && (
                          <button onClick={() => setClienteFilter({ year: 'All', sites: [] })}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600">✕</button>
                        )}
                      </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Total acumulado de incidentes por operadora / cliente</p>
                  <div className="h-72">
                      {(() => {
                          // clienteChartData ya está memoizado con sólo clienteFilter como dependencia
                          const clienteData = clienteChartData;
                          if (clienteData.length === 0) {
                              return (
                                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                                      <span>Sin datos de cliente en los registros</span>
                                      <span className="text-xs text-gray-300">Asegúrese de que la columna "Cliente" esté presente en el Excel importado</span>
                                  </div>
                              );
                          }
                          return (
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                      data={clienteData}
                                      layout="vertical"
                                      margin={{ left: 8, right: 40, top: 10, bottom: 5 }}
                                  >
                                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                                      <XAxis
                                          type="number"
                                          fontSize={10}
                                          tickLine={false}
                                          axisLine={{ stroke: '#d1d5db' }}
                                          tick={{ fill: '#6b7280' }}
                                          allowDecimals={false}
                                      />
                                      <YAxis
                                          type="category"
                                          dataKey="cliente"
                                          fontSize={11}
                                          tickLine={false}
                                          axisLine={false}
                                          tick={{ fill: '#374151', fontWeight: 500 }}
                                          width={120}
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
                                          formatter={(value: any) => [value, 'Incidentes']}
                                      />
                                      <Bar
                                          dataKey="total"
                                          name="Incidentes"
                                          radius={[0, 6, 6, 0]}
                                          barSize={22}
                                          label={{ position: 'right', fontSize: 11, fill: '#374151', fontWeight: 600 }}
                                      >
                                          {clienteData.map((entry, index) => (
                                              <Cell key={`cell-cliente-${index}`} fill={entry.color} />
                                          ))}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          );
                      })()}
                  </div>
              </div>
          </div>
      </div>
      
      {/* 7. HEATMAP & TRANSIT */}
      <div id="heatmap-container" className="min-w-0 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <h3 className="font-bold text-gray-800 flex items-center text-sm uppercase">
                  <Target className="w-4 h-4 mr-2 text-red-500" /> Mapa de Calor de Incidentes
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                  {/* Filtro Com. Cliente */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <span className="text-xs text-gray-500 px-1">Com. Cliente:</span>
                      {(['All', 'SI', 'NO'] as const).map(opt => (
                          <button
                              key={opt}
                              onClick={() => setHeatmapComCliente(opt)}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                  heatmapComCliente === opt
                                      ? opt === 'SI' ? 'bg-green-500 text-white' : opt === 'NO' ? 'bg-red-400 text-white' : 'bg-white text-gray-700 shadow'
                                      : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                              {opt === 'All' ? 'Todos' : opt}
                          </button>
                      ))}
                  </div>
                  {/* Filtro Año */}
                  <select
                      title="Filtrar por año"
                      className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
                      value={heatmapFilter.year}
                      onChange={e => setHeatmapFilter(prev => ({ ...prev, year: e.target.value }))}
                  >
                      <option value="All">Año: Todos</option>
                      {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                  {/* Filtro Sitio: multi-select */}
                  <ChartMultiSiteFilter
                      sites={uniqueSites}
                      selected={heatmapFilter.sites}
                      onChange={vals => setHeatmapFilter(prev => ({ ...prev, sites: vals }))}
                  />
                  {/* Botón limpiar */}
                  {(heatmapFilter.year !== 'All' || heatmapFilter.sites.length > 0) && (
                      <button
                          onClick={() => setHeatmapFilter({ year: 'All', sites: [] })}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600"
                      >✕</button>
                  )}
              </div>
          </div>
          <div className="min-h-[500px] w-full">
              {(() => {
                  const { fi: hmIncBase, fh: hmHrs } = applyMultiFilter(comparisonIncidents, comparisonExposureHours, heatmapFilter);
                  const hmInc = heatmapComCliente === 'All'
                      ? hmIncBase
                      : heatmapComCliente === 'SI'
                          ? hmIncBase.filter(i => i.com_cliente === true)
                          : hmIncBase.filter(i => i.com_cliente === false);
                  return <HeatmapMatrix incidents={hmInc} exposureHours={hmHrs} />;
              })()}
          </div>
      </div>

      {/* 7.5 RESUMEN HORAS HOMBRE POR SITIO Y MES */}
      <div id="chart-exposure-hh" className="bg-white border border-gray-200 rounded-xl p-6">
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
                  if (filters?.site) {
                      const siteArr = Array.isArray(filters.site) ? filters.site : (filters.site !== 'All' ? [filters.site] : []);
                      if (siteArr.length > 0) sites = sites.filter(s => siteArr.includes(s));
                  }

                  // Aplicar filtro de año (si hay) - filtrar períodos que empiecen con ese año
                  if (filters?.year) {
                      const yearArr = Array.isArray(filters.year) ? filters.year : (filters.year !== 'All' ? [filters.year] : []);
                      if (yearArr.length > 0) periods = periods.filter(p => yearArr.some(y => p.startsWith(`${y}-`)));
                  }

                  // Aplicar filtro de mes (si hay) - filtrar períodos que terminen en ese mes
                  if (filters?.month) {
                      const monthArr = Array.isArray(filters.month) ? filters.month : (filters.month !== 'All' ? [filters.month] : []);
                      if (monthArr.length > 0) periods = periods.filter(p => monthArr.some(m => p.endsWith(`-${String(m).padStart(2, '0')}`)));
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
          <div id="chart-top5-sites" className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-gray-700 uppercase flex items-center mb-4">
                  <Trophy className="w-5 h-5 mr-2 text-amber-500" /> Top 5 Sitios con Mayor Incidentalidad
              </h3>
              <div className="space-y-3">
                  {metrics.top5Sites.map((site, idx) => {
                      const maxCount = metrics.top5Sites[0].count;
                      const percentage = (site.count / maxCount) * 100;
                      const badgeClass = idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-yellow-500' : 'bg-blue-500';
                      const rankColor = idx === 0 ? 'red' : idx === 1 ? 'orange' : idx === 2 ? 'yellow' : 'blue';
                      
                      return (
                          <div key={idx} className="flex items-center space-x-3">
                              <div className="flex-shrink-0 w-8 text-center">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${badgeClass}`}>
                                      {site.rank}
                                  </span>
                              </div>
                              <div className="flex-grow">
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-sm font-bold text-gray-800">{site.site}</span>
                                      <span className="text-sm font-mono text-gray-600">{site.count} incidentes</span>
                                  </div>
                                  <progress
                                      className="site-progress w-full h-2 rounded-full"
                                      data-rank={rankColor}
                                      value={percentage}
                                      max={100}
                                  />
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

      {/* RISK CONSOLIDATED PANEL */}
      <div id="chart-risk-panel" className="bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200 rounded-xl p-6">
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
          <div id="chart-days-since" className="bg-white border border-gray-200 rounded-xl p-6">
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

      {/* ═══════════════════════════════════════════════════════════════════
          SECCIÓN: ANÁLISIS CAUSAL, ART Y PERFIL DEL INCIDENTE
          Gráficos basados en: Forma Ocurrencia, Factor Humano, Naturaleza
          Lesión, Parte Cuerpo, ART Estado/Gravedad/Diagnóstico, etc.
      ═══════════════════════════════════════════════════════════════════ */}
      {(() => {
        const CAUSAL_COLORS = [
          '#3b82f6','#ef4444','#f59e0b','#10b981','#8b5cf6',
          '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#e11d48'
        ];

        // Base: solo año + sitio (para calcular opciones de todos los dropdowns)
        const causalBaseInc = comparisonIncidents.filter(i =>
          (causalFilter.year === 'All' || String(i.year) === causalFilter.year) &&
          (causalFilter.sites.length === 0 || causalFilter.sites.includes(i.site))
        );
        // Opciones únicas (derivadas del base para mostrar todo lo disponible)
        const causalOptUbicacion        = Array.from(new Set(causalBaseInc.map(i => i.ubicacion_lesion).filter(Boolean) as string[])).sort();
        const causalOptTipo             = Array.from(new Set(causalBaseInc.map(i => i.art_tipo_siniestro).filter(Boolean) as string[])).sort();
        const causalOptDiagnostico      = Array.from(new Set(causalBaseInc.map(i => i.art_diagnostico).filter(Boolean) as string[])).sort();
        const causalOptForma            = Array.from(new Set([...causalBaseInc.map(i => i.forma_ocurrencia), ...causalBaseInc.map(i => i.art_forma_ocurrencia)].filter(Boolean) as string[])).sort();
        const causalOptFuncion          = Array.from(new Set(causalBaseInc.map(i => i.funcion).filter(Boolean) as string[])).sort();
        const causalOptGravedad         = Array.from(new Set(causalBaseInc.map(i => i.art_gravedad).filter(Boolean) as string[])).sort();
        const causalOptDiagrama         = Array.from(new Set(causalBaseInc.map(i => i.diagrama_trabajo).filter(Boolean) as string[])).sort();
        const causalOptNivelEnt         = Array.from(new Set(causalBaseInc.map(i => i.nivel_entrenamiento).filter(Boolean) as string[])).sort();
        const causalOptNaturaleza       = Array.from(new Set(causalBaseInc.map(i => i.naturaleza_lesion).filter(Boolean) as string[])).sort();
        const causalOptParteCuerpo      = Array.from(new Set(causalBaseInc.map(i => i.parte_cuerpo).filter(Boolean) as string[])).sort();
        // Aplicar los 10 filtros causales adicionales
        const causalInc = causalBaseInc.filter(i =>
          (causalFilter.ubicacion === 'All'         || i.ubicacion_lesion === causalFilter.ubicacion) &&
          (causalFilter.tipoSiniestro === 'All'     || i.art_tipo_siniestro === causalFilter.tipoSiniestro) &&
          (causalFilter.diagnostico === 'All'       || i.art_diagnostico === causalFilter.diagnostico) &&
          (causalFilter.formaOcurrencia === 'All'   || i.forma_ocurrencia === causalFilter.formaOcurrencia || i.art_forma_ocurrencia === causalFilter.formaOcurrencia) &&
          (causalFilter.funcion === 'All'           || i.funcion === causalFilter.funcion) &&
          (causalFilter.gravedad === 'All'          || i.art_gravedad === causalFilter.gravedad) &&
          (causalFilter.diagramaTrabajo === 'All'   || i.diagrama_trabajo === causalFilter.diagramaTrabajo) &&
          (causalFilter.nivelEntrenamiento === 'All'|| i.nivel_entrenamiento === causalFilter.nivelEntrenamiento) &&
          (causalFilter.naturalezaLesion === 'All'  || i.naturaleza_lesion === causalFilter.naturalezaLesion) &&
          (causalFilter.parteCuerpo === 'All'       || i.parte_cuerpo === causalFilter.parteCuerpo)
        );

        // Check if any causal field has data
        const hasCausalData = causalInc.some(i =>
          i.forma_ocurrencia || i.condicion_peligrosa || i.acto_inseguro ||
          i.factor_humano || i.naturaleza_lesion || i.parte_cuerpo ||
          i.nivel_entrenamiento || i.funcion || i.art_gravedad || i.art_estado ||
          i.art_diagnostico || i.art_tipo_siniestro
        );

        if (!hasCausalData) return null;

        // ─── Reusable inner renderers ────────────────────────────────────
        const NoData = () => (
          <div className="h-full flex items-center justify-center text-gray-300 text-xs italic">
            Sin datos en el período seleccionado
          </div>
        );

        // Horizontal BarChart (for categorical string data)
        const renderHorizBar = (
          data: { name: string; count: number }[],
          color: string,
          height = 220
        ) => {
          if (!data.length) return <NoData />;
          // Truncate labels for display
          const display = data.map(d => ({
            ...d,
            label: d.name.length > 30 ? d.name.substring(0, 28) + '…' : d.name
          }));
          const barH = Math.max(height, display.length * 28 + 40);
          return (
            <ResponsiveContainer width="100%" height={barH}>
              <BarChart
                data={display}
                layout="vertical"
                margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tick={{ fill: '#9ca3af' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#374151' }}
                  width={160}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: any) => [v, 'Casos']}
                  labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.name ?? ''}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 6, 6, 0]}
                  barSize={14}
                  label={{ position: 'right', fontSize: 10, fill: '#374151', fontWeight: 600 }}
                >
                  {display.map((_, idx) => (
                    <Cell key={idx} fill={color} fillOpacity={1 - idx * 0.04} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          );
        };

        // Donut / Pie chart (for few-category fields)
        const renderDonut = (
          data: { name: string; count: number }[],
          height = 200
        ) => {
          if (!data.length) return <NoData />;
          const total = data.reduce((s, d) => s + d.count, 0);
          return (
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="70%"
                  paddingAngle={3}
                  label={({ name, count }: any) =>
                    `${String(name).length > 14 ? String(name).substring(0, 12) + '…' : name} (${((count / total) * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                  fontSize={9}
                >
                  {data.map((_, idx) => (
                    <Cell key={idx} fill={CAUSAL_COLORS[idx % CAUSAL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v: any, name: any) => [v, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                  formatter={(value: string) => value.length > 22 ? value.substring(0, 20) + '…' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          );
        };

        const ChartCard = ({ id, title, icon: Icon, iconColor, children, scrollable = false }: any) => (
          <div id={id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center mb-3">
              <Icon className={`w-4 h-4 mr-2 ${iconColor}`} />
              {title}
            </h4>
            <div className={scrollable ? 'overflow-y-auto max-h-72' : 'flex-1'}>
              {children}
            </div>
          </div>
        );

        return (
          <div className="space-y-4">
            {/* ── Section Header + Filter ─────────────────────────────── */}
            <div className="bg-gradient-to-r from-rose-50 to-orange-50 border-2 border-rose-200 rounded-xl p-5">
              {/* ── Header row ── */}
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-rose-900 uppercase flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-rose-600" />
                    Análisis Causal, ART y Perfil del Incidente
                  </h2>
                  <p className="text-xs text-rose-600 mt-0.5">
                    <span className="font-bold">{causalInc.length}</span> de {causalBaseInc.length} incidentes · filtros activos:
                    {(() => {
                      const n = [causalFilter.ubicacion, causalFilter.tipoSiniestro, causalFilter.diagnostico,
                        causalFilter.formaOcurrencia, causalFilter.funcion, causalFilter.gravedad,
                        causalFilter.diagramaTrabajo, causalFilter.nivelEntrenamiento,
                        causalFilter.naturalezaLesion, causalFilter.parteCuerpo].filter(v => v !== 'All').length;
                      return n === 0
                        ? <span className="ml-1 text-rose-400">ninguno</span>
                        : <span className="ml-1 font-bold text-rose-700">{n}</span>;
                    })()}
                  </p>
                </div>
              </div>

              {/* ── Filtros: fila 1 — Año + Sitio ── */}
              <div className="bg-white/70 border border-rose-100 rounded-lg p-3 mb-3">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-2">Filtros globales</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    title="Año"
                    className="text-[10px] border border-rose-200 rounded px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-rose-300"
                    value={causalFilter.year}
                    onChange={e => setCausalFilter(prev => ({ ...prev, year: e.target.value }))}
                  >
                    <option value="All">Año: Todos</option>
                    {uniqueYears.map(y => <option key={y} value={String(y)}>{y}</option>)}
                  </select>
                  <ChartMultiSiteFilter
                    sites={uniqueSites}
                    selected={causalFilter.sites}
                    onChange={vals => setCausalFilter(prev => ({ ...prev, sites: vals }))}
                  />
                </div>
              </div>

              {/* ── Filtros causales ── */}
              <div className="bg-white/70 border border-rose-100 rounded-lg p-3 mb-5">
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-2">Filtrar por campo causal</p>

                {/* Fila 1: Lesión */}
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Lesión</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  {[{
                    label: 'Ubicación Lesión', key: 'ubicacion' as const, opts: causalOptUbicacion, ph: 'Todas'
                  },{
                    label: 'Naturaleza Lesión', key: 'naturalezaLesion' as const, opts: causalOptNaturaleza, ph: 'Todas'
                  },{
                    label: 'Parte Cuerpo Afectada', key: 'parteCuerpo' as const, opts: causalOptParteCuerpo, ph: 'Todas'
                  },{
                    label: 'Diagnóstico ART', key: 'diagnostico' as const, opts: causalOptDiagnostico, ph: 'Todos'
                  }].map(({ label, key, opts, ph }) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                      <select
                        title={label}
                        className={`text-[10px] border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-rose-300 ${
                          causalFilter[key] !== 'All' ? 'border-rose-400 bg-rose-50 text-rose-800 font-semibold' : 'border-gray-200 bg-white text-gray-600'
                        }`}
                        value={causalFilter[key]}
                        onChange={e => setCausalFilter(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="All">{ph}</option>
                        {opts.map(v => <option key={v} value={v}>{v.length > 34 ? v.substring(0, 32) + '…' : v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Fila 2: Causa */}
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Causa / Mecanismo</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                  {[{
                    label: 'Forma de Ocurrencia', key: 'formaOcurrencia' as const, opts: causalOptForma, ph: 'Todas'
                  },{
                    label: 'Tipo Siniestro ART', key: 'tipoSiniestro' as const, opts: causalOptTipo, ph: 'Todos'
                  },{
                    label: 'Gravedad ART', key: 'gravedad' as const, opts: causalOptGravedad, ph: 'Todas'
                  },{
                    label: 'Ubicación Lesión (ART)', key: 'ubicacion' as const, opts: causalOptUbicacion, ph: 'Todas'
                  }].map(({ label, key, opts, ph }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                      <select
                        title={label}
                        className={`text-[10px] border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-rose-300 ${
                          causalFilter[key] !== 'All' ? 'border-rose-400 bg-rose-50 text-rose-800 font-semibold' : 'border-gray-200 bg-white text-gray-600'
                        }`}
                        value={causalFilter[key]}
                        onChange={e => setCausalFilter(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="All">{ph}</option>
                        {opts.map(v => <option key={v} value={v}>{v.length > 34 ? v.substring(0, 32) + '…' : v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Fila 3: Perfil del Involucrado */}
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Perfil del Involucrado</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {[{
                    label: 'Función / Rol', key: 'funcion' as const, opts: causalOptFuncion, ph: 'Todas'
                  },{
                    label: 'Nivel Entrenamiento', key: 'nivelEntrenamiento' as const, opts: causalOptNivelEnt, ph: 'Todos'
                  },{
                    label: 'Diagrama de Trabajo', key: 'diagramaTrabajo' as const, opts: causalOptDiagrama, ph: 'Todos'
                  }].map(({ label, key, opts, ph }) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">{label}</label>
                      <select
                        title={label}
                        className={`text-[10px] border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-rose-300 ${
                          causalFilter[key] !== 'All' ? 'border-rose-400 bg-rose-50 text-rose-800 font-semibold' : 'border-gray-200 bg-white text-gray-600'
                        }`}
                        value={causalFilter[key]}
                        onChange={e => setCausalFilter(prev => ({ ...prev, [key]: e.target.value }))}
                      >
                        <option value="All">{ph}</option>
                        {opts.map(v => <option key={v} value={v}>{v.length > 34 ? v.substring(0, 32) + '…' : v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Chips activos + limpiar */}
                {(() => {
                  const CHIP_META: { key: keyof typeof causalFilter; label: string; color: string; hover: string }[] = [
                    { key: 'year',             label: 'Año',       color: 'bg-rose-100 text-rose-700',     hover: 'hover:text-rose-900' },
                    { key: 'ubicacion',        label: 'Ubic',      color: 'bg-teal-100 text-teal-700',     hover: 'hover:text-teal-900' },
                    { key: 'naturalezaLesion', label: 'Nat',       color: 'bg-pink-100 text-pink-700',     hover: 'hover:text-pink-900' },
                    { key: 'parteCuerpo',      label: 'Parte',     color: 'bg-cyan-100 text-cyan-700',     hover: 'hover:text-cyan-900' },
                    { key: 'diagnostico',      label: 'Dx',        color: 'bg-purple-100 text-purple-700', hover: 'hover:text-purple-900' },
                    { key: 'formaOcurrencia',  label: 'Forma',     color: 'bg-amber-100 text-amber-700',   hover: 'hover:text-amber-900' },
                    { key: 'tipoSiniestro',    label: 'Tipo',      color: 'bg-indigo-100 text-indigo-700', hover: 'hover:text-indigo-900' },
                    { key: 'gravedad',         label: 'Grav',      color: 'bg-red-100 text-red-700',       hover: 'hover:text-red-900' },
                    { key: 'funcion',          label: 'Función',   color: 'bg-blue-100 text-blue-700',     hover: 'hover:text-blue-900' },
                    { key: 'nivelEntrenamiento', label: 'Nivel',   color: 'bg-green-100 text-green-700',   hover: 'hover:text-green-900' },
                    { key: 'diagramaTrabajo',  label: 'Diagrama',  color: 'bg-orange-100 text-orange-700', hover: 'hover:text-orange-900' },
                  ];
                  const active = CHIP_META.filter(m => {
                    const v = causalFilter[m.key];
                    return Array.isArray(v) ? (v as string[]).length > 0 : v !== 'All';
                  });
                  if (active.length === 0 && causalFilter.sites.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-rose-100">
                      {causalFilter.sites.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          Sitios: {causalFilter.sites.length}
                          <button onClick={() => setCausalFilter(prev => ({ ...prev, sites: [] }))} className="hover:text-slate-900 flex-shrink-0">×</button>
                        </span>
                      )}
                      {active.map(m => {
                        const val = causalFilter[m.key] as string;
                        return (
                          <span key={m.key} className={`inline-flex items-center gap-1 text-[9px] ${m.color} font-bold px-2 py-0.5 rounded-full max-w-[180px]`}>
                            <span className="truncate">{m.label}: {val}</span>
                            <button onClick={() => setCausalFilter(prev => ({ ...prev, [m.key]: 'All' }))} className={`${m.hover} flex-shrink-0`}>×</button>
                          </span>
                        );
                      })}
                      <button
                        onClick={() => setCausalFilter({
                          year: 'All', sites: [], ubicacion: 'All', tipoSiniestro: 'All', diagnostico: 'All',
                          formaOcurrencia: 'All', funcion: 'All', gravedad: 'All', diagramaTrabajo: 'All',
                          nivelEntrenamiento: 'All', naturalezaLesion: 'All', parteCuerpo: 'All',
                        })}
                        className="text-[9px] px-2 py-0.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 font-semibold ml-auto"
                      >✕ Limpiar todo</button>
                    </div>
                  );
                })()}
              </div>

              {/* ── BLOQUE A: CAUSAS ──────────────────────────────────── */}
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> A. Causas del Incidente
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                <ChartCard id="chart-causal-forma" title="Forma de Ocurrencia" icon={Activity} iconColor="text-blue-500">
                  {renderHorizBar(
                    generateFieldDistribution(causalInc, 'forma_ocurrencia', 12).concat(
                      generateFieldDistribution(causalInc, 'art_forma_ocurrencia', 12)
                        .filter(d => !generateFieldDistribution(causalInc, 'forma_ocurrencia', 12).some(x => x.name === d.name))
                    ).sort((a, b) => b.count - a.count).slice(0, 12),
                    '#3b82f6'
                  )}
                </ChartCard>

                <ChartCard id="chart-causal-condicion" title="Condición Peligrosa" icon={AlertTriangle} iconColor="text-red-500">
                  {renderHorizBar(generateFieldDistribution(causalInc, 'condicion_peligrosa', 12), '#ef4444')}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <ChartCard id="chart-causal-acto" title="Acto Inseguro" icon={AlertTriangle} iconColor="text-amber-500">
                  {renderHorizBar(generateFieldDistribution(causalInc, 'acto_inseguro', 12), '#f59e0b')}
                </ChartCard>

                <ChartCard id="chart-causal-factor-humano" title="Factor Humano Contribuyente (F1 + F2 combinados)" icon={Users} iconColor="text-purple-500">
                  {renderHorizBar(generateCombinedFactorDistribution(causalInc, 12), '#8b5cf6')}
                </ChartCard>
              </div>

              {/* ── BLOQUE B: LESIÓN ──────────────────────────────────── */}
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center">
                <HeartPulse className="w-3.5 h-3.5 mr-1.5" /> B. Naturaleza y Ubicación de la Lesión
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                <ChartCard id="chart-causal-naturaleza" title="Naturaleza de Lesión / Daño" icon={HeartPulse} iconColor="text-rose-500" scrollable>
                  {renderHorizBar(generateFieldDistribution(causalInc, 'naturaleza_lesion', 15), '#ec4899')}
                </ChartCard>

                <ChartCard id="chart-causal-parte-cuerpo" title="Parte del Cuerpo Afectada" icon={Users} iconColor="text-teal-500" scrollable>
                  {renderHorizBar(generateFieldDistribution(causalInc, 'parte_cuerpo', 15), '#14b8a6')}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <ChartCard id="chart-causal-ubicacion-lesion" title="Ubicación Lesión (texto libre)" icon={Activity} iconColor="text-cyan-500" scrollable>
                  {renderHorizBar(generateFieldDistribution(causalInc, 'ubicacion_lesion', 15), '#06b6d4')}
                </ChartCard>

                <ChartCard id="chart-causal-diagnostico" title="ART: Diagnóstico (Top 12)" icon={Microscope} iconColor="text-indigo-500" scrollable>
                  {renderHorizBar(generateFieldDistribution(causalInc, 'art_diagnostico', 12), '#6366f1')}
                </ChartCard>
              </div>

              {/* ── BLOQUE C: PERFIL DEL INVOLUCRADO ─────────────────── */}
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1.5" /> C. Perfil del Involucrado
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <ChartCard id="chart-causal-entrenamiento" title="Nivel de Entrenamiento" icon={ShieldCheck} iconColor="text-green-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'nivel_entrenamiento', 8), 240)}
                </ChartCard>

                <ChartCard id="chart-causal-funcion" title="Función / Rol" icon={Users} iconColor="text-blue-500" scrollable>
                  {renderHorizBar(generateFieldDistribution(causalInc, 'funcion', 12), '#3b82f6', 180)}
                </ChartCard>

                <ChartCard id="chart-causal-diagrama" title="Diagrama de Trabajo / Turno" icon={Calendar} iconColor="text-orange-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'diagrama_trabajo', 8), 240)}
                </ChartCard>
              </div>

              {/* ── BLOQUE D: CLASIFICACIÓN ART ───────────────────────── */}
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center">
                <FileCheck className="w-3.5 h-3.5 mr-1.5" /> D. Clasificación ART
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <ChartCard id="chart-art-estado" title="ART: Estado" icon={CheckCircle2} iconColor="text-green-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'art_estado', 6), 220)}
                </ChartCard>

                <ChartCard id="chart-art-gravedad" title="ART: Gravedad" icon={AlertTriangle} iconColor="text-red-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'art_gravedad', 6), 220)}
                </ChartCard>

                <ChartCard id="chart-art-instalaciones" title="Instalaciones Propias / Cliente" icon={ShieldCheck} iconColor="text-slate-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'instalacion_tipo', 6), 220)}
                </ChartCard>

                <ChartCard id="chart-art-investigacion" title="Requiere Investigación Final" icon={Microscope} iconColor="text-amber-500">
                  {renderDonut(
                    (() => {
                      const si = causalInc.filter(i => i.requiere_investigacion === true).length;
                      const no = causalInc.filter(i => i.requiere_investigacion === false).length;
                      const nd = causalInc.filter(i => i.requiere_investigacion === undefined).length;
                      return [
                        ...(si > 0 ? [{ name: 'SI', count: si }] : []),
                        ...(no > 0 ? [{ name: 'NO', count: no }] : []),
                        ...(nd > 0 ? [{ name: 'Sin dato', count: nd }] : []),
                      ];
                    })(),
                    220
                  )}
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                <ChartCard id="chart-art-tipo-siniestro" title="ART: Tipo Siniestro" icon={Scale} iconColor="text-purple-500">
                  {renderHorizBar(generateFieldDistribution(causalInc, 'art_tipo_siniestro', 10), '#8b5cf6')}
                </ChartCard>

                <ChartCard id="chart-art-motivo-alta" title="ART: Motivo de Alta" icon={TrendingDown} iconColor="text-emerald-500">
                  {renderDonut(generateFieldDistribution(causalInc, 'art_motivo_alta', 8), 240)}
                </ChartCard>
              </div>

              {/* ── BLOQUE E: TIEMPOS ART ─────────────────────────────── */}
              <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-3 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1.5" /> E. Tiempos de Gestión ART
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <ChartCard id="chart-art-dias-denuncia" title="Días entre Siniestro y Fecha de Denuncia ART (SLG-24h detalle)" icon={Clock} iconColor="text-blue-500">
                  {(() => {
                    const distData = generateDaysToReportDistribution(causalInc);
                    const hasVal = distData.some(d => d.count > 0);
                    if (!hasVal) return <NoData />;
                    const segColors: Record<string, string> = {
                      '≤1 día': '#10b981', '2 días': '#f59e0b', '3-7 días': '#f97316', '>7 días': '#ef4444', 'Sin fecha': '#d1d5db'
                    };
                    return (
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={distData} margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="bucket" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#374151' }} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                            formatter={(v: any) => [v, 'Incidentes']}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40} label={{ position: 'top', fontSize: 11, fill: '#374151', fontWeight: 600 }}>
                            {distData.map((d, idx) => (
                              <Cell key={idx} fill={segColors[d.bucket] ?? '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </ChartCard>
              </div>
            </div>
          </div>
        );
      })()}

       <div id="chart-vial-module" className="bg-slate-50 border border-slate-200 rounded-xl p-6">
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
