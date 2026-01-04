
import React, { useState, useEffect, useMemo } from 'react';
import { Incident, MappingRule, SGIDocument, LinkedDocument } from '../types';
import { X, Save, ArrowRight, Database, Wand2, Edit3, AlertTriangle, CheckCircle2, FileJson, History, BookOpen, Link, Trash2, Plus } from 'lucide-react';
import { parseStrictDate } from '../utils/importHelpers';
import { SEED_DOCUMENTS } from '../utils/seedData';

interface IncidentDetailViewProps {
  incident: Incident;
  rules: MappingRule[];
  onClose: () => void;
  onSave: (updated: Incident) => void;
}

export const IncidentDetailView: React.FC<IncidentDetailViewProps> = ({ incident, rules, onClose, onSave }) => {
  const [formData, setFormData] = useState<Incident>(incident);
  const [rawData, setRawData] = useState<Record<string, any>>({});
  const [suggestions, setSuggestions] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'docs'>('details');

  // Document Linking State
  const [docSearch, setDocSearch] = useState('');
  const [selectedDocForLink, setSelectedDocForLink] = useState<SGIDocument | null>(null);
  const [linkType, setLinkType] = useState<'NON_COMPLIANCE' | 'REFERENCE' | 'NOT_APPLICABLE'>('NON_COMPLIANCE');
  const [linkComment, setLinkComment] = useState('');

  // SGI Documents
  const sgiDocs = SEED_DOCUMENTS; // In a real app, this would come from context/props

  // Initialize
  useEffect(() => {
    // 1. Parse Raw Data
    try {
      const parsed = incident.raw_json ? JSON.parse(incident.raw_json) : {};
      setRawData(parsed);

      // 2. Generate Suggestions (Silver Layer Logic)
      const sugg: any = {};
      
      // Date from ART
      const artDate = parseStrictDate(parsed['Datos ART: FECHA SINIESTRO']);
      const artAlta = parseStrictDate(parsed['Datos ART: FECHA ALTA MEDICA DEFINITIVA']);
      if (artDate) sugg.date = artDate;
      
      // Days Away from ART
      if (artDate && artAlta) {
          const start = new Date(artDate).getTime();
          const end = new Date(artAlta).getTime();
          if (end >= start) {
             sugg.daysAway = Math.ceil((end - start) / (1000 * 3600 * 24));
          }
      }

      // Rule Matching
      const typeLower = (incident.type || '').toLowerCase();
      const rule = rules.find(r => typeLower.includes(r.tipo_incidente.toLowerCase()));
      if (rule) {
          sugg.ruleMatch = rule.tipo_incidente;
          sugg.isRecordable = rule.default_recordable;
          sugg.isLti = rule.default_lti;
      }

      setSuggestions(sugg);
    } catch (e) {
      console.error("Error parsing raw json", e);
    }
  }, [incident, rules]);

  const handleChange = (field: keyof Incident, value: any) => {
    let updates: Partial<Incident> = { [field]: value };
    
    // Auto-toggle exclusivity for transit
    if (field === 'is_transit_laboral' && value === true) {
        updates.is_in_itinere = false;
        updates.is_transit = true;
    }
    if (field === 'is_in_itinere' && value === true) {
        updates.is_transit_laboral = false;
        updates.is_transit = true; // Legacy catch-all
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    // Ensure we mark it as verified when saving from detail view
    onSave({ ...formData, is_verified: true });
    onClose();
  };

  // --- DOCUMENT LINKING LOGIC ---
  const handleAddLink = () => {
      if (!selectedDocForLink) return;
      
      const newLink: LinkedDocument = {
          id: `link-${Date.now()}`,
          document_code: selectedDocForLink.code,
          document_title: selectedDocForLink.title,
          association_type: linkType as any,
          comments: linkComment,
          added_at: new Date().toISOString()
      };

      const updatedLinks = [...(formData.linked_documents || []), newLink];
      setFormData(prev => ({ ...prev, linked_documents: updatedLinks }));
      
      // Reset
      setSelectedDocForLink(null);
      setDocSearch('');
      setLinkComment('');
  };

  const handleRemoveLink = (linkId: string) => {
      const updatedLinks = (formData.linked_documents || []).filter(l => l.id !== linkId);
      setFormData(prev => ({ ...prev, linked_documents: updatedLinks }));
  };

  const filteredDocs = useMemo(() => {
      if (!docSearch) return [];
      return sgiDocs.filter(d => 
          d.code.toLowerCase().includes(docSearch.toLowerCase()) || 
          d.title.toLowerCase().includes(docSearch.toLowerCase())
      ).slice(0, 5);
  }, [docSearch, sgiDocs]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-xl">
            <div>
                <h2 className="text-lg font-bold flex items-center">
                    <Database className="w-5 h-5 mr-2 text-blue-400" />
                    Detalle de Incidente: <span className="text-blue-200 ml-2 font-mono">{incident.incident_id}</span>
                </h2>
                <div className="flex space-x-4 mt-2">
                    <button onClick={() => setActiveTab('details')} className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'details' ? 'border-blue-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Datos Generales
                    </button>
                    <button onClick={() => setActiveTab('docs')} className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'docs' ? 'border-blue-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Procedimientos SGI ({formData.linked_documents?.length || 0})
                    </button>
                    <button onClick={() => setActiveTab('audit')} className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'audit' ? 'border-blue-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        Auditoría
                    </button>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition">
                <X className="w-6 h-6" />
            </button>
        </div>

        {activeTab === 'audit' && (
             <div className="bg-gray-50 p-6 rounded-b-xl min-h-[400px]">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                     <History className="w-5 h-5 mr-2" /> Historial de Modificaciones
                 </h3>
                 {(!incident.change_log || incident.change_log.length === 0) ? (
                     <p className="text-gray-500 italic">No hay cambios registrados para este incidente.</p>
                 ) : (
                     <div className="space-y-4">
                         {incident.change_log.slice().reverse().map((log, idx) => (
                             <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                 <div className="flex justify-between mb-2">
                                     <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">{log.field}</span>
                                     <span className="text-xs text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4 text-sm">
                                     <div className="bg-red-50 p-2 rounded">
                                         <span className="block text-[10px] text-red-500 uppercase font-bold">Anterior</span>
                                         <div className="text-red-800 font-mono break-all">{log.old_value !== null ? String(log.old_value) : 'NULL'}</div>
                                     </div>
                                     <div className="bg-green-50 p-2 rounded">
                                         <span className="block text-[10px] text-green-500 uppercase font-bold">Nuevo</span>
                                         <div className="text-green-800 font-mono break-all">{String(log.new_value)}</div>
                                     </div>
                                 </div>
                                 <div className="mt-2 text-xs text-gray-400 text-right">
                                     Modificado por: <span className="font-medium text-gray-600">{log.user}</span>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
        )}

        {/* --- DOCUMENTS TAB --- */}
        {activeTab === 'docs' && (
            <div className="flex flex-col h-full bg-gray-50 p-6 rounded-b-xl min-h-[500px]">
                
                {/* 1. Linking Area */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
                        <Link className="w-4 h-4 mr-2 text-blue-600"/> Vincular Documento SGI
                    </h3>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Buscar Procedimiento</label>
                            <input 
                                type="text" 
                                placeholder="Escriba código (ej: PO-SGI) o título..." 
                                className="w-full border-gray-300 rounded text-sm p-2"
                                value={docSearch}
                                onChange={e => { setDocSearch(e.target.value); setSelectedDocForLink(null); }}
                            />
                            {/* Autocomplete Dropdown */}
                            {docSearch && !selectedDocForLink && (
                                <div className="absolute top-full left-0 w-full bg-white border border-gray-200 shadow-lg rounded-b mt-1 z-10 max-h-48 overflow-y-auto">
                                    {filteredDocs.map(doc => (
                                        <div 
                                            key={doc.code} 
                                            onClick={() => { setSelectedDocForLink(doc); setDocSearch(doc.code + ' - ' + doc.title); }}
                                            className="p-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-50"
                                        >
                                            <span className="font-bold text-blue-700">{doc.code}</span>
                                            <span className="text-gray-600 ml-2">{doc.title}</span>
                                        </div>
                                    ))}
                                    {filteredDocs.length === 0 && (
                                        <div className="p-2 text-xs text-gray-400 italic">No se encontraron documentos.</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Type & Comment */}
                        <div className="w-48">
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Tipo de Asociación</label>
                            <select 
                                className="w-full border-gray-300 rounded text-sm p-2"
                                value={linkType}
                                onChange={e => setLinkType(e.target.value as any)}
                            >
                                <option value="NON_COMPLIANCE">Incumplimiento</option>
                                <option value="REFERENCE">Referencia / Consulta</option>
                                <option value="NOT_APPLICABLE">No Aplica (Justificar)</option>
                            </select>
                        </div>

                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Comentario / Evidencia</label>
                            <input 
                                type="text" 
                                placeholder="Ej: No se realizó el checklist previo..."
                                className="w-full border-gray-300 rounded text-sm p-2"
                                value={linkComment}
                                onChange={e => setLinkComment(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={handleAddLink}
                            disabled={!selectedDocForLink}
                            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    {selectedDocForLink && (
                        <div className="mt-2 text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-100">
                            <strong>Objetivo:</strong> {selectedDocForLink.objective}
                        </div>
                    )}
                </div>

                {/* 2. Linked List */}
                <h3 className="text-sm font-bold text-gray-800 mb-3">Documentos Vinculados</h3>
                {(!formData.linked_documents || formData.linked_documents.length === 0) ? (
                    <div className="text-center py-10 text-gray-400 bg-white border border-dashed border-gray-300 rounded-xl">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay documentos vinculados a este incidente.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {formData.linked_documents.map(link => (
                            <div key={link.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-blue-700 text-sm">{link.document_code}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                            link.association_type === 'NON_COMPLIANCE' ? 'bg-red-100 text-red-700' :
                                            link.association_type === 'REFERENCE' ? 'bg-green-100 text-green-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                            {link.association_type === 'NON_COMPLIANCE' ? 'INCUMPLIMIENTO' : link.association_type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-800 font-medium">{link.document_title}</p>
                                    {link.comments && (
                                        <p className="text-xs text-gray-500 mt-1 italic">"{link.comments}"</p>
                                    )}
                                </div>
                                <button 
                                    onClick={() => handleRemoveLink(link.id)}
                                    className="text-red-400 hover:text-red-600 p-1"
                                    title="Desvincular"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* 3-Column Layout (Details Tab) */}
        {activeTab === 'details' && (
        <div className="flex flex-col lg:flex-row">
            
            {/* COL 1: RAW DATA (Bronze) */}
            <div className="w-full lg:w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
                <div className="p-3 bg-gray-100 border-b border-gray-200 font-semibold text-xs text-gray-500 uppercase tracking-wider flex items-center">
                    <FileJson className="w-4 h-4 mr-2" /> Fuente Original (Excel)
                </div>
                <div className="p-4">
                    <div className="space-y-3">
                        {Object.entries(rawData).map(([key, val]) => (
                            <div key={key} className="break-words">
                                <dt className="text-[10px] font-bold text-gray-400 uppercase">{key}</dt>
                                <dd className="text-xs text-gray-800 font-mono bg-white border border-gray-200 p-1.5 rounded mt-0.5">
                                    {val !== null && val !== undefined ? String(val) : <span className="text-gray-300 italic">null</span>}
                                </dd>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* COL 2: NORMALIZED / SYSTEM (Silver) */}
            <div className="w-full lg:w-1/3 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-3 bg-blue-50 border-b border-blue-100 font-semibold text-xs text-blue-600 uppercase tracking-wider flex items-center">
                    <Wand2 className="w-4 h-4 mr-2" /> Normalizado y Sugerencias
                </div>
                <div className="p-4 space-y-6">
                    
                    {/* Basic Mapping */}
                    <div>
                        <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2">Campos Mapeados</h4>
                        <div className="grid grid-cols-1 gap-2">
                             <div>
                                <span className="text-xs text-gray-500">Sitio</span>
                                <div className="text-sm font-medium">{incident.site}</div>
                             </div>
                             <div>
                                <span className="text-xs text-gray-500">Tipo</span>
                                <div className="text-sm font-medium">{incident.type}</div>
                             </div>
                             <div>
                                <span className="text-xs text-gray-500">Descripción</span>
                                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1">{incident.description}</div>
                             </div>
                        </div>
                    </div>

                    {/* Suggestions */}
                    <div>
                         <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-1 mb-2">Insights del Sistema</h4>
                         
                         {/* Date Analysis */}
                         <div className="mb-3">
                            <span className="text-xs text-gray-500 block mb-1">Fecha Evento (ART vs Actual)</span>
                            {suggestions.date && suggestions.date !== incident.fecha_evento ? (
                                <div className="bg-orange-50 border border-orange-200 p-2 rounded text-xs">
                                    <div className="flex items-center text-orange-700 font-bold mb-1">
                                        <AlertTriangle className="w-3 h-3 mr-1"/> Discrepancia
                                    </div>
                                    <p>Actual: {incident.fecha_evento}</p>
                                    <p>Fuente ART: {suggestions.date}</p>
                                </div>
                            ) : (
                                <div className="text-xs text-green-600 flex items-center">
                                    <CheckCircle2 className="w-3 h-3 mr-1"/> Coincide con Fuente o N/A
                                </div>
                            )}
                         </div>

                         {/* Rule Analysis */}
                         <div className="mb-3">
                             <span className="text-xs text-gray-500 block mb-1">Regla de Clasificación</span>
                             {suggestions.ruleMatch ? (
                                 <div className="bg-gray-50 p-2 rounded text-xs border border-gray-200">
                                     <p><strong>Coincide:</strong> "{suggestions.ruleMatch}"</p>
                                     <p>Registrable (Default): {suggestions.isRecordable ? 'Sí' : 'No'}</p>
                                     <p>LTI (Default): {suggestions.isLti ? 'Sí' : 'No'}</p>
                                 </div>
                             ) : (
                                 <div className="text-xs text-gray-400 italic">Sin regla específica para este tipo.</div>
                             )}
                         </div>

                         {/* Days Analysis */}
                         {suggestions.daysAway !== undefined && (
                             <div>
                                 <span className="text-xs text-gray-500 block mb-1">Días Perdidos Calculados (ART)</span>
                                 <div className="font-mono text-sm font-bold text-gray-800">{suggestions.daysAway} días</div>
                             </div>
                         )}
                    </div>
                </div>
            </div>

            {/* COL 3: MANUAL EDIT (Gold) */}
            <div className="w-full lg:w-1/3 bg-white flex flex-col rounded-b-xl">
                <div className="p-3 bg-yellow-50 border-b border-yellow-100 font-semibold text-xs text-yellow-700 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center"><Edit3 className="w-4 h-4 mr-2" /> Edición Manual (Gold)</div>
                    {!incident.is_verified && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full animate-pulse">Pendiente Revisión</span>}
                </div>
                
                <div className="p-4 space-y-4">
                    
                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Fecha del Evento</label>
                        <input 
                            type="date" 
                            className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={formData.fecha_evento}
                            onChange={e => handleChange('fecha_evento', e.target.value)}
                        />
                    </div>

                    {/* Toggles */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer group">
                             <span className="text-sm font-medium text-gray-700">Registrable OSHA</span>
                             <input type="checkbox" checked={formData.recordable_osha} onChange={e => handleChange('recordable_osha', e.target.checked)} className="h-5 w-5 text-blue-600 rounded border-gray-300"/>
                        </label>

                        <label className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer group">
                             <span className="text-sm font-medium text-gray-700">Tiempo Perdido (LTI)</span>
                             <input type="checkbox" checked={formData.lti_case} onChange={e => handleChange('lti_case', e.target.checked)} className="h-5 w-5 text-red-600 rounded border-gray-300"/>
                        </label>

                        <label className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer group">
                             <span className="text-sm font-medium text-gray-700">Tránsito Laboral (IFAT)</span>
                             <input type="checkbox" checked={formData.is_transit_laboral} onChange={e => handleChange('is_transit_laboral', e.target.checked)} className="h-5 w-5 text-purple-600 rounded border-gray-300"/>
                        </label>

                        <label className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer group">
                             <span className="text-sm font-medium text-gray-700">In Itinere (Commuting)</span>
                             <input type="checkbox" checked={formData.is_in_itinere} onChange={e => handleChange('is_in_itinere', e.target.checked)} className="h-5 w-5 text-indigo-400 rounded border-gray-300"/>
                        </label>
                        
                         <label className="flex items-center justify-between p-2 border rounded hover:bg-gray-50 cursor-pointer group">
                             <span className="text-sm font-medium text-gray-700">Fatalidad</span>
                             <input type="checkbox" checked={formData.fatality} onChange={e => handleChange('fatality', e.target.checked)} className="h-5 w-5 text-gray-900 rounded border-gray-300"/>
                        </label>
                    </div>

                    {/* Numeric Impact */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                         <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Días Fuera</label>
                            <input 
                                type="number" min="0"
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.days_away}
                                onChange={e => handleChange('days_away', parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Días Restringidos</label>
                            <input 
                                type="number" min="0"
                                className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={formData.days_restricted}
                                onChange={e => handleChange('days_restricted', parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                     <div>
                        <label className="flex items-center p-2 cursor-pointer">
                             <input type="checkbox" checked={formData.job_transfer} onChange={e => handleChange('job_transfer', e.target.checked)} className="h-4 w-4 text-orange-600 rounded border-gray-300"/>
                             <span className="ml-2 text-xs font-medium text-gray-700">Transferencia de Puesto</span>
                        </label>
                     </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 mt-auto rounded-br-xl rounded-bl-lg lg:rounded-bl-none">
                    <button 
                        onClick={handleSave}
                        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Confirmar y Guardar
                    </button>
                </div>
            </div>
        </div>
        )}
      </div>
    </div>
  );
};
