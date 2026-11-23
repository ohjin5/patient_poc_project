import {
  AnalysisScopeConfig,
  DepartmentSummary,
  CriteriaConfig,
  RiskLevel,
  StatusCategory,
  BenchmarkComparison,
  RawVocItem,
  VocCategory,
  PeerGroup,
  DomainScore,
  QuestionScore,
  CXFeedbackSheetData,
  WardNursingTeam,
  WardTeamExcelReportData,
  WardTeamReportRow,
  WardTeamSummary,
} from "../types";

/**
 * ============================================================
 * CX Analysis Engine
 * ============================================================
 *
 * 역할
 *
 * 1. 동일 Peer Group 내 평균 / 순위 / 백분위 계산
 * 2. 각 Sheet의 "은평성모병원" 공식 기준값 보존
 * 3. 영역별 Peer 평균 및 우수점수 계산
 * 4. 세부문항별 Peer 평균 / 순위 / 우수점수 계산
 * 5. 우선 개선대상 선정
 *    - 절대점수
 *    - 평균 대비 격차
 *    - 최소 표본수
 * 6. Benchmark 정량정보 생성
 *
 * 중요 원칙
 *
 * - 서로 다른 Peer Group을 섞어 순위를 계산하지 않음
 * - 하위 백분위는 참고용 순위정보로만 계산하고 선별조건에는 사용하지 않음
 * - 병원 기준값은 Normalization 단계에서 읽은
 *   "은평성모병원" 행을 사용
 * - 존재하지 않는 전기점수를 임의 생성하지 않음
 * - 실제 근거 없는 Benchmark 모범사례를 만들지 않음
 */

/**
 * ============================================================
 * 관리등급 공통 기준
 * ============================================================
 *
 * 중요:
 * - AnalysisEngine의 실제 판정과 UI 도움말이 같은 값을 사용하도록
 *   한 곳에서 관리합니다.
 * - 관리등급은 현재점수와 동일유형 평균 대비 격차만 사용합니다.
 * - 전기 대비 하락 및 하위 백분위는 취약부서 선별조건으로 사용하지 않습니다.
 */
export const CX_PRIORITY_THRESHOLDS = {
  CRITICAL: {
    scoreBelow: 75,
    peerGapAtOrBelow: -6,
    label: "최우선 개선",
  },
  HIGH: {
    scoreBelow: 78,
    peerGapAtOrBelow: -4,
    label: "우선 개선",
  },
  MEDIUM: {
    scoreBelow: 82,
    peerGapBelow: -2,
    label: "개선 필요",
  },
  LOW: {
    scoreAtOrAbove: 82,
    peerGapAtOrAbove: -2,
    label: "관찰 필요",
  },
  NORMAL: {
    scoreAtOrAbove: 88,
    peerGapAtOrAbove: -1,
    label: "양호",
  },
} as const;


/**
 * 영역/세부문항 상태 기준
 *
 * 부서 관리등급과는 별개의 표시용 상태 기준입니다.
 */
export const CX_SCORE_STATUS_THRESHOLDS = {
  DANGER: {
    scoreBelow: 75,
    peerGapAtOrBelow: -6,
  },
  NEEDS_IMPROVEMENT: {
    scoreBelow: 80,
    peerGapAtOrBelow: -4,
  },
  WATCH: {
    scoreBelow: 85,
    peerGapBelow: -2,
  },
} as const;


/**
 * 취약부서 화면의 등급 도움말에서 사용할 공통 설명입니다.
 * 숫자를 별도 하드코딩하지 않고 위 기준값에서 생성합니다.
 */
export const CX_PRIORITY_GUIDE = [
  {
    level: "CRITICAL" as const,
    title: CX_PRIORITY_THRESHOLDS.CRITICAL.label,
    description:
      `취약부서로 선정된 분석대상 중 종합점수 ${CX_PRIORITY_THRESHOLDS.CRITICAL.scoreBelow}점 미만 또는 ` +
      `동일유형 평균 대비 ${CX_PRIORITY_THRESHOLDS.CRITICAL.peerGapAtOrBelow}점 이하인 경우`,
  },
  {
    level: "HIGH" as const,
    title: CX_PRIORITY_THRESHOLDS.HIGH.label,
    description:
      `CRITICAL에 해당하지 않으면서 종합점수 ${CX_PRIORITY_THRESHOLDS.HIGH.scoreBelow}점 미만 또는 ` +
      `동일유형 평균 대비 ${CX_PRIORITY_THRESHOLDS.HIGH.peerGapAtOrBelow}점 이하인 경우`,
  },
  {
    level: "MEDIUM" as const,
    title: CX_PRIORITY_THRESHOLDS.MEDIUM.label,
    description:
      `CRITICAL·HIGH에 해당하지 않으면서 종합점수 ${CX_PRIORITY_THRESHOLDS.MEDIUM.scoreBelow}점 미만 또는 ` +
      `동일유형 평균 대비 ${CX_PRIORITY_THRESHOLDS.MEDIUM.peerGapBelow}점 미만인 경우`,
  },
  {
    level: "LOW" as const,
    title: CX_PRIORITY_THRESHOLDS.LOW.label,
    description:
      "취약부서 선정조건에는 해당하지만 CRITICAL·HIGH·MEDIUM의 추가 관리기준에는 해당하지 않는 경우",
  },
] as const;


type InpatientWardRankGroup =
  | "NURSING_TEAM_1"
  | "NURSING_TEAM_2"
  | "EXCLUDED";


interface InpatientWardRankInfo {
  group: InpatientWardRankGroup;
  rank: number;
  size: number;
  percentile: number;
  isSmallGroup: boolean;
}


/**
 * ============================================================
 * 전체 현황 Dashboard Types
 * ============================================================
 */

export interface PeerGroupOverviewSummary {
  peerGroup:
    PeerGroup;

  peerGroupLabel:
    string;

  averageScore:
    number;

  vulnerableCount:
    number;

  totalCount:
    number;

  totalSample:
    number;
}


export interface OverviewDashboardData {
  peerGroups:
    PeerGroupOverviewSummary[];

  priorityDepartments:
    DepartmentSummary[];
}


/**
 * ============================================================
 * 기간 비교 Types
 * ============================================================
 */

export type PeriodComparisonChangeStatus =
  | "NEW_VULNERABLE"
  | "RESOLVED_VULNERABLE"
  | "PERSISTENT_VULNERABLE"
  | "STABLE_GENERAL"
  | "NEW_UNIT"
  | "NOT_COMPARABLE";


export interface PeriodComparisonItem {
  comparisonKey:
    string;

  departmentId:
    string;

  departmentName:
    string;

  peerGroup:
    PeerGroup;

  peerGroupLabel:
    string;

  parentDepartment?:
    string;

  previousPeriod:
    string;

  currentPeriod:
    string;

  previousScore:
    number | null;

  currentScore:
    number | null;

  scoreChange:
    number | null;

  previousSampleSize:
    number | null;

  currentSampleSize:
    number | null;

  sampleSizeChange:
    number | null;

  previousPeerGroupGap:
    number | null;

  currentPeerGroupGap:
    number | null;

  peerGroupGapChange:
    number | null;

  wasVulnerable:
    boolean | null;

  isVulnerable:
    boolean | null;

  changeStatus:
    PeriodComparisonChangeStatus;

  isComparable:
    boolean;
}


export interface PeriodComparisonSummary {
  previousPeriod:
    string;

  currentPeriod:
    string;

  totalItems:
    number;

  comparableCount:
    number;

  newVulnerableCount:
    number;

  resolvedVulnerableCount:
    number;

  persistentVulnerableCount:
    number;

  stableGeneralCount:
    number;

  newUnitCount:
    number;

  notComparableCount:
    number;

  averageScoreChange:
    number | null;
}


export interface PeriodComparisonResult {
  summary:
    PeriodComparisonSummary;

  items:
    PeriodComparisonItem[];
}


/**
 * 전체 현황에서 사용할 고정 표시 순서
 *
 * 서로 다른 조사단위를 하나의 전체 순위로 섞지 않고,
 * 아래 순서로 유형별 현황만 제공합니다.
 */
export const CX_PEER_GROUP_DISPLAY_ORDER:
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


export class AnalysisEngine {
  /**
   * ==========================================================
   * Public API
   * ==========================================================
   */

  public static calculateRankingsAndStatus(
    departments: DepartmentSummary[],
    criteria: CriteriaConfig,
    analysisScope?: AnalysisScopeConfig
  ): DepartmentSummary[] {
    return this.evaluateDepartments(
      departments,
      criteria,
      analysisScope
    ).evaluatedList;
  }


  public static filterVulnerableDepartments(
    departments: DepartmentSummary[],
    criteria: CriteriaConfig,
    analysisScope?: AnalysisScopeConfig
  ): DepartmentSummary[] {
    return this.evaluateDepartments(
      departments,
      criteria,
      analysisScope
    ).vulnerableList;
  }


