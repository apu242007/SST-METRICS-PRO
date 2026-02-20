import * as XLSX from 'xlsx';
import { Incident, ExposureHour, ExposureKm, MappingRule, MissingExposureKey, MissingExposureImpact, BodyZone } from '../types';
import { SITE_HH_DEFAULTS, ANATOMICAL_ZONE_RULES } from '../constants';

// Data Contract (Prompt D)
const DATA_CONTRACT = {
  required_columns: [
    "ID", "Nombre", "Sitio", "Fecha Carga", "Tipo de Incidente", 
    "Ubicación", "Potencialidad del Incidente"
  ],
  // Year/Month are flexible now (can be derived)
  column_types: {
    "ID": "string"
  }
};

// Helper: Normaliza strings (elimina tildes, trim, uppercase)
export const normalize = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
};

// --- NEW HELPER: SANITIZE YEAR ---
// Handles "2.026" (thousands separator), "26" (2-digit), "2026.0" (float string)
export const sanitizeYear = (val: any): number | null => {
    if (val === undefined || val === null) return null;
    
    // Convert to string and clean common separators
    const str = String(val).replace(/[\.,]/g, '').trim();
    
    // Parse
    let num = parseInt(str);
    
    if (isNaN(num)) return null;

    // Handle 2-digit years (e.g., 26 -> 2026)
    if (num >= 0 && num < 100) return num + 2000;
    
    // Valid range check (1990 - 2100)
    if (num >= 1990 && num <= 2100) return num;

    return null;
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

// Helper para parsear booleano flexible
const parseBoolean = (val: any): boolean => {
    if (val === undefined || val === null) return false;
    const s = String(val).trim().toLowerCase();
    return ['si', 'sí', 'yes', 's', 'y', '1', 'true', 'ok'].includes(s);
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
        incident.recordable_osha = false; // Usually FA is NOT recordable
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
    // Atención Médica (MT) is Recordable
    if (t.includes('EVACUACION') || t.includes('ATENCION MEDICA') || t.includes('MEDICAL TREATMENT')) {
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
    if (t.includes('DIAS PERDIDOS') || t.includes('CON BAJA') || t.includes('LOST TIME')) {
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

    // 10. DART Cases (Restricted / Transfer) -> OSHA, DART (Job Transfer), Guardar
    if (t.includes('RESTRING') || t.includes('TRANSFER') || t.includes('TAREA LIVIANA') || t.includes('REUBICACION')) {
        incident.recordable_osha = true;
        incident.job_transfer = true;
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
      // ISO Format or starting with ISO
      if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10);
      
      const parts = val.trim().split(/[\/\-]/); // Support / and -
      if (parts.length >= 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        
        // Handle year with potential time (e.g. "2026 10:00") or separators
        let yearPart = parts[2].split(/[\sT]/)[0]; // Split by space or T
        
        // Clean separators like dots (2.026 -> 2026) using sanitized logic
        const sanitizedY = sanitizeYear(yearPart);
        
        if (sanitizedY) {
            const d = new Date(`${sanitizedY}-${month}-${day}`);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
      }
    }
  } catch (e) { return null; }
  return null;
};

const findColumn = (row: any, possibilities: string[]): string | undefined => {
    const keys = Object.keys(row);
    for (const p of possibilities) {
        const match = keys.find(k => normalize(k) === normalize(p));
        if (match) return match;
    }
    return undefined;
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
  // We use flexible matching for headers now
  const firstRow = rawData[0] as any;
  const missingColumns = DATA_CONTRACT.required_columns.filter(col => !findColumn(firstRow, [col]));

  if (missingColumns.length > 0) {
    // Try relaxed check
    console.warn(`Columnas faltantes estrictas: ${missingColumns.join(', ')}. Intentando mapeo flexible.`);
  }

  const incidents = rawData.map((row: any, index) => {
    const idKey = findColumn(row, ["ID", "Id", "id"]) || "ID";
    const id = row[idKey] ? String(row[idKey]) : `UNKNOWN-${index}-${Date.now()}`;
    
    const fechaCargaKey = findColumn(row, ["Fecha Carga", "Fecha de Carga"]) || "Fecha Carga";
    const fechaCarga = parseStrictDate(row[fechaCargaKey]) || new Date().toISOString().split('T')[0];
    
    const fechaSiniestro = parseStrictDate(row['Datos ART: FECHA SINIESTRO'] || row['Fecha Siniestro']);
    const fechaAlta = parseStrictDate(row['Datos ART: FECHA ALTA MEDICA DEFINITIVA']);
    const fechaAltaEst = parseStrictDate(row['Datos ART: FECHA ESTIMADA DE ALTA MEDICA']);
    
    // PRIORIDAD: Fecha Siniestro > Fecha Carga
    const fechaEvento = fechaSiniestro || fechaCarga;
    
    const typeKey = findColumn(row, ["Tipo de Incidente", "Tipo Incidente", "Tipo"]) || "Tipo de Incidente";
    const type = row[typeKey] ? row[typeKey].trim() : 'Unspecified';
    
    const bodyPartText = row['Datos ART: UBICACIÓN DE LA LESIÓN'] || '';

    // Normalize Site (Trim & Uppercase to prevent duplicates)
    const siteKey = findColumn(row, ["Sitio", "Base", "Lugar"]) || "Sitio";
    const siteRaw = row[siteKey] ? String(row[siteKey]).trim().toUpperCase() : 'SITIO DESCONOCIDO';

    // Parse Year safely
    const yearKey = findColumn(row, ["Año", "Anio", "Year", "YEAR"]) || "Año";
    let yearVal = row[yearKey];
    
    // Use new sanitizer
    let year = sanitizeYear(yearVal);

    if (!year) {
        // Fallback to Event Date Year
        year = new Date(fechaEvento).getFullYear();
    }

    const monthKey = findColumn(row, ["Mes", "Month"]) || "Mes";
    let month = parseInt(row[monthKey]);
    if (isNaN(month) || month < 1 || month > 12) {
        month = new Date(fechaEvento).getMonth() + 1;
    }

    // --- SR LOGIC: Lost Days Calculation ---
    // Rule: max(0, daysBetween(siniestro, altaDef ?? altaEst) - 1)
    let daysAway = 0;
    if (fechaSiniestro) {
        const fin = fechaAlta || fechaAltaEst;
        if (fin) {
            const start = new Date(fechaSiniestro).getTime();
            const end = new Date(fin).getTime();
            if (end > start) {
                const diffDays = Math.ceil((end - start) / (1000 * 3600 * 24));
                daysAway = Math.max(0, diffDays - 1); // Subtract 1 day to allow for "day of incident" logic
            }
        }
    }

    // --- FAR LOGIC: Fatality Detection ---
    const gravedad = normalize(row['Datos ART: GRAVEDAD'] || '');
    const potKey = findColumn(row, ["Potencialidad del Incidente", "Potencialidad", "Riesgo"]) || "Potencialidad del Incidente";
    const potencial = normalize(row[potKey] || '');
    const isFatal = type.toLowerCase().includes('fatal') || gravedad.includes('FATAL') || gravedad.includes('FALLEC') || potencial.includes('FATAL');

    const parts = [
      row['Breve descripcion del Incidente'] || row['Descripción'],
      row['Breve Descripción de la mecánica'] ? `Mecánica: ${row['Breve Descripción de la mecánica']}` : null,
      row['Nombre y Apellido Involucrado'] ? `Involucrado: ${row['Nombre y Apellido Involucrado']}` : null
    ];

    // --- PARSE CLIENT COMMUNICATION ---
    // ADDED: Explicit checks for 'Com.Cliente' (with dot) and 'Com Cliente' to handle Excel variations robustly
    const comKey = findColumn(row, ["Comunicación Cliente", "Comunicacion Cliente", "Com. Cliente", "Com.Cliente", "Com Cliente", "Reportado al Cliente"]) || "Comunicación Cliente";
    const comCliente = parseBoolean(row[comKey]);

    // --- PARSE CLIENTE (OPERATOR / CLIENT NAME) ---
    const clienteKey = findColumn(row, ["Cliente", "Operadora", "Operator", "Client", "Empresa Cliente"]) || "Cliente";
    const clienteRaw = row[clienteKey];
    const cliente = clienteRaw && String(clienteRaw).trim() !== '' && String(clienteRaw).trim().toLowerCase() !== 'total'
      ? String(clienteRaw).trim()
      : undefined;

    // Initial Object
    const incidentObj: Incident = {
      incident_id: id,
      name: row['Nombre'] || 'Sin Nombre',
      description: parts.filter(Boolean).join('. ').trim() || 'Sin descripción',
      site: siteRaw,
      fecha_evento: fechaEvento,
      year: year!,
      month: month,
      type: type,
      location: row['Ubicación'] || row['Ubicacion'] || 'General',
      potential_risk: row[potKey] || 'N/A',
      
      // BODY MAP AUTOMATION
      body_part_text: bodyPartText,
      affected_zones: detectBodyZones(bodyPartText),

      // Flags (Will be overwritten by applyAutoClassification)
      recordable_osha: false,
      lti_case: false,
      is_transit_laboral: false,
      is_in_itinere: false,
      is_transit: false, 
      
      // New Field
      com_cliente: comCliente,
      cliente: cliente,

      fatality: isFatal,
      job_transfer: false,
      days_away: daysAway,
      days_restricted: 0,
      
      // Missing process safety properties default initialization
      is_process_safety_tier_1: false,
      is_process_safety_tier_2: false,

      // AUTOMATIC CONFIRMATION LOGIC
      is_verified: false, 
      
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