
import React, { useState, useMemo } from 'react';
import { SGIDocument } from '../types';
import { Search, FileText, Filter, BookOpen } from 'lucide-react';

interface DocumentLibraryProps {
  documents: SGIDocument[];
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({ documents }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterArea, setFilterArea] = useState('ALL');

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
    <div className="space-y-6 animate-in fade-in duration-500">
      
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
                          <div className="mt-2 text-[10px] text-gray-400 font-mono">Rev. {doc.version || '00'}</div>
                      </div>
                      
                      <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-800">{doc.title}</h3>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{doc.objective}</p>
                          <div className="mt-2 flex gap-2">
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Área: {doc.area}</span>
                          </div>
                      </div>

                      <div className="flex items-center">
                          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Ver Detalle (Próximamente)">
                              <FileText className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
              ))
          )}
      </div>

    </div>
  );
};
