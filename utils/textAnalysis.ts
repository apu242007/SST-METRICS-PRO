
import { Incident, SGIDocument } from "../types";
import { SEED_DOCUMENTS } from "./seedData";

// --- DICCIONARIOS SEMÁNTICOS ---

type RiskCategory = 'TRANSITO' | 'CAIDAS' | 'MANOS' | 'ERGO' | 'GOLPES' | 'AMBIENTAL' | 'IZAJE' | 'ELECTRICO' | 'GENERAL' | 'POZO' | 'PRESION' | 'MONTAJE';

interface RiskProfile {
    keywords: RegExp[];
    verbs: string[];
    controls: string[];
    conditions: string[];
    relatedDocs: string[]; // Codes of relevant documents from the matrix
}

const RISK_DICTIONARY: Record<RiskCategory, RiskProfile> = {
    TRANSITO: {
        keywords: [/vehic/i, /cama/i, /choque/i, /colisi/i, /volca/i, /conduc/i, /manejo/i, /retroceso/i, /ruta/i, /camino/i, /camioneta/i, /equipo pesado/i, /ifat/i],
        verbs: ["colisionó", "impactó", "perdió control", "maniobró", "excedió velocidad", "no visualizó"],
        controls: ["Manejo Defensivo", "Checklist Pre-uso", "Respeto de Distancias", "Uso de Cinturón", "Procedimiento de Retroceso"],
        conditions: ["caminos en mal estado", "polvo en suspensión", "tráfico cruzado", "puntos ciegos", "fatiga del conductor"],
        relatedDocs: ["PO-SGI-007", "IT-WPL-022", "PO-WSG-024", "IT-WSG-005"]
    },
    CAIDAS: {
        keywords: [/caida/i, /nivel/i, /piso/i, /suelo/i, /escalera/i, /resbal/i, /tropiez/i, /andamio/i, /altura/i, /plataforma/i, /enganche/i, /torre/i],
        verbs: ["resbaló", "tropezó", "perdió equilibrio", "cayó", "saltó", "no aseguró"],
        controls: ["Tres Puntos de Apoyo", "Orden y Limpieza", "Uso de Arnés", "Anclaje Seguro", "Inspección de Superficies"],
        conditions: ["superficies irregulares", "presencia de líquidos/aceite", "desorden en el área", "iluminación deficiente", "escalones dañados"],
        relatedDocs: ["PO-SGI-015", "IT-SGI-005", "IT-SGI-015", "PO-WSG-014", "PO-WSG-020", "PO-WSG-023"]
    },
    MANOS: {
        keywords: [/mano/i, /dedo/i, /corte/i, /atrapam/i, /guante/i, /herramienta/i, /apriet/i, /pellizc/i, /filo/i, /martill/i, /maza/i, /llave/i],
        verbs: ["apretó", "cortó", "golpeó", "sujetó incorrectamente", "expuso la mano", "no utilizó herramienta"],
        controls: ["Uso de Guantes adecuados", "Herramientas de Mano", "Identificación de Puntos de Atrapamiento", "No Exposición de Manos"],
        conditions: ["herramientas defectuosas", "espacios reducidos", "bordes filosos", "movimientos repetitivos", "falta de guarda"],
        relatedDocs: ["PO-SGI-012", "IT-SGI-016", "IT-SGI-001", "IT-WSG-001", "IT-WSG-002", "IT-WSG-006"]
    },
    ERGO: {
        keywords: [/esfuerzo/i, /postura/i, /lumbar/i, /peso/i, /levantam/i, /dolor/i, /muscular/i, /cintura/i, /sobrecarga/i, /carga/i],
        verbs: ["levantó", "giró", "forzó", "mantuvo postura", "cargó excesivamente"],
        controls: ["Técnica de Levantamiento", "Pausas Activas", "Ayuda Mecánica", "Trabajo en Equipo"],
        conditions: ["carga excesiva", "postura forzada", "espacio confinado", "movimiento brusco"],
        relatedDocs: ["PO-SGI-024", "IT-SGI-008", "IT-SGI-014"]
    },
    GOLPES: {
        keywords: [/golpe/i, /impacto/i, /cabeza/i, /casco/i, /proyeccion/i, /particula/i, /ojo/i, /cara/i, /objeto/i],
        verbs: ["golpeó", "proyectó", "impactó contra", "no aseguró", "soltó"],
        controls: ["Uso de EPP (Casco/Lentes)", "Aseguramiento de Carga", "Distancia de Línea de Fuego", "Bloqueo de Energía"],
        conditions: ["objetos sueltos", "material proyectado", "estructuras bajas", "presión contenida"],
        relatedDocs: ["PO-SGI-012", "PO-SGI-025", "PO-WSG-020", "IT-SGI-016"]
    },
    AMBIENTAL: {
        keywords: [/derrame/i, /fuga/i, /suelo/i, /aceite/i, /quimico/i, /residuo/i, /ambiental/i, /viento/i, /fauna/i, /fluido/i],
        verbs: ["derramó", "fugó", "contaminó", "dispersó", "no contuvo"],
        controls: ["Kit Antiderrames", "Gestión de Residuos", "Inspección de Mangueras", "Bandejas de Contención"],
        conditions: ["rotura de línea", "falla de válvula", "viento fuerte", "recipiente inadecuado"],
        relatedDocs: ["PO-SGI-003", "PG-TAC-008", "PO-SGI-021", "IT-SGI-007", "PO-SGI-009"]
    },
    IZAJE: {
        keywords: [/izaje/i, /grua/i, /carga/i, /eslinga/i, /faja/i, /gancho/i, /suspendida/i, /maniobra/i, /hidrogrua/i, /pluma/i],
        verbs: ["izó", "estrobó", "movió carga", "falló guinche", "cortó eslinga"],
        controls: ["Plan de Izaje", "Inspección de Elementos", "Radio de Exclusión", "Vientos/Sogas Guía"],
        conditions: ["carga inestable", "viento excesivo", "falla de equipo", "personal bajo carga"],
        relatedDocs: ["PO-WSG-017", "PO-WSG-022", "IT-WSG-003", "IT-WSG-007", "IT-WSG-020", "IT-WPL-009", "IT-WPL-019"]
    },
    ELECTRICO: {
        keywords: [/electric/i, /cable/i, /tension/i, /volt/i, /tablero/i, /enchufe/i, /arco/i, /descarga/i, /pat/i, /tierra/i],
        verbs: ["manipuló", "conectó", "cortó cable", "recibió descarga", "no bloqueó"],
        controls: ["Bloqueo y Etiquetado (LOTO)", "Herramientas Aisladas", "Permiso Eléctrico", "Verificación de Tensión"],
        conditions: ["cables expuestos", "agua en cercanía", "falta de tierra", "instalación provisoria"],
        relatedDocs: ["PO-SGI-018", "PO-SGI-019", "PO-SGI-020", "IT-WSM-003", "IT-WSM-008", "IT-WSM-015"]
    },
    POZO: {
        keywords: [/pozo/i, /bop/i, /surgencia/i, /ahogue/i, /presion/i, /stack/i, /manifold/i, /h2s/i, /gas/i],
        verbs: ["surgió", "descontroló", "no cerró", "fugó gas"],
        controls: ["Control de Pozo", "Cierre de BOP", "Detector de Gases", "Respirador"],
        conditions: ["presión inesperada", "presencia de gas", "falla de barrera"],
        relatedDocs: ["PO-WSG-021", "PO-WSG-023", "PO-SGI-005", "IT-WWO-002", "IT-WWO-024", "IT-WWO-026", "IT-WSG-011", "IT-WSG-013"]
    },
    MONTAJE: {
        keywords: [/montaje/i, /desmontaje/i, /dtm/i, /equipo/i, /armado/i, /mastil/i, /subestructura/i],
        verbs: ["montó", "desmontó", "trasladó", "armó"],
        controls: ["Procedimiento de Montaje", "Checklist Pre-Montaje", "Zona de Exclusión"],
        conditions: ["terreno inestable", "viento fuerte", "piezas pesadas"],
        relatedDocs: ["PO-WWO-001", "PO-WPU-001", "IT-WWO-003", "IT-WSG-019", "IT-WSG-008"]
    },
    PRESION: {
        keywords: [/presion/i, /linea/i, /manguera/i, /valvula/i, /prueba/i, /hidraulica/i],
        verbs: ["reventó", "zafó", "presurizó", "probó"],
        controls: ["Faja de Seguridad", "Válvula de Alivio", "Distancia de Seguridad"],
        conditions: ["alta presión", "material fatigado", "conexión floja"],
        relatedDocs: ["PO-SGI-026", "IT-WSG-006", "IT-WSG-014", "PO-WFB-002"]
    },
    GENERAL: {
        keywords: [],
        verbs: ["actuó", "procedió", "incumplió", "observó"],
        controls: ["Análisis de Riesgo (AST)", "Procedimiento de Trabajo", "Supervisión Presente", "Derecho a Decir No"],
        conditions: ["falta de percepción de riesgo", "prisa/apuro", "cambio de tarea", "falta de comunicación"],
        relatedDocs: ["PO-SGI-006", "PO-SGI-016", "PO-SGI-001", "PG-TAC-002"]
    }
};