  /**
   * ==========================================================
   * Analysis Scope
   * ==========================================================
   *
   * 중요한 원칙:
   *
   * 분석대상 선택은 "이번 분석에 어떤 분석단위를 보여주고
   * 개선대상으로 선별할지"를 제한하는 기능입니다.
   *
   * 동일유형 평균 / 순위 / Benchmark 모집단은
   * 전체 원본 Peer Group을 그대로 사용합니다.
   *
   * 예:
   * 사용자가 입원병동 101Unit만 선택해도
   * 101Unit의 병동간호팀 순위나 INPATIENT_WARD 평균이
   * 101Unit 단독 기준으로 재계산되지 않습니다.
   */
  public static filterDepartmentsByAnalysisScope(
    departments: DepartmentSummary[],
    analysisScope?: AnalysisScopeConfig
  ): DepartmentSummary[] {

    const safeDepartments =
      Array.isArray(
        departments
      )
        ? departments
        : [];


    if (
      !analysisScope ||
      analysisScope.selectAll
    ) {
      return safeDepartments;
    }


    const selectedDepartmentIds =
      new Set(
        Array.isArray(
          analysisScope.selectedDepartmentIds
        )
          ? analysisScope.selectedDepartmentIds
          : []
      );


    /**
     * 세부 분석단위 ID가 하나라도 선택되어 있으면
     * ID 선택을 최우선으로 사용합니다.
     */
    if (
      selectedDepartmentIds.size >
      0
    ) {

      return safeDepartments.filter(
        (
          department
        ) =>
          selectedDepartmentIds.has(
            department.id
          )
      );
    }


    /**
     * 호환용 fallback:
     * 아직 개별 ID가 없고 유형그룹만 선택된 경우
     * 해당 Peer Group 전체를 분석범위로 사용합니다.
     */
    const selectedPeerGroups =
      new Set(
        Array.isArray(
          analysisScope.selectedPeerGroups
        )
          ? analysisScope.selectedPeerGroups
          : []
      );


    if (
      selectedPeerGroups.size >
      0
    ) {

      return safeDepartments.filter(
        (
          department
        ) =>
          selectedPeerGroups.has(
            department.peerGroup
          )
      );
    }


    /**
     * selectAll=false인데 아무 대상도 선택하지 않은 경우
     * 빈 분석범위로 처리합니다.
     */
    return [];
  }


  /**
   * ==========================================================
   * Ward Nursing Team Excel Report Data
   * ==========================================================
   *
   * 병동간호 1팀 / 2팀 종합 Excel에서 사용할 데이터를 생성합니다.
   *
   * 중요 원칙
   * - 사용자의 Analysis Scope 선택과 무관하게 전체 입원병동 모집단으로 계산
   * - 기존 병동간호 1팀 / 2팀 분류 규칙을 그대로 재사용
   * - 팀 내 순위는 기존 evaluateDepartments()가 계산한 값을 그대로 사용
   * - 동일유형 평균 / 영역 Peer 정보는 전체 INPATIENT_WARD 기준 유지
   * - 순위 제외 병동은 이 보고서의 1·2팀 목록에서는 제외
   * - 최저 영역은 실제 업로드된 영역점수 중 최소값만 사용
   * - Feedback Sheet가 생성되지 않은 병동은 정량정보만 포함
   */
  public static buildWardTeamExcelReportData(
    departments:
      DepartmentSummary[],
    criteria:
      CriteriaConfig,
    period:
      string,
    feedbackSheets:
      CXFeedbackSheetData[] = []
  ): WardTeamExcelReportData {

    const safeDepartments =
      Array.isArray(
        departments
      )
        ? departments
        : [];


    /**
     * scope를 전달하지 않아 전체 원본 Peer Group을 기준으로 평가합니다.
     */
    const evaluatedDepartments =
      this.calculateRankingsAndStatus(
        safeDepartments,
        criteria
      );


    const wardDepartments =
      evaluatedDepartments.filter(
        (
          department
        ) =>
          department.peerGroup ===
          "INPATIENT_WARD"
      );


    const rows:
      WardTeamReportRow[] =
        wardDepartments
          .map(
            (
              department
            ) => {

              const classified =
                this.classifyInpatientWard(
                  department
                );


              const team:
                WardNursingTeam =
                  classified ===
                    "NURSING_TEAM_1"
                    ? "NURSING_TEAM_1"
                    : classified ===
                      "NURSING_TEAM_2"
                    ? "NURSING_TEAM_2"
                    : classified ===
                      "EXCLUDED"
                    ? "EXCLUDED"
                    : "UNASSIGNED";


              /**
               * 실제 영역점수 중 유효한 값만 비교합니다.
               */
              const validDomains =
                (
                  department.domains ||
                  []
                )
                  .filter(
                    (
                      domain
                    ) =>
                      Number.isFinite(
                        domain.currentScore
                      )
                  )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      a.currentScore -
                      b.currentScore
                  );


              const lowestDomain =
                validDomains[0];


              return {
                team,

                departmentId:
                  department.id,

                departmentName:
                  department.displayName ||
                  department.name,

                period:
                  period ||
                  "",

                sampleSize:
                  Math.max(
                    0,
                    department.sampleSize ||
                    0
                  ),

                overallScore:
                  department.overallScore,

                /**
                 * 입원병동의 peerGroupRank / peerGroupSize는
                 * evaluateDepartments에서 이미 병동간호팀 순위로 치환됨
                 */
                teamRank:
                  team ===
                    "NURSING_TEAM_1" ||
                  team ===
                    "NURSING_TEAM_2"
                    ? (
                        department.peerGroupRank ||
                        department.rank ||
                        0
                      )
                    : 0,

                teamSize:
                  team ===
                    "NURSING_TEAM_1" ||
                  team ===
                    "NURSING_TEAM_2"
                    ? (
                        department.peerGroupSize ||
                        department.totalRanked ||
                        0
                      )
                    : 0,

                /**
                 * 현재 DepartmentSummary에는 입원병동의 표시 순위가
                 * 팀 순위로 저장되므로 별도의 전체 병동 순위를
                 * 임의 생성하지 않습니다.
                 */
                peerGroupRank:
                  undefined,

                peerGroupSize:
                  undefined,

                lowestDomainName:
                  lowestDomain
                    ?.domainName,

                lowestDomainScore:
                  lowestDomain &&
                  Number.isFinite(
                    lowestDomain.currentScore
                  )
                    ? this.round1(
                        lowestDomain.currentScore
                      )
                    : undefined,

                domainScores:
                  validDomains.map(
                    (
                      domain
                    ) => ({
                      domainName:
                        domain.domainName,

                      score:
                        this.round1(
                          domain.currentScore
                        ),
                    })
                  ),
              };
            }
          )
          .filter(
            (
              row
            ) =>
              row.team ===
                "NURSING_TEAM_1" ||
              row.team ===
                "NURSING_TEAM_2"
          )
          .sort(
            (
              a,
              b
            ) =>
              this.wardTeamSortOrder(
                a.team
              ) -
                this.wardTeamSortOrder(
                  b.team
                ) ||
              a.teamRank -
                b.teamRank ||
              b.overallScore -
                a.overallScore
          );


    const buildTeamSummary =
      (
        team:
          "NURSING_TEAM_1" |
          "NURSING_TEAM_2",
        teamLabel:
          string
      ): WardTeamSummary => {

        const teamRows =
          rows.filter(
            (
              row
            ) =>
              row.team ===
              team
          );


        const sortedByScore =
          [
            ...teamRows,
          ].sort(
            (
              a,
              b
            ) =>
              b.overallScore -
              a.overallScore
          );


        const totalSample =
          teamRows.reduce(
            (
              sum,
              row
            ) =>
              sum +
              Math.max(
                0,
                row.sampleSize ||
                0
              ),
            0
          );


        /**
         * 타입 정의 및 기존 Peer 평균 원칙에 맞춰
         * 병동별 종합점수의 단순평균을 사용합니다.
         */
        const averageScore =
          teamRows.length >
            0
            ? this.average(
                teamRows.map(
                  (
                    row
                  ) =>
                    row.overallScore
                )
              )
            : 0;


        return {
          team,

          teamLabel,

          wardCount:
            teamRows.length,

          sampleSize:
            totalSample,

          averageScore,

          topWardName:
            sortedByScore[0]
              ?.departmentName,

          topWardScore:
            sortedByScore[0]
              ? this.round1(
                  sortedByScore[0]
                    .overallScore
                )
              : undefined,

          bottomWardName:
            sortedByScore.length >
              0
              ? sortedByScore[
                  sortedByScore.length -
                  1
                ].departmentName
              : undefined,

          bottomWardScore:
            sortedByScore.length >
              0
              ? this.round1(
                  sortedByScore[
                    sortedByScore.length -
                    1
                  ].overallScore
                )
              : undefined,
        };
      };


    const teamSummaries:
      WardTeamSummary[] = [
        buildTeamSummary(
          "NURSING_TEAM_1",
          "병동간호 1팀"
        ),

        buildTeamSummary(
          "NURSING_TEAM_2",
          "병동간호 2팀"
        ),
      ];


    const rowIdSet =
      new Set(
        rows.map(
          (
            row
          ) =>
            row.departmentId
        )
      );


    const safeFeedbackSheets =
      (
        Array.isArray(
          feedbackSheets
        )
          ? feedbackSheets
          : []
      ).filter(
        (
          sheet
        ) =>
          rowIdSet.has(
            sheet.departmentId
          )
      );


