
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { Incident, DashboardMetrics, PDFExportConfig, ExposureHour, SiteRanking, SiteDaysSafe, TrendAlert, SiteEvolution, SuggestedAction } from "../types";
import { generateSafetyTalk, SafetyTalk } from "./safetyTalkGenerator";

// --- THEME & CONSTANTS ---
const BRAND_COLOR = [239, 68, 68]; // #EF4444 (Red-500)
const TEXT_COLOR = [51, 65, 85]; // Slate-700
const SECONDARY_COLOR = [100, 116, 139]; // Slate-500
const MARGIN = 15;

// --- CORE CLASS ---
export class PDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private config: PDFExportConfig;
  private currentY: number;

  constructor(config: PDFExportConfig) {
    this.doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.config = config;
    this.currentY = 20;
    
    // Initial setup
    this.setupAutoHeaderFooter();
  }

  // --- HELPERS ---
  private addHeaderFooter(pageNumber: number, totalPages: number) {
    // Header
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
    this.doc.setFontSize(16);
    this.doc.text("TACKER SRL", MARGIN, 15);

    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    this.doc.setFontSize(9);
    const reportTitle = this.config.scope === 'FULL_REPORT' ? "Reporte Integral SST" : "Vista Exportada SST";
    this.doc.text(reportTitle, this.pageWidth - MARGIN, 15, { align: 'right' });

    // Separator
    this.doc.setDrawColor(226, 232, 240);
    this.doc.line(MARGIN, 18, this.pageWidth - MARGIN, 18);

    // Footer
    this.doc.setFontSize(8);
    this.doc.text(
        `Página ${pageNumber} de ${totalPages}`, 
        this.pageWidth / 2, 
        this.pageHeight - 10, 
        { align: 'center' }
    );
    this.doc.text(
        `Generado: ${new Date().toLocaleString('es-ES')}`, 
        this.pageWidth - MARGIN, 
        this.pageHeight - 10, 
        { align: 'right' }
    );
    this.doc.text(
        "SST Metrics Pro", 
        MARGIN, 
        this.pageHeight - 10, 
        { align: 'left' }
    );
  }

  private setupAutoHeaderFooter() {
    // We use autoTable's hooks for pages with tables, but need a wrapper for mixed content
    // Simpler approach: Just add it at the end of generation looping through pages
  }

  private checkPageBreak(heightNeeded: number) {
    if (this.currentY + heightNeeded > this.pageHeight - MARGIN) {
      this.doc.addPage();
      this.currentY = 25; // Reset Y below header
    }
  }

  private printFilters() {
    this.doc.setFontSize(10);
    this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
    const f = this.config.filters;
    
    let filterText = "";
    if (this.config.scope === 'FULL_REPORT') {
        filterText = "Alcance: BASE DE DATOS COMPLETA (Filtros ignorados)";
    } else {
        filterText = `Filtros: Sitio [${f.site}] | Año [${f.year}] | Mes [${f.month}] | Tipo [${f.type}]`;
    }

    this.doc.text(filterText, MARGIN, this.currentY);
    this.currentY += 6;
    
    // Notes
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8);
    this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    this.doc.text("Nota: IFAT (Tránsito laboral) excluye accidentes In Itinere.", MARGIN, this.currentY);
    this.doc.text("Fuentes: Incidentes (Excel Importado), Denominadores (Manual/Estimado).", MARGIN, this.currentY + 4);
    this.currentY += 10;
  }

  // --- SECTIONS ---

  public addCoverPage() {
    // Title
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(24);
    this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
    this.doc.text("Reporte de Seguridad e Higiene", MARGIN, 40);
    
    this.currentY = 50;
    this.printFilters();

    // Executive Summary Box
    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(MARGIN, this.currentY, this.pageWidth - (MARGIN * 2), 30, 2, 2, 'F');
    
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Alcance del Documento", MARGIN + 5, this.currentY + 8);
    
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    const scopeText = this.config.scope === 'FULL_REPORT' 
        ? "Este documento incluye el análisis completo de indicadores, tendencias, estado de calidad de datos y listados detallados de incidentes."
        : "Este documento es una exportación de la vista actual del sistema, incluyendo los datos visualizados en pantalla.";
    
    const splitScope = this.doc.splitTextToSize(scopeText, this.pageWidth - (MARGIN * 2) - 10);
    this.doc.text(splitScope, MARGIN + 5, this.currentY + 15);

    this.currentY += 40;
  }

  public addKPISection(metrics: DashboardMetrics, chartImage?: string) {
    this.checkPageBreak(80);
    
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
    this.doc.text("Indicadores Clave de Desempeño (KPIs)", MARGIN, this.currentY);
    this.currentY += 10;

    // KPI Grid Simulation
    const kpis = [
        { label: "TRIR (Tasa)", val: metrics.trir ?? "—" },
        { label: "LTIR (Tasa)", val: metrics.ltir ?? "—" },
        { label: "Días Perdidos", val: metrics.totalDaysLost },
        { label: "IFAT (Vial)", val: metrics.ifatRate ?? "—" },
        { label: "Total Incidentes", val: metrics.totalIncidents },
        { label: "Recordables", val: metrics.totalRecordables }
    ];

    let xPos = MARGIN;
    const boxWidth = (this.pageWidth - (MARGIN * 2)) / 3 - 4;
    
    kpis.forEach((kpi, idx) => {
        if (idx > 0 && idx % 3 === 0) {
            this.currentY += 25;
            xPos = MARGIN;
        }
        
        this.doc.setFillColor(255, 255, 255);
        this.doc.setDrawColor(203, 213, 225);
        this.doc.rect(xPos, this.currentY, boxWidth, 20, 'FD'); // Box
        
        this.doc.setFontSize(8);
        this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        this.doc.text(kpi.label, xPos + 2, this.currentY + 5);
        
        this.doc.setFontSize(12);
        this.doc.setFont("helvetica", "bold");
        this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
        this.doc.text(String(kpi.val), xPos + 2, this.currentY + 14);

        xPos += boxWidth + 6;
    });
    
    this.currentY += 30;

    // Charts
    if (chartImage) {
        this.checkPageBreak(90);
        this.doc.setFontSize(12);
        this.doc.text("Tendencias y Pareto", MARGIN, this.currentY);
        this.currentY += 5;
        // Image ratio maintenance is tricky, assuming generic landscape
        const imgHeight = 80; 
        this.doc.addImage(chartImage, 'PNG', MARGIN, this.currentY, this.pageWidth - (MARGIN*2), imgHeight);
        this.currentY += imgHeight + 10;
    }
  }

  public addManagementSection(top5: SiteRanking[], daysSafe: SiteDaysSafe[], trends: TrendAlert[]) {
      this.checkPageBreak(80);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      this.doc.text("Gestión Operativa y Alertas", MARGIN, this.currentY);
      this.currentY += 8;

      // 1. Top 5 Sites
      this.doc.setFontSize(11);
      this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      this.doc.text("1. Top 5 Sitios por Incidentes (YTD)", MARGIN, this.currentY);
      this.currentY += 5;

      const top5Body = top5.map(item => [String(item.rank), item.site, String(item.count)]);
      (this.doc as any).autoTable({
          startY: this.currentY,
          head: [['#', 'Sitio', 'Incidentes']],
          body: top5Body.length > 0 ? top5Body : [['-', 'Sin datos', '-']],
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [51, 65, 85] },
          margin: { left: MARGIN, right: MARGIN },
      });
      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;

      // 2. Days Without Accidents
      this.checkPageBreak(60);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("2. Días Sin Accidentes", MARGIN, this.currentY);
      this.currentY += 5;

      const daysBody = daysSafe.slice(0, 15).map(item => {
          let statusText = "OK";
          if (item.status === 'critical') statusText = "CRITICO (<=30)";
          else if (item.status === 'warning') statusText = "ALERTA (31-90)";
          else statusText = "SEGURO (>90)";
          return [item.site, String(item.days), item.lastDate, statusText];
      });

      (this.doc as any).autoTable({
          startY: this.currentY,
          head: [['Sitio', 'Días', 'Último Evento', 'Estado']],
          body: daysBody.length > 0 ? daysBody : [['Sin datos', '-', '-', '-']],
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [20, 184, 166] }, // Teal
          margin: { left: MARGIN, right: MARGIN },
      });
      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;

      // 3. Trends
      if (trends.length > 0) {
          this.checkPageBreak(50);
          this.doc.setFontSize(11);
          this.doc.setFont("helvetica", "bold");
          this.doc.setTextColor(220, 38, 38); // Red
          this.doc.text("3. Alertas de Tendencia Creciente (Últimos 3 Meses)", MARGIN, this.currentY);
          this.currentY += 5;
          
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(9);
          this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
          
          trends.forEach(t => {
              const hist = t.history.map(h => h.count).join(" -> ");
              this.doc.text(`• ${t.site}: Tendencia sostenida [${hist}]`, MARGIN + 5, this.currentY);
              this.currentY += 5;
          });
      } else {
          this.doc.setFontSize(10);
          this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
          this.doc.text("• No se detectan alertas de tendencia creciente.", MARGIN, this.currentY);
          this.currentY += 5;
      }
      
      this.currentY += 10;
  }

  // --- NEW: PREVENTIVE ANALYSIS SECTION ---
  public addPreventiveAnalysisSection(evolutions: SiteEvolution[], actions: SuggestedAction[]) {
      this.checkPageBreak(100);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      this.doc.text("Mejora Continua y Tendencias", MARGIN, this.currentY);
      this.currentY += 8;

      // Disclaimer
      this.doc.setFont("helvetica", "italic");
      this.doc.setFontSize(8);
      this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      this.doc.text("Este informe prioriza la mejora continua y la detección temprana de tendencias, no el cumplimiento de metas numéricas fijas.", MARGIN, this.currentY);
      this.currentY += 8;

      // 1. Evolution
      this.checkPageBreak(60);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      this.doc.text("1. Evolución de Desempeño (Trimestral)", MARGIN, this.currentY);
      this.currentY += 5;

      const evoBody = evolutions.sort((a,b) => b.variationPct - a.variationPct).map(item => {
          let statusText = "Estable";
          if (item.status === 'improving') statusText = "Mejora (>=20%)";
          if (item.status === 'deteriorating') statusText = "Deterioro (>=20%)";
          return [item.site, String(item.prevAvg), String(item.currentAvg), `${item.variationPct > 0 ? '+' : ''}${item.variationPct}%`, statusText];
      });

      (this.doc as any).autoTable({
          startY: this.currentY,
          head: [['Sitio', 'Prom. Anterior', 'Prom. Actual', 'Variación', 'Tendencia']],
          body: evoBody.length > 0 ? evoBody : [['-', '-', '-', '-', '-']],
          theme: 'grid',
          styles: { fontSize: 9 },
          headStyles: { fillColor: [147, 51, 234] }, // Purple
          margin: { left: MARGIN, right: MARGIN },
      });
      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;

      // 2. Actions
      this.checkPageBreak(80);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("2. Acciones Sugeridas Automáticas", MARGIN, this.currentY);
      this.currentY += 8;

      if (actions.length === 0) {
          this.doc.setFont("helvetica", "normal");
          this.doc.setFontSize(10);
          this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
          this.doc.text("• No se requieren acciones correctivas automáticas en este período.", MARGIN, this.currentY);
          this.currentY += 10;
      } else {
          actions.forEach(action => {
              this.checkPageBreak(30);
              
              this.doc.setFont("helvetica", "bold");
              this.doc.setFontSize(10);
              this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
              const reasonText = action.reason === 'deterioration' ? "Deterioro" : "Tendencia Creciente";
              this.doc.text(`Sitio: ${action.site} (Motivo: ${reasonText})`, MARGIN, this.currentY);
              this.currentY += 5;

              this.doc.setFont("helvetica", "normal");
              this.doc.setFontSize(9);
              action.actions.forEach(act => {
                  this.doc.text(`[ ] ${act}`, MARGIN + 5, this.currentY);
                  this.currentY += 5;
              });
              this.currentY += 3;
          });
      }
  }

  public addTableSection(title: string, head: string[], body: any[][], isTruncated: boolean) {
    this.checkPageBreak(40);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(12);
    this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
    this.doc.text(title, MARGIN, this.currentY);
    this.currentY += 5;

    if (isTruncated) {
        this.doc.setFont("helvetica", "italic");
        this.doc.setFontSize(9);
        this.doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        this.doc.text("Tabla resumida (Top Registros). Para ver todo, seleccione detalle 'Completo'.", MARGIN, this.currentY);
        this.currentY += 5;
    }

    (this.doc as any).autoTable({
        startY: this.currentY,
        head: [head],
        body: body,
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85] },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: (data: any) => {
            // Hook to update currentY after table
            this.currentY = data.cursor.y + 10;
        }
    });
  }

  public addPendingTasksSection(missingHH: any[]) {
      this.checkPageBreak(50);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      this.doc.text("Estado de Calidad de Datos (Pendientes)", MARGIN, this.currentY);
      this.currentY += 10;

      if (missingHH.length === 0) {
          this.doc.setFontSize(10);
          this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
          this.doc.text("• No hay faltantes críticos de Horas Hombre.", MARGIN, this.currentY);
          this.currentY += 10;
      } else {
          this.doc.setFontSize(10);
          this.doc.setTextColor(220, 38, 38); // Red
          this.doc.text("Atención: Faltan Horas Hombre en los siguientes sitios:", MARGIN, this.currentY);
          this.currentY += 6;
          
          missingHH.forEach(m => {
              this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
              const txt = `• ${m.site}: Faltan ${m.missingPeriods.length} periodos. Impacta ${m.affectedIncidentsCount} incidentes.`;
              this.doc.text(txt, MARGIN + 5, this.currentY);
              this.currentY += 5;
          });
          this.currentY += 5;
      }
  }

  public addSafetyTalkSection(date: string, dayIncidents: Incident[], historyIncidents: Incident[]) {
      this.checkPageBreak(120);
      const talk = generateSafetyTalk(date, dayIncidents, historyIncidents);
      
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(14);
      this.doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
      this.doc.text("Anexo: Charla de Seguridad (5 Minutos)", MARGIN, this.currentY);
      this.currentY += 10;

      // Box
      this.doc.setFillColor(240, 253, 250); // Teal-50
      this.doc.setDrawColor(20, 184, 166); // Teal-500
      this.doc.roundedRect(MARGIN, this.currentY, this.pageWidth - (MARGIN*2), 90, 2, 2, 'FD');

      let innerY = this.currentY + 10;
      this.doc.setTextColor(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2]);
      
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(talk.title, MARGIN + 5, innerY);
      innerY += 8;

      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "normal");
      const whyLines = this.doc.splitTextToSize(talk.whyToday, this.pageWidth - (MARGIN*2) - 10);
      this.doc.text(whyLines, MARGIN + 5, innerY);
      innerY += 15;

      this.doc.setFont("helvetica", "bold");
      this.doc.text("Mensajes Clave:", MARGIN + 5, innerY);
      innerY += 5;
      this.doc.setFont("helvetica", "normal");
      talk.keyMessages.forEach(m => {
          this.doc.text(`- ${m}`, MARGIN + 5, innerY);
          innerY += 5;
      });

      innerY += 5;
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Acciones Inmediatas:", MARGIN + 5, innerY);
      innerY += 5;
      this.doc.setFont("helvetica", "normal");
      talk.actions.forEach(a => {
          this.doc.text(`[ ] ${a}`, MARGIN + 5, innerY);
          innerY += 5;
      });

      this.currentY += 100;
  }

  public finalSave(fileName: string) {
    // Post-processing: Add Header/Footer to all pages
    const pageCount = this.doc.internal.pages.length - 1;
    for(let i = 1; i <= pageCount; i++) {
        this.doc.setPage(i);
        this.addHeaderFooter(i, pageCount);
    }
    this.doc.save(fileName);
  }
}

