
export enum IncidentType {
  FirstAid = 'First Aid',
  MedicalTreatment = 'Medical Treatment',
  LostTime = 'Lost Time Injury',
  Fatality = 'Fatality',
  PropertyDamage = 'Property Damage',
  NearMiss = 'Near Miss',
  Environmental = 'Environmental',
  Unspecified = 'Unspecified'
}

export interface ChangeLogEntry {
  date: string;
  field: string;
  old_value: any;
  new_value: any;
  user: string; // 'System (Import)' | 'User (Manual)'
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
  
  fatality: boolean;
  
  days_away: number;
  days_restricted: number;
  job_transfer: boolean;
  
  // Data Integrity & Meta
  raw_json: string; // JSON string of original excel row
  is_verified: boolean;
  updated_at: string;
  
  // Audit
  change_log?: ChangeLogEntry[];
  version?: number;
}

export interface ExposureHour {
  id: string;
  site: string;
  period: string; // YYYY-MM
  worker_type: 'total' | 'own' | 'contractor';
  hours: number;
}

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
  trir: number;
  ltir: number;
  if: number;
  ig: number;
  ifat_km: number;
  max_events_trir: number;
  max_events_lti: number;
}

export type TargetScenarioType = 'Realista' | 'Desafiante' | 'Excelencia';

export interface DashboardMetrics {
  // Basic Counts
  totalIncidents: number;
  totalRecordables: number;
  totalLTI: number;
  totalDaysLost: number;
  totalManHours: number;
  totalKM: number;
  
  // Rates (Actual YTD)
  trir: number | null;
  ltir: number | null;
  dart: number | null;
  severityRate: number | null; // IG
  frequencyRate: number | null; // IF
  
  // Forecasts (Projections)
  forecast_trir: number | null;
  forecast_lti_count: number;
  forecast_recordable_count: number;
  remaining_trir_events: number; // Based on Target
  remaining_lti_events: number;  // Based on Target
  
  // Risk Index
  risk_index_total: number;
  risk_index_rate: number | null; // Risk per 1M HH

  // Transit Specific (Separated)
  cnt_transit_laboral: number;
  ifat: number | null; // Tasa Accidentabilidad Vial (Laboral) only
  cnt_in_itinere: number;
  rate_in_itinere_hh: number | null; // Optional: Itinere rate by HH
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
