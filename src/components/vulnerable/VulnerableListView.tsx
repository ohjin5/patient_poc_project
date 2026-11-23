import React, {
  useMemo,
  useState,
} from "react";

import {
  DepartmentSummary,
} from "../../types";

import {
  AnalysisEngine,
  CX_PRIORITY_GUIDE,
} from "../../services/analysisEngine";

import {
  PriorityBadge,
  StatusBadge,
  ScoreDelta,
} from "../common/StatusBadge";

import {
  AlertOctagon,
  ArrowRight,
  Filter,
  Search,
  FileText,
  X,
  Building2,
  MessageSquareWarning,
  HelpCircle,
  Info,
  AlertTriangle,
  ShieldAlert,
  Eye,
  ArrowUpDown,
  CheckSquare2,
  Square,
  Layers3,
} from "lucide-react";


interface VulnerableListViewProps {
  /** 전체 평가 완료 부서 목록 */
  allDepartments?:
    DepartmentSummary[];

  /** 현재 설정 기준에 따라 선별된 우선 개선 대상 */
  vulnerableDepartments:
    DepartmentSummary[];

  hospitalAvg:
    number;

  onSelectDepartment:
    (deptId: string) => void;

  onGenerateFeedbackSheet:
    (dept: DepartmentSummary) => void;

  /**
   * 여러 분석단위를 한 번에 선택해
   * Feedback Sheet 일괄 생성을 요청할 때 사용합니다.
   *
   * App.tsx 연결 전에도 기존 화면이 깨지지 않도록 optional입니다.
   */
  onGenerateBatchFeedbackSheets?:
    (
      departments:
        DepartmentSummary[]
    ) => void;
}


/**
 * 실제 전기 데이터 존재 여부
 *
 * previousScore / scoreChange 값만 보는 것이 아니라
 * 실제 이전 조사기간과 사례수가 존재하는지를 확인합니다.
 */
function hasPreviousData(
  department:
    DepartmentSummary
): boolean {

  return Boolean(
    department.previousPeriod &&
    department.previousSampleSize >
      0
  );
}


