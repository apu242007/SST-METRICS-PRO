
import * as XLSX from 'xlsx';
import { Incident, ExposureHour, ExposureKm, MappingRule, MissingExposureKey, MissingExposureImpact } from '../types';

// Data Contract (Prompt D)
const DATA_CONTRACT = {
  required_columns: [
    "ID", "Nombre", "Sitio", "Fecha Carga", "Tipo de Incidente", 
    "Año", "Mes", "Ubicación", "Potencialidad del Incidente"
  ],
  column_types: {
    "Año": "number",
    "Mes": "number",
    "ID": "string"
  }
};

// Helper: Heuristic to generate a Rule based on the text of the Incident Type
const generateRuleForType = (type: string): MappingRule => {
  const t = (type || '').toLowerCase();
  
  // Strict matching based on user prompt
  const isTransitLaboral = t.includes('vehicular') || t.includes('tránsito') || t === 'accidente vehicular/tránsito';
  const isInItinere = t.includes('itinere') || t === 'accidente in itinere';
  
  const isLti = t.includes('lost time') || t.includes('con baja') || t.includes('días perdidos') || t.includes('lti');
  const isMedical = t.includes('médico') || t.includes('medical') || t.includes('tratamiento') || t.includes('hospital');
  const isFatal = t.includes('fatal') || t.includes('fatalidad') || t.includes('muerte');
  
  const isRecordable = isLti || isMedical || isFatal;

  return {
    tipo_incidente: type,
    default_recordable: isRecordable,
    default_lti: isLti,
    default_is_transit_laboral: isTransitLaboral,
    default_is_in_itinere: isInItinere
  };
};

export const parseStrictDate = (val: any): string | null => {
  if (!val) return null;
  try {
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : null;
    }
    if (typeof val === 'string') {
      if (val.match(/^\d{4}-\d{2}-\d{2}$/)) return val;
      const parts = val.trim().split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        const d = new Date(`${year}-${month}-${day}`);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      }
    }
  } catch (e) { return null; }
  return null;
};

