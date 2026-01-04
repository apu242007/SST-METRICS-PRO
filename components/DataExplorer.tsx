
import React, { useState, useMemo, useEffect } from 'react';
import { Incident } from '../types';
import { Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Eye, Settings, AlertCircle, Zap, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseStrictDate } from '../utils/importHelpers';
import { IncidentDetailView } from './IncidentDetailView';

interface DataExplorerProps {
  incidents: Incident[];
  mode: 'raw' | 'normalized';
  onUpdateIncident?: (updated: Incident) => void;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ 
    incidents, mode, onUpdateIncident 
}) => {
  // Local State for View Configuration
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50); 
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isColSelectorOpen, setIsColSelectorOpen] = useState(false);

  // --- PERFORMANCE OPTIMIZATION: COLUMNS DEFINITION ---
  const allColumns = useMemo(() => {
      if (mode === 'raw') {
          const sampleSize = Math.min(incidents.length, 10);
          const keys = new Set<string>();
          for(let i=0; i<sampleSize; i++) {
              try {
                  const raw = JSON.parse(incidents[i].raw_json || '{}');
                  Object.keys(raw).forEach(k => keys.add(k));
              } catch {}
          }
          return Array.from(keys).sort();
      } else {
          return [
            "incident_id", "sitio", "anio", "mes", "tipo_incidente", 
            "fecha_evento", "fecha_evento_sugerida", 
            "recordable", "lti", 
            "transito_laboral", "in_itinere",
            "days_away", "needs_review"
        ];
      }
  }, [incidents, mode]);

  // Initialize Visible Columns once
  useEffect(() => {
      setVisibleColumns(allColumns.slice(0, 9)); 
  }, [mode, allColumns.length]);

  // --- PERFORMANCE OPTIMIZATION: SLICE-THEN-MAP ---
  const sortedIncidents = useMemo(() => {
      if (!sortConfig) return incidents;
      
      const key = sortConfig.key;
      const dir = sortConfig.direction === 'asc' ? 1 : -1;

      return [...incidents].sort((a, b) => {
          let aVal: any = '';
          let bVal: any = '';

          if (mode === 'normalized') {
               if (key === 'sitio') { aVal = a.site; bVal = b.site; }
               else if (key === 'anio') { aVal = a.year; bVal = b.year; }
               else if (key === 'tipo_incidente') { aVal = a.type; bVal = b.type; }
               else if (key === 'incident_id') { aVal = a.incident_id; bVal = b.incident_id; }
               else { aVal = ''; bVal = ''; }
          } else {
              aVal = a.incident_id; bVal = b.incident_id;
          }

          if (aVal < bVal) return -1 * dir;
          if (aVal > bVal) return 1 * dir;
          return 0;
      });
  }, [incidents, sortConfig, mode]);

  const totalPages = Math.ceil(sortedIncidents.length / rowsPerPage);
  
  // THE GOLDEN SLICE
  const visibleRows = useMemo(() => {
      const start = (currentPage - 1) * rowsPerPage;
      const slice = sortedIncidents.slice(start, start + rowsPerPage);

      return slice.map(i => {
          if (mode === 'raw') {
             try {
                 const raw = i.raw_json ? JSON.parse(i.raw_json) : {};
                 return { ...raw, _sys_id: i.incident_id };
             } catch { return { _sys_id: i.incident_id, Error: "Invalid JSON" }; }
          } else {
             // Normalized logic
             let suggestedDate = null;
             let suggestedDays = null;
             try {
                const raw = JSON.parse(i.raw_json || '{}');
                const artDate = parseStrictDate(raw['Datos ART: FECHA SINIESTRO']);
                const artAlta = parseStrictDate(raw['Datos ART: FECHA ALTA MEDICA DEFINITIVA']);
                if(artDate && artDate !== i.fecha_evento) suggestedDate = artDate;
                if(artDate && artAlta) {
                    const diff = Math.ceil((new Date(artAlta).getTime() - new Date(artDate).getTime()) / (1000 * 3600 * 24));
                    if(diff !== i.days_away) suggestedDays = diff;
                }
             } catch {}

             return {
                incident_id: i.incident_id,
                sitio: i.site,
                anio: i.year,
                mes: i.month,
                tipo_incidente: i.type,
                fecha_evento: i.fecha_evento,
                fecha_evento_sugerida: suggestedDate,
                recordable: i.recordable_osha ? 'Sí' : 'No',
                lti: i.lti_case ? 'Sí' : 'No',
                transito_laboral: i.is_transit_laboral ? 'Sí (IFAT)' : 'No',
                in_itinere: i.is_in_itinere ? 'Sí' : 'No',
                days_away: i.days_away,
                days_away_sugerido: suggestedDays,
                needs_review: !i.is_verified ? 'SIN LÓGICA AUTO' : 'Auto-Confirmado',
                _sys_id: i.incident_id
             };
          }
      });
  }, [sortedIncidents, currentPage, rowsPerPage, mode]);


  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const toggleColumn = (col: string) => {
      setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const handleDownload = () => {
      const dataToExport = sortedIncidents.map(i => {
           if (mode === 'raw') return JSON.parse(i.raw_json || '{}');
           return {
               ID: i.incident_id,
               Sitio: i.site,
               Tipo: i.type,
               Fecha: i.fecha_evento,
               'Tránsito Laboral': i.is_transit_laboral ? 'SI' : 'NO',
               'In Itinere': i.is_in_itinere ? 'SI' : 'NO',
               'Confirmado Automático': i.is_verified ? 'SI' : 'NO'
           };
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, ws, mode === 'raw' ? "RAW_Data" : "Normalized_Data");
      XLSX.writeFile(wb, `SST_Export_${mode}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 flex flex-col">
        {/* Detail Modal */}
        {selectedIncident && (
            <IncidentDetailView 
                incident={selectedIncident}
                rules={[]} 
                onClose={() => setSelectedIncident(null)}
                onSave={(updated) => {
                    if(onUpdateIncident) onUpdateIncident(updated);
                }}
            />
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3">
                <div className="flex items-center text-sm font-medium text-gray-700">
                    <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                    {incidents.length.toLocaleString()} registros
                </div>
                
                {/* Column Selector */}
                <div className="relative">
                    <button 
                        onClick={() => setIsColSelectorOpen(!isColSelectorOpen)}
                        className="flex items-center space-x-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-md"
                    >
                        <Settings className="w-3 h-3" />
                        <span>Columnas Visibles ({visibleColumns.length})</span>
                    </button>
                    {isColSelectorOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-gray-300 shadow-lg rounded-md z-20 p-2">
                            {allColumns.map(col => (
                                <label key={col} className="flex items-center space-x-2 p-1.5 hover:bg-gray-50 cursor-pointer text-xs">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleColumns.includes(col)} 
                                        onChange={() => toggleColumn(col)}
                                        className="rounded text-blue-600"
                                    />
                                    <span className="truncate" title={col}>{col}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-3">
                <button 
                    onClick={handleDownload}
                    className="flex items-center space-x-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-md"
                >
                    <Download className="w-3 h-3" />
                    <span>Descargar Todo</span>
                </button>
            </div>
        </div>

        {/* Table - FULL HEIGHT, NO INTERNAL SCROLL */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
            <div className="w-full overflow-x-auto"> 
                <table className="min-w-full divide-y divide-gray-200 text-xs whitespace-nowrap">
                    <thead className="bg-gray-50">
                        <tr>
                            {visibleColumns.map(col => (
                                <th 
                                    key={col}
                                    onClick={() => handleSort(col)}
                                    className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 border-b border-gray-200"
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col}</span>
                                        {sortConfig?.key === col && (sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3"/> : <ArrowDown className="w-3 h-3"/>)}
                                    </div>
                                </th>
                            ))}
                            <th className="px-4 py-3 text-right font-bold text-gray-500 uppercase border-b border-gray-200 bg-gray-50">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {visibleRows.map((row: any, i) => (
                            <tr key={i} className={`hover:bg-blue-50 transition-colors ${row.needs_review !== 'Auto-Confirmado' && mode === 'normalized' ? 'bg-orange-50' : ''}`}>
                                {visibleColumns.map(col => (
                                    <td key={col} className="px-4 py-2 text-gray-700 border-r border-gray-100 last:border-0 max-w-xs truncate" title={String(row[col])}>
                                        {col === 'needs_review' ? (
                                             row.needs_review !== 'Auto-Confirmado' ? (
                                                <span className="text-orange-600 font-bold flex items-center"><AlertCircle className="w-3 h-3 mr-1"/> {row.needs_review}</span>
                                             ) : (
                                                <span className="text-green-600 font-bold flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Auto</span>
                                             )
                                        ) : row[col]}
                                    </td>
                                ))}
                                <td className="px-4 py-2 text-right border-l border-gray-100">
                                    <button 
                                        onClick={() => {
                                            const original = incidents.find(inc => inc.incident_id === row._sys_id);
                                            if(original) setSelectedIncident(original);
                                        }}
                                        className={`inline-flex items-center px-2 py-1 rounded border text-[10px] font-medium transition-colors ${
                                            mode === 'normalized' && row.needs_review !== 'Auto-Confirmado'
                                            ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {mode === 'normalized' && row.needs_review !== 'Auto-Confirmado' ? (
                                            <><AlertCircle className="w-3 h-3 mr-1"/> Revisar</>
                                        ) : (
                                            <><Eye className="w-3 h-3 mr-1"/> Ver</>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="bg-gray-50 border-t border-gray-200 p-2 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">Filas por pág:</span>
                    <select 
                        value={rowsPerPage} 
                        onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="text-xs border-gray-300 rounded shadow-sm p-1"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={500}>500 (Heavy)</option>
                    </select>
                </div>
                
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">
                        Página {currentPage} de {Math.max(1, totalPages)}
                    </span>
                    <div className="flex rounded-md shadow-sm">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1 border border-gray-300 rounded-l-md bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="p-1 border border-gray-300 rounded-r-md bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
