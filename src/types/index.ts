// Hospital CX & VOC Assessment Types

/**
 * ============================================================
 * 1. Analysis Unit / Peer Group
 * ============================================================
 */

export type DepartmentType =
  | "CENTER"
  | "DEPARTMENT"
  | "WARD"
  | "DOCTOR"
  | "EXAM"
  | "UNKNOWN";

export type PeerGroup =
  | "OUTPATIENT_CENTER"
  | "OUTPATIENT_DEPARTMENT"
  | "OUTPATIENT_DOCTOR"
  | "INPATIENT_WARD"
  | "INPATIENT_DEPARTMENT"
  | "INPATIENT_DOCTOR"
  | "EMERGENCY_DEPARTMENT"
  | "EMERGENCY_DOCTOR"
  | "EXAM"
  | "UNKNOWN";

export const PEER_GROUP_LABELS: Record<PeerGroup, string> = {
  OUTPATIENT_CENTER: "외래 센터",
  OUTPATIENT_DEPARTMENT: "외래 진료과",
  OUTPATIENT_DOCTOR: "외래 의사",
  INPATIENT_WARD: "입원 병동",
  INPATIENT_DEPARTMENT: "입원 진료과",
  INPATIENT_DOCTOR: "입원 의사",
  EMERGENCY_DEPARTMENT: "응급 진료과",
  EMERGENCY_DOCTOR: "응급 의사",
  EXAM: "검사실",
  UNKNOWN: "기타/미분류",
};

/**
 * 실제 Excel Sheet 이름
 *
 * 기존 SheetType과 별도로 관리합니다.
 */
export type CXSourceSheet =
  | "외래_센터"
  | "외래_진료과"
  | "외래_진료과(요약)"
  | "외래_의사"
  | "입원_병동"
  | "입원_진료과"
  | "입원_의사"
  | "응급_진료과"
  | "응급_의사"
  | "검사"
  | "VOC"
  | "UNKNOWN";

export type SheetType =
  | "CENTER"
  | "DEPARTMENT"
  | "WARD"
  | "DOCTOR"
  | "EXAM"
  | "OUTPATIENT"
  | "VOC"
  | "UNKNOWN";

export type CareType =
  | "INPATIENT"
  | "OUTPATIENT"
  | "EMERGENCY"
  | "EXAM"
  | "COMMON";

export type RiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NORMAL";

export type StatusCategory =
  | "위험"
  | "개선필요"
  | "관찰"
  | "양호";


/**
 * ============================================================
 * 2. VOC
 * ============================================================
 */

export type SentimentType =
  | "POSITIVE"
  | "NEUTRAL"
  | "NEGATIVE";

export type VocCategory =
  | "설명부족"
  | "대기시간"
  | "친절/응대"
  | "검사안내"
  | "치료/간호"
  | "투약과정"
  | "퇴원안내"
  | "시설환경"
  | "소음"
  | "식사"
  | "예약/접수"
  | "수납"
  | "환자안전"
  | "칭찬"
  | "기타";

/**
 * VOC Excel 원본 필드 보존용
 *
 * 환자등록번호는 AI로 보내지 않습니다.
 */
export interface RawVocItem {
  id: string;

  /**
   * 기존 코드 호환용
   */
  departmentId: string;
  departmentName: string;

  /**
   * 응답완료일 / 조사일자
   */
  date: string;
  responseDate?: string;

  /**
   * 설문일련번호
   */
  surveySerial?: string;

  /**
   * 추천의향 점수
   */
  recommendationScore?: number;

  /**
   * 원본 Excel의 긍/부정
   */
  sentiment?: SentimentType;

  /**
   * AI 또는 원본 분류
   */
  category?: VocCategory;

  /**
   * 실제 VOC 내용
   */
  content: string;

  /**
   * 비식별 처리 전 원본
   *
   * 운영환경에서 서버/AI로 보내지 않음
   */
  originalContent?: string;

  /**
   * 개인정보 탐지 여부
   */
  hadPrivacyData?: boolean;

  /**
   * 마스킹된 환자 ID
   */
  patientIdMasked?: string;

  /**
   * 원본 Excel의 환자등록번호는
   * 가능한 Parsing 직후 제거하는 것을 권장
   */
  patientRegistrationNumber?: string;

  relatedDomain?: string;
  relevanceScore?: number;

