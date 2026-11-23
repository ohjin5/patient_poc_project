import React, { useState } from "react";
import {
  X,
  BookOpen,
  HelpCircle,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Target,
  Users,
  Percent,
  Sliders,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { CriteriaConfig } from "../../types";

interface CriteriaGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCriteria: CriteriaConfig;
  onApplyPreset: (preset: CriteriaConfig) => void;
}

export const PRESET_SCENARIOS: {
  id: string;
  name: string;
  badge: string;
  description: string;
  targetSituation: string;
  config: CriteriaConfig;
}[] = [
  {
    id: "broad_early_warning",
    name: "시나리오 1. 폭넓은 조기 경보 탐지 (동일 유형 기준 기본 권장)",
    badge: "OR 조건 · 동일유형 비교",
    description:
      "동일 유형 그룹(Peer Group) 내에서 취약 가능성이 있는 부서를 누락 없이 폭넓게 포착하여 사전 점검 및 모니터링을 진행하고자 할 때 가장 적합합니다.",
    targetSituation: "동일 부서 유형(병동, 외래, 검사실 등) 내 상대적 취약 단위 조기 경보 및 사전 예방적 QI 활동",
    config: {
      enableAbsoluteScore: true,
      absoluteScoreThreshold: 80.0,
      enableScoreDrop: true,
      scoreDropThreshold: -3.0,
      benchmarkTarget: "PEER_GROUP",
      enableGap: true,
      gapThreshold: -4.0,
      enableHospitalAvgGap: true,
      hospitalAvgGapThreshold: -4.0,
      enableBottomPercentile: false,
      bottomPercentileThreshold: 25,
      minSampleSize: 10,
      minPeerGroupSize: 5,
      combinationLogic: "OR",
    },
  },
  {
    id: "strict_focus",
    name: "시나리오 2. 핵심 집중 관리 대상 엄격 선별",
    badge: "AND 조건 · 고위험군",
    description:
      "모든 조건(절대점수 저조 + 급격한 하락 + 동일 유형 평균 대비 심한 격차)을 동시에 만족하는 최우선 개선 부서만 엄격히 추려냅니다.",
    targetSituation: "QI 자원이 한정되어 있어 가장 시급한 핵심 부서에만 집중 개선 활동을 투입할 때",
    config: {
      enableAbsoluteScore: true,
      absoluteScoreThreshold: 78.0,
      enableScoreDrop: true,
      scoreDropThreshold: -4.0,
      benchmarkTarget: "PEER_GROUP",
      enableGap: true,
      gapThreshold: -5.0,
      enableHospitalAvgGap: true,
      hospitalAvgGapThreshold: -5.0,
      enableBottomPercentile: false,
      bottomPercentileThreshold: 20,
      minSampleSize: 15,
      minPeerGroupSize: 5,
      combinationLogic: "AND",
    },
  },
  {
    id: "rapid_drop_focus",
    name: "시나리오 3. 최근 급격 하락 부서 중심 모니터링",
    badge: "하락폭 특화 · 추세 분석",
    description:
      "절대점수는 비교적 양호하더라도 이전 평가 대비 점수가 가파르게 떨어진 부서를 집중적으로 찾아내어 원인을 분석합니다.",
    targetSituation: "최근 인력 교체, 시설 공사, 프로세스 변경 등으로 일시적 품질 저하가 의심되는 부서 파악",
    config: {
      enableAbsoluteScore: true,
      absoluteScoreThreshold: 82.0,
      enableScoreDrop: true,
      scoreDropThreshold: -3.5,
      benchmarkTarget: "PEER_GROUP",
      enableGap: false,
      gapThreshold: -4.0,
      enableHospitalAvgGap: false,
      hospitalAvgGapThreshold: -4.0,
      enableBottomPercentile: false,
      bottomPercentileThreshold: 25,
      minSampleSize: 10,
      minPeerGroupSize: 5,
      combinationLogic: "OR",
    },
  },
];

