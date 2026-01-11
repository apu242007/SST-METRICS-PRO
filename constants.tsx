
import { MappingRule, AppSettings, KPITargets, TargetScenarioType, BodyZone, DashboardMetrics } from "./types";

export const DEFAULT_KPI_SETTINGS: AppSettings = {
  base_if: 1000,    // ILO/SRT Severity Rate (base 1000)
  base_trir: 200000, // OSHA Standard
  days_cap: 180,
};

// --- EMPTY STATE CONSTANT (NEW) ---
export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  totalManHours: 0,
  totalKM: 0,
  totalIncidents: 0,
  totalRecordables: 0,
  totalLTI: 0,
  totalFatalities: 0,
  totalDaysLost: 0,
  totalDARTCases: 0,
  trir: 0,
  ltif: 0,
  dart: 0,
  sr: 0,
  alos: 0,
  far: 0,
  t1_count: 0,
  t2_count: 0,
  t1_pser: 0,
  t2_pser: 0,
  incidenceRateSRT: 0,
  slg24h: 0,
  incidenceRatePct: 0,
  ifatRate: 0,
  envIncidentsMajor: 0,
  envIncidentsMinor: 0,
  probabilityIndexLabel: 'N/A',
  hipoRate: 0,
  hipoCount: 0,
  forecast_trir: 0,
  forecast_lti_count: 0,
  forecast_recordable_count: 0,
  risk_index_total: 0,
  risk_index_rate: 0,
  cnt_transit_laboral: 0,
  cnt_in_itinere: 0,
  rate_in_itinere_hh: 0,
  top5Sites: [],
  daysSinceList: [],
  trendAlerts: [],
  siteEvolutions: [],
  suggestedActions: []
};

// --- DEFINICIONES DE FÓRMULAS PARA MODALES ---
export const KPI_DEFINITIONS = {
    trir: {
        title: "TRIR (Total Recordable Incident Rate)",
        description: "Mide la frecuencia de incidentes registrables (médicos, con baja, restringidos) normalizada por 200,000 horas.",
        formula: "( Incidentes Registrables x 200,000 ) / Horas Hombre Totales",
        numeratorLabel: "Incidentes Registrables",
        denominatorLabel: "Horas Hombre",
        factor: 200000
    },
    ltif: {
        title: "LTIF (Lost Time Injury Frequency)",
        description: "Frecuencia de lesiones con tiempo perdido (incapacitantes) normalizada bajo estándar IOGP (1 millón de horas).",
        formula: "( Incidentes LTI x 1,000,000 ) / Horas Hombre Totales",
        numeratorLabel: "Incidentes LTI",
        denominatorLabel: "Horas Hombre",
        factor: 1000000
    },
    dart: {
        title: "DART (Days Away, Restricted or Transferred)",
        description: "Tasa de incidentes que resultaron en días perdidos, trabajo restringido o transferencia de puesto.",
        formula: "( Casos DART x 200,000 ) / Horas Hombre Totales",
        numeratorLabel: "Casos DART",
        denominatorLabel: "Horas Hombre",
        factor: 200000
    },
    sr: {
        title: "SR (Severity Rate)",
        description: "Tasa de severidad que mide la cantidad de días perdidos por cada 1,000 horas trabajadas (Estándar OIT/SRT).",
        formula: "( Días Perdidos + Restringidos x 1,000 ) / Horas Hombre Totales",
        numeratorLabel: "Días Perdidos/Restr.",
        denominatorLabel: "Horas Hombre",
        factor: 1000
    },
    far: {
        title: "FAR (Fatal Accident Rate)",
        description: "Tasa de accidentes fatales normalizada por 100 millones de horas hombre.",
        formula: "( Fatalidades x 100,000,000 ) / Horas Hombre Totales",
        numeratorLabel: "Fatalidades",
        denominatorLabel: "Horas Hombre",
        factor: 100000000
    },
    t1_pser: {
        title: "Tier 1 PSER (Process Safety Event Rate)",
        description: "Tasa de eventos de seguridad de procesos mayores (Tier 1) según API RP 754.",
        formula: "( Eventos Tier 1 x 200,000 ) / Horas Hombre Totales",
        numeratorLabel: "Eventos Tier 1",
        denominatorLabel: "Horas Hombre",
        factor: 200000
    },
    t2_pser: {
        title: "Tier 2 PSER (Process Safety Event Rate)",
        description: "Tasa de eventos de seguridad de procesos de menor magnitud (Tier 2) según API RP 754.",
        formula: "( Eventos Tier 2 x 200,000 ) / Horas Hombre Totales",
        numeratorLabel: "Eventos Tier 2",
        denominatorLabel: "Horas Hombre",
        factor: 200000
    },
    incidenceRateSRT: {
        title: "Índice de Incidencia (SRT)",
        description: "Indicador regulatorio argentino. Estima la cantidad de casos con baja cada 1000 trabajadores cubiertos.",
        formula: "( Casos con Baja x 1,000 ) / Trabajadores Promedio",
        numeratorLabel: "Casos con Baja",
        denominatorLabel: "Trabajadores Promedio",
        factor: 1000
    },
    slg24h: {
        title: "Cumplimiento SLG 24h",
        description: "Porcentaje de denuncias a la ART realizadas dentro de las 24 horas de ocurrido el evento.",
        formula: "( Denuncias <= 24h / Total Denunciables ) * 100",
        numeratorLabel: "Denuncias a Tiempo",
        denominatorLabel: "Total Denunciables",
        factor: 100
    },
    ifatRate: {
        title: "IFAT (Índice de Frecuencia de Accidentes de Tránsito)",
        description: "Frecuencia de accidentes viales laborales por millón de kilómetros recorridos.",
        formula: "( Accidentes Viales x 1,000,000 ) / Kilómetros Recorridos",
        numeratorLabel: "Accidentes Viales",
        denominatorLabel: "KM Totales",
        factor: 1000000
    }
};

