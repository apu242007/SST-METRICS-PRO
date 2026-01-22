import React, { useState } from 'react';
import { FileDown, X, CheckSquare, Square } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface ChartSelection {
  id: string;
  name: string;
  elementId: string;
  selected: boolean;
}

const AVAILABLE_CHARTS: ChartSelection[] = [
  { id: 'risk-trend', name: 'Evolución Índice de Riesgo', elementId: 'chart-risk-trend', selected: true },
  { id: 'pareto', name: 'Análisis Pareto 80/20', elementId: 'chart-pareto', selected: true },
  { id: 'severity-dist', name: 'Distribución por Tipo (Donut)', elementId: 'chart-severity-dist', selected: true },
  { id: 'body-map', name: 'Top 10 Partes del Cuerpo Afectadas', elementId: 'chart-body-map', selected: true },
  { id: 'waterfall', name: 'Contribución por Sitio al TRIR', elementId: 'chart-waterfall', selected: true },
  { id: 'scatter', name: 'Frecuencia vs Severidad', elementId: 'chart-scatter', selected: true },
  { id: 'radar', name: 'Radar Comparativo (Top 5 Sitios)', elementId: 'chart-radar', selected: true },
  { id: 'heatmap', name: 'Mapa de Calor Temporal', elementId: 'heatmap-container', selected: true },
];

interface PDFExportCenterProps {
  onClose: () => void;
  incidents?: any[];
  allIncidents?: any[];
  metrics?: any;
  exposureHours?: any[];
  exposureKm?: any[];
  settings?: any;
  missingExposure?: any[];
  currentView?: string;
  filters?: any;
}

export const PDFExportCenter: React.FC<PDFExportCenterProps> = ({ onClose }) => {
  const [charts, setCharts] = useState<ChartSelection[]>(AVAILABLE_CHARTS);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleChart = (id: string) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const toggleAll = () => {
    const allSelected = charts.every(c => c.selected);
    setCharts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const exportPDF = async () => {
    const selectedCharts = charts.filter(c => c.selected);
    if (selectedCharts.length === 0) {
      alert('Por favor selecciona al menos un gráfico para exportar');
      return;
    }

    setExporting(true);
    setProgress(0);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const maxWidth = pageWidth - (margin * 2);
      
      // Header
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(239, 68, 68);
      pdf.text("TACKER SRL", margin, 20);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Reporte de Gráficos SST", margin, 28);
      
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, margin, 34);
      
      pdf.setDrawColor(226, 232, 240);
      pdf.line(margin, 38, pageWidth - margin, 38);

      let currentY = 45;
      let isFirstChart = true;

      for (let i = 0; i < selectedCharts.length; i++) {
        const chart = selectedCharts[i];
        setProgress(Math.round(((i + 1) / selectedCharts.length) * 100));

        const element = document.getElementById(chart.elementId);
        if (!element) {
          console.warn(`Elemento ${chart.elementId} no encontrado`);
          continue;
        }

        try {
          // Capture chart as canvas
          const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
          });

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = maxWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          // Check if we need a new page
          if (!isFirstChart && currentY + imgHeight + 20 > pageHeight - margin) {
            pdf.addPage();
            currentY = margin + 10;
          }

          // Add chart title
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(51, 65, 85);
          pdf.text(chart.name, margin, currentY);
          currentY += 8;

          // Add chart image
          pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 15;

          isFirstChart = false;

          // Small delay to prevent browser freezing
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error capturando gráfico ${chart.name}:`, error);
        }
      }

      // Add page numbers
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save PDF
      pdf.save(`SST_Graficos_${new Date().toISOString().split('T')[0]}.pdf`);
      
      setExporting(false);
      setProgress(0);
      onClose();
    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Por favor intenta nuevamente.');
      setExporting(false);
      setProgress(0);
    }
  };

  const selectedCount = charts.filter(c => c.selected).length;
  const allSelected = charts.every(c => c.selected);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
          <div className="flex items-center text-white">
            <FileDown className="w-6 h-6 mr-3" />
            <div>
              <h3 className="font-bold text-lg">Centro de Exportación PDF</h3>
              <p className="text-xs text-blue-100 mt-1">Selecciona los gráficos que deseas incluir</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={exporting}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Select All Toggle */}
          <div className="mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={toggleAll}
              disabled={exporting}
              className="flex items-center space-x-3 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-blue-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span>{allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}</span>
            </button>
            <p className="text-xs text-gray-500 mt-2 ml-8">
              {selectedCount} de {charts.length} gráficos seleccionados
            </p>
          </div>

          {/* Chart List */}
          <div className="space-y-2">
            {charts.map((chart) => (
              <button
                key={chart.id}
                onClick={() => toggleChart(chart.id)}
                disabled={exporting}
                className={`w-full flex items-center space-x-3 p-4 rounded-lg border-2 transition-all disabled:opacity-50 ${
                  chart.selected
                    ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                {chart.selected ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 flex-shrink-0" />
                ) : (
                  <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium text-left ${
                  chart.selected ? 'text-blue-900' : 'text-gray-700'
                }`}>
                  {chart.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-5 bg-gray-50">
          {exporting && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Generando PDF...</span>
                <span className="text-sm font-bold text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` } as React.CSSProperties}
                ></div>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={exporting}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={exportPDF}
              disabled={exporting || selectedCount === 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <FileDown className="w-5 h-5" />
              <span>{exporting ? 'Generando...' : `Exportar ${selectedCount} Gráfico${selectedCount !== 1 ? 's' : ''}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
