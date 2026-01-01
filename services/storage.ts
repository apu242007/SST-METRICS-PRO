import { Incident, ExposureHour, ExposureKm, AppSettings, MappingRule, ChangeLogEntry, SharePointConfig, SyncLog, ScheduledReport } from "../types";
import { SEED_INCIDENTS, SEED_EXPOSURE_HOURS, SEED_EXPOSURE_KM, SEED_SETTINGS, SEED_RULES } from "../utils/seedData";

const STORAGE_KEY = 'sst_metrics_db_v5_clean';

export interface AppState {
  incidents: Incident[];
  exposure_hours: ExposureHour[];
  exposure_km: ExposureKm[];
  settings: AppSettings;
  rules: MappingRule[];
  load_history: { date: string, filename: string, records_count: number }[];
  
  // Automation State
  sharepoint_config: SharePointConfig;
  sync_logs: SyncLog[];
  scheduled_reports: ScheduledReport[];
}

const DEFAULT_SHAREPOINT_CONFIG: SharePointConfig = {
    isEnabled: false,
    tenantId: '',
    siteUrl: 'https://company.sharepoint.com/sites/SST',
    libraryName: 'Documentos Compartidos',
    incidentFileName: 'basedatosincidentes.xlsx',
    reportFolderPath: 'Reportes_Automaticos',
    lastSyncDate: null,
    lastFileHash: null
};

export const loadState = (): AppState => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    if (serializedState === null) {
      const initialState: AppState = {
        incidents: SEED_INCIDENTS,
        exposure_hours: SEED_EXPOSURE_HOURS,
        exposure_km: SEED_EXPOSURE_KM,
        settings: SEED_SETTINGS,
        rules: SEED_RULES,
        load_history: [],
        sharepoint_config: DEFAULT_SHAREPOINT_CONFIG,
        sync_logs: [],
        scheduled_reports: []
      };
      saveState(initialState);
      return initialState;
    }
    // Merge structure for older versions if needed
    const parsed = JSON.parse(serializedState);
    if (!parsed.sharepoint_config) parsed.sharepoint_config = DEFAULT_SHAREPOINT_CONFIG;
    if (!parsed.sync_logs) parsed.sync_logs = [];
    if (!parsed.scheduled_reports) parsed.scheduled_reports = [];
    
    return parsed;
  } catch (err) {
    console.error("Could not load state", err);
    return {
      incidents: [],
      exposure_hours: [],
      exposure_km: [],
      settings: SEED_SETTINGS,
      rules: SEED_RULES,
      load_history: [],
      sharepoint_config: DEFAULT_SHAREPOINT_CONFIG,
      sync_logs: [],
      scheduled_reports: []
    };
  }
};

export const saveState = (state: AppState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serializedState);
  } catch (err) {
    console.error("Could not save state", err);
  }
};

export const clearState = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}

/**
 * Calculates differences between two objects and returns audit entries.
 */
const getDiff = (oldObj: any, newObj: any, user: string): ChangeLogEntry[] => {
    const changes: ChangeLogEntry[] = [];
    const keysToCheck = [
        'name', 'description', 'type', 'site', 'fecha_evento', 
        'recordable_osha', 'lti_case', 'days_away', 'is_transit', 'location'
    ];

    keysToCheck.forEach(key => {
        if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
            changes.push({
                date: new Date().toISOString(),
                field: key,
                old_value: oldObj[key],
                new_value: newObj[key],
                user
            });
        }
    });
    return changes;
};

/**
 * Smart Upsert with Audit Trail
 */
export const upsertIncidents = (currentIncidents: Incident[], newIncidents: Incident[]): { incidents: Incident[], stats: { added: number, updated: number } } => {
  const incidentMap = new Map(currentIncidents.map(i => [i.incident_id, i]));
  let added = 0;
  let updated = 0;
  
  newIncidents.forEach(newInc => {
    const existing = incidentMap.get(newInc.incident_id);
    
    if (existing) {
      // DETECT CHANGES (Prompt D/F)
      // If the record exists, we compare the "Source" fields from Excel (Silver layer).
      // We do NOT overwrite "Gold" fields (Manual edits) if verified, but we DO log if Excel changed underneath.
      
      const newLogs = getDiff(existing, newInc, 'System (Import)');
      
      if (newLogs.length > 0) {
          updated++;
      }

      // Merge Logic
      const merged: Incident = {
          ...existing,
          // Update source fields always to keep Source of Truth fresh
          name: newInc.name,
          description: newInc.description,
          site: newInc.site,
          type: newInc.type,
          location: newInc.location,
          raw_json: newInc.raw_json,
          
          // Append logs
          change_log: [...(existing.change_log || []), ...newLogs],
          updated_at: new Date().toISOString()
      };

      // If NOT verified, we allow the excel to overwrite calculations too (Auto-refresh)
      if (!existing.is_verified) {
           merged.fecha_evento = newInc.fecha_evento;
           merged.recordable_osha = newInc.recordable_osha;
           merged.lti_case = newInc.lti_case;
           merged.days_away = newInc.days_away;
           merged.is_transit = newInc.is_transit;
      }

      incidentMap.set(newInc.incident_id, merged);

    } else {
      // NEW RECORD
      added++;
      incidentMap.set(newInc.incident_id, {
        ...newInc,
        change_log: [{
            date: new Date().toISOString(),
            field: 'CREATION',
            old_value: null,
            new_value: 'Record Created via Import',
            user: 'System (Import)'
        }],
        updated_at: new Date().toISOString()
      });
    }
  });
  
  return { 
      incidents: Array.from(incidentMap.values()),
      stats: { added, updated }
  };
};

export const updateIncidentManual = (currentIncidents: Incident[], updatedIncident: Incident): Incident[] => {
    return currentIncidents.map(i => {
        if (i.incident_id === updatedIncident.incident_id) {
            const changes = getDiff(i, updatedIncident, 'User (Manual)');
            return {
                ...updatedIncident,
                change_log: [...(i.change_log || []), ...changes],
                updated_at: new Date().toISOString(),
                is_verified: true
            };
        }
        return i;
    });
};