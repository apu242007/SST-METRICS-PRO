import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dashboard } from './components/Dashboard';
import { IncidentDetailView } from './components/IncidentDetailView';
import { LabControls } from './components/LabControls';
import { CalendarView } from './components/CalendarView';
import { DocumentLibrary } from './components/DocumentLibrary';
import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule, SharePointConfig, SyncLog, ScheduledReport, GlobalKmRecord, SGIDocument } from './types';
import { calculateKPIs } from './utils/calculations';
import { loadState, saveState, clearState, upsertIncidents, updateIncidentManual } from './services/storage';
import { getMissingExposureKeys, getMissingExposureImpact, generateAutoExposureRecords, parseIncidentsExcel, sanitizeYear } from './utils/importHelpers';
import { LayoutDashboard, Layers, Zap, Filter, Search, ChevronRight, RefreshCcw, FileSpreadsheet, CalendarDays, HardDrive, BookOpen, FileText, X } from 'lucide-react';
import { TARGET_SCENARIOS, MONTHS } from './constants';

import { AutomationHub } from './components/AutomationHub';
import { DataExplorer } from './components/DataExplorer';
import { PendingTasks } from './components/PendingTasks';
import { ExposureManager } from './components/ExposureManager';
import { PDFExportCenter } from './components/PDFExportCenter';

