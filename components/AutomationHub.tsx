
import React, { useState, useRef } from 'react';
import { Incident, SharePointConfig } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2, ShieldCheck, HardDrive, Sparkles, Cpu, ChevronRight, Cloud, CloudSync, Settings2, Link2 } from 'lucide-react';
import { SharePointModal } from './SharePointModal';

interface AutomationHubProps {
  incidents: Incident[];
  lastUpdate: string | null;
  onFileUpload: (file: File) => Promise<void>;
  isProcessing: boolean;
  sharepointConfig: SharePointConfig;
  onUpdateSharePoint: (config: SharePointConfig) => void;
  onTriggerSync: () => Promise<void>;
}

export const AutomationHub: React.FC<AutomationHubProps> = ({ 
    incidents, lastUpdate, onFileUpload, isProcessing, sharepointConfig, onUpdateSharePoint, onTriggerSync 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.endsWith('.xlsx')) return;
      await onFileUpload(file);
  };

  const isConnected = sharepointConfig.authStatus === 'CONNECTED';

  return (
    <div className="max-w-5xl mx-auto py-12 space-y-16">
        
        {showConfig && (
            <SharePointModal 
                config={sharepointConfig} 
                onClose={() => setShowConfig(false)} 
                onUpdate={onUpdateSharePoint} 
            />
        )}

        <div className="text-center">
            <div className="inline-flex p-6 rounded-[2.5rem] bg-indigo-600 text-white mb-8 shadow-2xl shadow-indigo-200">
                <Cpu className="w-12 h-12" />
            </div>
            <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">Intelligence <span className="text-indigo-600">Core</span></h2>
            <p className="text-xl text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
                Centralice la gestión de seguridad conectando su base de datos de SharePoint o procesando archivos locales.
            </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* SOURCE: LOCAL UPLOAD */}
            <div className={`lg:col-span-7 mega-card-saas p-12 text-center group border-2 border-dashed flex flex-col items-center justify-center min-h-[500px] ${
                dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} 
            onDragLeave={() => setDragActive(false)} 
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}>
                
                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx" onChange={(e) => handleFiles(e.target.files)} />

                {isProcessing ? (
                    <div className="flex flex-col items-center">
                        <div className="relative mb-10">
                            <div className="w-24 h-24 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Estructurando Base...</h3>
                    </div>
                ) : (
                    <>
                        <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform duration-700 shadow-xl">
                            <Upload className="w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">Carga Local</h3>
                        <p className="text-slate-400 font-bold mb-10 text-sm">Arrastre el Excel de incidentes aquí</p>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="px-10 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-indigo-50 flex items-center gap-3"
                        >
                            Seleccionar Archivo
                        </button>
                    </>
                )}
            </div>

            {/* SOURCE: SHAREPOINT SYNC */}
            <div className={`lg:col-span-5 mega-card-saas p-12 flex flex-col justify-between transition-all ${isConnected ? 'bg-indigo-600 text-white border-transparent' : 'bg-slate-100/50'}`}>
                <div>
                    <div className="flex justify-between items-start mb-10">
                        <div className={`p-4 rounded-2xl ${isConnected ? 'bg-white/20' : 'bg-white text-indigo-600 shadow-sm border border-slate-100'}`}>
                            <CloudSync className="w-8 h-8" />
                        </div>
                        <button 
                            onClick={() => setShowConfig(true)}
                            className={`p-2 rounded-xl transition-colors ${isConnected ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-200 text-slate-400'}`}
                        >
                            <Settings2 className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <h3 className={`text-3xl font-black tracking-tighter mb-2 ${isConnected ? 'text-white' : 'text-slate-900'}`}>SharePoint</h3>
                    <p className={`text-sm font-medium ${isConnected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {isConnected ? 'Biblioteca vinculada y lista.' : 'Conecte su biblioteca corporativa.'}
                    </p>
                    
                    {isConnected && (
                        <div className="mt-8 space-y-4">
                            <div className="flex items-center gap-3 text-xs font-bold text-indigo-200 uppercase tracking-widest">
                                <Link2 className="w-4 h-4"/> QHSE / Repo Incidentes iAuditor
                            </div>
                            <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-200 mb-1">
                                    <span>Última Sincronización</span>
                                    <span>{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '--:--'}</span>
                                </div>
                                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                                    <div className="h-full bg-white transition-all duration-1000" style={{width: isProcessing ? '60%' : '100%'}}></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-10">
                    {isConnected ? (
                        <button 
                            onClick={onTriggerSync}
                            disabled={isProcessing}
                            className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isProcessing ? <Cloud className="animate-bounce"/> : <CloudSync className="w-4 h-4"/>}
                            Sincronizar Ahora
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowConfig(true)}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 flex items-center justify-center gap-3"
                        >
                            <Link2 className="w-4 h-4"/> Conectar Biblioteca
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
                { label: 'Registros', val: incidents.length.toLocaleString(), icon: CheckCircle2, col: 'indigo' },
                { label: 'Cloud Connection', val: isConnected ? 'Active' : 'Offline', icon: Cloud, col: 'emerald' },
                { label: 'Integration', val: 'Enterprise', icon: HardDrive, col: 'slate' }
            ].map((stat, i) => (
                <div key={i} className="mega-card-saas p-8 flex items-center gap-8 shadow-sm">
                    <div className="p-5 rounded-2xl bg-slate-50 text-slate-900"><stat.icon className="w-7 h-7" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.val}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
