
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { DataExplorer } from './components/DataExplorer';
import { PendingTasks } from './components/PendingTasks';
import { ExposureManager } from './components/ExposureManager';
import { IncidentDetailView } from './components/IncidentDetailView';
import { AutomationHub } from './components/AutomationHub';
import { LabControls } from './components/LabControls';
import { CalendarView } from './components/CalendarView';
import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule, SharePointConfig, SyncLog, ScheduledReport } from './types';
import { generateDetailedKPIReport } from './utils/calculations';
import { loadState, saveState, clearState, upsertIncidents, updateIncidentManual } from './services/storage';
import { parseIncidentsExcel, getMissingExposureKeys } from './utils/importHelpers';
import { mockCheckForUpdates } from './services/sharepointService';
import { LayoutDashboard, FileText, Layers, Zap, Filter, Upload, Download, X, Search, ChevronRight, RefreshCcw, FileSpreadsheet, PenTool, Workflow, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MONTHS } from './constants';

const App: React.FC = () => {
  // --- 1. GLOBAL STATE ---
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [exposureHours, setExposureHours] = useState<ExposureHour[]>([]);
  const [exposureKm, setExposureKm] = useState<ExposureKm[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ base_if: 1000000, base_trir: 200000, days_cap: 180 });
  const [rules, setRules] = useState<MappingRule[]>([]);
  
  // Automation State
  const [sharePointConfig, setSharePointConfig] = useState<SharePointConfig>({ isEnabled: false, tenantId: '', siteUrl: '', libraryName: '', incidentFileName: '', reportFolderPath: '', lastSyncDate: null, lastFileHash: null });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  const [fileMeta, setFileMeta] = useState<{name: string, date: string} | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // --- SANDBOX STATE (Prompt O) ---
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  // We use refs to hold production data while in sandbox to avoid double render passes or complex effect chains
  const productionSnapshot = useRef<{ incidents: Incident[], exposure: ExposureHour[] } | null>(null);

  // --- 2. UX STATE ---
  const [activeTab, setActiveTab] = useState<'raw' | 'normalized' | 'kpis' | 'pending' | 'automation' | 'calendar'>('raw');
  
  // Global Filters
  const [filters, setFilters] = useState({
    site: 'All',
    year: 'All',
    month: 'All',
    type: 'All',
    location: 'All',
    search: '',
    category: 'All' as 'All' | 'LTI' | 'Recordable' | 'Transit'
  });

  const [modalMode, setModalMode] = useState<'exposure_hh' | 'exposure_km' | 'review_incident' | null>(null);
  const [focusSite, setFocusSite] = useState<string | undefined>(undefined);

  const [reviewIncidentId, setReviewIncidentId] = useState<string | null>(null);
  const [importData, setImportData] = useState<{incidents: Incident[], rules: MappingRule[], report: {errors: string[], warnings: string[]}, fileName: string} | null>(null);

  // --- 3. INITIALIZATION & STORAGE ---
  useEffect(() => {
    const data = loadState();
    setIncidents(data.incidents);
    setExposureHours(data.exposure_hours);
    setExposureKm(data.exposure_km);
    setSettings(data.settings);
    setRules(data.rules);
    
    // Load Automation
    if (data.sharepoint_config) setSharePointConfig(data.sharepoint_config);
    if (data.sync_logs) setSyncLogs(data.sync_logs);
    if (data.scheduled_reports) setScheduledReports(data.scheduled_reports);
    
    if(data.incidents.length > 0) {
        const latest = data.incidents.reduce((max, i) => i.updated_at > max ? i.updated_at : max, '');
        const dateStr = latest ? new Date(latest).toLocaleString('es-ES') : new Date().toLocaleString('es-ES');
        setFileMeta({ name: 'basedatosincidentes.xlsx (Caché Local)', date: dateStr });
        setActiveTab(data.incidents.length > 0 ? 'kpis' : 'raw');
    }
    setIsLoaded(true);
  }, []);

  // PERSISTENCE LOGIC
  useEffect(() => {
    // Only save to localStorage if NOT in Sandbox Mode
    if (isLoaded && !isSandboxMode) {
      saveState({ 
          incidents, exposure_hours: exposureHours, exposure_km: exposureKm, settings, rules, load_history: [],
          sharepoint_config: sharePointConfig, sync_logs: syncLogs, scheduled_reports: scheduledReports
      });
    }
  }, [incidents, exposureHours, exposureKm, settings, rules, isLoaded, sharePointConfig, syncLogs, scheduledReports, isSandboxMode]);

  // --- SANDBOX HANDLERS ---
  const handleEnterSandbox = () => {
      productionSnapshot.current = { incidents: [...incidents], exposure: [...exposureHours] };
      setIsSandboxMode(true);
      // We don't change the UI state, user just sees a banner now and edits are volatile
  };

  const handleCommitSandbox = () => {
      if(confirm("¿Aplicar cambios del Laboratorio a Producción? Esto sobrescribirá la base de datos local.")) {
          setIsSandboxMode(false);
          productionSnapshot.current = null;
          // State is already updated in React, useEffect will trigger saveState now that isSandboxMode is false
      }
  };

  const handleDiscardSandbox = () => {
      if(confirm("¿Descartar cambios y volver a Producción?")) {
          if (productionSnapshot.current) {
              setIncidents(productionSnapshot.current.incidents);
              setExposureHours(productionSnapshot.current.exposure);
          }
          setIsSandboxMode(false);
          productionSnapshot.current = null;
      }
  };

  // --- AUTO SYNC (Prompt L) ---
  useEffect(() => {
      if (isLoaded && sharePointConfig.isEnabled && !isSandboxMode) {
          const runAutoSync = async () => {
              try {
                  const check = await mockCheckForUpdates(sharePointConfig);
                  if (check.hasUpdates) {
                       const newLog: SyncLog = {
                           id: Date.now().toString(),
                           date: new Date().toISOString(),
                           status: 'SUCCESS',
                           message: 'Actualización incremental detectada y descargada (Simulación).',
                           recordsProcessed: 0
                       };
                       setSyncLogs(prev => [...prev, newLog]);
                       setSharePointConfig(prev => ({ ...prev, lastSyncDate: new Date().toISOString(), lastFileHash: check.newHash || '' }));
                  }
              } catch (e) {
                  console.error("Auto-sync failed", e);
              }
          };
          runAutoSync();
      }
  }, [isLoaded, sharePointConfig.isEnabled, isSandboxMode]); 

  // --- 4. DATA PROCESSING (FILTERING) ---
  
  const uniqueValues = useMemo(() => {
    // Memoizing this is crucial for performance (Prompt N)
    const sites = Array.from(new Set(incidents.map(i => i.site))).sort();
    const years = Array.from(new Set(incidents.map(i => i.year))).sort().reverse();
    const months = Array.from(new Set(incidents.map(i => i.month))).sort((a: number, b: number) => a - b);
    const types = Array.from(new Set(incidents.map(i => i.type))).sort();
    const locations = Array.from(new Set(incidents.map(i => i.location))).sort();
    return { sites, years, months, types, locations };
  }, [incidents]);

  const filteredIncidents = useMemo(() => {
    let result = incidents;
    return result.filter(i => {
        if (filters.site !== 'All' && i.site !== filters.site) return false;
        if (filters.year !== 'All' && String(i.year) !== filters.year) return false;
        if (filters.month !== 'All' && String(i.month) !== filters.month) return false;
        if (filters.type !== 'All' && i.type !== filters.type) return false;
        if (filters.location !== 'All' && i.location !== filters.location) return false;
        if (filters.category === 'LTI' && !i.lti_case) return false;
        if (filters.category === 'Recordable' && !i.recordable_osha) return false;
        if (filters.category === 'Transit' && !i.is_transit) return false;
        if (filters.search) {
            const term = filters.search.toLowerCase();
            // Optimization: avoid parsing JSON for search if possible, rely on flattened fields
            return (
                i.incident_id.toLowerCase().includes(term) ||
                i.name.toLowerCase().includes(term) ||
                i.description.toLowerCase().includes(term) 
            );
        }
        return true;
    });
  }, [incidents, filters]);

  // --- 5. HANDLERS ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      try {
          // Parse and stage for confirmation (avoid blocking confirm())
          const { incidents: newRecords, rules: newRules, report } = parseIncidentsExcel(buffer, rules);
          setImportData({ incidents: newRecords, rules: newRules, report, fileName: file.name });
      } catch(err: any) {
          console.error(err);
          // Fallback UI for error (no alert)
          alert(`ERROR DE CARGA: ${err.message}`); 
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; 
  };

  const handleConfirmImport = () => {
    if (!importData) return;
    
    try {
        const result = upsertIncidents(incidents, importData.incidents);
        setRules(importData.rules);
        setIncidents(result.incidents);
        setFileMeta({ name: importData.fileName, date: new Date().toLocaleString('es-ES') });
        
        // Log import in SyncLogs if manually done
        const log: SyncLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            status: 'SUCCESS',
            message: `Carga manual de ${importData.fileName} ${isSandboxMode ? '(SANDBOX)' : ''}`,
            recordsProcessed: importData.incidents.length
        };
        setSyncLogs(prev => [...prev, log]);

        setActiveTab('pending'); 
        setImportData(null);
    } catch(e) {
        console.error("Import error", e);
    }
  };

  const handleExport = () => {
      try {
        const wb = XLSX.utils.book_new();
        const incidentSheet = filteredIncidents.map(i => ({
            ID: i.incident_id,
            Fecha: i.fecha_evento,
            Sitio: i.site,
            Tipo: i.type,
            Descripcion: i.description,
            OSHA_Recordable: i.recordable_osha ? 'SI' : 'NO',
            LTI: i.lti_case ? 'SI' : 'NO',
            Dias_Perdidos: i.days_away,
            Transito: i.is_transit ? 'SI' : 'NO'
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incidentSheet), "Lista_Incidentes_Filtrada");
        const kpiData = generateDetailedKPIReport(incidents, exposureHours, exposureKm, settings);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiData), "Reporte_KPIs_Mensual");
        XLSX.writeFile(wb, "SST_Reporte_Inteligente.xlsx");
      } catch (error) {
        console.error(error);
      }
  };

  const handleUpdateIncident = (updated: Incident) => {
      setIncidents(prev => updateIncidentManual(prev, updated));
  };

  const handleReset = () => {
      if(window.confirm && confirm("¿Estás seguro de reiniciar la base de datos a valores por defecto (Seed Data)? Esto borrará tus cambios locales.")) {
          clearState();
      } else if (!window.confirm) {
          clearState();
      }
  };

  const handleDrillDown = (criteria: { type?: string, period?: string, category?: 'LTI' | 'Recordable' | 'Transit' }) => {
      const newFilters = { ...filters };
      if (criteria.period) {
          const [year, month] = criteria.period.split('-').map(Number);
          newFilters.year = String(year);
          newFilters.month = String(month);
      }
      if (criteria.type) newFilters.type = criteria.type;
      if (criteria.category) newFilters.category = criteria.category;
      setFilters(newFilters);
      setActiveTab('normalized'); 
  };

  const resetFilters = () => {
      setFilters({site: 'All', year: 'All', month: 'All', type: 'All', location: 'All', search: '', category: 'All'});
  };

  const handleManualSync = () => {
      const log: SyncLog = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          status: 'SUCCESS',
          message: 'Sincronización manual completada (Simulación)',
          recordsProcessed: 0
      };
      setSyncLogs(prev => [...prev, log]);
      setSharePointConfig(prev => ({...prev, lastSyncDate: new Date().toISOString()}));
  };

  if (!isLoaded) return <div className="flex h-screen items-center justify-center text-gray-500 font-medium">Iniciando sistema SST...</div>;

  // Empty State
  if (incidents.length === 0) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
            {/* Import Modal */}
            {importData && (
              <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
                  <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full border border-gray-200">
                      <div className="flex items-center mb-4 text-blue-600">
                           <FileSpreadsheet className="w-6 h-6 mr-2" />
                           <h3 className="text-lg font-bold">Reporte de Pre-Importación</h3>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2 mb-6">
                          <div className="flex justify-between"><span className="text-gray-600">Registros:</span><span className="font-bold text-gray-900">{importData.incidents.length}</span></div>
                          {importData.report.warnings.length > 0 && <div className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded max-h-24 overflow-y-auto">{importData.report.warnings.map((w, i) => <div key={i}>• {w}</div>)}</div>}
                      </div>
                      <div className="flex justify-end space-x-3">
                          <button onClick={() => setImportData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium">Cancelar</button>
                          <button onClick={handleConfirmImport} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold shadow-sm">Importar Datos</button>
                      </div>
                  </div>
              </div>
            )}
            <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full border border-gray-100">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Upload className="w-10 h-10 text-blue-600" /></div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido a SST Metrics Pro</h1>
                <p className="text-gray-500 mb-8">Para comenzar, importa tu Excel de incidentes (basedatosincidentes.xlsx).</p>
                <label className="cursor-pointer w-full block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 mr-2"/> Seleccionar Archivo
                    <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
                </label>
            </div>
        </div>
      );
  }

  return (
    <div className={`min-h-screen font-sans text-gray-800 flex flex-col transition-colors ${isSandboxMode ? 'bg-amber-50/30' : 'bg-gray-50'}`}>
      
      <LabControls 
          isSandbox={isSandboxMode}
          productionCount={productionSnapshot.current?.incidents.length || incidents.length}
          sandboxCount={incidents.length}
          onCommit={handleCommitSandbox}
          onDiscard={handleDiscardSandbox}
          onToggle={handleEnterSandbox}
      />

      {/* === IMPORT CONFIRMATION MODAL === */}
      {importData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 animate-in zoom-in-95 duration-200">
                <div className="flex items-center mb-4 text-blue-600 border-b border-gray-100 pb-2">
                     <FileSpreadsheet className="w-6 h-6 mr-2" />
                     <h3 className="text-lg font-bold">Confirmar Importación {isSandboxMode && <span className="text-amber-500">(SANDBOX)</span>}</h3>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-2 mb-6">
                    <p className="text-gray-500 text-xs mb-2">Archivo: {importData.fileName}</p>
                    <div className="flex justify-between">
                        <span className="text-gray-600">Registros a Procesar:</span>
                        <span className="font-bold text-gray-900">{importData.incidents.length}</span>
                    </div>
                </div>

                <div className="flex justify-end space-x-3">
                    <button onClick={() => setImportData(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium">Cancelar</button>
                    <button 
                        onClick={handleConfirmImport} 
                        className={`px-4 py-2 text-white rounded-md text-sm font-bold shadow-sm ${isSandboxMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Confirmar e Importar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* === TOP BAR === */}
      <header className={`border-b sticky top-0 z-30 shadow-sm transition-colors ${isSandboxMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
                
                {/* Brand */}
                <div className="flex items-center cursor-pointer" onClick={() => setActiveTab('kpis')}>
                    <div className={`${isSandboxMode ? 'bg-amber-500' : 'bg-blue-600'} p-1.5 rounded-lg mr-2`}>
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <span className={`font-bold text-lg tracking-tight ${isSandboxMode ? 'text-white' : 'text-gray-900'}`}>
                        SST Metrics Pro {isSandboxMode && <span className="text-amber-400 text-xs ml-2 border border-amber-500 px-2 py-0.5 rounded-full uppercase">LAB MODE</span>}
                    </span>
                </div>

                {/* STEPPER NAV (UPDATED TO UX SPEC) */}
                <nav className="hidden md:flex items-center space-x-1">
                    {[
                        { id: 'raw', label: '1. RAW (Excel)', icon: Upload },
                        { id: 'normalized', label: '2. Normalizado', icon: Layers },
                        { id: 'pending', label: '3. Pendientes', icon: Zap },
                        { id: 'kpis', label: '4. KPIs (Dashboard)', icon: LayoutDashboard },
                        { id: 'calendar', label: '5. Calendario', icon: CalendarDays },
                        { id: 'automation', label: '6. Auto', icon: Workflow },
                    ].map((tab, idx, arr) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        const baseText = isSandboxMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700';
                        const activeText = isSandboxMode ? 'bg-slate-800 text-amber-400 ring-1 ring-slate-600' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
                        
                        return (
                            <React.Fragment key={tab.id}>
                                <button 
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                                        isActive ? activeText : baseText
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 mr-2 ${isActive ? (isSandboxMode ? 'text-amber-400' : 'text-blue-600') : (isSandboxMode ? 'text-slate-600' : 'text-gray-400')}`} />
                                    {tab.label}
                                </button>
                                {idx < arr.length - 1 && <ChevronRight className={`w-4 h-4 mx-1 ${isSandboxMode ? 'text-slate-700' : 'text-gray-300'}`} />}
                            </React.Fragment>
                        );
                    })}
                </nav>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                    <label className={`cursor-pointer p-2 rounded-md ${isSandboxMode ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`} title="Importar Nuevo Archivo">
                        <Upload className="w-5 h-5"/>
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button onClick={handleExport} className={`p-2 rounded-md ${isSandboxMode ? 'text-slate-400 hover:text-green-400 hover:bg-slate-800' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`} title="Exportar Reporte">
                        <Download className="w-5 h-5"/>
                    </button>
                    {!isSandboxMode && (
                        <button onClick={handleReset} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Reiniciar App">
                            <RefreshCcw className="w-4 h-4"/>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* === FILTER BAR (Hidden on Calendar View to utilize internal filters) === */}
        {activeTab !== 'calendar' && (
        <div className={`border-t backdrop-blur-sm ${isSandboxMode ? 'bg-slate-800/90 border-slate-700' : 'bg-gray-50/50 border-gray-200'}`}>
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    <div className={`flex items-center mr-1 ${isSandboxMode ? 'text-slate-500' : 'text-gray-400'}`}><Filter className="w-4 h-4" /></div>
                    <div className={`flex items-center border rounded-md p-1 shadow-sm mr-2 ${isSandboxMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                         <button 
                            onClick={() => setFilters({...filters, category: filters.category === 'LTI' ? 'All' : 'LTI'})}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filters.category === 'LTI' ? 'bg-orange-100 text-orange-700' : (isSandboxMode ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100')}`}
                         >Solo LTI</button>
                         <div className={`w-px h-4 mx-1 ${isSandboxMode ? 'bg-slate-700' : 'bg-gray-200'}`}></div>
                         <button 
                            onClick={() => setFilters({...filters, category: filters.category === 'Transit' ? 'All' : 'Transit'})}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${filters.category === 'Transit' ? 'bg-purple-100 text-purple-700' : (isSandboxMode ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100')}`}
                         >Tránsito</button>
                    </div>

                    <select className={`text-xs border rounded-md shadow-sm py-1.5 pl-2 pr-6 focus:ring-blue-500 focus:border-blue-500 ${isSandboxMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`} value={filters.site} onChange={e => setFilters({...filters, site: e.target.value})}>
                        <option value="All">Sitio: Todos</option>
                        {uniqueValues.sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select className={`text-xs border rounded-md shadow-sm py-1.5 pl-2 pr-6 focus:ring-blue-500 focus:border-blue-500 ${isSandboxMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-gray-700'}`} value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})}>
                        <option value="All">Año: Todos</option>
                        {uniqueValues.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-gray-400" />
                        <input type="text" placeholder="Buscar..." className={`w-full pl-9 pr-2 py-1.5 text-xs border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${isSandboxMode ? 'bg-slate-900 border-slate-700 text-slate-300 placeholder-slate-600' : 'bg-white border-gray-200'}`} value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
                    </div>

                    {(filters.site !== 'All' || filters.year !== 'All' || filters.search !== '' || filters.category !== 'All') && (
                        <button onClick={resetFilters} className={`text-xs px-2 py-1.5 rounded-md transition-colors flex items-center ${isSandboxMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}><X className="w-3 h-3 mr-1" /> Limpiar</button>
                    )}
                </div>
            </div>
        </div>
        )}

        {/* === MAIN CONTENT === */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
            <div className="h-full min-h-[600px] animate-in fade-in duration-300 pb-20">
                {activeTab === 'raw' && <DataExplorer incidents={filteredIncidents} mode="raw" onUpdateIncident={handleUpdateIncident} />}
                {activeTab === 'normalized' && <DataExplorer incidents={filteredIncidents} mode="normalized" onUpdateIncident={handleUpdateIncident} />}
                {activeTab === 'kpis' && (
                    <Dashboard 
                        incidents={filteredIncidents} 
                        exposureHours={exposureHours} 
                        exposureKm={exposureKm} 
                        settings={settings} 
                        onNavigateToExposure={(site) => { setFocusSite(site); setModalMode('exposure_hh'); }} 
                        onDrillDown={handleDrillDown} 
                    />
                )}
                {activeTab === 'pending' && (
                    <PendingTasks 
                        incidents={incidents} 
                        exposureHours={exposureHours} 
                        exposureKm={exposureKm} 
                        onNavigateToExposure={(site) => { setFocusSite(site); setModalMode('exposure_hh'); }} 
                        onNavigateToReview={(id) => { if(id) { setReviewIncidentId(id); setModalMode('review_incident'); } else { setActiveTab('normalized'); } }} 
                    />
                )}
                {activeTab === 'calendar' && (
                    <CalendarView incidents={incidents} />
                )}
                {activeTab === 'automation' && <AutomationHub config={sharePointConfig} logs={syncLogs} reports={scheduledReports} incidents={incidents} onUpdateConfig={setSharePointConfig} onUpdateReports={setScheduledReports} onManualSyncTrigger={handleManualSync} />}
            </div>
        </main>

        {/* === MODALS === */}
        {modalMode === 'exposure_hh' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div className="flex items-center">
                            <PenTool className="w-5 h-5 text-blue-600 mr-2" />
                            <h3 className="font-bold text-gray-800">Carga Manual de Exposición (HH y KM)</h3>
                        </div>
                        <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <ExposureManager 
                            exposureHours={exposureHours} 
                            exposureKm={exposureKm} 
                            sites={uniqueValues.sites} 
                            missingKeys={getMissingExposureKeys(incidents, exposureHours)} 
                            initialSite={focusSite}
                            onUpdate={(h, k) => { setExposureHours(h); setExposureKm(k); }} 
                        />
                    </div>
                </div>
            </div>
        )}

        {modalMode === 'review_incident' && reviewIncidentId && (
            <IncidentDetailView 
                incident={incidents.find(i => i.incident_id === reviewIncidentId)!}
                rules={rules}
                onClose={() => { setModalMode(null); setReviewIncidentId(null); }}
                onSave={(updated) => { handleUpdateIncident(updated); setModalMode(null); setReviewIncidentId(null); }}
            />
        )}
    </div>
  );
};

export default App;
