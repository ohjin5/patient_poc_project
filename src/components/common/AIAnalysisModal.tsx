import React from "react";
import { Sparkles, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";

interface AIAnalysisModalProps {
  isOpen: boolean;
  currentStep: number;
  stepMessage: string;
  progressPercent: number;
}

const PIPELINE_STEPS = [
  "데이터 정합성 검증 및 개인정보 비식별화",
  "6대 평가영역 및 세부 문항 통계 산출",
  "취약부서 자동 선별 및 우선순위(Priority) 산정",
  "VOC 주관식 의견 의미·감성 분석 및 키워드 추출",
  "점수 하락 항목 ↔ VOC 교차 원인 매칭 진단",
  "부서 맞춤형 3대 개선 Action Plan 수립",
  "부서 배부용 최종 CX Feedback Sheet 조판",
];

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen,
  currentStep,
  stepMessage,
  progressPercent,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">병원 CX & VOC 지능형 분석 파이프라인 가동</h3>
            <p className="text-xs text-slate-400">
              Deterministic 통계 엔진과 Gemini AI가 협력하여 분석을 수행합니다.
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-400">{stepMessage}</span>
            <span className="font-mono font-bold text-slate-300">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="mt-5 space-y-2.5 text-xs">
          {PIPELINE_STEPS.map((name, idx) => {
            const stepNum = idx + 1;
            const isDone = currentStep > stepNum;
            const isRunning = currentStep === stepNum;

            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded px-3 py-2 transition-all ${
                  isRunning
                    ? "bg-blue-950/80 border border-blue-700 text-white font-semibold"
                    : isDone
                    ? "bg-slate-800/40 text-slate-300"
                    : "text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] text-slate-400">0{stepNum}</span>
                  <span>{name}</span>
                </div>

                {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                {isRunning && <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>의료 데이터 보안 준수: 모든 주관식 의견은 비식별화 처리 후 안전하게 분석됩니다.</span>
        </div>
      </div>
    </div>
  );
};
