
import React, { useMemo } from 'react';
import { Incident } from '../types';
import { Beaker, Check, X, ArrowRight, AlertTriangle } from 'lucide-react';

interface LabControlsProps {
  isSandbox: boolean;
  productionCount: number;
  sandboxCount: number;
  onCommit: () => void;
  onDiscard: () => void;
  onToggle: () => void;
}

export const LabControls: React.FC<LabControlsProps> = ({ 
    isSandbox, productionCount, sandboxCount, onCommit, onDiscard, onToggle 
}) => {
  
  const diff = sandboxCount - productionCount;
  
  if (!isSandbox) {
      return (
          <button 
            onClick={onToggle}
            className="flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
            title="Abrir entorno de pruebas seguro"
          >
              <Beaker className="w-4 h-4 mr-2" />
              Modo Laboratorio
          </button>
      );
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white p-2 rounded-xl shadow-2xl z-50 flex items-center space-x-4 border border-slate-700 animate-in slide-in-from-bottom-5 print:hidden">
        <div className="flex items-center px-3 border-r border-slate-700">
            <Beaker className="w-5 h-5 text-amber-400 mr-2 animate-pulse" />
            <div>
                <p className="text-xs font-bold text-amber-400 uppercase">Sandbox Activo</p>
                <p className="text-[10px] text-slate-400">Los cambios no son permanentes</p>
            </div>
        </div>

        <div className="px-2">
            <div className="flex items-center space-x-4 text-xs">
                <div>
                    <span className="block text-slate-500">Producción</span>
                    <span className="font-mono">{productionCount}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600" />
                <div>
                    <span className="block text-slate-500">Laboratorio</span>
                    <span className={`font-mono font-bold ${diff !== 0 ? 'text-blue-400' : ''}`}>
                        {sandboxCount}
                    </span>
                </div>
                {diff !== 0 && (
                     <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${diff > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                         {diff > 0 ? '+' : ''}{diff} regs
                     </span>
                )}
            </div>
        </div>

        <div className="flex items-center space-x-2 pl-2 border-l border-slate-700">
             <button 
                onClick={onDiscard}
                className="flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 hover:text-red-400 border border-transparent transition-colors"
            >
                <X className="w-4 h-4 mr-1" /> Descartar
            </button>
            <button 
                onClick={onCommit}
                className="flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white shadow-sm transition-colors"
            >
                <Check className="w-4 h-4 mr-1" /> Aplicar a Producción
            </button>
        </div>
    </div>
  );
};