  /**
   * ========================================================
   * Multi-dimensional organization mapping
   * ========================================================
   *
   * 하나의 VOC가
   * 센터 / 진료과 / 의사 / 병동 / 검사실
   * 여러 분석단위와 연결될 수 있습니다.
   */

  careType?: CareType;

  /**
   * 원본 '부문'
   * 예: 외래 / 입원 / 응급
   */
  division?: string;

  center?: string;
  department?: string;
  doctor?: string;
  ward?: string;
  examRoom?: string;

  /**
   * AI 분석용 연결 대상
   *
   * Normalization 이후
   * 해당 VOC가 연결되는 Analysis Unit ID 목록
   */
  relatedUnitIds?: string[];

  /**
   * Excel 원본 분류값 보존
   */
  rawCategory?: string;

  /**
   * 추가 원본 메타데이터
   */
  rawMetadata?: Record<string, unknown>;
}


/**
 * Normalization 이후 VOC
 */
export interface NormalizedVOC {
  id: string;
  text: string;
  date: string;

  careType: CareType;

  recommendationScore?: number;

  center?: string;
  department?: string;
  doctor?: string;
  ward?: string;
  examRoom?: string;

  category: VocCategory;
  sentiment: SentimentType;

  relatedDomain: string;

  relatedUnitIds?: string[];
}


/**
 * ============================================================
 * 3. Score Structure
 * ============================================================
 */

/**
 * 검사시트처럼 하나의 문항 안에
 * 외래/입원/응급 세부점수가 존재하는 경우
 */
export interface CareTypeSubScores {
  outpatient?: number | null;
  inpatient?: number | null;
  emergency?: number | null;
  common?: number | null;
}

/**
 * 실제 Excel 세부 문항
 */
export interface QuestionScore {
  questionId: string;
  questionText: string;

  domainId: string;
  domainName: string;

  currentScore: number;

  previousScore: number;
  change: number;

  hospitalAvg: number;
  departmentTypeAvg: number;

  peerGroupAvg?: number;

  topPerformerScore: number;

  rank: number;
  totalDepartments: number;

  status: StatusCategory;

  /**
   * Excel의 2단 헤더 정보
   */
  sourceHeader?: string;
  sourceColumnIndex?: number;

  /**
   * 검사 시트의
   * 외래 / 입원 / 응급 점수
   */
  subScores?: CareTypeSubScores;

  /**
   * Excel 원본값이 비어 있었는지
   */
  hasScore?: boolean;
}


/**
 * Excel 상위 영역
 *
 * 예:
 * 예약 및 접수 절차
 * 간호사 영역
 * 의사 영역
 * 검사 과정
 */
export interface DomainScore {
  domainId: string;
  domainName: string;

  /**
   * Excel의 '영역평균'
   */
  currentScore: number;

  previousScore: number;
  change: number;

  hospitalAvg: number;
  departmentTypeAvg: number;

  peerGroupAvg?: number;

  topPerformerScore: number;

  /**
   * 영역 하위 세부문항
   */
  questions: QuestionScore[];

  status: StatusCategory;

  /**
   * Excel 원본 영역명
   */
  rawDomainName?: string;

  /**
   * 영역평균 column index
   */
  averageColumnIndex?: number;

  /**
   * 검사시트와 같은 특수구조
   */
  subScores?: CareTypeSubScores;
}


/**
 * Excel의 2단 헤더 Parsing 결과
 *
 * 예:
 * domainName = "예약 및 접수 절차"
 * questionName = "진료대기 적절"
 */
export interface ParsedScoreColumn {
  columnIndex: number;

  domainName: string;
  questionName: string;

  normalizedKey: string;

  isDomainAverage: boolean;

  /**
   * 검사시트의 세부구분
   */
  careType?: CareType;

  rawTopHeader?: string;
  rawSubHeader?: string;
}


/**
 * ============================================================
 * 4. Sheet baseline
 * ============================================================
 *
 * 각 Sheet의 "은평성모병원" 행을
 * 일반 분석대상에 섞지 않고 기준값으로 저장
 */

export interface SheetBaseline {
  sheetName: string;
  sourceSheet: CXSourceSheet;

  baselineName: string;

  sampleSize: number;

  overallScore: number;

  domains: DomainScore[];

  /**
   * 공식 집계값임을 표시
   */
  isOfficialAggregate: true;
}


/**
 * ============================================================
 * 5. Analysis Unit / Department
 * ============================================================
 */

