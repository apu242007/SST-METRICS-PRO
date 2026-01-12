

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
  user: string;
}

export interface SGIDocument {
  code: string;
  title: string;
  type: string;
  area: string;
  objective?: string;
  scope?: string;
  associatedDocs?: string;
  version?: string;
  link?: string;
  tags?: string[];
}

export interface LinkedDocument {
  id: string;
  document_code: string;
  document_title: string;
  association_type: 'NON_COMPLIANCE' | 'REFERENCE' | 'NOT_APPLICABLE' | 'TRAINING_GAP';
  comments?: string;
  added_at: string;
}

export interface Incident {
  incident_id: string;
  name: string;
  description: string;
  site: string;
  type: string;
  location: string;
  potential_risk: string;
  body_part_text: string;
  affected_zones: BodyZone[];
  fecha_evento: string;
  year: number;
  month: number;
  recordable_osha: boolean;
  lti_case: boolean;
  is_transit_laboral: boolean;
  is_in_itinere: boolean;
  is_transit: boolean;
  com_cliente: boolean;
  fatality: boolean;
  days_away: number;
  days_restricted: number;
  job_transfer: boolean;
  is_process_safety_tier_1: boolean;
  is_process_safety_tier_2: boolean;
  severity_points_tier1?: number;
  raw_json: string;
  is_verified: boolean;
  updated_at: string;
  change_log?: ChangeLogEntry[];
  version?: number;
  linked_documents?: LinkedDocument[];
}

export interface ExposureHour {
  id: string;
  site: string;
  period: string;
  worker_type: 'total' | 'own' | 'contractor';
  hours: number;
}

export interface GlobalKmRecord {
  year: number;
  value: number;
  last_updated: string;
}

export interface ExposureKm {
  id: string;
  site: string;
  period: string;
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
  ltif: number;
  dart: number;
  sr: number;
  far: number;
  t1_pser: number;
  t2_pser: number;
  ifat_km: number;
  max_events_trir: number;
  max_events_lti: number;
  incidence_rate_pct: number; 
  env_major: number;
  env_minor: number;
  probability_index_target: string;
  hipo_rate_min: number;
}

export type TargetScenarioType = 'Realista 2025' | 'Metas 2026';

export interface SiteRanking {
  site: string;
  count: number;
  rank: number;
}

export interface SiteDaysSafe {
  site: string;
  days: number;
  lastDate: string;
  status: 'critical' | 'warning' | 'safe';
}

export interface TrendAlert {
  site: string;
  history: { month: number, count: number }[];
  trend: 'increasing';
}

export interface SiteEvolution {
  site: string;
  currentAvg: number;
  prevAvg: number;
  variationPct: number;
  status: 'improving' | 'stable' | 'deteriorating';
}

export interface SuggestedAction {
  site: string;
  reason: 'deterioration' | 'trend_alert';
  title: string;
  actions: string[];
}

export interface DashboardMetrics {
  totalManHours: number;
  totalKM: number; 
  totalIncidents: number;
  totalRecordables: number;
  totalLTI: number;
  totalFatalities: number;
  totalDaysLost: number;
  totalDARTCases: number;
  trir: number | null;
  dart: number | null;
  ltif: number | null;
  sr: number | null;
  alos: number | null;
  far: number | null;
  t1_count: number;
  t2_count: number;
  t1_pser: number | null;
  t2_pser: number | null;
  incidenceRateSRT: number | null;
  slg24h: number | null;
  incidenceRatePct: number | null;
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
  value: number;
}

export interface SharePointConfig {
  isEnabled: boolean;
  tenantId: string;
  clientId: string;
  siteUrl: string;
  libraryName: string; 
  incidentFileName: string; 
  authStatus: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSyncDate: string | null;
  lastFileHash: string | null;
  // Added reportFolderPath to resolve "Object literal may only specify known properties" error in storage.ts
  reportFolderPath?: string;
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
  missingPeriods: string[];
  affectedIncidentsCount: number;
  affectedSevereCount: number;
}

export interface PDFExportConfig {
  scope: 'CURRENT_VIEW' | 'FULL_REPORT';
  detailLevel: 'SUMMARY' | 'FULL_APPENDIX';
  sections: {
    kpis: boolean;
    trends: boolean;
    rawTable: boolean;
    normalizedTable: boolean;
    calendar: boolean;
    pendingTasks: boolean;
    safetyTalk: boolean;
    management: boolean;
    preventive: boolean;
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

export interface ServerSyncStatus {
  online: boolean;
  path: string;
  source: 'ENV' | 'DEFAULT' | 'UNKNOWN';
  lastModifiedFile: string | null;
  lastModifiedApp: string | null;
  status: 'OK' | 'NO_FILE' | 'FILE_LOCKED' | 'INVALID_FORMAT' | 'ERROR' | 'SYNCING';
  message: string;
  recordsCount?: number;
}
