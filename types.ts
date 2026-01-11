export enum IncidentType {
  FirstAid = 'First Aid',
  MedicalTreatment = 'Medical Treatment',
  LostTime = 'Lost Time Injury',
  Fatality = 'Fatality',
  PropertyDamage = 'Property Damage',
  NearMiss = 'Near Miss',
  Environmental = 'Environmental',
  Unspecified = 'Unspecified',
  ProcessSafetyTier1 = 'Process Safety Tier 1',
  ProcessSafetyTier2 = 'Process Safety Tier 2'
}

export type BodyZone = 
  | 'head' | 'neck' | 'shoulder_left' | 'shoulder_right' 
  | 'arm_left' | 'arm_right' | 'hand_left' | 'hand_right'
  | 'chest' | 'back_upper' | 'back_lower' | 'abdomen' | 'hip'
  | 'leg_left' | 'leg_right' | 'knee_left' | 'knee_right'
  | 'foot_left' | 'foot_right' | 'general' | 'unknown';

export interface ChangeLogEntry {
  date: string;
  field: string;
  old_value: any;
  new_value: any;
  user: string; // 'System (Import)' | 'User (Manual)'
}

// --- SGI MODULE TYPES ---
export interface SGIDocument {
  code: string;       // PK: e.g., "PO-SGI-002"
  title: string;      // e.g., "INVESTIGACIÓN DE INCIDENTES"
  type: string;       // Derived from prefix: PO, PG, IT, MSGI
  area: string;       // Derived from middle: SGI, FAB, ADM, ING
  objective?: string; // Content description
  scope?: string;     // New: "ALCANCE" from CSV
  associatedDocs?: string; // New: "DOCUMENTOS ASOCIADOS"
  version?: string;   // e.g., "04"
  link?: string;      // URL to file (placeholder)
  tags?: string[];
}

export interface LinkedDocument {
  id: string; // UUID for the link
  document_code: string;
  document_title: string;
  association_type: 'NON_COMPLIANCE' | 'REFERENCE' | 'NOT_APPLICABLE' | 'TRAINING_GAP';
  comments?: string;
  added_at: string;
}

export interface Incident {
  // PK
  incident_id: string;

  // Imported Fields (Source: Excel)
  name: string;
  description: string;
  site: string;
  type: string;
  location: string;
  potential_risk: string; // "Potencialidad del Incidente" (Alta/Media/Baja)
  
  // Body Map Fields (New)
  body_part_text: string; // Raw text from "Datos ART: UBICACIÓN DE LA LESIÓN"
  affected_zones: BodyZone[]; // Parsed zones
  
  // Manual / Calculated Fields (Source: User / Defaults)
  fecha_evento: string; // YYYY-MM-DD
  year: number;
  month: number;
  
  recordable_osha: boolean;
  lti_case: boolean;
  
  // Classification Flags
  is_transit_laboral: boolean; // "Accidente Vehicular/Tránsito" (Included in IFAT)
  is_in_itinere: boolean; // "Accidente In Itinere" (Excluded from IFAT)
  is_transit: boolean; // Legacy/General flag (Union of above)
  
  // NEW: Client Communication Flag
  com_cliente: boolean;

  fatality: boolean;
  
  days_away: number;
  days_restricted: number;
  job_transfer: boolean;

  // PROCESS SAFETY (API RP 754)
  is_process_safety_tier_1: boolean;
  is_process_safety_tier_2: boolean;
  severity_points_tier1?: number; // For T1 PSESR
  
  // Data Integrity & Meta
  raw_json: string; // JSON string of original excel row
  is_verified: boolean;
  updated_at: string;
  
  // Audit
  change_log?: ChangeLogEntry[];
  version?: number;

  // SGI Integration
  linked_documents?: LinkedDocument[];
}

export interface ExposureHour {
  id: string;
  site: string;
  period: string; // YYYY-MM
  worker_type: 'total' | 'own' | 'contractor';
  hours: number;
}

// SIMPLIFIED: Global KM Entry (Annual or YTD)
export interface GlobalKmRecord {
  year: number;
  value: number;
  last_updated: string;
}

// Deprecated per-site ExposureKm interface kept only if needed for migration, 
// but logically replaced by GlobalKmRecord for IFAT.
export interface ExposureKm {
  id: string;
  site: string;
  period: string; // YYYY-MM
  km: number;
}

export interface MappingRule {
  tipo_incidente: string;
  default_recordable: boolean;
  default_lti: boolean;
  default_is_transit_laboral: boolean;
  default_is_in_itinere: boolean;
}

export interface AppSettings {
  base_if: number;
  base_trir: number;
  days_cap: number;
}

export interface KPITargets {
  // Occupational Safety
  trir: number;       // 200k base
  ltif: number;       // 1M base
  dart: number;       // 200k base
  sr: number;         // Severity Rate (1000 base)
  far: number;        // Fatality Rate (100M base)
  
  // Process Safety
  t1_pser: number;    // Tier 1 Rate (200k)
  t2_pser: number;    // Tier 2 Rate (200k)
  
  // Regulatory / Other
  ifat_km: number;    // IFAT Rate
  
  // System Efficacy
  lcer: number;       // Legal Compliance %
  iap: number;        // Internal Audit Performance %
  capa_otc: number;   // Action Closure %

  // Legacy/Helper targets
  max_events_trir: number;
  max_events_lti: number;
  incidence_rate_pct: number; 
  env_major: number;
  env_minor: number;
  probability_index_target: string;
  hipo_rate_min: number;
}

export type TargetScenarioType = 'Realista 2025' | 'Metas 2026';

// --- NEW MANAGEMENT KPI INTERFACES ---
export interface SiteRanking {
  site: string;
  count: number;
  rank: number;
}

