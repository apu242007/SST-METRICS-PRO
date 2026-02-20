import { Incident } from "../types";
import { SEED_DOCUMENTS } from "./seedData";

// ─────────────────────────────────────────────────────────────────────────────
// DICCIONARIOS SEMÁNTICOS — v3.0
// Calibrado con:
//   · 104 incidentes reales (BASEDATOSINCIDENTES2.xlsx)
//   · Tabla completa de Formas ART (25 formas mapeadas)
//   · Resolución de 6 conflictos de keywords
//   · Nueva categoría TERMICO (soldadura, quemadura, contacto caliente)
//   · AMBIENTAL expandido: inhalacion, absorcion cutanea, agente biologico
//   · ERGO cubre Enfermedad Profesional musculoesquelética
//   · Scoring: keywords x2, verbs x3, frases ART exactas x4
// ─────────────────────────────────────────────────────────────────────────────

type RiskCategory =
  | "TRANSITO"
  | "CAIDAS"
  | "MANOS"
  | "ERGO"
  | "GOLPES"
  | "AMBIENTAL"
  | "IZAJE"
  | "ELECTRICO"
  | "TERMICO"       // ← NUEVA — soldadura, quemadura, contacto caliente
  | "GENERAL"
  | "POZO"
  | "PRESION"
  | "MONTAJE";

interface RiskProfile {
  keywords:    RegExp[];   // +2 por match
  artPhrases:  RegExp[];   // +4 por match — frases ART exactas normalizadas
  verbs:       string[];   // +3 por match
  controls:    string[];
  conditions:  string[];
  relatedDocs: string[];
  hook:        string;
  risks:       string[];
  signals:     string;
}

