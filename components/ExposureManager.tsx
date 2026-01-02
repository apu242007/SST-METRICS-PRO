
import React, { useState, useEffect, useMemo } from 'react';
import { ExposureHour, ExposureKm, MissingExposureKey } from '../types';
import { Save, Plus, AlertTriangle, PenTool, Zap, Filter, Info, Lock } from 'lucide-react';
import { getAutoHH } from '../utils/importHelpers';

interface ExposureManagerProps {
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
  sites: string[];
  missingKeys?: MissingExposureKey[];
  initialSite?: string; // Optional site to focus on
  onUpdate: (hours: ExposureHour[], km: ExposureKm[]) => void;
}

export const ExposureManager: React.FC<ExposureManagerProps> = ({ 
    exposureHours, exposureKm, sites, missingKeys = [], initialSite, onUpdate 
}) => {
  const [newSite, setNewSite] = useState(initialSite || sites[0] || '');
  const [newPeriod, setNewPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [hoursList, setHoursList] = useState(exposureHours);
  const [kmList, setKmList] = useState(exposureKm);

  // Bulk Fill State
  const [bulkSite, setBulkSite] = useState(initialSite || sites[0] || '');
  const [bulkValue, setBulkValue] = useState('');

  // Table Filter State
  const [tableFilterSite, setTableFilterSite] = useState(initialSite || 'ALL');

  // Effect to sync props to state
  useEffect(() => {
    setHoursList(exposureHours);
    setKmList(exposureKm);
  }, [exposureHours, exposureKm]);

  // Update defaults if initialSite changes (re-opening modal for different site)
  useEffect(() => {
      if (initialSite) {
          setBulkSite(initialSite);
          setTableFilterSite(initialSite);
          setNewSite(initialSite);
      }
  }, [initialSite]);

  // Note: generateAutoExposureRecords in App.tsx now handles the logic. 
  // ExposureManager is mostly for Display & Manual Fixes.

  const mergedData = useMemo(() => {
    const keys = new Set<string>();
    hoursList.forEach(h => keys.add(`${h.site}|${h.period}`));
    kmList.forEach(k => keys.add(`${k.site}|${k.period}`));

    // Also ensure missing keys appear even if not in hoursList yet (though auto logic should have caught them as 0s)
    missingKeys.forEach(mk => keys.add(`${mk.site}|${mk.period}`));

    let data = Array.from(keys).map(key => {
      const [site, period] = key.split('|');
      const hourEntry = hoursList.find(h => h.site === site && h.period === period);
      const kmEntry = kmList.find(k => k.site === site && k.period === period);
      
      const hoursVal = hourEntry?.hours || 0;
      
      // Determination of State
      // Missing = Hours are 0.
      const isMissing = hoursVal === 0;
      
      // Auto Filled = Not missing (hours > 0) AND ID contains 'AUTO'.
      const isAuto = !isMissing && hourEntry?.id?.includes('AUTO');

      return {
        key,
        site,
        period,
        hours: hoursVal,
        km: kmEntry?.km || 0,
        hourId: hourEntry?.id,
        kmId: kmEntry?.id,
        isMissing,
        isAuto
      };
    });

    // Apply Filter
    if (tableFilterSite !== 'ALL') {
        data = data.filter(d => d.site === tableFilterSite);
    }

    // Sort: Missing first, then date desc
    return data.sort((a,b) => {
        if (a.isMissing && !b.isMissing) return -1;
        if (!a.isMissing && b.isMissing) return 1;
        return b.period.localeCompare(a.period);
    });
  }, [hoursList, kmList, missingKeys, tableFilterSite]);

  const updateVal = (site: string, period: string, type: 'hours' | 'km', val: string) => {
    const num = parseFloat(val) || 0;
    if (type === 'hours') {
      const exists = hoursList.find(h => h.site === site && h.period === period);
      if (exists) {
        setHoursList(prev => prev.map(h => h.id === exists.id ? {...h, hours: num, id: h.id.replace('AUTO', 'MANUAL')} : h));
      } else {
        setHoursList(prev => [...prev, { id: `EXP-H-${site}-${period}-${Date.now()}`, site, period, worker_type: 'total', hours: num }]);
      }
    } else {
       const exists = kmList.find(k => k.site === site && k.period === period);
      if (exists) {
        setKmList(prev => prev.map(k => k.id === exists.id ? {...k, km: num} : k));
      } else {
        setKmList(prev => [...prev, { id: `EXP-K-${site}-${period}-${Date.now()}`, site, period, km: num }]);
      }
    }
  };

  const handleSave = () => {
    onUpdate(hoursList, kmList);
    // Simple toast fallback
    const btn = document.getElementById('save-btn');
    if(btn) {
        const originalText = btn.innerText;
        btn.innerText = "¡Datos Guardados!";
        setTimeout(() => btn.innerText = originalText, 2000);
    }
  };

  const handleBulkFill = () => {
      const num = parseFloat(bulkValue);
      if (isNaN(num)) return;

      const newHours = hoursList.map(h => {
          if (h.site === bulkSite && h.hours === 0) {
              return { ...h, hours: num };
          }
          return h;
      });
      setHoursList(newHours);
      setBulkValue('');
      // Visual feedback handled by state update
  };

  const addNew = () => {
    if (!newSite || !newPeriod) return;
    const key = `${newSite}|${newPeriod}`;
    // Check if key exists in master list, not just filtered list
    const exists = hoursList.some(h => h.site === newSite && h.period === newPeriod) || kmList.some(k => k.site === newSite && k.period === newPeriod);
    
    if (exists) {
      alert("La entrada ya existe");
      return;
    }
    
    // Auto-fill HH if rule exists
    const autoHH = getAutoHH(newSite);
    const newId = autoHH > 0 ? `EXP-H-${newSite}-${newPeriod}-AUTO-${Date.now()}` : `EXP-H-${newSite}-${newPeriod}-${Date.now()}`;
    
    setHoursList(prev => [...prev, { id: newId, site: newSite, period: newPeriod, worker_type: 'total', hours: autoHH }]);
    setKmList(prev => [...prev, { id: `EXP-K-${newSite}-${newPeriod}-${Date.now()}`, site: newSite, period: newPeriod, km: 0 }]);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER WITH BULK TOOL */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <PenTool className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold text-blue-800 uppercase">Gestión de Exposición</h3>
                    <p className="text-xs text-blue-700 mt-1">
                        Complete HH y KM. <strong className="text-red-600">Rojo</strong> = Sin configuración (Manual). <strong className="text-green-600">Verde</strong> = Asignado Automáticamente.
                    </p>
                </div>
            </div>

            {/* Bulk Fill Tool */}
            <div className="bg-white p-2 rounded shadow-sm border border-blue-100 flex items-end gap-2">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Carga Masiva para Sitio</label>
                    <select 
                        value={bulkSite} 
                        onChange={e => setBulkSite(e.target.value)}
                        className="text-xs border-gray-300 rounded shadow-sm py-1 max-w-[150px]"
                    >
                         {sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Valor Promedio</label>
                    <input 
                        type="number" 
                        value={bulkValue} 
                        onChange={e => setBulkValue(e.target.value)} 
                        placeholder="Ej: 50000"
                        className="w-24 text-xs border-gray-300 rounded shadow-sm py-1"
                        autoFocus={!!initialSite} // Focus here if opened via shortcut
                    />
                </div>
                <button 
                    onClick={handleBulkFill}
                    className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700"
                    title={`Aplicar promedio a todos los meses vacíos de ${bulkSite}`}
                >
                    <Zap className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>

      {/* Manual Entry & Filter Bar */}
      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-wrap justify-between items-end gap-3">
        {/* Add New Form */}
        <div className="flex gap-2 items-end">
             <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">Sitio (Nuevo)</label>
                <input type="text" list="site-suggestions" value={newSite} onChange={e => setNewSite(e.target.value)} className="border-gray-300 rounded-md shadow-sm border p-1.5 text-xs w-32"/>
                <datalist id="site-suggestions">
                    {sites.map(s => <option key={s} value={s}/>)}
                </datalist>
            </div>
            <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">Período</label>
                <input type="month" value={newPeriod} onChange={e => setNewPeriod(e.target.value)} className="border-gray-300 rounded-md shadow-sm border p-1.5 text-xs"/>
            </div>
            <button onClick={addNew} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700">
                <Plus className="w-3 h-3"/>
            </button>
        </div>

        {/* Filter View */}
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
                value={tableFilterSite} 
                onChange={e => setTableFilterSite(e.target.value)}
                className="text-xs border-gray-300 rounded shadow-sm py-1 px-2"
            >
                <option value="ALL">Mostrar Todos</option>
                {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
        </div>
      </div>

      {/* Data Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
        <div className="flex justify-between items-center p-3 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                Planilla de Datos {tableFilterSite !== 'ALL' && <span className="text-blue-600 ml-1">({tableFilterSite})</span>}
            </h3>
            <div className="flex items-center text-[10px] space-x-3 mr-4">
                 <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span> Sin Configuración (Manual)</span>
                 <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Auto-Asignado</span>
            </div>
            <button id="save-btn" onClick={handleSave} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-bold rounded text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all">
                <Save className="w-4 h-4 mr-2"/> Guardar Cambios
            </button>
        </div>
        <div className="overflow-auto custom-scrollbar flex-1 relative">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Período</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Sitio</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/4 bg-blue-50/50">Horas Hombre (HH)</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/4 bg-purple-50/50">Kms Recorridos (KM)</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {mergedData.map(entry => (
                        <tr key={entry.key} className={`hover:bg-gray-50 transition-colors ${entry.isMissing ? "bg-red-50" : (entry.isAuto ? "bg-green-50/30" : "")}`}>
                            <td className="px-6 py-3 text-sm text-gray-900 font-medium flex items-center">
                                {entry.isMissing && (
                                    <span title="Sitio sin HH configuradas" className="mr-2 flex items-center">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                    </span>
                                )}
                                {entry.isAuto && (
                                    <span title="Asignado automáticamente" className="mr-2 flex items-center">
                                        <Lock className="w-3 h-3 text-green-600 opacity-50" />
                                    </span>
                                )}
                                {entry.period}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">{entry.site}</td>
                            <td className="px-6 py-2 bg-blue-50/20">
                                <input 
                                    type="number" 
                                    className={`w-full border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2 border shadow-sm ${entry.isMissing ? 'border-red-300 ring-1 ring-red-200 bg-red-50' : ''} ${entry.isAuto ? 'text-gray-500 bg-gray-50' : ''}`}
                                    value={entry.hours}
                                    onFocus={(e) => e.target.select()} // Auto-select for fast entry
                                    placeholder="0"
                                    onChange={(e) => updateVal(entry.site, entry.period, 'hours', e.target.value)}
                                    title={entry.isMissing ? "Ingrese HH Manualmente" : (entry.isAuto ? "Valor Auto-Asignado (Editable)" : "Valor Manual")}
                                />
                            </td>
                            <td className="px-6 py-2 bg-purple-50/20">
                                <input 
                                    type="number" 
                                    className="w-full border-gray-300 rounded text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500 p-2 border shadow-sm"
                                    value={entry.km}
                                    onFocus={(e) => e.target.select()} // Auto-select for fast entry
                                    placeholder="0"
                                    onChange={(e) => updateVal(entry.site, entry.period, 'km', e.target.value)}
                                />
                            </td>
                        </tr>
                    ))}
                    {mergedData.length === 0 && (
                         <tr><td colSpan={4} className="text-center py-8 text-gray-400 italic">No hay datos que mostrar con el filtro actual.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
