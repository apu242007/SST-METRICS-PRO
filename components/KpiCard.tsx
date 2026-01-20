import React from "react";
import kpiSvgUrl from "../assets/kpi-cards/kpi-card.svg?url";

type Props = {
  title?: string;
  value?: string | number;
  change?: string;
  positive?: boolean;
  className?: string;
};

/**
 * Componente KpiCard
 * Usa TailwindCSS para el layout y el SVG como fondo decorativo.
 * Está pensado para Vite + React + TypeScript.
 */
export const KpiCard: React.FC<Props> = ({
  title = "Incidentes",
  value = "124",
  change = "-12.3%",
  positive = false,
  className = "",
}) => {
  const changeColor = positive ? "text-green-500" : "text-red-500";
  const arrow = positive ? "▲" : "▼";

  return (
    <div className={`relative w-full max-w-xs bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* SVG de fondo / decoración */}
      <img src={kpiSvgUrl} alt={`${title} kpi background`} className="w-full h-44 object-cover pointer-events-none" />

      {/* Contenido encima del SVG */}
      <div className="p-4 -mt-28 relative">
        <p className="text-sm text-gray-600">{title}</p>
        <div className="flex items-baseline gap-3">
          <p className="text-4xl font-extrabold text-slate-900">{value}</p>
          <p className={`text-sm font-medium ${changeColor} flex items-center`} aria-hidden>
            <span className="mr-1">{arrow}</span>
            {change}
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-3">Comparado con periodo anterior</p>
      </div>
    </div>
  );
};

export default KpiCard;
