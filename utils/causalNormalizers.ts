/**
 * causalNormalizers.ts
 * Normalization helpers for causal/ART fields read from Excel.
 * These functions are pure and stateless — safe to call on every render.
 *
 * Rules (from domain spec):
 *  - Sí/No: "Si"|"Sí"|"SI" → "Sí"  |  "No"|"NO" → "No"  |  rest → "No aplica"
 *  - Instalaciones: "Propias*" → "Propias" | "Del cliente*" → "Del cliente" | rest → "No aplica"
 *  - Factor Humano: empty/noisy → "No aplica" | descriptive text → categorized bucket
 *  - Forma Ocurrencia: preserved as-is, truncated only for display labels
 *  - Gravedad: prioritise art_gravedad; fall back to naturaleza_lesion
 */

import type { Incident } from '../types';

// ─── Sí / No ────────────────────────────────────────────────────────────────

export function normalizeSiNo(val?: string | null): 'Sí' | 'No' | 'No aplica' {
  if (!val) return 'No aplica';
  const v = val.trim().toLowerCase();
  if (v === 'si' || v === 'sí' || v === 'yes' || v === 's') return 'Sí';
  if (v === 'no') return 'No';
  // "no aplica", "no aplica", "n/a", "na", "-", whitespace only
  return 'No aplica';
}

// ─── Instalaciones ──────────────────────────────────────────────────────────

export function normalizeInstalacion(val?: string | null): 'Propias' | 'Del cliente' | 'No aplica' {
  if (!val) return 'No aplica';
  const v = val.trim().toLowerCase();
  if (v.startsWith('propias')) return 'Propias';
  if (v.startsWith('del cliente')) return 'Del cliente';
  // "no aplica", "no aplica", empty variants
  return 'No aplica';
}

// ─── Factor Humano ──────────────────────────────────────────────────────────

/**
 * Maps a free-text Factor Humano to one of 9 standard buckets.
 * Returns the bucket label (used as chart category).
 */
export function categorizeFactorHumano(val?: string | null): string {
  if (!val) return 'No aplica';
  const v = val.trim().toLowerCase();

  // Noise / empty equivalents
  if (
    v === '' || v === '-' || v === 'n/a' || v === 'na' ||
    v === 'no' || v === 'no aplica' || v === 'no aplica'
  ) return 'No aplica';

  // Pattern matching — order matters (most specific first)
  if (/sobreesfuerzo|esfuerzo excesiv/.test(v)) return 'Sobreesfuerzo';
  if (/no (uso|utiliz|us[oó]) (de )?epp|sin epp|falta (de )?epp/.test(v)) return 'No uso EPP';
  if (/exceso de confianza|exceso confianza/.test(v)) return 'Exceso de confianza';
  if (/posici[oó]n|posicionamiento/.test(v)) return 'Posicionamiento inadecuado';
  if (/manipulaci[oó]n|manejo deficiente|manejo inadecuado/.test(v)) return 'Manipulación inadecuada';
  if (/falta de atenci|distrae|distracción|falta atenci/.test(v)) return 'Falta de atención/distracción';
  if (/comunicaci[oó]n|coordinaci[oó]n/.test(v)) return 'Falta de comunicación';
  if (/l[ií]nea de fuego|exposición|exposicion/.test(v)) return 'Exposición en línea de fuego';
  if (/no respetar|incumplimiento|procedimiento/.test(v)) return 'Incumplimiento de procedimiento';

  // Has descriptive text but doesn't match a pattern
  if (v.length > 5) return 'Otros';

  return 'No aplica';
}

// ─── Display label (truncation) ─────────────────────────────────────────────

export function truncateLabel(val: string, max = 40): string {
  if (!val) return '';
  return val.length > max ? val.substring(0, max - 1) + '…' : val;
}

// ─── Consolidated Gravedad ──────────────────────────────────────────────────

/**
 * Returns the most informative severity value.
 * Prioritises art_gravedad; falls back to naturaleza_lesion; then 'Sin dato'.
 */
export function consolidateGravedad(
  artGravedad?: string | null,
  naturaleza?: string | null
): string {
  if (artGravedad && artGravedad.trim()) return artGravedad.trim();
  if (naturaleza && naturaleza.trim()) return naturaleza.trim();
  return 'Sin dato';
}

// ─── Severity colour palette ────────────────────────────────────────────────

export const GRAVEDAD_COLORS: Record<string, string> = {
  'Lesión leve': '#10b981',
  'Lesión moderada': '#f59e0b',
  'Lesión grave': '#ef4444',
  'Grave': '#ef4444',
  'Leve': '#10b981',
  'Moderada': '#f59e0b',
  'Sin dato': '#d1d5db',
};

export function gravedadColor(gravedad: string): string {
  return GRAVEDAD_COLORS[gravedad] ?? '#6366f1';
}

// ─── Batch normalizer ───────────────────────────────────────────────────────

/**
 * Returns a shallow-copied array of incidents with causal fields normalised.
 * Field values are replaced for charting purposes; original raw_json is unchanged.
 */
export function normalizeCausalIncidents(incidents: Incident[]): Incident[] {
  return incidents.map(i => ({
    ...i,
    condicion_peligrosa: normalizeSiNo(i.condicion_peligrosa),
    acto_inseguro:       normalizeSiNo(i.acto_inseguro),
    instalacion_tipo:    normalizeInstalacion(i.instalacion_tipo),
    // factor_humano categorised for aggregation; factor_humano2 combined later
    factor_humano:       categorizeFactorHumano(i.factor_humano),
    factor_humano2:      categorizeFactorHumano(i.factor_humano2),
    // Consolidated severity (used by Chart F and chart A colour)
    art_gravedad:        consolidateGravedad(i.art_gravedad, i.naturaleza_lesion),
  }));
}
