
import * as XLSX from 'xlsx';
import { Incident, ExposureHour, ExposureKm, MappingRule, MissingExposureKey, MissingExposureImpact, BodyZone } from '../types';
import { SITE_HH_DEFAULTS, ANATOMICAL_ZONE_RULES } from '../constants';

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

// Helper: Normaliza strings (elimina tildes, trim, uppercase)
const normalize = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
};

// Helper específico para clasificación que tolera saltos de línea y espacios múltiples
const normalizeForClassification = (str: string) => {
    if (!str) return "";
    return str.normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
              .replace(/[\n\r]+/g, " ")        // Reemplazar saltos de línea por espacio
              .replace(/\s+/g, " ")            // Colapsar espacios múltiples
              .trim()
              .toUpperCase();
};

// --- NORMALIZACIÓN STRICTA PARA MAPEO CORPORAL (NUEVO REQUISITO) ---
const normalizeBodyPart = (text: string) => {
  if (!text) return "";

  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // acentos
    .replace(/\(.*?\)/g, "")          // TODO lo que está entre paréntesis (ej: IZQUIERDA)
    .replace(/[^A-Z\s]/g, "")          // símbolos que no sean letras o espacios
    .replace(/\s+/g, " ")              // espacios múltiples
    .trim();
};

// --- LOGICA DE MAPEO CORPORAL (Actualizada 2025) ---
const detectBodyZones = (rawText: string): BodyZone[] => {
    if (!rawText) return ['unknown'];

    // 1. Detectar Lateralidad desde el texto CRUDO (antes de borrar paréntesis)
    // Buscamos patrones de lado en el texto original
    const rawUpper = rawText.toUpperCase();
    const isLeft = /\bIZQ/.test(rawUpper) || /\bLEFT\b/.test(rawUpper);
    const isRight = /\bDER/.test(rawUpper) || /\bRIGHT\b/.test(rawUpper);
    
    // Si no se especifica lado, o se especifican ambos, asumimos bilateral para zonas pareadas.
    // OJO: Si dice "DEDOS DE LAS MANOS" sin lado, se pintan ambas.
    const isBilateral = (isLeft && isRight) || (!isLeft && !isRight);

    // 2. Normalización Estricta para Matching de Zona
    const cleanText = normalizeBodyPart(rawText);
    const zones = new Set<BodyZone>();

    // 3. Iterar Catálogo
    let matchFound = false;
    
    ANATOMICAL_ZONE_RULES.forEach(rule => {
        // Verificar coincidencias en el texto limpio
        // Usamos RegExp o string includes
        const matches = rule.patterns.some(p => p.test(cleanText));
        
        if (matches) {
            // Verificar exclusiones (ej: PIE excepto DEDOS)
            if (rule.excludes && rule.excludes.some(p => p.test(cleanText))) return;

            matchFound = true;
            
            // Si la regla soporta lados, filtrar
            if (rule.supportsSide) {
                rule.zones.forEach(z => {
                    const zStr = z as string;
                    if (isBilateral) {
                        zones.add(z);
                    } else if (isLeft && zStr.includes('left')) {
                        zones.add(z);
                    } else if (isRight && zStr.includes('right')) {
                        zones.add(z);
                    } else if (!zStr.includes('left') && !zStr.includes('right')) {
                        // Zona central en regla con soporte de lado (raro pero posible)
                        zones.add(z);
                    }
                });
            } else {
                // Agregar todas las zonas base si no soporta lado (ej. Torax)
                rule.zones.forEach(z => zones.add(z));
            }
        }
    });

    if (!matchFound) return ['unknown'];
    return Array.from(zones);
};


