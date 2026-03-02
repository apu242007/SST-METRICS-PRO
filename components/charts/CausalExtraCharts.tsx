/**
 * CausalExtraCharts.tsx
 * Complementary charts for the Causal / ART section of Dashboard.
 *
 * Exports (each is a self-contained component):
 *   CausalKPIRow         – row of 6 KPI cards
 *   FactorHumanoParetoChart – Chart C: Factor Humano Pareto
 *   CondicionActoMatrix  – Chart E: Condición Peligrosa × Acto Inseguro 2×2
 *   GravedadMensualChart – Chart F: Gravedad por mes (stacked bars)
 *   InvestigacionTable   – Chart I: tabla de incidentes que requieren investigación
 *   ARTGestionChart      – Chart J: distribución de días perdidos por gravedad ART
 *
 * All components receive already-normalised incidents (output of normalizeCausalIncidents).
 * They do NOT call hooks at module level — safe to use inside Dashboard's render scope.
 */
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Legend, ResponsiveContainer, Cell, ComposedChart, Line,
  ReferenceLine, ScatterChart, Scatter, ZAxis, LabelList,
} from 'recharts';
import { Incident } from '../../types';
import {
  truncateLabel, gravedadColor, GRAVEDAD_COLORS,
} from '../../utils/causalNormalizers';
import {
  AlertTriangle, ShieldCheck, CheckCircle2, Users, Activity,
  Microscope, FileWarning, BarChart2, TrendingDown,
} from 'lucide-react';

// ─── Shared helpers ─────────────────────────────────────────────────────────

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function NoData() {
  return (
    <div className="h-full min-h-[120px] flex items-center justify-center text-gray-300 text-xs italic">
      Sin datos en el período seleccionado
    </div>
  );
}