const RISK_DICTIONARY: Record<RiskCategory, RiskProfile> = {

  // ───────────────────────────────────────────────────────────────────────────
  // TRÁNSITO v3.0
  // ───────────────────────────────────────────────────────────────────────────
  TRANSITO: {
    keywords: [
      /vehic/i, /cama\b/i, /choque/i, /colisi[oó]n?/i, /volca/i, /conduc/i,
      /manejo/i, /retroceso/i, /\bruta\b/i, /camino/i, /camioneta/i,
      /equipo pesado/i, /ifat/i, /rueda/i, /cubierta/i, /granizo/i,
      /carrocer/i, /provincial/i, /itinere/i, /semáfor/i, /guardarraíl/i,
      /poste/i, /transporte de personal/i, /mobile/i, /\bmóvil\b/i,
      /banquina/i, /piedra/i, /\bsport\b/i, /\bunidad\b/i, /circulaba/i,
    ],
    artPhrases: [
      /choque de veh[ií]culos/i,
      /accidente in itinere/i,
      /accidente vial/i,
      /accidente de tr[aá]nsito/i,
    ],
    verbs: [
      "colisionó", "impactó", "perdió control", "maniobró",
      "excedió velocidad", "no visualizó", "pinchó", "volteó", "circulaba",
    ],
    controls: [
      "Manejo Defensivo: Distancia de seguimiento",
      "Checklist Pre-uso obligatorio",
      "Uso de cinturón en todos los ocupantes",
    ],
    conditions: [
      "caminos en mal estado", "polvo en suspensión", "tráfico cruzado",
      "puntos ciegos", "fatiga del conductor", "piedras en calzada",
      "granizo / condiciones climáticas adversas",
    ],
    relatedDocs: ["PO-SGI-007", "IT-WPL-022", "PO-WSG-024", "IT-WSG-005"],
    hook: "Hoy hablamos de seguridad vial. Un descuido al volante o en una maniobra de retroceso no tiene vuelta atrás. El objetivo es llegar seguros.",
    risks: [
      "Colisión por alcance o vuelco: La prisa y el estado del camino son la combinación fatal.",
      "Atropello en maniobras: Puntos ciegos al retroceder sin señalero.",
    ],
    signals: "Si ves polvo excesivo, huellas profundas, condiciones climáticas adversas o sentís fatiga, frená.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CAÍDAS v3.0
  // ───────────────────────────────────────────────────────────────────────────
  CAIDAS: {
    keywords: [
      /ca[ií]da/i, /\bnivel\b/i, /\bpiso\b/i,
      /\bsuelo\b/i,
      /escalera/i, /resbal/i, /tropiez/i, /andamio/i, /altura/i,
      /plataforma/i, /enganche/i, /\btorre\b/i, /estribo/i, /descend/i,
      /escalon/i, /pein/i, /desequilibr/i, /tres puntos/i,
      /pisad/i, /\bhombro\b/i,
      /desnivelaci[oó]n/i,
      /ca[ií]da desde/i,
    ],
    artPhrases: [
      /ca[ií]das de personas que ocurren al mismo nivel/i,
      /ca[ií]das de personas con desnivelaci[oó]n/i,
      /ca[ií]das desde alturas/i,
      /pisadas sobre objetos/i,
      /al mismo nivel/i,
    ],
    verbs: [
      "resbaló", "tropezó", "perdió equilibrio", "cayó",
      "saltó", "no aseguró", "descendió sin apoyo", "pisó objeto",
    ],
    controls: [
      "Tres Puntos de Apoyo siempre",
      "Orden y Limpieza en pasarelas",
      "Uso de Arnés 100% conectado",
    ],
    conditions: [
      "superficies irregulares", "presencia de líquidos/aceite", "desorden en el área",
      "iluminación deficiente", "escalones dañados", "estribos resbaladizos en camiones",
      "objetos en el piso no señalizados",
    ],
    relatedDocs: ["PO-SGI-015", "IT-SGI-005", "IT-SGI-015", "PO-WSG-014", "PO-WSG-020", "PO-WSG-023"],
    hook: "Vamos a hablar de caídas. Algo tan simple como un resbalón o no usar los tres puntos de apoyo puede sacarte de servicio por meses.",
    risks: [
      "Golpes severos por caídas a nivel: Pisos sucios o desordenados.",
      "Caída de altura: Falla en anclaje o exceso de confianza en plataformas.",
    ],
    signals: "Si ves manchas de aceite, herramientas en el piso, escalones dañados, estribos resbaladizos u objetos sin señalizar, corregí.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MANOS v3.0
  // ───────────────────────────────────────────────────────────────────────────
  MANOS: {
    keywords: [
      /\bmano/i, /\bdedo/i, /corte/i, /atrapam/i, /guante/i, /herramienta/i,
      /apriet/i, /pellizc/i, /filo/i, /martill/i, /\bmaza\b/i, /\bllave\b/i,
      /\bniple/i, /\bbulón/i, /\bbrida\b/i, /destorqu/i, /meñiqu/i,
      /canasto/i, /aplastam/i, /aprisionad/i,
      /cañones/i, /\bbroche\b/i, /descarga de herramienta/i,
      /punzo/i,
      /cortante/i,
      /contusa/i,
      /objeto inm[oó]vil/i,
      /objeto m[oó]vil/i,
      /dos objetos/i,
    ],
    artPhrases: [
      /atrapamiento por un objeto/i,
      /atrapamiento entre un objeto inm[oó]vil y un objeto m[oó]vil/i,
      /atrapamiento entre dos objetos m[oó]viles/i,
      /injuria punzo.cortante o contusa involuntaria/i,
    ],
    verbs: [
      "apretó", "cortó", "golpeó", "sujetó incorrectamente",
      "expuso la mano", "no utilizó herramienta", "perdió agarre", "punzó",
    ],
    controls: [
      "No exponer manos en línea de fuego",
      "Uso de herramientas de mano adecuadas",
      "Guantes específicos para la tarea",
    ],
    conditions: [
      "herramientas defectuosas", "espacios reducidos", "bordes filosos",
      "movimientos repetitivos", "falta de guarda", "manipulación de niples/bridas sin soporte",
    ],
    relatedDocs: ["PO-SGI-012", "IT-SGI-016", "IT-SGI-001", "IT-WSG-001", "IT-WSG-002", "IT-SGI-006"],
    hook: "Tus manos son tu herramienta más valiosa. En eventos recientes vimos cortes y golpes por exponerlas donde no deben estar.",
    risks: [
      "Atrapamiento o aplastamiento: Poner la mano en puntos de pellizco.",
      "Injuria punzo-cortante: Herramienta incorrecta, borde filoso o movimiento brusco.",
    ],
    signals: "Si la herramienta no calza bien, hay bordes filosos sin proteger o tenés que hacer fuerza desmedida, pará.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // ERGO v3.0
  // ───────────────────────────────────────────────────────────────────────────
  ERGO: {
    keywords: [
      /esfuerzo/i, /postura/i, /lumbar/i, /\bpeso\b/i, /levantam/i, /\bdolor\b/i,
      /muscular/i, /cintura/i, /sobrecarga/i, /\bcarga\b/i, /espalda/i, /torque/i,
      /sobreesfuerzo/i, /crujido/i, /inflamad/i, /rodilla/i,
      /f[ií]sicos/i, /\blevantar\b/i, /\bhombro\b/i,
      /miembro izquierdo/i, /miembro derecho/i, /\bbrazo\b/i, /\bmuñeca\b/i,
      /\btirar\b/i,
      /\bempujar\b/i,
      /\bempuje\b/i,
      /\blanzar\b/i,
      /enfermedad profesional/i,
      /cr[oó]nica/i,
      /tendinitis/i,
      /epicondil/i,
    ],
    artPhrases: [
      /esfuerzos f[ií]sicos excesivos al manejar objetos/i,
      /esfuerzos f[ií]sicos excesivos al levantar objetos/i,
      /esfuerzos f[ií]sicos excesivos al tirar de objetos/i,
      /esfuerzos f[ií]sicos excesivos al empujar objetos/i,
      /esfuerzos f[ií]sicos excesivos al lanzar objetos/i,
      /enfermedad profesional/i,
    ],
    verbs: [
      "levantó", "giró", "forzó", "mantuvo postura", "cargó excesivamente",
      "aplicó torque sin soporte", "tensionó el cuerpo", "tiró", "empujó",
    ],
    controls: [
      "Técnica de Levantamiento (espalda recta)",
      "Pedir ayuda para cargas pesadas",
      "Pausas activas y rotación de tareas",
    ],
    conditions: [
      "carga excesiva", "postura forzada", "espacio confinado",
      "movimiento brusco", "aplicación de torque sin apoyo corporal",
      "tareas repetitivas sin pausas",
    ],
    relatedDocs: ["PO-SGI-024", "IT-SGI-008", "IT-SGI-014"],
    hook: "Hoy el foco es tu cuerpo. Un esfuerzo mal hecho hoy puede convertirse en una lesión crónica. Levantá, empujá y tirá con la técnica correcta.",
    risks: [
      "Lesión lumbar o de hombro: Levantar o tirar peso con postura incorrecta.",
      "Lesión crónica: Tareas repetitivas sin pausas activas ni rotación.",
    ],
    signals: "Si el objeto es incómodo, pesa más de 25kg, o la posición te obliga a torcer el tronco, pedí ayuda.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // GOLPES v3.0
  // ───────────────────────────────────────────────────────────────────────────
  GOLPES: {
    keywords: [
      /golpe/i, /impacto/i, /\bcabeza\b/i, /\bcasco\b/i, /proyecci/i, /partícul/i,
      /\bojo\b/i, /\bcara\b/i, /\bobjeto/i, /proyectil/i, /fragment/i, /luminaria/i,
      /telescóp/i, /manipulador/i, /estallido/i, /vidrio/i,
      /choque contra/i,
      /inm[oó]vil/i,
    ],
    artPhrases: [
      /golpes por objetos m[oó]viles/i,
      /fragmentos volantes/i,
      /choques contra objetos inm[oó]viles/i,
      /golpes por objetos m[oó]viles \/ fragmentos volantes/i,
    ],
    verbs: [
      "golpeó", "proyectó", "impactó contra", "no aseguró",
      "soltó", "cayó sobre", "impactó proyectil", "chocó contra",
    ],
    controls: [
      "Uso de EPP completo (Casco/Lentes)",
      "Aseguramiento de objetos sueltos",
      "Alejarse de la línea de fuego",
    ],
    conditions: [
      "objetos sueltos", "material proyectado", "estructuras bajas",
      "presión contenida", "herramientas sin seguro",
    ],
    relatedDocs: ["PO-SGI-012", "PO-SGI-025", "PO-WSG-020", "IT-SGI-016"],
    hook: "Golpes y proyecciones. Un objeto suelto, un fragmento volante o una estructura baja pueden causar daños graves en ojos o cabeza.",
    risks: [
      "Impacto por proyección: Partículas o fragmentos volantes.",
      "Choque contra objeto inmóvil: Falta de atención al entorno o mala señalización.",
    ],
    signals: "Si ves objetos sin asegurar, trabajo cerca de línea de fuego o estructuras sin señalizar, distanciáte y reportá.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // AMBIENTAL v3.0
  // ───────────────────────────────────────────────────────────────────────────
  AMBIENTAL: {
    keywords: [
      /derrame/i, /\bfuga\b/i,
      /aceite/i, /qu[ií]mico/i, /residuo/i, /ambiental/i, /viento/i, /fauna/i,
      /\bfluido\b/i, /manguera/i, /conexion/i, /\bpileta\b/i, /\bfosa\b/i,
      /\bquema\b/i, /\bgasoil\b/i, /combustible/i, /desborde/i, /efluente/i,
      /\btanque\b/i, /contaminac/i, /mechero/i, /incendio/i, /arena blender/i,
      /mitin operativo/i,
      /inhalaci[oó]n/i,
      /absorci[oó]n cut[aá]nea/i,
      /sustancia qu[ií]mica/i,
      /agente biol[oó]gico/i,
      /\bbiol[oó]gico\b/i,
      /vapores/i,
      /gas t[oó]xico/i,
    ],
    artPhrases: [
      /contacto por absorci[oó]n cut[aá]nea de sustancias qu[ií]micas/i,
      /contacto por inhalaci[oó]n de sustancias qu[ií]micas/i,
      /contacto con agentes biol[oó]gicos/i,
    ],
    verbs: [
      "derramó", "fugó", "contaminó", "dispersó", "no contuvo",
      "desbordó", "perdió estanqueidad", "inhaló", "absorbió",
    ],
    controls: [
      "Kit antiderrames listo y a mano",
      "Chequeo visual + táctil de conexiones",
      "EPP completo para exposición química (respirador/guantes de nitrilo)",
    ],
    conditions: [
      "rotura de línea", "falla de válvula", "viento fuerte", "recipiente inadecuado",
      "piletas sin monitoreo continuo", "vapores sin ventilación adecuada",
      "exposición a agentes biológicos sin EPP",
    ],
    relatedDocs: ["PO-SGI-003", "PG-TAC-008", "PO-SGI-021", "IT-SGI-007", "PO-SGI-009"],
    hook: "Hoy hablamos de exposición ambiental: derrames, inhalación y contacto químico. Lo que no se ve también daña.",
    risks: [
      "Derrame y contaminación: Un goteo chico se vuelve grande sin contención.",
      "Exposición química o biológica: Contacto cutáneo o inhalación sin EPP adecuado.",
    ],
    signals: "Olor extraño, irritación en ojos o piel, film en el piso, piletas al límite o abrazaderas flojas. Si ves esto, frená y evacuá.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // IZAJE v3.0
  // ───────────────────────────────────────────────────────────────────────────
  IZAJE: {
    keywords: [
      /izaje/i, /\bgrúa\b/i, /\bcarga\b/i, /eslinga/i, /\bfaja\b/i, /\bgancho\b/i,
      /suspendida/i, /maniobra/i, /hidrogrúa/i, /\bpluma\b/i, /percha/i, /guinche/i,
      /estrobad/i, /\bsemi\b/i, /planchada/i, /coleo/i, /desprendim/i, /grampa/i,
      /\banclaje\b/i, /manutencion/i,
    ],
    artPhrases: [
      /ca[ií]das de objetos en curso de manutencion manual/i,
      /otras ca[ií]das de objetos no incluidos/i,
      /ca[ií]da de objetos/i,
    ],
    verbs: [
      "izó", "estrobó", "movió carga", "falló guinche",
      "cortó eslinga", "perdió grampa", "desprendió carga", "cayó objeto",
    ],
    controls: [
      "Plan de Izaje y Radio de Exclusión",
      "Inspección de Eslingas/Fajas y Anclajes",
      "Uso de vientos (sogas guía)",
    ],
    conditions: [
      "carga inestable", "viento excesivo", "falla de equipo",
      "personal bajo carga", "grampa o anclaje no inspeccionado",
    ],
    relatedDocs: ["PO-WSG-017", "PO-WSG-022", "IT-WSG-003", "IT-WSG-007", "IT-WSG-020", "IT-WPL-009", "IT-WPL-019"],
    hook: "Maniobras de Izaje. No hay margen de error cuando hay cargas suspendidas. La gravedad no perdona.",
    risks: [
      "Caída de carga: Falla en estrobado, grampa suelta o anclaje no verificado.",
      "Aplastamiento: Personal en la línea de fuego o bajo carga durante maniobra manual.",
    ],
    signals: "Si la carga oscila, no hay vientos, hay gente en el radio de giro o el anclaje no fue inspeccionado, detené la maniobra.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // ELÉCTRICO v3.0
  // ───────────────────────────────────────────────────────────────────────────
  ELECTRICO: {
    keywords: [
      /electric/i, /\bcable\b/i, /tensi[oó]n/i, /volt/i, /tablero/i, /enchufe/i,
      /\barco\b/i, /\bdescarga\b/i, /\bpat\b/i, /\btierra\b/i, /soldadura/i,
      /\bchispa\b/i, /cableado/i, /multigas/i, /circuito/i, /\bbatería\b/i,
      /\bneutral\b/i, /cortocircuito/i, /electrocuci/i,
    ],
    artPhrases: [
      /electrocuci[oó]n/i,
      /arco el[eé]ctrico/i,
      /contacto el[eé]ctrico/i,
    ],
    verbs: [
      "manipuló", "conectó", "cortó cable", "recibió descarga",
      "no bloqueó", "generó arco", "soldó sin protección", "electrocutó",
    ],
    controls: [
      "Bloqueo y Etiquetado (LOTO) obligatorio",
      "Herramientas Aisladas",
      "Verificación de Ausencia de Tensión",
    ],
    conditions: [
      "cables expuestos", "agua en cercanía", "falta de tierra",
      "instalación provisoria", "soldadura sin EPP adecuado",
    ],
    relatedDocs: ["PO-SGI-018", "PO-SGI-019", "PO-SGI-020", "IT-WSM-003", "IT-WSM-008", "IT-WSM-015"],
    hook: "Riesgo Eléctrico. Lo que no ves te puede matar. La confianza es el peor enemigo con la electricidad.",
    risks: [
      "Electrocución: Contacto directo o indirecto con partes energizadas.",
      "Arco eléctrico: Manipulación bajo carga o herramientas inadecuadas.",
    ],
    signals: "Cables pelados, tableros abiertos, falta de candado de bloqueo. No toques nada sin verificar ausencia de tensión.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // TERMICO — NUEVA CATEGORÍA v3.0
  // ───────────────────────────────────────────────────────────────────────────
  TERMICO: {
    keywords: [
      /quemadura/i,
      /\bcaliente\b/i,
      /t[eé]rmico/i,
      /\bquema\b/i,
      /soldar/i,
      /\bsoldador\b/i,
      /chispa de soldadura/i,
      /llama/i,
      /mechero/i,
      /vapor caliente/i,
      /superficie caliente/i,
      /fluido caliente/i,
      /aceite caliente/i,
      /contacto caliente/i,
      /escoria/i,
      /ceniza/i,
    ],
    artPhrases: [
      /contacto con sustancias u objetos calientes/i,
      /quemadura t[eé]rmica/i,
      /contacto t[eé]rmico/i,
    ],
    verbs: [
      "quemó", "tocó superficie caliente", "no usó guante térmico",
      "salpicó fluido caliente", "generó escoria", "soldó sin protección térmica",
    ],
    controls: [
      "Guantes térmicos y ropa ignífuga obligatorios",
      "Señalización de superficies calientes",
      "Distancia de seguridad en trabajos de soldadura",
    ],
    conditions: [
      "superficies calientes sin señalizar",
      "trabajos de soldadura sin EPP térmico",
      "vapores de fluido caliente",
      "mecheros sin protección perimetral",
    ],
    relatedDocs: ["PO-SGI-012", "PO-SGI-025", "IT-SGI-016"],
    hook: "Riesgo Térmico. Una superficie caliente sin señalizar o una salpicadura de soldadura pueden causar quemaduras graves. El calor no avisa.",
    risks: [
      "Quemadura por contacto: Superficies, fluidos o escorias de soldadura calientes.",
      "Quemadura por llama directa: Mecheros o trabajos de corte sin distancia de seguridad.",
    ],
    signals: "Si ves vapor, superficies sin etiqueta de temperatura, trabajo de soldadura activo o llama abierta cerca del área, usá EPP térmico y tomá distancia.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // POZO v3.0
  // ───────────────────────────────────────────────────────────────────────────
  POZO: {
    keywords: [
      /\bpozo\b/i, /\bbop\b/i, /surgencia/i, /ahogue/i, /presi[oó]n/i, /\bstack\b/i,
      /manifold/i, /h2s/i, /\bgas\b/i, /\btbg\b/i, /tubing/i, /testar/i, /bombeando/i,
      /\bTPN\b/i, /sacada/i, /bajado/i, /varilla/i, /sargento/i, /boca de pozo/i,
      /sargen/i, /cañería/i, /packer/i, /\bpkr\b/i,
      /pescador/i, /flow back/i, /arenamiento/i, /pileta de control/i,
      /descarga de cañones/i,
    ],
    artPhrases: [
      /emergencia de pozo/i,
      /control de pozo/i,
      /surgencia descontrolada/i,
    ],
    verbs: [
      "surgió", "descontroló", "no cerró", "fugó gas",
      "perdió presión", "bajó tbg", "sacó varillas", "realizó flow back",
    ],
    controls: [
      "Control de Pozo (Barreras)",
      "BOP operativo y probado",
      "Monitoreo constante de H2S/Gas",
    ],
    conditions: [
      "presión inesperada", "presencia de gas", "falla de barrera",
      "TBG con desgaste no reportado", "arenamiento no anticipado",
    ],
    relatedDocs: ["PO-WSG-021", "PO-WSG-023", "PO-SGI-005", "IT-WWO-002", "IT-WWO-024", "IT-WWO-026", "IT-WSG-011", "IT-WSG-013"],
    hook: "Control de Pozo. La presión siempre busca salir. Nuestra barrera somos nosotros y nuestros procedimientos.",
    risks: [
      "Surgencia descontrolada: Falla en detección temprana o barrera comprometida.",
      "Exposición a H2S: Gas tóxico silente y mortal.",
    ],
    signals: "Si hay ganancia en piletas, burbujeo, alarmas de gas o lecturas de presión inusuales, actuá de inmediato.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MONTAJE v3.0
  // ───────────────────────────────────────────────────────────────────────────
  MONTAJE: {
    keywords: [
      /montaje/i, /desmontaje/i, /\bdtm\b/i, /\bequipo\b/i, /armado/i,
      /m[aá]stil/i, /subestructura/i, /manipulador/i, /telescóp/i, /\btramo\b/i,
      /posicion/i, /semirremolque/i, /retroceso/i, /planchada/i, /entrerrosca/i,
      /\btractor\b/i,
    ],
    artPhrases: [],
    verbs: [
      "montó", "desmontó", "trasladó", "armó",
      "posicionó", "telescopó", "acopló tramo", "traccionó",
    ],
    controls: [
      "Procedimiento de Montaje paso a paso",
      "Coordinación y señalero designado",
      "Zona de Exclusión establecida",
    ],
    conditions: ["terreno inestable", "viento fuerte", "piezas pesadas", "señalero ausente en retroceso"],
    relatedDocs: ["PO-WWO-001", "PO-WPU-001", "IT-WWO-003", "IT-WSG-019", "IT-WSG-008"],
    hook: "Montaje y Desmontaje. Tareas complejas con muchas piezas en movimiento. La coordinación es clave.",
    risks: [
      "Golpes y atrapamientos: Piezas grandes en movimiento.",
      "Caída de componentes: Aseguramiento deficiente durante el traslado.",
    ],
    signals: "Si ves improvisación, falta de comunicación entre operador y piso, o ausencia de señalero, pará.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // PRESIÓN v3.0
  // ───────────────────────────────────────────────────────────────────────────
  PRESION: {
    keywords: [
      /presi[oó]n/i, /\bl[ií]nea\b/i, /manguera/i, /v[aá]lvula/i, /prueba/i,
      /hidr[aá]ulic/i, /\bniple\b/i, /\bbrida\b/i, /man[oó]metro/i, /orificio/i,
      /hermeticidad/i, /psi/i, /faja de seguridad/i, /latigazo/i,
      /high pressure/i, /alta presi[oó]n/i, /\bpump\b/i, /\bbomba\b/i, /desempaquetar/i,
    ],
    artPhrases: [
      /prueba de hermeticidad/i,
      /l[ií]nea de alta presi[oó]n/i,
      /latigazo de manguera/i,
    ],
    verbs: [
      "reventó", "zafó", "presurizó", "probó",
      "tensionó", "superó presión", "falló manómetro",
    ],
    controls: [
      "Faja de Seguridad en mangueras",
      "Válvula de Alivio calibrada",
      "Distancia de Seguridad establecida",
    ],
    conditions: [
      "alta presión", "material fatigado", "conexión floja",
      "manómetro sin calibrar", "prueba de hermeticidad sin protocolo",
    ],
    relatedDocs: ["PO-SGI-026", "IT-WSG-006", "IT-WSG-014", "PO-WFB-002"],
    hook: "Líneas de Presión. Una manguera que zafa es un látigo mortal. Asegurá antes de dar presión.",
    risks: [
      "Latigazo por rotura de manguera: Falta de fajas de seguridad.",
      "Inyección de fluido a alta presión: Fugas puntuales en conexiones.",
    ],
    signals: "Mangueras vibrando, conexiones sin faja, manómetros erróneos o personal cerca de la línea bajo presión.",
  },

  // ───────────────────────────────────────────────────────────────────────────
  // GENERAL v3.0 — fallback intencional
  // ───────────────────────────────────────────────────────────────────────────
  GENERAL: {
    keywords: [
      /mordedura/i, /\banimal/i, /agresi[oó]n/i,
      /\bmanija\b/i, /m[eé]nsula/i, /tambor/i,
    ],
    artPhrases: [
      /mordedura de animales/i,
      /agresi[oó]n sin armas/i,
      /otras formas no incluidas/i,
    ],
    verbs: ["actuó", "procedió", "incumplió", "observó", "agredió"],
    controls: [
      "Análisis de Riesgo (AST) en el sitio",
      "Procedimiento de Trabajo",
      "Derecho a Decir No",
    ],
    conditions: ["falta de percepción de riesgo", "prisa/apuro", "cambio de tarea", "falta de comunicación"],
    relatedDocs: ["PO-SGI-006", "PO-SGI-016", "PO-SGI-001", "PG-TAC-002"],
    hook: "Seguridad Operativa General. No normalicemos el desvío. Hoy vamos a trabajar bien, sin atajos.",
    risks: [
      "Exceso de confianza: Creer que 'no pasa nada'.",
      "Falta de planificación: Improvisar sobre la marcha.",
    ],
    signals: "Si sentís que 'esto no está bien', hay apuro excesivo o el procedimiento no aplica, es una señal de alerta.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISIS DE TEXTO — v3.0
// Scoring: keywords x2 | verbs x3 | artPhrases x4
// ─────────────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  dominantRisk: RiskCategory;
  profile: RiskProfile;
}

export const analyzeIncidentsText = (incidents: Incident[]): AnalysisResult => {
  const typeText  = incidents.map((i) => `${i.type} ${i.type} ${i.type}`).join(" ").toLowerCase();
  const descText  = incidents.map((i) => `${i.description} ${i.name} ${i.location}`).join(" ").toLowerCase();
  const combinedText = `${typeText} ${descText}`;

  const scores: Record<string, number> = {};
  (Object.keys(RISK_DICTIONARY) as RiskCategory[]).forEach((k) => (scores[k] = 0));

  Object.entries(RISK_DICTIONARY).forEach(([key, profile]) => {
    const riskKey = key as RiskCategory;

    // Keywords → +2
    profile.keywords.forEach((regex) => {
      const m = combinedText.match(new RegExp(regex.source, "gi"));
      if (m) scores[riskKey] += m.length * 2;
    });

    // Verbs → +3
    profile.verbs.forEach((verb) => {
      const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = combinedText.match(new RegExp(escaped, "gi"));
      if (m) scores[riskKey] += m.length * 3;
    });

    // ART Phrases → +4
    profile.artPhrases.forEach((regex) => {
      const m = combinedText.match(new RegExp(regex.source, "gi"));
      if (m) scores[riskKey] += m.length * 4;
    });
  });

  let maxScore = -1;
  let dominantRisk: RiskCategory = "GENERAL";

  (Object.entries(scores) as [RiskCategory, number][]).forEach(([key, score]) => {
    if (score > maxScore) { maxScore = score; dominantRisk = key as RiskCategory; }
  });

  // Fallback en cadena — activado cuando score < 2
  if (maxScore < 2 && incidents.length > 0) {
    const ft = `${incidents[0].type} ${incidents[0].description} ${incidents[0].name}`.toLowerCase();
    if      (/vehic|tránsito|transito|itinere|rueda|cubierta|camioneta|unidad|sport/.test(ft)) dominantRisk = "TRANSITO";
    else if (/caida|nivel|escalera|estribo|pisada|desnivelacion/.test(ft))                     dominantRisk = "CAIDAS";
    else if (/ambiental|derrame|pileta|fosa|gasoil|inhalacion/.test(ft))                       dominantRisk = "AMBIENTAL";
    else if (/pozo|surgencia|tbg|tubing|flow back|arenamiento/.test(ft))                       dominantRisk = "POZO";
    else if (/esfuerzo|lumbar|espalda|levant|hombro|fisicos|tirar|empujar/.test(ft))           dominantRisk = "ERGO";
    else if (/presión|manguera|hidráulica|hermeticidad/.test(ft))                              dominantRisk = "PRESION";
    else if (/izaje|grúa|eslinga|guinche|manutencion/.test(ft))                                dominantRisk = "IZAJE";
    else if (/electric|cable|tensión|soldadura|cortocircuito/.test(ft))                        dominantRisk = "ELECTRICO";
    else if (/quemadura|caliente|térmico|termico|escoria/.test(ft))                            dominantRisk = "TERMICO";
    else if (/mano|dedo|corte|atrapam|punzo|cañones/.test(ft))                                 dominantRisk = "MANOS";
    else if (/golpe|impacto|proyecci|fragmentos/.test(ft))                                     dominantRisk = "GOLPES";
    else if (/montaje|desmontaje|dtm|tractor/.test(ft))                                        dominantRisk = "MONTAJE";
  }

  return { dominantRisk, profile: RISK_DICTIONARY[dominantRisk] };
};

// ─────────────────────────────────────────────────────────────────────────────
// CHARLA 5 MIN — compatible v3.0
// ─────────────────────────────────────────────────────────────────────────────
export const getSafetyTalkContent = (
  incidents: Incident[],
  dateStr: string,
  comClienteFilter: "All" | "SI" | "NO"
) => {
  const { profile, dominantRisk } = analyzeIncidentsText(incidents);
  const whyToday = `${profile.hook} En eventos recientes vimos patrones relacionados con ${dominantRisk.toLowerCase()}. El objetivo es simple: evitar el evento y, si ocurre, controlar en el primer minuto.`;
  const situations = [
    `Riesgo 1: ${profile.risks[0]}`,
    `Riesgo 2: ${profile.risks[1]}`,
    `Señales de alerta (si ves esto, frená): ${profile.signals}`,
  ];
  const keyMessages = [
    `ANTES: ${profile.controls[0] || "Planificación y AST"}.`,
    `DURANTE: ${profile.controls[1] || "Atención a la tarea"}.`,
    `SI PASA: ${profile.controls[2] || "Stop Work inmediato"}.`,
  ];
  const actions: string[] = [];
  if (profile.relatedDocs?.length > 0) {
    const docCode = profile.relatedDocs[0];
    const doc = SEED_DOCUMENTS.find((d) => d.code === docCode);
    actions.push(`Aplicar Doc: ${docCode} (${doc?.title ?? "Procedimiento Específico"}). Paso crítico: Verificar condiciones antes de iniciar.`);
  }
  if (comClienteFilter === "SI") {
    actions.push("COMUNICACIÓN AL CLIENTE (Obligatorio): Ante cualquier evento, se activa aviso inmediato al supervisor/representante. Se informa: Qué pasó, Estado (contenido/no) y Acciones.");
  }
  return {
    title: `Charla 5 Min – ${dominantRisk} y Control de Riesgos`,
    whyToday, keyMessages, situations, actions,
    closing: "Hoy la meta es una sola: cero incidentes por descuidos evitables. Si controlamos los riesgos críticos, el evento no escala. ¿Estamos todos alineados?",
    sourceInfo: `Basado en análisis de ${incidents.length} eventos y perfil de riesgo ${dominantRisk}.`,
    relatedProcedures: profile.relatedDocs,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES SUGERIDAS — compatible v3.0
// ─────────────────────────────────────────────────────────────────────────────
export const getSmartSuggestedActions = (incidents: Incident[]): string[] => {
  const { profile, dominantRisk } = analyzeIncidentsText(incidents);
  return [
    `Reforzar ${(profile.controls[0] || "control de riesgos").toLowerCase()} ante presencia de ${profile.conditions[0] || "condiciones inseguras"}.`,
    `Verificar condiciones del entorno para prevenir eventos de tipo ${dominantRisk.toLowerCase()}.`,
  ];
};