export interface AnalysisUnit {
  id: string;

  rawName: string;
  displayName: string;

  type: DepartmentType;

  peerGroup: PeerGroup;
  peerGroupLabel: string;

  /**
   * 실제 원본 Sheet
   */
  sourceSheet?: CXSourceSheet;

  /**
   * 의사인 경우 소속 진료과
   */
  parentDepartment?: string;

  /**
   * 센터 또는 기타 상위 조직
   */
  parentCenter?: string;

  period: string;

  sampleSize: number;

  overallScore: number;

  previousScore: number;
  scoreChange: number;

  hospitalAvg: number;
  typeAvg: number;
  peerGroupAvg: number;

  hospitalGap: number;
  peerGroupGap: number;

  rank: number;
  totalRanked: number;

  peerGroupRank: number;
  peerGroupSize: number;
  peerGroupPercentile: number;

  peerGroupTopScore?: number;
  peerGroupTop20Avg?: number;

  isSmallPeerGroup?: boolean;

  status: StatusCategory;
  priority: RiskLevel;

  vulnerabilityReasons: string[];

  domains: DomainScore[];

  vocCount: number;
  negativeVocRatio: number;

  /**
   * 연결된 VOC ID
   */
  relatedVocIds?: string[];
}


export interface DepartmentSummary {
  id: string;

  name: string;

  rawName?: string;
  displayName?: string;

  type: DepartmentType;

  peerGroup: PeerGroup;
  peerGroupLabel: string;

  /**
   * 실제 Excel Source Sheet
   */
  sourceSheet?: CXSourceSheet;

  /**
   * 의사 분석일 경우
   */
  parentDepartment?: string;

  /**
   * 센터/진료과 관계
   */
  parentCenter?: string;

  period: string;
  previousPeriod: string;

  sampleSize: number;
  previousSampleSize: number;

  overallScore: number;

  previousScore: number;
  scoreChange: number;

  /**
   * 해당 Sheet의 은평성모병원 기준값
   */
  hospitalAvg: number;

  typeAvg: number;

  peerGroupAvg: number;

  hospitalGap: number;
  peerGroupGap: number;

  /**
   * 기존 UI 호환
   *
   * 실제 화면 표시에서는
   * peerGroupRank 우선 사용
   */
  rank: number;
  totalRanked: number;

  peerGroupRank: number;
  peerGroupSize: number;
  peerGroupPercentile: number;

  peerGroupTopScore?: number;
  peerGroupTop20Avg?: number;

  isSmallPeerGroup?: boolean;

  status: StatusCategory;
  priority: RiskLevel;

  vulnerabilityReasons: string[];

  /**
   * 영역 → 세부문항
   */
  domains: DomainScore[];

  vocCount: number;
  negativeVocRatio: number;

  /**
   * 해당 분석단위에 직접 연결된 VOC
   */
  relatedVocIds?: string[];

  /**
   * 해당 분석단위에 긍정 VOC가 존재하는지
   */
  positiveVocCount?: number;

  /**
   * 해당 분석단위에 부정 VOC가 존재하는지
   */
  negativeVocCount?: number;

  /**
   * Sheet Baseline ID
   */
  baselineKey?: string;
}


export interface DepartmentAnalysis {
  id: string;

  rawName: string;
  displayName: string;

  peerGroup: PeerGroup;
  peerGroupLabel: string;

  sourceSheet?: CXSourceSheet;

  parentDepartment?: string;
  parentCenter?: string;

  score: number;

  previousScore?: number;
  scoreChange?: number;

  hospitalAverage?: number;
  peerGroupAverage?: number;

  hospitalGap?: number;
  peerGroupGap?: number;

  peerGroupRank?: number;
  peerGroupSize?: number;
  peerGroupPercentile?: number;

  sampleSize?: number;
}


/**
 * ============================================================
 * 6. Analysis Scope / Batch Feedback / Ward Team Report
 * ============================================================
 *
 * 분석 실행 시 사용자가 유형그룹/분석대상을 선택할 수 있도록 하는 구조입니다.
 *
 * 기본 정책:
 * - selectAll = true
 * - 기본적으로 전체 분석단위를 대상으로 함
 * - 사용자가 직접 범위를 좁힌 경우에만 selectedPeerGroups / selectedDepartmentIds 사용
 * - 선택하지 않은 분석단위는 원본 데이터에서 삭제하지 않으며,
 *   이번 분석 실행 범위에서만 제외
 */