export const CriteriaGuideDrawer: React.FC<CriteriaGuideDrawerProps> = ({
  isOpen,
  onClose,
  currentCriteria,
  onApplyPreset,
}) => {
  const [activeTab, setActiveTab] = useState<"purpose" | "logic" | "items" | "presets" | "faq">("purpose");
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof PRESET_SCENARIOS)[0]) => {
    onApplyPreset(preset.config);
    setAppliedPresetId(preset.id);
    setTimeout(() => {
      setAppliedPresetId(null);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fadeIn">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-[#D9E1EA]">
          {/* Top Header */}
          <div className="border-b border-[#E2E8F0] bg-[#243B53] px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight">취약부서 선별 규칙 설정 가이드</h2>
                  <p className="text-[11px] text-slate-300">판정 로직의 원리와 실무 설정 매뉴얼</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                title="가이드 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "purpose", label: "화면 목적" },
                { id: "logic", label: "OR / AND 결합 논리" },
                { id: "items", label: "5대 기준 상세 해설" },
                { id: "presets", label: "실무 추천 설정 (3선)" },
                { id: "faq", label: "자주 묻는 질문 (FAQ)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-white text-[#243B53] shadow-xs"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#334155]">
            {/* 1. PURPOSE TAB */}
            {activeTab === "purpose" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4.5">
                  <div className="flex items-center gap-2 font-bold text-[#243B53] text-xs mb-2">
                    <Target className="h-4 w-4" />
                    <span>이 화면의 목적 및 필요성</span>
                  </div>
                  <p className="leading-relaxed text-[#334155]">
                    본 화면은 병원 내 전체 진료과 및 병동의 환자경험평가(CX) 결과 중, 
                    <strong> “어떤 부서를 우선 개선 대상(취약부서)으로 지정할 것인가?”</strong>에 대한 
                    판정 기준과 임계값을 정밀하게 설정하는 곳입니다.
                  </p>
                  <p className="mt-2 leading-relaxed text-[#64748B]">
                    단순히 점수가 가장 낮은 부서만 줄 세우는 것이 아니라, 
                    <strong> 절대점수</strong>, <strong>전기 대비 하락폭</strong>, <strong>병원 평균과의 격차</strong>, 
                    <strong>하위 백분위 순위</strong> 등 다각도의 통계적 지표를 결합하여 실질적인 지원이 필요한 부서를 공정하게 선별합니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
                    <div className="font-bold text-[#243B53] mb-1 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ECF2F7] text-[11px] font-bold">1</span>
                      <span>신속한 조기 발견</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      점수 급락 및 환자 불만 집중 부서를 신속히 식별하여 서비스 품질 저하를 사전에 방어합니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
                    <div className="font-bold text-[#243B53] mb-1 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ECF2F7] text-[11px] font-bold">2</span>
                      <span>객관적이고 투명한 기준</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      주관적 평가를 배제하고 명확한 수치 기준을 통해 부서 간 불필요한 이견과 반발을 최소화합니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">
                    <div className="font-bold text-[#243B53] mb-1 flex items-center gap-1.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ECF2F7] text-[11px] font-bold">3</span>
                      <span>효율적 QI 자원 배분</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      한정된 질향상(QI) 인력과 개선 예산을 가장 효과가 큰 취약 부서에 집중 투입합니다.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#C7E6D7] bg-[#EBF5F0]/70 p-4 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#2E7D5B] mb-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>선별 후 연계 프로세스</span>
                  </div>
                  <p className="text-[#1E3A2F] text-[11px] leading-relaxed">
                    선별된 취약부서는 자동으로 <strong>[우선 개선 대상 관리 목록]</strong>에 등재되며, 
                    원인 분석 및 3대 맞춤형 Action Plan이 담긴 <strong>[공식 CX Feedback Report]</strong> 생성 단계로 직결됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* 2. LOGIC TAB */}
            {activeTab === "logic" && (
              <div className="space-y-5 animate-fadeIn">
                <div>
                  <h3 className="text-xs font-bold text-[#1E293B] mb-1">OR 조건 vs AND 조건 결합 논리 비교</h3>
                  <p className="text-[11px] text-[#64748B]">
                    설정된 여러 개의 세부 조건(절대점수, 하락폭, 격차 등)을 어떤 방식으로 결합할지 결정합니다.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OR Box */}
                  <div className="rounded-xl border-2 border-[#243B53] bg-[#ECF2F7]/50 p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#243B53] px-2.5 py-1 text-xs font-bold text-white">
                        OR (어느 하나라도 충족)
                      </span>
                      <span className="text-[11px] font-bold text-[#243B53]">폭넓은 탐지 (추천)</span>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-[#E2E8F0] space-y-1 text-[11px]">
                      <div className="font-bold text-[#1E293B] mb-1">동작 방식:</div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#243B53]" />
                        <span>[조건 A] 종합점수 ≤ 80점 <strong>또는</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#243B53]" />
                        <span>[조건 B] 전기 대비 ≤ -3점 하락 <strong>또는</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#243B53]" />
                        <span>[조건 C] 병원평균 대비 ≤ -4점 격차</span>
                      </div>
                      <div className="pt-1.5 border-t border-[#EEF1F4] font-bold text-[#243B53]">
                        👉 셋 중 하나만 해당되어도 취약부서로 선별!
                      </div>
                    </div>

                    <div className="text-[11px] text-[#475569] space-y-1">
                      <div><strong>장점:</strong> 취약 가능성이 있는 부서를 빠짐없이 포착하여 조기 대응 가능</div>
                      <div><strong>추천 상황:</strong> 일반적인 정기 환자경험평가 모니터링 시</div>
                    </div>
                  </div>

                  {/* AND Box */}
                  <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#64748B] px-2.5 py-1 text-xs font-bold text-white">
                        AND (모든 조건 동시 충족)
                      </span>
                      <span className="text-[11px] font-bold text-[#64748B]">엄격한 선별</span>
                    </div>

                    <div className="bg-white rounded-lg p-3 border border-[#E2E8F0] space-y-1 text-[11px]">
                      <div className="font-bold text-[#1E293B] mb-1">동작 방식:</div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
                        <span>[조건 A] 종합점수 ≤ 80점 <strong>그리고</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
                        <span>[조건 B] 전기 대비 ≤ -3점 하락 <strong>그리고</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#334155]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]" />
                        <span>[조건 C] 병원평균 대비 ≤ -4점 격차</span>
                      </div>
                      <div className="pt-1.5 border-t border-[#EEF1F4] font-bold text-[#B94A48]">
                        👉 모든 조건을 동시에 만족해야만 선별!
                      </div>
                    </div>

                    <div className="text-[11px] text-[#475569] space-y-1">
                      <div><strong>장점:</strong> 가장 심각하고 시급한 소수 고위험 부서만 정밀 타겟팅</div>
                      <div><strong>추천 상황:</strong> QI 지원 리소스가 극히 제한적이거나 특별 집중 관리 시</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. ITEMS TAB */}
            {activeTab === "items" && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h3 className="text-xs font-bold text-[#1E293B] mb-1">5대 세부 기준별 상세 해설 및 필요성</h3>
                  <p className="text-[11px] text-[#64748B]">
                    각 판정 기준의 통계적 의미와 실무에서 설정할 때 고려해야 할 핵심 포인트를 안내합니다.
                  </p>
                </div>

                {/* Item 1 */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#243B53] text-[10px] font-bold text-white">1</span>
                      <span className="font-bold text-[#1E293B] text-xs">절대점수 기준 (Absolute Score)</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#243B53] bg-[#ECF2F7] px-2 py-0.5 rounded">
                      기본 권장: ≤ 80.0점
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">📌 의미</span>
                      <span className="text-[#64748B]">해당 부서의 종합 환자경험평가 점수가 설정치 이하인 부서 선별</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">💡 왜 필요한가?</span>
                      <span className="text-[#64748B]">타 부서와의 상대 비교와 무관하게 환자 체감 만족도가 절대적으로 낮은 곳 식별</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">🔍 실무 팁</span>
                      <span className="text-[#64748B]">국가 환자경험평가 3등급/4등급 경계 점수인 80.0점을 1차 가이드라인으로 활용 권장</span>
                    </div>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#B94A48] text-[10px] font-bold text-white">2</span>
                      <span className="font-bold text-[#1E293B] text-xs">전기 대비 점수 하락폭 기준 (Score Drop)</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#B94A48] bg-[#FDF2F2] px-2 py-0.5 rounded border border-[#F6D3D3]">
                      기본 권장: ≤ -3.0점 하락
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">📌 의미</span>
                      <span className="text-[#64748B]">직전 분기/평가 대비 점수가 일정 점수 이상 가파르게 하락한 부서 선별</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">💡 왜 필요한가?</span>
                      <span className="text-[#64748B]">절대점수는 82점으로 양호해 보여도, 전기에 88점이었다면 급격한 품질 악화 신호</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">🔍 실무 팁</span>
                      <span className="text-[#64748B]">통계적 유의미한 변동 폭인 -3.0점 ~ -4.0점을 주요 경고 임계값으로 설정</span>
                    </div>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#B87A24] text-[10px] font-bold text-white">3</span>
                      <span className="font-bold text-[#1E293B] text-xs">병원 전체 평균 대비 격차 (Gap with Hospital)</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#B87A24] bg-[#FEF8EC] px-2 py-0.5 rounded border border-[#F9E7C4]">
                      기본 권장: ≤ -4.0점 미만
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">📌 의미</span>
                      <span className="text-[#64748B]">해당 부서 점수가 병원 전체 평균 수준보다 지정된 수치 이상 뒤처지는 경우</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">💡 왜 필요한가?</span>
                      <span className="text-[#64748B]">전체적인 평가 난이도나 시즌 효과를 보정하여 병원 내 상대적 취약 단위를 식별</span>
                    </div>
                    <div className="bg-[#F8F9FA] p-2 rounded-lg border border-[#EEF1F4]">
                      <span className="font-bold text-[#1E293B] block mb-0.5">🔍 실무 팁</span>
                      <span className="text-[#64748B]">병원 평균이 83점일 때 79점 이하인 부서를 감지하도록 -4.0점 전후로 권장</span>
                    </div>
                  </div>
                </div>

                {/* Item 4 & 5 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-1.5">
                      <span className="font-bold text-[#1E293B]">4. 하위 백분위 순위</span>
                      <span className="font-mono text-[10px] font-bold text-[#243B53] bg-[#ECF2F7] px-1.5 py-0.5 rounded">하위 25%</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      절대점수와 무관하게 병원 내 상대 순위가 하위 N%에 머무는 부서를 일괄 관리군으로 지정할 때 사용합니다.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-1.5">
                      <span className="font-bold text-[#1E293B]">5. 최소 신뢰 표본수 (N)</span>
                      <span className="font-mono text-[10px] font-bold text-[#334155] bg-[#F8F9FA] border border-[#E2E8F0] px-1.5 py-0.5 rounded">N ≥ 10명</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      응답자 수가 너무 적은 부서(예: 1~2명)는 1건의 극단적 불만만으로도 점수가 왜곡되므로 최소 표본 미달 시 선별에서 제외합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. PRESETS TAB */}
            {activeTab === "presets" && (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <h3 className="text-xs font-bold text-[#1E293B] mb-1">상황별 실무 추천 설정 시나리오 (원클릭 적용)</h3>
                  <p className="text-[11px] text-[#64748B]">
                    각 병원의 QI 운영 방침에 맞게 검증된 프리셋을 바로 적용해보세요.
                  </p>
                </div>

                <div className="space-y-3">
                  {PRESET_SCENARIOS.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-2.5 shadow-2xs hover:border-[#243B53] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1E293B]">{scenario.name}</span>
                          <span className="rounded-md bg-[#ECF2F7] px-2 py-0.5 text-[10px] font-bold text-[#243B53]">
                            {scenario.badge}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectPreset(scenario)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] hover:bg-[#1B2F44] px-3 py-1.5 text-xs font-bold text-white transition-colors shadow-xs"
                        >
                          {appliedPresetId === scenario.id ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7D5B]" />
                              <span>적용 완료!</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 text-slate-300" />
                              <span>이 설정 적용하기</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-[11px] text-[#64748B] leading-relaxed">{scenario.description}</p>

                      <div className="rounded-lg bg-[#F8F9FA] p-2.5 border border-[#EEF1F4] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#334155]">
                        <div>
                          <strong>논리:</strong> <span className="text-[#243B53] font-bold">{scenario.config.combinationLogic}</span>
                        </div>
                        <div>
                          <strong>절대점수:</strong> ≤ {scenario.config.absoluteScoreThreshold}점
                        </div>
                        <div>
                          <strong>하락폭:</strong> ≤ {scenario.config.scoreDropThreshold}점
                        </div>
                        <div>
                          <strong>병원평균 격차:</strong> ≤ {scenario.config.hospitalAvgGapThreshold}점
                        </div>
                        <div>
                          <strong>최소표본:</strong> ≥ {scenario.config.minSampleSize}명
                        </div>
                      </div>

                      <div className="text-[10px] text-[#94A3B8]">
                        <strong>권장 상황:</strong> {scenario.targetSituation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. FAQ TAB */}
            {activeTab === "faq" && (
              <div className="space-y-3 animate-fadeIn">
                <div>
                  <h3 className="text-xs font-bold text-[#1E293B] mb-1">자주 묻는 질문 (FAQ)</h3>
                  <p className="text-[11px] text-[#64748B]">
                    실무 담당자들이 가장 많이 궁금해하는 질문과 명쾌한 답변입니다.
                  </p>
                </div>

                {[
                  {
                    q: "Q1. 절대점수 기준과 병원 평균 대비 격차 기준은 무엇이 다른가요?",
                    a: "절대점수 기준은 해당 부서의 현재 점수 그 자체(예: 80점 이하)를 평가하는 것이며, 병원 평균 대비 격차는 병원 전체 수준과 비교하여 상대적으로 얼마나 뒤처지는지를 평가합니다. 예를 들어 병원 전체 평균이 85점으로 높을 때는 81점 부서도 평균 대비 -4점 뒤처져 취약 부서로 식별될 수 있습니다.",
                  },
                  {
                    q: "Q2. OR 조건과 AND 조건 중 어떤 것을 써야 하나요?",
                    a: "일반적인 분기별 QI 상시 모니터링에서는 누락 없이 조기에 문제를 감지할 수 있는 'OR 조건'을 강력히 권장합니다. 반면, 개선 지원 인력이나 예산이 극도로 한정되어 있어 가장 긴급한 최우선 1~2개 부서만 선별해야 할 때는 'AND 조건'을 사용합니다.",
                  },
                  {
                    q: "Q3. 표본수(응답자 수)가 적은 부서는 왜 분석에서 제외되나요?",
                    a: "응답 환자가 1~3명인 부서는 우연히 발생한 1건의 악성 민원이나 특이 응답으로 인해 점수가 50~60점대로 급락할 수 있습니다. 이는 부서의 일반적 서비스 수준을 대표하지 못하므로, 통계적 신뢰성을 확보하기 위해 최소 표본수(권장: 10명 이상) 필터를 적용합니다.",
                  },
                  {
                    q: "Q4. 선별된 취약부서는 피드백 리포트에 어떻게 연결되나요?",
                    a: "취약부서로 선별되면 시스템이 즉시 해당 부서의 6대 영역 점수 하락 요인과 주관식 환자 불만 VOC를 AI로 교차 분석하여 근본 원인을 진단하고, 실현 가능한 부서 맞춤형 3대 Action Plan을 담은 공식 Word 보고서를 자동으로 작성해줍니다.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs space-y-1.5">
                    <div className="font-bold text-[#243B53] text-xs">{item.q}</div>
                    <p className="text-[11px] text-[#475569] leading-relaxed pl-2 border-l-2 border-[#243B53]">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="border-t border-[#EEF1F4] bg-[#F8F9FA] px-6 py-3.5 flex items-center justify-between">
            <span className="text-[11px] text-[#64748B]">
              현재 설정: <strong>{currentCriteria.combinationLogic} 조건</strong> · 활성 조건{" "}
              <strong>
                {[
                  currentCriteria.enableAbsoluteScore,
                  currentCriteria.enableScoreDrop,
                  currentCriteria.enableHospitalAvgGap,
                  currentCriteria.enableBottomPercentile,
                ].filter(Boolean).length}
                개
              </strong>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#243B53] hover:bg-[#1B2F44] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              가이드 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
