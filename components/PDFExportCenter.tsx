
import React, { useState } from 'react';
import { PDFExportConfig, Incident, DashboardMetrics, ExposureHour, MissingExposureImpact, ExposureKm, AppSettings } from '../types';
import { PDFGenerator } from '../utils/pdfExportService';
import { FileText, CheckCircle2, X, Image as ImageIcon, Layout, List } from 'lucide-react';
import html2canvas from 'html2canvas';
import { calculateKPIs } from '../utils/calculations';
import { getMissingExposureImpact } from '../utils/importHelpers';
import { TARGET_SCENARIOS } from '../constants';

interface PDFExportCenterProps {
  onClose: () => void;
  incidents: Incident[]; // Filtered
  allIncidents: Incident[]; // Full dataset
  metrics: DashboardMetrics; // Based on filtered
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
  settings: AppSettings;
  missingExposure: MissingExposureImpact[];
  currentView: string; 
  filters: any;
}

export const PDFExportCenter: React.FC<PDFExportCenterProps> = ({
    onClose, incidents, allIncidents, metrics, exposureHours, exposureKm, settings, missingExposure, currentView, filters
}) => {
  const [scope, setScope] = useState<'CURRENT_VIEW' | 'FULL_REPORT'>('CURRENT_VIEW');
  const [detail, setDetail] = useState<'SUMMARY' | 'FULL_APPENDIX'>('SUMMARY');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Sections toggle
  const [sections, setSections] = useState({
      kpis: true,
      management: true, // New Section Default
      preventive: true, // Advanced Preventive
      trends: true,
      rawTable: false,
      normalizedTable: false,
      pendingTasks: true,
      safetyTalk: false,
      calendar: false
  });

  const handleGenerate = async () => {
      setIsGenerating(true);
      
      // Determine Dataset to use
      const isFullReport = scope === 'FULL_REPORT';
      const targetIncidents = isFullReport ? allIncidents : incidents;
      
      // Recalculate Metrics if Full Report needed (independent of UI filters)
      let targetMetrics = metrics;
      let targetMissing = missingExposure;
      
      if (isFullReport) {
          targetMetrics = calculateKPIs(allIncidents, exposureHours, exposureKm, settings, TARGET_SCENARIOS.Realista);
          targetMissing = getMissingExposureImpact(allIncidents, exposureHours);
      }

      // 1. Capture Charts (Only valid if CURRENT_VIEW, otherwise charts in DOM don't match data)
      let chartImage = undefined;
      if (!isFullReport && (sections.trends || sections.kpis)) {
          const chartElement = document.getElementById('dashboard-charts-container');
          if (chartElement) {
              try {
                  const canvas = await html2canvas(chartElement, { scale: 2 });
                  chartImage = canvas.toDataURL('image/png');
              } catch (e) {
                  console.warn("Could not capture charts", e);
              }
          }
      }

      // 2. Prepare Config
      const config: PDFExportConfig = {
          scope,
          detailLevel: detail,
          sections,
          filters: isFullReport ? {
              site: 'TODOS (Global)',
              year: 'TODOS',
              month: 'TODOS',
              type: 'TODOS'
          } : {
              site: filters.site || 'Todos',
              year: filters.year || 'Todos',
              month: filters.month || 'Todos',
              type: filters.type || 'Todos'
          },
          meta: { fileName: `SST_Reporte_${scope}_${new Date().getTime()}.pdf`, generatedBy: 'SST Metrics Pro' }
      };

      // 3. Init Generator
      const generator = new PDFGenerator(config);
      generator.addCoverPage();

      // 4. Build Sections with Correct Data
      if (scope === 'FULL_REPORT' || sections.kpis) {
          generator.addKPISection(targetMetrics, chartImage);
      }

      if (scope === 'FULL_REPORT' || sections.management) {
          generator.addManagementSection(targetMetrics.top5Sites, targetMetrics.daysSinceList, targetMetrics.trendAlerts);
      }

      if (scope === 'FULL_REPORT' || sections.preventive) {
          // Pass only Evolutions and Actions (Objectives removed)
          generator.addPreventiveAnalysisSection(targetMetrics.siteEvolutions, targetMetrics.suggestedActions);
      }

      if (scope === 'FULL_REPORT' || sections.pendingTasks) {
          generator.addPendingTasksSection(targetMissing);
      }

      if (scope === 'FULL_REPORT' || sections.rawTable || sections.normalizedTable) {
          // Prepare data
          // Force Full list if Full Appendix is selected, otherwise stick to Summary
          const limit = detail === 'FULL_APPENDIX' ? targetIncidents.length : 15;
          
          const rows = targetIncidents.slice(0, limit).map(i => [
              i.incident_id, i.fecha_evento, i.site, i.type, i.potential_risk, i.recordable_osha ? 'SI' : 'NO'
          ]);
          
          generator.addTableSection(
              "Listado de Incidentes", 
              ['ID', 'Fecha', 'Sitio', 'Tipo', 'Severidad', 'Recordable'], 
              rows, 
              detail === 'SUMMARY' && targetIncidents.length > 15
          );
      }

      if (sections.safetyTalk) {
          // Safety talk uses today as reference if filters are broad
          const date = new Date().toISOString().split('T')[0];
          generator.addSafetyTalkSection(date, targetIncidents, targetIncidents); 
      }

      // 5. Save
      generator.finalSave(config.meta.fileName);
      setIsGenerating(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col my-8">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white rounded-t-xl">
                <div className="flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-red-500" />
                    <div>
                        <h3 className="font-bold text-lg">Centro de Exportación PDF</h3>
                        <p className="text-xs text-slate-400">Generador de reportes A4 profesional</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6"/></button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Configuration */}
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Alcance del Reporte</label>
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => setScope('CURRENT_VIEW')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded border ${scope==='CURRENT_VIEW' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Vista Actual
                            </button>
                            <button 
                                onClick={() => { setScope('FULL_REPORT'); setDetail('FULL_APPENDIX'); }}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded border ${scope==='FULL_REPORT' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Reporte Completo
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Nivel de Detalle (Tablas)</label>
                        <div className="flex space-x-2">
                            <button 
                                onClick={() => setDetail('SUMMARY')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded border ${detail==='SUMMARY' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Resumen (Top 15)
                            </button>
                            <button 
                                onClick={() => setDetail('FULL_APPENDIX')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded border ${detail==='FULL_APPENDIX' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Completo (Anexos)
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Secciones a Incluir</label>
                        <div className="space-y-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={sections.kpis} onChange={e => setSections({...sections, kpis: e.target.checked})} className="rounded text-blue-600"/>
                                <span>KPIs y Métricas</span>
                            </label>
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer bg-blue-50/50 p-1 rounded">
                                <input type="checkbox" checked={sections.management} onChange={e => setSections({...sections, management: e.target.checked})} className="rounded text-blue-600"/>
                                <span className="font-bold text-blue-700">Gestión Operativa</span>
                            </label>
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer bg-purple-50/50 p-1 rounded">
                                <input type="checkbox" checked={sections.preventive} onChange={e => setSections({...sections, preventive: e.target.checked})} className="rounded text-purple-600"/>
                                <span className="font-bold text-purple-700">Mejora Continua (Nuevo)</span>
                            </label>
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={sections.trends} onChange={e => setSections({...sections, trends: e.target.checked})} className="rounded text-blue-600"/>
                                <span>Gráficos de Tendencia</span>
                            </label>
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={sections.rawTable} onChange={e => setSections({...sections, rawTable: e.target.checked})} className="rounded text-blue-600"/>
                                <span>Tabla de Incidentes</span>
                            </label>
                            <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={sections.pendingTasks} onChange={e => setSections({...sections, pendingTasks: e.target.checked})} className="rounded text-blue-600"/>
                                <span>Estado de Pendientes (HH/KM)</span>
                            </label>
                             <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                                <input type="checkbox" checked={sections.safetyTalk} onChange={e => setSections({...sections, safetyTalk: e.target.checked})} className="rounded text-blue-600"/>
                                <span>Charla de 5 Minutos (Anexo)</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Preview / Info */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex flex-col justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-2">Resumen de Exportación</h4>
                        <ul className="text-xs text-gray-500 space-y-2">
                            <li className="flex items-center"><Layout className="w-3 h-3 mr-2"/> Alcance: {scope === 'FULL_REPORT' ? 'Base Completa' : 'Vista Filtrada'}</li>
                            <li className="flex items-center"><ImageIcon className="w-3 h-3 mr-2"/> Gráficos: {sections.trends && scope !== 'FULL_REPORT' ? 'Incluidos' : 'Omitidos (Modo Server)'}</li>
                            <li className="flex items-center"><List className="w-3 h-3 mr-2"/> Filas tabla: {detail === 'SUMMARY' ? 'Máx 15' : 'Todas (Sin Límite)'}</li>
                        </ul>
                    </div>
                    
                    <div className="mt-6">
                        <div className="bg-yellow-50 border border-yellow-200 p-2 rounded text-[10px] text-yellow-800 mb-4">
                            <strong>Nota:</strong> Al seleccionar "Reporte Completo", se recalcularán los KPIs y se exportarán todos los datos ignorando los filtros de pantalla.
                        </div>
                        
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-lg flex justify-center items-center transition-all disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <>Generando PDF...</>
                            ) : (
                                <>
                                    <FileText className="w-5 h-5 mr-2"/> Generar PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
