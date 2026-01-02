
import React, { useMemo, useState } from 'react';
import { Incident, BodyZone } from '../types';
import { calculateBodyZoneTotals } from '../utils/calculations';
import { Download } from 'lucide-react';

interface BodyMapProps {
  incidents?: Incident[]; // Filtered set for accumulated view
  highlightedZones?: BodyZone[]; // Legacy prop for single view
  mode?: 'heatmap' | 'individual';
}

const ZONE_LABELS: Record<string, string> = {
    'head': 'Cabeza / Rostro',
    'neck': 'Cuello / Cervical',
    'chest': 'Tórax / Pecho',
    'abdomen': 'Abdomen',
    'back_upper': 'Espalda Superior',
    'back_lower': 'Zona Lumbar',
    'hip': 'Cadera / Pelvis',
    'shoulder_left': 'Hombro Izq.',
    'shoulder_right': 'Hombro Der.',
    'arm_left': 'Brazo Izq.',
    'arm_right': 'Brazo Der.',
    'hand_left': 'Mano/Dedos Izq.',
    'hand_right': 'Mano/Dedos Der.',
    'leg_left': 'Pierna Izq.',
    'leg_right': 'Pierna Der.',
    'knee_left': 'Rodilla Izq.',
    'knee_right': 'Rodilla Der.',
    'foot_left': 'Pie/Tobillo Izq.',
    'foot_right': 'Pie/Tobillo Der.',
    'general': 'Cuerpo General',
    'unknown': 'Zona No Configurada'
};