export const parseIncidentsExcel = (fileData: ArrayBuffer, existingRules: MappingRule[]): { incidents: Incident[], rules: MappingRule[], report: { errors: string[], warnings: string[] } } => {
  // FIX: Use type: 'array' for ArrayBuffer inputs to prevent parsing errors
  const wb = XLSX.read(fileData, { type: 'array' });
  
  let wsName = wb.SheetNames.find(n => n.toLowerCase().trim() === 'query (3)') 
               || wb.SheetNames.find(n => n.toLowerCase().includes('query')) 
               || wb.SheetNames[0];     
  const ws = wb.Sheets[wsName];
  const rawData = XLSX.utils.sheet_to_json(ws);

  const errors: string[] = [];
  const warnings: string[] = [];

  if (rawData.length === 0) {
    throw new Error("El archivo Excel está vacío o no se pudo leer la hoja correctamente.");
  }

  // 1. Data Contract Validation
  const firstRow = rawData[0] as any;
  const fileColumns = Object.keys(firstRow);
  const missingColumns = DATA_CONTRACT.required_columns.filter(col => !fileColumns.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`VIOLACIÓN DE CONTRATO: Faltan columnas requeridas: ${missingColumns.join(', ')}.`);
  }

  // 2. Processing
  const uniqueTypes = new Set<string>();
  const idTracker = new Set<string>();

  rawData.forEach((row: any, idx) => {
    // Type Check Warning
    if (row['Año'] && typeof row['Año'] !== 'number') warnings.push(`Fila ${idx+2}: 'Año' debería ser numérico.`);
    
    // Duplicate ID Check
    const id = row['ID'] ? String(row['ID']) : null;
    if (id && idTracker.has(id)) {
        warnings.push(`Fila ${idx+2}: ID duplicado detectado '${id}'. Se usará la última aparición.`);
    }
    if(id) idTracker.add(id);

    if (row['Tipo de Incidente']) uniqueTypes.add(row['Tipo de Incidente'].trim());
  });

  // Rule Generation
  const newRules: MappingRule[] = [];
  const existingRulesMap = new Map(existingRules.map(r => [r.tipo_incidente.toLowerCase(), r]));
  uniqueTypes.forEach(type => {
    if (!existingRulesMap.has(type.toLowerCase())) {
      newRules.push(generateRuleForType(type));
    }
  });
  const allRules = [...existingRules, ...newRules];

  const incidents = rawData.map((row: any, index) => {
    const id = row['ID'] ? String(row['ID']) : `UNKNOWN-${index}-${Date.now()}`;
    const fechaCarga = parseStrictDate(row['Fecha Carga']) || new Date().toISOString().split('T')[0];
    const fechaSiniestro = parseStrictDate(row['Datos ART: FECHA SINIESTRO']);
    const fechaAlta = parseStrictDate(row['Datos ART: FECHA ALTA MEDICA DEFINITIVA']);
    const fechaEvento = fechaSiniestro || fechaCarga;
    
    const type = row['Tipo de Incidente'] ? row['Tipo de Incidente'].trim() : 'Unspecified';
    const rule = allRules.find(r => r.tipo_incidente.toLowerCase() === type.toLowerCase());

    let isRecordable = rule ? rule.default_recordable : false;
    let isLti = rule ? rule.default_lti : false;
    let isTransitLaboral = rule ? rule.default_is_transit_laboral : false;
    let isInItinere = rule ? rule.default_is_in_itinere : false;
    
    let daysAway = 0;
    if (fechaSiniestro && fechaAlta) {
        const start = new Date(fechaSiniestro).getTime();
        const end = new Date(fechaAlta).getTime();
        if (end > start) daysAway = Math.ceil((end - start) / (1000 * 3600 * 24));
    }
    if (daysAway > 0 && !isTransitLaboral && !isInItinere) isLti = true;
    const isFatal = type.toLowerCase().includes('fatal');
    if (isLti || isFatal) isRecordable = true;

    const parts = [
      row['Breve descripcion del Incidente'],
      row['Breve Descripción de la mecánica'] ? `Mecánica: ${row['Breve Descripción de la mecánica']}` : null,
      row['Nombre y Apellido Involucrado'] ? `Involucrado: ${row['Nombre y Apellido Involucrado']}` : null
    ];

    return {
      incident_id: id,
      name: row['Nombre'] || 'Sin Nombre',
      description: parts.filter(Boolean).join('. ').trim() || 'Sin descripción',
      site: row['Sitio'] || 'Sitio Desconocido',
      fecha_evento: fechaEvento,
      year: parseInt(row['Año']) || new Date(fechaEvento).getFullYear(),
      month: parseInt(row['Mes']) || new Date(fechaEvento).getMonth() + 1,
      type: type,
      location: row['Ubicación'] || 'General',
      potential_risk: row['Potencialidad del Incidente'] || 'N/A',
      
      recordable_osha: isRecordable,
      lti_case: isLti,
      is_transit_laboral: isTransitLaboral,
      is_in_itinere: isInItinere,
      is_transit: isTransitLaboral || isInItinere, // Legacy compatibility

      fatality: isFatal,
      job_transfer: false,
      days_away: daysAway,
      days_restricted: 0,
      is_verified: false,
      raw_json: JSON.stringify(row),
      updated_at: new Date().toISOString()
    };
  });

  return { incidents, rules: allRules, report: { errors, warnings } };
};

export const getMissingExposureKeys = (incidents: Incident[], exposure: ExposureHour[]): MissingExposureKey[] => {
  const requiredKeys = new Set<string>();
  incidents.forEach(inc => {
    const period = inc.fecha_evento.substring(0, 7);
    if(period.match(/^\d{4}-\d{2}$/)) requiredKeys.add(`${inc.site}|${period}`);
  });
  const existingKeys = new Set(exposure.filter(e => e.hours > 0).map(e => `${e.site}|${e.period}`));
  const missing: MissingExposureKey[] = [];
  requiredKeys.forEach(key => {
    if (!existingKeys.has(key)) {
      const [site, period] = key.split('|');
      missing.push({ site, period });
    }
  });
  return missing.sort((a, b) => b.period.localeCompare(a.period));
};