export interface AnalysisScopeConfig {
  selectAll: boolean;
  selectedPeerGroups: PeerGroup[];
  selectedDepartmentIds: string[];
}


/**
 * 분석범위 선택 UI에서 사용할
 * 유형그룹별 분석단위 묶음
 */
export interface AnalysisScopeGroup {
  peerGroup: PeerGroup;
  peerGroupLabel: string;

  totalCount: number;
  selectedCount: number;

  departments: Array<{
    id: string;
    name: string;

    rawName?: string;
    displayName?: string;

    parentDepartment?: string;
    parentCenter?: string;

    sampleSize: number;
    overallScore: number;
  }>;
}


/**
 * ============================================================
 * Batch Feedback Sheet
 * ============================================================
 *
 * 여러 분석단위를 한 번에 선택하여
 * Feedback Sheet를 일괄 생성할 때 사용합니다.
 */
export interface BatchFeedbackSelection {
  selectedDepartmentIds: string[];
}


export type BatchFeedbackItemStatus =
  | "PENDING"
  | "GENERATING"
  | "SUCCESS"
  | "FAILED";


export interface BatchFeedbackGenerationItem {
  departmentId: string;
  departmentName: string;

  peerGroup: PeerGroup;
  peerGroupLabel: string;

  status: BatchFeedbackItemStatus;

  sheetData?: CXFeedbackSheetData;

  errorMessage?: string;
}


export interface BatchFeedbackGenerationState {
  totalCount: number;
  completedCount: number;
  successCount: number;
  failedCount: number;

  items: BatchFeedbackGenerationItem[];
}


/**
 * ============================================================
 * Inpatient Ward Team Report
 * ============================================================
 */
export type WardNursingTeam =
  | "NURSING_TEAM_1"
  | "NURSING_TEAM_2"
  | "EXCLUDED"
  | "UNASSIGNED";


export interface WardTeamReportRow {
  team: WardNursingTeam;

  departmentId: string;
  departmentName: string;

  period: string;

  sampleSize: number;

  overallScore: number;

  teamRank: number;
  teamSize: number;

  peerGroupRank?: number;
  peerGroupSize?: number;

  lowestDomainName?: string;
  lowestDomainScore?: number;

  domainScores?: Array<{
    domainName: string;
    score: number;
  }>;
}


export interface WardTeamSummary {
  team: WardNursingTeam;

  teamLabel: string;

  wardCount: number;

  sampleSize: number;

  averageScore: number;

  topWardName?: string;
  topWardScore?: number;

  bottomWardName?: string;
  bottomWardScore?: number;
}


export interface WardTeamExcelReportData {
  generatedAt: string;
  period: string;

  rows: WardTeamReportRow[];

  teamSummaries: WardTeamSummary[];

  wardOptions: Array<{
    departmentId: string;
    departmentName: string;
    team: WardNursingTeam;
  }>;

  feedbackSheets?: CXFeedbackSheetData[];
}


/**
 * ============================================================
 * 7. Criteria
 * ============================================================
 */

export interface CriteriaConfig {
  /**
   * ========================================================
   * 현재 실제 취약부서 선별에 사용하는 기준
   * ========================================================
   */

  /** 1) 절대점수 기준 */
  absoluteScoreThreshold: number;
  enableAbsoluteScore: boolean;

  /**
   * 2) 평균 대비 격차 기준
   * PEER_GROUP: 동일 유형 평균 대비 Gap
   * HOSPITAL: 해당 조사영역의 은평성모병원 공식 기준점수 대비 Gap
   */
  benchmarkTarget:
    | "PEER_GROUP"
    | "HOSPITAL";

  gapThreshold: number;
  enableGap: boolean;

  /** 기존 코드 호환용 legacy alias */
  hospitalAvgGapThreshold: number;
  enableHospitalAvgGap: boolean;

  /**
   * 3) 최소 분석 표본수
   * 취약조건 자체가 아니라 자동 선별 대상에 포함하기 위한 최소 신뢰조건
   */
  minSampleSize: number;

  /** 활성화된 선별조건이 2개 이상일 때 사용 */
  combinationLogic:
    | "AND"
    | "OR";