// Lógica de Clasificación Automática (Business Logic)
const applyAutoClassification = (type: string, incident: any) => {
    const t = normalizeForClassification(type);
    
    // Default state: Reset flags based on rules to ensure clean slate
    // But preserve what isn't touched by specific rules if needed. 
    // Here we enforce the rules strictly.
    
    // 1. Primeros Auxilios -> OSHA, Guardar
    if (t.includes('PRIMEROS AUXILIOS')) {
        incident.recordable_osha = true; 
        incident.is_verified = true;
        return;
    }

    // 2. Accidente Operativo -> Guardar
    if (t.includes('ACCIDENTE OPERATIVO') || t === 'OPERATIVO') {
        incident.is_verified = true;
        return;
    }

    // 3. Accidente Industrial -> Guardar
    if (t.includes('ACCIDENTE INDUSTRIAL') || t === 'INDUSTRIAL') {
        incident.is_verified = true;
        return;
    }

    // 4. Accidente In Itinere -> In Itinere Flag, Guardar
    if (t.includes('IN ITINERE')) {
        incident.is_in_itinere = true;
        incident.is_transit_laboral = false; // Mutually exclusive usually
        incident.is_verified = true;
        return;
    }

    // 5. Evacuación / Atención Médica -> OSHA, Guardar
    if (t.includes('EVACUACION') || t.includes('ATENCION MEDICA')) {
        incident.recordable_osha = true;
        incident.is_verified = true;
        return;
    }

    // 6. Accidente de Calidad -> Guardar
    if (t.includes('ACCIDENTE DE CALIDAD') || t.includes('CALIDAD')) {
        incident.is_verified = true;
        return;
    }

    // 7. Accidente Vehicular / Tránsito -> IFAT, Guardar
    if (t.includes('VEHICULAR') || t.includes('TRANSITO')) {
        incident.is_transit_laboral = true;
        incident.is_in_itinere = false;
        incident.is_verified = true;
        return;
    }

    // 8. Accidente con Días Perdidos -> OSHA, LTI, Guardar
    if (t.includes('DIAS PERDIDOS') || t.includes('CON BAJA')) {
        incident.recordable_osha = true;
        incident.lti_case = true;
        incident.is_verified = true;
        return;
    }

    // 9. Accidente Ambiental -> Guardar
    if (t.includes('AMBIENTAL') || t.includes('ENVIRONMENTAL')) {
        incident.is_verified = true;
        return;
    }

    // Si no coincide con ninguna regla:
    incident.is_verified = false; // Marcar para revisión manual
};

// Helper: Get Auto HH based on Site Name
export const getAutoHH = (site: string): number => {
    if (!site) return 0;
    const s = site.trim(); // Keep original casing for regex, but trim
    const sNorm = normalize(s);

    // 1. Check Patterns (Regex)
    // We check rules that have isPattern: true
    const patternMatch = SITE_HH_DEFAULTS.find(rule => rule.isPattern && rule.pattern && rule.pattern.test(s));
    if (patternMatch) return patternMatch.hh;

    // 2. Check Exact Matches (Normalized)
    // We compare normalized strings (FABRICA == FÁBRICA)
    const exactMatch = SITE_HH_DEFAULTS.find(rule => !rule.isPattern && normalize(rule.name) === sNorm);
    if (exactMatch) return exactMatch.hh;

    return 0;
};

/**
 * Función Transparente: Genera registros de exposición automática.
 * Evalúa automáticamente el campo Sitio y asigna HH si existe en la lógica.
 * Si no existe, crea el registro en 0 para permitir carga manual.
 */
