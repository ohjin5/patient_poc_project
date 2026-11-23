import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  subValue?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: LucideIcon;
  variant?: "default" | "primary" | "warning" | "danger" | "success";
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  subValue,
  delta,
  deltaLabel = "전기 대비",
  icon: Icon,
  variant = "default",
  className = "",
}) => {
  const getIconStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-[#ECF2F7] text-[#243B53]";
      case "danger":
        return "bg-[#FDF2F2] text-[#B94A48]";
      case "warning":
        return "bg-[#FEF8EC] text-[#B87A24]";
      case "success":
        return "bg-[#EBF5F0] text-[#2E7D5B]";
      default:
        return "bg-[#F1F5F9] text-[#475569]";
    }
  };

  const getCardAccent = () => {
    switch (variant) {
      case "primary":
        return "border-[#E2E8F0] border-t-2 border-t-[#243B53]";
      case "danger":
        return "border-[#E2E8F0] border-t-2 border-t-[#B94A48]";
      case "warning":
        return "border-[#E2E8F0] border-t-2 border-t-[#B87A24]";
      case "success":
        return "border-[#E2E8F0] border-t-2 border-t-[#2E7D5B]";
      default:
        return "border-[#E2E8F0]";
    }
  };

  return (
    <div
      id={id}
      className={`rounded-xl border bg-white p-5 shadow-2xs transition-all ${getCardAccent()} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#64748B]">{title}</span>
        {Icon && (
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${getIconStyles()}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-[#1E293B]">{value}</span>
        {subValue && <span className="text-[11px] text-[#64748B] font-medium">{subValue}</span>}
      </div>

      {delta !== undefined && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={`font-semibold flex items-center ${
              delta > 0 ? "text-[#2E7D5B]" : delta < 0 ? "text-[#B94A48]" : "text-[#64748B]"
            }`}
          >
            {delta > 0 ? `▲ +${delta.toFixed(1)}` : delta < 0 ? `▼ ${Math.abs(delta).toFixed(1)}` : "― 0.0"}점
          </span>
          <span className="text-[#94A3B8] text-[11px]">({deltaLabel})</span>
        </div>
      )}
    </div>
  );
};
