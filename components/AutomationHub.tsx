
import React, { useState } from 'react';
import { SharePointConfig, ScheduledReport, SyncLog, Incident, AppSettings } from '../types';
import { Cloud, RefreshCw, Calendar, CheckCircle2, AlertTriangle, Play, FileText, Plus, Trash2, Power } from 'lucide-react';
import { mockCheckForUpdates, processScheduledReports } from '../services/sharepointService';

interface AutomationHubProps {
  config: SharePointConfig;
  logs: SyncLog[];
  reports: ScheduledReport[];
  incidents: Incident[]; // For simulation context
  onUpdateConfig: (cfg: SharePointConfig) => void;
  onUpdateReports: (reports: ScheduledReport[]) => void;
  onManualSyncTrigger: () => void;
}

export const AutomationHub: React.FC<AutomationHubProps> = ({ 
    config, logs, reports, incidents, 
    onUpdateConfig, onUpdateReports, onManualSyncTrigger 
}) => {
  const [activeTab, setActiveTab] = useState<'sharepoint' | 'scheduler'>('sharepoint');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRunningJobs, setIsRunningJobs] = useState(false);

  // Scheduler Form State
  const [newReportName, setNewReportName] = useState('');
  const [newFrequency, setNewFrequency] = useState<'WEEKLY'|'MONTHLY'>('MONTHLY');
  const [newSiteFilter, setNewSiteFilter] = useState('ALL');

  const uniqueSites = Array.from(new Set(incidents.map(i => i.site))).sort();

  const handleToggleSharePoint = () => {
    onUpdateConfig({ ...config, isEnabled: !config.isEnabled });
  };

  const handleTestConnection = async () => {
      setIsSyncing(true);
      try {
          // Simulate Check
          const result = await mockCheckForUpdates(config);
          if (result.hasUpdates) {
             alert("¡Conexión Exitosa! Se detectaron nuevas versiones en el servidor.");
          } else {
             alert("Conexión Exitosa. El archivo local está actualizado.");
          }
      } catch (e) {
          alert("Error de conexión con SharePoint simulado.");
      } finally {
          setIsSyncing(false);
      }
  };

  const handleAddReport = () => {
      if(!newReportName) return;
      const newReport: ScheduledReport = {
          id: Date.now().toString(),
          name: newReportName,
          frequency: newFrequency,
          siteFilter: newSiteFilter,
          templateType: 'KPI_SUMMARY',
          lastRun: null,
          nextRun: new Date().toISOString(), // Due immediately for demo
          active: true
      };
      onUpdateReports([...reports, newReport]);
      setNewReportName('');
  };

  const handleDeleteReport = (id: string) => {
      onUpdateReports(reports.filter(r => r.id !== id));
  };

  const handleRunPendingJobs = async () => {
      setIsRunningJobs(true);
      // Simulate processing
      // In a real app, this function needs access to the 'generateBlob' logic.
      // We are passing a dummy generator here just to update the timestamps in the UI.
      const dummyGenerator = () => "blob_data"; 
      
      const updated = await processScheduledReports(reports, config, dummyGenerator);
      onUpdateReports(updated);
      setIsRunningJobs(false);
      alert("Proceso de reportes completado. Los archivos han sido 'subidos' a SharePoint.");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px] flex flex-col">
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('sharepoint')}
            className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'sharepoint'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Cloud className="w-5 h-5 mr-2" />
            Integración SharePoint
          </button>
          <button
            onClick={() => setActiveTab('scheduler')}
            className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
              activeTab === 'scheduler'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Programador de Reportes
          </button>
        </nav>
      </div>

      <div className="p-6 flex-1 bg-gray-50/50">
        
        {/* === SHAREPOINT TAB === */}
        {activeTab === 'sharepoint' && (
            <div className="space-y-6 animate-in fade-in">
                {/* Config Card */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Configuración de Conexión</h3>
                            <p className="text-sm text-gray-500">Conecte la App con una Biblioteca de Documentos para la ingesta automática (Incremental).</p>
                        </div>
                        <button 
                            onClick={handleToggleSharePoint}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${config.isEnabled ? 'bg-green-600' : 'bg-gray-200'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${config.isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!config.isEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <label className="block text-xs font-bold text-gray-700">SharePoint Site URL</label>
                            <input 
                                type="text" 
                                value={config.siteUrl} 
                                onChange={(e) => onUpdateConfig({...config, siteUrl: e.target.value})}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700">Nombre de Biblioteca</label>
                            <input 
                                type="text" 
                                value={config.libraryName} 
                                onChange={(e) => onUpdateConfig({...config, libraryName: e.target.value})}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-700">Archivo de Incidentes</label>
                            <input 
                                type="text" 
                                value={config.incidentFileName} 
                                onChange={(e) => onUpdateConfig({...config, incidentFileName: e.target.value})}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                            />
                        </div>
                        <div className="flex items-end">
                            <button 
                                onClick={handleTestConnection} 
                                disabled={isSyncing}
                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <CheckCircle2 className="w-4 h-4 mr-2 text-green-600"/>}
                                Probar Conexión
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sync History Log */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-sm">Registro de Sincronización (Event Logs)</h3>
                        <button onClick={onManualSyncTrigger} className="text-xs text-blue-600 hover:underline flex items-center">
                            <Play className="w-3 h-3 mr-1"/> Ejecutar Ahora
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mensaje</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.length === 0 ? (
                                    <tr><td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">Sin eventos registrados.</td></tr>
                                ) : (
                                    logs.slice().reverse().map(log => (
                                        <tr key={log.id}>
                                            <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(log.date).toLocaleString()}</td>
                                            <td className="px-6 py-2 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' : 
                                                    log.status === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2 text-xs text-gray-700">{log.message}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* === SCHEDULER TAB === */}
        {activeTab === 'scheduler' && (
            <div className="space-y-6 animate-in fade-in">
                
                {/* Create Job */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Crear Nueva Tarea</h3>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Reporte</label>
                            <input type="text" value={newReportName} onChange={e => setNewReportName(e.target.value)} placeholder="Ej: Reporte Mensual Planta A" className="w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm"/>
                        </div>
                        <div className="w-40">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Frecuencia</label>
                            <select value={newFrequency} onChange={(e) => setNewFrequency(e.target.value as any)} className="w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm bg-white">
                                <option value="WEEKLY">Semanal</option>
                                <option value="MONTHLY">Mensual</option>
                            </select>
                        </div>
                        <div className="w-48">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Filtro Sitio (Plantilla)</label>
                            <select value={newSiteFilter} onChange={(e) => setNewSiteFilter(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm border p-2 text-sm bg-white">
                                <option value="ALL">Todos los Sitios</option>
                                {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <button onClick={handleAddReport} disabled={!newReportName} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50">
                            <Plus className="w-4 h-4 mr-2"/> Agregar
                        </button>
                    </div>
                </div>

                {/* Job List */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-sm">Tareas Programadas</h3>
                        <button 
                            onClick={handleRunPendingJobs}
                            disabled={isRunningJobs}
                            className="inline-flex items-center px-3 py-1.5 border border-purple-200 text-xs font-medium rounded text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                        >
                            {isRunningJobs ? <RefreshCw className="w-3 h-3 mr-1 animate-spin"/> : <Play className="w-3 h-3 mr-1"/>}
                            Ejecutar Pendientes (Simulación)
                        </button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {reports.length === 0 && <li className="px-6 py-8 text-center text-sm text-gray-500">No hay reportes programados.</li>}
                        {reports.map(report => (
                            <li key={report.id} className="px-6 py-4 hover:bg-gray-50 flex justify-between items-center">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0 pt-1">
                                        <FileText className="w-8 h-8 text-purple-300" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-bold text-gray-900">{report.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {report.frequency} • Sitio: {report.siteFilter} • Próxima: {new Date(report.nextRun).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Última ejecución: {report.lastRun ? new Date(report.lastRun).toLocaleString() : 'Nunca'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${report.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {report.active ? 'ACTIVO' : 'PAUSADO'}
                                    </div>
                                    <button onClick={() => handleDeleteReport(report.id)} className="text-gray-400 hover:text-red-500 p-2">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-800 flex items-start">
                    <Cloud className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Nota sobre Automatización:</strong> Dado que esta aplicación se ejecuta en el navegador, la "automatización" real depende de que la aplicación sea abierta. 
                        En un entorno de producción, los reportes se generan cuando un usuario accede al dashboard, o mediante un servicio backend dedicado.
                        Aquí simulamos el "cron job" al presionar "Ejecutar Pendientes".
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
