import React, {
  useMemo,
  useState,
} from "react";

import {
  CalendarRange,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  HelpCircle,
} from "lucide-react";

import {
  CriteriaConfig,
  DepartmentSummary,
  RawVocItem,
  UploadedFileMetadata,
  PeerGroup,
} from "../../types";

import {
  AnalysisEngine,
  PeriodComparisonChangeStatus,
  PeriodComparisonItem,
} from "../../services/analysisEngine";


/**
 * ============================================================
 * Period Dataset
 * ============================================================
 *
 * App.tsx의 PeriodDataset 구조와 동일한 shape만 요구합니다.
 * 별도 export type에 의존하지 않도록 View 내부에서 정의합니다.
 */
export interface PeriodComparisonDataset {
  id:
    string;

  mode:
    "CURRENT" | "COMPARISON";

  period:
    string;

  uploadedFiles:
    UploadedFileMetadata[];

  departments:
    DepartmentSummary[];

  vocList:
    RawVocItem[];
}


interface PeriodComparisonViewProps {
  datasets:
    PeriodComparisonDataset[];

  criteria:
    CriteriaConfig;
}


type ComparisonStatusFilter =
  | "ALL"
  | PeriodComparisonChangeStatus;


const STATUS_META:
  Record<
    PeriodComparisonChangeStatus,
    {
      label: string;
      className: string;
    }
  > = {

    NEW_VULNERABLE: {
      label:
        "신규 개선대상",
      className:
        "border-[#F6D3D3] bg-[#FDF2F2] text-[#B94A48]",
    },

    RESOLVED_VULNERABLE: {
      label:
        "개선대상 해제",
      className:
        "border-[#C7E6D7] bg-[#EBF5F0] text-[#2E7D5B]",
    },

    PERSISTENT_VULNERABLE: {
      label:
        "지속 개선대상",
      className:
        "border-[#F9E7C4] bg-[#FEF8EC] text-[#8C5E1E]",
    },

    STABLE_GENERAL: {
      label:
        "일반 유지",
      className:
        "border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B]",
    },

    NEW_UNIT: {
      label:
        "신규 분석단위",
      className:
        "border-[#D9E1EA] bg-[#ECF2F7] text-[#243B53]",
    },

    NOT_COMPARABLE: {
      label:
        "비교불가",
      className:
        "border-[#E2E8F0] bg-white text-[#94A3B8]",
    },
  };


const PEER_GROUP_ORDER:
  PeerGroup[] = [
    "INPATIENT_WARD",
    "INPATIENT_DEPARTMENT",
    "INPATIENT_DOCTOR",
    "OUTPATIENT_CENTER",
    "OUTPATIENT_DEPARTMENT",
    "OUTPATIENT_DOCTOR",
    "EMERGENCY_DEPARTMENT",
    "EMERGENCY_DOCTOR",
    "EXAM",
  ];


/**
 * ============================================================
 * Period Comparison View
 * ============================================================
 */