const App: React.FC = () => {
  // --- 1. GLOBAL STATE ---
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [exposureHours, setExposureHours] = useState<ExposureHour[]>([]);
  const [exposureKm, setExposureKm] = useState<ExposureKm[]>([]);
  const [globalKm, setGlobalKm] = useState<GlobalKmRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ base_if: 1000000, base_trir: 200000, days_cap: 180 });
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [sgiDocuments, setSgiDocuments] = useState<SGIDocument[]>([]);
  
  // Automation State
  const [sharePointConfig, setSharePointConfig] = useState<SharePointConfig>({ isEnabled: false, tenantId: '', siteUrl: '', libraryName: '', incidentFileName: '', reportFolderPath: '', lastSyncDate: null, lastFileHash: null });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  const [lastAppSync, setLastAppSync] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- SANDBOX STATE ---
  const [isSandboxMode, setIsSandboxMode] = useState(false);
  const productionSnapshot = useRef<{ incidents: Incident[], exposure: ExposureHour[] } | null>(null);

  // --- 2. UX STATE ---
  const [activeTab, setActiveTab] = useState<'raw' | 'normalized' | 'kpis' | 'pending' | 'automation' | 'calendar' | 'docs'>('automation');
  
  const [filters, setFilters] = useState({
    site: 'All',
    year: 'All',
    month: 'All',
    type: 'All',
    location: 'All',
    comCliente: 'All' as 'All' | 'SI' | 'NO', // Updated to Uppercase SI/NO
    search: '',
    category: 'All' as 'All' | 'LTI' | 'Recordable' | 'Transit'
  });

  const [modalMode, setModalMode] = useState<'exposure_hh' | 'exposure_km' | 'review_incident' | 'pdf_export' | null>(null);
  const [focusSite, setFocusSite] = useState<string | undefined>(undefined);
  const [reviewIncidentId, setReviewIncidentId] = useState<string | null>(null);

  // --- 3. INITIALIZATION & STORAGE & SELF-HEALING ---
  useEffect(() => {
    const data = loadState();
    
    // --- AUTO-HEALING LOGIC FOR YEARS ---
    // This fixes "2.026" or "26" issues in existing LocalStorage data automatically
    const healedIncidents = data.incidents.map(inc => {
        try {
            if (!inc.raw_json) return inc;
            const raw = JSON.parse(inc.raw_json);
            
            // Find Year Column aggressively
            const keys = Object.keys(raw);
            const yearKey = keys.find(k => {
                // Normalize key to find "Año", "Year", etc.
                const norm = k.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return norm === 'ANO' || norm === 'ANIO' || norm === 'YEAR' || norm === 'AÑO';
            });

            if (yearKey) {
                const rawVal = raw[yearKey];
                // Use robust sanitizer
                const y = sanitizeYear(rawVal);
                
                // If valid year found and different from current, update it
                if (y !== null && y !== inc.year) {
                    return { ...inc, year: y };
                }
            }
        } catch (e) { /* Ignore parsing errors */ }
        return inc;
    });

    setIncidents(healedIncidents);
    setExposureHours(data.exposure_hours);
    setExposureKm(data.exposure_km);
    setGlobalKm(data.global_km);
    setSettings(data.settings);
    setRules(data.rules);
    setSgiDocuments(data.sgi_documents || []);
    if (data.sharepoint_config?.lastSyncDate) setLastAppSync(data.sharepoint_config.lastSyncDate);
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded && !isSandboxMode) {
      saveState({ 
          incidents, exposure_hours: exposureHours, exposure_km: exposureKm, global_km: globalKm, settings, rules, load_history: [],
          sharepoint_config: { ...sharePointConfig, lastSyncDate: lastAppSync }, 
          sync_logs: syncLogs, scheduled_reports: scheduledReports,
          sgi_documents: sgiDocuments
      });
    }
  }, [incidents, exposureHours, exposureKm, globalKm, settings, rules, isLoaded, sharePointConfig, syncLogs, scheduledReports, isSandboxMode, lastAppSync, sgiDocuments]);

  // --- 4. UPLOAD HANDLER (Synchronous Restoration) ---
  const handleFileUpload = async (file: File) => {
      if (isSandboxMode) {
          alert("No se pueden cargar archivos en modo Laboratorio.");
          return;
      }
      setIsProcessing(true);

      try {
          const arrayBuffer = await file.arrayBuffer();
          const { incidents: newRecords, rules: newRules } = parseIncidentsExcel(arrayBuffer, rules);
          const result = upsertIncidents(incidents, newRecords);
          
          setIncidents(result.incidents);
          setRules(newRules);
          
          const updatedExposure = generateAutoExposureRecords(result.incidents, exposureHours);
          setExposureHours(updatedExposure);
          setLastAppSync(new Date().toISOString());

          if (incidents.length === 0 && result.incidents.length > 0) {
              setTimeout(() => setActiveTab('kpis'), 1500);
          }
          
      } catch (error: any) {
          console.error("Upload Error:", error);
          alert(error.message || "Error al leer el archivo.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- SANDBOX HANDLERS ---
  const handleEnterSandbox = () => {
      productionSnapshot.current = { incidents: [...incidents], exposure: [...exposureHours] };
      setIsSandboxMode(true);
  };

  const handleCommitSandbox = () => {
      if(confirm("¿Aplicar cambios del Laboratorio a Producción?")) {
          setIsSandboxMode(false);
          productionSnapshot.current = null;
      }
  };

  const handleDiscardSandbox = () => {
      if(confirm("¿Descartar cambios?")) {
          if (productionSnapshot.current) {
              setIncidents(productionSnapshot.current.incidents);
              setExposureHours(productionSnapshot.current.exposure);
          }
          setIsSandboxMode(false);
          productionSnapshot.current = null;
      }
  };

  // --- DATA PROCESSING ---
  const uniqueValues = useMemo(() => {
    const sites = Array.from(new Set(incidents.map(i => i.site))).sort();
    
    // YEAR FIX: Ensure 2026 and surrounding years are always available options
    const yearsSet = new Set<number>(incidents.map(i => Number(i.year)));
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    yearsSet.add(currentYear + 1); // 2026 (if current is 2025)
    yearsSet.add(2026); // Explicit 2026 requirement
    yearsSet.add(2025); // Ensure baseline years
    yearsSet.add(2024);

    const years = Array.from(yearsSet)
        .filter((y: number) => !isNaN(y) && y > 2000 && y < 2100) // Sanity check
        .sort((a: number, b: number) => b - a); // Descending sort (2026 first)
    
    return { sites, years };
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
        
        // Com. Cliente Filter (Strict SI/NO logic mapped to boolean data)
        if (filters.comCliente !== 'All') {
            const wantTrue = filters.comCliente === 'SI';
            // We check the boolean field `com_cliente` populated by importHelpers
            if (i.com_cliente !== wantTrue) return false;
        }

        if (filters.search) {
            const term = filters.search.toLowerCase();
            return (
                i.incident_id.toLowerCase().includes(term) ||
                i.name.toLowerCase().includes(term) ||
                i.description.toLowerCase().includes(term) 
            );
        }
        return true;
    });
  }, [incidents, filters]);

  const filteredExposureHours = useMemo(() => {
      return exposureHours.filter(h => {
          if (filters.site !== 'All' && h.site !== filters.site) return false;
          if (filters.year !== 'All' && !h.period.startsWith(`${filters.year}-`)) return false;
          if (filters.month !== 'All') {
              const m = String(filters.month).padStart(2, '0');
              if (!h.period.endsWith(`-${m}`)) return false;
          }
          return true;
      });
  }, [exposureHours, filters]);

  const filteredExposureKm = useMemo(() => {
      return exposureKm.filter(k => {
          if (filters.site !== 'All' && k.site !== filters.site) return false;
          if (filters.year !== 'All' && !k.period.startsWith(`${filters.year}-`)) return false;
          if (filters.month !== 'All') {
              const m = String(filters.month).padStart(2, '0');
              if (!k.period.endsWith(`-${m}`)) return false;
          }
          return true;
      });
  }, [exposureKm, filters]);

  const filteredGlobalKm = useMemo(() => {
      if (filters.year !== 'All') {
          const year = parseInt(filters.year);
          return globalKm.filter(k => k.year === year);
      }
      return globalKm;
  }, [globalKm, filters.year]);

  const currentMetrics = useMemo(() => calculateKPIs(filteredIncidents, filteredExposureHours, filteredExposureKm, settings, TARGET_SCENARIOS['Realista 2025'], filteredGlobalKm), [filteredIncidents, filteredExposureHours, filteredExposureKm, settings, filteredGlobalKm]);
  const currentMissingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);

  // --- HANDLERS ---
  const handleUpdateIncident = (updated: Incident) => {
      setIncidents(prev => updateIncidentManual(prev, updated));
  };

  const handleReset = () => {
      if(confirm("¿Reiniciar base de datos local? Se perderán configuraciones manuales si no están respaldadas.")) {
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

  if (!isLoaded) return <div className="flex h-screen items-center justify-center text-gray-500 font-medium">Iniciando sistema SST...</div>;

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

      {/* === TOP BAR === */}
      <header className={`border-b sticky top-0 z-30 shadow-sm transition-colors ${isSandboxMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
                
                <div className="flex items-center cursor-pointer" onClick={() => setActiveTab('kpis')}>
                    <div className={`${isSandboxMode ? 'bg-amber-500' : 'bg-blue-600'} p-1.5 rounded-lg mr-2`}>
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    <span className={`font-bold text-lg tracking-tight ${isSandboxMode ? 'text-white' : 'text-gray-900'}`}>
                        SST Metrics Pro
                    </span>
                </div>

                <nav className="hidden md:flex items-center space-x-1">
                    {[
                        { id: 'automation', label: '1. Fuente', icon: HardDrive },
                        { id: 'raw', label: '2. RAW', icon: FileSpreadsheet },
                        { id: 'normalized', label: '3. Datos', icon: Layers },
                        { id: 'pending', label: '4. Pendientes', icon: Zap },
                        { id: 'docs', label: '5. SGI Docs', icon: BookOpen },
                        { id: 'kpis', label: '6. Dashboard', icon: LayoutDashboard },
                        { id: 'calendar', label: '7. Calendario', icon: CalendarDays },
                    ].map((tab, idx, arr) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        const baseText = isSandboxMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700';
                        const activeText = isSandboxMode ? 'bg-slate-800 text-amber-400 ring-1 ring-slate-600' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
                        
                        return (
                            <React.Fragment key={tab.id}>
                                <button 
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isActive ? activeText : baseText}`}
                                >
                                    <Icon className={`w-4 h-4 mr-2 ${isActive ? (isSandboxMode ? 'text-amber-400' : 'text-blue-600') : (isSandboxMode ? 'text-slate-600' : 'text-gray-400')}`} />
                                    {tab.label}
                                </button>
                                {idx < arr.length - 1 && <ChevronRight className={`w-4 h-4 mx-1 ${isSandboxMode ? 'text-slate-700' : 'text-gray-300'}`} />}
                            </React.Fragment>
                        );
                    })}
                </nav>

                <div className="flex items-center space-x-2">
                    <div className="flex items-center px-2 py-1 bg-gray-100 rounded text-[10px] text-gray-500">
                        {isProcessing ? (
                            <span className="flex items-center text-blue-600"><RefreshCcw className="w-3 h-3 animate-spin mr-1"/> Procesando...</span>
                        ) : (
                            <span title={`Última actualización: ${lastAppSync ? new Date(lastAppSync).toLocaleTimeString() : 'Nunca'}`}>
                                {incidents.length} regs
                            </span>
                        )}
                    </div>
                    
                    <button onClick={() => setModalMode('pdf_export')} className={`p-2 rounded-md ${isSandboxMode ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-gray-500 hover:text-red-600 hover:bg-red-50'}`} title="Exportar PDF Global">
                        <FileText className="w-5 h-5"/>
                    </button>

                    {!isSandboxMode && (
                        <button onClick={handleReset} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" title="Reiniciar App">
                            <RefreshCcw className="w-4 h-4"/>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* === FILTER BAR === */}
        {activeTab !== 'calendar' && activeTab !== 'automation' && activeTab !== 'docs' && (
        <div className={`border-t backdrop-blur-sm ${isSandboxMode ? 'bg-slate-800/90 border-slate-700' : 'bg-gray-50/50 border-gray-200'}`}>
            <div className="max-w-7xl mx-auto px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                    <div className={`flex items-center mr-1 ${isSandboxMode ? 'text-slate-500' : 'text-gray-400'}`}><Filter className="w-4 h-4" /></div>
                    <label htmlFor="filter-site" className="sr-only">Filtrar por sitio</label>
                    <select id="filter-site" className="text-xs border rounded-md shadow-sm py-1.5 px-2" value={filters.site} onChange={e => setFilters({...filters, site: e.target.value})}>
                        <option value="All">Sitio: Todos</option>
                        {uniqueValues.sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label htmlFor="filter-year" className="sr-only">Filtrar por año</label>
                    <select id="filter-year" className="text-xs border rounded-md shadow-sm py-1.5 px-2" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})}>
                        <option value="All">Año: Todos</option>
                        {uniqueValues.years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                    <label htmlFor="filter-month" className="sr-only">Filtrar por mes</label>
                    <select id="filter-month" className="text-xs border rounded-md shadow-sm py-1.5 px-2" value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})}>
                        <option value="All">Mes: Todos</option>
                        {MONTHS.map((m, idx) => <option key={idx} value={String(idx + 1)}>{m}</option>)}
                    </select>
                    <label htmlFor="filter-comCliente" className="sr-only">Filtrar por comunicación con cliente</label>
                    <select
                        id="filter-comCliente"
                        className="text-xs border rounded-md shadow-sm py-1.5 px-2"
                        value={filters.comCliente}
                        onChange={(e) => setFilters(prev => ({...prev, comCliente: e.target.value as 'All' | 'SI' | 'NO'}))}
                    >
                        <option value="All">Com. Cliente: Todos</option>
                        <option value="SI">Com. Cliente: SI</option>
                        <option value="NO">Com. Cliente: NO</option>
                    </select>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-gray-400" />
                        <input type="text" placeholder="Buscar..." className="w-full pl-9 pr-2 py-1.5 text-xs border rounded-md shadow-sm" value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} />
                    </div>
                    {(filters.site !== 'All' || filters.year !== 'All' || filters.month !== 'All' || filters.search !== '' || filters.comCliente !== 'All') && (
                        <button onClick={() => setFilters({site: 'All', year: 'All', month: 'All', type: 'All', location: 'All', search: '', category: 'All', comCliente: 'All'})} className="text-xs px-2 py-1.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center"><X className="w-3 h-3 mr-1" /> Limpiar</button>
                    )}
                </div>
            </div>
        </div>
        )}
      </header>

        {/* === MAIN CONTENT === */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
            <div className="h-full min-h-[600px] animate-in fade-in duration-300 pb-20">
                {activeTab === 'automation' && (
                    <AutomationHub 
                        incidents={incidents} 
                        lastUpdate={lastAppSync}
                        onFileUpload={handleFileUpload}
                        isProcessing={isProcessing}
                    />
                )}
                {activeTab === 'raw' && <DataExplorer incidents={filteredIncidents} mode="raw" onUpdateIncident={handleUpdateIncident} />}
                {activeTab === 'normalized' && <DataExplorer incidents={filteredIncidents} mode="normalized" onUpdateIncident={handleUpdateIncident} />}
                {activeTab === 'docs' && (
                    <DocumentLibrary documents={sgiDocuments} />
                )}
                {activeTab === 'kpis' && (
                    <Dashboard 
                        incidents={filteredIncidents} 
                        exposureHours={filteredExposureHours} 
                        exposureKm={filteredExposureKm} 
                        globalKmRecords={filteredGlobalKm}
                        settings={settings} 
                        onNavigateToExposure={(site) => { setFocusSite(site); setModalMode('exposure_hh'); }}
                        onOpenKmModal={() => setModalMode('exposure_km')} 
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
            </div>
        </main>

        {/* === MODALS === */}
        {modalMode === 'exposure_hh' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div className="flex items-center">
                            <FileSpreadsheet className="w-5 h-5 text-blue-600 mr-2" />
                            <h3 className="font-bold text-gray-800">Carga Manual de Exposición (HH y KM Globales)</h3>
                        </div>
                        <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal" title="Cerrar">
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <ExposureManager 
                            exposureHours={exposureHours} 
                            exposureKm={exposureKm} 
                            globalKmRecords={globalKm}
                            sites={uniqueValues.sites} 
                            missingKeys={getMissingExposureKeys(incidents, exposureHours)} 
                            initialSite={focusSite}
                            viewMode="full"
                            onUpdate={(h, k, g) => { setExposureHours(h); setExposureKm(k); setGlobalKm(g); }} 
                        />
                    </div>
                </div>
            </div>
        )}

        {modalMode === 'exposure_km' && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b flex justify-between items-center bg-purple-50">
                        <div className="flex items-center">
                            <Zap className="w-5 h-5 text-purple-600 mr-2" />
                            <h3 className="font-bold text-purple-900">Actualización de Flota (KM)</h3>
                        </div>
                        <button onClick={() => setModalMode(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar modal" title="Cerrar">
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="p-6">
                        <ExposureManager 
                            exposureHours={exposureHours} 
                            exposureKm={exposureKm} 
                            globalKmRecords={globalKm}
                            sites={uniqueValues.sites} 
                            initialSite={undefined}
                            viewMode="km_only"
                            onUpdate={(h, k, g) => { setExposureHours(h); setExposureKm(k); setGlobalKm(g); setModalMode(null); }} 
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

        {modalMode === 'pdf_export' && (
            <PDFExportCenter 
                onClose={() => setModalMode(null)}
                incidents={filteredIncidents}
                allIncidents={incidents}
                metrics={currentMetrics}
                exposureHours={exposureHours}
                exposureKm={exposureKm}
                settings={settings}
                missingExposure={currentMissingImpact}
                currentView={activeTab}
                filters={filters}
            />
        )}
    </div>
  );
};

export default App;