import express from 'express';
import cors from 'cors';
import fs from 'fs';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import { processDailyReport } from './services/reportGenerator.js';
import { sendEmail } from './services/mailer.js';
import { renderPdfFromHtml } from './services/pdfRenderer.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- STATIC FILES (For Production) ---
const DIST_PATH = path.resolve(__dirname, '../dist');
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
cron.schedule('0 7 * * *', async () => {
    console.log("[Cron] Running daily email report task...");
    const today = new Date().toISOString().split('T')[0];
    try {
        await triggerDailyEmail(today);
    } catch (e) {
        console.error("[Cron] Failed:", e.message);
    }
});

const triggerDailyEmail = async (dateStr) => {
    console.log(`[Report] Generating report for ${dateStr}...`);
    const { subject, html, stats } = await processDailyReport(dateStr, 'SI');
    const recipient = process.env.MAIL_TO || 'jcastro@tackertools.com';
    const sent = await sendEmail(recipient, subject, html);

    if (sent) {
        console.log(`[Report] Email sent to ${recipient}. Stats: ${stats.dayCount} incidents.`);
        return { success: true, message: "Email sent", stats };
    } else {
        throw new Error("Failed to send email via SMTP.");
    }
};

// --- ENDPOINTS ---
app.get('/api/status', (req, res) => {
    const exists = fs.existsSync(FILE_PATH);
    res.json({
        online: true,
        path: FILE_PATH,
        exists,
        cronActive: true
    });
});

app.post('/api/email/daily', async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const result = await triggerDailyEmail(date);
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/email/daily/pdf', async (req, res) => {
    const dateYmd = req.query.date;
    const to = req.body?.to || process.env.MAIL_TO || 'jcastro@tackertools.com';

    if (!dateYmd) return res.status(400).json({ ok: false, error: "Date parameter required" });

    try {
        const report = await processDailyReport(dateYmd, 'SI');
        const pdfBuffer = await renderPdfFromHtml(report.html);
        
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
            res.json({ ok: true, date: dateYmd, to, incidentsCount: report.stats.dayCount });
        } else {
            throw new Error("Failed to send email via SMTP.");
        }
    } catch (e) {
        console.error("[API] Error sending PDF:", e);
        res.status(500).json({ ok: false, error: e.message || String(e) });
    }
});

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

app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: "Endpoint not found" });
    const indexFile = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send("Frontend build not found.");
    }
});

if (WATCH_ENABLED && fs.existsSync(FILE_PATH)) {
    chokidar.watch(FILE_PATH, { persistent: true, interval: 5000 }).on('change', () => {
        console.log(`[Watcher] File updated: ${new Date().toLocaleTimeString()}`);
    });
}

app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
});