import React, { useState, useRef } from 'react';
import { Incident } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2, ShieldCheck, HardDrive, Sparkles, Cpu, ChevronRight } from 'lucide-react';

interface AutomationHubProps {
  incidents: Incident[];
  lastUpdate: string | null;
  onFileUpload: (file: File) => Promise<void>;
  isProcessing: boolean;
}

export const AutomationHub: React.FC<AutomationHubProps> = ({ 
    incidents, lastUpdate, onFileUpload, isProcessing 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.name.endsWith('.xlsx')) return;
      await onFileUpload(file);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-16">
        
        <div className="text-center">
            <div className="inline-flex p-6 rounded-[2.5rem] bg-indigo-600 text-white mb-8 shadow-2xl shadow-indigo-200">
                <Cpu className="w-12 h-12" />
            </div>
            <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">Intelligence <span className="text-indigo-600">Core</span></h2>
            <p className="text-xl text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
                Normaliza y procesa miles de registros de incidentes en segundos con nuestro motor IA de clasificación automática.
            </p>
        </div>

        <div 
            className={`mega-card-saas p-24 text-center group border-2 border-dashed ${
                dragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} 
            onDragLeave={() => setDragActive(false)} 
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        >
            <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx" onChange={(e) => handleFiles(e.target.files)} />

            {isProcessing ? (
                <div className="flex flex-col items-center py-10">
                    <div className="relative mb-10">
                        <div className="w-24 h-24 border-8 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Estructurando Base...</h3>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-4">Analizando variables y descriptores</p>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="w-28 h-28 bg-slate-900 rounded-[3rem] flex items-center justify-center text-white mb-10 group-hover:scale-110 transition-transform duration-700 shadow-2xl">
                        <Upload className="w-12 h-12" />
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Arrastre su base de datos</h3>
                    <p className="text-slate-400 font-bold mb-14 flex items-center gap-3">
                        <FileSpreadsheet className="w-5 h-5" /> Formatos compatibles: <span className="text-slate-800">.XLSX</span>
                    </p>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-12 py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black tracking-widest uppercase text-xs shadow-2xl shadow-indigo-200 transition-all hover:bg-indigo-700 flex items-center gap-4 group/btn"
                    >
                        Seleccionar Archivo
                        <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                    </button>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
                { label: 'Registros', val: incidents.length.toLocaleString(), icon: CheckCircle2, col: 'indigo' },
                { label: 'Sincronización', val: lastUpdate ? 'Live' : 'Ready', icon: ShieldCheck, col: 'emerald' },
                { label: 'Environment', val: 'Corporate', icon: HardDrive, col: 'slate' }
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