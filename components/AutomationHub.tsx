
import React, { useState, useRef } from 'react';
import { Incident } from '../types';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, FileText, HardDrive, ShieldCheck } from 'lucide-react';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
      setErrorMsg(null);
      if (!files || files.length === 0) return;
      
      const file = files[0];
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx')) {
          setErrorMsg("Formato no válido. Por favor suba el archivo 'basedatosincidentes.xlsx'.");
          return;
      }

      try {
          await onFileUpload(file);
      } catch (e: any) {
          setErrorMsg(e.message || "Error al procesar el archivo.");
      }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 flex justify-center items-center mb-2">
                <HardDrive className="w-8 h-8 mr-3 text-blue-600"/>
                Fuente de Datos
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
                Gestione la base de datos de incidentes. Cargue el archivo Excel estándar para actualizar los indicadores automáticamente.
            </p>
        </div>

        {/* Upload Area */}
        <div 
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ease-in-out ${
                dragActive ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
            onDragEnter={onDrag} 
            onDragLeave={onDrag} 
            onDragOver={onDrag} 
            onDrop={onDrop}
        >
            <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".xlsx"
                onChange={(e) => handleFiles(e.target.files)}
                disabled={isProcessing}
            />

            {isProcessing ? (
                <div className="flex flex-col items-center py-4">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <h3 className="text-lg font-bold text-gray-700">Procesando archivo...</h3>
                    <p className="text-sm text-gray-500">Normalizando datos y calculando KPIs</p>
                </div>
            ) : (
                <div className="flex flex-col items-center pointer-events-none">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Subir archivo Excel
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        Arrastre el archivo aquí o haga clic para buscar.
                        <br/><span className="text-xs opacity-75">(basedatosincidentes.xlsx)</span>
                    </p>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="pointer-events-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-colors text-sm"
                    >
                        Seleccionar Archivo
                    </button>
                </div>
            )}

            {dragActive && (
                <div className="absolute inset-0 bg-blue-100/50 flex items-center justify-center rounded-xl pointer-events-none">
                    <p className="text-blue-700 font-bold text-lg">Suelta el archivo para subirlo</p>
                </div>
            )}
        </div>

        {/* Error Message */}
        {errorMsg && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start animate-in slide-in-from-top-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-red-800">Error de Carga</h4>
                    <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
                </div>
            </div>
        )}

        {/* Status Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100 pt-6">
            <div className="flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${incidents.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Registros Cargados</p>
                    <p className="text-lg font-bold text-gray-900">{incidents.length.toLocaleString()}</p>
                </div>
            </div>

            <div className="flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${lastUpdate ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Última Actualización</p>
                    <p className="text-sm font-bold text-gray-900">
                        {lastUpdate ? new Date(lastUpdate).toLocaleString() : 'Pendiente'}
                    </p>
                </div>
            </div>

            <div className="flex items-center">
                <div className="p-2 rounded-lg mr-3 bg-purple-100 text-purple-700">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Modo de Operación</p>
                    <p className="text-sm font-bold text-gray-900">Carga Manual (Local)</p>
                </div>
            </div>
        </div>

        {incidents.length > 0 && !errorMsg && !isProcessing && (
            <div className="mt-6 text-center">
                <p className="text-sm text-green-600 font-medium flex justify-center items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Base de datos activa y lista para visualizar.
                </p>
            </div>
        )}
    </div>
  );
};
