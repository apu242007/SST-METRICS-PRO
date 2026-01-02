
import { Incident } from "../types";

export interface SafetyTalk {
  title: string;
  whyToday: string;
  keyMessages: string[];
  actions: string[];
  closing: string;
  sourceInfo: string;
  isRobust: boolean;
}

export const generateSafetyTalk = (
  selectedDate: string, 
  dayIncidents: Incident[], 
  historicalIncidents: Incident[]
): SafetyTalk => {
  const [year, month, day] = selectedDate.split('-');
  const dateFormatted = `${day}/${month}/${year}`;
  const totalHistorical = historicalIncidents.length;
  
  // Basic patterns aggregation
  const typeFreq: Record<string, number> = {};
  const siteFreq: Record<string, number> = {};
  let highPotentialCount = 0;

  historicalIncidents.forEach(i => {
    typeFreq[i.type] = (typeFreq[i.type] || 0) + 1;
    siteFreq[i.site] = (siteFreq[i.site] || 0) + 1;
    if (i.potential_risk.toLowerCase().includes('alta')) highPotentialCount++;
  });

  const topType = Object.entries(typeFreq).sort((a, b) => b[1] - a[1])[0];
  const topSite = Object.entries(siteFreq).sort((a, b) => b[1] - a[1])[0];
  
  const years = Array.from(new Set(historicalIncidents.map(i => i.year))).sort();

  if (totalHistorical < 2) {
    return {
      title: `Charla de 5 minutos – Seguridad del día (${dateFormatted})`,
      whyToday: "No hay histórico suficiente para una lección robusta sobre esta fecha específica.",
      keyMessages: [
        "Mantener la atención plena en las tareas rutinarias.",
        "Reportar cualquier condición insegura detectada al inicio del turno.",
        "El orden y la limpieza son la base de la prevención."
      ],
      actions: [
        "Verificar el estado de las herramientas manuales antes de usarlas.",
        "Reforzar el uso correcto de los EPP específicos del área.",
        "Asegurar que las vías de escape estén libres de obstrucciones."
      ],
      closing: "Recordatorio: reportar incidentes de inmediato y corregir condiciones inseguras.",
      sourceInfo: `Basado en recordatorios preventivos generales (Histórico insuficiente en fecha ${day}/${month}).`,
      isRobust: false
    };
  }

  const messages = [
    `Históricamente, el tipo de incidente más común en esta fecha es: ${topType[0]} (${topType[1]} casos).`,
    `El sitio con mayor recurrencia registrada para este día es: ${topSite[0]}.`,
    highPotentialCount > 0 
      ? `Se han registrado ${highPotentialCount} incidentes de ALTA POTENCIALIDAD en años anteriores para esta fecha.`
      : "Aunque no hay fatalidades históricas hoy, la complacencia es nuestro mayor riesgo."
  ];

  const actions = [
    `Verificar protocolos específicos para mitigar riesgos de ${topType[0].toLowerCase()}.`,
    `Reforzar la supervisión en ${topSite[0]} durante las horas críticas del turno.`,
    "Comunicar a todo el equipo los hallazgos de incidentes pasados para evitar repeticiones."
  ];

  return {
    title: `Charla de 5 minutos – Seguridad del día (${dateFormatted})`,
    whyToday: `Hoy recordamos que en años anteriores (${years.join(', ')}) se registraron ${totalHistorical} eventos en nuestra base de datos para un día como hoy.`,
    keyMessages: messages,
    actions: actions,
    closing: "Recordatorio: reportar incidentes de inmediato y corregir condiciones inseguras.",
    sourceInfo: `Basado en ${totalHistorical} incidentes históricos del ${day}/${month} (Años: ${years.join(', ')}).`,
    isRobust: true
  };
};