// --- ANÁLISIS DE TEXTO ---

interface AnalysisResult {
    dominantRisk: RiskCategory;
    contextKeywords: string[];
    summaryText: string;
    detectedVerbs: string[];
    detectedConditions: string[];
}

export const analyzeIncidentsText = (incidents: Incident[]): AnalysisResult => {
    const combinedText = incidents.map(i => `${i.description} ${i.name} ${i.type} ${i.location}`).join(" ").toLowerCase();
    const verbMatches = new Set<string>();
    const conditionMatches = new Set<string>();
    const scores: Record<string, number> = {
        TRANSITO: 0, CAIDAS: 0, MANOS: 0, ERGO: 0, GOLPES: 0, AMBIENTAL: 0, IZAJE: 0, ELECTRICO: 0, POZO: 0, MONTAJE: 0, PRESION: 0, GENERAL: 0
    };

    // 1. Scoring System
    Object.entries(RISK_DICTIONARY).forEach(([key, profile]) => {
        const riskKey = key as RiskCategory;
        
        // Keywords Score
        profile.keywords.forEach(regex => {
            const matches = combinedText.match(regex);
            if (matches) scores[riskKey] += matches.length * 2;
        });

        // Context Extraction (Verbs & Conditions)
        // We look for strict matches of defined operational verbs to verify context
        profile.verbs.forEach(v => {
            if (combinedText.includes(v.toLowerCase())) verbMatches.add(v);
        });
        profile.conditions.forEach(c => {
            if (combinedText.includes(c.toLowerCase())) conditionMatches.add(c);
        });
    });

    // 2. Determine Dominant Risk
    let maxScore = -1;
    let dominantRisk: RiskCategory = 'GENERAL';

    Object.entries(scores).forEach(([key, score]) => {
        if (score > maxScore) {
            maxScore = score;
            dominantRisk = key as RiskCategory;
        }
    });

    // Fallback logic if low score but explicit type exists
    if (maxScore < 2 && incidents.length > 0) {
        const type = incidents[0].type.toLowerCase();
        if (type.includes('vehic') || type.includes('transito')) dominantRisk = 'TRANSITO';
        else if (type.includes('caida') || type.includes('nivel')) dominantRisk = 'CAIDAS';
        else if (type.includes('ambiental') || type.includes('derrame')) dominantRisk = 'AMBIENTAL';
        else if (type.includes('pozo') || type.includes('surgencia')) dominantRisk = 'POZO';
    }

    // 3. Build Summary Text
    const contextKeywords = Array.from(conditionMatches).slice(0, 3);
    const summaryText = contextKeywords.length > 0 
        ? contextKeywords.join(", ") 
        : (RISK_DICTIONARY[dominantRisk].conditions[0] || "condiciones del entorno");

    return {
        dominantRisk,
        contextKeywords,
        summaryText,
        detectedVerbs: Array.from(verbMatches),
        detectedConditions: Array.from(conditionMatches)
    };
};

