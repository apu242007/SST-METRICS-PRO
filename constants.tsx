
import { MappingRule, AppSettings, KPITargets, TargetScenarioType, BodyZone } from "./types";

export const DEFAULT_KPI_SETTINGS: AppSettings = {
  base_if: 1000000, // ISO / LatAm Standard for IF (LTI freq)
  base_trir: 200000, // OSHA Standard for TRIR/LTIR
  days_cap: 180,
};

// Based on ~2M HH/year baseline for event calculations
export const TARGET_SCENARIOS: Record<TargetScenarioType, KPITargets> = {
  'Realista': {
      trir: 2.50,        
      ltir: 1.00,        
      if: 2.00,          
      ig: 200,           
      ifat_km: 3.00,     
      max_events_trir: 25,
      max_events_lti: 10,
      incidence_rate_pct: 2.5,
      env_major: 0,
      env_minor: 5,
      probability_index_target: 'Medio',
      hipo_rate_min: 0.1 // 1 per 10
  },
  'Desafiante': {
      trir: 1.80,        
      ltir: 0.80,        
      if: 1.50,
      ig: 100,           
      ifat_km: 2.50,
      max_events_trir: 18,
      max_events_lti: 8,
      incidence_rate_pct: 2.0,
      env_major: 0,
      env_minor: 2,
      probability_index_target: 'Bajo',
      hipo_rate_min: 0.15 
  },
  'Excelencia': {
      trir: 0.50,        
      ltir: 0.20,        
      if: 1.00,
      ig: 50,
      ifat_km: 0.00,
      max_events_trir: 5,
      max_events_lti: 2,
      incidence_rate_pct: 1.0,
      env_major: 0,
      env_minor: 0,
      probability_index_target: 'Bajo',
      hipo_rate_min: 0.2 // 1 per 5
  },
  'Metas 2026': {
      trir: 1.50,
      ltir: 0.60,
      if: 1.20,
      ig: 150,
      ifat_km: 2.00,
      max_events_trir: 15,
      max_events_lti: 6,
      incidence_rate_pct: 1.5,
      env_major: 0,
      env_minor: 1,
      probability_index_target: 'Bajo',
      hipo_rate_min: 0.20, // 1 evento por cada 5 incidentes (20%)
      total_incidents_reduction: 15 // 15% reduction
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
// Define la relación entre textos de input normalizados y zonas visuales SVG.
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