  /**
   * ========================================================
   * Legacy compatibility fields
   * ========================================================
   * 현재 운영 화면 및 AnalysisEngine의 취약부서 선별에는 사용하지 않습니다.
   * 기존 Preset / 저장 설정 / 컴포넌트 호환을 위해 당분간 타입에는 유지합니다.
   */

  /** @deprecated 현재 취약부서 선별에는 사용하지 않음 */
  scoreDropThreshold: number;

  /** @deprecated 항상 false로 유지 권장 */
  enableScoreDrop: boolean;

  /** @deprecated 백분위는 참고용 순위정보로만 사용 */
  bottomPercentileThreshold: number;

  /** @deprecated 항상 false로 유지 권장 */
  enableBottomPercentile: boolean;

  /** @deprecated 과거 백분위 판정용 최소 Peer Group 크기 */
  minPeerGroupSize: number;
}


/**
 * ============================================================
 * 8. AI Root Cause
 * ============================================================
 */

export interface RootCauseMatch {
  /**
   * 기존 타입
   */
  domainName: string;
  questionText: string;

  currentScore: number;
  scoreChange: number;

  hospitalGap: number;

  /**
   * Peer 기준도 추가
   */
  peerGroupGap?: number;

  vocCount: number;

  relatedVocSnippets: string[];

  estimatedRootCause: string;

  correlationLevel:
    | "VERY_HIGH"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  recommendationFocus: string;

  /**
   * AI 근거
   */
  evidence?: string[];

  severity?:
    | "CRITICAL"
    | "WARNING"
    | "NOTICE";
}


/**
 * ============================================================
 * 9. Action Plan
 * ============================================================
 */

export interface ActionPlanItem {
  priority: number;

  title: string;

  /**
   * 실행방법
   */
  method: string;

  /**
   * 적용대상
   */
  target: string;

  /**
   * 적용일정
   */
  schedule: string;

  /**
   * 기대효과
   */
  expectedEffect: string;

  /**
   * 측정 가능한 관리지표
   */
  kpi: string;
}


/**
 * ============================================================
 * 10. Benchmark
 * ============================================================
 */

export interface BenchmarkComparison {
  domainId: string;
  domainName: string;

  departmentScore: number;

  targetScore?: number;

  hospitalAvg: number;
  typeAvg: number;

  groupAvg?: number;
  peerGroupAvg?: number;

  topPerformerScore: number;

  gapWithHospital: number;
  gapWithType: number;
  gapWithTop: number;

  gapWithPeerGroup?: number;
  gapWithTopPerformer?: number;

  topStrengths: string[];

  benchmarkingPoints?: string;
}


/**
 * 실제 Best Practice인지,
 * VOC 기반 AI 추천인지,
 * 근거가 없어 없음인지 구분
 */
export type BenchmarkBestPracticeSource =
  | "ACTUAL"
  | "AI_RECOMMENDED"
  | "NONE";

export interface BenchmarkBestPractice {
  sourceType:
    BenchmarkBestPracticeSource;

  /**
   * 벤치마킹 대상 부서
   */
  sourceDepartment?: string;

  title?: string;

  description?: string;

  /**
   * 실제 긍정 VOC 근거
   */
  evidenceQuotes?: string[];

  /**
   * AI 추천인 경우 사용자에게 표시
   */
  aiRecommended?: boolean;

  /**
   * 예:
   * "실제 긍정 VOC를 기반으로 AI가 추천한 참고사례입니다."
   */
  disclaimer?: string;
}


/**
 * ============================================================
 * 11. VOC Summary
 * ============================================================
 */

export type VocIssueSummary = {
  category: VocCategory;

  count: number;

  sentiment: SentimentType;

  summary: string;

  representativeQuotes: string[];
};


/**
 * ============================================================
 * 12. CX Feedback Sheet
 * ============================================================
 */

export interface CXFeedbackSheetData {
  departmentId: string;

  departmentName: string;
  departmentType: DepartmentType;

  peerGroup?: PeerGroup;
  peerGroupLabel?: string;

  sourceSheet?: CXSourceSheet;

  parentDepartment?: string;
  parentCenter?: string;

  period: string;

  sampleSize: number;

  overallScore: number;

  previousScore: number;
  scoreChange: number;

  hospitalAvg: number;
  peerGroupAvg?: number;

  rank: number;
  totalRanked: number;

  peerGroupRank?: number;
  peerGroupSize?: number;
  peerGroupPercentile?: number;

  isSmallPeerGroup?: boolean;