// --- GENERADORES DE TEXTO ---

export const getSmartSuggestedActions = (incidents: Incident[]): string[] => {
    // Si no hay incidentes, dar recomendaciones generales de seguridad basadas en "GENERAL"
    const analysis = analyzeIncidentsText(incidents);
    const profile = RISK_DICTIONARY[analysis.dominantRisk];
    
    // Deterministic selection to ensure variation but consistency
    const control1 = profile.controls[0] || "Control de Riesgos";
    const control2 = profile.controls[1] || profile.controls[0];
    
    const context1 = analysis.detectedConditions[0] || profile.conditions[0];
    const factorRecurrente = analysis.detectedVerbs[0] ? `la acción de ${analysis.detectedVerbs[0]}` : "los procedimientos estándar";

    // Acción 1: "Reforzar <control/medida> en <contexto detectado> para prevenir <tipo de evento>."
    const action1 = `Reforzar ${control1.toLowerCase()} ante presencia de ${context1} para prevenir eventos de tipo ${analysis.dominantRisk.toLowerCase()}.`;

    // Acción 2: "Verificar <condición/proceso> relacionado con <factor recurrente identificado>."
    const action2 = `Verificar condiciones del entorno y asegurar cumplimiento de ${control2.toLowerCase()} relacionado con ${factorRecurrente}.`;

    return [action1, action2];
};

