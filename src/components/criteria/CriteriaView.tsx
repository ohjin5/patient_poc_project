import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AnalysisScopeConfig,
  CriteriaConfig,
  DepartmentSummary,
  PeerGroup,
} from "../../types";

import {
  ArrowRight,
  RotateCcw,
  BookOpen,
  Info,
  SlidersHorizontal,
  Users,
  Target,
  GitMerge,
  CheckSquare2,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Layers3,
} from "lucide-react";

import {
  DEFAULT_CRITERIA,
} from "../../constants";

import {
  CriteriaGuideDrawer,
} from "./CriteriaGuideDrawer";


interface CriteriaViewProps {
  criteria:
    CriteriaConfig;

  onUpdateCriteria:
    (
      newCriteria:
        CriteriaConfig
    ) => void;

  departments:
    DepartmentSummary[];

  /**
   * 분석 대상 범위
   *
   * App 연결 전에도 기존 화면이 깨지지 않도록 optional로 둡니다.
   * 다음 단계에서 App.tsx에서 실제 state를 연결하면 됩니다.
   */
  analysisScope?:
    AnalysisScopeConfig;

  onUpdateAnalysisScope?:
    (
      scope:
        AnalysisScopeConfig
    ) => void;

  vulnerableCount:
    number;

  onProceedToVulnerableList:
    () => void;
}


const ANALYSIS_SCOPE_PEER_GROUP_ORDER:
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


const ANALYSIS_SCOPE_LABELS:
  Partial<
    Record<
      PeerGroup,
      string
    >
  > = {
    INPATIENT_WARD:
      "입원 병동",

    INPATIENT_DEPARTMENT:
      "입원 진료과",

    INPATIENT_DOCTOR:
      "입원 의사",

    OUTPATIENT_CENTER:
      "외래 센터",

    OUTPATIENT_DEPARTMENT:
      "외래 진료과",

    OUTPATIENT_DOCTOR:
      "외래 의사",

    EMERGENCY_DEPARTMENT:
      "응급 진료과",

    EMERGENCY_DOCTOR:
      "응급 의사",

    EXAM:
      "검사실",
  };


/**
 * ============================================================
 * Criteria View
 * ============================================================
 *
 * 현재 사용하는 취약부서 선별 조건
 *
 * 1. 절대점수 기준
 * 2. 평균 대비 격차 기준
 *
 * 최소 표본수는 "취약조건"이 아니라
 * 분석 대상 포함을 위한 최소 신뢰조건으로 사용합니다.
 *
 * 전기 대비 점수 하락 / 하위 백분위 조건은
 * 현재 운영 화면에서 사용하지 않습니다.
 */