// Based on Corporate Standard (OSHA 200k, IOGP 1M, FAR 100M)
export const TARGET_SCENARIOS: Record<TargetScenarioType, KPITargets> = {
  'Realista 2025': {
      trir: 2.50,        // 200k
      ltif: 5.00,        // 1M (Approx TRIR*2 for mixed severity) - Industry avg ~3-5
      dart: 1.20,        // 200k
      sr: 0.20,          // 1000 base
      far: 2.00,         // 100M base
      
      t1_pser: 0.50,     // 200k
      t2_pser: 1.50,     // 200k
      
      ifat_km: 3.00,     
      max_events_trir: 25,
      max_events_lti: 10,
      incidence_rate_pct: 2.5,
      env_major: 0,
      env_minor: 5,
      probability_index_target: 'Medio',
      hipo_rate_min: 0.1,
  },
  'Metas 2026': {
      trir: 1.20,        // Corporate Target 2026
      ltif: 2.50,        // IOGP Target
      dart: 0.60,
      sr: 0.15,
      far: 0.00,

      t1_pser: 0.10,
      t2_pser: 1.00,

      ifat_km: 2.00,
      max_events_trir: 15,
      max_events_lti: 6,
      incidence_rate_pct: 1.5,
      env_major: 0,
      env_minor: 1,
      probability_index_target: 'Bajo',
      hipo_rate_min: 0.20, 
  }
};

export const RISK_WEIGHTS: Record<string, number> = {
    'Alta': 5,
    'High': 5,
    'Media': 3,
    'Medium': 3,
    'Baja': 1,
    'Low': 1,
    'N/A': 1 // Default for unclassified
};

export const DEFAULT_RULES: MappingRule[] = [
  { tipo_incidente: 'First Aid', default_recordable: false, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Medical Treatment', default_recordable: true, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Lost Time', default_recordable: true, default_lti: true, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Fatality', default_recordable: true, default_lti: true, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Accidente Vehicular/Tránsito', default_recordable: false, default_lti: false, default_is_transit_laboral: true, default_is_in_itinere: false },
  { tipo_incidente: 'Accidente In Itinere', default_recordable: false, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: true },
  { tipo_incidente: 'Environmental', default_recordable: false, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: false },
];

// Configuración Automática de Horas Hombre (HH)
// Reglas estrictas de negocio para asignación automática
export const SITE_HH_DEFAULTS = [
  // 1. Reglas por Patrón (Regex)
  // TKR- o Tkr- al inicio
  { name: "TKR- (Patrón)", hh: 12096, isPattern: true, pattern: /^TKR-/i },
  
  // 2. Reglas por Nombre Específico (Case-Insensitive Exact Match)
  // MASE Variants
  { name: "MASE", hh: 6048 },
  { name: "MASE-", hh: 6048 },
  { name: "MASE 01", hh: 6048 },
  { name: "MASE 02", hh: 6048 },
  { name: "MASE 03", hh: 6048 },

  // Cipolletti Variants
  { name: "BASE CIPOLLETTI", hh: 20160 },
  { name: "HTAS CIPO", hh: 20160 },

  // General Sites
  { name: "ALMACENES", hh: 2520 },
  { name: "ADMINISTRACION", hh: 15120 },
  { name: "GERENCIAS", hh: 6048 },
  { name: "QHSE", hh: 2520 },
  { name: "COMPRAS", hh: 1512 },
  { name: "IT", hh: 1512 },
  { name: "UTL", hh: 12600 },
  { name: "BASE COMODORO", hh: 5040 },
  { name: "BASE PICO TRUNCADO", hh: 2520 },
  
  // Fabrica Variants (Regex for Accent handling/variants)
  { name: "FABRICA", hh: 20160, isPattern: true, pattern: /^F[AÁ]BRICA$/i }, 

  { name: "MANTENIMIENTO WS", hh: 20160 },
  { name: "HERRAMIENTAS", hh: 20160 },
  { name: "JACWELL", hh: 10080 },
  { name: "BASE RDLS", hh: 5040 },
];

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// --- CATÁLOGO DE ZONAS ANATÓMICAS 2025 ---
export interface AnatomicalZoneRule {
    id: string;
    label: string; // Nombre en catálogo
    patterns: RegExp[]; // Patrones de coincidencia
    excludes?: RegExp[]; // Patrones de exclusión
    zones: BodyZone[]; // Zonas SVG base
    supportsSide: boolean; // Si soporta lateralidad (Izquierda/Derecha)
}

