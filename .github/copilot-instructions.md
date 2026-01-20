# Copilot Instructions for SST-METRICS-PRO

## Arquitectura general
- Este proyecto es una aplicación React + Vite con TypeScript, usando TailwindCSS para estilos.
- La estructura principal está en la raíz y en la carpeta `components/`, que contiene vistas y módulos funcionales (ej: `Dashboard.tsx`, `IncidentManager.tsx`).
- La carpeta `server/` contiene lógica backend en Node.js, con servicios para mailing y generación de reportes.
- Los servicios de integración (ej: Gemini, SharePoint, almacenamiento local) están en `services/` y se consumen desde los componentes principales.
- Utilidades y lógica de negocio se agrupan en `utils/`.
- El worker para procesamiento de Excel está en `worker/excel.worker.ts`.

## Flujos de desarrollo
- Para correr localmente: `npm install` y luego `npm run dev`.
- La clave de API para Gemini debe configurarse en `.env.local` como `GEMINI_API_KEY`.
- No hay tests automatizados detectados; si agregas tests, sigue la convención de archivos `.test.tsx`.
- El build se realiza con Vite (`npm run build`).

## Convenciones y patrones
- Los componentes React usan funciones y hooks, con tipado estricto en TypeScript.
- Los servicios se importan desde `services/` y se usan para comunicación con APIs externas y almacenamiento.
- Los estilos se gestionan con Tailwind y archivos CSS globales (`index.css`).
- Los datos y constantes globales están en `constants.tsx` y `utils/constants.tsx`.
- La comunicación entre componentes suele ser por props y callbacks; no se detecta uso de Redux/MobX.

## Integraciones y dependencias
- Gemini API: clave en `.env.local`, lógica en `services/geminiService.ts`.
- SharePoint: integración en `services/sharepointService.ts`.
- Exportación PDF: lógica en `utils/pdfExportService.ts` y componente `PDFExportCenter.tsx`.
- Email y reportes: backend en `server/services/mailer.js` y `server/services/reportGenerator.js`.

## Ejemplos de patrones clave
- Para agregar un nuevo servicio, crea el archivo en `services/` y expórtalo como función.
- Para una nueva vista, crea el componente en `components/` y agrégalo a `App.tsx`.
- Para lógica compartida, usa `utils/` y exporta funciones tipadas.

## Archivos y directorios clave
- `App.tsx`, `index.tsx`: punto de entrada y enrutamiento principal.
- `components/`: vistas y módulos funcionales.
- `services/`: integración con APIs y almacenamiento.
- `server/`: lógica backend y servicios.
- `utils/`: utilidades y lógica de negocio.
- `worker/`: procesamiento en segundo plano.

---

Actualiza estas instrucciones si cambian los patrones o la arquitectura. Si algo no está claro, pregunta por detalles específicos del flujo o integración.