export const exportToPDF = (
  date: string,
  dayIncidents: Incident[],
  historyIncidents: Incident[],
  talk: SafetyTalk | null,
  options: {
    include2026Table: boolean;
    includeHistoryTable: boolean;
    includeTalk: boolean;
    includeFilters: boolean;
    filters: { site: string, type: string };
  }
) => {
  const config: PDFExportConfig = {
    scope: 'CURRENT_VIEW',
    detailLevel: 'SUMMARY',
    sections: {
      kpis: false,
      trends: false,
      rawTable: false,
      normalizedTable: false,
      pendingTasks: false,
      safetyTalk: false,
      calendar: false,
      management: false,
      preventive: false
    },
    filters: {
        site: options.filters.site,
        type: options.filters.type,
        year: date.split('-')[0],
        month: date.split('-')[1]
    },
    meta: {
      fileName: `Reporte_Diario_${date}.pdf`,
      generatedBy: 'SST Metrics Pro'
    }
  };

  const gen = new PDFGenerator(config);
  
  gen.addCoverPage(); 

  if (options.include2026Table && dayIncidents.length > 0) {
      const body = dayIncidents.map(i => [
          i.incident_id, i.site, i.type, i.potential_risk, i.description
      ]);
      gen.addTableSection(
          `Incidentes del Día: ${date}`,
          ['ID', 'Sitio', 'Tipo', 'Severidad', 'Descripción'],
          body,
          false
      );
  }

  if (options.includeHistoryTable && historyIncidents.length > 0) {
      const body = historyIncidents.map(i => [
          String(i.year), i.site, i.type, i.potential_risk, i.description
      ]);
      gen.addTableSection(
          `Histórico (Un día como hoy)`,
          ['Año', 'Sitio', 'Tipo', 'Severidad', 'Descripción'],
          body,
          false
      );
  }

  if (options.includeTalk && talk) {
      gen.addSafetyTalkSection(date, dayIncidents, historyIncidents);
  }

  gen.finalSave(config.meta.fileName);
};
