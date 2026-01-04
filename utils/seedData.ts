
import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule, SGIDocument } from "../types";

export const SEED_SETTINGS: AppSettings = {
  base_if: 1000,
  base_trir: 200000,
  days_cap: 180
};

export const SEED_RULES: MappingRule[] = [
  { tipo_incidente: 'First Aid', default_recordable: false, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Medical Treatment', default_recordable: true, default_lti: false, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Lost Time', default_recordable: true, default_lti: true, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Fatality', default_recordable: true, default_lti: true, default_is_transit_laboral: false, default_is_in_itinere: false },
  { tipo_incidente: 'Transit', default_recordable: false, default_lti: false, default_is_transit_laboral: true, default_is_in_itinere: false },
];

// --- MASTER SGI DOCUMENTS SEED (Abbreviated for brevity but structurally complete) ---
export const SEED_DOCUMENTS: SGIDocument[] = [
  { code: "PO-SGI-002", title: "INVESTIGACIÓN DE INCIDENTES", type: "PO", area: "SGI", objective: "Metodología para investigación de incidentes.", version: "06" },
  { code: "PO-SGI-005", title: "OPERACIÓN CON PRESENCIA DE GAS SULFHIDRICO (H2S)", type: "PO", area: "SGI", objective: "Medidas de seguridad con H2S.", version: "01" },
  // ... (Full list maintained in real app, kept short here for demo sync)
];

// Mock Incidents: Empty for Production Start
export const SEED_INCIDENTS: Incident[] = [];

// Normalized Exposure Data: Empty for Production Start
export const SEED_EXPOSURE_HOURS: ExposureHour[] = [];

export const SEED_EXPOSURE_KM: ExposureKm[] = [];
