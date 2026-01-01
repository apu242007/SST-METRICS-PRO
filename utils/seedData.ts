
import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule } from "../types";

export const SEED_SETTINGS: AppSettings = {
  base_if: 1000000,
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

export const SEED_INCIDENTS: Incident[] = [];

// Normalized Exposure Data
export const SEED_EXPOSURE_HOURS: ExposureHour[] = [];

export const SEED_EXPOSURE_KM: ExposureKm[] = [];
