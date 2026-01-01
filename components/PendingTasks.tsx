
import React, { useMemo } from 'react';
import { Incident, ExposureHour, ExposureKm, SiteQualityScore } from '../types';
import { CheckCircle2, Database, ShieldAlert, ArrowRight, Clock } from 'lucide-react';
import { getMissingExposureImpact, getMissingExposureKeys, getMissingKmKeys } from '../utils/importHelpers';

interface PendingTasksProps {
  incidents: Incident[];
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
  onNavigateToExposure: (site?: string) => void;
  onNavigateToReview: (incidentId?: string) => void;
}

export const PendingTasks: React.FC<PendingTasksProps> = ({ 
  incidents, exposureHours, exposureKm, 
  onNavigateToExposure, onNavigateToReview 
}) => {
  
  // 1. Missing HH Impact Analysis (Prioritized)
  const missingImpact = useMemo(() => getMissingExposureImpact(incidents, exposureHours), [incidents, exposureHours]);
  const hasMissingHH = missingImpact.length > 0;

  // 2. Quality Scores per Site
  const qualityScores: SiteQualityScore[] = useMemo(() => {
    const sites = Array.from(new Set(incidents.map(i => i.site))).sort();
    return sites.map(site => {
        const siteIncidents = incidents.filter(i => i.site === site);
        const transitIncidents = siteIncidents.filter(i => i.is_transit_laboral);
        
        // HH Check
        const requiredPeriods = new Set(siteIncidents.map(i => i.fecha_evento.substring(0, 7)));
        const filledPeriods = new Set(exposureHours.filter(e => e.site === site && e.hours > 0).map(e => e.period));
        let hhMatch = 0;
        requiredPeriods.forEach(p => { if (filledPeriods.has(p)) hhMatch++; });
        const hhScore = requiredPeriods.size > 0 ? (hhMatch / requiredPeriods.size) * 100 : 100;

        // Review Check
        const reviewedCount = siteIncidents.filter(i => i.is_verified).length;
        const reviewScore = siteIncidents.length > 0 ? (reviewedCount / siteIncidents.length) * 100 : 100;

        // KM Check
        const requiredKmPeriods = new Set(transitIncidents.map(i => i.fecha_evento.substring(0, 7)));
        const filledKmPeriods = new Set(exposureKm.filter(k => k.site === site && k.km > 0).map(k => k.period));
        let kmMatch = 0;
        requiredKmPeriods.forEach(p => { if (filledKmPeriods.has(p)) kmMatch++; });
        const transitScore = requiredKmPeriods.size > 0 ? (kmMatch / requiredKmPeriods.size) * 100 : 100;

        // Weighted Avg
        let total = (hhScore + reviewScore + (requiredKmPeriods.size > 0 ? transitScore : 100)) / 3;

        return {
            site,
            score: total,
            hh_completeness: hhScore,
            review_completeness: reviewScore,
            transit_completeness: transitScore,
            missing_periods: Array.from(requiredPeriods).filter(p => !filledPeriods.has(p)),
            pending_reviews: siteIncidents.length - reviewedCount
        };
    }).sort((a,b) => a.score - b.score);
  }, [incidents, exposureHours, exposureKm]);

  // 3. Column Completeness Analysis
  const columnAudit = useMemo(() => {
      const total = incidents.length;
      if (total === 0) return [];
      
      const fields = [
          { key: 'potential_risk', label: 'Potencialidad' },
          { key: 'location', label: 'Ubicación' },
          { key: 'description', label: 'Descripción' }
      ];

      return fields.map(f => {
          const filled = incidents.filter(i => i[f.key as keyof Incident] && i[f.key as keyof Incident] !== 'N/A' && i[f.key as keyof Incident] !== '').length;
          return { ...f, percentage: (filled / total) * 100 };
      });
  }, [incidents]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER: Global Health */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
          <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Database className="w-6 h-6 mr-2 text-blue-600" />
                  Calidad del Dato y Pendientes
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                  Panel de control para integridad de datos, completitud y validaciones.
              </p>
          </div>
      </div>

      {/* MISSING HH TABLE (Grouped by Site) - PRIMARY ACTION */}
      {hasMissingHH && (
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-red-200 flex items-center bg-red-100/50">
                  <Clock className="w-5 h-5 text-red-600 mr-2" />
                  <h3 className="font-bold text-red-900">Faltantes de Horas Hombre (Prioridad Alta)</h3>
              </div>
              <div className="p-0 overflow-x-auto">
                  <table className="min-w-full divide-y divide-red-200">
                      <thead className="bg-red-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Sitio</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Cant. Meses</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Afectados</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-red-800 uppercase tracking-wider">Periodos Faltantes</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-red-800 uppercase tracking-wider">Acción</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-red-100">
                          {missingImpact.map((item) => (
                              <tr key={item.site} className="hover:bg-red-50 transition-colors">
                                  <td className="px-6 py-3 text-sm font-bold text-gray-900">{item.site}</td>
                                  <td className="px-6 py-3 text-sm text-gray-700">{item.missingPeriods.length}</td>
                                  <td className="px-6 py-3 text-xs text-gray-700">
                                      <div className="flex flex-col">
                                          <span>{item.affectedIncidentsCount} incidentes</span>
                                          {item.affectedSevereCount > 0 && (
                                              <span className="text-red-600 font-bold">{item.affectedSevereCount} severos</span>
                                          )}
                                      </div>
                                  </td>
                                  <td className="px-6 py-3 text-xs text-gray-500">
                                      {item.missingPeriods.slice(0, 3).join(', ')}
                                      {item.missingPeriods.length > 3 && <span className="text-gray-400 italic"> (+{item.missingPeriods.length - 3} más)</span>}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                      <button 
                                        onClick={() => onNavigateToExposure(item.site)}
                                        className="text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-xs font-bold shadow-sm"
                                      >
                                          Completar HH
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COL 1: Column Audit */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-1">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <ShieldAlert className="w-5 h-5 mr-2 text-orange-500" /> Completitud de Campos
              </h3>
              <div className="space-y-4">
                  {columnAudit.map(c => (
                      <div key={c.key}>
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-600">{c.label}</span>
                              <span className={`font-bold ${c.percentage < 100 ? 'text-red-500' : 'text-green-600'}`}>
                                  {c.percentage.toFixed(1)}%
                              </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className={`h-2 rounded-full ${c.percentage < 90 ? 'bg-red-400' : 'bg-green-500'}`} style={{width: `${c.percentage}%`}}></div>
                          </div>
                          {c.percentage < 100 && (
                              <p className="text-[10px] text-red-500 mt-1">
                                  Riesgo: {c.key === 'potential_risk' ? 'Afecta el Índice de Riesgo' : 'Afecta Pareto'}
                              </p>
                          )}
                      </div>
                  ))}
              </div>
          </div>

          {/* COL 2 & 3: Site Scorecards */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {qualityScores.map(qs => (
                <div key={qs.site} className={`bg-white rounded-xl border-l-4 shadow-sm p-4 ${qs.score === 100 ? 'border-green-400' : 'border-red-400'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-gray-800 truncate">{qs.site}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${qs.score >= 90 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {qs.score.toFixed(0)}% Score
                        </span>
                    </div>
                    
                    <div className="space-y-3">
                        {/* Reviews Pending */}
                        {qs.pending_reviews > 0 && (
                            <div className="bg-orange-50 p-2 rounded text-xs flex justify-between items-center">
                                <span className="text-orange-800 font-medium">{qs.pending_reviews} casos sin revisar (Gold)</span>
                                <button onClick={() => onNavigateToReview()} className="text-blue-600 hover:underline flex items-center">
                                    Revisar <ArrowRight className="w-3 h-3 ml-1"/>
                                </button>
                            </div>
                        )}

                        {/* KM Missing */}
                        {qs.transit_completeness < 100 && (
                            <div className="bg-purple-50 p-2 rounded text-xs flex justify-between items-center">
                                <span className="text-purple-800 font-medium">Faltan KM para IFAT</span>
                                <button onClick={() => onNavigateToExposure(qs.site)} className="text-purple-600 hover:underline">Cargar KM</button>
                            </div>
                        )}

                        {qs.score === 100 && (
                            <div className="text-center text-green-600 text-xs py-2 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 mr-1"/> Datos Completos
                            </div>
                        )}
                    </div>
                </div>
            ))}
          </div>
      </div>
    </div>
  );
};