  status: StatusCategory;
  priority: RiskLevel;


  /**
   * ========================================================
   * Report Metadata
   * ========================================================
   */

  /**
   * 작성부서
   *
   * 기본:
   * 고객행복팀
   */
  reportAuthorDepartment?: string;


  /**
   * ========================================================
   * Section 1.
   * 부서 평가 결과
   * ========================================================
   */

  domainScores: {
    domainName: string;

    previousScore: number;
    currentScore: number;
    change: number;

    hospitalAvg: number;
    peerGroupAvg?: number;

    topScore: number;

    status: StatusCategory;

    /**
     * 세부문항도 Report에서
     * 필요하면 표시 가능
     */
    questions?: QuestionScore[];
  }[];


  /**
   * ========================================================
   * Section 2 / 3.
   * 주요 환자 VOC 의견 분석
   * ========================================================
   */

  topVocIssues: {
    category: VocCategory;

    count: number;

    sentiment: SentimentType;

    summary: string;

    representativeQuotes: string[];
  }[];

  /**
   * 직접 연결된 VOC 총 건수
   */
  relatedVocCount?: number;

  /**
   * VOC가 없으면
   * UI에서 명확히 표시
   */
  hasRelatedVoc?: boolean;

  /**
   * 관련 VOC 일부 상세정보
   */
  relatedVocItems?: Array<{
    id: string;
    date: string;

    sentiment?: SentimentType;
    recommendationScore?: number;

    category?: VocCategory;

    content: string;

    division?: string;

    center?: string;
    department?: string;
    doctor?: string;
    ward?: string;
    examRoom?: string;
  }>;


  /**
   * ========================================================
   * Benchmark
   * ========================================================
   */

  benchmarks: BenchmarkComparison[];

  topPerformerName: string;

  /**
   * 기존 UI 호환
   */
  topPerformerBestPractices: string[];

  /**
   * 신규 Benchmark 구조
   */
  benchmarkBestPractice?: BenchmarkBestPractice;


  /**
   * ========================================================
   * AI Comprehensive Diagnosis
   * ========================================================
   */

  aiDiagnosis: {
    executiveSummary: string;

    coreProblem: string;

    evidence: string[];

    detailedDiagnosis: string;

    priorityOrder: string[];
  };


  /**
   * ========================================================
   * Section 4.
   * 부서 맞춤형 Action Plan
   * ========================================================
   *
   * 기본적으로 3개를 권장
   */

  actionPlans: ActionPlanItem[];


  /**
   * ========================================================
   * Metadata
   * ========================================================
   */

  generatedAt: string;

  generatedBy: string;
}


/**
 * ============================================================
 * 13. Feedback Management History
 * ============================================================
 *
 * 실제 부서에 어떤 방식으로 어떤 내용을 피드백했는지
 * Feedback Report와 연결하여 관리하기 위한 구조입니다.
 */

export type FeedbackDeliveryMethod =
  | "EMAIL"
  | "MEETING"
  | "OFFICIAL_DOCUMENT"
  | "PHONE"
  | "MESSENGER"
  | "OTHER";


export type FeedbackFollowUpStatus =
  | "DRAFT"
  | "DELIVERED"
  | "WAITING_RESPONSE"
  | "IN_PROGRESS"
  | "COMPLETED";


export interface FeedbackExecutionRecord {
  /**
   * 이력 고유 ID
   */
  id: string;

  /**
   * 연결된 Feedback Report / History Record ID
   */
  feedbackHistoryId: string;

  /**
   * 분석대상
   */
  departmentId: string;
  departmentName: string;

  /**
   * 평가기간
   */
  period: string;

  /**
   * 실제 피드백 실시일
   * YYYY-MM-DD 권장
   */
  feedbackDate: string;

  /**
   * 전달 방식
   */
  method: FeedbackDeliveryMethod;

  /**
   * 직접 입력한 방식명
   * method === "OTHER"일 때 사용 가능
   */
  methodDetail?: string;

  /**
   * 피드백 전달 대상
   * 예: 수간호사, 진료과장, 담당자 등
   */
  recipient?: string;

  /**
   * 실제로 전달한 피드백 내용
   */
  feedbackText: string;

  /**
   * 후속조치 상태
   */
  followUpStatus: FeedbackFollowUpStatus;

  /**
   * 후속조치 내용 / 회신 / 개선 진행사항
   */
  followUpMemo?: string;

