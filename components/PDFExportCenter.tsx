import React, { useState } from 'react';
import { FileDown, X, CheckSquare, Square, FileText, Table, BarChart3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Incident, DashboardMetrics, ExposureHour, ExposureKm, AppSettings, MissingExposureImpact } from '../types';

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
  { id: 'waterfall', name: 'Contribución por Sitio al TRIR', elementId: 'chart-waterfall', selected: true },
  { id: 'scatter', name: 'Frecuencia vs Severidad', elementId: 'chart-scatter', selected: true },
  { id: 'radar', name: 'Radar Comparativo (Top 5 Sitios)', elementId: 'chart-radar', selected: true },
  { id: 'heatmap', name: 'Mapa de Calor Temporal', elementId: 'heatmap-container', selected: true },
];

interface PDFExportCenterProps {
  onClose: () => void;
  incidents: Incident[];
  allIncidents: Incident[];
  metrics: DashboardMetrics;
  exposureHours: ExposureHour[];
  exposureKm: ExposureKm[];
  settings: AppSettings;
  missingExposure: MissingExposureImpact[];
  currentView: string;
  filters: any;
}

export const PDFExportCenter: React.FC<PDFExportCenterProps> = ({ 
  onClose, 
  incidents, 
  allIncidents, 
  metrics, 
  exposureHours, 
  exposureKm, 
  settings, 
  missingExposure, 
  currentView, 
  filters 
}) => {
  const [charts, setCharts] = useState<ChartSelection[]>(AVAILABLE_CHARTS);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [includeFullData, setIncludeFullData] = useState(true);
  const [activeSection, setActiveSection] = useState<'charts' | 'config'>('charts');

  const toggleChart = (id: string) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const toggleAll = () => {
    const allSelected = charts.every(c => c.selected);
    setCharts(prev => prev.map(c => ({ ...c, selected: !allSelected })));
  };

  const exportPDF = async () => {
    const selectedCharts = charts.filter(c => c.selected);
    
    if (!includeFullData && selectedCharts.length === 0) {
      alert('Por favor selecciona al menos un gráfico o activa "Incluir datos completos"');
      return;
    }

    setExporting(true);
    setProgress(5);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      const contentWidth = maxWidth;
      
      // Función auxiliar para verificar espacio y agregar página si es necesario
      const checkSpace = (requiredSpace: number, currentY: number): number => {
        if (currentY + requiredSpace > pageHeight - margin - 15) {
          pdf.addPage();
          return margin + 5;
        }
        return currentY;
      };

      // Función para dibujar separador visual
      const drawSeparator = (y: number) => {
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, pageWidth - margin, y);
        return y + 8;
      };

      // Función para agregar sección de título
      const addSectionTitle = (title: string, currentY: number, color: number[] = [239, 68, 68]): number => {
        currentY = checkSpace(20, currentY);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(title, margin, currentY);
        
        // Línea debajo del título
        pdf.setDrawColor(color[0], color[1], color[2]);
        pdf.setLineWidth(0.8);
        pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
        
        return currentY + 10;
      };

      // ========== PORTADA MEJORADA ==========
      pdf.setFillColor(239, 68, 68);
      pdf.rect(0, 0, pageWidth, 70, 'F');
      
      // Logo/Título principal
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(32);
      pdf.setTextColor(255, 255, 255);
      pdf.text("TACKER SRL", pageWidth / 2, 30, { align: 'center' });
      
      // Subtítulo
      pdf.setFontSize(18);
      pdf.text("Reporte Integral de Seguridad y Salud en el Trabajo", pageWidth / 2, 50, { align: 'center' });
      
      // Línea decorativa
      pdf.setDrawColor(255, 255, 255);
      pdf.setLineWidth(0.5);
      pdf.line(margin + 20, 58, pageWidth - margin - 20, 58);
      
      // Fecha y hora de generación
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Generado el ${new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })} a las ${new Date().toLocaleTimeString('es-ES')}`, pageWidth / 2, 64, { align: 'center' });
      
      // Sección de alcance con mejor diseño
      let yPos = 90;
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(margin, yPos, contentWidth, 65, 3, 3, 'F');
      
      yPos += 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(51, 65, 85);
      pdf.text("Alcance del Reporte", margin + 5, yPos);
      
      yPos += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105);
      
      const scopeItems = [
        { label: 'Sitio(s)', value: filters.site || 'Todos los sitios' },
        { label: 'Año', value: filters.year || 'Todos' },
        { label: 'Mes', value: filters.month || 'Todos' },
        { label: 'Tipo de Incidente', value: filters.type || 'Todos' },
        { label: 'Total de Incidentes Analizados', value: incidents.length.toString() },
      ];
      
      scopeItems.forEach(item => {
        pdf.setFont("helvetica", "bold");
        pdf.text(`${item.label}:`, margin + 10, yPos);
        pdf.setFont("helvetica", "normal");
        pdf.text(item.value, margin + 70, yPos);
        yPos += 7;
      });
      
      // Resumen ejecutivo en portada
      yPos += 10;
      pdf.setFillColor(254, 242, 242);
      pdf.roundedRect(margin, yPos, contentWidth, 55, 3, 3, 'F');
      
      yPos += 8;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(220, 38, 38);
      pdf.text("Resumen Ejecutivo", margin + 5, yPos);
      
      yPos += 10;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      
      const summaryItems = [
        `TRIR: ${metrics.trir?.toFixed(2) || 'N/A'} (Tasa Total de Casos Registrables)`,
        `LTIF: ${metrics.ltif?.toFixed(2) || 'N/A'} (Índice de Frecuencia de Lesiones con Tiempo Perdido)`,
        `Registrables OSHA: ${metrics.totalRecordables} casos`,
        `LTI (Casos con Baja): ${metrics.totalLTI} casos`,
        `Fatalidades: ${metrics.totalFatalities} casos`,
      ];
      
      summaryItems.forEach(item => {
        pdf.text(`• ${item}`, margin + 10, yPos);
        yPos += 6;
      });

      setProgress(10);

      // ========== ÍNDICE DE CONTENIDOS ==========
      if (includeFullData || selectedCharts.length > 0) {
        pdf.addPage();
        let currentY = margin + 10;
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(239, 68, 68);
        pdf.text("Índice de Contenidos", margin, currentY);
        currentY += 15;
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(71, 85, 105);
        
        const tocItems = [
          { title: "1. Indicadores Clave de Desempeño (KPIs)", show: includeFullData },
          { title: "2. Seguridad de Procesos (API RP 754)", show: includeFullData },
          { title: "3. Top 5 Sitios con Mayor Incidentalidad", show: includeFullData && metrics.top5Sites && metrics.top5Sites.length > 0 },
          { title: "4. Detalle de Incidentes", show: includeFullData && incidents.length > 0 },
          { title: "5. Datos de Exposición", show: includeFullData && exposureHours.length > 0 },
          { title: "6. Configuración del Sistema", show: includeFullData },
          { title: "7. Análisis Gráfico", show: selectedCharts.length > 0 }
        ];
        
        tocItems.filter(item => item.show).forEach(item => {
          pdf.text(`• ${item.title}`, margin + 5, currentY);
          currentY += 10;
        });
        
        setProgress(15);
      }

      if (includeFullData) {
        pdf.addPage();
        let currentY = margin + 5;

        // ========== SECCIÓN 1: KPIs PRINCIPALES ==========
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(239, 68, 68);
        pdf.text("1. Indicadores Clave de Desempeño (KPIs)", margin, currentY);
        pdf.setDrawColor(239, 68, 68);
        pdf.setLineWidth(0.8);
        pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
        currentY += 12;

        const kpiData = [
          ['TRIR (OSHA)', metrics.trir?.toFixed(2) || '—', 'Base 200,000 Horas', 'Total Recordable Incident Rate'],
          ['LTIF (IOGP)', metrics.ltif?.toFixed(2) || '—', 'Base 1,000,000 Horas', 'Lost Time Injury Frequency'],
          ['DART (OSHA)', metrics.dart?.toFixed(2) || '—', 'Días Perdidos/Rest/Trans', 'Days Away, Restricted or Transferred'],
          ['SR (Severidad)', metrics.sr?.toFixed(2) || '—', 'Días/1,000 Horas', 'Severity Rate'],
          ['FAR (Fatalidad)', metrics.far?.toFixed(2) || '—', 'Base 100,000,000 Horas', 'Fatality Accident Rate'],
          ['Incidentes Totales', metrics.totalIncidents.toString(), 'Total Registrados', '—'],
          ['Registrables OSHA', metrics.totalRecordables.toString(), 'Casos Reportables', '—'],
          ['LTI Cases', metrics.totalLTI.toString(), 'Casos con Tiempo Perdido', '—'],
          ['Fatalidades', metrics.totalFatalities.toString(), 'Casos Mortales', '—'],
        ];

        autoTable(pdf, {
          startY: currentY,
          head: [['KPI', 'Valor', 'Base de Cálculo', 'Descripción']],
          body: kpiData,
          theme: 'grid',
          styles: { 
            fontSize: 9, 
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [239, 68, 68], 
            textColor: 255, 
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 5
          },
          columnStyles: { 
            0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 38 },
            1: { fontStyle: 'bold', textColor: [220, 38, 38], halign: 'center', cellWidth: 25 },
            2: { fontSize: 8, textColor: [100, 116, 139], cellWidth: 50 },
            3: { fontSize: 8, textColor: [100, 116, 139], cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin },
        });

        currentY = (pdf as any).lastAutoTable.finalY + 12;
        setProgress(25);

        // ========== SECCIÓN 2: SEGURIDAD DE PROCESOS ==========
        if (currentY + 60 > pageHeight - margin - 15) {
          pdf.addPage();
          currentY = margin + 5;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(100, 116, 139);
        pdf.text("2. Seguridad de Procesos (API RP 754)", margin, currentY);
        pdf.setDrawColor(100, 116, 139);
        pdf.setLineWidth(0.8);
        pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
        currentY += 12;

        const processSafetyData = [
          [
            'Tier 1 PSER', 
            metrics.t1_pser?.toFixed(2) || '—', 
            metrics.t1_count.toString(), 
            'Eventos mayores que generan consecuencias graves'
          ],
          [
            'Tier 2 PSER', 
            metrics.t2_pser?.toFixed(2) || '—', 
            metrics.t2_count.toString(), 
            'Eventos menores con potencial de escalamiento'
          ],
        ];

        autoTable(pdf, {
          startY: currentY,
          head: [['Indicador', 'Tasa', 'Cantidad', 'Descripción']],
          body: processSafetyData,
          theme: 'grid',
          styles: { 
            fontSize: 9,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [100, 116, 139],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10,
            cellPadding: 5
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 38 },
            1: { fontStyle: 'bold', halign: 'center', cellWidth: 25 },
            2: { halign: 'center', cellWidth: 25 },
            3: { fontSize: 8, cellWidth: 'auto' }
          },
          margin: { left: margin, right: margin },
        });

        currentY = (pdf as any).lastAutoTable.finalY + 12;
        setProgress(35);

        // ========== SECCIÓN 3: TOP 5 SITIOS ==========
        if (metrics.top5Sites && metrics.top5Sites.length > 0) {
          if (currentY + 70 > pageHeight - margin - 15) {
            pdf.addPage();
            currentY = margin + 5;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(245, 158, 11);
          pdf.text("3. Top 5 Sitios con Mayor Incidentalidad", margin, currentY);
          pdf.setDrawColor(245, 158, 11);
          pdf.setLineWidth(0.8);
          pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
          currentY += 12;

          const top5Data = metrics.top5Sites.map((site, idx) => {
            const percentage = ((site.count / incidents.length) * 100).toFixed(1);
            return [
              (idx + 1).toString(),
              site.site,
              site.count.toString(),
              `${percentage}%`
            ];
          });

          autoTable(pdf, {
            startY: currentY,
            head: [['#', 'Sitio', 'Incidentes', '% del Total']],
            body: top5Data,
            theme: 'striped',
            styles: { 
              fontSize: 10,
              cellPadding: 4,
              lineColor: [220, 220, 220],
              lineWidth: 0.1
            },
            headStyles: { 
              fillColor: [245, 158, 11], 
              fontStyle: 'bold',
              fontSize: 10,
              cellPadding: 5
            },
            columnStyles: {
              0: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
              1: { cellWidth: 'auto' },
              2: { halign: 'center', cellWidth: 30, fontStyle: 'bold' },
              3: { halign: 'center', cellWidth: 30, textColor: [220, 38, 38] }
            },
            margin: { left: margin, right: margin },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 12;
        }

        setProgress(45);

        // ========== SECCIÓN 4: DETALLE DE INCIDENTES ==========
        if (incidents.length > 0) {
          pdf.addPage();
          currentY = margin + 5;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(59, 130, 246);
          pdf.text(`4. Detalle de Incidentes (Mostrando ${Math.min(incidents.length, 25)} de ${incidents.length})`, margin, currentY);
          pdf.setDrawColor(59, 130, 246);
          pdf.setLineWidth(0.8);
          pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
          currentY += 12;

          const incidentData = incidents.slice(0, 25).map(inc => [
            inc.incident_id,
            inc.site.length > 20 ? inc.site.substring(0, 17) + '...' : inc.site,
            `${inc.year}-${String(inc.month).padStart(2, '0')}`,
            inc.type,
            inc.location && inc.location.length > 15 ? inc.location.substring(0, 12) + '...' : (inc.location || '—'),
            inc.recordable_osha ? 'Sí' : 'No',
          ]);

          autoTable(pdf, {
            startY: currentY,
            head: [['ID', 'Sitio', 'Período', 'Tipo', 'Ubicación', 'Reg.']],
            body: incidentData,
            theme: 'grid',
            styles: { 
              fontSize: 8,
              cellPadding: 3,
              lineColor: [220, 220, 220],
              lineWidth: 0.1
            },
            headStyles: { 
              fillColor: [59, 130, 246],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 9,
              cellPadding: 4
            },
            columnStyles: {
              0: { cellWidth: 20, fontSize: 7 },
              1: { cellWidth: 'auto' },
              2: { halign: 'center', cellWidth: 22 },
              3: { cellWidth: 28 },
              4: { cellWidth: 32, fontSize: 7 },
              5: { halign: 'center', cellWidth: 15, fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 10;
        }

        setProgress(55);

        // ========== SECCIÓN 5: DATOS DE EXPOSICIÓN ==========
        if (exposureHours.length > 0) {
          if (currentY + 80 > pageHeight - margin - 15) {
            pdf.addPage();
            currentY = margin + 5;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(14);
          pdf.setTextColor(16, 185, 129);
          pdf.text(`5. Datos de Exposición (Mostrando ${Math.min(exposureHours.length, 20)} de ${exposureHours.length})`, margin, currentY);
          pdf.setDrawColor(16, 185, 129);
          pdf.setLineWidth(0.8);
          pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
          currentY += 12;

          // Calcular totales
          const totalHours = exposureHours.reduce((sum, exp) => sum + exp.hours, 0);
          
          const exposureData = exposureHours.slice(0, 20).map(exp => [
            exp.site.length > 25 ? exp.site.substring(0, 22) + '...' : exp.site,
            exp.period,
            exp.hours.toLocaleString('es-ES'),
          ]);

          autoTable(pdf, {
            startY: currentY,
            head: [['Sitio', 'Período', 'Horas Hombre']],
            body: exposureData,
            foot: [['TOTAL', '', totalHours.toLocaleString('es-ES')]],
            theme: 'grid',
            styles: { 
              fontSize: 9,
              cellPadding: 4,
              lineColor: [220, 220, 220],
              lineWidth: 0.1
            },
            headStyles: { 
              fillColor: [16, 185, 129],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 10,
              cellPadding: 5
            },
            footStyles: {
              fillColor: [16, 185, 129],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 10
            },
            columnStyles: {
              0: { cellWidth: 'auto' },
              1: { halign: 'center', cellWidth: 35 },
              2: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
            },
            margin: { left: margin, right: margin },
          });

          currentY = (pdf as any).lastAutoTable.finalY + 12;
        }

        setProgress(65);

        // ========== SECCIÓN 6: CONFIGURACIÓN DEL SISTEMA ==========
        if (currentY + 50 > pageHeight - margin - 15) {
          pdf.addPage();
          currentY = margin + 5;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(139, 92, 246);
        pdf.text("6. Configuración del Sistema", margin, currentY);
        pdf.setDrawColor(139, 92, 246);
        pdf.setLineWidth(0.8);
        pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
        currentY += 12;

        const configData = [
          ['Base IF (Injury Frequency)', settings.base_if?.toLocaleString('es-ES') || '1,000,000', 'Horas'],
          ['Base TRIR (Total Recordable)', settings.base_trir?.toLocaleString('es-ES') || '200,000', 'Horas'],
          ['Límite de Días (Cap)', settings.days_cap?.toString() || '180', 'Días'],
        ];

        autoTable(pdf, {
          startY: currentY,
          head: [['Parámetro', 'Valor', 'Unidad']],
          body: configData,
          theme: 'grid',
          styles: { 
            fontSize: 10,
            cellPadding: 4,
            lineColor: [220, 220, 220],
            lineWidth: 0.1
          },
          headStyles: { 
            fillColor: [139, 92, 246],
            textColor: 255,
            fontStyle: 'bold',
            cellPadding: 5
          },
          columnStyles: {
            0: { cellWidth: 'auto', fontStyle: 'bold' },
            1: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: [139, 92, 246] },
            2: { halign: 'center', cellWidth: 30 }
          },
          margin: { left: margin, right: margin },
        });

        currentY = (pdf as any).lastAutoTable.finalY + 12;
        setProgress(70);
      }

      // ========== SECCIÓN 7: GRÁFICOS SELECCIONADOS ==========
      if (selectedCharts.length > 0) {
        pdf.addPage();
        let currentY = margin + 5;

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.setTextColor(239, 68, 68);
        pdf.text("7. Análisis Gráfico", margin, currentY);
        pdf.setDrawColor(239, 68, 68);
        pdf.setLineWidth(1);
        pdf.line(margin, currentY + 3, pageWidth - margin, currentY + 3);
        currentY += 15;

        for (let i = 0; i < selectedCharts.length; i++) {
          const chart = selectedCharts[i];
          setProgress(70 + Math.round((i / selectedCharts.length) * 25));

          const element = document.getElementById(chart.elementId);
          if (!element) {
            console.warn(`Elemento ${chart.elementId} no encontrado`);
            continue;
          }

          try {
            const canvas = await html2canvas(element, {
              scale: 2,
              backgroundColor: '#ffffff',
              logging: false,
              useCORS: true,
              windowWidth: element.scrollWidth,
              windowHeight: element.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = maxWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Limitar altura máxima del gráfico
            const maxImgHeight = pageHeight - margin * 2 - 40;
            let finalImgHeight = imgHeight;
            let finalImgWidth = imgWidth;
            
            if (imgHeight > maxImgHeight) {
              finalImgHeight = maxImgHeight;
              finalImgWidth = (canvas.width * maxImgHeight) / canvas.height;
            }

            // Verificar espacio y crear nueva página si es necesario
            if (currentY + finalImgHeight + 30 > pageHeight - margin - 15) {
              pdf.addPage();
              currentY = margin + 5;
            }

            // Título del gráfico con fondo
            pdf.setFillColor(245, 247, 250);
            pdf.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
            
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11);
            pdf.setTextColor(51, 65, 85);
            pdf.text(`7.${i + 1} ${chart.name}`, margin + 3, currentY + 7);
            currentY += 15;

            // Centrar imagen si es más pequeña que el ancho máximo
            const xOffset = finalImgWidth < maxWidth ? margin + (maxWidth - finalImgWidth) / 2 : margin;
            
            // Agregar sombra sutil
            pdf.setFillColor(240, 240, 240);
            pdf.roundedRect(xOffset + 1, currentY + 1, finalImgWidth, finalImgHeight, 3, 3, 'F');
            
            // Agregar imagen
            pdf.addImage(imgData, 'PNG', xOffset, currentY, finalImgWidth, finalImgHeight);
            
            // Borde del gráfico
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.5);
            pdf.roundedRect(xOffset, currentY, finalImgWidth, finalImgHeight, 3, 3, 'S');
            
            currentY += finalImgHeight + 20;

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`Error capturando gráfico ${chart.name}:`, error);
          }
        }
      }

      setProgress(95);

      // ========== NUMERACIÓN Y PIE DE PÁGINA ==========
      const pageCount = pdf.getNumberOfPages();
      const currentDate = new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        if (i > 1) { // Skip portada
          // Línea superior del pie de página
          pdf.setDrawColor(220, 220, 220);
          pdf.setLineWidth(0.3);
          pdf.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
          
          // Texto del pie de página
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(120, 120, 120);
          
          // Izquierda: Empresa y fecha
          pdf.text('SST Metrics Pro - TACKER SRL', margin, pageHeight - 12);
          pdf.text(`Generado: ${currentDate}`, margin, pageHeight - 7);
          
          // Centro: Número de página
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.text(
            `Página ${i} de ${pageCount}`,
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
          );
          
          // Derecha: Marca de confidencialidad
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(7);
          pdf.setTextColor(180, 180, 180);
          pdf.text('Documento Confidencial', pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
      }

      setProgress(100);

      // ========== GUARDAR PDF ==========
      const fileName = `SST_Reporte_Integral_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex justify-between items-center">
          <div className="flex items-center text-white">
            <FileDown className="w-6 h-6 mr-3" />
            <div>
              <h3 className="font-bold text-lg">Centro de Exportación PDF Completo</h3>
              <p className="text-xs text-blue-100 mt-1">Datos del proyecto + Gráficos seleccionados</p>
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

        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveSection('charts')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeSection === 'charts'
                ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Gráficos ({selectedCount})</span>
          </button>
          <button
            onClick={() => setActiveSection('config')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
              activeSection === 'config'
                ? 'bg-white border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Configuración</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeSection === 'charts' ? (
            <>
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
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Datos Incluidos en el PDF</h4>
                    <ul className="text-sm text-blue-800 space-y-1.5">
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>KPIs Principales:</strong> TRIR, LTIF, DART, SR, FAR y contadores</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Seguridad de Procesos:</strong> Tier 1 y Tier 2 PSER</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Top 5 Sitios:</strong> Ranking de incidentalidad</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Tabla de Incidentes:</strong> Primeros 20 registros detallados</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Exposición:</strong> Primeros 15 registros de horas hombre</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Configuración:</strong> Parámetros del sistema</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Gráficos:</strong> Los que selecciones en la pestaña anterior</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <Table className="w-4 h-4 mr-2" />
                  Resumen de Datos Actuales
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">Total Incidentes</p>
                    <p className="text-2xl font-bold text-gray-900">{incidents.length}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">Registrables</p>
                    <p className="text-2xl font-bold text-red-600">{metrics.totalRecordables}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">TRIR Actual</p>
                    <p className="text-2xl font-bold text-blue-600">{metrics.trir?.toFixed(2) || '—'}</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">LTIF Actual</p>
                    <p className="text-2xl font-bold text-orange-600">{metrics.ltif?.toFixed(2) || '—'}</p>
                  </div>
                </div>
              </div>

              <label className="flex items-center space-x-3 p-4 bg-white border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                <input
                  type="checkbox"
                  checked={includeFullData}
                  onChange={(e) => setIncludeFullData(e.target.checked)}
                  disabled={exporting}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900">Incluir todos los datos del proyecto</span>
                  <p className="text-xs text-gray-500 mt-0.5">Desactívalo si solo quieres exportar los gráficos</p>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-5 bg-gray-50">
          {exporting && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Generando PDF completo...</span>
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
              disabled={exporting || (!includeFullData && selectedCount === 0)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <FileDown className="w-5 h-5" />
              <span>{exporting ? 'Generando...' : 'Exportar PDF Completo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
