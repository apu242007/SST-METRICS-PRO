import React, { useState, useMemo } from 'react';
import { Incident, HeatmapData } from '../types';
import { MONTHS } from '../constants';
import { Filter, ArrowDown, ArrowUp, Eye, EyeOff, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HeatmapMatrixProps {
  incidents: Incident[];
}

interface RowData {
    site: string;
    counts: number[];
    total: number;
    lastMonthIndex: number;
}

export const HeatmapMatrix: React.FC<HeatmapMatrixProps> = ({ incidents }) => {
  // --- STATE ---
  const [showValues, setShowValues] = useState(true);
  const [sortBy, setSortBy] = useState<'total' | 'alpha' | 'recent'>('total');
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [limit, setLimit] = useState(15); // Top N
  const [selectedCell, setSelectedCell] = useState<{site: string, month: number, count: number, incidents: Incident[]} | null>(null);

  // --- DATA PROCESSING (Memoized) ---
  const matrixData = useMemo(() => {
    const sites: string[] = (Array.from(new Set(incidents.map(i => i.site))) as string[]).sort();
    
    // 1. Build Base Matrix & Row Stats
    let rows: RowData[] = sites.map(site => {
        const siteIncidents = incidents.filter(i => i.site === site);
        const monthlyCounts = Array(12).fill(0);
        let lastMonthIndex = -1;
        
        siteIncidents.forEach(inc => {
            if(inc.month >= 1 && inc.month <= 12) {
                monthlyCounts[inc.month - 1]++;
                if((inc.month - 1) > lastMonthIndex) lastMonthIndex = inc.month - 1;
            }
        });

        const total = monthlyCounts.reduce((a, b) => a + b, 0);
        return {
            site,
            counts: monthlyCounts,
            total,
            lastMonthIndex
        };
    });

    // 2. Filter
    if (hideZeroRows) {
        rows = rows.filter(r => r.total > 0);
    }

    // 3. Sort
    rows.sort((a, b) => {
        if (sortBy === 'total') return b.total - a.total; // Desc
        if (sortBy === 'recent') return b.lastMonthIndex - a.lastMonthIndex; // Desc
        return a.site.localeCompare(b.site); // Asc
    });

    // 4. Limit
    if (limit < rows.length && limit > 0) {
        rows = rows.slice(0, limit);
    }

    // 5. Calculate Column Totals (after filter/limit)
    const colTotals = Array(12).fill(0);
    rows.forEach(r => {
        r.counts.forEach((val, idx) => colTotals[idx] += val);
    });
    const grandTotal = colTotals.reduce((a, b) => a + b, 0);

    // 6. Calculate Max for Color Scale
    let maxVal = 0;
    rows.forEach(r => r.counts.forEach(v => { if(v > maxVal) maxVal = v; }));

    return { rows, colTotals, grandTotal, maxVal };
  }, [incidents, hideZeroRows, sortBy, limit]);

  // --- HELPERS ---
  const getColor = (value: number, max: number) => {
      if (value === 0) return 'bg-white text-transparent'; // Hide zero text if desired, or lighter gray
      
      // Simple Sequential Blue Scale
      // We map 1..max to a set of classes or dynamic opacity
      // Using Tailwind classes for predictability
      if (value === 1) return 'bg-blue-100 text-blue-800';
      if (value === 2) return 'bg-blue-200 text-blue-900';
      if (value <= 4) return 'bg-blue-400 text-white';
      if (value <= 6) return 'bg-blue-600 text-white';
      return 'bg-blue-800 text-white font-bold';
  };

  const exportCellData = () => {
      if(!selectedCell) return;
      const ws = XLSX.utils.json_to_sheet(selectedCell.incidents.map(i => ({
          ID: i.incident_id,
          Fecha: i.fecha_evento,
          Tipo: i.type,
          Descripcion: i.description,
          Severidad: i.potential_risk
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incidentes");
      XLSX.writeFile(wb, `DrillDown_${selectedCell.site}_${MONTHS[selectedCell.month-1]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
              <h3 className="font-bold text-gray-800 text-lg">Mapa de Calor</h3>
              <p className="text-xs text-gray-500">Incidentes por Sitio/Mes</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
              {/* Toggles */}
              <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-md p-1">
                  <button 
                    onClick={() => setHideZeroRows(!hideZeroRows)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${hideZeroRows ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
                    title="Ocultar sitios sin incidentes"
                  >
                      {hideZeroRows ? 'Con Incidentes' : 'Todos'}
                  </button>
                  <div className="w-px h-4 bg-gray-200"></div>
                  <button 
                    onClick={() => setShowValues(!showValues)}
                    className={`p-1 rounded text-gray-600 hover:bg-gray-100 ${showValues ? 'text-blue-600 bg-blue-50' : ''}`}
                    title="Mostrar/Ocultar Valores"
                  >
                      {showValues ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                  </button>
              </div>

              {/* Sorter */}
              <div className="flex items-center">
                  <span className="text-xs text-gray-500 mr-2 font-medium">Orden:</span>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs border-gray-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500 py-1 pl-2 pr-6"
                  >
                      <option value="total">Mayor Total Anual</option>
                      <option value="recent">Recientes Primero</option>
                      <option value="alpha">Alfabético (A-Z)</option>
                  </select>
              </div>

              {/* Limiter */}
              <div className="flex items-center space-x-2">
                   <span className="text-xs text-gray-500 font-medium">Top:</span>
                   <div className="flex bg-white border border-gray-200 rounded-md">
                       {[10, 20, 50, 0].map(val => (
                           <button 
                                key={val}
                                onClick={() => setLimit(val)}
                                className={`px-2 py-1 text-[10px] first:rounded-l last:rounded-r border-r last:border-r-0 ${limit === val ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                           >
                               {val === 0 ? 'Todo' : val}
                           </button>
                       ))}
                   </div>
              </div>
          </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-end text-xs gap-2">
          <span className="text-gray-400 font-medium">Escala:</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-white border border-gray-200 mr-1"></span> 0</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-blue-100 mr-1"></span> 1</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-blue-200 mr-1"></span> 2</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-blue-400 mr-1"></span> 3-4</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-blue-600 mr-1"></span> 5-6</span>
          <span className="flex items-center"><span className="w-3 h-3 bg-blue-800 mr-1"></span> 7+</span>
      </div>

      {/* Matrix Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-gray-50/50">
          <table className="min-w-full border-collapse text-xs">
              <thead className="bg-white sticky top-0 z-20 shadow-sm">
                  <tr>
                      <th className="sticky left-0 z-30 bg-white p-2 text-left font-bold text-gray-600 border-b border-r border-gray-200 min-w-[150px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          Sitio \ Mes
                      </th>
                      {MONTHS.map((m, i) => (
                          <th key={i} className="p-1 min-w-[40px] text-center font-semibold text-gray-500 border-b border-gray-200">
                              {m.substring(0, 3)}
                          </th>
                      ))}
                      <th className="p-2 text-center font-bold text-gray-800 border-b border-l border-gray-200 bg-gray-50 min-w-[50px]">
                          Total
                      </th>
                  </tr>
              </thead>
              <tbody>
                  {matrixData.rows.map((row, rIdx) => (
                      <tr key={row.site} className="group hover:bg-gray-50 transition-colors">
                          <td className="sticky left-0 z-10 p-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 bg-white group-hover:bg-blue-50/30 truncate max-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={row.site}>
                              {row.site}
                          </td>
                          {row.counts.map((val, mIdx) => {
                              const cellColor = getColor(val, matrixData.maxVal);
                              return (
                                  <td 
                                    key={mIdx} 
                                    className={`border-b border-gray-100 p-0.5 relative h-8 w-10 text-center cursor-pointer hover:ring-2 hover:ring-blue-400 hover:z-10 transition-all duration-75`}
                                    onClick={() => {
                                        if (val > 0) {
                                            const month = mIdx + 1;
                                            const cellIncidents = incidents.filter(i => i.site === row.site && i.month === month);
                                            setSelectedCell({ site: row.site, month, count: val, incidents: cellIncidents });
                                        }
                                    }}
                                  >
                                      <div 
                                        className={`w-full h-full flex items-center justify-center rounded-sm text-[10px] ${cellColor} ${!showValues && val > 0 ? 'text-transparent' : ''}`}
                                        title={`${row.site} - ${MONTHS[mIdx]}: ${val} incidentes (${Math.round((val/row.total)*100)}% del sitio)`}
                                      >
                                          {val > 0 ? val : ''}
                                      </div>
                                  </td>
                              );
                          })}
                          <td className="p-2 text-center font-bold text-gray-800 border-b border-l border-gray-200 bg-gray-50">
                              {row.total}
                          </td>
                      </tr>
                  ))}
                  
                  {/* Column Totals Footer */}
                  <tr className="bg-gray-100 font-bold sticky bottom-0 z-20 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                      <td className="sticky left-0 z-30 p-2 text-right text-gray-600 bg-gray-100 border-t border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          TOTAL MES
                      </td>
                      {matrixData.colTotals.map((total, idx) => (
                          <td key={idx} className="p-1 text-center text-gray-700 border-t border-gray-200 text-[10px]">
                              {total > 0 ? total : '-'}
                          </td>
                      ))}
                      <td className="p-2 text-center text-blue-800 border-t border-l border-gray-200 bg-blue-50">
                          {matrixData.grandTotal}
                      </td>
                  </tr>
              </tbody>
          </table>
      </div>

      {/* Drill-down Modal */}
      {selectedCell && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
                      <div>
                          <h3 className="font-bold text-lg">{selectedCell.site}</h3>
                          <p className="text-xs text-gray-400">{MONTHS[selectedCell.month-1]} • {selectedCell.count} Incidentes</p>
                      </div>
                      <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-0">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Severidad</th>
                                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Descripción Corta</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                              {selectedCell.incidents.map(inc => (
                                  <tr key={inc.incident_id} className="hover:bg-blue-50">
                                      <td className="px-4 py-2 text-xs font-mono text-gray-600">{inc.incident_id}</td>
                                      <td className="px-4 py-2 text-xs text-gray-800 font-medium">{inc.type}</td>
                                      <td className="px-4 py-2 text-xs">
                                          <span className={`px-1.5 py-0.5 rounded-full ${inc.potential_risk.includes('Alta') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                                              {inc.potential_risk}
                                          </span>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-xs" title={inc.description}>{inc.description}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                      <button onClick={exportCellData} className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded shadow-sm">
                          <Download className="w-3 h-3 mr-2"/> Exportar Lista
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};