# assets/kpi-cards

Estos archivos son placeholders de ejemplo para una tarjeta KPI comparativa.

Incluye:
- `kpi-card.svg` — SVG editable con título, valor, cambio porcentual y una mini-sparkline.
- `kpi-card.png` — placeholder PNG (1x1). Reemplazar por un PNG exportado si se necesita.
- `KpiCard.tsx` (fuera de esta carpeta) — componente React de ejemplo que importa el SVG y muestra el valor con estilos Tailwind.

Uso sugerido en Vite + React:
- Importar SVG con `import kpiSvgUrl from '/src/assets/kpi-cards/kpi-card.svg?url'`
- Mostrarlo como imagen de fondo o `<img>` y renderizar valores dinámicos por encima si lo prefieres.

¿Deseas que suba estos archivos al repo y abra un PR con la nueva carpeta `assets/kpi-cards/`?