    return {
      generatedAt:
        new Date()
          .toISOString(),

      period:
        period ||
        "",

      rows,

      teamSummaries,

      wardOptions:
        rows.map(
          (
            row
          ) => ({
            departmentId:
              row.departmentId,

            departmentName:
              row.departmentName,

            team:
              row.team,
          })
        ),

      feedbackSheets:
        safeFeedbackSheets,
    };
  }


  /**
   * ==========================================================
   * 전체 현황 Dashboard
   * ==========================================================
   *
   * 목적:
   * - 외래 의사 / 병동 / 검사실 등을 하나의 전체 순위로 섞지 않음
   * - 9개 Peer Group별 평균점수 / 개선대상 수 / 분석단위 수 / 표본수 제공
   * - 우선 확인 대상은 "순위"가 아니라 관리 우선순위 목록으로만 제공
   *
   * averageScore:
   * - 각 분석단위의 overallScore 단순평균
   * - 기존 Peer Group 평균 계산 원칙과 동일
   *
   * priorityDepartments:
   * - 이미 개선대상으로 판정된 분석단위만 사용
   * - 관리등급 → 낮은 현재점수 → 낮은 Peer Gap 순
   * - 전체 유형 간 순위를 의미하지 않음
   */
  public static buildOverviewDashboard(
    departments:
      DepartmentSummary[],
    vulnerableDepartments:
      DepartmentSummary[],
    priorityLimit:
      number = 8
  ): OverviewDashboardData {

    const safeDepartments =
      Array.isArray(
        departments
      )
        ? departments
        : [];


    const safeVulnerableDepartments =
      Array.isArray(
        vulnerableDepartments
      )
        ? vulnerableDepartments
        : [];


    const vulnerableIds =
      new Set(
        safeVulnerableDepartments.map(
          (
            department
          ) =>
            department.id
        )
      );


    const groupMap =
      new Map<
        PeerGroup,
        DepartmentSummary[]
      >();


    for (
      const department of
      safeDepartments
    ) {

      const peerGroup =
        department.peerGroup ||
        "UNKNOWN";


      if (
        !groupMap.has(
          peerGroup
        )
      ) {
        groupMap.set(
          peerGroup,
          []
        );
      }


      groupMap
        .get(
          peerGroup
        )!
        .push(
          department
        );
    }


    const orderedPeerGroups =
      [
        ...CX_PEER_GROUP_DISPLAY_ORDER,

        ...Array.from(
          groupMap.keys()
        ).filter(
          (
            peerGroup
          ) =>
            !CX_PEER_GROUP_DISPLAY_ORDER.includes(
              peerGroup
            )
        ),
      ];


    const peerGroups:
      PeerGroupOverviewSummary[] =
        orderedPeerGroups
          .map(
            (
              peerGroup
            ) => {

              const groupDepartments =
                groupMap.get(
                  peerGroup
                ) ||
                [];


              if (
                groupDepartments.length ===
                0
              ) {
                return null;
              }


              const averageScore =
                this.average(
                  groupDepartments.map(
                    (
                      department
                    ) =>
                      department.overallScore
                  )
                );


              const vulnerableCount =
                groupDepartments.filter(
                  (
                    department
                  ) =>
                    vulnerableIds.has(
                      department.id
                    )
                ).length;


              const totalSample =
                groupDepartments.reduce(
                  (
                    sum,
                    department
                  ) =>
                    sum +
                    Math.max(
                      0,
                      department.sampleSize ||
                        0
                    ),
                  0
                );


              return {
                peerGroup,

                peerGroupLabel:
                  this.getPeerGroupLabel(
                    peerGroup,
                    groupDepartments
                  ),

                averageScore,

                vulnerableCount,

                totalCount:
                  groupDepartments.length,

                totalSample,
              };
            }
          )
          .filter(
            (
              summary
            ): summary is
              PeerGroupOverviewSummary =>
                Boolean(
                  summary
                )
          );


    const limit =
      Number.isFinite(
        priorityLimit
      )
        ? Math.max(
            0,
            Math.floor(
              priorityLimit
            )
          )
        : 8;


    const priorityDepartments =
      [
        ...safeVulnerableDepartments,
      ]
        .sort(
          (
            a,
            b
          ) =>
            this.priorityWeight(
              b.priority
            ) -
              this.priorityWeight(
                a.priority
              ) ||

            a.overallScore -
              b.overallScore ||

            (a.peerGroupGap ??
              0) -
              (b.peerGroupGap ??
                0) ||

            (
              a.displayName ||
              a.name ||
              ""
            ).localeCompare(
              b.displayName ||
              b.name ||
              "",
              "ko"
            )
        )
        .slice(
          0,
          limit
        );


    return {
      peerGroups,
      priorityDepartments,
    };
  }

  /**
   * ==========================================================
   * 기간 비교
   * ==========================================================
   *
   * 동일 분석단위끼리만 직접 비교합니다.
   *
   * 비교 원칙
   * - 서로 다른 Peer Group은 절대 매칭하지 않음
   * - 동일 ID를 우선 사용
   * - ID가 달라졌을 경우에는
   *   Peer Group + 분석단위명 + 상위 진료과를 조합한 Key로 보조 매칭
   * - 현재기간에만 존재하면 NEW_UNIT
   * - 이전기간에만 존재하면 NOT_COMPARABLE
   *
   * 취약여부는 각 기간에 동일 Criteria를 독립 적용하여 판정합니다.
   */
  public static buildPeriodComparison(
    currentDepartments:
      DepartmentSummary[],
    previousDepartments:
      DepartmentSummary[],
    criteria:
      CriteriaConfig,
    currentPeriod:
      string,
    previousPeriod:
      string
  ): PeriodComparisonResult {

    const currentEvaluation =
      this.evaluateDepartments(
        Array.isArray(
          currentDepartments
        )
          ? currentDepartments
          : [],
        criteria
      );


    const previousEvaluation =
      this.evaluateDepartments(
        Array.isArray(
          previousDepartments
        )
          ? previousDepartments
          : [],
        criteria
      );


    const currentList =
      currentEvaluation
        .evaluatedList;


    const previousList =
      previousEvaluation
        .evaluatedList;


    const currentVulnerableIds =
      new Set(
        currentEvaluation
          .vulnerableList
          .map(
            (
              department
            ) =>
              department.id
          )
      );


    const previousVulnerableIds =
      new Set(
        previousEvaluation
          .vulnerableList
          .map(
            (
              department
            ) =>
              department.id
          )
      );


    const previousById =
      new Map<
        string,
        DepartmentSummary
      >();


    const previousByKey =
      new Map<
        string,
        DepartmentSummary[]
      >();


    previousList.forEach(
      (
        department
      ) => {

        previousById.set(
          department.id,
          department
        );


        const key =
          this.buildPeriodComparisonKey(
            department
          );


        if (
          !previousByKey.has(
            key
          )
        ) {
          previousByKey.set(
            key,
            []
          );
        }


        previousByKey
          .get(
            key
          )!
          .push(
            department
          );
      }
    );


    const matchedPreviousIds =
      new Set<
        string
      >();


    const items:
      PeriodComparisonItem[] =
        [];


    currentList.forEach(
      (
        currentDepartment
      ) => {

        let previousDepartment:
          DepartmentSummary |
          undefined =
            previousById.get(
              currentDepartment.id
            );


        if (
          previousDepartment &&
          previousDepartment.peerGroup !==
            currentDepartment.peerGroup
        ) {
          previousDepartment =
            undefined;
        }


        if (
          !previousDepartment
        ) {

          const comparisonKey =
            this.buildPeriodComparisonKey(
              currentDepartment
            );


          const candidates =
            (
              previousByKey.get(
                comparisonKey
              ) ||
              []
            ).filter(
              (
                candidate
              ) =>
                !matchedPreviousIds.has(
                  candidate.id
                )
            );


          if (
            candidates.length ===
            1
          ) {
            previousDepartment =
              candidates[0];
          }
        }


        if (
          !previousDepartment
        ) {

          items.push(
            this.createPeriodComparisonItem(
              null,
              currentDepartment,
              previousPeriod,
              currentPeriod,
              null,
              currentVulnerableIds.has(
                currentDepartment.id
              ),
              "NEW_UNIT"
            )
          );

          return;
        }


        matchedPreviousIds.add(
          previousDepartment.id
        );


        const wasVulnerable =
          previousVulnerableIds.has(
            previousDepartment.id
          );


        const isVulnerable =
          currentVulnerableIds.has(
            currentDepartment.id
          );


        let changeStatus:
          PeriodComparisonChangeStatus;


        if (
          !wasVulnerable &&
          isVulnerable
        ) {
          changeStatus =
            "NEW_VULNERABLE";
        } else if (
          wasVulnerable &&
          !isVulnerable
        ) {
          changeStatus =
            "RESOLVED_VULNERABLE";
        } else if (
          wasVulnerable &&
          isVulnerable
        ) {
          changeStatus =
            "PERSISTENT_VULNERABLE";
        } else {
          changeStatus =
            "STABLE_GENERAL";
        }


        items.push(
          this.createPeriodComparisonItem(
            previousDepartment,
            currentDepartment,
            previousPeriod,
            currentPeriod,
            wasVulnerable,
            isVulnerable,
            changeStatus
          )
        );
      }
    );


    /**
     * 이전기간에는 있었지만 현재기간에는 없는 분석단위
     *
     * 점수 증감은 계산하지 않고 비교불가로 표시합니다.
     */
    previousList.forEach(
      (
        previousDepartment
      ) => {

        if (
          matchedPreviousIds.has(
            previousDepartment.id
          )
        ) {
          return;
        }


        items.push(
          this.createPeriodComparisonItem(
            previousDepartment,
            null,
            previousPeriod,
            currentPeriod,
            previousVulnerableIds.has(
              previousDepartment.id
            ),
            null,
            "NOT_COMPARABLE"
          )
        );
      }
    );


    const comparableItems =
      items.filter(
        (
          item
        ) =>
          item.isComparable &&
          item.scoreChange !==
            null
      );


    const averageScoreChange =
      comparableItems.length >
      0
        ? this.round1(
            comparableItems.reduce(
              (
                sum,
                item
              ) =>
                sum +
                (
                  item.scoreChange ||
                  0
                ),
              0
            ) /
              comparableItems.length
          )
        : null;


    const summary:
      PeriodComparisonSummary = {
        previousPeriod,
        currentPeriod,

        totalItems:
          items.length,

        comparableCount:
          comparableItems.length,

        newVulnerableCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "NEW_VULNERABLE"
          ).length,

        resolvedVulnerableCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "RESOLVED_VULNERABLE"
          ).length,

        persistentVulnerableCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "PERSISTENT_VULNERABLE"
          ).length,

        stableGeneralCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "STABLE_GENERAL"
          ).length,

        newUnitCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "NEW_UNIT"
          ).length,

        notComparableCount:
          items.filter(
            (
              item
            ) =>
              item.changeStatus ===
              "NOT_COMPARABLE"
          ).length,

        averageScoreChange,
      };


    /**
     * 관리자가 먼저 봐야 하는 상태가 위에 오도록 정렬합니다.
     *
     * 전체 유형을 하나의 성적 순위로 만드는 것이 아니라,
     * "변화 상태" 중심의 표시 순서입니다.
     */
    const statusOrder:
      Record<
        PeriodComparisonChangeStatus,
        number
      > = {
        NEW_VULNERABLE: 1,
        PERSISTENT_VULNERABLE: 2,
        RESOLVED_VULNERABLE: 3,
        NEW_UNIT: 4,
        NOT_COMPARABLE: 5,
        STABLE_GENERAL: 6,
      };


    items.sort(
      (
        a,
        b
      ) =>
        statusOrder[
          a.changeStatus
        ] -
          statusOrder[
            b.changeStatus
          ] ||

        a.peerGroupLabel.localeCompare(
          b.peerGroupLabel,
          "ko"
        ) ||

        a.departmentName.localeCompare(
          b.departmentName,
          "ko"
        )
    );


    return {
      summary,
      items,
    };
  }


  /**
   * Dashboard용 전체 통계
   *
   * 주의:
   * 환자경험평가 Workbook은
   *
   * 외래센터 / 외래진료과 / 입원병동 /
   * 의사 / 검사 등 서로 다른 조사단위로 나뉘어 있으므로
   * 여기에서 산출되는 hospitalAvg는
   * Dashboard 전체 분석단위의 참고용 가중평균입니다.
   *
   * 개별 부서 Feedback Sheet에서 사용하는 병원 기준값은
   * 각 DepartmentSummary.hospitalAvg,
   * 즉 해당 Sheet의 "은평성모병원" 기준행입니다.
   */
  public static calculateHospitalStats(
    departments: DepartmentSummary[]
  ): {
    hospitalAvg: number;
    scoreChangeAvg: number;
    totalSample: number;
  } {
    if (
      !Array.isArray(departments) ||
      departments.length === 0
    ) {
      return {
        hospitalAvg: 0,
        scoreChangeAvg: 0,
        totalSample: 0,
      };
    }

    const validDepartments =
      departments.filter(
        (department) =>
          Number.isFinite(
            department.overallScore
          )
      );

    if (
      validDepartments.length === 0
    ) {
      return {
        hospitalAvg: 0,
        scoreChangeAvg: 0,
        totalSample: 0,
      };
    }

    const totalSample =
      validDepartments.reduce(
        (sum, department) =>
          sum +
          Math.max(
            0,
            department.sampleSize || 0
          ),
        0
      );

    /**
     * 사례수가 있는 경우 가중평균
     */
    const weightedScoreSum =
      validDepartments.reduce(
        (sum, department) => {
          const weight =
            department.sampleSize > 0
              ? department.sampleSize
              : 1;

          return (
            sum +
            department.overallScore *
              weight
          );
        },
        0
      );

    const totalWeight =
      validDepartments.reduce(
        (sum, department) =>
          sum +
          (department.sampleSize > 0
            ? department.sampleSize
            : 1),
        0
      );

    const hospitalAvg =
      totalWeight > 0
        ? this.round1(
            weightedScoreSum /
              totalWeight
          )
        : 0;

    /**
     * 실제 전기 데이터가 존재하는 부서만
     * 증감 평균에 포함
     */
    const departmentsWithPrevious =
      validDepartments.filter(
        (department) =>
          this.hasPreviousData(
            department
          )
      );

    const scoreChangeAvg =
      departmentsWithPrevious.length >
      0
        ? this.round1(
            departmentsWithPrevious.reduce(
              (sum, department) =>
                sum +
                department.scoreChange,
              0
            ) /
              departmentsWithPrevious.length
          )
        : 0;

    return {
      hospitalAvg,
      scoreChangeAvg,
      totalSample,
    };
  }

  /**
   * ==========================================================
   * Main Evaluation
   * ==========================================================
   */

  public static evaluateDepartments(
    departments: DepartmentSummary[],
    criteria: CriteriaConfig,
    analysisScope?: AnalysisScopeConfig
  ): {
    evaluatedList: DepartmentSummary[];
    vulnerableList: DepartmentSummary[];
    hospitalAvg: number;
    totalSample: number;
    scoreChangeAvg: number;
  } {
    if (
      !Array.isArray(departments) ||
      departments.length === 0
    ) {
      return {
        evaluatedList: [],
        vulnerableList: [],
        hospitalAvg: 0,
        totalSample: 0,
        scoreChangeAvg: 0,
      };
    }

    const dashboardStats =
      this.calculateHospitalStats(
        departments
      );

    /**
     * 9개 Peer Group별 완전 분리
     */
    const peerGroups =
      new Map<
        PeerGroup,
        DepartmentSummary[]
      >();

    for (
      const department of departments
    ) {
      const peerGroup =
        department.peerGroup ||
        "UNKNOWN";

      if (
        !peerGroups.has(peerGroup)
      ) {
        peerGroups.set(
          peerGroup,
          []
        );
      }

      peerGroups
        .get(peerGroup)!
        .push(department);
    }

    /**
     * 입원 병동만 별도 간호팀 단위 순위를 계산합니다.
     *
     * - 병동간호 1팀: 111Unit ~ 162Unit, 141병동, 호스피스 계열
     * - 병동간호 2팀: 62Unit ~ 102Unit, 신경계중환자실 계열
     * - 순위 제외: 신생아 중환자실, 고위험임산부 집중치료실,
     *              심장계 중환자실 계열
     *
     * 중요:
     * 병동간호팀 구분은 "순위"에만 적용합니다.
     * 동일유형 평균/격차는 기존 INPATIENT_WARD 전체 기준을 유지합니다.
     */
    const inpatientWardRankInfo =
      this.buildInpatientWardRankInfo(
        departments,
        criteria.minPeerGroupSize || 5
      );


    const evaluatedList:
      DepartmentSummary[] = [];

    peerGroups.forEach(
      (
        groupDepartments,
        peerGroup
      ) => {
        if (
          groupDepartments.length ===
          0
        ) {
          return;
        }

        /**
         * ------------------------------------------
         * Peer Group 기본 통계
         * ------------------------------------------
         *
         * Peer 비교는 부서 1개 = 1개 분석단위로
         * 단순평균을 사용합니다.
         *
         * 사례수가 큰 부서가 Peer 평균을
         * 과도하게 지배하지 않도록 합니다.
         */
        const peerGroupSize =
          groupDepartments.length;

        const minPeerGroupSize =
          criteria.minPeerGroupSize ||
          5;

        const isSmallPeerGroup =
          peerGroupSize <
          minPeerGroupSize;

        const peerGroupAvg =
          this.average(
            groupDepartments.map(
              (department) =>
                department.overallScore
            )
          );

        const sortedGroup =
          [...groupDepartments].sort(
            (a, b) =>
              b.overallScore -
              a.overallScore
          );

        const peerGroupTopScore =
          sortedGroup[0]
            ?.overallScore ?? 0;

        const top20Count =
          Math.max(
            1,
            Math.ceil(
              peerGroupSize * 0.2
            )
          );

        const peerGroupTop20Avg =
          this.average(
            sortedGroup
              .slice(0, top20Count)
              .map(
                (department) =>
                  department.overallScore
              )
          );

        /**
         * 영역별 Peer 통계
         */
        const domainStats =
          this.buildDomainPeerStats(
            groupDepartments
          );

        /**
         * 세부문항별 Peer 통계
         */
        const questionStats =
          this.buildQuestionPeerStats(
            groupDepartments
          );

        sortedGroup.forEach(
          (
            department,
            index
          ) => {
            const peerGroupRank =
              index + 1;

            /**
             * 1위일수록 작은 값,
             * 최하위일수록 100에 가까움.
             *
             * 예:
             * 8/10위 → 80%
             */
            const rankPercent =
              this.round1(
                (peerGroupRank /
                  peerGroupSize) *
                  100
              );


            /**
             * 화면/리포트에 노출할 순위값
             *
             * 입원 병동만 병동간호팀 내부 순위로 교체합니다.
             * 순위 제외 대상은 rank/size를 0으로 저장하여
             * UI에서 "순위 제외"로 표시할 수 있도록 합니다.
             */
            const wardRankInfo =
              peerGroup ===
                "INPATIENT_WARD"
                ? inpatientWardRankInfo.get(
                    department.id
                  )
                : undefined;


            const displayRank =
              wardRankInfo
                ? wardRankInfo.rank
                : peerGroupRank;


            const displayRankSize =
              wardRankInfo
                ? wardRankInfo.size
                : peerGroupSize;


            const displayRankPercent =
              wardRankInfo
                ? wardRankInfo.percentile
                : rankPercent;


            const displayIsSmallGroup =
              wardRankInfo
                ? wardRankInfo.isSmallGroup
                : isSmallPeerGroup;

            /**
             * 개별 Sheet의
             * 은평성모병원 기준값 사용
             */
            const officialHospitalAvg =
              Number.isFinite(
                department.hospitalAvg
              )
                ? department.hospitalAvg
                : 0;

            const hospitalGap =
              this.round1(
                department.overallScore -
                  officialHospitalAvg
              );

            const peerGroupGap =
              this.round1(
                department.overallScore -
                  peerGroupAvg
              );

            const reasons:
              string[] = [];

            const conditionMatches:
              boolean[] = [];

            /**
             * 최소 사례수
             */
            const satisfiesSampleSize =
              (department.sampleSize ||
                0) >=
              (criteria.minSampleSize ||
                10);

            /**
             * --------------------------------------
             * 1. 절대점수
             * --------------------------------------
             */
            if (
              criteria.enableAbsoluteScore
            ) {
              const matched =
                department.overallScore <=
                criteria.absoluteScoreThreshold;

              conditionMatches.push(
                matched
              );

              if (matched) {
                reasons.push(
                  `종합점수 ${department.overallScore}점 (기준 ${criteria.absoluteScoreThreshold}점 이하)`
                );
              }
            }

            /**
             * --------------------------------------
             * 2. Benchmark Gap
             * --------------------------------------
             */
            const gapEnabled =
              Boolean(
                criteria.enableGap ??
                criteria.enableHospitalAvgGap ??
                false
              );

            if (gapEnabled) {
              const gapThreshold =
                criteria.gapThreshold ??
                criteria.hospitalAvgGapThreshold ??
                -4;

              const benchmarkTarget =
                criteria.benchmarkTarget ||
                "PEER_GROUP";

              if (
                benchmarkTarget ===
                "PEER_GROUP"
              ) {
                const matched =
                  peerGroupGap <=
                  gapThreshold;

                conditionMatches.push(
                  matched
                );

                if (matched) {
                  reasons.push(
                    `동일 유형(${department.peerGroupLabel}) 평균 ${peerGroupAvg}점 대비 ${
                      peerGroupGap > 0
                        ? "+"
                        : ""
                    }${peerGroupGap}점 (기준 ${gapThreshold}점 이하)`
                  );
                }
              } else {
                /**
                 * 병원 기준값이 없는 경우에는
                 * 활성화된 Gap 조건을 임의로 무시하지 않습니다.
                 * 비교 근거가 없으므로 해당 조건은 불충족 처리합니다.
                 */
                const hasOfficialHospitalBenchmark =
                  officialHospitalAvg > 0;

                const matched =
                  hasOfficialHospitalBenchmark &&
                  hospitalGap <=
                    gapThreshold;

                conditionMatches.push(
                  matched
                );

                if (matched) {
                  reasons.push(
                    `해당 조사영역 은평성모병원 기준 ${officialHospitalAvg}점 대비 ${
                      hospitalGap > 0
                        ? "+"
                        : ""
                    }${hospitalGap}점 (기준 ${gapThreshold}점 이하)`
                  );
                }
              }
            }

            /**
             * --------------------------------------
             * 취약부서 판정
             * --------------------------------------
             */
            let isVulnerable =
              false;

            if (
              satisfiesSampleSize &&
              conditionMatches.length >
                0
            ) {
              if (
                criteria.combinationLogic ===
                "AND"
              ) {
                isVulnerable =
                  conditionMatches.every(
                    Boolean
                  );
              } else {
                isVulnerable =
                  conditionMatches.some(
                    Boolean
                  );
              }
            }

            const {
              priority,
              status,
            } =
              this.determineDepartmentStatus(
                department,
                peerGroupGap,
                isVulnerable
              );

            /**
             * --------------------------------------
             * 영역/문항 Benchmark 적용
             * --------------------------------------
             */
            const enrichedDomains =
              department.domains.map(
                (domain) =>
                  this.enrichDomain(
                    domain,
                    domainStats,
                    questionStats
                  )
              );

            evaluatedList.push({
              ...department,

              peerGroup,

              peerGroupAvg,

              typeAvg:
                peerGroupAvg,

              peerGroupGap,

              /**
               * hospitalAvg를
               * 전체 재계산값으로 덮어쓰지 않음
               */
              hospitalAvg:
                officialHospitalAvg,

              hospitalGap,

              rank:
                displayRank,

              totalRanked:
                displayRankSize,

              peerGroupRank:
                displayRank,

              peerGroupSize:
                displayRankSize,

              peerGroupPercentile:
                displayRankPercent,

              peerGroupTopScore,

              peerGroupTop20Avg,

              isSmallPeerGroup:
                displayIsSmallGroup,

              status,

              priority,

              vulnerabilityReasons:
                isVulnerable
                  ? reasons
                  : [],

              domains:
                enrichedDomains,
            });
          }
        );
      }
    );

    /**
     * Peer Group 순서 + Rank 순서
     */
    evaluatedList.sort(
      (a, b) => {
        const groupCompare =
          a.peerGroup.localeCompare(
            b.peerGroup
          );

        if (
          groupCompare !== 0
        ) {
          return groupCompare;
        }

        /**
         * 순위 제외 대상(rank=0)은
         * 해당 그룹의 마지막에 배치합니다.
         */
        if (
          a.peerGroupRank === 0 &&
          b.peerGroupRank !== 0
        ) {
          return 1;
        }

        if (
          b.peerGroupRank === 0 &&
          a.peerGroupRank !== 0
        ) {
          return -1;
        }

        return (
          a.peerGroupRank -
          b.peerGroupRank
        );
      }
    );

    const vulnerableList =
      evaluatedList
        .filter(
          (department) =>
            department
              .vulnerabilityReasons
              .length > 0
        )
        .sort(
          (a, b) =>
            this.priorityWeight(
              b.priority
            ) -
              this.priorityWeight(
                a.priority
              ) ||
            a.peerGroupRank -
              b.peerGroupRank
        );


    /**
     * ========================================================
     * 분석범위 적용
     * ========================================================
     *
     * 여기서 최종 출력 목록에만 scope를 적용합니다.
     *
     * 위쪽의 Peer 평균 / 병동간호팀 순위 / 영역·문항 Benchmark는
     * 반드시 전체 원본 Peer Group으로 계산된 상태를 유지합니다.
     */
    const scopedEvaluatedList =
      this.filterDepartmentsByAnalysisScope(
        evaluatedList,
        analysisScope
      );


    const scopedIdSet =
      new Set(
        scopedEvaluatedList.map(
          (
            department
          ) =>
            department.id
        )
      );


    const scopedVulnerableList =
      vulnerableList.filter(
        (
          department
        ) =>
          scopedIdSet.has(
            department.id
          )
      );


    return {
      evaluatedList:
        scopedEvaluatedList,

      vulnerableList:
        scopedVulnerableList,

      /**
       * 병원 전체 참고 통계는 scope로 재계산하지 않습니다.
       * 선택 범위에 따라 병원 평균 자체가 바뀌면 안 되기 때문입니다.
       */
      hospitalAvg:
        dashboardStats.hospitalAvg,

      totalSample:
        scopedEvaluatedList.reduce(
          (
            sum,
            department
          ) =>
            sum +
            Math.max(
              0,
              department.sampleSize ||
              0
            ),
          0
        ),

      scoreChangeAvg:
        dashboardStats.scoreChangeAvg,
    };
  }

  /**
   * ==========================================================
   * Domain Peer Statistics
   * ==========================================================
   */

  private static buildDomainPeerStats(
    departments:
      DepartmentSummary[]
  ): Map<
    string,
    {
      average: number;
      topScore: number;
    }
  > {
    const values =
      new Map<
        string,
        number[]
      >();

    for (
      const department of
      departments
    ) {
      for (
        const domain of
        department.domains || []
      ) {
        const key =
          this.normalizeKey(
            domain.domainName
          );

        if (!values.has(key)) {
          values.set(
            key,
            []
          );
        }

        values
          .get(key)!
          .push(
            domain.currentScore
          );
      }
    }

    const result =
      new Map<
        string,
        {
          average: number;
          topScore: number;
        }
      >();

    values.forEach(
      (
        scores,
        key
      ) => {
        result.set(key, {
          average:
            this.average(scores),

          topScore:
            scores.length > 0
              ? Math.max(
                  ...scores
                )
              : 0,
        });
      }
    );

    return result;
  }

  /**
   * ==========================================================
   * Question Peer Statistics
   * ==========================================================
   */

  private static buildQuestionPeerStats(
    departments:
      DepartmentSummary[]
  ): Map<
    string,
    {
      scores: number[];
      average: number;
      topScore: number;
    }
  > {
    const values =
      new Map<
        string,
        number[]
      >();

    for (
      const department of
      departments
    ) {
      for (
        const domain of
        department.domains || []
      ) {
        for (
          const question of
          domain.questions || []
        ) {
          const key =
            this.questionKey(
              domain.domainName,
              question.questionText
            );

          if (
            !values.has(key)
          ) {
            values.set(
              key,
              []
            );
          }

          values
            .get(key)!
            .push(
              question.currentScore
            );
        }
      }
    }

    const result =
      new Map<
        string,
        {
          scores: number[];
          average: number;
          topScore: number;
        }
      >();

    values.forEach(
      (
        scores,
        key
      ) => {
        const sorted =
          [...scores].sort(
            (a, b) =>
              b - a
          );

        result.set(key, {
          scores: sorted,

          average:
            this.average(scores),

          topScore:
            sorted[0] ?? 0,
        });
      }
    );

    return result;
  }

  /**
   * ==========================================================
   * Domain enrichment
   * ==========================================================
   */

  private static enrichDomain(
    domain: DomainScore,
    domainStats: Map<
      string,
      {
        average: number;
        topScore: number;
      }
    >,
    questionStats: Map<
      string,
      {
        scores: number[];
        average: number;
        topScore: number;
      }
    >
  ): DomainScore {
    const domainKey =
      this.normalizeKey(
        domain.domainName
      );

    const peerStats =
      domainStats.get(
        domainKey
      );

    const peerAvg =
      peerStats?.average ??
      domain.peerGroupAvg ??
      0;

    const topScore =
      peerStats?.topScore ??
      domain.topPerformerScore ??
      domain.currentScore;

    /**
     * Normalization에서 읽은
     * 은평성모병원 영역평균을 보존
     */
    const hospitalAvg =
      Number.isFinite(
        domain.hospitalAvg
      )
        ? domain.hospitalAvg
        : 0;

    const domainStatus =
      this.getScoreStatus(
        domain.currentScore,
        peerAvg
      );

    const questions =
      (domain.questions || []).map(
        (question) =>
          this.enrichQuestion(
            question,
            domain.domainName,
            questionStats
          )
      );

    return {
      ...domain,

      hospitalAvg,

      peerGroupAvg:
        peerAvg,

      departmentTypeAvg:
        peerAvg,

      topPerformerScore:
        topScore,

      status:
        domainStatus,

      questions,
    };
  }

  private static enrichQuestion(
    question: QuestionScore,
    domainName: string,
    questionStats: Map<
      string,
      {
        scores: number[];
        average: number;
        topScore: number;
      }
    >
  ): QuestionScore {
    const key =
      this.questionKey(
        domainName,
        question.questionText
      );

    const stats =
      questionStats.get(
        key
      );

    if (!stats) {
      return question;
    }

    /**
     * 동점은 동일 순위로 처리
     */
    const rank =
      stats.scores.findIndex(
        (score) =>
          score <=
          question.currentScore
      ) + 1;

    return {
      ...question,

      /**
       * question.hospitalAvg는
       * baseline row의 해당 문항값
       */
      hospitalAvg:
        question.hospitalAvg,

      peerGroupAvg:
        stats.average,

      departmentTypeAvg:
        stats.average,

      topPerformerScore:
        stats.topScore,

      rank:
        rank > 0
          ? rank
          : stats.scores.length,

      totalDepartments:
        stats.scores.length,

      status:
        this.getScoreStatus(
          question.currentScore,
          stats.average
        ),
    };
  }

  /**
   * ==========================================================
   * Status
   * ==========================================================
   */

  private static determineDepartmentStatus(
    department:
      DepartmentSummary,
    peerGroupGap: number,
    isVulnerable: boolean
  ): {
    priority: RiskLevel;
    status: StatusCategory;
  } {
    const score =
      department.overallScore;

    const critical =
      CX_PRIORITY_THRESHOLDS.CRITICAL;

    const high =
      CX_PRIORITY_THRESHOLDS.HIGH;

    const medium =
      CX_PRIORITY_THRESHOLDS.MEDIUM;

    const low =
      CX_PRIORITY_THRESHOLDS.LOW;

    const normal =
      CX_PRIORITY_THRESHOLDS.NORMAL;
    if (isVulnerable) {
      if (
        score <
          critical.scoreBelow ||
        peerGroupGap <=
          critical.peerGapAtOrBelow
      ) {
        return {
          priority:
            "CRITICAL",
          status:
            "위험",
        };
      }

      if (
        score <
          high.scoreBelow ||
        peerGroupGap <=
          high.peerGapAtOrBelow
      ) {
        return {
          priority:
            "HIGH",
          status:
            "위험",
        };
      }

      if (
        score <
          medium.scoreBelow ||
        peerGroupGap <
          medium.peerGapBelow
      ) {
        return {
          priority:
            "MEDIUM",
          status:
            "개선필요",
        };
      }

      return {
        priority:
          "LOW",
        status:
          "관찰",
      };
    }

    if (
      score >=
        normal.scoreAtOrAbove &&
      peerGroupGap >=
        normal.peerGapAtOrAbove
    ) {
      return {
        priority:
          "NORMAL",
        status:
          "양호",
      };
    }

    if (
      score >=
        low.scoreAtOrAbove &&
      peerGroupGap >=
        low.peerGapAtOrAbove
    ) {
      return {
        priority:
          "LOW",
        status:
          "관찰",
      };
    }

    return {
      priority:
        "MEDIUM",
      status:
        "개선필요",
    };
  }


  private static getScoreStatus(
    score: number,
    peerAvg: number
  ): StatusCategory {
    const gap =
      this.round1(
        score - peerAvg
      );

    const danger =
      CX_SCORE_STATUS_THRESHOLDS.DANGER;

    const improvement =
      CX_SCORE_STATUS_THRESHOLDS
        .NEEDS_IMPROVEMENT;

    const watch =
      CX_SCORE_STATUS_THRESHOLDS.WATCH;

    if (
      score <
        danger.scoreBelow ||
      gap <=
        danger.peerGapAtOrBelow
    ) {
      return "위험";
    }

    if (
      score <
        improvement.scoreBelow ||
      gap <=
        improvement.peerGapAtOrBelow
    ) {
      return "개선필요";
    }

    if (
      score <
        watch.scoreBelow ||
      gap <
        watch.peerGapBelow
    ) {
      return "관찰";
    }

    return "양호";
  }


  /**
   * ==========================================================
   * Benchmark
   * ==========================================================
   *
   * 실제 정량 Benchmark만 생성합니다.
   *
   * 모범사례는 여기서 절대 임의 생성하지 않습니다.
   *
   * 실제 긍정 VOC 기반의 AI 추천 사례는
   * 이후 AI Orchestrator 단계에서 생성합니다.
   */

  public static generateBenchmarkComparison(
    targetDept:
      DepartmentSummary,
    allDepts:
      DepartmentSummary[]
  ): {
    benchmarks:
      BenchmarkComparison[];

    topPerformer:
      DepartmentSummary | null;

    groupAvg: number;

    peerGroupAvg: number;

    peerGroupTopPerformer:
      DepartmentSummary | null;

    isSmallPeerGroup: boolean;
  } {
    const samePeerGroup =
      allDepts.filter(
        (department) =>
          department.peerGroup ===
          targetDept.peerGroup
      );

    if (
      samePeerGroup.length ===
      0
    ) {
      return {
        benchmarks: [],

        topPerformer:
          null,

        groupAvg: 0,

        peerGroupAvg: 0,

        peerGroupTopPerformer:
          null,

        isSmallPeerGroup:
          true,
      };
    }

    const sorted =
      [...samePeerGroup].sort(
        (a, b) =>
          b.overallScore -
          a.overallScore
      );

    const topPerformer =
      sorted[0] || null;

    const peerGroupAvg =
      this.average(
        samePeerGroup.map(
          (department) =>
            department.overallScore
        )
      );

    const isSmallPeerGroup =
      samePeerGroup.length < 5;

    const benchmarks:
      BenchmarkComparison[] =
        (
          targetDept.domains ||
          []
        ).map(
          (domain) => {
            const comparableDomains =
              samePeerGroup
                .map(
                  (department) =>
                    department.domains.find(
                      (
                        candidate
                      ) =>
                        this.normalizeKey(
                          candidate.domainName
                        ) ===
                        this.normalizeKey(
                          domain.domainName
                        )
                    )
                )
                .filter(
                  (
                    candidate
                  ): candidate is DomainScore =>
                    Boolean(
                      candidate
                    )
                );

            const domainPeerAvg =
              comparableDomains.length >
              0
                ? this.average(
                    comparableDomains.map(
                      (
                        candidate
                      ) =>
                        candidate.currentScore
                    )
                  )
                : domain.currentScore;

            const topDomainScore =
              comparableDomains.length >
              0
                ? Math.max(
                    ...comparableDomains.map(
                      (
                        candidate
                      ) =>
                        candidate.currentScore
                    )
                  )
                : domain.currentScore;

            const officialHospitalAvg =
              Number.isFinite(
                domain.hospitalAvg
              )
                ? domain.hospitalAvg
                : 0;

            const gapWithHospital =
              this.round1(
                domain.currentScore -
                  officialHospitalAvg
              );

            const gapWithPeer =
              this.round1(
                domain.currentScore -
                  domainPeerAvg
              );

            const gapWithTop =
              this.round1(
                domain.currentScore -
                  topDomainScore
              );

            return {
              domainId:
                domain.domainId,

              domainName:
                domain.domainName,

              departmentScore:
                domain.currentScore,

              /**
               * 목표점수를 임의 생성하지 않고
               * 동일유형 우수부서 점수를 참고값으로 사용
               */
              targetScore:
                topDomainScore,

              hospitalAvg:
                officialHospitalAvg,

              typeAvg:
                domainPeerAvg,

              groupAvg:
                domainPeerAvg,

              peerGroupAvg:
                domainPeerAvg,

              topPerformerScore:
                topDomainScore,

              gapWithHospital,

              gapWithType:
                gapWithPeer,

              gapWithPeerGroup:
                gapWithPeer,

              gapWithTop,

              gapWithTopPerformer:
                gapWithTop,

              /**
               * 근거 없는 Best Practice 생성 금지
               */
              topStrengths: [],

              /**
               * 실제 사례/긍정 VOC가 있는지는
               * AI Orchestrator에서 판단
               */
              benchmarkingPoints:
                undefined,
            };
          }
        );

    return {
      benchmarks,

      topPerformer,

      groupAvg:
        peerGroupAvg,

      peerGroupAvg,

      peerGroupTopPerformer:
        topPerformer,

      isSmallPeerGroup,
    };
  }

  /**
   * ==========================================================
   * VOC Statistics
   * ==========================================================
   */

  public static aggregateVocStats(
    vocList: RawVocItem[]
  ): {
    totalCount: number;

    categoryCounts:
      Record<
        VocCategory,
        number
      >;

    sentimentCounts: {
      positive: number;
      neutral: number;
      negative: number;
    };

    topIssueCategories: {
      category:
        VocCategory;
      count: number;
      percentage: number;
    }[];
  } {
    const safeVocList =
      Array.isArray(vocList)
        ? vocList
        : [];

    const totalCount =
      safeVocList.length;

    const categoryCounts:
      Record<
        VocCategory,
        number
      > = {
      설명부족: 0,
      대기시간: 0,
      "친절/응대": 0,
      검사안내: 0,
      "치료/간호": 0,
      투약과정: 0,
      퇴원안내: 0,
      시설환경: 0,
      소음: 0,
      식사: 0,

      /**
       * 신규 실제 VOC 분류
       */
      "예약/접수": 0,
      수납: 0,
      환자안전: 0,
      칭찬: 0,

      기타: 0,
    };

    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    for (
      const voc of
      safeVocList
    ) {
      if (
        voc.category &&
        Object.prototype.hasOwnProperty.call(
          categoryCounts,
          voc.category
        )
      ) {
        categoryCounts[
          voc.category
        ]++;
      } else {
        categoryCounts.기타++;
      }

      if (
        voc.sentiment ===
        "POSITIVE"
      ) {
        sentimentCounts.positive++;
      } else if (
        voc.sentiment ===
        "NEGATIVE"
      ) {
        sentimentCounts.negative++;
      } else {
        sentimentCounts.neutral++;
      }
    }

    const topIssueCategories =
      (
        Object.entries(
          categoryCounts
        ) as [
          VocCategory,
          number
        ][]
      )
        .filter(
          ([, count]) =>
            count > 0
        )
        .map(
          ([
            category,
            count,
          ]) => ({
            category,

            count,

            percentage:
              totalCount > 0
                ? this.round1(
                    (count /
                      totalCount) *
                      100
                  )
                : 0,
          })
        )
        .sort(
          (a, b) =>
            b.count -
            a.count
        );

    return {
      totalCount,

      categoryCounts,

      sentimentCounts,

      topIssueCategories,
    };
  }

  /**
   * ==========================================================
   * VOC Filter Helper
   *
   * Department Detail / Feedback에서
   * 해당 분석단위 VOC만 가져올 때 사용 가능
   * ==========================================================
   */

  public static getRelatedVoc(
    department:
      DepartmentSummary,
    vocList:
      RawVocItem[]
  ): RawVocItem[] {
    if (
      !Array.isArray(vocList)
    ) {
      return [];
    }

    return vocList.filter(
      (voc) =>
        voc.relatedUnitIds?.includes(
          department.id
        )
    );
  }

  /**
   * 기간 비교용 분석단위 Key
   *
   * 의사처럼 동일 이름이 존재할 수 있는 유형은
   * parentDepartment까지 포함하여 오매칭을 줄입니다.
   */
  private static buildPeriodComparisonKey(
    department:
      DepartmentSummary
  ): string {

    const peerGroup =
      department.peerGroup ||
      "UNKNOWN";


    const name =
      this.normalizeKey(
        department.rawName ||
        department.displayName ||
        department.name ||
        ""
      );


    const parent =
      this.normalizeKey(
        department.parentDepartment ||
        ""
      );


    return [
      peerGroup,
      parent,
      name,
    ].join(
      "::"
    );
  }


  private static createPeriodComparisonItem(
    previousDepartment:
      DepartmentSummary |
      null,
    currentDepartment:
      DepartmentSummary |
      null,
    previousPeriod:
      string,
    currentPeriod:
      string,
    wasVulnerable:
      boolean |
      null,
    isVulnerable:
      boolean |
      null,
    changeStatus:
      PeriodComparisonChangeStatus
  ): PeriodComparisonItem {

    const referenceDepartment =
      currentDepartment ||
      previousDepartment;


    if (
      !referenceDepartment
    ) {
      throw new Error(
        "PERIOD_COMPARISON_REFERENCE_MISSING"
      );
    }


    const previousScore =
      previousDepartment
        ? previousDepartment.overallScore
        : null;


    const currentScore =
      currentDepartment
        ? currentDepartment.overallScore
        : null;


    const previousSampleSize =
      previousDepartment
        ? previousDepartment.sampleSize
        : null;


    const currentSampleSize =
      currentDepartment
        ? currentDepartment.sampleSize
        : null;


    const previousPeerGroupGap =
      previousDepartment &&
      Number.isFinite(
        previousDepartment.peerGroupGap
      )
        ? previousDepartment.peerGroupGap
        : null;


    const currentPeerGroupGap =
      currentDepartment &&
      Number.isFinite(
        currentDepartment.peerGroupGap
      )
        ? currentDepartment.peerGroupGap
        : null;


    const isComparable =
      Boolean(
        previousDepartment &&
        currentDepartment
      );


    return {
      comparisonKey:
        this.buildPeriodComparisonKey(
          referenceDepartment
        ),

      departmentId:
        currentDepartment?.id ||
        previousDepartment?.id ||
        "",

      departmentName:
        referenceDepartment.displayName ||
        referenceDepartment.name ||
        referenceDepartment.rawName ||
        "",

      peerGroup:
        referenceDepartment.peerGroup,

      peerGroupLabel:
        referenceDepartment.peerGroupLabel ||
        this.getPeerGroupLabel(
          referenceDepartment.peerGroup,
          [
            referenceDepartment,
          ]
        ),

      parentDepartment:
        referenceDepartment.parentDepartment,

      previousPeriod,
      currentPeriod,

      previousScore,
      currentScore,

      scoreChange:
        isComparable &&
        previousScore !==
          null &&
        currentScore !==
          null
          ? this.round1(
              currentScore -
              previousScore
            )
          : null,

      previousSampleSize,
      currentSampleSize,

      sampleSizeChange:
        isComparable &&
        previousSampleSize !==
          null &&
        currentSampleSize !==
          null
          ? currentSampleSize -
            previousSampleSize
          : null,

      previousPeerGroupGap,
      currentPeerGroupGap,

      peerGroupGapChange:
        isComparable &&
        previousPeerGroupGap !==
          null &&
        currentPeerGroupGap !==
          null
          ? this.round1(
              currentPeerGroupGap -
              previousPeerGroupGap
            )
          : null,

      wasVulnerable,
      isVulnerable,

      changeStatus,

      isComparable,
    };
  }


  /**
   * ==========================================================
   * Utility
   * ==========================================================
   */

  /**
   * ==========================================================
   * Inpatient Ward Team Ranking
   * ==========================================================
   *
   * 입원 병동은 전체 병동 순위 대신
   * 병동간호 1팀 / 2팀 내부 순위를 사용합니다.
   *
   * 명칭은 공백/괄호/하이픈 등을 제거한 뒤
   * 주요 키워드와 Unit 숫자를 함께 확인합니다.
   */
  private static buildInpatientWardRankInfo(
    departments: DepartmentSummary[],
    minGroupSize: number
  ): Map<string, InpatientWardRankInfo> {

    const result =
      new Map<
        string,
        InpatientWardRankInfo
      >();


    const team1:
      DepartmentSummary[] = [];

    const team2:
      DepartmentSummary[] = [];

    const excluded:
      DepartmentSummary[] = [];


    for (
      const department of
      departments
    ) {

      if (
        department.peerGroup !==
        "INPATIENT_WARD"
      ) {
        continue;
      }


      const group =
        this.classifyInpatientWard(
          department
        );


      if (
        group ===
        "NURSING_TEAM_1"
      ) {
        team1.push(
          department
        );
      } else if (
        group ===
        "NURSING_TEAM_2"
      ) {
        team2.push(
          department
        );
      } else if (
        group ===
        "EXCLUDED"
      ) {
        excluded.push(
          department
        );
      }
    }


    const assignRanks =
      (
        members:
          DepartmentSummary[],
        group:
          "NURSING_TEAM_1" |
          "NURSING_TEAM_2"
      ) => {

        const sorted =
          [...members].sort(
            (a, b) =>
              b.overallScore -
              a.overallScore
          );


        const size =
          sorted.length;

        const isSmallGroup =
          size <
          Math.max(
            1,
            minGroupSize
          );


        sorted.forEach(
          (
            department,
            index
          ) => {

            const rank =
              index + 1;

            const percentile =
              size > 0
                ? this.round1(
                    (rank / size) *
                      100
                  )
                : 0;


            result.set(
              department.id,
              {
                group,
                rank,
                size,
                percentile,
                isSmallGroup,
              }
            );
          }
        );
      };


    assignRanks(
      team1,
      "NURSING_TEAM_1"
    );

    assignRanks(
      team2,
      "NURSING_TEAM_2"
    );


    /**
     * 순위 제외 병동은 데이터 자체를 삭제하지 않습니다.
     * 전체 성적표/상세분석에는 유지하되
     * 순위만 0/0으로 표시하도록 저장합니다.
     */
    for (
      const department of
      excluded
    ) {

      result.set(
        department.id,
        {
          group:
            "EXCLUDED",
          rank:
            0,
          size:
            0,
          percentile:
            0,
          isSmallGroup:
            true,
        }
      );
    }


    return result;
  }


  /**
   * 입원 병동명 분류
   *
   * 우선순위:
   * 1. 순위 제외 병동
   * 2. 특수 명칭 병동
   * 3. Unit/병동 숫자 범위
   *
   * 반환값이 undefined이면
   * 기존 입원병동 전체 순위를 유지합니다.
   */
  private static classifyInpatientWard(
    department:
      DepartmentSummary
  ):
    | InpatientWardRankGroup
    | undefined {

    const rawText =
      [
        department.rawName,
        department.displayName,
        department.name,
      ]
        .filter(Boolean)
        .join(" ");


    const normalized =
      this.normalizeKey(
        rawText
      );


    /**
     * ------------------------------------------
     * 순위 제외
     * ------------------------------------------
     */

    /**
     * 신생아 중환자실
     * NICU 표기도 함께 인식
     */
    const isNeonatalIcu =
      (
        normalized.includes(
          "신생아"
        ) &&
        normalized.includes(
          "중환자"
        )
      ) ||
      normalized.includes(
        "nicu"
      );


    /**
     * 고위험임산부 집중치료실
     * MFICU 등의 약어도 보조적으로 인식
     */
    const isHighRiskMaternalUnit =
      (
        normalized.includes(
          "고위험임산부"
        ) &&
        (
          normalized.includes(
            "집중치료"
          ) ||
          normalized.includes(
            "중환자"
          )
        )
      ) ||
      normalized.includes(
        "mficu"
      );


    /**
     * 심장계 중환자실 / 심장 중환자실 /
     * 심혈관 중환자실 계열
     */
    const isCardiacIcu =
      (
        (
          normalized.includes(
            "심장"
          ) ||
          normalized.includes(
            "심혈관"
          )
        ) &&
        normalized.includes(
          "중환자"
        )
      ) ||
      normalized.includes(
        "ccu"
      );


    if (
      isNeonatalIcu ||
      isHighRiskMaternalUnit ||
      isCardiacIcu
    ) {
      return "EXCLUDED";
    }


    /**
     * ------------------------------------------
     * 특수 명칭
     * ------------------------------------------
     */

    /**
     * 호스피스 / 완화의료 계열 → 병동간호 1팀
     */
    if (
      normalized.includes(
        "호스피스"
      ) ||
      normalized.includes(
        "완화의료"
      )
    ) {
      return "NURSING_TEAM_1";
    }


    /**
     * 신경계 중환자실 계열 → 병동간호 2팀
     */
    if (
      normalized.includes(
        "신경"
      ) &&
      normalized.includes(
        "중환자"
      )
    ) {
      return "NURSING_TEAM_2";
    }


    /**
     * ------------------------------------------
     * Unit / 병동 번호
     * ------------------------------------------
     *
     * 예:
     * 111Unit
     * 111 Unit
     * 141병동
     * 62Unit
     */
    const numberMatch =
      normalized.match(
        /(^|[^0-9])(\d{2,3})(?=unit|병동|u|$)/
      );


    if (
      numberMatch
    ) {

      const wardNumber =
        Number(
          numberMatch[2]
        );


      if (
        Number.isFinite(
          wardNumber
        )
      ) {

        /**
         * 병동간호 1팀
         * 111Unit ~ 162Unit
         */
        if (
          wardNumber >= 111 &&
          wardNumber <= 162
        ) {
          return "NURSING_TEAM_1";
        }


        /**
         * 병동간호 2팀
         * 62Unit ~ 102Unit
         */
        if (
          wardNumber >= 62 &&
          wardNumber <= 102
        ) {
          return "NURSING_TEAM_2";
        }
      }
    }


    return undefined;
  }


  private static wardTeamSortOrder(
    team:
      WardNursingTeam
  ): number {

    if (
      team ===
      "NURSING_TEAM_1"
    ) {
      return 1;
    }


    if (
      team ===
      "NURSING_TEAM_2"
    ) {
      return 2;
    }


    if (
      team ===
      "EXCLUDED"
    ) {
      return 3;
    }


    return 4;
  }


  private static getPeerGroupLabel(
    peerGroup:
      PeerGroup,
    departments:
      DepartmentSummary[]
  ): string {

    const existingLabel =
      departments.find(
        (
          department
        ) =>
          Boolean(
            department.peerGroupLabel
          )
      )?.peerGroupLabel;


    if (
      existingLabel
    ) {
      return existingLabel;
    }


    switch (
      peerGroup
    ) {
      case "INPATIENT_WARD":
        return "입원 병동";

      case "INPATIENT_DEPARTMENT":
        return "입원 진료과";

      case "INPATIENT_DOCTOR":
        return "입원 의사";

      case "OUTPATIENT_CENTER":
        return "외래 센터";

      case "OUTPATIENT_DEPARTMENT":
        return "외래 진료과";

      case "OUTPATIENT_DOCTOR":
        return "외래 의사";

      case "EMERGENCY_DEPARTMENT":
        return "응급 진료과";

      case "EMERGENCY_DOCTOR":
        return "응급 의사";

      case "EXAM":
        return "검사실";

      default:
        return "기타";
    }
  }


  private static hasPreviousData(
    department:
      DepartmentSummary
  ): boolean {
    return Boolean(
      department.previousPeriod &&
        department.previousSampleSize >
          0
    );
  }

  private static average(
    values: number[]
  ): number {
    const valid =
      values.filter(
        (value) =>
          Number.isFinite(value)
      );

    if (
      valid.length === 0
    ) {
      return 0;
    }

    return this.round1(
      valid.reduce(
        (sum, value) =>
          sum + value,
        0
      ) / valid.length
    );
  }

  private static round1(
    value: number
  ): number {
    if (
      !Number.isFinite(value)
    ) {
      return 0;
    }

    return Number(
      value.toFixed(1)
    );
  }

  private static normalizeKey(
    value: unknown
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

  private static questionKey(
    domainName: string,
    questionText: string
  ): string {
    return `${this.normalizeKey(
      domainName
    )}::${this.normalizeKey(
      questionText
    )}`;
  }

  private static priorityWeight(
    priority: RiskLevel
  ): number {
    switch (priority) {
      case "CRITICAL":
        return 5;

      case "HIGH":
        return 4;

      case "MEDIUM":
        return 3;

      case "LOW":
        return 2;

      default:
        return 1;
    }
  }
}