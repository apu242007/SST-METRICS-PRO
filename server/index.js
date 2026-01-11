
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
const cron = require('node-cron');
const { processDailyReport } = require('./services/reportGenerator');
const { sendEmail } = require('./services/mailer');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const DEFAULT_PATH = "C:\\Users\\jcastro\\Desktop\\NO BORRAR-KPIS INCIDENTES\\basedatosincidentes.xlsx";
const FILE_PATH = process.env.INCIDENTS_XLSX_PATH || DEFAULT_PATH;
const WATCH_ENABLED = process.env.SYNC_WATCH_ENABLED !== 'false';

console.clear();
console.log("\x1b[36m%s\x1b[0m", "--- SST METRICS PRO: BACKEND SERVICE ---");
console.log(`Excel: "${FILE_PATH}"`);

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

// 2. Manual Trigger (Test Mode)
app.post('/api/email/daily', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const result = await triggerDailyEmail(date);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Data Download (Raw Buffer)
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

// --- WATCHER ---
if (WATCH_ENABLED && fs.existsSync(FILE_PATH)) {
    chokidar.watch(FILE_PATH, { persistent: true, interval: 5000 }).on('change', () => {
        console.log(`[Watcher] File updated: ${new Date().toLocaleTimeString()}`);
    });
}

const server = app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log(`Test endpoint: POST http://localhost:${PORT}/api/email/daily?date=2025-01-08`);
});