export const groupMissingKeysBySite = (keys: MissingExposureKey[]): Record<string, string[]> => {
    const grouped: Record<string, string[]> = {};
    keys.forEach(k => {
        if (!grouped[k.site]) grouped[k.site] = [];
        grouped[k.site].push(k.period);
    });
    // Sort periods
    Object.keys(grouped).forEach(site => {
        grouped[site].sort().reverse();
    });
    return grouped;
};

// Priority Sort Logic
export const getMissingExposureImpact = (incidents: Incident[], exposureHours: ExposureHour[]): MissingExposureImpact[] => {
    const missingKeys = getMissingExposureKeys(incidents, exposureHours); // Returns {site, period}[]
    const grouped: Record<string, string[]> = {};
    missingKeys.forEach(k => {
        if (!grouped[k.site]) grouped[k.site] = [];
        grouped[k.site].push(k.period);
    });

    const result: MissingExposureImpact[] = Object.entries(grouped).map(([site, periods]) => {
        // Find affected incidents
        const siteIncidents = incidents.filter(i => i.site === site);
        let affectedCount = 0;
        let severeCount = 0;

        siteIncidents.forEach(inc => {
             const period = inc.fecha_evento.substring(0, 7);
             if (periods.includes(period)) {
                 affectedCount++;
                 if (inc.recordable_osha || inc.lti_case || inc.fatality) {
                     severeCount++;
                 }
             }
        });

        return {
            site,
            missingPeriods: periods.sort().reverse(),
            affectedIncidentsCount: affectedCount,
            affectedSevereCount: severeCount
        };
    });

    // Sort Rules:
    // 1. Missing Months Count (desc)
    // 2. Affected Incidents Count (desc)
    // 3. Affected Severe Count (desc)
    // 4. Site Name (asc)
    return result.sort((a, b) => {
        if (b.missingPeriods.length !== a.missingPeriods.length) {
            return b.missingPeriods.length - a.missingPeriods.length;
        }
        if (b.affectedIncidentsCount !== a.affectedIncidentsCount) {
            return b.affectedIncidentsCount - a.affectedIncidentsCount;
        }
        if (b.affectedSevereCount !== a.affectedSevereCount) {
            return b.affectedSevereCount - a.affectedSevereCount;
        }
        return a.site.localeCompare(b.site);
    });
};

export const getMissingKmKeys = (incidents: Incident[], exposureKm: ExposureKm[]): MissingExposureKey[] => {
  const requiredKeys = new Set<string>();
  // IMPORTANT: Only ask for KM if incidents are flagged as WORK TRANSIT (IFAT).
  // Exclude In Itinere from this requirement.
  incidents.filter(i => i.is_transit_laboral).forEach(inc => {
    const period = inc.fecha_evento.substring(0, 7);
    if(period.match(/^\d{4}-\d{2}$/)) requiredKeys.add(`${inc.site}|${period}`);
  });
  const existingKeys = new Set(exposureKm.filter(e => e.km > 0).map(e => `${e.site}|${e.period}`));
  const missing: MissingExposureKey[] = [];
  requiredKeys.forEach(key => {
    if (!existingKeys.has(key)) {
      const [site, period] = key.split('|');
      missing.push({ site, period });
    }
  });
  return missing.sort((a, b) => b.period.localeCompare(a.period));
};

export const hasTransitIncidents = (incidents: Incident[], site: string, period: string): boolean => {
  return incidents.some(i => {
    const iPeriod = i.fecha_evento.substring(0, 7);
    return i.site === site && iPeriod === period && i.is_transit_laboral;
  });
};