export const CriteriaView:
  React.FC<
    CriteriaViewProps
  > = ({
    criteria,
    onUpdateCriteria,
    departments,
    analysisScope,
    onUpdateAnalysisScope,
    vulnerableCount,
    onProceedToVulnerableList,
  }) => {

    const [
      guideDrawerOpen,
      setGuideDrawerOpen,
    ] =
      useState<boolean>(
        false
      );


    const [
      activeTooltip,
      setActiveTooltip,
    ] =
      useState<
        string | null
      >(null);


    /**
     * ========================================================
     * Analysis Scope
     * ========================================================
     *
     * App.tsx 연결 전에는 local fallback을 사용합니다.
     * App에서 analysisScope / onUpdateAnalysisScope를 넘기면
     * 해당 state가 우선됩니다.
     */
    const [
      localAnalysisScope,
      setLocalAnalysisScope,
    ] =
      useState<
        AnalysisScopeConfig
      >({
        selectAll:
          true,

        selectedPeerGroups:
          [],

        selectedDepartmentIds:
          [],
      });


    const [
      expandedScopeGroups,
      setExpandedScopeGroups,
    ] =
      useState<
        PeerGroup[]
      >([]);


    const effectiveAnalysisScope =
      analysisScope ||
      localAnalysisScope;


    const updateAnalysisScope =
      (
        next:
          AnalysisScopeConfig
      ) => {

        if (
          onUpdateAnalysisScope
        ) {

          onUpdateAnalysisScope(
            next
          );

        } else {

          setLocalAnalysisScope(
            next
          );
        }
      };


    /**
     * ========================================================
     * Legacy 조건 비활성화
     * ========================================================
     *
     * UI에서만 숨기면 AnalysisEngine에서 계속 적용될 수 있으므로
     * 실제 CriteriaConfig 값도 false로 맞춥니다.
     */
    useEffect(() => {

      const needsCleanup =
        criteria.enableScoreDrop ||
        criteria.enableBottomPercentile;


      if (!needsCleanup) {
        return;
      }


      onUpdateCriteria({
        ...criteria,

        enableScoreDrop:
          false,

        enableBottomPercentile:
          false,
      });

    }, [
      criteria.enableScoreDrop,
      criteria.enableBottomPercentile,
    ]);


    /**
     * ========================================================
     * General Update
     * ========================================================
     */

    const handleChange =
      <
        K extends
          keyof CriteriaConfig
      >(
        key:
          K,

        value:
          CriteriaConfig[K]
      ) => {

        onUpdateCriteria({
          ...criteria,
          [key]:
            value,
        });
      };


    /**
     * ========================================================
     * Gap Helpers
     * ========================================================
     *
     * enableGap / enableHospitalAvgGap
     * gapThreshold / hospitalAvgGapThreshold
     *
     * 과거 필드 호환을 위해 두 값을 같이 유지하되
     * 반드시 한 번의 state update로 처리합니다.
     */

    const gapEnabled =
      Boolean(
        criteria.enableGap ??
        criteria.enableHospitalAvgGap ??
        false
      );


    /**
     * 내부 계산값은 기존대로 음수 Gap을 사용합니다.
     * 예: -4 = 평균보다 4점 낮음
     *
     * 사용자 화면에서는 이해하기 쉽도록
     * 양수 "4점 이상 낮음"으로 표시합니다.
     */
    const gapThreshold =
      Number(
        criteria.gapThreshold ??
        criteria.hospitalAvgGapThreshold ??
        -4
      );


    const gapDisplayValue =
      Math.abs(
        gapThreshold
      );


    const benchmarkTarget =
      criteria.benchmarkTarget ||
      "PEER_GROUP";


    const updateGapEnabled =
      (
        enabled:
          boolean
      ) => {

        onUpdateCriteria({
          ...criteria,

          enableGap:
            enabled,

          enableHospitalAvgGap:
            enabled,

          /**
           * 현재 사용하지 않는 조건은
           * 계속 false로 보장합니다.
           */
          enableScoreDrop:
            false,

          enableBottomPercentile:
            false,
        });
      };


    const updateGapThreshold =
      (
        displayValue:
          number
      ) => {

        if (
          !Number.isFinite(
            displayValue
          )
        ) {
          return;
        }


        /**
         * 화면에서는 4점처럼 양수로 입력받고
         * 실제 판정용 Criteria에는 -4로 저장합니다.
         */
        const normalizedGap =
          -Math.abs(
            displayValue
          );


        onUpdateCriteria({
          ...criteria,

          gapThreshold:
            normalizedGap,

          hospitalAvgGapThreshold:
            normalizedGap,

          enableScoreDrop:
            false,

          enableBottomPercentile:
            false,
        });
      };


    /**
     * ========================================================
     * Reset
     * ========================================================
     *
     * DEFAULT_CRITERIA 안에 과거 조건이 true로 남아 있더라도
     * 현재 화면에서는 강제로 비활성화합니다.
     */

    const resetToDefault =
      () => {

        onUpdateCriteria({
          ...DEFAULT_CRITERIA,

          enableScoreDrop:
            false,

          enableBottomPercentile:
            false,

          enableGap:
            DEFAULT_CRITERIA.enableGap ??
            DEFAULT_CRITERIA.enableHospitalAvgGap ??
            true,

          enableHospitalAvgGap:
            DEFAULT_CRITERIA.enableGap ??
            DEFAULT_CRITERIA.enableHospitalAvgGap ??
            true,
        });
      };


    const toggleTooltip =
      (
        id:
          string
      ) => {

        setActiveTooltip(
          activeTooltip === id
            ? null
            : id
        );
      };


    /**
     * ========================================================
     * Active Conditions
     * ========================================================
     *
     * 최소 사례수는 취약조건이 아니므로 포함하지 않습니다.
     */

    const activeConditionCount =
      [
        criteria.enableAbsoluteScore,
        gapEnabled,
      ]
        .filter(
          Boolean
        )
        .length;


    /**
     * ========================================================
     * Analysis Scope Groups
     * ========================================================
     */
    const analysisScopeGroups =
      useMemo(
        () => {

          return ANALYSIS_SCOPE_PEER_GROUP_ORDER
            .map(
              (
                peerGroup
              ) => {

                const groupDepartments =
                  departments
                    .filter(
                      (
                        department
                      ) =>
                        department.peerGroup ===
                          peerGroup
                    )
                    .sort(
                      (
                        a,
                        b
                      ) => {

                        const aParent =
                          a.parentDepartment ||
                          a.parentCenter ||
                          "";

                        const bParent =
                          b.parentDepartment ||
                          b.parentCenter ||
                          "";


                        const parentCompare =
                          aParent.localeCompare(
                            bParent,
                            "ko"
                          );


                        if (
                          parentCompare !==
                          0
                        ) {
                          return parentCompare;
                        }


                        return (
                          a.displayName ||
                          a.name
                        ).localeCompare(
                          b.displayName ||
                          b.name,
                          "ko"
                        );
                      }
                    );


                const selectedCount =
                  effectiveAnalysisScope
                    .selectAll
                    ? groupDepartments.length
                    : groupDepartments
                        .filter(
                          (
                            department
                          ) =>
                            effectiveAnalysisScope
                              .selectedDepartmentIds
                              .includes(
                                department.id
                              )
                        )
                        .length;


                return {
                  peerGroup,

                  label:
                    ANALYSIS_SCOPE_LABELS[
                      peerGroup
                    ] ||
                    peerGroup,

                  departments:
                    groupDepartments,

                  totalCount:
                    groupDepartments.length,

                  selectedCount,
                };
              }
            )
            .filter(
              (
                group
              ) =>
                group.totalCount >
                0
            );
        },
        [
          departments,
          effectiveAnalysisScope,
        ]
      );


    const scopedDepartments =
      useMemo(
        () => {

          if (
            effectiveAnalysisScope
              .selectAll
          ) {
            return departments;
          }


          const selectedIdSet =
            new Set(
              effectiveAnalysisScope
                .selectedDepartmentIds
            );


          return departments.filter(
            (
              department
            ) =>
              selectedIdSet.has(
                department.id
              )
          );
        },
        [
          departments,
          effectiveAnalysisScope,
        ]
      );


    const selectedScopeCount =
      scopedDepartments.length;


    const setSelectAllScope =
      (
        checked:
          boolean
      ) => {

        if (
          checked
        ) {

          updateAnalysisScope({
            selectAll:
              true,

            selectedPeerGroups:
              [],

            selectedDepartmentIds:
              [],
          });


          return;
        }


        updateAnalysisScope({
          selectAll:
            false,

          selectedPeerGroups:
            ANALYSIS_SCOPE_PEER_GROUP_ORDER.filter(
              (
                peerGroup
              ) =>
                departments.some(
                  (
                    department
                  ) =>
                    department.peerGroup ===
                      peerGroup
                )
            ),

          selectedDepartmentIds:
            departments.map(
              (
                department
              ) =>
                department.id
            ),
        });
      };


    const toggleScopeGroup =
      (
        peerGroup:
          PeerGroup
      ) => {

        setExpandedScopeGroups(
          (
            previous
          ) =>
            previous.includes(
              peerGroup
            )
              ? previous.filter(
                  (
                    item
                  ) =>
                    item !==
                    peerGroup
                )
              : [
                  ...previous,
                  peerGroup,
                ]
        );
      };


    const setScopeGroupChecked =
      (
        peerGroup:
          PeerGroup,
        checked:
          boolean
      ) => {

        const ids =
          departments
            .filter(
              (
                department
              ) =>
                department.peerGroup ===
                  peerGroup
            )
            .map(
              (
                department
              ) =>
                department.id
            );


        const currentIds =
          new Set<string>(
            effectiveAnalysisScope
              .selectAll
              ? departments.map(
                  (
                    department
                  ) =>
                    String(
                      department.id
                    )
                )
              : effectiveAnalysisScope
                  .selectedDepartmentIds
                  .map(
                    (
                      id
                    ) =>
                      String(
                        id
                      )
                  )
          );


        for (
          const id of
          ids
        ) {

          if (
            checked
          ) {
            currentIds.add(
              id
            );
          } else {
            currentIds.delete(
              id
            );
          }
        }


        const nextIds:
          string[] =
            Array.from(
              currentIds
            );


        const nextPeerGroups =
          ANALYSIS_SCOPE_PEER_GROUP_ORDER
            .filter(
              (
                group
              ) =>
                departments.some(
                  (
                    department
                  ) =>
                    department.peerGroup ===
                      group &&
                    nextIds.includes(
                      department.id
                    )
                )
            );


        updateAnalysisScope({
          selectAll:
            nextIds.length ===
              departments.length,

          selectedPeerGroups:
            nextIds.length ===
              departments.length
              ? []
              : nextPeerGroups,

          selectedDepartmentIds:
            nextIds.length ===
              departments.length
              ? []
              : nextIds,
        });
      };


    const setScopeDepartmentChecked =
      (
        departmentId:
          string,
        checked:
          boolean
      ) => {

        const currentIds =
          new Set<string>(
            effectiveAnalysisScope
              .selectAll
              ? departments.map(
                  (
                    department
                  ) =>
                    String(
                      department.id
                    )
                )
              : effectiveAnalysisScope
                  .selectedDepartmentIds
                  .map(
                    (
                      id
                    ) =>
                      String(
                        id
                      )
                  )
          );


        if (
          checked
        ) {
          currentIds.add(
            departmentId
          );
        } else {
          currentIds.delete(
            departmentId
          );
        }


        const nextIds:
          string[] =
            Array.from(
              currentIds
            );


        const nextPeerGroups =
          ANALYSIS_SCOPE_PEER_GROUP_ORDER
            .filter(
              (
                group
              ) =>
                departments.some(
                  (
                    department
                  ) =>
                    department.peerGroup ===
                      group &&
                    nextIds.includes(
                      department.id
                    )
                )
            );


        updateAnalysisScope({
          selectAll:
            nextIds.length ===
              departments.length,

          selectedPeerGroups:
            nextIds.length ===
              departments.length
              ? []
              : nextPeerGroups,

          selectedDepartmentIds:
            nextIds.length ===
              departments.length
              ? []
              : nextIds,
        });
      };


    /**
     * ========================================================
     * Preview
     * ========================================================
     *
     * App에서 departments는 현재 criteria를 기준으로
     * AnalysisEngine이 다시 계산한 결과입니다.
     */

    const selectedDepartments =
      useMemo(
        () => {

          return scopedDepartments
            .filter(
              (
                department
              ) =>
                department
                  .vulnerabilityReasons
                  .length >
                  0 &&
                department.priority !==
                  "NORMAL"
            )
            .sort(
              (
                a,
                b
              ) =>
                a.overallScore -
                b.overallScore
            );

        },
        [
          scopedDepartments,
        ]
      );


    const scopedVulnerableCount =
      selectedDepartments.length;


    const selectedRatio =
      selectedScopeCount >
        0
        ? (
            scopedVulnerableCount /
            selectedScopeCount
          ) *
          100
        : 0;


    /**
     * ========================================================
     * Render
     * ========================================================
     */

    return (
      <div className="space-y-6">

        {/* ==================================================
            1. HEADER
        =================================================== */}

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>

              <div className="flex items-center gap-2">

                <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                  분석 설정
                </span>


                <span className="text-xs font-medium text-[#64748B]">
                  우선 개선대상 선별 기준을 설정하고 분석 결과를 확인하세요.
                </span>

              </div>


              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#1E293B]">
                취약부서 선별 임계값 및 판정 규칙 설정
              </h2>

            </div>


            <div className="flex flex-wrap items-center gap-2">

              <button
                type="button"
                onClick={() =>
                  setGuideDrawerOpen(
                    true
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B53] bg-[#ECF2F7] px-3.5 py-2 text-xs font-bold text-[#243B53] shadow-2xs transition-colors hover:bg-[#D9E6F2]"
              >

                <BookOpen className="h-3.5 w-3.5" />

                <span>
                  설정 가이드
                </span>

              </button>


              <button
                type="button"
                onClick={
                  resetToDefault
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#334155] shadow-2xs transition-colors hover:bg-[#F8F9FA]"
              >

                <RotateCcw className="h-3.5 w-3.5 text-[#64748B]" />

                <span>
                  기본값 복원
                </span>

              </button>


              <button
                type="button"
                onClick={
                  onProceedToVulnerableList
                }
                disabled={
                  selectedScopeCount ===
                  0
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
              >

                <span>
                  전체 분석 결과 확인
                  {" "}
                  ({vulnerableCount}개 개선대상)
                </span>

                <ArrowRight className="h-3.5 w-3.5" />

              </button>

            </div>

          </div>

        </div>


        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* ==================================================
              LEFT
          =================================================== */}

          <div className="space-y-4 lg:col-span-8">

            {/* ================================================
                Combination Logic
            ================================================= */}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                <div>

                  <div className="flex items-center gap-1.5">

                    <GitMerge className="h-4 w-4 text-[#243B53]" />


                    <h3 className="text-xs font-bold text-[#1E293B]">
                      다중 조건 결합 논리
                    </h3>


                    <button
                      type="button"
                      onClick={() =>
                        toggleTooltip(
                          "logic"
                        )
                      }
                      className="rounded p-0.5 text-[#64748B] transition-colors hover:text-[#243B53]"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>

                  </div>


                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    활성화한 선별 기준이 2개 이상일 때 조건을 어떻게 결합할지 결정합니다.
                  </p>

                </div>


                <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] p-1">

                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        "combinationLogic",
                        "OR"
                      )
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      criteria.combinationLogic ===
                      "OR"
                        ? "bg-[#243B53] text-white shadow-xs"
                        : "text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    OR
                    {" "}
                    <span className="font-medium">
                      (하나라도 충족)
                    </span>
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      handleChange(
                        "combinationLogic",
                        "AND"
                      )
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      criteria.combinationLogic ===
                      "AND"
                        ? "bg-[#243B53] text-white shadow-xs"
                        : "text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    AND
                    {" "}
                    <span className="font-medium">
                      (모두 충족)
                    </span>
                  </button>

                </div>

              </div>


              {activeConditionCount ===
                1 && (

                <div className="mt-3 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-[10px] text-[#64748B]">

                  현재 선별조건이 1개만 활성화되어 있어
                  OR / AND 선택에 관계없이 동일한 결과가 적용됩니다.

                </div>
              )}


              {activeConditionCount ===
                0 && (

                <div className="mt-3 rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] px-3 py-2 text-[10px] font-medium text-[#8C5E1E]">

                  선별 기준이 활성화되어 있지 않습니다.
                  절대점수 또는 평균 대비 격차 기준을 1개 이상 선택해주세요.

                </div>
              )}


              {activeTooltip ===
                "logic" && (

                <div className="mt-3 rounded-lg border border-[#C7E6D7] bg-[#EBF5F0]/80 p-3 text-[11px] text-[#1E3A2F]">

                  <strong>
                    결합 논리 안내
                  </strong>

                  <div className="mt-1 space-y-1 text-[#2E7D5B]">

                    <div>
                      <strong>
                        OR:
                      </strong>
                      {" "}
                      활성화된 기준 중 하나라도 충족하면 개선대상으로 선별합니다.
                    </div>

                    <div>
                      <strong>
                        AND:
                      </strong>
                      {" "}
                      활성화된 모든 기준을 동시에 충족해야 개선대상으로 선별합니다.
                    </div>

                  </div>

                </div>
              )}

            </div>


            {/* ================================================
                Analysis Scope
            ================================================= */}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">

                <div>

                  <div className="flex items-center gap-2">

                    <Layers3 className="h-4 w-4 text-[#243B53]" />

                    <h3 className="text-xs font-bold text-[#1E293B]">
                      분석 대상 범위
                    </h3>

                  </div>


                  <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                    기본값은 전체 분석단위입니다. 필요한 경우 유형별로 펼쳐 병동·진료과·의사 등 이번 분석에 포함할 대상만 선택할 수 있습니다.
                  </p>

                </div>


                <div className="shrink-0 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-right">

                  <div className="text-[10px] font-semibold text-[#64748B]">
                    현재 분석 범위
                  </div>

                  <div className="mt-0.5 text-xs font-bold text-[#243B53]">
                    {effectiveAnalysisScope.selectAll
                      ? `전체 ${departments.length}개`
                      : `${selectedScopeCount}개 / 전체 ${departments.length}개`}
                  </div>

                </div>

              </div>


              <label className="mt-4 flex cursor-pointer items-center justify-between rounded-lg border border-[#D9E1EA] bg-[#ECF2F7] px-3.5 py-3">

                <div className="flex items-center gap-2.5">

                  <input
                    type="checkbox"
                    checked={
                      effectiveAnalysisScope
                        .selectAll
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setSelectAllScope(
                          event.target.checked
                        )
                    }
                    className="h-4 w-4 rounded border-[#B8C7D8] text-[#243B53] focus:ring-[#243B53]"
                  />

                  <div>

                    <div className="text-xs font-bold text-[#243B53]">
                      전체 분석단위 선택
                    </div>

                    <div className="mt-0.5 text-[10px] text-[#64748B]">
                      기본값 · 모든 유형과 분석단위를 포함합니다.
                    </div>

                  </div>

                </div>


                <CheckSquare2 className="h-4 w-4 text-[#3B5B7E]" />

              </label>


              {!effectiveAnalysisScope
                .selectAll && (

                <div className="mt-3 space-y-2">

                  {analysisScopeGroups.map(
                    (
                      group
                    ) => {

                      const expanded =
                        expandedScopeGroups
                          .includes(
                            group.peerGroup
                          );


                      const groupChecked =
                        group.selectedCount ===
                          group.totalCount &&
                        group.totalCount >
                          0;


                      const partiallyChecked =
                        group.selectedCount >
                          0 &&
                        group.selectedCount <
                          group.totalCount;


                      return (

                        <div
                          key={
                            group.peerGroup
                          }
                          className="overflow-hidden rounded-lg border border-[#E2E8F0] bg-white"
                        >

                          <div className="flex items-center gap-2 px-3 py-2.5">

                            <input
                              type="checkbox"
                              checked={
                                groupChecked
                              }
                              ref={
                                (
                                  element
                                ) => {

                                  if (
                                    element
                                  ) {
                                    element.indeterminate =
                                      partiallyChecked;
                                  }
                                }
                              }
                              onChange={
                                (
                                  event
                                ) =>
                                  setScopeGroupChecked(
                                    group.peerGroup,
                                    event.target.checked
                                  )
                              }
                              className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                            />


                            <button
                              type="button"
                              onClick={() =>
                                toggleScopeGroup(
                                  group.peerGroup
                                )
                              }
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                            >

                              <div className="min-w-0">

                                <div className="text-xs font-bold text-[#1E293B]">
                                  {group.label}
                                </div>

                                <div className="mt-0.5 text-[10px] text-[#64748B]">
                                  {group.selectedCount}개 선택 / {group.totalCount}개
                                </div>

                              </div>


                              {expanded
                                ? (
                                    <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" />
                                  )
                                : (
                                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#64748B]" />
                                  )}

                            </button>

                          </div>


                          {expanded && (

                            <div className="border-t border-[#EEF1F4] bg-[#F8F9FA] px-3 py-2.5">

                              <div className="grid gap-1.5 sm:grid-cols-2">

                                {group.departments.map(
                                  (
                                    department
                                  ) => {

                                    const checked =
                                      effectiveAnalysisScope
                                        .selectAll ||
                                      effectiveAnalysisScope
                                        .selectedDepartmentIds
                                        .includes(
                                          department.id
                                        );


                                    return (

                                      <label
                                        key={
                                          department.id
                                        }
                                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-[#D9E1EA] hover:bg-white"
                                      >

                                        <input
                                          type="checkbox"
                                          checked={
                                            checked
                                          }
                                          onChange={
                                            (
                                              event
                                            ) =>
                                              setScopeDepartmentChecked(
                                                department.id,
                                                event.target.checked
                                              )
                                          }
                                          className="mt-0.5 h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                                        />


                                        <div className="min-w-0">

                                          <div className="truncate text-[11px] font-bold text-[#334155]">
                                            {department.displayName ||
                                              department.name}
                                          </div>


                                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] text-[#94A3B8]">

                                            {(department.parentDepartment ||
                                              department.parentCenter) && (
                                              <span>
                                                {department.parentDepartment ||
                                                  department.parentCenter}
                                              </span>
                                            )}

                                            <span>
                                              N={department.sampleSize}
                                            </span>

                                            <span>
                                              {department.overallScore.toFixed(
                                                1
                                              )}점
                                            </span>

                                          </div>

                                        </div>

                                      </label>
                                    );
                                  }
                                )}

                              </div>

                            </div>
                          )}

                        </div>
                      );
                    }
                  )}


                  {selectedScopeCount ===
                    0 && (

                    <div className="rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] px-3 py-2 text-[10px] font-medium text-[#8C5E1E]">
                      현재 선택된 분석대상이 없습니다. 최소 1개 이상의 분석단위를 선택해주세요.
                    </div>
                  )}

                </div>
              )}

            </div>


            {/* ================================================
                01. Absolute Score
            ================================================= */}

            <div
              className={`rounded-xl border p-5 shadow-2xs transition-all ${
                criteria.enableAbsoluteScore
                  ? "border-[#E2E8F0] border-l-4 border-l-[#243B53] bg-white"
                  : "border-[#EEF1F4] bg-[#F8F9FA] opacity-60"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <label className="flex cursor-pointer items-center gap-2.5">

                    <input
                      type="checkbox"
                      checked={
                        criteria.enableAbsoluteScore
                      }
                      onChange={
                        (
                          event
                        ) =>
                          handleChange(
                            "enableAbsoluteScore",
                            event.target.checked
                          )
                      }
                      className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                    />


                    <span className="text-xs font-bold text-[#1E293B]">
                      01. 절대점수 기준
                    </span>

                  </label>


                  <button
                    type="button"
                    onClick={() =>
                      toggleTooltip(
                        "abs"
                      )
                    }
                    className="rounded p-0.5 text-[#94A3B8] transition-colors hover:text-[#243B53]"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                </div>


                <span className="rounded bg-[#ECF2F7] px-2 py-0.5 font-mono text-xs font-bold text-[#243B53]">
                  ≤{" "}
                  {criteria
                    .absoluteScoreThreshold
                    .toFixed(
                      1
                    )}
                  점
                </span>

              </div>


              <p className="mt-1 pl-6.5 text-[11px] text-[#64748B]">
                종합 환자경험평가 점수가 설정값 이하인 분석단위를 개선대상으로 선별합니다.
              </p>


              {activeTooltip ===
                "abs" && (

                <div className="mt-2.5 ml-6.5 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] p-2.5 text-[11px] text-[#475569]">

                  예를 들어 기준을 85점으로 설정하면
                  종합점수가 85점 이하인 분석단위가 이 조건을 충족합니다.

                </div>
              )}


              {criteria.enableAbsoluteScore && (

                <div className="mt-4 flex items-center gap-4 pl-6.5">

                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="0.5"
                    value={
                      criteria.absoluteScoreThreshold
                    }
                    onChange={
                      (
                        event
                      ) =>
                        handleChange(
                          "absoluteScoreThreshold",
                          Number(
                            event.target.value
                          )
                        )
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#243B53]"
                  />


                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={
                      criteria.absoluteScoreThreshold
                    }
                    onChange={
                      (
                        event
                      ) => {

                        const value =
                          Number(
                            event.target.value
                          );


                        if (
                          Number.isFinite(
                            value
                          )
                        ) {
                          handleChange(
                            "absoluteScoreThreshold",
                            value
                          );
                        }
                      }
                    }
                    className="w-20 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-1 text-right text-xs font-bold text-[#1E293B]"
                  />

                </div>
              )}

            </div>


            {/* ================================================
                02. Benchmark Gap
            ================================================= */}

            <div
              className={`rounded-xl border p-5 shadow-2xs transition-all ${
                gapEnabled
                  ? "border-[#E2E8F0] border-l-4 border-l-[#B87A24] bg-white"
                  : "border-[#EEF1F4] bg-[#F8F9FA] opacity-60"
              }`}
            >

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <label className="flex cursor-pointer items-center gap-2.5">

                    <input
                      type="checkbox"
                      checked={
                        gapEnabled
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateGapEnabled(
                            event.target.checked
                          )
                      }
                      className="h-4 w-4 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                    />


                    <span className="text-xs font-bold text-[#1E293B]">
                      02. 평균 대비 격차 기준
                    </span>

                  </label>


                  <button
                    type="button"
                    onClick={() =>
                      toggleTooltip(
                        "gap"
                      )
                    }
                    className="rounded p-0.5 text-[#94A3B8] transition-colors hover:text-[#B87A24]"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>

                </div>


                <span className="rounded border border-[#F9E7C4] bg-[#FEF8EC] px-2 py-0.5 text-xs font-bold text-[#B87A24]">
                  평균보다{" "}
                  {gapDisplayValue.toFixed(
                    1
                  )}
                  점 이상 낮음
                </span>

              </div>


              {/* Benchmark Target */}

              <div className="mt-3 flex flex-wrap items-center gap-3 pl-6.5">

                <span className="text-[11px] font-semibold text-[#475569]">
                  비교 기준:
                </span>


                <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] p-0.5">

                  <button
                    type="button"
                    disabled={
                      !gapEnabled
                    }
                    onClick={() =>
                      handleChange(
                        "benchmarkTarget",
                        "PEER_GROUP"
                      )
                    }
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                      benchmarkTarget ===
                      "PEER_GROUP"
                        ? "bg-[#243B53] text-white shadow-xs"
                        : "text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    동일 유형 평균
                    {" "}
                    <span className="font-medium">
                      (권장)
                    </span>
                  </button>


                  <button
                    type="button"
                    disabled={
                      !gapEnabled
                    }
                    onClick={() =>
                      handleChange(
                        "benchmarkTarget",
                        "HOSPITAL"
                      )
                    }
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                      benchmarkTarget ===
                      "HOSPITAL"
                        ? "bg-[#243B53] text-white shadow-xs"
                        : "text-[#64748B] hover:text-[#1E293B]"
                    }`}
                  >
                    병원 기준점수
                  </button>

                </div>

              </div>


              <p className="mt-2 pl-6.5 text-[11px] text-[#64748B]">

                {benchmarkTarget ===
                "PEER_GROUP"
                  ? `같은 유형의 평균보다 ${gapDisplayValue.toFixed(1)}점 이상 낮은 분석단위를 선별합니다.`
                  : `해당 조사영역의 병원 기준점수보다 ${gapDisplayValue.toFixed(1)}점 이상 낮은 분석단위를 선별합니다.`}

              </p>


              {activeTooltip ===
                "gap" && (

                <div className="mt-2.5 ml-6.5 rounded-lg border border-[#F9E7C4] bg-[#FEF8EC]/80 p-2.5 text-[11px] text-[#78350F]">

                  동일한 업무·조사구조를 가진 대상끼리 비교하기 위해
                  기본 비교값은 동일 유형(Peer Group) 평균을 권장합니다.

                  <br />

                  예: 기준 4점 →
                  동일유형 평균보다 4점 이상 낮으면 조건 충족

                </div>
              )}


              {gapEnabled && (

                <div className="mt-4 flex items-center gap-4 pl-6.5">

                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={
                      gapDisplayValue
                    }
                    onChange={
                      (
                        event
                      ) =>
                        updateGapThreshold(
                          Number(
                            event.target.value
                          )
                        )
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#B87A24]"
                  />


                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      value={
                        gapDisplayValue
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateGapThreshold(
                            Number(
                              event.target.value
                            )
                          )
                      }
                      className="w-20 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-1 text-right text-xs font-bold text-[#B87A24]"
                    />

                    <span className="shrink-0 text-[11px] font-semibold text-[#64748B]">
                      점 낮음
                    </span>
                  </div>

                </div>
              )}

            </div>


            {/* ================================================
                Minimum Sample
            ================================================= */}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

              <div className="flex items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <Users className="h-4 w-4 text-[#64748B]" />


                  <div>

                    <div className="flex items-center gap-1.5">

                      <span className="text-xs font-bold text-[#1E293B]">
                        최소 분석 표본수
                      </span>


                      <button
                        type="button"
                        onClick={() =>
                          toggleTooltip(
                            "sample"
                          )
                        }
                        className="rounded p-0.5 text-[#94A3B8] transition-colors hover:text-[#243B53]"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>

                    </div>


                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      응답수가 너무 적은 분석단위는 취약부서 판정 대상에서 제외합니다.
                    </p>

                  </div>

                </div>


                <span className="rounded border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-0.5 font-mono text-xs font-bold text-[#334155]">
                  N ≥{" "}
                  {criteria.minSampleSize}
                  명
                </span>

              </div>


              {activeTooltip ===
                "sample" && (

                <div className="mt-3 rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-2.5 text-[11px] text-[#475569]">

                  표본수가 기준보다 적은 분석단위는
                  소수 응답에 따른 점수 왜곡 가능성이 있기 때문에
                  취약부서 자동 선별에서는 제외합니다.

                  <br />

                  다만 전체 성적표에서는 해당 부서의 점수와 순위를 계속 확인할 수 있습니다.

                </div>
              )}


              <div className="mt-4 flex items-center gap-4">

                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={
                    criteria.minSampleSize
                  }
                  onChange={
                    (
                      event
                    ) =>
                      handleChange(
                        "minSampleSize",
                        Number(
                          event.target.value
                        )
                      )
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#E2E8F0] accent-[#243B53]"
                />


                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  value={
                    criteria.minSampleSize
                  }
                  onChange={
                    (
                      event
                    ) => {

                      const value =
                        Number(
                          event.target.value
                        );


                      if (
                        Number.isFinite(
                          value
                        )
                      ) {
                        handleChange(
                          "minSampleSize",
                          value
                        );
                      }
                    }
                  }
                  className="w-20 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-1 text-right text-xs font-bold text-[#334155]"
                />

              </div>

            </div>


            {/* ================================================
                Current Rule Summary
            ================================================= */}

            <div className="rounded-xl border border-[#D9E1EA] bg-[#F8FAFC] p-4">

              <div className="flex items-start gap-2">

                <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-[#243B53]" />


                <div>

                  <div className="text-xs font-bold text-[#1E293B]">
                    현재 선별 규칙
                  </div>


                  <div className="mt-1 text-[11px] leading-relaxed text-[#64748B]">

                    {effectiveAnalysisScope.selectAll
                      ? "전체 분석단위를 대상으로, "
                      : `선택한 분석단위 ${selectedScopeCount}개를 대상으로, `}

                    표본수 N ≥{" "}
                    <strong className="text-[#334155]">
                      {criteria.minSampleSize}
                    </strong>
                    인 분석단위를 대상으로,

                    {" "}

                    {activeConditionCount ===
                      0
                      ? "활성화된 선별조건이 없습니다."
                      : (
                        <>

                          {criteria.enableAbsoluteScore && (
                            <>
                              종합점수 ≤{" "}
                              <strong className="text-[#243B53]">
                                {criteria.absoluteScoreThreshold.toFixed(
                                  1
                                )}
                              </strong>
                              점
                            </>
                          )}


                          {criteria.enableAbsoluteScore &&
                            gapEnabled && (
                            <strong className="mx-1 text-[#243B53]">
                              {criteria.combinationLogic}
                            </strong>
                          )}


                          {gapEnabled && (
                            <>
                              {benchmarkTarget ===
                              "PEER_GROUP"
                                ? "동일유형 평균보다"
                                : "병원 기준점수보다"}
                              {" "}
                              <strong className="text-[#B87A24]">
                                {gapDisplayValue.toFixed(
                                  1
                                )}
                              </strong>
                              점 이상 낮음
                            </>
                          )}

                        </>
                      )}

                  </div>

                </div>

              </div>

            </div>

          </div>


          {/* ==================================================
              RIGHT — LIVE PREVIEW
          =================================================== */}

          <div className="space-y-4 lg:col-span-4">

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

              <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-3">

                <div>

                  <h3 className="text-xs font-bold text-[#1E293B]">
                    실시간 선별 미리보기
                  </h3>


                  <span className="text-[10px] text-[#64748B]">

                    활성 조건:
                    {" "}
                    <strong className="text-[#243B53]">
                      {activeConditionCount}개
                    </strong>

                    {activeConditionCount >
                      1 && (
                      <>
                        {" · "}
                        {criteria.combinationLogic}
                      </>
                    )}

                  </span>

                </div>


                <span className="rounded-md border border-[#F6D3D3] bg-[#FDF2F2] px-2.5 py-1 text-xs font-bold text-[#B94A48] shadow-2xs">
                  개선대상 {vulnerableCount}개
                </span>

              </div>


              <div className="mt-4 space-y-3">

                {/* Summary */}

                <div className="space-y-1.5 rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-3 text-xs text-[#64748B]">

                  <div className="flex justify-between">

                    <span>
                      현재 분석범위
                    </span>

                    <span className="font-bold text-[#1E293B]">
                      {selectedScopeCount}개
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      개선대상
                    </span>

                    <span className="font-bold text-[#B94A48]">
                      {scopedVulnerableCount}개
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      선별 비율
                    </span>

                    <span className="font-bold text-[#B94A48]">
                      {selectedRatio.toFixed(
                        1
                      )}
                      %
                    </span>

                  </div>


                  <div className="flex justify-between">

                    <span>
                      최소 표본수
                    </span>

                    <span className="font-semibold text-[#334155]">
                      N ≥{" "}
                      {criteria.minSampleSize}
                    </span>

                  </div>

                </div>


                {/* Selection List */}

                <div className="mt-3 space-y-2">

                  <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">

                    <span>
                      개선대상 및 판정 사유
                    </span>

                    <span className="text-[10px] font-normal text-[#64748B]">
                      낮은 점수순 표시
                    </span>

                  </div>


                  <div className="max-h-[430px] space-y-2 overflow-y-auto pr-0.5">

                    {selectedDepartments.length ===
                    0 ? (

                      <div className="rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-4 text-center text-xs text-[#94A3B8]">
                        현재 기준으로 선별된 개선대상이 없습니다.
                      </div>

                    ) : (

                      selectedDepartments.map(
                        (
                          department
                        ) => (

                          <div
                            key={
                              department.id
                            }
                            className="space-y-1.5 rounded-xl border border-[#F6D3D3] bg-[#FDF2F2]/50 p-3 text-xs transition-all hover:bg-[#FDF2F2]/80"
                          >

                            <div className="flex items-center justify-between gap-2">

                              <div className="min-w-0">

                                <span className="font-bold text-[#1E293B]">
                                  {department.displayName ||
                                    department.name}
                                </span>


                                <span className="ml-1.5 rounded bg-[#ECF2F7] px-1.5 py-0.5 text-[10px] font-medium text-[#243B53]">
                                  {department.peerGroupLabel ||
                                    department.type}
                                </span>

                              </div>


                              <span className="shrink-0 rounded border border-[#F6D3D3] bg-white px-2 py-0.5 text-[10px] font-bold text-[#B94A48] shadow-2xs">
                                {department.priority}
                              </span>

                            </div>


                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#475569]">

                              <span>
                                종합{" "}
                                <strong className="text-[#243B53]">
                                  {department.overallScore.toFixed(
                                    1
                                  )}
                                  점
                                </strong>
                              </span>


                              <span>
                                동일유형{" "}
                                <strong className="text-[#1E293B]">
                                  {department.peerGroupRank ||
                                    department.rank}
                                  위 /{" "}
                                  {department.peerGroupSize ||
                                    department.totalRanked}
                                </strong>
                              </span>


                              <span>
                                표본{" "}
                                <strong className="text-[#334155]">
                                  {department.sampleSize}
                                  명
                                </strong>
                              </span>

                            </div>


                            <div className="border-t border-[#F6D3D3]/60 pt-1 text-[11px] leading-snug text-[#991B1B]">

                              {department
                                .vulnerabilityReasons
                                .length >
                              0
                                ? department
                                    .vulnerabilityReasons
                                    .join(
                                      " · "
                                    )
                                : "선별 사유 정보 없음"}

                            </div>

                          </div>
                        )
                      )
                    )}

                  </div>

                </div>


                <button
                  type="button"
                  onClick={
                    onProceedToVulnerableList
                  }
                  disabled={
                    selectedScopeCount ===
                    0
                  }
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#243B53] py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
                >

                  <span>
                    전체 분석 결과 조회
                  </span>

                  <ArrowRight className="h-3.5 w-3.5" />

                </button>

              </div>

            </div>

          </div>

        </div>


        {/* ==================================================
            GUIDE DRAWER
        =================================================== */}

        <CriteriaGuideDrawer
          isOpen={
            guideDrawerOpen
          }
          onClose={() =>
            setGuideDrawerOpen(
              false
            )
          }
          currentCriteria={
            criteria
          }
          onApplyPreset={
            (
              newConfig
            ) => {

              onUpdateCriteria({
                ...newConfig,

                /**
                 * 삭제한 조건이 preset에서
                 * 다시 살아나지 않도록 강제 비활성화
                 */
                enableScoreDrop:
                  false,

                enableBottomPercentile:
                  false,
              });
            }
          }
        />

      </div>
    );
  };