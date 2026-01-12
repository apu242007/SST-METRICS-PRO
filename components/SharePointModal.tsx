
import React, { useState } from 'react';
import { SharePointConfig } from '../types';
import { X, ShieldCheck, Link2, Globe, FileStack, AlertCircle, Loader2 } from 'lucide-react';
import { connectToSharePoint } from '../services/sharepointService';

interface SharePointModalProps {
    config: SharePointConfig;
    onClose: () => void;
    onUpdate: (newConfig: SharePointConfig) => void;
}

export const SharePointModal: React.FC<SharePointModalProps> = ({ config, onClose, onUpdate }) => {
    const [localConfig, setLocalConfig] = useState<SharePointConfig>(config);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            const updated = await connectToSharePoint(localConfig);
            onUpdate(updated);
            setTimeout(onClose, 800);
        } catch (e: any) {
            setError(e.message || "Error al conectar");
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-entrance">
                <div className="bg-indigo-600 p-8 text-white flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-xl"><Link2 className="w-5 h-5"/></div>
                            <h3 className="text-2xl font-black tracking-tight">Vincular SharePoint</h3>
                        </div>
                        <p className="text-indigo-100 text-sm font-medium">Configure el acceso directo a la biblioteca de incidentes iAuditor.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-6 h-6"/></button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="relative group">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Site URL</label>
                            <div className="relative">
                                <Globe className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                    value={localConfig.siteUrl}
                                    onChange={e => setLocalConfig({...localConfig, siteUrl: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Tenant ID</label>
                                <input 
                                    type="text" 
                                    placeholder="00000000-0000-..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                    value={localConfig.tenantId}
                                    onChange={e => setLocalConfig({...localConfig, tenantId: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Client ID</label>
                                <input 
                                    type="text" 
                                    placeholder="00000000-0000-..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                    value={localConfig.clientId}
                                    onChange={e => setLocalConfig({...localConfig, clientId: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Biblioteca / Carpeta</label>
                            <div className="relative">
                                <FileStack className="w-4 h-4 absolute left-4 top-3.5 text-slate-400" />
                                <input 
                                    type="text" 
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none"
                                    value={localConfig.libraryName}
                                    onChange={e => setLocalConfig({...localConfig, libraryName: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="pt-4">
                        <button 
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isConnecting ? (
                                <><Loader2 className="w-4 h-4 animate-spin"/> Validando Credenciales...</>
                            ) : (
                                <><ShieldCheck className="w-4 h-4"/> Autorizar y Guardar</>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-slate-400 mt-4 font-medium uppercase tracking-tighter">Conexión encriptada vía Microsoft Entra ID</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