export const getSafetyTalkContent = (incidents: Incident[], dateStr: string) => {
    const analysis = analyzeIncidentsText(incidents);
    const profile = RISK_DICTIONARY[analysis.dominantRisk];
    const riskLabel = analysis.dominantRisk === 'TRANSITO' ? 'Seguridad Vial' :
                      analysis.dominantRisk === 'MANOS' ? 'Cuidado de Manos' :
                      analysis.dominantRisk === 'CAIDAS' ? 'Prevención de Caídas' :
                      analysis.dominantRisk === 'POZO' ? 'Control de Pozo' :
                      analysis.dominantRisk === 'IZAJE' ? 'Operaciones de Izaje' :
                      'Seguridad Operativa';

    // 1. Apertura
    const opening = `En el análisis de las operaciones recientes, hemos detectado patrones relacionados con ${riskLabel.toLowerCase()}. El objetivo de hoy es ajustar nuestra percepción del riesgo frente a situaciones que se están repitiendo en el campo.`;

    // 2. Situaciones (Bullets) - Mezcla real y genérica si falta info
    const situations = [];
    if (analysis.detectedConditions.length > 0) {
        situations.push(`Condiciones reportadas: ${analysis.detectedConditions.slice(0, 2).join(" y ")}.`);
    } else {
        situations.push(`Exposición a: ${profile.conditions[0]} durante la tarea.`);
    }
    
    if (analysis.detectedVerbs.length > 0) {
        situations.push(`Acciones críticas: personal que ${analysis.detectedVerbs.slice(0, 2).join(" o ")} sin evaluar el riesgo.`);
    } else {
        situations.push(`Comportamientos: realización de tareas sin aplicar ${profile.controls[0].toLowerCase()}.`);
    }

    // 3. Mensajes Clave
    const messages = [
        `Antes de iniciar, valide específicamente: ${profile.controls.slice(0, 2).join(" y ")}.`,
        `Si detecta ${profile.conditions[0] || "una condición insegura"}, detenga la tarea inmediatamente.`,
        `Evite la confianza excesiva: ${profile.verbs[0] ? `el riesgo de ${profile.verbs[0]}` : "el error humano"} es la causa principal de estos eventos.`
    ];

    // 4. Desvío: Procedimientos Relacionados (Mapping Logic)
    const relatedProcedures: string[] = [];
    if (profile.relatedDocs && profile.relatedDocs.length > 0) {
        profile.relatedDocs.forEach(code => {
            const doc = SEED_DOCUMENTS.find(d => d.code === code);
            if (doc) {
                relatedProcedures.push(`${doc.code} - ${doc.title}`);
            } else {
                relatedProcedures.push(code); // Fallback if not found in seed but in logic
            }
        });
    }

    // 5. Cierre
    const closing = "La seguridad es una responsabilidad compartida. Si ves algo inseguro, intervení. Reportar a tiempo evita el próximo accidente.";

    return {
        title: `Charla de 5 minutos – Prevención de incidentes (${riskLabel})`,
        whyToday: opening,
        keyMessages: messages,
        situations: situations,
        actions: profile.controls.slice(0, 3), 
        closing: closing,
        sourceInfo: `Análisis cualitativo basado en ${incidents.length > 0 ? incidents.length : 'patrones de riesgo'} eventos registrados.`,
        relatedProcedures: relatedProcedures // NEW FIELD
    };
};
