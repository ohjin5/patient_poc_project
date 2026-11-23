import React from "react";
import { StatusCategory, RiskLevel } from "../../types";

export const StatusBadge: React.FC<{ status: StatusCategory; size?: "sm" | "md" }> = ({
  status,
  size = "md",
}) => {
  const styles: Record<StatusCategory, { bg: string; text: string; dot: string }> = {
    위험: {
      bg: "bg-[#FDF2F2] border-[#F6D3D3]",
      text: "text-[#B94A48] font-bold",
      dot: "bg-[#B94A48]",
    },
    개선필요: {
      bg: "bg-[#FEF8EC] border-[#F9E7C4]",
      text: "text-[#B87A24] font-semibold",
      dot: "bg-[#B87A24]",
    },
    관찰: {
      bg: "bg-[#F1F5F9] border-[#E2E8F0]",
      text: "text-[#475569] font-medium",
      dot: "bg-[#64748B]",
    },
    양호: {
      bg: "bg-[#EBF5F0] border-[#C7E6D7]",
      text: "text-[#2E7D5B] font-semibold",
      dot: "bg-[#2E7D5B]",
    },
  };

  const current = styles[status] || styles["관찰"];
  const sizeStyle = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-md border tracking-tight ${sizeStyle} ${current.bg} ${current.text}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {status}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: RiskLevel; size?: "sm" | "md" }> = ({
  priority,
  size = "md",
}) => {
  const config = {
    CRITICAL: {
      label: "Critical",
      style: "bg-[#FDF2F2] text-[#B94A48] border border-[#F6D3D3] font-bold",
    },
    HIGH: {
      label: "High",
      style: "bg-[#FEF3EC] text-[#B85D19] border border-[#FCDCC8] font-semibold",
    },
    MEDIUM: {
      label: "Medium",
      style: "bg-[#FEF8EC] text-[#B87A24] border border-[#F9E7C4] font-medium",
    },
    LOW: {
      label: "Low",
      style: "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] font-medium",
    },
    NORMAL: {
      label: "Normal",
      style: "bg-[#EBF5F0] text-[#2E7D5B] border border-[#C7E6D7] font-medium",
    },
  };

  const current = config[priority] || config.NORMAL;
  const sizeStyle = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs";

  return (
    <span className={`inline-flex items-center rounded-md ${sizeStyle} ${current.style}`}>
      {current.label}
    </span>
  );
};

export const ScoreDelta: React.FC<{ delta: number; showZero?: boolean; className?: string }> = ({
  delta,
  showZero = true,
  className = "",
}) => {
  if (delta === 0 && !showZero) return null;

  const isPositive = delta > 0;
  const isNegative = delta < 0;

  const colorClass = isPositive
    ? "text-[#2E7D5B] bg-[#EBF5F0]"
    : isNegative
    ? "text-[#B94A48] bg-[#FDF2F2]"
    : "text-[#64748B] bg-[#F1F5F9]";

  return (
    <span
      className={`inline-flex items-center font-semibold px-1.5 py-0.5 rounded text-xs tabular-nums ${colorClass} ${className}`}
    >
      {isPositive ? `▲ +${delta.toFixed(1)}` : isNegative ? `▼ ${Math.abs(delta).toFixed(1)}` : "― 0.0"}
    </span>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl";
}> = ({ isOpen, onClose, title, children, maxWidth = "2xl" }) => {
  if (!isOpen) return null;

  const maxWMap = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-xs">
      <div
        className={`w-full ${maxWMap[maxWidth]} rounded-xl border border-[#E2E8F0] bg-white shadow-xl`}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-[#EEF1F4] px-5 py-3.5 bg-[#F8F9FA]">
          <h3 className="text-sm font-bold text-[#1E293B]">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[#64748B] hover:bg-[#EEF2F6] hover:text-[#1E293B] transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