  /**
   * 다음 확인 예정일
   */
  nextFollowUpDate?: string;

  /**
   * Feedback Report가 연결되어 있는지
   */
  hasLinkedReport: boolean;

  /**
   * 등록/수정 메타데이터
   */
  createdAt: string;
  updatedAt: string;
}


/**
 * 화면 표시용 통합 이력
 *
 * FeedbackExecutionRecord와 Feedback Report를 함께 표시할 때 사용합니다.
 */
export interface FeedbackManagementHistoryItem {
  execution: FeedbackExecutionRecord;

  /**
   * 연결된 Feedback Sheet 원본
   */
  feedbackSheet?: CXFeedbackSheetData;
}


/**
 * ============================================================
 * 14. Privacy
 * ============================================================
 */

export interface PrivacyDetectionResult {
  hasPrivacyInfo: boolean;

  detectedTypes:
    (
      | "NAME"
      | "PHONE"
      | "RRN"
      | "PATIENT_ID"
      | "EMAIL"
    )[];

  sanitizedText: string;

  matchedTokens: string[];
}


/**
 * ============================================================
 * 15. Sheet Parser
 * ============================================================
 */

export interface SheetValidationReport {
  sheetName: string;

  sheetType: SheetType;

  /**
   * 실제 Excel 시트 유형
   */
  sourceSheet?: CXSourceSheet;

  status:
    | "VALID"
    | "WARNING"
    | "EXCLUDED"
    | "ERROR";

  rowCount: number;

  /**
   * 기존 단일 Header
   */
  headerRowIndex: number;

  /**
   * 2단 Header 지원
   */
  topHeaderRowIndex?: number;
  subHeaderRowIndex?: number;

  headers: string[];

  /**
   * 2단 Header Parsing 결과
   */
  scoreColumns?: ParsedScoreColumn[];

  matchedColumns:
    Record<string, string>;

  warnings: string[];
  errors: string[];

  detectedPeriod?: string;

  departmentCount?: number;
  vocCount?: number;

  /**
   * 은평성모병원 기준행 존재 여부
   */
  hasBaselineRow?: boolean;

  baselineRowIndex?: number;
}


/**
 * Parsing된 한 개 Sheet
 */
export interface ParsedSheetData {
  sheetName: string;

  sheetType: SheetType;

  sourceSheet?: CXSourceSheet;

  headerRowIndex: number;

  topHeaderRowIndex?: number;
  subHeaderRowIndex?: number;

  headers: string[];

  scoreColumns?: ParsedScoreColumn[];

  rows: any[][];

  /**
   * 해당 Sheet의 은평성모병원 기준행
   */
  baseline?: SheetBaseline;

  report: SheetValidationReport;
}


/**
 * ============================================================
 * 16. Uploaded File
 * ============================================================
 */

export interface UploadedFileMetadata {
  id: string;

  fileName: string;
  fileSize: number;

  fileType:
    | "SCORE"
    | "VOC"
    | "PAST_SCORE"
    | "COMBINED";

  sheetNames: string[];

  selectedSheet?: string;

  rowCount: number;

  detectedPeriod?: string;

  detectedDepartmentCount?: number;
  detectedVocCount?: number;

  validationStatus:
    | "VALID"
    | "WARNING"
    | "ERROR";

  validationErrors: string[];

  validationWarnings?: string[];

  privacyWarnings: number;

  parsedData?: any;

  parsedSheets?: ParsedSheetData[];

  sheetReports?: SheetValidationReport[];

  /**
   * 전체 Workbook에서 추출된
   * Sheet별 기준값
   */
  sheetBaselines?: SheetBaseline[];
}


/**
 * ============================================================
 * 17. Session History
 * ============================================================
 */

export interface SessionHistoryItem {
  id: string;

  timestamp: string;

  title: string;

  evaluatedDepartments: number;

  vulnerableCount: number;

  vocTotalCount: number;

  criteriaSnapshot: CriteriaConfig;

  selectedDepartmentId?: string;
}


/**
 * ============================================================
 * 18. Constants
 * ============================================================
 */

/**
 * Feedback Report 작성부서
 *
 * 기존 "적정진료관리실(QI)" 등의 표현 대신
 * 여기 한 곳에서 관리하는 것을 권장합니다.
 */
export const CX_REPORT_AUTHOR_DEPARTMENT =
  "고객행복팀";