export interface SiteDaysSafe {
  site: string;
  days: number;
  lastDate: string;
  status: 'critical' | 'warning' | 'safe'; // Critical <=30, Warning 31-90, Safe >90
}

export interface TrendAlert {
  site: string;
  history: { month: number, count: number }[]; // Last 3 months sequence
  trend: 'increasing';
}

// --- ADVANCED PREVENTIVE INTERFACES ---
export interface SiteEvolution {
  site: string;
  currentAvg: number; // Last 3 months
  prevAvg: number; // Previous 3 months
  variationPct: number;
  status: 'improving' | 'stable' | 'deteriorating';
}

export interface SuggestedAction {
  site: string;
  reason: 'deterioration' | 'trend_alert';
  title: string;
  actions: string[]; // List of 3 specific actions
}

export interface DashboardMetrics {
  // Exposure
  totalManHours: number;
  totalKM: number; 
  
  // --- A. Occupational Safety (Lagging) ---
  totalIncidents: number;
  totalRecordables: number;
  totalLTI: number;
  totalFatalities: number;
  totalDaysLost: number; // For SR
  totalDARTCases: number;

  trir: number | null;      // (Recordables * 200k) / H
  dart: number | null;      // (DART cases * 200k) / H
  ltif: number | null;      // (LTI * 1M) / H
  sr: number | null;        // (Days Lost * 1000) / H (ILO Standard)
  alos: number | null;      // Avg Length of Stay (Days Lost / LTI)
  far: number | null;       // (Fatalities * 100M) / H

  // --- B. Process Safety (API RP 754) ---
  t1_count: number;
  t2_count: number;
  t1_pser: number | null;   // (T1 * 200k) / H
  t2_pser: number | null;   // (T2 * 200k) / H

  // --- C. Regulatory (SRT Argentina) ---
  incidenceRateSRT: number | null; // (Baja cases * 1000) / Workers
  slg24h: number | null;    // % compliance reporting <= 24h

  // --- D. System Efficacy (ISO 45001) ---
  lcer: number;     // Legal Compliance % (Mocked/Derived)
  iap: number;      // Audit Performance % (Mocked/Derived)
  capa_otc: number; // Actions Closed on Time %

  // Legacy / Operational
  incidenceRatePct: number | null; // Legacy
  ifatRate: number | null;
  envIncidentsMajor: number;
  envIncidentsMinor: number;
  probabilityIndexLabel: string;
  hipoRate: number | null;
  hipoCount: number;

  forecast_trir: number | null;
  forecast_lti_count: number;
  forecast_recordable_count: number;
  
  risk_index_total: number;
  risk_index_rate: number | null;

  cnt_transit_laboral: number;
  cnt_in_itinere: number;
  rate_in_itinere_hh: number | null;

  // Management Arrays
  top5Sites: SiteRanking[];
  daysSinceList: SiteDaysSafe[];
  trendAlerts: TrendAlert[];
  siteEvolutions: SiteEvolution[];
  suggestedActions: SuggestedAction[];
}

export interface ParetoData {
  name: string;
  count: number;
  cumulativePercentage: number;
}

export interface HeatmapData {
  site: string;
  month: number;
  value: number; // Count or Risk
}

// ... Automation Types remain same ...
export interface SharePointConfig {
  isEnabled: boolean;
  tenantId: string;
  siteUrl: string;
  libraryName: string; 
  incidentFileName: string; 
  reportFolderPath: string; 
  lastSyncDate: string | null;
  lastFileHash: string | null;
}

export interface SyncLog {
  id: string;
  date: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  message: string;
  recordsProcessed: number;
}

export interface ScheduledReport {
  id: string;
  name: string;
  frequency: 'WEEKLY' | 'MONTHLY';
  siteFilter: 'ALL' | string;
  templateType: 'KPI_SUMMARY' | 'FULL_EXPORT';
  lastRun: string | null;
  nextRun: string;
  active: boolean;
}

export interface MissingExposureKey {
  site: string;
  period: string;
}

export interface SiteQualityScore {
  site: string;
  score: number;
  hh_completeness: number;
  review_completeness: number;
  transit_completeness: number;
  missing_periods: string[];
  pending_reviews: number;
}

export interface MissingExposureImpact {
  site: string;
  missingPeriods: string[]; // YYYY-MM
  affectedIncidentsCount: number;
  affectedSevereCount: number; // Recordable or LTI
}

// --- PDF EXPORT TYPES ---
export interface PDFExportConfig {
  scope: 'CURRENT_VIEW' | 'FULL_REPORT';
  detailLevel: 'SUMMARY' | 'FULL_APPENDIX';
  sections: {
    kpis: boolean;
    trends: boolean; // Includes pareto and risk trend
    rawTable: boolean;
    normalizedTable: boolean;
    calendar: boolean; // Current view calendar or selected date
    pendingTasks: boolean;
    safetyTalk: boolean; // Only if a date is selected or context allows
    management: boolean; // Top 5, Days Safe
    preventive: boolean; // Evolution, Actions, Trends
  };
  filters: {
    site: string;
    year: string;
    month: string;
    type: string;
  };
  meta: {
    fileName: string;
    generatedBy: string;
  }
}

// --- SERVER SYNC TYPES (NEW) ---
export interface ServerSyncStatus {
  online: boolean;
  path: string;
  source: 'ENV' | 'DEFAULT' | 'UNKNOWN';
  lastModifiedFile: string | null; // ISO Date from OS
  lastModifiedApp: string | null; // ISO Date of last successful ingest
  status: 'OK' | 'NO_FILE' | 'FILE_LOCKED' | 'INVALID_FORMAT' | 'ERROR' | 'SYNCING';
  message: string;
  recordsCount?: number;
}