
import React, { useState, useMemo } from 'react';
import { Incident } from '../types';
import { MONTHS } from '../constants';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Filter, Download, History, MapPin, AlertTriangle, Info, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CalendarViewProps {
  incidents: Incident[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ incidents }) => {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(0); // 0 = Jan
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
  
  // Filters
  const [filterSite, setFilterSite] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [showPotential, setShowPotential] = useState(true);
  const [onlyWithIncidents, setOnlyWithIncidents] = useState(false);

  // --- 1. DATA PREPARATION (Memoized) ---
  
  const { uniqueSites, uniqueTypes } = useMemo(() => {
      const sites = Array.from(new Set(incidents.map(i => i.site))).sort();
      const types = Array.from(new Set(incidents.map(i => i.type))).sort();
      return { uniqueSites: sites, uniqueTypes: types };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
      return incidents.filter(i => {
          if (filterSite !== 'ALL' && i.site !== filterSite) return false;
          if (filterType !== 'ALL' && i.type !== filterType) return false;
          return true;
      });
  }, [incidents, filterSite, filterType]);

  // Indexed by Date (YYYY-MM-DD) -> Incidents[]
  const calendarMap = useMemo(() => {
      const map: Record<string, Incident[]> = {};
      filteredIncidents.forEach(inc => {
          if (!inc.fecha_evento) return;
          if (!map[inc.fecha_evento]) map[inc.fecha_evento] = [];
          map[inc.fecha_evento].push(inc);
      });
      return map;
  }, [filteredIncidents]);

  // --- 2. "ON THIS DAY" LOGIC ---
  const historicalData = useMemo(() => {
      if (!selectedDate) return { count: 0, incidents: [] };
      
      const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
      const targetMMDD = `${String(selMonth).padStart(2, '0')}-${String(selDay).padStart(2, '0')}`;
      
      // Find matches: Same MM-DD, but Year < Current Selected Calendar Year (or just different year)
      // Usually "On This Day" implies past years.
      const history = incidents.filter(i => {
          if (!i.fecha_evento) return false;
          // Check Month-Day match
          const matchesDate = i.fecha_evento.endsWith(targetMMDD);
          // Check Year is strictly before the calendar's year context (or simply not this specific date)
          // Let's show ALL years except the exact selected date to see patterns
          const differentDate = i.fecha_evento !== selectedDate; 
          
          return matchesDate && differentDate;
      });

      return {
          count: history.length,
          incidents: history.sort((a,b) => b.year - a.year) // Newest first
      };
  }, [selectedDate, incidents]); // Note: "On This Day" usually ignores filters to show global context, or use filteredIncidents if preferred. Using 'incidents' for broader context.

  // --- 3. HELPER FUNCTIONS ---

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
      let day = new Date(year, month, 1).getDay();
      // Shift to Monday start: Sun(0) -> 6, Mon(1) -> 0
      return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => {
      if (currentMonth === 0) {
          setCurrentMonth(11);
          setCurrentYear(prev => prev - 1);
      } else {
          setCurrentMonth(prev => prev - 1);
      }
      setSelectedDate(null);
  };

  const handleNextMonth = () => {
      if (currentMonth === 11) {
          setCurrentMonth(0);
          setCurrentYear(prev => prev + 1);
      } else {
          setCurrentMonth(prev => prev + 1);
      }
      setSelectedDate(null);
  };

  const handleExportDay = (date: string, data: Incident[]) => {
      const ws = XLSX.utils.json_to_sheet(data.map(i => ({
          ID: i.incident_id,
          Fecha: i.fecha_evento,
          Sitio: i.site,
          Tipo: i.type,
          Severidad: i.potential_risk,
          Descripción: i.description
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incidentes_Dia");
      XLSX.writeFile(wb, `Incidentes_${date}.xlsx`);
  };

  // Color helper based on severity/potentiality
  const getSeverityColor = (risk: string) => {
      const r = (risk || '').toLowerCase();
      if (r.includes('alta') || r.includes('high')) return 'bg-red-500';
      if (r.includes('media') || r.includes('medium')) return 'bg-orange-400';
      return 'bg-blue-400';
  };

  // --- 4. RENDER ---

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startOffset = getFirstDayOfMonth(currentYear, currentMonth);
  const totalSlots = Math.ceil((daysInMonth + startOffset) / 7) * 7;

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
        
        {/* Header Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center space-x-4">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronLeft className="w-5 h-5 text-gray-600"/></button>
                    <span className="px-4 font-bold text-gray-800 min-w-[140px] text-center select-none">
                        {MONTHS[currentMonth]} {currentYear}
                    </span>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronRight className="w-5 h-5 text-gray-600"/></button>
                </div>
                <button 
                    onClick={() => { setCurrentYear(new Date().getFullYear()); setCurrentMonth(new Date().getMonth()); }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                >
                    Ir a Hoy
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center text-gray-500 mr-2">
                    <Filter className="w-4 h-4 mr-1" />
                    <span className="text-xs font-bold uppercase">Filtros:</span>
                </div>
                <select 
                    value={filterSite} 
                    onChange={e => setFilterSite(e.target.value)}
                    className="text-xs border-gray-300 rounded shadow-sm py-1.5 pl-2 pr-6"
                >
                    <option value="ALL">Todos los Sitios</option>
                    {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)}
                    className="text-xs border-gray-300 rounded shadow-sm py-1.5 pl-2 pr-6 max-w-[150px]"
                >
                    <option value="ALL">Todos los Tipos</option>
                    {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="w-px h-6 bg-gray-200 mx-2"></div>
                <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={showPotential} onChange={e => setShowPotential(e.target.checked)} className="rounded text-blue-600"/>
                    <span>Ver Severidad</span>
                </label>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[600px]">
            
            {/* CALENDAR GRID */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {/* Days Header */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">
                            {d}
                        </div>
                    ))}
                </div>
                
                {/* Grid Body */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200">
                    {Array.from({ length: totalSlots }).map((_, idx) => {
                        const dayNumber = idx - startOffset + 1;
                        const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
                        
                        if (!isValidDay) return <div key={idx} className="bg-gray-50 min-h-[80px]"></div>;

                        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                        const dayIncidents = calendarMap[dateKey] || [];
                        const isSelected = selectedDate === dateKey;
                        const isToday = dateKey === new Date().toISOString().split('T')[0];

                        if (onlyWithIncidents && dayIncidents.length === 0) return <div key={idx} className="bg-white min-h-[80px] opacity-50"></div>;

                        return (
                            <div 
                                key={dateKey}
                                onClick={() => setSelectedDate(dateKey)}
                                className={`bg-white min-h-[100px] p-2 relative cursor-pointer hover:bg-blue-50 transition-colors flex flex-col ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>
                                        {dayNumber}
                                    </span>
                                    {dayIncidents.length > 0 && (
                                        <span className="text-[10px] font-bold bg-gray-100 px-1.5 rounded text-gray-600">
                                            {dayIncidents.length}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Incident Dots/Bars */}
                                <div className="mt-2 space-y-1 overflow-hidden">
                                    {dayIncidents.slice(0, 4).map((inc, i) => (
                                        <div key={inc.incident_id} className="flex items-center">
                                            {showPotential && (
                                                <div className={`w-2 h-2 rounded-full mr-1.5 flex-shrink-0 ${getSeverityColor(inc.potential_risk)}`} />
                                            )}
                                            <span className="text-[9px] text-gray-600 truncate leading-tight w-full">
                                                {inc.type}
                                            </span>
                                        </div>
                                    ))}
                                    {dayIncidents.length > 4 && (
                                        <div className="text-[9px] text-gray-400 pl-3">
                                            + {dayIncidents.length - 4} más...
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SIDEBAR: DETAILS & ON THIS DAY */}
            <div className="w-full lg:w-96 flex flex-col space-y-4">
                
                {/* 1. Selected Day Details */}
                <div className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col transition-all duration-300 ${selectedDate ? 'flex-1' : 'h-32'}`}>
                    <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <CalIcon className="w-4 h-4 mr-2 text-blue-600" />
                            {selectedDate ? `Incidentes del ${selectedDate.split('-').reverse().join('/')}` : 'Seleccione un día'}
                        </h3>
                        {selectedDate && (calendarMap[selectedDate]?.length || 0) > 0 && (
                            <button onClick={() => handleExportDay(selectedDate, calendarMap[selectedDate])} className="text-gray-400 hover:text-green-600">
                                <Download className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {!selectedDate ? (
                            <div className="text-center text-gray-400 mt-4 flex flex-col items-center">
                                <MapPin className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-xs">Haga click en un día del calendario para ver detalles.</p>
                            </div>
                        ) : (calendarMap[selectedDate] || []).length === 0 ? (
                            <p className="text-sm text-gray-500 italic text-center py-4">Sin incidentes registrados este día.</p>
                        ) : (
                            <div className="space-y-3">
                                {calendarMap[selectedDate].map(inc => (
                                    <div key={inc.incident_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{inc.site}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${getSeverityColor(inc.potential_risk)}`}>
                                                {inc.potential_risk || 'N/A'}
                                            </span>
                                        </div>
                                        <h4 className="text-xs font-bold text-gray-800 mb-1">{inc.type}</h4>
                                        <p className="text-xs text-gray-600 line-clamp-2" title={inc.description}>{inc.description}</p>
                                        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between items-center">
                                            <span className="text-[9px] text-gray-400 font-mono">{inc.incident_id}</span>
                                            {inc.recordable_osha && <span className="text-[9px] text-red-600 font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> OSHA</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. ON THIS DAY (Historical) */}
                {selectedDate && (
                    <div className="bg-slate-900 text-white rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[400px] animate-in slide-in-from-right-5">
                        <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-sm flex items-center text-amber-400">
                                    <History className="w-4 h-4 mr-2" />
                                    Un día como hoy...
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    ({selectedDate.split('-')[2]}/{selectedDate.split('-')[1]}) en años anteriores
                                </p>
                            </div>
                            <span className="bg-slate-700 px-2 py-1 rounded text-xs font-mono font-bold">
                                {historicalData.count}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {historicalData.count === 0 ? (
                                <div className="text-center py-6 text-slate-500 text-xs">
                                    <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                    No hay registros históricos para esta fecha.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historicalData.incidents.map(inc => (
                                        <div key={inc.incident_id} className="relative pl-4 border-l-2 border-slate-600">
                                            <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-900"></div>
                                            <div className="mb-1 flex justify-between items-baseline">
                                                <span className="text-sm font-bold text-blue-300">{inc.year}</span>
                                                <span className="text-[10px] text-slate-400">{inc.site}</span>
                                            </div>
                                            <p className="text-xs text-slate-300 font-medium mb-1">{inc.type}</p>
                                            <p className="text-[10px] text-slate-500 line-clamp-2 italic">"{inc.description}"</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
