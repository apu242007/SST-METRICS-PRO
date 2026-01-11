
const xlsx = require('xlsx');
const fs = require('fs');

// --- RISK DICTIONARY (Ported from frontend textAnalysis.ts) ---
const RISK_DICTIONARY = {
    TRANSITO: {
        keywords: [/vehic/i, /cama/i, /choque/i, /colisi/i, /volca/i, /conduc/i, /manejo/i, /ruta/i, /camino/i, /camioneta/i, /ifat/i],
        controls: ["Manejo Defensivo: Distancia de seguimiento", "Checklist Pre-uso obligatorio", "Uso de cinturón"],
        hook: "Hoy hablamos de seguridad vial. Un descuido al volante no tiene vuelta atrás.",
        risks: ["Colisión por alcance o vuelco.", "Atropello en maniobras ciegas."],
        signals: "Si ves polvo excesivo o sentís fatiga, frená."
    },
    CAIDAS: {
        keywords: [/caida/i, /nivel/i, /piso/i, /escalera/i, /resbal/i, /tropiez/i, /altura/i],
        controls: ["Tres Puntos de Apoyo", "Orden y Limpieza", "Uso de Arnés"],
        hook: "Vamos a hablar de caídas. Un resbalón puede sacarte de servicio por meses.",
        risks: ["Golpes severos por caídas a nivel.", "Caída de altura por falla en anclaje."],
        signals: "Manchas de aceite o desorden en el piso."
    },
    MANOS: {
        keywords: [/mano/i, /dedo/i, /corte/i, /atrapam/i, /guante/i, /herramienta/i],
        controls: ["No exponer manos en línea de fuego", "Uso de herramientas adecuadas", "Guantes específicos"],
        hook: "Tus manos son tu herramienta más valiosa. Cuídalas de puntos de atrapamiento.",
        risks: ["Atrapamiento o aplastamiento.", "Cortes por herramientas zafadas."],
        signals: "Si la herramienta no calza bien, pará."
    },
    GENERAL: {
        keywords: [],
        controls: ["Análisis de Riesgo (AST)", "Procedimiento de Trabajo", "Derecho a Decir No"],
        hook: "Seguridad Operativa General. No normalicemos el desvío.",
        risks: ["Exceso de confianza.", "Falta de planificación."],
        signals: "Si sentís que algo no está bien, es una señal de alerta."
    }
};

// --- DATA HELPERS ---

