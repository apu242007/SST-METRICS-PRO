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
    // New Fields for Strict Template
    hook: string;
    risks: string[]; // List of critical risks (Risk 1, Risk 2)
    signals: string; // "Si ves esto..."
}

const RISK_DICTIONARY: Record<RiskCategory, RiskProfile> = {
    TRANSITO: {
        keywords: [/vehic/i, /cama/i, /choque/i, /colisi/i, /volca/i, /conduc/i, /manejo/i, /retroceso/i, /ruta/i, /camino/i, /camioneta/i, /equipo pesado/i, /ifat/i],
        verbs: ["colisionó", "impactó", "perdió control", "maniobró", "excedió velocidad", "no visualizó"],
        controls: ["Manejo Defensivo: Distancia de seguimiento", "Checklist Pre-uso obligatorio", "Uso de cinturón en todos los ocupantes"],
        conditions: ["caminos en mal estado", "polvo en suspensión", "tráfico cruzado", "puntos ciegos", "fatiga del conductor"],
        relatedDocs: ["PO-SGI-007", "IT-WPL-022", "PO-WSG-024", "IT-WSG-005"],
        hook: "Hoy hablamos de seguridad vial. Un descuido al volante o en una maniobra de retroceso no tiene vuelta atrás. El objetivo es llegar seguros.",
        risks: [
            "Colisión por alcance o vuelco: La prisa y el estado del camino son la combinación fatal.",
            "Atropello en maniobras: Puntos ciegos al retroceder sin señalero."
        ],
        signals: "Si ves polvo excesivo, huellas profundas o sentís fatiga, frená."
    },
    CAIDAS: {
        keywords: [/caida/i, /nivel/i, /piso/i, /suelo/i, /escalera/i, /resbal/i, /tropiez/i, /andamio/i, /altura/i, /plataforma/i, /enganche/i, /torre/i],
        verbs: ["resbaló", "tropezó", "perdió equilibrio", "cayó", "saltó", "no aseguró"],
        controls: ["Tres Puntos de Apoyo siempre", "Orden y Limpieza en pasarelas", "Uso de Arnés 100% conectado"],
        conditions: ["superficies irregulares", "presencia de líquidos/aceite", "desorden en el área", "iluminación deficiente", "escalones dañados"],
        relatedDocs: ["PO-SGI-015", "IT-SGI-005", "IT-SGI-015", "PO-WSG-014", "PO-WSG-020", "PO-WSG-023"],
        hook: "Vamos a hablar de caídas. Algo tan simple como un resbalón o no usar los tres puntos de apoyo puede sacarte de servicio por meses.",
        risks: [
            "Golpes severos por caídas a nivel: Pisos sucios o desordenados.",
            "Caída de altura: Falla en anclaje o exceso de confianza en plataformas."
        ],
        signals: "Si ves manchas de aceite, herramientas en el piso o barandas flojas, corregí."
    },
    MANOS: {
        keywords: [/mano/i, /dedo/i, /corte/i, /atrapam/i, /guante/i, /herramienta/i, /apriet/i, /pellizc/i, /filo/i, /martill/i, /maza/i, /llave/i],
        verbs: ["apretó", "cortó", "golpeó", "sujetó incorrectamente", "expuso la mano", "no utilizó herramienta"],
        controls: ["No exponer manos en línea de fuego", "Uso de herramientas de mano adecuadas", "Guantes específicos para la tarea"],
        conditions: ["herramientas defectuosas", "espacios reducidos", "bordes filosos", "movimientos repetitivos", "falta de guarda"],
        relatedDocs: ["PO-SGI-012", "IT-SGI-016", "IT-SGI-001", "IT-WSG-001", "IT-WSG-002", "IT-WSG-006"],
        hook: "Tus manos son tu herramienta más valiosa. En eventos recientes vimos cortes y golpes por exponerlas donde no deben estar.",
        risks: [
            "Atrapamiento o aplastamiento: Poner la mano en puntos de pellizco.",
            "Cortes por herramientas zafadas: Uso de herramienta incorrecta o mal estado."
        ],
        signals: "Si la herramienta no calza bien o tenés que hacer fuerza desmedida, pará."
    },
    ERGO: {
        keywords: [/esfuerzo/i, /postura/i, /lumbar/i, /peso/i, /levantam/i, /dolor/i, /muscular/i, /cintura/i, /sobrecarga/i, /carga/i],
        verbs: ["levantó", "giró", "forzó", "mantuvo postura", "cargó excesivamente"],
        controls: ["Técnica de Levantamiento (espalda recta)", "Pedir ayuda para cargas pesadas", "Pausas activas"],
        conditions: ["carga excesiva", "postura forzada", "espacio confinado", "movimiento brusco"],
        relatedDocs: ["PO-SGI-024", "IT-SGI-008", "IT-SGI-014"],
        hook: "Hoy el foco es tu espalda. Un esfuerzo mal hecho hoy te puede doler toda la semana. Levantá con la cabeza, no solo con el cuerpo.",
        risks: [
            "Lesión lumbar: Levantar peso lejos del cuerpo o girando el tronco.",
            "Fatiga muscular: Mantener posturas forzadas sin descanso."
        ],
        signals: "Si el objeto es incómodo o pesa más de 25kg, no seas héroe, pedí ayuda."
    },
    GOLPES: {
        keywords: [/golpe/i, /impacto/i, /cabeza/i, /casco/i, /proyeccion/i, /particula/i, /ojo/i, /cara/i, /objeto/i],
        verbs: ["golpeó", "proyectó", "impactó contra", "no aseguró", "soltó"],
        controls: ["Uso de EPP completo (Casco/Lentes)", "Aseguramiento de objetos sueltos", "Alejarse de la línea de fuego"],
        conditions: ["objetos sueltos", "material proyectado", "estructuras bajas", "presión contenida"],
        relatedDocs: ["PO-SGI-012", "PO-SGI-025", "PO-WSG-020", "IT-SGI-016"],
        hook: "Golpes y proyecciones. Un objeto suelto o una herramienta que zafa pueden causar daños graves en ojos o cabeza.",
        risks: [
            "Impacto por proyección: Partículas o piezas que salen despedidas.",
            "Golpes contra estructuras: Falta de atención al entorno."
        ],
        signals: "Si ves a alguien trabajando sin lentes o golpeando metal con metal, intervení."
    },
    AMBIENTAL: {
        keywords: [/derrame/i, /fuga/i, /suelo/i, /aceite/i, /quimico/i, /residuo/i, /ambiental/i, /viento/i, /fauna/i, /fluido/i, /manguera/i, /conexion/i],
        verbs: ["derramó", "fugó", "contaminó", "dispersó", "no contuvo"],
        controls: ["Kit antiderrames listo y a mano", "Chequeo visual + táctil de conexiones", "Plan de contención definido"],
        conditions: ["rotura de línea", "falla de válvula", "viento fuerte", "recipiente inadecuado"],
        relatedDocs: ["PO-SGI-003", "PG-TAC-008", "PO-SGI-021", "IT-SGI-007", "PO-SGI-009"],
        hook: "Hoy hablamos de derrames y de algo que se repite: una conexión que no estaba bien asegurada o una contención que no estaba lista.",
        risks: [
            "Derrame y contaminación: Un goteo chico se vuelve grande sin contención.",
            "Exposición del personal: El apuro por contener sin EPP genera accidentes."
        ],
        signals: "Olor, film en el piso, goteo persistente o abrazaderas flojas. Si ves esto, frená."
    },
    IZAJE: {
        keywords: [/izaje/i, /grua/i, /carga/i, /eslinga/i, /faja/i, /gancho/i, /suspendida/i, /maniobra/i, /hidrogrua/i, /pluma/i],
        verbs: ["izó", "estrobó", "movió carga", "falló guinche", "cortó eslinga"],
        controls: ["Plan de Izaje y Radio de Exclusión", "Inspección de Eslingas/Fajas", "Uso de vientos (sogas guía)"],
        conditions: ["carga inestable", "viento excesivo", "falla de equipo", "personal bajo carga"],
        relatedDocs: ["PO-WSG-017", "PO-WSG-022", "IT-WSG-003", "IT-WSG-007", "IT-WSG-020", "IT-WPL-009", "IT-WPL-019"],
        hook: "Maniobras de Izaje. No hay margen de error cuando hay cargas suspendidas. La gravedad no perdona.",
        risks: [
            "Caída de carga: Falla en estrobado o equipo.",
            "Aplastamiento: Personal ubicado en la línea de fuego o bajo carga."
        ],
        signals: "Si la carga oscila, no hay vientos o hay gente en el radio de giro, detené la maniobra."
    },
    ELECTRICO: {
        keywords: [/electric/i, /cable/i, /tension/i, /volt/i, /tablero/i, /enchufe/i, /arco/i, /descarga/i, /pat/i, /tierra/i],
        verbs: ["manipuló", "conectó", "cortó cable", "recibió descarga", "no bloqueó"],
        controls: ["Bloqueo y Etiquetado (LOTO) obligatorio", "Herramientas Aisladas", "Verificación de Ausencia de Tensión"],
        conditions: ["cables expuestos", "agua en cercanía", "falta de tierra", "instalación provisoria"],
        relatedDocs: ["PO-SGI-018", "PO-SGI-019", "PO-SGI-020", "IT-WSM-003", "IT-WSM-008", "IT-WSM-015"],
        hook: "Riesgo Eléctrico. Lo que no ves te puede matar. La confianza es el peor enemigo con la electricidad.",
        risks: [
            "Electrocución: Contacto directo o indirecto.",
            "Arco eléctrico: Manipulación bajo carga o herramientas inadecuadas."
        ],
        signals: "Cables pelados, tableros abiertos o falta de candado de bloqueo."
    },
    POZO: {
        keywords: [/pozo/i, /bop/i, /surgencia/i, /ahogue/i, /presion/i, /stack/i, /manifold/i, /h2s/i, /gas/i],
        verbs: ["surgió", "descontroló", "no cerró", "fugó gas"],
        controls: ["Control de Pozo (Barreras)", "BOP operativo y probado", "Monitoreo constante de H2S/Gas"],
        conditions: ["presión inesperada", "presencia de gas", "falla de barrera"],
        relatedDocs: ["PO-WSG-021", "PO-WSG-023", "PO-SGI-005", "IT-WWO-002", "IT-WWO-024", "IT-WWO-026", "IT-WSG-011", "IT-WSG-013"],
        hook: "Control de Pozo. La presión siempre busca salir. Nuestra barrera somos nosotros y nuestros procedimientos.",
        risks: [
            "Surgencia descontrolada: Falla en detección temprana.",
            "Exposición a H2S: Gas tóxico silente y mortal."
        ],
        signals: "Si hay ganancia en piletas, burbujeo o alarmas de gas, actuá de inmediato."
    },
    MONTAJE: {
        keywords: [/montaje/i, /desmontaje/i, /dtm/i, /equipo/i, /armado/i, /mastil/i, /subestructura/i],
        verbs: ["montó", "desmontó", "trasladó", "armó"],
        controls: ["Procedimiento de Montaje paso a paso", "Coordinación de equipo", "Zona de Exclusión"],
        conditions: ["terreno inestable", "viento fuerte", "piezas pesadas"],
        relatedDocs: ["PO-WWO-001", "PO-WPU-001", "IT-WWO-003", "IT-WSG-019", "IT-WSG-008"],
        hook: "Montaje y Desmontaje. Tareas complejas con muchas piezas en movimiento. La coordinación es clave.",
        risks: [
            "Golpes y atrapamientos: Piezas grandes en movimiento.",
            "Caída de componentes: Aseguramiento deficiente."
        ],
        signals: "Si ves improvisación o falta de comunicación entre el operador y el piso, pará."
    },
    PRESION: {
        keywords: [/presion/i, /linea/i, /manguera/i, /valvula/i, /prueba/i, /hidraulica/i],
        verbs: ["reventó", "zafó", "presurizó", "probó"],
        controls: ["Faja de Seguridad en mangueras", "Válvula de Alivio calibrada", "Distancia de Seguridad"],
        conditions: ["alta presión", "material fatigado", "conexión floja"],
        relatedDocs: ["PO-SGI-026", "IT-WSG-006", "IT-WSG-014", "PO-WFB-002"],
        hook: "Líneas de Presión. Una manguera que zafa es un látigo mortal. Asegurá antes de dar presión.",
        risks: [
            "Latigazo por rotura: Falta de fajas de seguridad.",
            "Inyección de fluido a alta presión: Fugas puntuales."
        ],
        signals: "Mangueras vibrando, conexiones sin faja o personal cerca de la línea bajo presión."
    },
    GENERAL: {
        keywords: [],
        verbs: ["actuó", "procedió", "incumplió", "observó"],
        controls: ["Análisis de Riesgo (AST) en el sitio", "Procedimiento de Trabajo", "Derecho a Decir No"],
        conditions: ["falta de percepción de riesgo", "prisa/apuro", "cambio de tarea", "falta de comunicación"],
        relatedDocs: ["PO-SGI-006", "PO-SGI-016", "PO-SGI-001", "PG-TAC-002"],
        hook: "Seguridad Operativa General. No normalicemos el desvío. Hoy vamos a trabajar bien, sin atajos.",
        risks: [
            "Exceso de confianza: Creer que 'no pasa nada'.",
            "Falta de planificación: Improvisar sobre la marcha."
        ],
        signals: "Si sentís que 'esto no está bien' o hay apuro excesivo, es una señal de alerta."
    }
};