export const PeriodComparisonView:
  React.FC<
    PeriodComparisonViewProps
  > = ({
    datasets,
    criteria,
  }) => {

    /**
     * --------------------------------------------------------
     * 비교기간 선택
     * --------------------------------------------------------
     *
     * 기본값:
     * - 현재기간: CURRENT Dataset
     * - 이전기간: CURRENT가 아닌 Dataset 중 가장 최근 항목
     */
    const currentDataset =
      useMemo(
        () =>
          datasets.find(
            (
              dataset
            ) =>
              dataset.mode ===
              "CURRENT"
          ) ||
          datasets[
            datasets.length -
            1
          ] ||
          null,
        [
          datasets,
        ]
      );


    const comparisonCandidates =
      useMemo(
        () =>
          datasets.filter(
            (
              dataset
            ) =>
              dataset.id !==
              currentDataset?.id
          ),
        [
          datasets,
          currentDataset,
        ]
      );


    const [
      selectedPreviousId,
      setSelectedPreviousId,
    ] =
      useState<string>(
        ""
      );


    const [
      selectedCurrentId,
      setSelectedCurrentId,
    ] =
      useState<string>(
        ""
      );


    const effectiveCurrentId =
      selectedCurrentId ||
      currentDataset?.id ||
      "";


    const effectivePreviousId =
      selectedPreviousId ||
      comparisonCandidates[
        comparisonCandidates.length -
        1
      ]?.id ||
      "";


    const effectiveCurrentDataset =
      datasets.find(
        (
          dataset
        ) =>
          dataset.id ===
          effectiveCurrentId
      ) ||
      null;


    const effectivePreviousDataset =
      datasets.find(
        (
          dataset
        ) =>
          dataset.id ===
          effectivePreviousId
      ) ||
      null;


    /**
     * --------------------------------------------------------
     * 비교 결과 계산
     * --------------------------------------------------------
     */
    const comparisonResult =
      useMemo(
        () => {

          if (
            !effectiveCurrentDataset ||
            !effectivePreviousDataset ||
            effectiveCurrentDataset.id ===
              effectivePreviousDataset.id
          ) {
            return null;
          }


          return AnalysisEngine
            .buildPeriodComparison(
              effectiveCurrentDataset.departments,
              effectivePreviousDataset.departments,
              criteria,
              effectiveCurrentDataset.period,
              effectivePreviousDataset.period
            );
        },
        [
          effectiveCurrentDataset,
          effectivePreviousDataset,
          criteria,
        ]
      );


    /**
     * --------------------------------------------------------
     * 필터
     * --------------------------------------------------------
     */
    const [
      peerGroupFilter,
      setPeerGroupFilter,
    ] =
      useState<
        "ALL" | PeerGroup
      >("ALL");


    const [
      statusFilter,
      setStatusFilter,
    ] =
      useState<
        ComparisonStatusFilter
      >("ALL");


    const [
      searchKeyword,
      setSearchKeyword,
    ] =
      useState<string>(
        ""
      );


    const peerGroups =
      useMemo(
        () => {

          if (
            !comparisonResult
          ) {
            return [];
          }


          const values:
            PeerGroup[] =
              Array.from(
                new Set<PeerGroup>(
                  comparisonResult
                    .items
                    .map(
                      (
                        item
                      ) =>
                        item.peerGroup
                    )
                )
              );


          return values.sort(
            (
              a,
              b
            ) => {

              const aIndex =
                PEER_GROUP_ORDER.indexOf(
                  a
                );

              const bIndex =
                PEER_GROUP_ORDER.indexOf(
                  b
                );


              if (
                aIndex !== -1 &&
                bIndex !== -1
              ) {
                return aIndex - bIndex;
              }


              if (
                aIndex !== -1
              ) {
                return -1;
              }


              if (
                bIndex !== -1
              ) {
                return 1;
              }


              return String(
                a
              ).localeCompare(
                String(
                  b
                ),
                "ko"
              );
            }
          );
        },
        [
          comparisonResult,
        ]
      );


    const peerGroupLabels =
      useMemo(
        () => {

          const map =
            new Map<
              PeerGroup,
              string
            >();


          comparisonResult
            ?.items
            .forEach(
              (
                item
              ) => {

                if (
                  !map.has(
                    item.peerGroup
                  )
                ) {
                  map.set(
                    item.peerGroup,
                    item.peerGroupLabel
                  );
                }
              }
            );


          return map;
        },
        [
          comparisonResult,
        ]
      );


    const filteredItems =
      useMemo(
        () => {

          if (
            !comparisonResult
          ) {
            return [];
          }


          const keyword =
            searchKeyword
              .trim()
              .toLowerCase();


          return comparisonResult
            .items
            .filter(
              (
                item
              ) => {

                if (
                  peerGroupFilter !==
                    "ALL" &&
                  item.peerGroup !==
                    peerGroupFilter
                ) {
                  return false;
                }


                if (
                  statusFilter !==
                    "ALL" &&
                  item.changeStatus !==
                    statusFilter
                ) {
                  return false;
                }


                if (
                  keyword
                ) {

                  const searchText =
                    [
                      item.departmentName,
                      item.parentDepartment,
                      item.peerGroupLabel,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " "
                      )
                      .toLowerCase();


                  if (
                    !searchText.includes(
                      keyword
                    )
                  ) {
                    return false;
                  }
                }


                return true;
              }
            );
        },
        [
          comparisonResult,
          peerGroupFilter,
          statusFilter,
          searchKeyword,
        ]
      );


    /**
     * --------------------------------------------------------
     * Guard
     * --------------------------------------------------------
     */
    if (
      datasets.length <
      2
    ) {

      return (

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center shadow-2xs">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECF2F7]">

            <CalendarRange className="h-6 w-6 text-[#243B53]" />

          </div>


          <h2 className="mt-4 text-base font-bold text-[#1E293B]">
            기간 비교를 위한 데이터가 부족합니다.
          </h2>


          <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
            현재 분석기간과 비교기간을 포함해 최소 2개 이상의 Dataset이 필요합니다.
          </p>

        </div>
      );
    }


    return (

      <div className="space-y-5">

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">

            <div>

              <div className="flex items-center gap-2">

                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E1EA] bg-[#ECF2F7] px-2.5 py-1 text-[11px] font-bold text-[#243B53]">

                  <CalendarRange className="h-3.5 w-3.5" />

                  기간 비교

                </span>


                <span className="text-[11px] text-[#64748B]">
                  동일 분석단위 기준 변화 확인
                </span>

              </div>


              <h2 className="mt-2 text-lg font-bold tracking-tight text-[#1E293B]">
                환자경험 월별 비교
              </h2>


              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#64748B]">
                두 기간에 모두 존재하는 동일 분석단위의 점수·표본수·동일유형 평균 대비 Gap과
                개선대상 상태 변화를 비교합니다. 한쪽 기간에만 존재하는 항목은 신규 또는 비교불가로 표시합니다.
              </p>

            </div>


            <div className="rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-[10px] leading-relaxed text-[#64748B]">

              <div className="flex items-start gap-1.5">

                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#243B53]" />

                <span>
                  점수 변화는 조사결과의 증감이며, 통계적 유의성이나 개선활동의 인과효과를 의미하지 않습니다.
                </span>

              </div>

            </div>

          </div>

        </div>


        {/* ==================================================
            PERIOD SELECTOR
        =================================================== */}

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

          <div className="flex items-center gap-2 border-b border-[#EEF1F4] pb-3">

            <ArrowRightLeft className="h-4 w-4 text-[#243B53]" />

            <h3 className="text-xs font-bold text-[#1E293B]">
              비교기간 선택
            </h3>

          </div>


          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">

            <PeriodSelect
              label="이전기간"
              value={
                effectivePreviousId
              }
              datasets={
                datasets
              }
              excludedId={
                effectiveCurrentId
              }
              onChange={
                setSelectedPreviousId
              }
            />


            <div className="hidden items-center justify-center pb-2 md:flex">

              <ArrowRightLeft className="h-5 w-5 text-[#94A3B8]" />

            </div>


            <PeriodSelect
              label="현재기간"
              value={
                effectiveCurrentId
              }
              datasets={
                datasets
              }
              excludedId={
                effectivePreviousId
              }
              onChange={
                setSelectedCurrentId
              }
            />

          </div>

        </div>


        {comparisonResult && (

          <>

            {/* ==================================================
                SUMMARY
            =================================================== */}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">

              <SummaryCard
                label="비교 가능"
                value={`${comparisonResult.summary.comparableCount}개`}
                description="두 기간 모두 존재"
                tone="DEFAULT"
              />


              <SummaryCard
                label="신규 개선대상"
                value={`${comparisonResult.summary.newVulnerableCount}개`}
                description="일반 → 개선대상"
                tone="DANGER"
              />


              <SummaryCard
                label="지속 개선대상"
                value={`${comparisonResult.summary.persistentVulnerableCount}개`}
                description="두 기간 모두 대상"
                tone="WARNING"
              />


              <SummaryCard
                label="개선대상 해제"
                value={`${comparisonResult.summary.resolvedVulnerableCount}개`}
                description="개선대상 → 일반"
                tone="SUCCESS"
              />


              <SummaryCard
                label="신규 분석단위"
                value={`${comparisonResult.summary.newUnitCount}개`}
                description="현재기간만 존재"
                tone="INFO"
              />


              <SummaryCard
                label="평균 점수 변화"
                value={
                  comparisonResult
                    .summary
                    .averageScoreChange ===
                  null
                    ? "-"
                    : formatSigned(
                        comparisonResult
                          .summary
                          .averageScoreChange
                      )
                }
                description="비교 가능 항목 평균"
                tone={
                  comparisonResult
                    .summary
                    .averageScoreChange ===
                  null
                    ? "DEFAULT"
                    : comparisonResult
                        .summary
                        .averageScoreChange >
                      0
                    ? "SUCCESS"
                    : comparisonResult
                        .summary
                        .averageScoreChange <
                      0
                    ? "DANGER"
                    : "DEFAULT"
                }
              />

            </div>


            {/* ==================================================
                FILTER
            =================================================== */}

            <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

              <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">

                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">

                  <Filter className="h-4 w-4 shrink-0 text-[#64748B]" />

                  <span className="shrink-0 text-[11px] font-bold text-[#334155]">
                    유형:
                  </span>


                  <button
                    type="button"
                    onClick={() =>
                      setPeerGroupFilter(
                        "ALL"
                      )
                    }
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      peerGroupFilter ===
                      "ALL"
                        ? "bg-[#334155] text-white"
                        : "bg-[#F8F9FA] text-[#64748B] hover:bg-[#EEF2F6]"
                    }`}
                  >
                    전체
                  </button>


                  {peerGroups.map(
                    (
                      peerGroup
                    ) => (

                      <button
                        key={
                          peerGroup
                        }
                        type="button"
                        onClick={() =>
                          setPeerGroupFilter(
                            peerGroup
                          )
                        }
                        className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                          peerGroupFilter ===
                          peerGroup
                            ? "bg-[#334155] text-white"
                            : "bg-[#F8F9FA] text-[#64748B] hover:bg-[#EEF2F6]"
                        }`}
                      >

                        {peerGroupLabels.get(
                          peerGroup
                        ) ||
                          peerGroup}

                      </button>
                    )
                  )}

                </div>


                <input
                  type="text"
                  value={
                    searchKeyword
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setSearchKeyword(
                        event.target.value
                      )
                  }
                  placeholder="부서명 / 의사명 검색..."
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-2 text-xs text-[#1E293B] focus:border-[#243B53] focus:outline-hidden xl:w-64"
                />

              </div>


              <div className="flex items-center gap-2 overflow-x-auto border-t border-[#EEF1F4] pt-3 scrollbar-none">

                <span className="shrink-0 text-[11px] font-bold text-[#334155]">
                  상태:
                </span>


                <button
                  type="button"
                  onClick={() =>
                    setStatusFilter(
                      "ALL"
                    )
                  }
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    statusFilter ===
                    "ALL"
                      ? "bg-[#243B53] text-white"
                      : "bg-[#F8F9FA] text-[#64748B] hover:bg-[#EEF2F6]"
                  }`}
                >
                  전체
                </button>


                {(
                  Object.keys(
                    STATUS_META
                  ) as
                    PeriodComparisonChangeStatus[]
                ).map(
                  (
                    status
                  ) => (

                    <button
                      key={
                        status
                      }
                      type="button"
                      onClick={() =>
                        setStatusFilter(
                          status
                        )
                      }
                      className={`whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] font-semibold ${
                        statusFilter ===
                        status
                          ? STATUS_META[
                              status
                            ].className
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8F9FA]"
                      }`}
                    >

                      {STATUS_META[
                        status
                      ].label}

                    </button>
                  )
                )}

              </div>

            </div>


            {/* ==================================================
                TABLE
            =================================================== */}

            <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">

              <div className="flex items-center justify-between border-b border-[#EEF1F4] bg-[#F8F9FA] px-4 py-3">

                <div>

                  <h3 className="text-xs font-bold text-[#1E293B]">
                    분석단위별 변화
                  </h3>

                  <p className="mt-0.5 text-[10px] text-[#64748B]">
                    현재 필터 기준 {filteredItems.length}개
                  </p>

                </div>

              </div>


              <div className="overflow-x-auto">

                <table className="min-w-[1180px] w-full text-left text-xs">

                  <thead className="border-b border-[#EEF1F4] bg-[#F8F9FA] font-semibold text-[#64748B]">

                    <tr>

                      <th className="px-4 py-3">
                        분석단위
                      </th>

                      <th className="px-3 py-3">
                        유형
                      </th>

                      <th className="px-3 py-3 text-center">
                        상태 변화
                      </th>

                      <th className="px-3 py-3 text-right">
                        이전점수
                      </th>

                      <th className="px-3 py-3 text-right">
                        현재점수
                      </th>

                      <th className="px-3 py-3 text-right">
                        증감
                      </th>

                      <th className="px-3 py-3 text-right">
                        이전 표본
                      </th>

                      <th className="px-3 py-3 text-right">
                        현재 표본
                      </th>

                      <th className="px-3 py-3 text-right">
                        표본 변화
                      </th>

                      <th className="px-3 py-3 text-right">
                        Gap 변화
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-[#F1F5F9]">

                    {filteredItems.length ===
                    0
                      ? (

                        <tr>

                          <td
                            colSpan={
                              10
                            }
                            className="py-12 text-center text-[#94A3B8]"
                          >
                            현재 필터 조건에 해당하는 비교결과가 없습니다.
                          </td>

                        </tr>

                      )
                      : (

                        filteredItems.map(
                          (
                            item
                          ) => {

                            const rowKey =
                              [
                                item.comparisonKey,
                                item.previousPeriod,
                                item.currentPeriod,
                              ].join(
                                "::"
                              );


                            return (

                              <React.Fragment
                                key={
                                  rowKey
                                }
                              >

                                <ComparisonRow
                                  item={
                                    item
                                  }
                                />

                              </React.Fragment>
                            );
                          }
                        )
                      )}

                  </tbody>

                </table>

              </div>

            </div>

          </>
        )}

      </div>
    );
  };


/**
 * ============================================================
 * Sub Components
 * ============================================================
 */

function PeriodSelect({
  label,
  value,
  datasets,
  excludedId,
  onChange,
}: {
  label:
    string;

  value:
    string;

  datasets:
    PeriodComparisonDataset[];

  excludedId:
    string;

  onChange:
    (
      value:
        string
    ) => void;
}) {

  return (

    <label className="block">

      <span className="text-[11px] font-bold text-[#334155]">
        {label}
      </span>


      <select
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event.target.value
            )
        }
        className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-2.5 text-xs font-semibold text-[#1E293B] focus:border-[#243B53] focus:outline-hidden"
      >

        {datasets
          .filter(
            (
              dataset
            ) =>
              dataset.id !==
              excludedId
          )
          .map(
            (
              dataset
            ) => (

              <option
                key={
                  dataset.id
                }
                value={
                  dataset.id
                }
              >

                {dataset.period ||
                  "평가기간 미탐지"}
                {" · "}
                {dataset.mode ===
                "CURRENT"
                  ? "현재"
                  : "비교"}
                {" · "}
                {dataset.departments.length}개 분석단위

              </option>
            )
          )}

      </select>

    </label>
  );
}


function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label:
    string;

  value:
    string;

  description:
    string;

  tone:
    "DEFAULT" |
    "DANGER" |
    "WARNING" |
    "SUCCESS" |
    "INFO";
}) {

  const toneClass =
    tone ===
    "DANGER"
      ? "border-[#F6D3D3] bg-[#FDF2F2]"
      : tone ===
        "WARNING"
      ? "border-[#F9E7C4] bg-[#FEF8EC]"
      : tone ===
        "SUCCESS"
      ? "border-[#C7E6D7] bg-[#EBF5F0]"
      : tone ===
        "INFO"
      ? "border-[#D9E1EA] bg-[#ECF2F7]"
      : "border-[#E2E8F0] bg-white";


  return (

    <div className={`rounded-xl border p-4 shadow-2xs ${toneClass}`}>

      <div className="text-[10px] font-semibold text-[#64748B]">
        {label}
      </div>


      <div className="mt-1 text-xl font-bold tracking-tight text-[#1E293B]">
        {value}
      </div>


      <div className="mt-1 text-[9px] text-[#94A3B8]">
        {description}
      </div>

    </div>
  );
}


function ComparisonRow({
  item,
}: {
  item:
    PeriodComparisonItem;
}) {

  const statusMeta =
    STATUS_META[
      item.changeStatus
    ];


  return (

    <tr className="transition-colors hover:bg-[#F8F9FA]">

      <td className="px-4 py-3.5">

        <div className="font-bold text-[#1E293B]">
          {item.departmentName}
        </div>


        {item.parentDepartment && (

          <div className="mt-0.5 text-[10px] text-[#94A3B8]">
            {item.parentDepartment}
          </div>
        )}

      </td>


      <td className="px-3 py-3.5 text-[#64748B]">
        {item.peerGroupLabel}
      </td>


      <td className="px-3 py-3.5 text-center">

        <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${statusMeta.className}`}>
          {statusMeta.label}
        </span>

      </td>


      <td className="px-3 py-3.5 text-right font-semibold text-[#475569]">
        {formatScore(
          item.previousScore
        )}
      </td>


      <td className="px-3 py-3.5 text-right font-bold text-[#1E293B]">
        {formatScore(
          item.currentScore
        )}
      </td>


      <td className="px-3 py-3.5 text-right">

        <ChangeValue
          value={
            item.scoreChange
          }
          suffix="점"
        />

      </td>


      <td className="px-3 py-3.5 text-right text-[#64748B]">
        {formatInteger(
          item.previousSampleSize
        )}
      </td>


      <td className="px-3 py-3.5 text-right font-semibold text-[#334155]">
        {formatInteger(
          item.currentSampleSize
        )}
      </td>


      <td className="px-3 py-3.5 text-right">

        <ChangeValue
          value={
            item.sampleSizeChange
          }
          suffix="명"
          integer
        />

      </td>


      <td className="px-3 py-3.5 text-right">

        <ChangeValue
          value={
            item.peerGroupGapChange
          }
          suffix="점"
        />

      </td>

    </tr>
  );
}