function ChartCard({
  id, title, icon: Icon, iconColor, children, className = '',
}: {
  id?: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div id={id} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col ${className}`}>
      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center mb-3">
        <Icon className={`w-4 h-4 mr-2 ${iconColor}`} />
        {title}
      </h4>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Count occurrences of a string field, returns sorted desc array */
function freq(incidents: Incident[], field: keyof Incident, topN = 99): { name: string; count: number }[] {
  const map: Record<string, number> = {};
  incidents.forEach(i => {
    const v = i[field];
    if (v == null || v === '' || v === false || v === true) return;
    const s = String(v).trim();
    if (!s || s === '-' || s.toLowerCase() === 'n/a') return;
    map[s] = (map[s] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ─── CausalKPIRow ────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ElementType;
  alert?: boolean;
}

function KPICard({ label, value, sub, color, icon: Icon, alert }: KPICardProps) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 flex flex-col gap-1 ${alert ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide leading-none">{label}</span>
        {alert && <span className="ml-auto text-amber-500 text-[9px] font-bold animate-pulse">● alerta</span>}
      </div>
      <span className="text-2xl font-extrabold text-gray-800 leading-none">{value}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
}

export function CausalKPIRow({ incidents }: { incidents: Incident[] }) {
  const total = incidents.length;
  if (total === 0) return null;

  // % Acto inseguro
  const siActo = incidents.filter(i => i.acto_inseguro === 'Sí').length;
  const pctActo = total > 0 ? Math.round((siActo / total) * 100) : 0;

  // % Condición peligrosa
  const siCP = incidents.filter(i => i.condicion_peligrosa === 'Sí').length;
  const pctCP = total > 0 ? Math.round((siCP / total) * 100) : 0;

  // % Instalaciones propias
  const propias = incidents.filter(i => i.instalacion_tipo === 'Propias').length;
  const pctPropias = total > 0 ? Math.round((propias / total) * 100) : 0;

  // Forma más frecuente (combined forma_ocurrencia + art_forma_ocurrencia)
  const formaMap: Record<string, number> = {};
  incidents.forEach(i => {
    for (const f of [i.forma_ocurrencia, i.art_forma_ocurrencia]) {
      if (f && f.trim()) formaMap[f.trim()] = (formaMap[f.trim()] || 0) + 1;
    }
  });
  const topForma = Object.entries(formaMap).sort((a, b) => b[1] - a[1])[0];

  // Parte del cuerpo más afectada
  const topParte = freq(incidents, 'parte_cuerpo', 1)[0];

  // Requieren investigación
  const reqInv = incidents.filter(i => i.requiere_investigacion === true).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
      <KPICard
        label="Acto Inseguro"
        value={`${pctActo}%`}
        sub={`${siActo} de ${total} incidentes`}
        color="text-orange-500"
        icon={AlertTriangle}
      />
      <KPICard
        label="Cond. Peligrosa"
        value={`${pctCP}%`}
        sub={`${siCP} de ${total} incidentes`}
        color="text-yellow-500"
        icon={ShieldCheck}
      />
      <KPICard
        label="Inst. Propias"
        value={`${pctPropias}%`}
        sub={`${propias} de ${total}`}
        color="text-slate-500"
        icon={CheckCircle2}
      />
      <KPICard
        label="Forma más frecuente"
        value={topForma ? String(topForma[1]) : '—'}
        sub={topForma ? truncateLabel(topForma[0], 32) : 'Sin datos'}
        color="text-blue-500"
        icon={Activity}
      />
      <KPICard
        label="Parte más afectada"
        value={topParte ? String(topParte.count) : '—'}
        sub={topParte ? truncateLabel(topParte.name, 28) : 'Sin datos'}
        color="text-teal-500"
        icon={Users}
      />
      <KPICard
        label="Req. Investigación"
        value={reqInv}
        sub={reqInv > 0 ? 'pendientes de cierre' : 'ninguna pendiente'}
        color={reqInv > 0 ? 'text-amber-500' : 'text-gray-400'}
        icon={FileWarning}
        alert={reqInv > 0}
      />
    </div>
  );
}

// ─── Chart C — Factor Humano Pareto ─────────────────────────────────────────

export function FactorHumanoParetoChart({ incidents }: { incidents: Incident[] }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    incidents.forEach(i => {
      for (const f of [i.factor_humano, i.factor_humano2]) {
        if (f && f !== 'No aplica') {
          map[f] = (map[f] || 0) + 1;
        }
      }
    });
    // Dedup: if both factor_humano and factor_humano2 are the same for the same incident,
    // count only once. Above we're double-counting identical values for same incident —
    // let's count unique incidents per category instead:
    const mapUniq: Record<string, number> = {};
    incidents.forEach(i => {
      const cats = new Set([i.factor_humano, i.factor_humano2].filter(f => f && f !== 'No aplica') as string[]);
      cats.forEach(c => { mapUniq[c] = (mapUniq[c] || 0) + 1; });
    });

    const sorted = Object.entries(mapUniq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const total = sorted.reduce((acc, d) => acc + d.count, 0);
    let cum = 0;
    return sorted.map(d => {
      cum += d.count;
      return { ...d, pct: Math.round((cum / total) * 100), label: truncateLabel(d.name, 32) };
    });
  }, [incidents]);

  if (data.length === 0) return <NoData />;

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ left: 4, right: 32, top: 8, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          fontSize={9}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tick={{ fill: '#6b7280' }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          yAxisId="left"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9ca3af' }}
          allowDecimals={false}
          domain={[0, maxCount + 1]}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9ca3af' }}
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
        />
        <RTooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(v: any, name?: string) =>
            name === '% acumulado' ? [`${v}%`, name] : [v, name]
          }
          labelFormatter={(_: any, payload: readonly any[]) =>
            payload?.[0]?.payload?.name ?? ''
          }
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
        <Bar yAxisId="left" dataKey="count" name="Incidentes" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="pct"
          name="% acumulado"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ r: 3, fill: '#f59e0b' }}
        />
        <ReferenceLine yAxisId="right" y={80} stroke="#ef4444" strokeDasharray="4 4"
          label={{ value: '80%', position: 'right', fontSize: 9, fill: '#ef4444' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Chart E — Condición Peligrosa × Acto Inseguro 2×2 ────────────────────

type Quad = { label: string; desc: string; textCls: string; bg: string; border: string; count: number; pct: string };

export function CondicionActoMatrix({ incidents }: { incidents: Incident[] }) {
  const total = incidents.length;

  const quads = useMemo((): Quad[] => {
    let siSi = 0, noSi = 0, siNo = 0, noNo = 0;
    incidents.forEach(i => {
      const cp = i.condicion_peligrosa === 'Sí';
      const ai = i.acto_inseguro === 'Sí';
      if (cp && ai)  siSi++;
      else if (!cp && ai) noSi++;
      else if (cp && !ai) siNo++;
      else noNo++;
    });
    const p = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%';
    return [
      { label: 'CP ✓  AI ✓',  desc: 'Cond. Peligrosa + Acto Inseguro',       textCls: 'text-white',     bg: 'bg-red-500',     border: 'border-red-600',     count: siSi, pct: p(siSi) },
      { label: 'CP ✗  AI ✓',  desc: 'Sólo Acto Inseguro (factor humano)',     textCls: 'text-white',     bg: 'bg-orange-400',  border: 'border-orange-500',  count: noSi, pct: p(noSi) },
      { label: 'CP ✓  AI ✗',  desc: 'Sólo Condición Peligrosa (infraestr.)', textCls: 'text-white',     bg: 'bg-yellow-400',  border: 'border-yellow-500',  count: siNo, pct: p(siNo) },
      { label: 'CP ✗  AI ✗',  desc: 'Sin causa identificada',                 textCls: 'text-gray-700',  bg: 'bg-emerald-100', border: 'border-emerald-400', count: noNo, pct: p(noNo) },
    ];
  }, [incidents, total]);

  if (total === 0) return <NoData />;

  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-[10px] text-gray-400 mb-1">
        CP = Condición Peligrosa · AI = Acto Inseguro · Total: <strong>{total}</strong>
      </p>
      <div className="grid grid-cols-2 gap-3 flex-1">
        {quads.map(q => (
          <div
            key={q.label}
            className={`${q.bg} ${q.border} border-2 rounded-xl p-4 flex flex-col items-center justify-center gap-1 shadow-sm`}
          >
            <span className={`text-3xl font-black ${q.textCls}`}>{q.count}</span>
            <span className={`text-sm font-bold ${q.textCls}`}>{q.pct}</span>
            <span className={`text-[10px] font-bold mt-1 text-center ${q.textCls}`}>{q.label}</span>
            <span className={`text-[9px] text-center opacity-80 ${q.textCls}`}>{q.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart F — Gravedad por mes (stacked bars) ──────────────────────────────

export function GravedadMensualChart({ incidents }: { incidents: Incident[] }) {
  const { data, gravedades } = useMemo(() => {
    // Map: "YYYY-MM" → { gravedad → count }
    const monthMap: Record<string, Record<string, number>> = {};
    const gravedadSet = new Set<string>();

    incidents.forEach(i => {
      if (!i.fecha_evento) return;
      const ym = i.fecha_evento.substring(0, 7); // YYYY-MM
      const g = (i.art_gravedad && i.art_gravedad.trim()) ? i.art_gravedad : 'Sin dato';
      gravedadSet.add(g);
      if (!monthMap[ym]) monthMap[ym] = {};
      monthMap[ym][g] = (monthMap[ym][g] || 0) + 1;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    const gravedades = Array.from(gravedadSet).sort();

    const data = sortedMonths.map(ym => {
      const row: Record<string, string | number> = {};
      const [yyyy, mm] = ym.split('-');
      row.mes = `${MONTHS_ES[Number(mm) - 1]} ${yyyy.slice(2)}`;
      gravedades.forEach(g => { row[g] = monthMap[ym][g] ?? 0; });
      return row;
    });

    return { data, gravedades };
  }, [incidents]);

  if (data.length === 0) return <NoData />;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="mes"
          fontSize={10}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tick={{ fill: '#6b7280' }}
        />
        <YAxis
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9ca3af' }}
          allowDecimals={false}
        />
        <RTooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }}
          formatter={(v: string) => truncateLabel(v, 24)}
        />
        {gravedades.map(g => (
          <Bar key={g} dataKey={g} stackId="a" fill={gravedadColor(g)} radius={g === gravedades[gravedades.length - 1] ? [4, 4, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Chart I — Tabla de incidentes que requieren investigación ───────────────

export function InvestigacionTable({ incidents, onSelectIncident }: {
  incidents: Incident[];
  onSelectIncident?: (id: string) => void;
}) {
  const pending = useMemo(
    () => incidents.filter(i => i.requiere_investigacion === true)
               .sort((a, b) => (b.fecha_evento ?? '').localeCompare(a.fecha_evento ?? '')),
    [incidents]
  );

  if (pending.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span className="text-xs text-emerald-700 font-semibold">No hay investigaciones pendientes en el período seleccionado.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 mb-2">
        <FileWarning className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-bold text-amber-700">{pending.length} incidente{pending.length !== 1 ? 's' : ''} requiere{pending.length === 1 ? '' : 'n'} investigación final</span>
      </div>
      <table className="w-full text-[10px] border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
            <th className="px-2 py-1.5 text-left border-b border-gray-200">Fecha</th>
            <th className="px-2 py-1.5 text-left border-b border-gray-200">Sitio</th>
            <th className="px-2 py-1.5 text-left border-b border-gray-200">Forma Ocurrencia</th>
            <th className="px-2 py-1.5 text-left border-b border-gray-200">Factor Humano</th>
            <th className="px-2 py-1.5 text-left border-b border-gray-200">Gravedad</th>
          </tr>
        </thead>
        <tbody>
          {pending.map((i, idx) => {
            const grav = (i.art_gravedad && i.art_gravedad !== 'Sin dato') ? i.art_gravedad : (i.naturaleza_lesion ?? '—');
            const gravColor =
              /leve/i.test(grav) ? 'text-emerald-600 bg-emerald-50' :
              /moderada/i.test(grav) ? 'text-amber-600 bg-amber-50' :
              /grave/i.test(grav) ? 'text-red-600 bg-red-50' :
              'text-gray-500 bg-gray-50';
            return (
              <tr
                key={i.incident_id}
                className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${onSelectIncident ? 'cursor-pointer hover:bg-amber-50' : ''}`}
                onClick={() => onSelectIncident?.(i.incident_id)}
              >
                <td className="px-2 py-1.5 font-mono text-gray-600">{i.fecha_evento ?? '—'}</td>
                <td className="px-2 py-1.5 text-gray-700 truncate max-w-[80px]">{i.site}</td>
                <td className="px-2 py-1.5 text-gray-700 max-w-[180px]">
                  <span title={i.forma_ocurrencia}>{truncateLabel(i.forma_ocurrencia ?? '—', 36)}</span>
                </td>
                <td className="px-2 py-1.5 text-gray-600 max-w-[140px]">
                  <span title={i.factor_humano}>{truncateLabel(i.factor_humano ?? '—', 28)}</span>
                </td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${gravColor}`}>{grav}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Chart J — Distribución de días de gestión ART por gravedad ─────────────
// NOTE: art_fecha_alta_definitiva no está en la interfaz Incident.
// Usamos days_away como proxy de duración del caso (días perdidos declarados).
// TODO: agregar art_fecha_alta_definitiva a types.ts + importHelpers para un Gantt real.

const DURATION_BUCKETS = ['0 días','1-7 días','8-30 días','31-90 días','>90 días'];

function bucketDays(d: number): string {
  if (d <= 0) return '0 días';
  if (d <= 7) return '1-7 días';
  if (d <= 30) return '8-30 días';
  if (d <= 90) return '31-90 días';
  return '>90 días';
}

export function ARTGestionChart({ incidents }: { incidents: Incident[] }) {
  const { data, gravedades, avgDays, medianDays } = useMemo(() => {
    // Only incidents with ART data (have an art_gravedad or days_away > 0)
    const artInc = incidents.filter(i =>
      (i.days_away != null && i.days_away > 0) || i.art_gravedad
    );

    const allDays = artInc.map(i => i.days_away ?? 0).filter(d => d > 0).sort((a, b) => a - b);
    const avgDays = allDays.length > 0
      ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length)
      : 0;
    const medianDays = allDays.length > 0
      ? allDays[Math.floor(allDays.length / 2)]
      : 0;

    const gravedadSet = new Set<string>();
    // bucket → gravedad → count
    const bucketMap: Record<string, Record<string, number>> = {};
    DURATION_BUCKETS.forEach(b => { bucketMap[b] = {}; });

    artInc.forEach(i => {
      const g = (i.art_gravedad && i.art_gravedad !== 'Sin dato') ? i.art_gravedad : 'Sin dato';
      gravedadSet.add(g);
      const b = bucketDays(i.days_away ?? 0);
      bucketMap[b][g] = (bucketMap[b][g] || 0) + 1;
    });

    const gravedades = Array.from(gravedadSet).sort();
    const data = DURATION_BUCKETS.map(bucket => {
      const row: Record<string, string | number> = { bucket };
      gravedades.forEach(g => { row[g] = bucketMap[bucket][g] ?? 0; });
      return row;
    });

    return { data, gravedades, avgDays, medianDays };
  }, [incidents]);

  const hasData = data.some(d => Object.entries(d).some(([k, v]) => k !== 'bucket' && Number(v) > 0));
  if (!hasData) return <NoData />;

  return (
    <div>
      {/* Summary stats */}
      <div className="flex gap-4 mb-3">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Promedio días perdidos</p>
          <p className="text-xl font-extrabold text-blue-700">{avgDays} <span className="text-xs font-normal text-blue-400">días</span></p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
          <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wide">Mediana días perdidos</p>
          <p className="text-xl font-extrabold text-purple-700">{medianDays} <span className="text-xs font-normal text-purple-400">días</span></p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 ml-auto text-[9px] text-gray-400 italic flex items-center">
          Proxy: días_away · TODO: agregar fecha_alta_definitiva para Gantt real
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="bucket" fontSize={10} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#6b7280' }} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af' }} allowDecimals={false} />
          <RTooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 9 }} formatter={(v: string) => truncateLabel(v, 24)} />
          {gravedades.map(g => (
            <Bar key={g} dataKey={g} stackId="a" fill={gravedadColor(g)} radius={g === gravedades[gravedades.length - 1] ? [4, 4, 0, 0] : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
