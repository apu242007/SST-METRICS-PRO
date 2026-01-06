
import React, { useState, useMemo } from 'react';
import { Incident, HeatmapData, ExposureHour } from '../types';
import { MONTHS } from '../constants';
import { Filter, ArrowDown, ArrowUp, Eye, EyeOff, X, Download, RefreshCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HeatmapMatrixProps {
  incidents: Incident[];
  exposureHours: ExposureHour[];
}

interface RowData {
    site: string;
    counts: number[];
    hours: number[]; // Accumulated hours per month (can span years if no filter)
    rates: number[]; // TRIR (200k)
    total: number;
    lastMonthIndex: number;
}

export const HeatmapMatrix: React.FC<HeatmapMatrixProps> = ({ incidents, exposureHours }) => {
  // --- STATE ---
  const [showValues, setShowValues] = useState(true);
  const [sortBy, setSortBy] = useState<'total' | 'alpha' | 'recent'>('total');
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [limit, setLimit] = useState(15); // Top N
  const [selectedCell, setSelectedCell] = useState<{site: string, month: number, count: number, incidents: Incident[]} | null>(null);
  
  // New Toggle: Count vs Rate
  const [mode, setMode] = useState<'count' | 'rate'>('count');

  // --- DATA PROCESSING (Memoized) ---
  const matrixData = useMemo(() => {
    const sites: string[] = (Array.from(new Set(incidents.map(i => i.site))) as string[]).sort();
    
    // 1. Build Base Matrix & Row Stats
    let rows: RowData[] = sites.map(site => {
        const siteIncidents = incidents.filter(i => i.site === site);
        const monthlyCounts = Array(12).fill(0);
        const monthlyHours = Array(12).fill(0);
        const monthlyRates = Array(12).fill(0);
        let lastMonthIndex = -1;
        
        // Aggregate Counts
        siteIncidents.forEach(inc => {
            if(inc.month >= 1 && inc.month <= 12) {
                monthlyCounts[inc.month - 1]++;
                if((inc.month - 1) > lastMonthIndex) lastMonthIndex = inc.month - 1;
            }
        });

        // Aggregate Hours (Handle multiple years if present in filter)
        // We iterate through exposure records and sum based on month index
        const siteExposure = exposureHours.filter(e => e.site === site);
        siteExposure.forEach(exp => {
            const month = parseInt(exp.period.split('-')[1]);
            if (!isNaN(month) && month >= 1 && month <= 12) {
                monthlyHours[month - 1] += (exp.hours || 0);
            }
        });

        // Calculate Rates (TRIR 200k base)
        for (let i = 0; i < 12; i++) {
            if (monthlyHours[i] > 0) {
                const rate = (monthlyCounts[i] * 200000) / monthlyHours[i];
                monthlyRates[i] = parseFloat(rate.toFixed(2));
            } else {
                monthlyRates[i] = 0; // Or null to indicate missing data? Keeping 0 for matrix simplicity
            }
        }

        const total = monthlyCounts.reduce((a, b) => a + b, 0);
        return {
            site,
            counts: monthlyCounts,
            hours: monthlyHours,
            rates: monthlyRates,
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

    // 6. Calculate Max for Color Scale (Dynamic based on Mode)
    let maxVal = 0;
    if (mode === 'count') {
        rows.forEach(r => r.counts.forEach(v => { if(v > maxVal) maxVal = v; }));
    } else {
        rows.forEach(r => r.rates.forEach(v => { if(v > maxVal) maxVal = v; }));
    }

    return { rows, colTotals, grandTotal, maxVal };
  }, [incidents, exposureHours, hideZeroRows, sortBy, limit, mode]);

  // --- HELPERS ---
  const getColor = (value: number, max: number) => {
      if (value === 0) return 'bg-white text-transparent';
      
      if (mode === 'count') {
          // Count logic (Integers)
          if (value === 1) return 'bg-blue-100 text-blue-800';
          if (value === 2) return 'bg-blue-200 text-blue-900';
          if (value <= 4) return 'bg-blue-400 text-white';
          if (value <= 6) return 'bg-blue-600 text-white';
          return 'bg-blue-800 text-white font-bold';
      } else {
          // Rate Logic (Decimals, TRIR)
          // < 1 (Excellent), < 2.5 (Target), < 5 (Warning), > 5 (High)
          if (value < 1) return 'bg-green-100 text-green-800';
          if (value < 2.5) return 'bg-yellow-100 text-yellow-800';
          if (value < 5) return 'bg-orange-300 text-white';
          return 'bg-red-500 text-white font-bold';
      }
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
              <h3 className="font-bold text-gray-800 text-lg">Mapa de Calor y Frecuencia</h3>
              <p className="text-xs text-gray-500">
                  {mode === 'count' ? 'Incidentes Totales por Sitio/Mes' : 'Tasa de Frecuencia (TRIR - Base 200k) por Sitio/Mes'}
              </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
              {/* Main Toggle */}
              <div className="flex bg-gray-200 rounded-lg p-1">
                  <button 
                    onClick={() => setMode('count')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      Cant. Eventos
                  </button>
                  <button 
                    onClick={() => setMode('rate')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${mode === 'rate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      Tasa (TRIR)
                  </button>
              </div>

              {/* Toggles */}
              <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-md p-1">
                  <button 
                    onClick={() => setHideZeroRows(!hideZeroRows)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${hideZeroRows ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
                    title="Ocultar sitios sin incidentes"
                  >
                      {hideZeroRows ? 'Con Data' : 'Todos'}
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
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-end text-xs gap-3">
          <span className="text-gray-400 font-medium">Escala:</span>
          {mode === 'count' ? (
              <>
                  <span className="flex items-center"><span className="w-3 h-3 bg-white border border-gray-200 mr-1"></span> 0</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-blue-100 mr-1"></span> 1</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-blue-200 mr-1"></span> 2</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-blue-400 mr-1"></span> 3-4</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-blue-600 mr-1"></span> 5+</span>
              </>
          ) : (
              <>
                  <span className="flex items-center"><span className="w-3 h-3 bg-white border border-gray-200 mr-1"></span> 0</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-green-100 mr-1"></span> &lt; 1</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-yellow-100 mr-1"></span> 1 - 2.5</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-orange-300 mr-1"></span> 2.5 - 5</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-red-500 mr-1"></span> &gt; 5</span>
              </>
          )}
      </div>

      {/* Matrix Grid */}
      <div className="w-full overflow-x-auto bg-gray-50/50">
          <table className="min-w-full border-collapse text-xs">
              <thead className="bg-white">
                  <tr>
                      <th className="bg-white p-2 text-left font-bold text-gray-600 border-b border-r border-gray-200 min-w-[150px]">
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
                          <td className="p-2 text-left font-medium text-gray-700 border-b border-r border-gray-200 bg-white group-hover:bg-blue-50/30 truncate max-w-[180px]" title={row.site}>
                              {row.site}
                          </td>
                          {row.counts.map((countVal, mIdx) => {
                              // Determine value based on mode
                              const displayVal = mode === 'count' ? countVal : row.rates[mIdx];
                              const cellColor = getColor(displayVal, matrixData.maxVal);
                              
                              // Tooltip info
                              const rateInfo = row.hours[mIdx] > 0 ? `${row.rates[mIdx]} (TRIR)` : 'N/A (Sin Horas)';
                              const tooltip = `${row.site} - ${MONTHS[mIdx]}\nEventos: ${countVal}\nHoras: ${row.hours[mIdx]}\nTasa: ${rateInfo}`;

                              return (
                                  <td 
                                    key={mIdx} 
                                    className={`border-b border-gray-100 p-0.5 relative h-8 w-10 text-center cursor-pointer hover:ring-2 hover:ring-blue-400 hover:z-10 transition-all duration-75`}
                                    onClick={() => {
                                        if (countVal > 0) {
                                            const month = mIdx + 1;
                                            const cellIncidents = incidents.filter(i => i.site === row.site && i.month === month);
                                            setSelectedCell({ site: row.site, month, count: countVal, incidents: cellIncidents });
                                        }
                                    }}
                                    title={tooltip}
                                  >
                                      <div 
                                        className={`w-full h-full flex items-center justify-center rounded-sm text-[10px] ${cellColor} ${!showValues && displayVal > 0 ? 'text-transparent' : ''}`}
                                      >
                                          {displayVal > 0 ? displayVal : ''}
                                      </div>
                                  </td>
                              );
                          })}
                          <td className="p-2 text-center font-bold text-gray-800 border-b border-l border-gray-200 bg-gray-50">
                              {row.total}
                          </td>
                      </tr>
                  ))}
                  
                  {/* Column Totals Footer (Only sensible for Counts) */}
                  <tr className="bg-gray-100 font-bold">
                      <td className="p-2 text-right text-gray-600 bg-gray-100 border-t border-r border-gray-200">
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

      {/* Drill-down Modal (Overlay style) */}
      {selectedCell && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col my-8">
                  <div className="p-4 bg-gray-900 text-white flex justify-between items-center rounded-t-xl">
                      <div>
                          <h3 className="font-bold text-lg">{selectedCell.site}</h3>
                          <p className="text-xs text-gray-400">{MONTHS[selectedCell.month-1]} • {selectedCell.count} Incidentes</p>
                      </div>
                      <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"><X className="w-5 h-5"/></button>
                  </div>
                  
                  <div className="p-0">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
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

                  <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end rounded-b-xl">
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
