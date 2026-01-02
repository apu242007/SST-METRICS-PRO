
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const chokidar = require('chokidar');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const DEFAULT_PATH = "C:\\Users\\jcastro\\Desktop\\NO BORRAR-KPIS INCIDENTES\\basedatosincidentes.xlsx";
const FILE_PATH = process.env.INCIDENTS_XLSX_PATH || DEFAULT_PATH;
const WATCH_ENABLED = process.env.SYNC_WATCH_ENABLED !== 'false'; // Default true

console.clear();
console.log("\x1b[36m%s\x1b[0m", "--- SST METRICS PRO: LOCAL BACKEND SERVICE ---");
console.log("Estado: Iniciando...");
console.log(`Ruta objetivo: "${FILE_PATH}"`);
console.log(`Fuente configuración: ${process.env.INCIDENTS_XLSX_PATH ? 'VARIABLE DE ENTORNO (.ENV)' : 'VALOR POR DEFECTO (HARDCODED)'}`);

// --- STATE ---
let fileStatus = {
    path: FILE_PATH,
    source: process.env.INCIDENTS_XLSX_PATH ? 'ENV' : 'DEFAULT',
    exists: false,
    lastModified: null,
    error: null,
    locked: false
};

// --- HELPERS ---
const checkFile = () => {
    try {
        if (fs.existsSync(FILE_PATH)) {
            const stats = fs.statSync(FILE_PATH);
            fileStatus.exists = true;
            fileStatus.lastModified = stats.mtime.toISOString();
            fileStatus.error = null;
            // Basic locked check (try to open for reading)
            try {
                const fd = fs.openSync(FILE_PATH, 'r');
                fs.closeSync(fd);
                fileStatus.locked = false;
            } catch(e) {
                if (e.code === 'EBUSY' || e.code === 'EPERM') fileStatus.locked = true;
            }
        } else {
            fileStatus.exists = false;
            fileStatus.error = "Archivo no encontrado en la ruta especificada.";
        }
    } catch (e) {
        fileStatus.exists = false;
        fileStatus.error = e.message;
    }
};

// Initial Check
checkFile();
if (fileStatus.exists) console.log("\x1b[32m%s\x1b[0m", "✓ Archivo Excel detectado correctamente.");
else console.log("\x1b[33m%s\x1b[0m", `⚠ Advertencia: ${fileStatus.error}`);

// --- WATCHER ---
if (WATCH_ENABLED) {
    const watcher = chokidar.watch(FILE_PATH, {
        persistent: true,
        usePolling: true,
        interval: parseInt(process.env.SYNC_POLL_SECONDS || '30') * 1000,
    });

    watcher
        .on('add', () => { console.log(`[Watcher] Archivo detectado: ${new Date().toLocaleTimeString()}`); checkFile(); })
        .on('change', () => { console.log(`[Watcher] Cambio detectado: ${new Date().toLocaleTimeString()}`); checkFile(); })
        .on('unlink', () => { console.log(`[Watcher] Archivo eliminado: ${new Date().toLocaleTimeString()}`); checkFile(); });
    
    console.log(`Watcher activado (Polling: ${process.env.SYNC_POLL_SECONDS || 30}s)`);
}

// --- ENDPOINTS ---

// 1. Status Check
app.get('/api/status', (req, res) => {
    // Re-check on request to be sure
    checkFile();
    
    let uiStatus = 'OK';
    if (!fileStatus.exists) uiStatus = 'NO_FILE';
    if (fileStatus.locked) uiStatus = 'FILE_LOCKED';
    if (fileStatus.error && !fileStatus.locked && fileStatus.exists) uiStatus = 'ERROR';

    res.json({
        online: true,
        path: fileStatus.path,
        source: fileStatus.source,
        lastModifiedFile: fileStatus.lastModified,
        status: uiStatus,
        message: fileStatus.locked ? "Archivo en uso por otra aplicación" : (fileStatus.error || "Archivo accesible y listo.")
    });
});

// 2. Data Download (Raw Buffer)
app.get('/api/data', (req, res) => {
    checkFile();
    if (!fileStatus.exists) {
        return res.status(404).json({ error: "Archivo no encontrado" });
    }

    try {
        const fileBuffer = fs.readFileSync(FILE_PATH);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(fileBuffer);
        fileStatus.locked = false;
        console.log(`[API] Data servida exitosamente a las ${new Date().toLocaleTimeString()}`);
    } catch (e) {
        if (e.code === 'EBUSY' || e.code === 'EPERM') {
            fileStatus.locked = true;
            console.error(`[API] Error: Archivo bloqueado (EBUSY)`);
            return res.status(503).json({ error: "El archivo está abierto por otro programa (Excel). Ciérrelo para sincronizar.", code: 'FILE_LOCKED' });
        }
        console.error(`[API] Error de lectura: ${e.message}`);
        res.status(500).json({ error: "Error de lectura: " + e.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`\n\x1b[32m%s\x1b[0m`, `Backend local corriendo en http://localhost:${PORT}`);
    console.log("Listo para sincronizar con la App Web.\n");
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        console.error(`\x1b[31mError Crítico: El puerto ${PORT} está ocupado.\x1b[0m`);
        console.error("Probablemente ya hay una instancia corriendo.");
    } else {
        console.error(e);
    }
});
