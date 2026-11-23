import React from "react";

import {
  Sparkles,
  UploadCloud,
  ShieldCheck,
  Activity,
} from "lucide-react";


interface HeaderProps {
  /**
   * 기존 App.tsx 호환을 위해 optional로 남겨둡니다.
   * Header에서는 기간을 임의 선택하지 않습니다.
   */
  currentPeriod?: string;

  onPeriodChange?: (
    period: string
  ) => void;

  /**
   * 기존 샘플 데이터 callback도
   * App.tsx 정리 전까지 타입 호환용으로만 유지합니다.
   *
   * Header에서는 사용하지 않습니다.
   */
  onLoadSampleData?: () => void;


  /**
   * 실제 데이터 업로드 화면으로 이동
   */
  onOpenUpload?: () => void;


  /**
   * 전체 AI 분석
   */
  onRunFullAnalysis:
    () => void;


  isAnalyzing:
    boolean;


  activeMenu:
    string;


  onOpenPrivacyModal?:
    () => void;


  /**
   * 실제 업로드된 분석대상 존재 여부
   *
   * 데이터가 없으면 전체 자동 분석 버튼 비활성화
   */
  hasData?: boolean;
}


export const Header:
  React.FC<
    HeaderProps
  > = ({
    currentPeriod,
    onOpenUpload,
    onRunFullAnalysis,
    isAnalyzing,
    onOpenPrivacyModal,
    hasData = true,
  }) => {

    /**
     * ========================================================
     * 평가기간 표시
     * ========================================================
     *
     * 사용자가 임의로 기간을 선택하지 않습니다.
     *
     * 실제 Excel에서 기간을 탐지했을 때만 표시하고,
     * 없으면 "업로드 데이터 기준"으로 표시합니다.
     */

    const periodLabel =
      currentPeriod &&
      currentPeriod.trim()
        ? currentPeriod
        : "업로드 데이터 기준";


    return (
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-6 shadow-2xs">

        {/* ===================================================
            LEFT
        ==================================================== */}

        <div className="flex min-w-0 items-center gap-3">

          {/* =================================================
              Product Identity
          ================================================== */}

          <div className="flex min-w-0 items-center gap-2.5">

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#243B53] text-white shadow-xs">

              <Activity className="h-4 w-4" />

            </div>


            <div className="min-w-0">

              <h1 className="truncate text-sm font-bold leading-tight tracking-tight text-[#1E293B]">
                환자경험평가(CX) & VOC 종합 분석 시스템
              </h1>

              <p className="truncate text-[11px] font-medium text-[#64748B]">
                Hospital CX Intelligence & Quality Improvement Platform
              </p>

            </div>

          </div>


          {/* =================================================
              Evaluation Period
          ================================================== */}

          <div className="ml-4 hidden items-center gap-2 border-l border-[#EEF1F4] pl-4 lg:flex">

            <span className="text-[11px] font-medium text-[#64748B]">
              평가기간
            </span>


            <span className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold text-[#334155]">

              {periodLabel}

            </span>

          </div>

        </div>


        {/* ===================================================
            RIGHT
        ==================================================== */}

        <div className="flex shrink-0 items-center gap-2">

          {/* =================================================
              Privacy
          ================================================== */}

          <button
            type="button"
            onClick={
              onOpenPrivacyModal
            }
            className="hidden items-center gap-1.5 rounded-lg border border-[#C7E6D7] bg-[#EBF5F0] px-2.5 py-1.5 text-xs font-semibold text-[#2E7D5B] transition-colors hover:bg-[#DDF0E6] sm:inline-flex"
            title="개인정보 보호 및 비식별화 안내"
          >

            <ShieldCheck className="h-3.5 w-3.5" />

            <span>
              개인정보 안심 필터
            </span>

          </button>


          {/* =================================================
              Upload
          ================================================== */}

          <button
            type="button"
            onClick={
              onOpenUpload
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#334155] shadow-2xs transition-colors hover:border-[#CBD5E1] hover:bg-[#F8F9FA]"
          >

            <UploadCloud className="h-3.5 w-3.5 text-[#64748B]" />

            <span>
              데이터 업로드
            </span>

          </button>


          {/* =================================================
              Full AI Analysis
          ================================================== */}

          <button
            type="button"
            onClick={
              onRunFullAnalysis
            }
            disabled={
              isAnalyzing ||
              !hasData
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
            title={
              !hasData
                ? "먼저 데이터를 업로드해주세요."
                : "현재 선택된 분석대상에 대해 AI 분석을 실행합니다."
            }
          >

            <Sparkles
              className={`h-3.5 w-3.5 text-blue-200 ${
                isAnalyzing
                  ? "animate-pulse"
                  : ""
              }`}
            />

            <span>
              {isAnalyzing
                ? "AI 분석 진행 중..."
                : "전체 자동 분석 실행"}
            </span>

          </button>

        </div>

      </header>
    );
  };