export const BodyMap: React.FC<BodyMapProps> = ({ incidents = [], highlightedZones = [], mode = 'heatmap' }) => {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);

  // 1. Calculate REAL Totals
  const zoneTotals = useMemo<Record<string, number>>(() => {
      if (mode === 'individual') {
          // Mock totals for single view
          const t: Record<string, number> = {};
          highlightedZones.forEach(z => t[z] = 1);
          return t;
      }
      return calculateBodyZoneTotals(incidents);
  }, [incidents, highlightedZones, mode]);

  // 2. Prepare Table Data
  const sortedTableData = useMemo(() => {
      const entries = Object.entries(zoneTotals) as [string, number][];
      return entries
          .filter(([_, count]) => count > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([zone, count]) => ({
              zone: zone as BodyZone,
              label: ZONE_LABELS[zone] || zone,
              count
          }));
  }, [zoneTotals]);

  // 3. Color Logic (Thresholds)
  const getFillColor = (zone: BodyZone) => {
      const count = zoneTotals[zone] || 0;
      
      if (count === 0) return '#e2e8f0'; // Neutral (Slate-200)
      if (mode === 'individual') return '#ef4444'; // Red for highlight

      // Heatmap Thresholds
      if (count <= 2) return '#fcd34d'; // Low (Amber-300)
      if (count <= 5) return '#fb923c'; // Medium (Orange-400)
      return '#ef4444'; // High (Red-500)
  };

  // 4. Interaction
  const handleMouseEnter = (e: React.MouseEvent, zone: BodyZone) => {
      const count = zoneTotals[zone] || 0;
      const label = ZONE_LABELS[zone] || zone;
      if (count > 0 || mode === 'individual') {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltip({
              x: rect.left + window.scrollX + (rect.width / 2),
              y: rect.top + window.scrollY - 10,
              text: `${label}: ${count} Lesiones`
          });
      }
  };

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const commonPathProps = (zone: BodyZone) => ({
      fill: getFillColor(zone),
      stroke: "#94a3b8",
      strokeWidth: "1.5",
      className: "transition-colors duration-300 cursor-pointer hover:opacity-80",
      onMouseEnter: (e: React.MouseEvent) => handleMouseEnter(e, zone),
      onMouseLeave: handleMouseLeave,
      "data-zone": zone,
      "data-total": zoneTotals[zone] || 0
  });

  return (
    <div className="flex flex-col md:flex-row h-full w-full gap-4">
      
      {/* LEFT: VISUAL MAP */}
      <div className="flex-1 bg-white border border-gray-100 rounded-xl relative flex justify-center items-center py-4 min-h-[300px]">
          {/* Tooltip */}
          {tooltip && (
              <div 
                className="fixed z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full font-bold whitespace-nowrap"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                  {tooltip.text}
              </div>
          )}

          <div className="flex justify-center gap-8 h-full w-full">
            {/* --- FRONT VIEW --- */}
            <div className="relative h-full w-32 flex flex-col items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase mb-2">Frente</span>
                <svg viewBox="0 0 200 500" className="h-full w-full overflow-visible">
                    <path d="M70,50 Q100,20 130,50 Q130,80 100,90 Q70,80 70,50" {...commonPathProps('head')} />
                    <path d="M85,90 L115,90 L120,110 L80,110 Z" {...commonPathProps('neck')} />
                    <path d="M60,110 L140,110 L135,180 L65,180 Z" {...commonPathProps('chest')} />
                    <path d="M65,180 L135,180 L130,240 L70,240 Z" {...commonPathProps('abdomen')} />
                    <path d="M70,240 L130,240 L140,280 L60,280 Z" {...commonPathProps('hip')} />
                    
                    <path d="M60,110 L40,130 L65,140 L65,115 Z" {...commonPathProps('shoulder_right')} />
                    <path d="M140,110 L160,130 L135,140 L135,115 Z" {...commonPathProps('shoulder_left')} />

                    <path d="M40,130 L30,200 L50,200 L65,140 Z" {...commonPathProps('arm_right')} />
                    <path d="M160,130 L170,200 L150,200 L135,140 Z" {...commonPathProps('arm_left')} />
                    
                    <path d="M30,200 L25,240 L55,240 L50,200 Z" {...commonPathProps('hand_right')} />
                    <path d="M170,200 L175,240 L145,240 L150,200 Z" {...commonPathProps('hand_left')} />

                    <path d="M60,280 L95,280 L90,380 L65,380 Z" {...commonPathProps('leg_right')} />
                    <path d="M140,280 L105,280 L110,380 L135,380 Z" {...commonPathProps('leg_left')} />

                    <circle cx="77" cy="390" r="12" {...commonPathProps('knee_right')} />
                    <circle cx="123" cy="390" r="12" {...commonPathProps('knee_left')} />

                    <path d="M65,405 L90,405 L85,470 L70,470 Z" {...commonPathProps('leg_right')} />
                    <path d="M135,405 L110,405 L115,470 L130,470 Z" {...commonPathProps('leg_left')} />

                    <path d="M70,470 L85,470 L95,490 L60,490 Z" {...commonPathProps('foot_right')} />
                    <path d="M130,470 L115,470 L105,490 L140,490 Z" {...commonPathProps('foot_left')} />
                </svg>
            </div>

            {/* --- BACK VIEW --- */}
            <div className="relative h-full w-32 flex flex-col items-center border-l border-dashed border-gray-200 pl-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase mb-2">Espalda</span>
                <svg viewBox="0 0 200 500" className="h-full w-full overflow-visible">
                    <path d="M70,50 Q100,20 130,50 Q130,80 100,90 Q70,80 70,50" {...commonPathProps('head')} />
                    <path d="M85,90 L115,90 L120,110 L80,110 Z" {...commonPathProps('neck')} />
                    <path d="M60,110 L140,110 L135,180 L65,180 Z" {...commonPathProps('back_upper')} />
                    <path d="M65,180 L135,180 L130,240 L70,240 Z" {...commonPathProps('back_lower')} />
                    <path d="M70,240 L130,240 L140,280 L60,280 Z" {...commonPathProps('hip')} />

                    <path d="M60,110 L40,130 L65,140 L65,115 Z" {...commonPathProps('shoulder_left')} />
                    <path d="M140,110 L160,130 L135,140 L135,115 Z" {...commonPathProps('shoulder_right')} />

                    <path d="M40,130 L30,200 L50,200 L65,140 Z" {...commonPathProps('arm_left')} />
                    <path d="M160,130 L170,200 L150,200 L135,140 Z" {...commonPathProps('arm_right')} />

                    <path d="M30,200 L25,240 L55,240 L50,200 Z" {...commonPathProps('hand_left')} />
                    <path d="M170,200 L175,240 L145,240 L150,200 Z" {...commonPathProps('hand_right')} />

                    <path d="M60,280 L95,280 L90,380 L65,380 Z" {...commonPathProps('leg_left')} />
                    <path d="M140,280 L105,280 L110,380 L135,380 Z" {...commonPathProps('leg_right')} />
                    
                    <path d="M65,385 L90,385 L85,470 L70,470 Z" {...commonPathProps('leg_left')} />
                    <path d="M135,385 L110,385 L115,470 L130,470 Z" {...commonPathProps('leg_right')} />
                    
                    <path d="M70,470 L85,470 L95,490 L60,490 Z" {...commonPathProps('foot_left')} />
                    <path d="M130,470 L115,470 L105,490 L140,490 Z" {...commonPathProps('foot_right')} />
                </svg>
            </div>
          </div>
      </div>

      {/* RIGHT: SUMMARY TABLE (Only in Heatmap Mode) */}
      {mode === 'heatmap' && (
          <div className="w-full md:w-48 bg-gray-50 rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[400px]">
              <div className="p-3 border-b border-gray-200 bg-white font-bold text-xs text-gray-700 flex justify-between items-center">
                  <span>Totales ({sortedTableData.length})</span>
                  <span className="text-[10px] text-gray-400">Top 2025</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                  {sortedTableData.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 italic">Sin datos</div>
                  ) : (
                      <table className="w-full text-xs">
                          <tbody>
                              {sortedTableData.map((row, i) => (
                                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-white">
                                      <td className="p-2 text-gray-600 truncate max-w-[120px]" title={row.label}>
                                          {row.zone === 'unknown' ? <span className="text-red-500 font-bold">{row.label}</span> : row.label}
                                      </td>
                                      <td className="p-2 text-right font-mono font-bold text-gray-800 bg-gray-100/50">
                                          {row.count}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
              
              {/* Legend Footer */}
              <div className="p-2 border-t border-gray-200 bg-white text-[10px] space-y-1">
                  <div className="flex items-center"><span className="w-2 h-2 rounded bg-amber-300 mr-2"></span> 1-2 (Bajo)</div>
                  <div className="flex items-center"><span className="w-2 h-2 rounded bg-orange-400 mr-2"></span> 3-5 (Medio)</div>
                  <div className="flex items-center"><span className="w-2 h-2 rounded bg-red-500 mr-2"></span> 6+ (Alto)</div>
              </div>
          </div>
      )}
    </div>
  );
};
