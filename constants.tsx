
import { MappingRule, AppSettings, KPITargets, TargetScenarioType } from "./types";

export const DEFAULT_KPI_SETTINGS: AppSettings = {
  base_if: 1000000, // ISO / LatAm Standard
  base_trir: 200000, // OSHA Standard
  days_cap: 180,
};

// Based on 2,075,094 HH and 2,735,184 KM
export const TARGET_SCENARIOS: Record<TargetScenarioType, KPITargets> = {
  'Realista': {
      trir: 3.00,        // Max ~31 Recordables
      ltir: 1.50,        // Max ~15 LTIs
      if: 7.50,          // Base 1M equivalent to LTIR 1.5
      ig: 200,           // Max ~415 Days Lost
      ifat_km: 1.00,     // Allow some margin
      max_events_trir: 31,
      max_events_lti: 15
  },
  'Desafiante': {
      trir: 1.80,        // Max ~18 Recordables
      ltir: 0.80,        // Max ~8 LTIs
      if: 4.00,
      ig: 100,           // Max ~207 Days Lost
      ifat_km: 0.50,
      max_events_trir: 18,
      max_events_lti: 8
  },
  'Excelencia': {
      trir: 0.50,        // Max ~5 Recordables
      ltir: 0.20,        // Max ~2 LTIs
      if: 1.00,
      ig: 50,
      ifat_km: 0.00,
      max_events_trir: 5,
      max_events_lti: 2
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
];

export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