export const ANATOMICAL_ZONE_RULES: AnatomicalZoneRule[] = [
    { 
        id: 'ankle_foot',
        label: 'Tobillo / Pie',
        patterns: [/\bTOBILLO\b/, /\bPIE\b/, /\bTALON\b/],
        excludes: [/\bDEDOS\b/], 
        zones: ['foot_left', 'foot_right'], 
        supportsSide: true 
    },
    { 
        id: 'knee',
        label: 'Rodilla',
        patterns: [/\bRODILLA\b/, /\bROTULA\b/],
        zones: ['knee_left', 'knee_right'], 
        supportsSide: true 
    },
    { 
        id: 'thorax',
        label: 'Tórax',
        patterns: [/\bTORAX\b/, /\bCOSTILLA/, /\bESTERNON\b/, /\bPECHO\b/],
        zones: ['chest'], 
        supportsSide: false 
    },
    { 
        id: 'lower_limbs',
        label: 'Miembros Inferiores',
        patterns: [/\bMIEMBROS INFERIORES\b/, /\bPIERNA\b/, /\bMUSLO\b/, /\bFEMUR\b/, /\bTIBIA\b/],
        zones: ['leg_left', 'leg_right', 'knee_left', 'knee_right', 'foot_left', 'foot_right'], 
        supportsSide: true 
    },
    { 
        id: 'hand_fingers',
        label: 'Mano / Dedos',
        patterns: [/\bDEDOS DE LAS MANOS\b/, /\bMANO\b/, /\bMUÑECA\b/, /\bDEDOS\b/],
        zones: ['hand_left', 'hand_right'], 
        supportsSide: true 
    },
    { 
        id: 'lumbar_spine',
        label: 'Región Lumbosacra',
        patterns: [/\bREGION LUMBOSACRA\b/, /\bLUMBAR\b/, /\bCINTURA\b/],
        zones: ['back_lower'], 
        supportsSide: false 
    },
    { 
        id: 'upper_limbs_multiple',
        label: 'Miembro Superior Múltiple',
        patterns: [/\bMIEMBRO SUPERIOR\b/, /\bUBICACIONES MULTIPLES\b/],
        zones: ['shoulder_left', 'shoulder_right', 'arm_left', 'arm_right', 'hand_left', 'hand_right'], 
        supportsSide: true 
    },
    { 
        id: 'abdomen_lower_limbs',
        label: 'Abdomen y Miembros Inferiores',
        patterns: [/\bABDOMEN Y MIEMBROS INFERIORES\b/],
        zones: ['abdomen', 'leg_left', 'leg_right'], 
        supportsSide: false 
    },
    { 
        id: 'arm',
        label: 'Brazo',
        patterns: [/\bBRAZO\b/, /\bANTEBRAZO\b/, /\bCODO\b/],
        zones: ['arm_left', 'arm_right'], 
        supportsSide: true 
    },
    { 
        id: 'cervical',
        label: 'Región Cervical',
        patterns: [/\bREGION CERVICAL\b/, /\bCUELLO\b/],
        zones: ['neck'], 
        supportsSide: false 
    },
    { 
        id: 'spine_general',
        label: 'Columna Vertebral',
        patterns: [/\bCOLUMNA VERTEBRAL\b/],
        zones: ['neck', 'back_upper', 'back_lower'], 
        supportsSide: false 
    },
    { 
        id: 'head_eyes',
        label: 'Cabeza / Ojos',
        patterns: [/\bOJOS\b/, /\bPARPADOS\b/, /\bORBITA\b/, /\bCABEZA\b/, /\bCRANEO\b/, /\bROSTRO\b/],
        zones: ['head'], 
        supportsSide: false 
    },
    {
        id: 'abdomen',
        label: 'Abdomen',
        patterns: [/\bABDOMEN\b/, /\bESTOMAGO\b/],
        zones: ['abdomen'],
        supportsSide: false
    }
];