const parseDate = (excelDate) => {
    // Handle Excel serial date or string
    if (typeof excelDate === 'number') {
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string') {
        // Expecting YYYY-MM-DD or DD/MM/YYYY
        if (excelDate.includes('/')) {
            const parts = excelDate.split('/');
            // Assume DD/MM/YYYY if 3 parts
            if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return excelDate.substring(0, 10);
    }
    return null;
};

const getExcelData = (filePath) => {
    try {
        const wb = xlsx.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = xlsx.utils.sheet_to_json(ws);
        
        return rawData.map(row => {
            // Mapping Logic similar to frontend importHelpers
            const fechaCarga = parseDate(row['Fecha Carga'] || row['Fecha']);
            const fechaSiniestro = parseDate(row['Datos ART: FECHA SINIESTRO'] || row['Fecha Siniestro']);
            const fechaEvento = fechaSiniestro || fechaCarga;
            
            // Normalize year
            let year = new Date(fechaEvento).getFullYear();
            if (row['Año'] && !isNaN(row['Año'])) year = row['Año'];

            return {
                id: row['ID'] || 'N/A',
                site: (row['Sitio'] || 'Desconocido').toUpperCase(),
                date: fechaEvento, // YYYY-MM-DD
                year: year,
                type: row['Tipo de Incidente'] || 'Sin Clasificar',
                description: row['Breve descripcion del Incidente'] || row['Descripción'] || '',
                risk: row['Potencialidad del Incidente'] || 'N/A',
                is_transit: (row['Tipo de Incidente'] || '').toLowerCase().includes('vehic'),
                com_cliente: String(row['Comunicación Cliente'] || '').toLowerCase() === 'si'
            };
        });
    } catch (error) {
        console.error("[ReportGenerator] Error reading Excel:", error);
        return [];
    }
};

// --- ANALYSIS HELPERS ---

const generateTalkScript = (incidents, dateStr, comCliente = 'SI') => {
    const combinedText = incidents.map(i => `${i.description} ${i.type}`).join(" ").toLowerCase();
    
    // Determine Risk Profile
    let dominantProfile = RISK_DICTIONARY.GENERAL;
    let maxScore = -1;

    Object.values(RISK_DICTIONARY).forEach(profile => {
        let score = 0;
        profile.keywords.forEach(regex => {
            if (regex.test(combinedText)) score++;
        });
        if (score > maxScore && profile.keywords.length > 0) {
            maxScore = score;
            dominantProfile = profile;
        }
    });

    // Build Script
    const script = {
        title: `Charla 5 Min - Reporte del ${dateStr}`,
        apertura: `${dominantProfile.hook} Hoy revisamos ${incidents.length} evento(s) recientes.`,
        riesgos: dominantProfile.risks,
        controles: dominantProfile.controls,
        acciones: [],
        cierre: "La meta es volver a casa sanos. Si controlamos los riesgos, el accidente no ocurre."
    };

    if (comCliente === 'SI') {
        script.acciones.push("COMUNICACIÓN AL CLIENTE (Obligatorio): Ante este tipo de eventos, avisar de inmediato al supervisor y cliente.");
    }
    script.acciones.push("Revisar condiciones del entorno antes de iniciar.");

    return script;
};

// --- HTML RENDERER ---

const generateEmailHtml = (dateStr, dayIncidents, historyIncidents, talk) => {
    const riskColor = (risk) => {
        const r = risk.toLowerCase();
        if (r.includes('alta')) return '#ef4444'; // Red
        if (r.includes('media')) return '#f97316'; // Orange
        return '#3b82f6'; // Blue
    };

    const incidentRows = dayIncidents.map(inc => `
        <div style="border-left: 4px solid ${riskColor(inc.risk)}; padding: 10px; margin-bottom: 10px; background: #f8fafc;">
            <div style="font-weight: bold; color: #334155; font-size: 12px;">${inc.site} | ${inc.type}</div>
            <div style="font-size: 14px; color: #1e293b; margin-top: 4px;">${inc.description}</div>
            <div style="font-size: 11px; color: ${riskColor(inc.risk)}; font-weight: bold; margin-top: 4px;">${inc.risk.toUpperCase()}</div>
        </div>
    `).join('');

    const historyRows = historyIncidents.map(inc => `
        <li style="margin-bottom: 5px; color: #64748b;">
            <strong>${inc.year}</strong> - ${inc.site}: ${inc.type}
        </li>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .section { margin-bottom: 25px; background: white; padding: 20px; border: 1px solid #e2e8f0; }
            .talk-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 6px; }
            .h2 { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; color: #0f172a; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white; }
        </style>
    </head>
    <body style="background-color: #f1f5f9;">
        <div class="container">
            <!-- HEADER -->
            <div class="header">
                <h1 style="margin:0; font-size: 24px;">Resumen Diario SST</h1>
                <p style="margin:5px 0 0 0; opacity: 0.8;">Fecha: ${dateStr}</p>
            </div>

            <!-- CHARLA -->
            <div class="section">
                <div class="h2">📢 Charla de Seguridad (Guion Sugerido)</div>
                <div class="talk-box">
                    <h3 style="margin-top:0; color: #1d4ed8;">${talk.title}</h3>
                    <p><strong>Apertura:</strong> ${talk.apertura}</p>
                    <p><strong>Riesgos Clave:</strong></p>
                    <ul>${talk.riesgos.map(r => `<li>${r}</li>`).join('')}</ul>
                    <p><strong>Controles Críticos:</strong></p>
                    <ul>${talk.controles.map(c => `<li>${c}</li>`).join('')}</ul>
                    ${talk.acciones.length > 0 ? `<p><strong>Acciones / Comunicación:</strong></p><ul>${talk.acciones.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
                    <p style="margin-bottom:0;"><strong>Cierre:</strong> <em>"${talk.cierre}"</em></p>
                </div>
            </div>

            <!-- INCIDENTES DEL DIA -->
            <div class="section">
                <div class="h2">🚨 Incidentes del Día (${dayIncidents.length})</div>
                ${dayIncidents.length > 0 ? incidentRows : '<p style="color:#64748b; font-style:italic;">Sin incidentes reportados para la fecha.</p>'}
            </div>

            <!-- UN DIA COMO HOY -->
            <div class="section">
                <div class="h2">📅 Un día como hoy (Histórico)</div>
                ${historyRows ? `<ul style="font-size: 13px; padding-left: 20px;">${historyRows}</ul>` : '<p style="color:#64748b; font-style:italic;">Sin eventos históricos.</p>'}
            </div>

            <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 20px;">
                Generado automáticamente por SST Metrics Pro System.
            </div>
        </div>
    </body>
    </html>
    `;
};

// --- MAIN PUBLIC FUNCTION ---

const processDailyReport = async (targetDateStr, comClienteFilter = 'SI') => {
    // 1. Get Data
    const filePath = process.env.INCIDENTS_XLSX_PATH;
    if (!filePath || !fs.existsSync(filePath)) {
        throw new Error("Archivo Excel no configurado o no encontrado.");
    }
    const allData = getExcelData(filePath);

    // 2. Filter for Target Date
    // targetDateStr format: YYYY-MM-DD
    const dayIncidents = allData.filter(i => i.date === targetDateStr);

    // 3. Filter History (Same Month/Day, different Year)
    const [tgtYear, tgtMonth, tgtDay] = targetDateStr.split('-').map(Number);
    const historyIncidents = allData.filter(i => {
        const [iYear, iMonth, iDay] = i.date.split('-').map(Number);
        return iMonth === tgtMonth && iDay === tgtDay && iYear !== tgtYear;
    }).sort((a,b) => b.year - a.year);

    // 4. Generate Talk
    const talk = generateTalkScript(dayIncidents, targetDateStr, comClienteFilter);

    // 5. Generate HTML
    const html = generateEmailHtml(targetDateStr, dayIncidents, historyIncidents, talk);

    return {
        subject: `Resumen SST - ${targetDateStr} (${dayIncidents.length} Eventos)`,
        html,
        stats: { dayCount: dayIncidents.length, historyCount: historyIncidents.length }
    };
};

module.exports = { processDailyReport };