// --- ANÁLISIS DE TEXTO ---

interface AnalysisResult {
    dominantRisk: RiskCategory;
    profile: RiskProfile;
    // ... other fields kept for compatibility if needed
}

export const analyzeIncidentsText = (incidents: Incident[]): AnalysisResult => {
    const combinedText = incidents.map(i => `${i.description} ${i.name} ${i.type} ${i.location}`).join(" ").toLowerCase();
    const scores: Record<string, number> = {
        TRANSITO: 0, CAIDAS: 0, MANOS: 0, ERGO: 0, GOLPES: 0, AMBIENTAL: 0, IZAJE: 0, ELECTRICO: 0, POZO: 0, MONTAJE: 0, PRESION: 0, GENERAL: 0
    };

    // 1. Scoring System
    Object.entries(RISK_DICTIONARY).forEach(([key, profile]) => {
        const riskKey = key as RiskCategory;
        profile.keywords.forEach(regex => {
            const matches = combinedText.match(regex);
            if (matches) scores[riskKey] += matches.length * 2;
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

    if (maxScore < 2 && incidents.length > 0) {
        const type = incidents[0].type.toLowerCase();
        if (type.includes('vehic') || type.includes('transito')) dominantRisk = 'TRANSITO';
        else if (type.includes('caida') || type.includes('nivel')) dominantRisk = 'CAIDAS';
        else if (type.includes('ambiental') || type.includes('derrame')) dominantRisk = 'AMBIENTAL';
        else if (type.includes('pozo') || type.includes('surgencia')) dominantRisk = 'POZO';
    }

    return {
        dominantRisk,
        profile: RISK_DICTIONARY[dominantRisk]
    };
};

export const getSafetyTalkContent = (incidents: Incident[], dateStr: string, comClienteFilter: 'All' | 'SI' | 'NO') => {
    const { profile, dominantRisk } = analyzeIncidentsText(incidents);
    const riskLabel = dominantRisk;

    // --- TEMPLATE LOGIC ---

    // 1. Apertura [0:00-0:30]
    const whyToday = `${profile.hook} En eventos recientes vimos patrones relacionados con ${riskLabel.toLowerCase()}. El objetivo es simple: evitar el evento y, si ocurre, controlar en el primer minuto.`;

    // 2. Riesgos [0:30-2:00]
    const situations = [
        `Riesgo 1: ${profile.risks[0]}`,
        `Riesgo 2: ${profile.risks[1]}`,
        `Señales de alerta (si ves esto, frená): ${profile.signals}`
    ];

    // 3. Controles [2:00-4:30]
    // Split controls into Before/During implicitly via bullets
    const keyMessages = [
        `ANTES: ${profile.controls[0] || "Planificación y AST"}.`,
        `DURANTE: ${profile.controls[1] || "Atención a la tarea"}.`,
        `SI PASA: ${profile.controls[2] || "Stop Work inmediato"}.`
    ];

    // 4. Procedimientos & Com Cliente Logic
    const actions: string[] = [];
    
    // Add Doc References
    if (profile.relatedDocs && profile.relatedDocs.length > 0) {
        const docCode = profile.relatedDocs[0];
        const doc = SEED_DOCUMENTS.find(d => d.code === docCode);
        const title = doc ? doc.title : "Procedimiento Específico";
        actions.push(`Aplicar Doc: ${docCode} (${title}). Paso crítico: Verificar condiciones antes de iniciar.`);
    }

    // --- LOGIC: COMUNICACIÓN CLIENTE ---
    if (comClienteFilter === 'SI') {
        actions.push("COMUNICACIÓN AL CLIENTE (Obligatorio): Ante cualquier evento, se activa aviso inmediato al supervisor/representante. Se informa: Qué pasó, Estado (contenido/no) y Acciones.");
    } 
    // If 'NO', we explicitly do NOT add it. If 'All', we skip it to keep it generic unless critical.

    // 5. Cierre [4:30-5:00]
    const closing = "Hoy la meta es una sola: cero incidentes por descuidos evitables. Si controlamos los riesgos críticos, el evento no escala. ¿Estamos todos alineados?";

    return {
        title: `Charla 5 Min – ${riskLabel} y Control de Riesgos`,
        whyToday,
        keyMessages,
        situations,
        actions, 
        closing,
        sourceInfo: `Basado en análisis de ${incidents.length} eventos y perfil de riesgo ${dominantRisk}.`,
        relatedProcedures: profile.relatedDocs // Field for UI badges
    };
};

export const getSmartSuggestedActions = (incidents: Incident[]): string[] => {
    const { profile, dominantRisk } = analyzeIncidentsText(incidents);
    const control1 = profile.controls[0] || "Control de Riesgos";
    const context1 = profile.conditions[0] || "condiciones inseguras";
    
    return [
        `Reforzar ${control1.toLowerCase()} ante presencia de ${context1}.`,
        `Verificar condiciones del entorno para prevenir eventos de tipo ${dominantRisk.toLowerCase()}.`
    ];
};