function ChangeValue({
  value,
  suffix,
  integer = false,
}: {
  value:
    number |
    null;

  suffix:
    string;

  integer?:
    boolean;
}) {

  if (
    value ===
    null ||
    !Number.isFinite(
      value
    )
  ) {

    return (
      <span className="text-[#94A3B8]">
        -
      </span>
    );
  }


  const Icon =
    value >
    0
      ? TrendingUp
      : value <
        0
      ? TrendingDown
      : Minus;


  const className =
    value >
    0
      ? "text-[#2E7D5B]"
      : value <
        0
      ? "text-[#B94A48]"
      : "text-[#64748B]";


  return (

    <span className={`inline-flex items-center justify-end gap-1 font-bold ${className}`}>

      <Icon className="h-3.5 w-3.5" />

      {value >
      0
        ? "+"
        : ""}

      {integer
        ? Math.round(
            value
          )
        : value.toFixed(
            1
          )}

      {suffix}

    </span>
  );
}


function formatSigned(
  value:
    number
): string {

  if (
    !Number.isFinite(
      value
    )
  ) {
    return "-";
  }


  return `${
    value >
    0
      ? "+"
      : ""
  }${value.toFixed(
    1
  )}점`;
}


function formatScore(
  value:
    number |
    null
): string {

  if (
    value ===
    null ||
    !Number.isFinite(
      value
    )
  ) {
    return "-";
  }


  return `${value.toFixed(
    1
  )}점`;
}


function formatInteger(
  value:
    number |
    null
): string {

  if (
    value ===
    null ||
    !Number.isFinite(
      value
    )
  ) {
    return "-";
  }


  return `${Math.round(
    value
  ).toLocaleString()}명`;
}