/**
 * Signed score formatter
 */
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
    value > 0
      ? "+"
      : ""
  }${value.toFixed(1)}점`;
}


/**
 * ============================================================
 * 입원 병동 간호팀 표시용 분류
 * ============================================================
 *
 * 순위 계산 자체는 AnalysisEngine에서 수행합니다.
 * 여기서는 결과 화면에서 어떤 비교그룹의 순위인지
 * 사용자가 바로 이해할 수 있도록 라벨만 판별합니다.
 */
type InpatientWardRankGroup =
  | "WARD_TEAM_1"
  | "WARD_TEAM_2"
  | "EXCLUDED"
  | "UNCLASSIFIED";


function normalizeWardName(
  value:
    unknown
): string {

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(
      /[()_\-./]/g,
      ""
    );
}


function getInpatientWardRankGroup(
  department:
    DepartmentSummary
): InpatientWardRankGroup {

  if (
    department.peerGroup !==
    "INPATIENT_WARD"
  ) {
    return "UNCLASSIFIED";
  }


  const normalized =
    normalizeWardName(
      department.rawName ||
      department.displayName ||
      department.name
    );


  /**
   * 순위 제외 병동
   *
   * 명칭 차이를 고려해 대표 한글 표현과
   * 흔히 쓰는 영문 약어를 함께 확인합니다.
   */
  const excludedPatterns =
    [
      "신생아중환자실",
      "신생아집중치료실",
      "nicu",
      "고위험임산부집중치료실",
      "고위험임산부집중치료",
      "고위험임산부치료실",
      "mficu",
      "심장계중환자실",
      "심장중환자실",
      "심혈관중환자실",
      "ccu",
    ];


  if (
    excludedPatterns.some(
      (pattern) =>
        normalized.includes(
          pattern
        )
    )
  ) {
    return "EXCLUDED";
  }


  /**
   * 병동간호 1팀
   *
   * 111Unit ~ 162Unit 계열
   * + 141병동
   * + 호스피스 / 완화의료 계열
   *
   * 실제 병동 표기는 111Unit, 111병동처럼
   * 달라질 수 있으므로 앞의 병동 숫자를 추출합니다.
   */
  if (
    normalized.includes(
      "호스피스"
    ) ||
    normalized.includes(
      "완화의료"
    )
  ) {
    return "WARD_TEAM_1";
  }


  const wardNumberMatch =
    normalized.match(
      /(\d{2,3})(?:unit|병동)?/
    );


  const wardNumber =
    wardNumberMatch
      ? Number(
          wardNumberMatch[1]
        )
      : NaN;


  if (
    Number.isFinite(
      wardNumber
    )
  ) {

    if (
      wardNumber >= 111 &&
      wardNumber <= 162
    ) {
      return "WARD_TEAM_1";
    }


    if (
      wardNumber >= 62 &&
      wardNumber <= 102
    ) {
      return "WARD_TEAM_2";
    }
  }


  /**
   * 병동간호 2팀
   * + 신경계 중환자실 계열
   */
  if (
    normalized.includes(
      "신경계중환자실"
    ) ||
    normalized.includes(
      "신경중환자실"
    ) ||
    normalized.includes(
      "neurologicicu"
    ) ||
    normalized.includes(
      "neuroicu"
    )
  ) {
    return "WARD_TEAM_2";
  }


  return "UNCLASSIFIED";
}


function getRankGroupLabel(
  department:
    DepartmentSummary
): string {

  const group =
    getInpatientWardRankGroup(
      department
    );


  if (
    group === "WARD_TEAM_1"
  ) {
    return "병동간호 1팀";
  }


  if (
    group === "WARD_TEAM_2"
  ) {
    return "병동간호 2팀";
  }


  if (
    group === "EXCLUDED"
  ) {
    return "순위 제외";
  }


  return (
    department.peerGroupLabel ||
    department.type
  );
}


function isRankExcluded(
  department:
    DepartmentSummary
): boolean {

  return (
    getInpatientWardRankGroup(
      department
    ) === "EXCLUDED" ||
    department.peerGroupRank <= 0 ||
    department.peerGroupSize <= 0
  );
}


export const VulnerableListView:
  React.FC<
    VulnerableListViewProps
  > = ({
    allDepartments,
    vulnerableDepartments,
    hospitalAvg: _hospitalAvg,
    onSelectDepartment,
    onGenerateFeedbackSheet,
    onGenerateBatchFeedbackSheets,
  }) => {

    /**
     * ========================================================
     * State
     * ========================================================
     */

    const [
      filterPriority,
      setFilterPriority,
    ] =
      useState<string>(
        "ALL"
      );


    const [
      filterPeerGroup,
      setFilterPeerGroup,
    ] =
      useState<string>(
        "ALL"
      );


    /**
     * 입원 병동 선택 시에만 사용하는
     * 병동간호팀 세부 필터
     */
    const [
      filterWardGroup,
      setFilterWardGroup,
    ] = useState<
      "ALL" | "WARD_TEAM_1" | "WARD_TEAM_2" | "EXCLUDED"
    >("ALL");


    const [
      searchKeyword,
      setSearchKeyword,
    ] =
      useState<string>(
        ""
      );


    const [
      selectedDeptForDrawer,
      setSelectedDeptForDrawer,
    ] =
      useState<
        DepartmentSummary | null
      >(null);


    const [
      showPriorityGuide,
      setShowPriorityGuide,
    ] =
      useState<boolean>(
        false
      );


    /**
     * 전체 / 개선대상 / 일반부서 표시 필터
     */
    const [
      viewMode,
      setViewMode,
    ] = useState<
      "ALL" | "VULNERABLE" | "GENERAL"
    >("ALL");


    /**
     * 현재점수 정렬 - 기본은 높은 점수부터
     */
    const [
      scoreSort,
      setScoreSort,
    ] = useState<
      "DESC" | "ASC"
    >("DESC");


    /**
     * ========================================================
     * Batch Feedback Selection
     * ========================================================
     *
     * 유형그룹을 이동해도 선택값은 유지됩니다.
     * 따라서 입원 병동에서 몇 개를 고른 뒤
     * 입원 진료과/의사로 이동해서 추가 선택할 수 있습니다.
     */
    const [
      batchSelectedIds,
      setBatchSelectedIds,
    ] =
      useState<string[]>([]);


    /**
     * App에서 전체 평가결과를 전달하면 전체 성적표로 사용하고,
     * 아직 연결 전이라면 기존 취약부서 목록으로 안전하게 동작합니다.
     */
    const sourceDepartments =
      allDepartments && allDepartments.length > 0
        ? allDepartments
        : vulnerableDepartments;


    const vulnerableDepartmentIds =
      useMemo(
        () =>
          new Set(
            vulnerableDepartments.map(
              (department) => department.id
            )
          ),
        [vulnerableDepartments]
      );


    /**
     * ========================================================
     * 전체 현황 / Peer Groups
     * ========================================================
     *
     * 유형별 집계와 우선 확인 대상 계산은
     * AnalysisEngine에서 공통 처리합니다.
     *
     * View에서는 계산 결과를 표시하는 역할만 담당합니다.
     */
    const overviewDashboard =
      useMemo(
        () =>
          AnalysisEngine.buildOverviewDashboard(
            sourceDepartments,
            vulnerableDepartments,
            8
          ),
        [
          sourceDepartments,
          vulnerableDepartments,
        ]
      );


    /**
     * AnalysisEngine에 정의된 고정 순서를 그대로 사용합니다.
     *
     * 입원 병동 → 입원 진료과 → 입원 의사
     * → 외래 센터 → 외래 진료과 → 외래 의사
     * → 응급 진료과 → 응급 의사 → 검사실
     */
    const peerGroupSummaries =
      overviewDashboard.peerGroups;


    const overviewPriorityDepartments =
      overviewDashboard.priorityDepartments;


    const uniquePeerGroups =
      useMemo(
        () =>
          peerGroupSummaries.map(
            (
              summary
            ) =>
              summary.peerGroupLabel
          ),
        [
          peerGroupSummaries,
        ]
      );


    /**
     * ========================================================
     * Filter
     * ========================================================
     */

    const filtered =
      useMemo(
        () => {
          const result = sourceDepartments.filter(
            (department) => {
              const isVulnerable =
                vulnerableDepartmentIds.has(
                  department.id
                );


              if (
                viewMode === "VULNERABLE" &&
                !isVulnerable
              ) {
                return false;
              }


              if (
                viewMode === "GENERAL" &&
                isVulnerable
              ) {
                return false;
              }


              if (
                filterPriority !== "ALL" &&
                department.priority !==
                  filterPriority
              ) {
                return false;
              }


              if (
                filterPeerGroup !== "ALL" &&
                (
                  department.peerGroupLabel ||
                  department.type
                ) !== filterPeerGroup
              ) {
                return false;
              }


              /**
               * 입원 병동을 선택한 경우에만
               * 병동간호 1팀 / 2팀 / 순위 제외 세부 필터 적용
               */
              if (
                filterPeerGroup === "입원 병동" &&
                filterWardGroup !== "ALL"
              ) {
                const wardGroup =
                  getInpatientWardRankGroup(
                    department
                  );

                if (
                  wardGroup !==
                  filterWardGroup
                ) {
                  return false;
                }
              }


              const keyword =
                searchKeyword
                  .trim()
                  .toLowerCase();


              if (!keyword) {
                return true;
              }


              const displayName =
                (
                  department.displayName ||
                  department.name ||
                  ""
                ).toLowerCase();


              const rawName =
                (
                  department.name ||
                  ""
                ).toLowerCase();


              return (
                displayName.includes(keyword) ||
                rawName.includes(keyword)
              );
            }
          );


          return [...result].sort(
            (a, b) =>
              scoreSort === "DESC"
                ? b.overallScore - a.overallScore
                : a.overallScore - b.overallScore
          );
        },
        [
          sourceDepartments,
          vulnerableDepartmentIds,
          viewMode,
          filterPriority,
          filterPeerGroup,
          filterWardGroup,
          searchKeyword,
          scoreSort,
        ]
      );


    /**
     * ========================================================
     * Batch Selection Helpers
     * ========================================================
     */

    const batchSelectedIdSet =
      useMemo(
        () =>
          new Set(
            batchSelectedIds
          ),
        [
          batchSelectedIds,
        ]
      );


    const batchSelectedDepartments =
      useMemo(
        () =>
          sourceDepartments.filter(
            (
              department
            ) =>
              batchSelectedIdSet.has(
                department.id
              )
          ),
        [
          sourceDepartments,
          batchSelectedIdSet,
        ]
      );


    const filteredSelectableIds =
      useMemo(
        () =>
          filtered.map(
            (
              department
            ) =>
              department.id
          ),
        [
          filtered,
        ]
      );


    const filteredAllSelected =
      filteredSelectableIds.length >
        0 &&
      filteredSelectableIds.every(
        (
          id
        ) =>
          batchSelectedIdSet.has(
            id
          )
      );


    const toggleBatchDepartment =
      (
        departmentId:
          string
      ) => {

        setBatchSelectedIds(
          (
            previous
          ) =>
            previous.includes(
              departmentId
            )
              ? previous.filter(
                  (
                    id
                  ) =>
                    id !==
                    departmentId
                )
              : [
                  ...previous,
                  departmentId,
                ]
        );
      };


    const toggleFilteredBatchSelection =
      () => {

        setBatchSelectedIds(
          (
            previous
          ) => {

            const next =
              new Set(
                previous
              );


            if (
              filteredAllSelected
            ) {

              filteredSelectableIds.forEach(
                (
                  id
                ) =>
                  next.delete(
                    id
                  )
              );

            } else {

              filteredSelectableIds.forEach(
                (
                  id
                ) =>
                  next.add(
                    id
                  )
              );
            }


            return Array.from(
              next
            );
          }
        );
      };


    const clearBatchSelection =
      () => {

        setBatchSelectedIds(
          []
        );
      };


    const requestBatchFeedbackGeneration =
      () => {

        if (
          batchSelectedDepartments.length ===
          0
        ) {
          return;
        }


        onGenerateBatchFeedbackSheets?.(
          batchSelectedDepartments
        );
      };


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

                <span className="inline-flex items-center rounded-md border border-[#D9E1EA] bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                  전체 성적표
                </span>


                <span className="text-xs font-medium text-[#64748B]">
                  전체 평가대상을 현재점수 기준으로 확인하고, 우선 개선대상을 함께 구분합니다.
                </span>

              </div>


              <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#1E293B]">
                환자경험 전체 분석 결과
              </h2>

            </div>


            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3.5 py-2 text-xs font-bold text-[#1E293B]">

              <AlertOctagon className="h-4 w-4 text-[#B94A48]" />

              전체 {sourceDepartments.length}개
              <span className="text-[#CBD5E1]">·</span>
              개선대상 {vulnerableDepartments.length}개

            </span>

          </div>

        </div>


        {/* ==================================================
            2. FILTER
        =================================================== */}

        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">

              <Filter className="h-4 w-4 shrink-0 text-[#64748B]" />


              <span className="shrink-0 text-xs font-bold text-[#334155]">
                표시:
              </span>


              {[
                ["ALL", "전체 부서"],
                ["VULNERABLE", "개선대상"],
                ["GENERAL", "일반부서"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setViewMode(
                      value as "ALL" | "VULNERABLE" | "GENERAL"
                    )
                  }
                  className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    viewMode === value
                      ? "bg-[#243B53] font-bold text-white shadow-xs"
                      : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                  }`}
                >
                  {label}
                </button>
              ))}


              <span className="ml-2 shrink-0 text-xs font-bold text-[#334155]">
                관리등급:
              </span>


              {[
                "ALL",
                "CRITICAL",
                "HIGH",
                "MEDIUM",
                "LOW",
                "NORMAL",
              ].map(
                (
                  level
                ) => (

                  <button
                    key={
                      level
                    }
                    type="button"
                    onClick={() =>
                      setFilterPriority(
                        level
                      )
                    }
                    className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                      filterPriority ===
                      level
                        ? "bg-[#243B53] font-bold text-white shadow-xs"
                        : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                    }`}
                  >

                    {level ===
                    "ALL"
                      ? "전체 등급"
                      : level}

                  </button>
                )
              )}


              <button
                type="button"
                onClick={() =>
                  setShowPriorityGuide(
                    !showPriorityGuide
                  )
                }
                className={`ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  showPriorityGuide
                    ? "border-[#B8C7D8] bg-[#ECF2F7] text-[#243B53]"
                    : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8F9FA]"
                }`}
              >

                <HelpCircle className="h-3.5 w-3.5" />

                등급 기준

              </button>

            </div>


            <div className="relative w-full md:w-64">

              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />

              <input
                type="text"
                placeholder="부서명 / 병동명 검색..."
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
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] py-1.5 pl-8 pr-3 text-xs text-[#1E293B] transition-colors focus:border-[#243B53] focus:outline-hidden"
              />

            </div>

          </div>


          {/* =================================================
              PRIORITY GUIDE
          ================================================== */}

          {showPriorityGuide && (

            <div className="rounded-xl border border-[#D9E1EA] bg-[#F8FAFC] p-4">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <div className="flex items-center gap-1.5">

                    <Info className="h-4 w-4 text-[#243B53]" />

                    <h3 className="text-xs font-bold text-[#1E293B]">
                      관리 등급 산정 기준
                    </h3>

                  </div>


                  <p className="mt-1 text-[10px] leading-relaxed text-[#64748B]">
                    설정된 취약부서 선정 기준을 먼저 적용한 뒤,
                    선별된 분석대상의 종합점수와 동일유형 평균 대비 격차 등을 기준으로 관리 등급을 구분합니다.
                  </p>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setShowPriorityGuide(
                      false
                    )
                  }
                  className="rounded-md p-1 text-[#94A3B8] hover:bg-white hover:text-[#334155]"
                  aria-label="등급 기준 닫기"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>


              <div className="mt-3 grid gap-2 lg:grid-cols-4">

                {CX_PRIORITY_GUIDE.map(
                  (
                    item
                  ) => (

                    <div
                      key={
                        item.level
                      }
                      className="rounded-lg border border-[#E2E8F0] bg-white p-3"
                    >

                      <div className="flex items-center justify-between gap-2">

                        <PriorityBadge
                          priority={
                            item.level
                          }
                          size="sm"
                        />

                        <span className="text-[10px] font-semibold text-[#64748B]">
                          {item.title}
                        </span>

                      </div>


                      <p className="mt-2 text-[10px] leading-relaxed text-[#475569]">
                        {item.description}
                      </p>

                    </div>
                  )
                )}

              </div>


              <div className="mt-3 rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] p-2.5">

                <div className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#8C5E1E]">

                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                  <div>

                    <strong>
                      적용 참고
                    </strong>

                    <span>
                      {" "}
                      Peer Group이 최소 비교규모 미만인 경우에는 하위 백분위 기준만 제외하며,
                      절대점수 및 동일유형 평균 대비 격차 등 다른 기준은 계속 적용됩니다.
                    </span>

                  </div>

                </div>

              </div>


              <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-[#64748B]">

                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                <span>
                  전기 대비 기준은 실제 이전 조사기간 데이터가 존재하는 경우에만 적용됩니다.
                  관리등급은 우선 개선순위를 지원하기 위한 내부 관리지표이며,
                  의료서비스 품질이나 환자안전 수준을 단독으로 판정하는 지표는 아닙니다.
                </span>

              </div>

            </div>
          )}


          {/* =================================================
              PEER GROUP FILTER
          ================================================== */}

          {uniquePeerGroups.length >
            1 && (

            <div className="flex items-center gap-2 overflow-x-auto border-t border-[#EEF1F4] pt-2 scrollbar-none">

              <span className="shrink-0 text-[11px] font-bold text-[#64748B]">
                유형 그룹:
              </span>


              <button
                type="button"
                onClick={() => {
                  setFilterPeerGroup(
                    "ALL"
                  );

                  setFilterWardGroup(
                    "ALL"
                  );
                }}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                  filterPeerGroup ===
                  "ALL"
                    ? "bg-[#334155] font-bold text-white"
                    : "bg-[#F8F9FA] text-[#64748B] hover:bg-[#EEF2F6]"
                }`}
              >
                전체 현황
              </button>


              {uniquePeerGroups.map(
                (
                  peerGroup
                ) => (

                  <button
                    key={
                      peerGroup
                    }
                    type="button"
                    onClick={() => {
                      setFilterPeerGroup(
                        peerGroup
                      );

                      setFilterWardGroup(
                        "ALL"
                      );
                    }}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      filterPeerGroup ===
                      peerGroup
                        ? "bg-[#334155] font-bold text-white"
                        : "bg-[#F8F9FA] text-[#64748B] hover:bg-[#EEF2F6]"
                    }`}
                  >
                    {peerGroup}
                  </button>
                )
              )}

            </div>
          )}


          {/* =================================================
              INPATIENT WARD SUB FILTER
          ================================================== */}

          {filterPeerGroup ===
            "입원 병동" && (

            <div className="flex items-center gap-2 overflow-x-auto border-t border-[#EEF1F4] pt-2 scrollbar-none">

              <span className="shrink-0 text-[11px] font-bold text-[#64748B]">
                병동 구분:
              </span>


              {[
                ["ALL", "전체"],
                ["WARD_TEAM_1", "병동간호 1팀"],
                ["WARD_TEAM_2", "병동간호 2팀"],
                ["EXCLUDED", "순위 제외"],
              ].map(
                (
                  [
                    value,
                    label,
                  ]
                ) => (

                  <button
                    key={
                      value
                    }
                    type="button"
                    onClick={() =>
                      setFilterWardGroup(
                        value as
                          | "ALL"
                          | "WARD_TEAM_1"
                          | "WARD_TEAM_2"
                          | "EXCLUDED"
                      )
                    }
                    className={`whitespace-nowrap rounded-md border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      filterWardGroup ===
                      value
                        ? "border-[#B8C7D8] bg-[#ECF2F7] font-bold text-[#243B53]"
                        : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8F9FA]"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}

            </div>
          )}

        </div>


        {/* ==================================================
            BATCH FEEDBACK TOOLBAR
        =================================================== */}

        <div className="rounded-xl border border-[#D9E1EA] bg-white p-4 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">

            <div className="flex min-w-0 items-center gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ECF2F7]">

                <Layers3 className="h-4 w-4 text-[#243B53]" />

              </div>


              <div className="min-w-0">

                <div className="text-xs font-bold text-[#1E293B]">
                  Feedback Sheet 일괄 생성
                </div>


                <div className="mt-0.5 text-[10px] leading-relaxed text-[#64748B]">
                  유형그룹을 이동하면서 여러 병동·진료과·의사를 선택할 수 있습니다. 선택값은 그룹을 바꿔도 유지됩니다.
                </div>

              </div>

            </div>


            <div className="flex flex-wrap items-center gap-2">

              <span className="rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2 text-[11px] font-bold text-[#243B53]">
                선택 {batchSelectedDepartments.length}개
              </span>


              {filterPeerGroup !==
                "ALL" && (

                <button
                  type="button"
                  onClick={
                    toggleFilteredBatchSelection
                  }
                  disabled={
                    filteredSelectableIds.length ===
                    0
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold text-[#475569] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
                >

                  {filteredAllSelected
                    ? (
                        <CheckSquare2 className="h-3.5 w-3.5 text-[#243B53]" />
                      )
                    : (
                        <Square className="h-3.5 w-3.5" />
                      )}

                  {filteredAllSelected
                    ? "현재 목록 선택해제"
                    : "현재 목록 전체선택"}

                </button>
              )}


              {batchSelectedDepartments.length >
                0 && (

                <button
                  type="button"
                  onClick={
                    clearBatchSelection
                  }
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[11px] font-semibold text-[#64748B] hover:bg-[#F8F9FA]"
                >
                  선택 초기화
                </button>
              )}


              <button
                type="button"
                onClick={
                  requestBatchFeedbackGeneration
                }
                disabled={
                  batchSelectedDepartments.length ===
                    0 ||
                  !onGenerateBatchFeedbackSheets
                }
                title={
                  !onGenerateBatchFeedbackSheets
                    ? "다음 단계에서 App.tsx의 일괄 생성 로직을 연결합니다."
                    : batchSelectedDepartments.length ===
                      0
                    ? "Feedback Sheet를 생성할 분석대상을 선택해주세요."
                    : `${batchSelectedDepartments.length}개 Feedback Sheet 일괄 생성`
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-[11px] font-bold text-white shadow-xs hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
              >

                <FileText className="h-3.5 w-3.5" />

                선택 항목 일괄 생성

              </button>

            </div>

          </div>

        </div>


        {/* ==================================================
            3. RESULT CONTENT
        =================================================== */}

        {filterPeerGroup ===
          "ALL"
          ? (

            <div className="space-y-4">

              {/* ============================================
                  전체 현황 - 유형별 요약
              ============================================= */}

              <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">

                <div className="flex flex-col justify-between gap-2 border-b border-[#EEF1F4] bg-[#F8F9FA] px-5 py-4 sm:flex-row sm:items-center">

                  <div>

                    <h3 className="text-sm font-bold text-[#1E293B]">
                      유형별 환자경험 현황
                    </h3>

                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                      서로 다른 조사단위를 하나의 순위로 비교하지 않고, 유형별 평균점수와 개선대상 현황을 요약합니다.
                    </p>

                  </div>


                  <span className="text-[10px] font-medium text-[#94A3B8]">
                    유형 카드를 선택하면 상세 성적표로 이동합니다.
                  </span>

                </div>


                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">

                  {peerGroupSummaries.map(
                    (
                      summary
                    ) => (

                      <button
                        key={
                          summary.peerGroup
                        }
                        type="button"
                        onClick={() => {
                          setFilterPeerGroup(
                            summary.peerGroupLabel
                          );

                          setFilterWardGroup(
                            "ALL"
                          );
                        }}
                        className="group rounded-xl border border-[#E2E8F0] bg-white p-4 text-left transition-all hover:border-[#B8C7D8] hover:bg-[#F8FAFC] hover:shadow-sm"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <div className="text-xs font-bold text-[#1E293B]">
                              {summary.peerGroupLabel}
                            </div>

                            <div className="mt-2 flex items-end gap-1">

                              <span className="text-2xl font-bold tracking-tight text-[#243B53]">
                                {summary.averageScore.toFixed(
                                  1
                                )}
                              </span>

                              <span className="pb-0.5 text-[11px] font-semibold text-[#64748B]">
                                점
                              </span>

                            </div>

                            <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                              분석단위 평균
                            </div>

                          </div>


                          <span
                            className={`rounded-md border px-2 py-1 text-[10px] font-bold ${
                              summary.vulnerableCount >
                              0
                                ? "border-[#F6D3D3] bg-[#FDF2F2] text-[#B94A48]"
                                : "border-[#DCE7E1] bg-[#F2F8F5] text-[#2E7D5B]"
                            }`}
                          >
                            개선대상{" "}
                            {summary.vulnerableCount}개
                          </span>

                        </div>


                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#EEF1F4] pt-3 text-[10px]">

                          <div>

                            <span className="text-[#94A3B8]">
                              분석단위
                            </span>

                            <div className="mt-0.5 font-bold text-[#334155]">
                              {summary.totalCount}개
                            </div>

                          </div>


                          <div>

                            <span className="text-[#94A3B8]">
                              총 표본
                            </span>

                            <div className="mt-0.5 font-bold text-[#334155]">
                              {summary.totalSample.toLocaleString()}명
                            </div>

                          </div>

                        </div>


                        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-semibold text-[#64748B] transition-colors group-hover:text-[#243B53]">

                          상세보기

                          <ArrowRight className="h-3 w-3" />

                        </div>

                      </button>
                    )
                  )}

                </div>

              </div>


              {/* ============================================
                  전체 현황 - 우선 확인 대상
              ============================================= */}

              <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">

                <div className="flex flex-col justify-between gap-2 border-b border-[#EEF1F4] bg-[#F8F9FA] px-5 py-4 sm:flex-row sm:items-center">

                  <div>

                    <h3 className="text-sm font-bold text-[#1E293B]">
                      우선 확인 대상
                    </h3>

                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                      현재 설정된 선별 기준에 해당하는 개선대상 중 관리등급과 점수를 기준으로 우선 확인이 필요한 항목만 표시합니다.
                    </p>

                  </div>


                  <span className="rounded-md border border-[#F6D3D3] bg-[#FDF2F2] px-2.5 py-1 text-[10px] font-bold text-[#B94A48]">
                    최대 8개 표시
                  </span>

                </div>


                {overviewPriorityDepartments.length ===
                0
                  ? (

                    <div className="px-5 py-12 text-center text-xs text-[#94A3B8]">
                      현재 설정된 기준에 해당하는 개선대상이 없습니다.
                    </div>

                  )
                  : (

                    <div className="divide-y divide-[#F1F5F9]">

                      {overviewPriorityDepartments.map(
                        (
                          department,
                          index
                        ) => (

                          <div
                            key={
                              department.id
                            }
                            className="flex flex-col justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[#F8F9FA] sm:flex-row sm:items-center"
                          >

                            <div className="flex min-w-0 items-center gap-3">

                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ECF2F7] text-[10px] font-bold text-[#243B53]">
                                {index + 1}
                              </span>


                              <div className="min-w-0">

                                <div className="flex flex-wrap items-center gap-1.5">

                                  <span className="truncate text-xs font-bold text-[#1E293B]">
                                    {department.displayName ||
                                      department.name}
                                  </span>

                                  <PriorityBadge
                                    priority={
                                      department.priority
                                    }
                                    size="sm"
                                  />

                                </div>


                                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-[#64748B]">

                                  <span>
                                    {department.peerGroupLabel ||
                                      department.type}
                                  </span>

                                  <span className="text-[#CBD5E1]">
                                    ·
                                  </span>

                                  <span>
                                    표본{" "}
                                    {department.sampleSize}명
                                  </span>

                                  {department.peerGroupGap !==
                                    undefined && (

                                    <>
                                      <span className="text-[#CBD5E1]">
                                        ·
                                      </span>

                                      <span
                                        className={
                                          department.peerGroupGap <
                                          0
                                            ? "font-semibold text-[#B94A48]"
                                            : "font-semibold text-[#2E7D5B]"
                                        }
                                      >
                                        평균 대비{" "}
                                        {formatSigned(
                                          department.peerGroupGap
                                        )}
                                      </span>
                                    </>
                                  )}

                                </div>

                              </div>

                            </div>


                            <div className="flex shrink-0 items-center justify-end gap-3">

                              <div className="text-right">

                                <div className="text-sm font-bold text-[#1E293B]">
                                  {department.overallScore.toFixed(
                                    1
                                  )}
                                  점
                                </div>

                                <div className="text-[9px] text-[#94A3B8]">
                                  현재점수
                                </div>

                              </div>


                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedDeptForDrawer(
                                    department
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#334155] hover:bg-[#F8F9FA]"
                              >

                                <Eye className="h-3 w-3" />

                                상세보기

                              </button>

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )}

              </div>

            </div>

          )
          : (

            <>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs">

              <thead className="border-b border-[#EEF1F4] bg-[#F8F9FA] font-semibold text-[#64748B]">

                <tr>

                  <th className="w-12 px-3 py-3 text-center">

                    <input
                      type="checkbox"
                      checked={
                        filteredAllSelected
                      }
                      onChange={
                        toggleFilteredBatchSelection
                      }
                      disabled={
                        filteredSelectableIds.length ===
                        0
                      }
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                      aria-label="현재 목록 전체 선택"
                    />

                  </th>

                  <th className="px-4 py-3">
                    선별 / 등급
                  </th>

                  <th className="px-4 py-3">
                    부서명
                  </th>

                  <th className="px-3 py-3 text-center">
                    병동 구분
                  </th>

                  <th className="px-3 py-3 text-center">
                    그룹 내 순위
                  </th>

                  <th className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setScoreSort(
                          scoreSort === "DESC"
                            ? "ASC"
                            : "DESC"
                        )
                      }
                      className="ml-auto inline-flex items-center gap-1 font-semibold text-[#475569] hover:text-[#243B53]"
                    >
                      현재점수
                      <ArrowUpDown className="h-3 w-3" />
                      <span className="text-[9px] font-medium text-[#94A3B8]">
                        {scoreSort === "DESC"
                          ? "높은순"
                          : "낮은순"}
                      </span>
                    </button>
                  </th>

                  <th className="px-3 py-3 text-right">
                    전기 대비
                  </th>

                  <th className="px-4 py-3">
                    주요 이슈 (선정 사유)
                  </th>

                  <th className="px-3 py-3 text-center">
                    상태
                  </th>

                  <th className="px-4 py-3 text-center">
                    작업
                  </th>

                </tr>

              </thead>


              <tbody className="divide-y divide-[#F1F5F9]">

                {filtered.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={
                        10
                      }
                      className="py-12 text-center text-[#94A3B8]"
                    >
                      현재 필터 조건에 해당하는 부서가 없습니다.
                    </td>

                  </tr>

                ) : (

                  filtered.map(
                    (
                      department
                    ) => {

                      const isSelected =
                        selectedDeptForDrawer
                          ?.id ===
                        department.id;


                      const isBatchSelected =
                        batchSelectedIdSet.has(
                          department.id
                        );


                      const hasPrevious =
                        hasPreviousData(
                          department
                        );


                      const isVulnerable =
                        vulnerableDepartmentIds.has(
                          department.id
                        );


                      const rankGroupLabel =
                        getRankGroupLabel(
                          department
                        );


                      const rankExcluded =
                        isRankExcluded(
                          department
                        );


                      return (

                        <tr
                          key={
                            department.id
                          }
                          onClick={() =>
                            setSelectedDeptForDrawer(
                              department
                            )
                          }
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#F1F5F9]"
                              : isVulnerable
                              ? "bg-[#FFFDFD] hover:bg-[#FFF8F8]"
                              : "hover:bg-[#F8F9FA]"
                          }`}
                        >

                          <td
                            className="px-3 py-3.5 text-center"
                            onClick={
                              (
                                event
                              ) =>
                                event.stopPropagation()
                            }
                          >

                            <input
                              type="checkbox"
                              checked={
                                isBatchSelected
                              }
                              onChange={() =>
                                toggleBatchDepartment(
                                  department.id
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#243B53] focus:ring-[#243B53]"
                              aria-label={`${department.displayName || department.name} 선택`}
                            />

                          </td>


                          <td className="px-4 py-3.5">

                            <div className="flex flex-col items-start gap-1">

                              {isVulnerable
                                ? (
                                  <span className="inline-flex rounded-md border border-[#F6D3D3] bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-bold text-[#B94A48]">
                                    개선대상
                                  </span>
                                )
                                : (
                                  <span className="inline-flex rounded-md border border-[#DCE7E1] bg-[#F2F8F5] px-2 py-0.5 text-[10px] font-bold text-[#2E7D5B]">
                                    일반
                                  </span>
                                )}

                              {isVulnerable && (
                                <PriorityBadge
                                  priority={
                                    department.priority
                                  }
                                />
                              )}

                            </div>

                          </td>


                          <td className="px-4 py-3.5">

                            <div className="text-xs font-bold text-[#1E293B]">
                              {department.displayName ||
                                department.name}
                            </div>


                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">

                              <span>
                                {department.peerGroupLabel ||
                                  department.type}
                              </span>

                              <span>
                                · 표본{" "}
                                {department.sampleSize}
                                명
                              </span>

                            </div>

                          </td>


                          <td className="px-3 py-3.5 text-center">

                            {department.peerGroup ===
                              "INPATIENT_WARD"
                              ? (

                                <div className="inline-flex flex-col items-center gap-1">

                                  {getInpatientWardRankGroup(
                                    department
                                  ) === "WARD_TEAM_1"
                                    ? (
                                      <span className="inline-flex min-w-[88px] items-center justify-center rounded-md border border-[#C8D9E8] bg-[#ECF2F7] px-2.5 py-1 text-[10px] font-bold text-[#243B53]">
                                        병동간호 1팀
                                      </span>
                                    )
                                    : getInpatientWardRankGroup(
                                        department
                                      ) === "WARD_TEAM_2"
                                    ? (
                                      <span className="inline-flex min-w-[88px] items-center justify-center rounded-md border border-[#D8DCE7] bg-[#F3F4F8] px-2.5 py-1 text-[10px] font-bold text-[#475569]">
                                        병동간호 2팀
                                      </span>
                                    )
                                    : getInpatientWardRankGroup(
                                        department
                                      ) === "EXCLUDED"
                                    ? (
                                      <span className="inline-flex min-w-[88px] items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F8F9FA] px-2.5 py-1 text-[10px] font-bold text-[#64748B]">
                                        순위 제외
                                      </span>
                                    )
                                    : (
                                      <span className="inline-flex min-w-[88px] items-center justify-center rounded-md border border-[#F1DFC2] bg-[#FFF8EA] px-2.5 py-1 text-[10px] font-bold text-[#8C5E1E]">
                                        미분류
                                      </span>
                                    )}

                                </div>

                              )
                              : (
                                <span className="text-[11px] text-[#CBD5E1]">
                                  -
                                </span>
                              )}

                          </td>


                          <td className="px-3 py-3.5 text-center">

                            <div className="inline-flex flex-col items-center">

                              {rankExcluded
                                ? (

                                  <>
                                    <span className="rounded border border-[#E2E8F0] bg-[#F8F9FA] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                                      순위 제외
                                    </span>

                                    {department.peerGroup ===
                                      "INPATIENT_WARD" && (

                                      <span className="mt-0.5 text-[9px] text-[#94A3B8]">
                                        별도 관리 병동
                                      </span>
                                    )}
                                  </>

                                )
                                : (

                                  <>
                                    <span className="rounded bg-[#ECF2F7] px-2 py-0.5 text-[11px] font-bold text-[#243B53]">

                                      {department.peerGroupRank ||
                                        department.rank}
                                      위 /{" "}
                                      {department.peerGroupSize ||
                                        department.totalRanked}
                                      개

                                    </span>


                                    {department.peerGroup !==
                                      "INPATIENT_WARD" && (

                                      <span className="mt-0.5 text-[9px] font-semibold text-[#64748B]">
                                        {rankGroupLabel} 기준
                                      </span>
                                    )}


                                    {department.peerGroupPercentile !==
                                      undefined &&
                                      !department.isSmallPeerGroup && (

                                      <span className="mt-0.5 text-[10px] font-medium text-[#B94A48]">
                                        순위 위치{" "}
                                        {department.peerGroupPercentile}%
                                      </span>
                                    )}


                                    {department.isSmallPeerGroup && (

                                      <span className="mt-0.5 text-[9px] text-[#94A3B8]">
                                        소그룹 · 백분위 참고
                                      </span>
                                    )}
                                  </>

                                )}

                            </div>

                          </td>


                          <td className="px-3 py-3.5 text-right text-sm font-bold text-[#1E293B]">

                            {department.overallScore.toFixed(
                              1
                            )}
                            점

                          </td>


                          <td className="px-3 py-3.5 text-right">

                            {hasPrevious
                              ? (
                                <ScoreDelta
                                  delta={
                                    department.scoreChange
                                  }
                                />
                              )
                              : (
                                <span className="text-xs text-[#94A3B8]">
                                  -
                                </span>
                              )}

                          </td>


                          <td className="max-w-sm px-4 py-3.5 text-[#475569]">

                            {isVulnerable &&
                            department.vulnerabilityReasons.length > 0
                              ? (
                                <p
                                  className="truncate text-xs font-medium"
                                  title={
                                    department.vulnerabilityReasons[0]
                                  }
                                >
                                  {department.vulnerabilityReasons[0]}
                                </p>
                              )
                              : (
                                <span className="text-xs text-[#94A3B8]">
                                  선정 대상 아님
                                </span>
                              )}

                          </td>


                          <td className="px-3 py-3.5 text-center">

                            <StatusBadge
                              status={
                                department.status
                              }
                              size="sm"
                            />

                          </td>


                          <td
                            className="px-4 py-3.5 text-center"
                            onClick={
                              (
                                event
                              ) =>
                                event.stopPropagation()
                            }
                          >

                            <div className="flex items-center justify-center gap-1.5">

                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedDeptForDrawer(
                                    department
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA]"
                              >

                                <Eye className="h-3 w-3" />

                                상세보기

                              </button>


                              <button
                                type="button"
                                onClick={() =>
                                  onGenerateFeedbackSheet(
                                    department
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-[#243B53] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#1B2F44]"
                              >

                                <FileText className="h-3 w-3" />

                                시트 생성

                              </button>

                            </div>

                          </td>

                        </tr>
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

        {/* ==================================================
            4. DETAIL DRAWER
        =================================================== */}

        {selectedDeptForDrawer && (() => {

          const hasPrevious =
            hasPreviousData(
              selectedDeptForDrawer
            );


          const selectedIsVulnerable =
            vulnerableDepartmentIds.has(
              selectedDeptForDrawer.id
            );


          const selectedRankGroupLabel =
            getRankGroupLabel(
              selectedDeptForDrawer
            );


          const selectedRankExcluded =
            isRankExcluded(
              selectedDeptForDrawer
            );


          return (

            <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">

              <div className="flex h-full w-full max-w-md flex-col justify-between overflow-y-auto border-l border-[#E2E8F0] bg-white p-6 shadow-2xl animate-slideLeft">

                <div>

                  {/* =========================================
                      HEADER
                  ========================================== */}

                  <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-3">

                    <div className="flex items-center gap-2">

                      <Building2 className="h-5 w-5 text-[#243B53]" />


                      <div>

                        <h3 className="text-base font-bold text-[#1E293B]">

                          {selectedDeptForDrawer.displayName ||
                            selectedDeptForDrawer.name}

                        </h3>


                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">

                          <span>
                            {selectedDeptForDrawer.peerGroupLabel ||
                              selectedDeptForDrawer.type}
                          </span>


                          {selectedDeptForDrawer.peerGroup ===
                            "INPATIENT_WARD" && (

                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                selectedRankExcluded
                                  ? "bg-[#F1F5F9] text-[#64748B]"
                                  : "bg-[#ECF2F7] text-[#243B53]"
                              }`}
                            >
                              {selectedRankGroupLabel}
                            </span>
                          )}

                        </div>

                      </div>

                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDeptForDrawer(
                          null
                        )
                      }
                      className="rounded-md p-1 text-[#94A3B8] hover:bg-[#EEF2F6] hover:text-[#1E293B]"
                    >
                      <X className="h-5 w-5" />
                    </button>

                  </div>


                  {/* =========================================
                      SCORE SUMMARY
                  ========================================== */}

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-3.5 text-center text-xs">

                    <div>

                      <span className="font-medium text-[#64748B]">
                        현재점수
                      </span>

                      <div className="mt-0.5 text-lg font-bold text-[#1E293B]">

                        {selectedDeptForDrawer.overallScore.toFixed(
                          1
                        )}
                        점

                      </div>

                    </div>


                    <div className="border-l border-[#EEF1F4]">

                      <span className="font-medium text-[#64748B]">
                        전기 대비
                      </span>

                      <div className="mt-0.5">

                        {hasPrevious
                          ? (
                            <ScoreDelta
                              delta={
                                selectedDeptForDrawer.scoreChange
                              }
                              className="text-xs font-bold"
                            />
                          )
                          : (
                            <span className="text-[10px] font-medium text-[#94A3B8]">
                              비교 데이터 없음
                            </span>
                          )}

                      </div>

                    </div>


                    <div className="border-l border-[#EEF1F4]">

                      <span className="font-medium text-[#64748B]">
                        동일유형 대비
                      </span>

                      <div
                        className={`mt-0.5 text-sm font-bold ${
                          selectedDeptForDrawer.peerGroupGap ===
                            undefined
                            ? "text-[#94A3B8]"
                            : selectedDeptForDrawer.peerGroupGap <
                              0
                            ? "text-[#B94A48]"
                            : "text-[#2E7D5B]"
                        }`}
                      >

                        {selectedDeptForDrawer.peerGroupGap !==
                        undefined
                          ? formatSigned(
                              selectedDeptForDrawer.peerGroupGap
                            )
                          : "-"}

                      </div>

                    </div>

                  </div>


                  {/* =========================================
                      PEER GROUP
                  ========================================== */}

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#D9E1EA] bg-[#ECF2F7] p-3 text-xs">

                    <div>

                      <span className="text-[11px] font-medium text-[#475569]">

                        {selectedDeptForDrawer.peerGroup ===
                          "INPATIENT_WARD"
                          ? selectedRankExcluded
                            ? "입원 병동 순위"
                            : `${selectedRankGroupLabel} 내 순위`
                          : `동일 유형(${selectedDeptForDrawer.peerGroupLabel}) 내 순위`}

                      </span>


                      <div className="text-sm font-bold text-[#243B53]">

                        {selectedRankExcluded
                          ? "순위 제외"
                          : (
                            <>
                              {selectedDeptForDrawer.peerGroupRank ||
                                selectedDeptForDrawer.rank}
                              위 /{" "}
                              {selectedDeptForDrawer.peerGroupSize ||
                                selectedDeptForDrawer.totalRanked}
                              개
                            </>
                          )}

                      </div>


                      {selectedRankExcluded &&
                        selectedDeptForDrawer.peerGroup ===
                          "INPATIENT_WARD" && (

                        <div className="mt-0.5 text-[9px] font-medium text-[#64748B]">
                          별도 관리 병동으로 팀별 순위에서 제외
                        </div>
                      )}

                    </div>


                    {!selectedRankExcluded &&
                      selectedDeptForDrawer.peerGroupPercentile !==
                        undefined &&
                      !selectedDeptForDrawer.isSmallPeerGroup && (

                      <span className="rounded-md border border-[#F6D3D3] bg-white px-2.5 py-1 text-xs font-bold text-[#B94A48]">

                        순위 위치{" "}
                        {selectedDeptForDrawer.peerGroupPercentile}
                        %

                      </span>
                    )}

                  </div>


                  {/* =========================================
                      MANAGEMENT LEVEL
                  ========================================== */}

                  <div className="mt-3 space-y-2">

                    <div className="flex items-center justify-between rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-2.5 text-xs">

                      <span className="font-semibold text-[#64748B]">
                        관리 등급 / 상태
                      </span>


                      <div className="flex items-center gap-1.5">

                        {selectedIsVulnerable
                          ? (
                            <PriorityBadge
                              priority={
                                selectedDeptForDrawer.priority
                              }
                              size="sm"
                            />
                          )
                          : (
                            <span className="rounded-md border border-[#DCE7E1] bg-[#F2F8F5] px-2 py-0.5 text-[10px] font-bold text-[#2E7D5B]">
                              일반
                            </span>
                          )}

                        <StatusBadge
                          status={
                            selectedDeptForDrawer.status
                          }
                          size="sm"
                        />

                      </div>

                    </div>


                    <div className="flex items-center justify-between rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-2.5 text-xs">

                      <span className="flex items-center gap-1 font-semibold text-[#64748B]">

                        <MessageSquareWarning className="h-3.5 w-3.5" />

                        연결 VOC

                      </span>


                      <span className="font-bold text-[#334155]">

                        총{" "}
                        {selectedDeptForDrawer.vocCount}
                        건

                        {selectedDeptForDrawer.vocCount >
                          0 &&
                          Number.isFinite(
                            selectedDeptForDrawer
                              .negativeVocRatio
                          ) && (
                          <>
                            {" · "}
                            부정{" "}
                            {Math.round(
                              selectedDeptForDrawer
                                .negativeVocRatio *
                                100
                            )}
                            %
                          </>
                        )}

                      </span>

                    </div>

                  </div>


                  {/* =========================================
                      REASONS
                  ========================================== */}

                  <div className="mt-5">

                    <h4 className="mb-2 text-xs font-bold text-[#1E293B]">
                      {selectedIsVulnerable
                        ? "우선 개선대상 선정 사유"
                        : "선별 결과"}
                    </h4>


                    {selectedIsVulnerable &&
                    selectedDeptForDrawer.vulnerabilityReasons.length > 0
                      ? (
                        <ul className="space-y-1.5 rounded-xl border border-[#EEF1F4] bg-[#F8F9FA] p-3.5 text-xs text-[#334155]">

                          {selectedDeptForDrawer.vulnerabilityReasons.map(
                            (
                              reason,
                              index
                            ) => (

                              <li
                                key={
                                  index
                                }
                                className="flex items-start gap-1.5"
                              >

                                <span className="font-bold text-[#B94A48]">
                                  •
                                </span>

                                <span>
                                  {reason}
                                </span>

                              </li>
                            )
                          )}

                        </ul>
                      )
                      : (
                        <div className="rounded-xl border border-[#EEF1F4] bg-[#F8F9FA] p-3 text-xs text-[#64748B]">
                          {selectedIsVulnerable
                            ? "선정 사유 정보가 없습니다."
                            : "현재 설정된 선별 기준에서는 우선 개선대상에 해당하지 않습니다."}
                        </div>
                      )}

                  </div>


                  {/* =========================================
                      DOMAIN SCORES
                  ========================================== */}

                  <div className="mt-5">

                    <h4 className="mb-2 text-xs font-bold text-[#1E293B]">
                      평가영역별 점수 현황
                    </h4>


                    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white text-xs">

                      <table className="w-full text-left">

                        <thead className="border-b border-[#EEF1F4] bg-[#F8F9FA] font-semibold text-[#64748B]">

                          <tr>

                            <th className="px-3 py-2">
                              영역명
                            </th>

                            <th className="px-2.5 py-2 text-right">
                              점수
                            </th>

                            {hasPrevious && (
                              <th className="px-2.5 py-2 text-right">
                                증감
                              </th>
                            )}

                            <th className="px-2.5 py-2 text-center">
                              상태
                            </th>

                          </tr>

                        </thead>


                        <tbody className="divide-y divide-[#F1F5F9]">

                          {selectedDeptForDrawer.domains.map(
                            (
                              domain
                            ) => (

                              <tr
                                key={
                                  domain.domainId ||
                                  domain.domainName
                                }
                              >

                                <td className="px-3 py-2 font-medium text-[#1E293B]">
                                  {domain.domainName}
                                </td>

                                <td className="px-2.5 py-2 text-right font-semibold text-[#1E293B]">
                                  {domain.currentScore.toFixed(
                                    1
                                  )}
                                </td>


                                {hasPrevious && (

                                  <td className="px-2.5 py-2 text-right">

                                    <ScoreDelta
                                      delta={
                                        domain.change
                                      }
                                      className="text-[11px]"
                                    />

                                  </td>
                                )}


                                <td className="px-2.5 py-2 text-center">

                                  <StatusBadge
                                    status={
                                      domain.status
                                    }
                                    size="sm"
                                  />

                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                </div>


                {/* ===========================================
                    ACTIONS
                ============================================ */}

                <div className="mt-6 space-y-2 border-t border-[#EEF1F4] pt-5">

                  <button
                    type="button"
                    onClick={() => {

                      onGenerateFeedbackSheet(
                        selectedDeptForDrawer
                      );

                      setSelectedDeptForDrawer(
                        null
                      );
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#243B53] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1B2F44]"
                  >

                    <FileText className="h-4 w-4" />

                    <span>
                      Feedback Sheet 생성
                    </span>

                  </button>


                  <button
                    type="button"
                    onClick={() => {

                      onSelectDepartment(
                        selectedDeptForDrawer.id
                      );

                      setSelectedDeptForDrawer(
                        null
                      );
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA]"
                  >

                    <span>
                      부서 정밀 진단 화면으로 이동
                    </span>

                    <ArrowRight className="h-3.5 w-3.5" />

                  </button>

                </div>

              </div>

            </div>
          );
        })()}

      </div>
    );
  };