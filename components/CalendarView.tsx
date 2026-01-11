import React, { useState, useMemo } from 'react';
import { Incident } from '../types';
import { MONTHS } from '../constants';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Filter, Download, History, MapPin, AlertTriangle, Info, X, Zap, FileText, ChevronDown, ChevronUp, Printer, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateSafetyTalk, SafetyTalk } from '../utils/safetyTalkGenerator';
import { exportToPDF } from '../utils/pdfExportService';

interface CalendarViewProps {
  incidents: Incident[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ incidents }) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Filters
  const [filterSite, setFilterSite] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterComCliente, setFilterComCliente] = useState<'All' | 'SI' | 'NO'>('All'); // NEW FILTER
  const [showPotential, setShowPotential] = useState(true);
  
  // Feature State
  const [generatedTalk, setGeneratedTalk] = useState<SafetyTalk | null>(null);
  const [isTalkExpanded, setIsTalkExpanded] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfConfig, setPdfConfig] = useState({
    include2026Table: true,
    includeHistoryTable: true,
    includeTalk: true,
    includeFilters: true
  });

  const { uniqueSites, uniqueTypes } = useMemo(() => {
      const sites = Array.from(new Set(incidents.map(i => i.site))).sort();
      const types = Array.from(new Set(incidents.map(i => i.type))).sort();
      return { uniqueSites: sites, uniqueTypes: types };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
      return incidents.filter(i => {
          if (filterSite !== 'ALL' && i.site !== filterSite) return false;
          if (filterType !== 'ALL' && i.type !== filterType) return false;
          // Note: comCliente filter here is mostly for the Talk generation context, 
          // but we can also filter the view if desired. For now, we keep the view broader
          // and use the filter specifically for the Talk logic as requested.
          return true;
      });
  }, [incidents, filterSite, filterType]);

  const calendarMap = useMemo(() => {
      const map: Record<string, Incident[]> = {};
      filteredIncidents.forEach(inc => {
          if (!inc.fecha_evento) return;
          if (!map[inc.fecha_evento]) map[inc.fecha_evento] = [];
          map[inc.fecha_evento].push(inc);
      });
      return map;
  }, [filteredIncidents]);

  const historicalData = useMemo(() => {
      if (!selectedDate) return { count: 0, incidents: [] };
      const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
      const targetMMDD = `${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
      const history = incidents.filter(i => i.fecha_evento.endsWith(targetMMDD) && i.fecha_evento !== selectedDate);
      return { count: history.length, incidents: history.sort((a,b) => b.year - a.year) };
  }, [selectedDate, incidents]);

  const handleGenerateTalk = () => {
    if (!selectedDate) return;
    // Pass the comCliente filter to the generator
    const talk = generateSafetyTalk(
        selectedDate, 
        calendarMap[selectedDate] || [], 
        historicalData.incidents,
        filterComCliente
    );
    setGeneratedTalk(talk);
    setIsTalkExpanded(true);
  };

  const handleExportPDF = () => {
    if (!selectedDate) return;
    exportToPDF(
        selectedDate, 
        calendarMap[selectedDate] || [], 
        historicalData.incidents, 
        generatedTalk,
        { ...pdfConfig, filters: { site: filterSite, type: filterType } }
    );
    setShowPdfOptions(false);
  };

  const getSeverityColor = (risk: string) => {
      const r = (risk || '').toLowerCase();
      if (r.includes('alta') || r.includes('high')) return 'bg-red-500';
      if (r.includes('media') || r.includes('medium')) return 'bg-orange-400';
      return 'bg-blue-400';
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const totalSlots = Math.ceil((daysInMonth + startOffset) / 7) * 7;

  return (
    <div className="flex flex-col space-y-4 animate-in fade-in duration-500">
        
        {/* PDF Options Modal */}
        {showPdfOptions && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200 my-8">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                        <Printer className="w-5 h-5 mr-2 text-blue-600" /> Opciones de Exportación PDF
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={pdfConfig.include2026Table} onChange={e => setPdfConfig({...pdfConfig, include2026Table: e.target.checked})} className="rounded text-blue-600"/>
                            <span className="text-sm text-gray-700 font-medium">Incluir tabla de incidentes 2026</span>
                        </label>
                        <label className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={pdfConfig.includeHistoryTable} onChange={e => setPdfConfig({...pdfConfig, includeHistoryTable: e.target.checked})} className="rounded text-blue-600"/>
                            <span className="text-sm text-gray-700 font-medium">Incluir tabla histórica (Un día como hoy)</span>
                        </label>
                        <label className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={pdfConfig.includeTalk} onChange={e => setPdfConfig({...pdfConfig, includeTalk: e.target.checked})} className="rounded text-blue-600"/>
                            <span className="text-sm text-gray-700 font-medium">Incluir charla de 5 minutos generada</span>
                        </label>
                        <label className="flex items-center space-x-3 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={pdfConfig.includeFilters} onChange={e => setPdfConfig({...pdfConfig, includeFilters: e.target.checked})} className="rounded text-blue-600"/>
                            <span className="text-sm text-gray-700 font-medium">Incluir filtros activos en portada</span>
                        </label>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button onClick={() => setShowPdfOptions(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                        <button onClick={handleExportPDF} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm">Generar PDF A4</button>
                    </div>
                </div>
            </div>
        )}

        {/* Top Header */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center space-x-4">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button onClick={() => currentMonth === 0 ? (setCurrentMonth(11), setCurrentYear(y => y-1)) : setCurrentMonth(m => m-1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronLeft className="w-5 h-5 text-gray-600"/></button>
                    <span className="px-4 font-bold text-gray-800 min-w-[140px] text-center select-none">{MONTHS[currentMonth]} {currentYear}</span>
                    <button onClick={() => currentMonth === 11 ? (setCurrentMonth(0), setCurrentYear(y => y+1)) : setCurrentMonth(m => m+1)} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronRight className="w-5 h-5 text-gray-600"/></button>
                </div>
                <button onClick={() => { setCurrentYear(new Date().getFullYear()); setCurrentMonth(new Date().getMonth()); }} className="text-xs font-medium text-blue-600 hover:underline">Hoy</button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <select value={filterSite} onChange={e => setFilterSite(e.target.value)} className="text-xs border-gray-300 rounded shadow-sm py-1.5 pl-2 pr-6">
                    <option value="ALL">Todos los Sitios</option>
                    {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs border-gray-300 rounded shadow-sm py-1.5 pl-2 pr-6 max-w-[150px]">
                    <option value="ALL">Todos los Tipos</option>
                    {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                
                {/* COM. CLIENTE FILTER FOR TALK */}
                <select 
                    value={filterComCliente} 
                    onChange={e => setFilterComCliente(e.target.value as any)} 
                    className="text-xs border-gray-300 rounded shadow-sm py-1.5 pl-2 pr-6 bg-yellow-50 text-yellow-900 border-yellow-200 font-medium"
                    title="Afecta el contenido de la Charla de Seguridad"
                >
                    <option value="All">Com. Cliente: Indiferente</option>
                    <option value="SI">Com. Cliente: SI (Incluir)</option>
                    <option value="NO">Com. Cliente: NO (Omitir)</option>
                </select>

                <label className="flex items-center space-x-2 text-xs cursor-pointer select-none ml-2">
                    <input type="checkbox" checked={showPotential} onChange={e => setShowPotential(e.target.checked)} className="rounded text-blue-600"/>
                    <span>Ver Severidad</span>
                </label>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
            {/* GRID */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200">
                    {Array.from({ length: totalSlots }).map((_, idx) => {
                        const dayNumber = idx - startOffset + 1;
                        const isValid = dayNumber > 0 && dayNumber <= daysInMonth;
                        if (!isValid) return <div key={idx} className="bg-gray-50 min-h-[100px]"></div>;

                        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                        const dayIncidents = calendarMap[dateKey] || [];
                        const isSelected = selectedDate === dateKey;

                        return (
                            <div 
                                key={dateKey}
                                onClick={() => { setSelectedDate(dateKey); setGeneratedTalk(null); }}
                                className={`bg-white min-h-[100px] p-2 relative cursor-pointer hover:bg-blue-50 transition-colors flex flex-col ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10' : ''}`}
                            >
                                <span className="text-sm font-medium text-gray-700">{dayNumber}</span>
                                <div className="mt-2 space-y-1">
                                    {dayIncidents.slice(0, 5).map((inc, i) => (
                                        <div key={inc.incident_id} className="flex items-center">
                                            {showPotential && <div className={`w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${getSeverityColor(inc.potential_risk)}`} />}
                                            <span className="text-[8px] text-gray-500 truncate leading-tight">{inc.type}</span>
                                        </div>
                                    ))}
                                    {dayIncidents.length > 5 && <span className="text-[8px] text-gray-400">+{dayIncidents.length-5}</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SIDEBAR - NO INTERNAL SCROLL */}
            <div className="w-full lg:w-[420px] flex flex-col space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
                        <h3 className="font-bold text-gray-800 flex items-center text-sm">
                            <CalIcon className="w-4 h-4 mr-2 text-blue-600" />
                            {selectedDate ? `Resumen ${selectedDate.split('-').reverse().join('/')}` : 'Detalles del día'}
                        </h3>
                        {selectedDate && (
                            <div className="flex space-x-2">
                                <button onClick={() => setShowPdfOptions(true)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Exportar Reporte Diario PDF">
                                    <Printer className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-4 space-y-4">
                        {!selectedDate ? (
                            <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                <MapPin className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-xs">Seleccione una fecha para ver incidentes y generar guion.</p>
                            </div>
                        ) : (
                            <>
                                {/* Charla de 5 Minutos Action */}
                                <div className="bg-blue-600 rounded-lg p-4 shadow-md text-white">
                                    <h4 className="font-bold flex items-center mb-2">
                                        <Zap className="w-5 h-5 mr-2 text-yellow-300" /> Charla de Seguridad
                                    </h4>
                                    {!generatedTalk ? (
                                        <>
                                            <p className="text-xs text-blue-100 mb-4 leading-relaxed">
                                                Genere una charla de 5 minutos basada en los incidentes recientes y el filtro de cliente seleccionado.
                                            </p>
                                            <button onClick={handleGenerateTalk} className="w-full bg-white text-blue-700 font-bold py-2 rounded-md hover:bg-blue-50 transition-colors text-sm">Generar charla de 5 minutos</button>
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="bg-blue-700/50 p-3 rounded-md">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold uppercase text-blue-300">Guion Generado</span>
                                                    <button onClick={() => setIsTalkExpanded(!isTalkExpanded)} className="text-blue-300">
                                                        {isTalkExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                                    </button>
                                                </div>
                                                <p className="text-xs font-bold leading-tight">{generatedTalk.title}</p>
                                            </div>
                                            
                                            {isTalkExpanded && (
                                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                    {/* Apertura */}
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-yellow-300 uppercase mb-1">[0:00-0:30] Apertura</h5>
                                                        <p className="text-xs leading-relaxed text-blue-50">{generatedTalk.whyToday}</p>
                                                    </div>
                                                    
                                                    {/* Riesgos (Situaciones) */}
                                                    {generatedTalk.situations && generatedTalk.situations.length > 0 && (
                                                        <div>
                                                            <h5 className="text-[10px] font-bold text-yellow-300 uppercase mb-1">[0:30-2:00] Qué estamos evitando</h5>
                                                            <ul className="space-y-1.5">
                                                                {generatedTalk.situations.map((m, i) => (
                                                                    <li key={i} className="text-xs leading-tight flex items-start"><span className="mr-2 text-blue-300">•</span> {m}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}

                                                    {/* Controles (Keys) */}
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-yellow-300 uppercase mb-1">[2:00-4:30] Controles Críticos</h5>
                                                        <ul className="space-y-1.5">
                                                            {generatedTalk.keyMessages.map((m, i) => (
                                                                <li key={i} className="text-xs leading-tight flex items-start"><span className="mr-2 text-blue-300">•</span> {m}</li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Procedimientos / Acciones / Com Cliente */}
                                                    <div>
                                                        <h5 className="text-[10px] font-bold text-yellow-300 uppercase mb-1">Procedimientos y Comunicación</h5>
                                                        <ul className="space-y-1.5">
                                                            {generatedTalk.actions.map((a, i) => (
                                                                <li key={i} className="text-xs leading-tight flex items-start"><span className="mr-2 text-green-300">✓</span> {a}</li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    {/* Cierre */}
                                                    <div className="pt-2 border-t border-blue-500">
                                                        <h5 className="text-[10px] font-bold text-yellow-300 uppercase mb-1">[4:30-5:00] Cierre</h5>
                                                        <p className="text-xs leading-relaxed text-blue-50">{generatedTalk.closing}</p>
                                                    </div>

                                                    <div className="pt-2 flex justify-end">
                                                        <button onClick={() => setShowPdfOptions(true)} className="flex items-center text-[10px] bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded">
                                                            <FileText className="w-3 h-3 mr-1"/> PDF
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* On this Day History */}
                                <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                                        <h3 className="font-bold text-xs flex items-center text-amber-400"><History className="w-4 h-4 mr-2" /> Un día como hoy...</h3>
                                        <span className="bg-slate-700 px-2 py-1 rounded text-xs font-mono font-bold">{historicalData.count}</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {historicalData.count === 0 ? (
                                            <div className="text-center py-4 text-slate-500 text-xs italic">Sin registros históricos previos.</div>
                                        ) : (
                                            <div className="space-y-3">
                                                {historicalData.incidents.map(inc => (
                                                    <div key={inc.incident_id} className="relative pl-4 border-l-2 border-slate-600">
                                                        <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-900"></div>
                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                            <span className="text-xs font-bold text-blue-300">{inc.year}</span>
                                                            <span className="text-[9px] text-slate-500 truncate max-w-[100px]">{inc.site}</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-300 font-medium">{inc.type}</p>
                                                        <p className="text-[9px] text-slate-500 line-clamp-1 italic">"{inc.description}"</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Today's List (2026) */}
                                <div>
                                    <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase flex items-center">
                                        <CalIcon className="w-3.5 h-3.5 mr-1.5" /> Incidentes del día
                                    </h4>
                                    <div className="space-y-2">
                                        {(calendarMap[selectedDate] || []).length === 0 ? (
                                            <p className="text-xs text-gray-400 italic">Sin incidentes este día.</p>
                                        ) : (
                                            calendarMap[selectedDate].map(inc => (
                                                <div key={inc.incident_id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-[9px] font-bold text-blue-600">{inc.site}</span>
                                                        <span className={`text-[9px] px-1.5 rounded-full text-white ${getSeverityColor(inc.potential_risk)}`}>{inc.potential_risk}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-800 leading-tight">{inc.type}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};