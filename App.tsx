import React, { useState, useEffect, useMemo } from 'react';
import { Dashboard } from './components/Dashboard';
import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule, GlobalKmRecord, SGIDocument } from './types';
import { calculateKPIs } from './utils/calculations';
import { loadState, saveState, clearState, upsertIncidents, updateIncidentManual } from './services/storage';
import { parseIncidentsExcel, generateAutoExposureRecords, getMissingExposureImpact } from './utils/importHelpers';
import { 
  LayoutDashboard, Layers, Zap, 
  HardDrive, BookOpen, CalendarDays, 
  Settings2, Search, Bell, RefreshCcw, FileText, X, Sparkles
} from 'lucide-react';
import { TARGET_SCENARIOS } from './constants';

import { AutomationHub } from './components/AutomationHub';
import { DataExplorer } from './components/DataExplorer';
import { PendingTasks } from './components/PendingTasks';
import { CalendarView } from './components/CalendarView';
import { DocumentLibrary } from './components/DocumentLibrary';

const App: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [exposureHours, setExposureHours] = useState<ExposureHour[]>([]);
  const [globalKm, setGlobalKm] = useState<GlobalKmRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ base_if: 1000000, base_trir: 200000, days_cap: 180 });
  const [rules, setRules] = useState<MappingRule[]>([]);
  const [sgiDocuments, setSgiDocuments] = useState<SGIDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'kpis' | 'automation' | 'raw' | 'pending' | 'docs' | 'calendar'>('automation');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAppSync, setLastAppSync] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = loadState();
    setIncidents(data.incidents);
    setExposureHours(data.exposure_hours);
    setGlobalKm(data.global_km || []);
    setSettings(data.settings);
    setRules(data.rules);
    setSgiDocuments(data.sgi_documents || []);
    if (data.sharepoint_config?.lastSyncDate) setLastAppSync(data.sharepoint_config.lastSyncDate);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveState({ 
          incidents, exposure_hours: exposureHours, exposure_km: [], global_km: globalKm, settings, rules, load_history: [],
          sharepoint_config: { isEnabled: false, tenantId: '', siteUrl: '', libraryName: '', incidentFileName: '', reportFolderPath: '', lastSyncDate: lastAppSync, lastFileHash: null }, 
          sync_logs: [], scheduled_reports: [], sgi_documents: sgiDocuments
      });
    }
  }, [incidents, exposureHours, globalKm, settings, rules, isLoaded, lastAppSync, sgiDocuments]);

  const handleFileUpload = async (file: File) => {
      setIsProcessing(true);
      try {
          const arrayBuffer = await file.arrayBuffer();
          const { incidents: newRecords, rules: newRules } = parseIncidentsExcel(arrayBuffer, rules);
          const result = upsertIncidents(incidents, newRecords);
          setIncidents(result.incidents);
          setRules(newRules);
          setExposureHours(generateAutoExposureRecords(result.incidents, exposureHours));
          setLastAppSync(new Date().toISOString());
          setTimeout(() => setActiveTab('kpis'), 800);
      } catch (error: any) {
          alert(error.message || "Error al leer el archivo.");
      } finally {
          setIsProcessing(false);
      }
  };

  if (!isLoaded) return null;

  return (
    <div className="premium-canvas no-scrollbar">
      
      {/* 1. SIDEBAR FLOTANTE (ESTILO SAAS 2025) */}
      <aside className="sidebar-saas">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 mb-4 group cursor-pointer" onClick={() => setActiveTab('kpis')}>
              <Sparkles className="w-8 h-8 text-white transition-transform group-hover:rotate-12" />
          </div>

          <div className="flex-1 flex flex-col gap-4">
              <button onClick={() => setActiveTab('automation')} className={`nav-icon ${activeTab === 'automation' ? 'active' : ''}`} title="Cargar Datos"><HardDrive className="w-6 h-6"/></button>
              <button onClick={() => setActiveTab('kpis')} className={`nav-icon ${activeTab === 'kpis' ? 'active' : ''}`} title="Dashboard"><LayoutDashboard className="w-6 h-6"/></button>
              <button onClick={() => setActiveTab('raw')} className={`nav-icon ${activeTab === 'raw' ? 'active' : ''}`} title="Explorar"><Layers className="w-6 h-6"/></button>
              <button onClick={() => setActiveTab('pending')} className={`nav-icon ${activeTab === 'pending' ? 'active' : ''}`} title="Integridad"><Zap className="w-6 h-6"/></button>
              <button onClick={() => setActiveTab('docs')} className={`nav-icon ${activeTab === 'docs' ? 'active' : ''}`} title="SGI"><BookOpen className="w-6 h-6"/></button>
              <button onClick={() => setActiveTab('calendar')} className={`nav-icon ${activeTab === 'calendar' ? 'active' : ''}`} title="Agenda"><CalendarDays className="w-6 h-6"/></button>
          </div>

          <div className="flex flex-col gap-4">
              <button onClick={clearState} className="nav-icon hover:text-rose-500"><RefreshCcw className="w-6 h-6"/></button>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200"><Settings2 className="w-6 h-6 text-slate-500"/></div>
          </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col gap-6 overflow-hidden">
          
          {/* HEADER MINIMALISTA */}
          <header className="flex justify-between items-end h-24 px-4 pb-4">
              <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                      {activeTab === 'kpis' && 'Command Center'}
                      {activeTab === 'automation' && 'Intelligence Core'}
                      {activeTab === 'raw' && 'Data Explorer'}
                      {activeTab === 'pending' && 'Data Integrity'}
                      {activeTab === 'docs' && 'SGI Library'}
                      {activeTab === 'calendar' && 'Safety Agenda'}
                  </h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mt-2">SST Metrics Pro • Premium Access</p>
              </div>

              <div className="flex items-center gap-4">
                  <div className="relative group">
                      <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input type="text" placeholder="Smart Search..." className="w-64 pl-12 pr-4 py-3 bg-white/40 border border-transparent rounded-[1.25rem] text-xs font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm" />
                  </div>
                  <button className="w-12 h-12 flex items-center justify-center bg-white rounded-[1.25rem] shadow-sm relative"><Bell className="w-5 h-5 text-slate-600"/><div className="absolute top-3.5 right-3.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></div></button>
              </div>
          </header>

          {/* CONTENIDO (CANVAS) */}
          <div className="flex-1 overflow-y-auto no-scrollbar pr-4">
              <div className="animate-entrance stagger-1">
                {activeTab === 'automation' && <AutomationHub incidents={incidents} lastUpdate={lastAppSync} onFileUpload={handleFileUpload} isProcessing={isProcessing} />}
                {activeTab === 'kpis' && <Dashboard incidents={incidents} exposureHours={exposureHours} exposureKm={[]} globalKmRecords={globalKm} settings={settings} />}
                {activeTab === 'raw' && <DataExplorer incidents={incidents} mode="normalized" onUpdateIncident={(u) => setIncidents(updateIncidentManual(incidents, u))} />}
                {activeTab === 'pending' && <PendingTasks incidents={incidents} exposureHours={exposureHours} exposureKm={[]} onNavigateToExposure={() => {}} onNavigateToReview={() => setActiveTab('raw')} />}
                {activeTab === 'docs' && <DocumentLibrary documents={sgiDocuments} />}
                {activeTab === 'calendar' && <CalendarView incidents={incidents} />}
              </div>
          </div>
      </main>
    </div>
  );
};

export default App;