export const generateAutoExposureRecords = (incidents: Incident[], currentExposure: ExposureHour[]): ExposureHour[] => {
    const exposureMap = new Map<string, ExposureHour>();
    
    // 1. Index current exposure
    currentExposure.forEach(exp => {
        exposureMap.set(`${exp.site}|${exp.period}`, exp);
    });

    // 2. Identify required keys from incidents
    incidents.forEach(inc => {
        const period = inc.fecha_evento.substring(0, 7); // YYYY-MM
        if (!period.match(/^\d{4}-\d{2}$/)) return;
        
        const key = `${inc.site}|${period}`;

        // Check if exists
        const existing = exposureMap.get(key);

        if (existing && existing.hours > 0) {
            // Case A: Exists and has manual data. Do NOT overwrite.
            return;
        }

        // Case B: Does not exist OR exists but is 0 (missing). Try Auto-Assign.
        const autoHH = getAutoHH(inc.site);
        
        if (autoHH > 0) {
            // LOGIC FOUND -> Auto Assign Transparently
            exposureMap.set(key, {
                id: existing ? existing.id : `EXP-H-${inc.site}-${period}-AUTO-${Date.now()}`,
                site: inc.site,
                period: period,
                worker_type: 'total',
                hours: autoHH
            });
        } else if (!existing) {
            // NO LOGIC & NEW -> Create empty record (0)
            // Visually will appear as "Sitio sin HH configuradas"
            exposureMap.set(key, {
                id: `EXP-H-${inc.site}-${period}-PENDING-${Date.now()}`,
                site: inc.site,
                period: period,
                worker_type: 'total',
                hours: 0
            });
        }
    });

    return Array.from(exposureMap.values());
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

  const idTracker = new Set<string>();

  const incidents = rawData.map((row: any, index) => {
    const id = row['ID'] ? String(row['ID']) : `UNKNOWN-${index}-${Date.now()}`;
    const fechaCarga = parseStrictDate(row['Fecha Carga']) || new Date().toISOString().split('T')[0];
    const fechaSiniestro = parseStrictDate(row['Datos ART: FECHA SINIESTRO']);
    const fechaAlta = parseStrictDate(row['Datos ART: FECHA ALTA MEDICA DEFINITIVA']);
    const fechaEvento = fechaSiniestro || fechaCarga;
    
    const type = row['Tipo de Incidente'] ? row['Tipo de Incidente'].trim() : 'Unspecified';
    const bodyPartText = row['Datos ART: UBICACIÓN DE LA LESIÓN'] || '';

    // Normalize Site (Trim & Uppercase to prevent duplicates)
    const siteRaw = row['Sitio'] ? String(row['Sitio']).trim().toUpperCase() : 'SITIO DESCONOCIDO';

    // Default base calc
    let daysAway = 0;
    if (fechaSiniestro && fechaAlta) {
        const start = new Date(fechaSiniestro).getTime();
        const end = new Date(fechaAlta).getTime();
        if (end > start) daysAway = Math.ceil((end - start) / (1000 * 3600 * 24));
    }

    const parts = [
      row['Breve descripcion del Incidente'],
      row['Breve Descripción de la mecánica'] ? `Mecánica: ${row['Breve Descripción de la mecánica']}` : null,
      row['Nombre y Apellido Involucrado'] ? `Involucrado: ${row['Nombre y Apellido Involucrado']}` : null
    ];

    // Initial Object
    const incidentObj: Incident = {
      incident_id: id,
      name: row['Nombre'] || 'Sin Nombre',
      description: parts.filter(Boolean).join('. ').trim() || 'Sin descripción',
      site: siteRaw,
      fecha_evento: fechaEvento,
      year: parseInt(row['Año']) || new Date(fechaEvento).getFullYear(),
      month: parseInt(row['Mes']) || new Date(fechaEvento).getMonth() + 1,
      type: type,
      location: row['Ubicación'] || 'General',
      potential_risk: row['Potencialidad del Incidente'] || 'N/A',
      
      // BODY MAP AUTOMATION (UPDATED)
      body_part_text: bodyPartText,
      affected_zones: detectBodyZones(bodyPartText),

      // Flags (Will be overwritten by applyAutoClassification)
      recordable_osha: false,
      lti_case: false,
      is_transit_laboral: false,
      is_in_itinere: false,
      is_transit: false, 

      fatality: type.toLowerCase().includes('fatal'),
      job_transfer: false,
      days_away: daysAway,
      days_restricted: 0,
      
      // AUTOMATIC CONFIRMATION LOGIC
      is_verified: false, // Default to false, applyAutoClassification will set to true if rule matches
      
      raw_json: JSON.stringify(row),
      updated_at: new Date().toISOString()
    };

    // Apply Specific Business Rules for Auto-Classification
    applyAutoClassification(type, incidentObj);

    // Sync legacy transit flag
    incidentObj.is_transit = incidentObj.is_transit_laboral || incidentObj.is_in_itinere;

    return incidentObj;
  });

  return { incidents, rules: existingRules, report: { errors, warnings } };
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
