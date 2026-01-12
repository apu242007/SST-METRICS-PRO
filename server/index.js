
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const cron = require('node-cron');
const { processDailyReport } = require('./services/reportGenerator');
const { sendEmail } = require('./services/mailer');
const { renderPdfFromHtml } = require('./services/pdfRenderer');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- STATIC FILES (For Production) ---
// Resolve exact path to dist folder relative to this file
// Assumes structure: root/server/index.js and root/dist
const DIST_PATH = path.resolve(__dirname, '../dist');

// Serve static files (JS, CSS, Images)
app.use(express.static(DIST_PATH));

// --- CONFIGURATION ---
const DEFAULT_PATH = "C:\\Users\\jcastro\\Desktop\\NO BORRAR-KPIS INCIDENTES\\basedatosincidentes.xlsx";
const FILE_PATH = process.env.INCIDENTS_XLSX_PATH || DEFAULT_PATH;
const WATCH_ENABLED = process.env.SYNC_WATCH_ENABLED !== 'false';

console.clear();
console.log("\x1b[36m%s\x1b[0m", "--- SST METRICS PRO: BACKEND SERVICE ---");
console.log(`Excel: "${FILE_PATH}"`);
console.log(`Static Files: "${DIST_PATH}"`);

// --- CRON JOBS ---
// Run every day at 07:00 AM
cron.schedule('0 7 * * *', async () => {
    console.log("[Cron] Running daily email report task...");
    const today = new Date().toISOString().split('T')[0];
    try {
        await triggerDailyEmail(today);
    } catch (e) {
        console.error("[Cron] Failed:", e.message);
    }
});

// --- HELPER: Trigger Email ---
const triggerDailyEmail = async (dateStr) => {
    console.log(`[Report] Generating report for ${dateStr}...`);
    
    // 1. Generate Content
    const { subject, html, stats } = await processDailyReport(dateStr, 'SI'); // Default Com.Cliente=SI for automation
    
    // 2. Send
    const recipient = process.env.MAIL_TO || 'jcastro@tackertools.com'; // Fallback strictly to req spec
    const sent = await sendEmail(recipient, subject, html);

    if (sent) {
        console.log(`[Report] Email sent to ${recipient}. Stats: ${stats.dayCount} incidents.`);
        return { success: true, message: "Email sent", stats };
    } else {
        throw new Error("Failed to send email via SMTP.");
    }
};

// --- ENDPOINTS ---

// 1. Status Check
app.get('/api/status', (req, res) => {
    const exists = fs.existsSync(FILE_PATH);
    res.json({
        online: true,
        path: FILE_PATH,
        exists,
        cronActive: true
    });
});

// 2. Manual Trigger (Test Mode) - Sends HTML Body
app.post('/api/email/daily', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const result = await triggerDailyEmail(date);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. New Endpoint: Send PDF as Attachment
app.post('/api/email/daily/pdf', async (req, res) => {
    const dateYmd = req.query.date; // YYYY-MM-DD
    const to = req.body?.to || process.env.MAIL_TO || 'jcastro@tackertools.com';

    if (!dateYmd) return res.status(400).json({ ok: false, error: "Date parameter required" });

    console.log(`[API] Generating PDF Report for ${dateYmd} to ${to}...`);

    try {
        // 1. Generate HTML Report
        const report = await processDailyReport(dateYmd, 'SI');
        
        // 2. Convert to PDF
        const pdfBuffer = await renderPdfFromHtml(report.html);
        
        // 3. Send Email with Attachment
        const subject = `Reporte Diario SST (PDF) - ${dateYmd}`;
        const bodyHtml = `
            <p>Estimado/a,</p>
            <p>Se adjunta el reporte diario de Seguridad e Higiene correspondiente a la fecha <strong>${dateYmd}</strong>.</p>
            <p><em>Resumen: ${report.stats.dayCount} incidentes reportados.</em></p>
            <br/>
            <p>Saludos,<br/>SST Metrics Pro System</p>
        `;

        const sent = await sendEmail(to, subject, bodyHtml, [
            {
                filename: `Reporte_Diario_${dateYmd}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]);

        if (sent) {
            res.json({ 
                ok: true, 
                date: dateYmd, 
                to, 
                incidentsCount: report.stats.dayCount 
            });
        } else {
            throw new Error("Failed to send email via SMTP.");
        }

    } catch (e) {
        console.error("[API] Error sending PDF:", e);
        res.status(500).json({ ok: false, error: e.message || String(e) });
    }
});

// 4. Data Download (Raw Buffer)
app.get('/api/data', (req, res) => {
    if (!fs.existsSync(FILE_PATH)) return res.status(404).json({ error: "Archivo no encontrado" });
    try {
        const fileBuffer = fs.readFileSync(FILE_PATH);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(fileBuffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- SPA FALLBACK (After API routes) ---
// This handles client-side routing by serving index.html for unknown paths
app.get('*', (req, res) => {
    // API 404 safety check
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: "Endpoint not found" });
    }
    
    // Frontend 404 (or SPA route)
    const indexFile = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        // Fallback message if build is missing
        res.status(404).send(`
            <div style="font-family: sans-serif; padding: 20px; text-align: center;">
                <h1>SST Metrics Pro</h1>
                <p>Frontend build not found.</p>
                <p>Expected path: ${DIST_PATH}</p>
                <p>Please run <code>npm run build</code> to generate the 'dist' folder.</p>
            </div>
        `);
    }
});

// --- WATCHER ---
if (WATCH_ENABLED && fs.existsSync(FILE_PATH)) {
    chokidar.watch(FILE_PATH, { persistent: true, interval: 5000 }).on('change', () => {
        console.log(`[Watcher] File updated: ${new Date().toLocaleTimeString()}`);
    });
}

const server = app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`Frontend serving from: ${DIST_PATH}`);
    console.log(`Test endpoint (HTML): POST http://localhost:${PORT}/api/email/daily?date=2025-01-08`);
});