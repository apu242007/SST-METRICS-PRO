
import React, { useState, useMemo } from 'react';
import { SGIDocument } from '../types';
import { Search, FileText, Filter, BookOpen, X, Eye, File, Calendar } from 'lucide-react';

interface DocumentLibraryProps {
  documents: SGIDocument[];
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({ documents }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterArea, setFilterArea] = useState('ALL');
  const [selectedDoc, setSelectedDoc] = useState<SGIDocument | null>(null);

  // Filters
  const uniqueTypes = useMemo(() => Array.from(new Set(documents.map(d => d.type))).sort(), [documents]);
  const uniqueAreas = useMemo(() => Array.from(new Set(documents.map(d => d.area))).sort(), [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch = 
        doc.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.objective?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchType = filterType === 'ALL' || doc.type === filterType;
      const matchArea = filterArea === 'ALL' || doc.area === filterArea;

      return matchSearch && matchType && matchArea;
    });
  }, [documents, searchTerm, filterType, filterArea]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-blue-600" />
            Maestro de Documentos SGI
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Base de datos unificada de Procedimientos (PO), Guías (PG) e Instructivos (IT).
          </p>
        </div>
        <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
            <span className="text-xs font-bold text-blue-700">{documents.length} Documentos Cargados</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input 
                type="text" 
                placeholder="Buscar por código, título o objetivo..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="flex gap-2">
            <select 
                className="border border-gray-300 rounded-lg text-xs px-3 py-2 bg-gray-50 text-gray-700"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
            >
                <option value="ALL">Tipo: Todos</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select 
                className="border border-gray-300 rounded-lg text-xs px-3 py-2 bg-gray-50 text-gray-700"
                value={filterArea}
                onChange={e => setFilterArea(e.target.value)}
            >
                <option value="ALL">Área: Todas</option>
                {uniqueAreas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4">
          {filteredDocs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-300">
                  No se encontraron documentos con los filtros actuales.
              </div>
          ) : (
              filteredDocs.map(doc => (
                  <div key={doc.code} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4">
                      <div className="flex-shrink-0 w-24">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                              doc.type === 'PO' ? 'bg-blue-100 text-blue-700' :
                              doc.type === 'PG' ? 'bg-purple-100 text-purple-700' :
                              doc.type === 'IT' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                              {doc.code}
                          </span>
                          <div className="mt-2 text-[10px] text-gray-400 font-mono flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              Rev. {doc.version || '00'}
                          </div>
                      </div>
                      
                      <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-800">{doc.title}</h3>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{doc.objective}</p>
                          <div className="mt-2 flex gap-2">
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">Área: {doc.area}</span>
                          </div>
                      </div>

                      <div className="flex items-center">
                          <button 
                            onClick={() => setSelectedDoc(doc)}
                            className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors flex items-center" 
                            title="Ver Detalle Completo"
                          >
                              <Eye className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* Detail Modal */}
      {selectedDoc && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity duration-300">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-transform duration-300 scale-100">
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{selectedDoc.code}</span>
                              <span className="text-xs text-slate-300">Rev. {selectedDoc.version || '00'}</span>
                          </div>
                          <h3 className="text-lg font-bold leading-tight">{selectedDoc.title}</h3>
                      </div>
                      <button onClick={() => setSelectedDoc(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-6">
                      
                      <div className="space-y-2">
                          <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center">
                              <FileText className="w-4 h-4 mr-2" /> Objetivo
                          </h4>
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed">
                              {selectedDoc.objective || 'Sin objetivo definido.'}
                          </div>
                      </div>

                      <div className="space-y-2">
                          <h4 className="text-xs font-bold text-purple-600 uppercase flex items-center">
                              <Filter className="w-4 h-4 mr-2" /> Alcance
                          </h4>
                          <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-sm text-gray-700 leading-relaxed">
                              {selectedDoc.scope || 'Sin alcance definido.'}
                          </div>
                      </div>

                      <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center">
                              <File className="w-4 h-4 mr-2" /> Documentos Asociados / Referencias
                          </h4>
                          <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
                              {selectedDoc.associatedDocs ? (
                                  <ul className="list-disc ml-4 space-y-1">
                                      {selectedDoc.associatedDocs.split(/;|•|\n/).map((doc, i) => {
                                          const clean = doc.trim();
                                          if(!clean) return null;
                                          return <li key={i}>{clean}</li>
                                      })}
                                  </ul>
                              ) : (
                                  <span className="italic text-gray-400">No hay documentos asociados registrados.</span>
                              )}
                          </div>
                      </div>

                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                      <button 
                        onClick={() => setSelectedDoc(null)}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition shadow-sm text-sm"
                      >
                          Cerrar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
