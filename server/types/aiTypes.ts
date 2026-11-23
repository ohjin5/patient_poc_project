/**
 * ============================================================
 * Common Types
 * ============================================================
 */

export type SentimentType =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL";

export type ImpactLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type RootCauseSeverity =
  | "CRITICAL"
  | "WARNING"
  | "NOTICE";

export type CorrelationLevel =
  | "VERY_HIGH"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type WeakItemLevel =
  | "DOMAIN"
  | "QUESTION";


/**
 * ============================================================
 * VOC Input
 * ============================================================
 *
 * Frontend에서 개인정보를 제거한 후
 * Backend로 전달되는 최소 VOC 구조
 */

export interface VocInputItem {
  id: string;

  content: string;

  sentiment?: SentimentType;

  category?: string;

  date?: string;

  recommendationScore?: number;

  /**
   * 실제 Excel 조직 Context
   */
  division?: string;

  center?: string;

  department?: string;

  doctor?: string;

  ward?: string;

  examRoom?: string;
}


/**
 * ============================================================
 * Weak Score Item
 * ============================================================
 *
 * 영역평균뿐 아니라 세부문항도 전달 가능
 */

export interface WeakItemInput {
  itemKey?: string;

  /**
   * 실제 영역
   */
  domainName?: string;

  /**
   * 실제 세부문항
   */
  questionText?: string;

  /**
   * 화면/Prompt 표시용
   *
   * 예:
   * 의사 영역 > 의사 설명
   */
  itemName: string;

  currentScore?: number;

  /**
   * 이전 구조 호환용
   */
  score?: number;

  previousScore?: number;

  change?: number;

  /**
   * 해당 Sheet의
   * 은평성모병원 기준값
   */
  hospitalAvg?: number;

  /**
   * 동일 Peer Group 평균
   */
  peerAvg?: number;

  /**
   * 이전 구조 호환용
   */
  gap?: number;

  gapWithHospital?: number;

  gapWithPeerGroup?: number;

  /**
   * 영역평균인지 세부문항인지
   */
  level?: WeakItemLevel;
}


/**
 * ============================================================
 * Benchmark
 * ============================================================
 */

export interface BenchmarkDomainInput {
  domainId?: string;

  domainName?: string;

  departmentScore?: number;

  targetScore?: number;

  hospitalAvg?: number;

  peerGroupAvg?: number;

  topPerformerScore?: number;

  gapWithHospital?: number;

  gapWithPeerGroup?: number;

  gapWithTopPerformer?: number;
}


export interface BenchmarkTopPerformerInput {
  id?: string;

  name?: string;

  overallScore?: number;

  peerGroup?: string;

  sourceSheet?: string;

  positiveVocCount?: number;
}


export interface BenchmarkInput {
  benchmarks?: BenchmarkDomainInput[];

  peerGroupAvg?: number;

  peerGroupRank?: number;

  peerGroupSize?: number;

  isSmallPeerGroup?: boolean;

  topPerformer?:
    | BenchmarkTopPerformerInput
    | null;

  /**
   * 실제 우수부서의 긍정 VOC만 전달
   */
  topPerformerPositiveVoc?: VocInputItem[];

  [key: string]: unknown;
}


/**
 * ============================================================
 * 1. VOC Analysis
 * ============================================================
 */

export interface VocAnalysisRequest {
  department: string;

  peerGroup?: string;

  peerGroupLabel?: string;

  sourceSheet?: string;

  parentDepartment?: string;

  parentCenter?: string;

  overallScore?: number;

  previousScore?: number;

  scoreChange?: number;

  hospitalAvg?: number;

  peerGroupAvg?: number;

  peerGroupGap?: number;

  peerGroupRank?: number;

  peerGroupSize?: number;

  weakItems?: WeakItemInput[];

  /**
   * 반드시 현재 분석단위에 연결된
   * 실제 비식별 VOC만 전달
   */
  vocList: VocInputItem[];
}


export interface VocKeyIssueResponse {
  category: string;

  /**
   * Prompt 기본 필드
   */
  issue: string;

  count: number;

  impact: ImpactLevel;

  representativeQuotes?: string[];

  sentiment?: SentimentType;
}


export interface VocAnalysisResponse {
  sentimentRatio: {
    positive: number;
    negative: number;
    neutral: number;
  };

  keyIssues:
    VocKeyIssueResponse[];

  vocSummary: string;

  urgencyLevel?:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";
}


/**
 * ============================================================
 * 2. Root Cause Analysis
 * ============================================================
 */

export interface RootCauseRequest {
  department: string;

  peerGroup?: string;

  peerGroupLabel?: string;

  sourceSheet?: string;

  parentDepartment?: string;

  parentCenter?: string;

  overallScore: number;

  previousScore?: number;

  scoreChange?: number;

  hospitalAvg?: number;

  peerGroupAvg: number;

  peerGroupGap?: number;

  peerGroupRank?: number;

  peerGroupSize?: number;

  /**
   * 실제 취약 영역/세부문항
   */
  weakItems: WeakItemInput[];

  /**
   * 해당 분석단위의 실제 비식별 VOC
   */
  vocList?: VocInputItem[];

  /**
   * 앞 단계 VOC Analysis 결과
   */
  keyIssues?: Array<{
    category: string;

    issue?: string;

    summary?: string;

    count?: number;

    impact?: string;

    sentiment?: string;

    representativeQuotes?: string[];
  }>;

  vocSummary?: string;

  /**
   * 추가 정량 / Benchmark Context
   */
  scoreContext?: {
    benchmarks?: BenchmarkDomainInput[];

    peerGroupAvg?: number;

    hospitalAvg?: number;

    peerGroupRank?: number;

    peerGroupSize?: number;

    topPerformer?:
      | BenchmarkTopPerformerInput
      | null;

    topPerformerPositiveVoc?: VocInputItem[];

    [key: string]: unknown;
  };
}


export interface RootCauseItemResponse {
  dimension: string;

  /**
   * 연결된 실제 평가 문항
   */
  question?: string;

  cause: string;

  /**
   * 정량 및 정성 근거
   *
   * 실제 환자 인용문은
   * relatedVocSnippets와 구분
   */
  evidence:
    | string
    | string[];

  severity:
    RootCauseSeverity;

  currentScore?: number;

  change?: number;

  hospitalGap?: number;

  peerGroupGap?: number;

  vocCount?: number;

  correlationLevel?:
    CorrelationLevel;

  confidence?:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  /**
   * 실제 VOC에서만 가져온 인용문
   */
  relatedVocSnippets?: string[];

  estimatedRootCause?: string;

  recommendationFocus?: string;
}


export interface RootCauseResponse {
  rootCauses:
    RootCauseItemResponse[];

  analysisOverview: string;
}


/**
 * ============================================================
 * 3. Action Plan
 * ============================================================
 */

export interface ActionPlanRootCauseInput {
  dimension?: string;

  domain?: string;

  question?: string;

  cause?: string;

  estimatedRootCause?: string;

  currentScore?: number;

  change?: number;

  hospitalGap?: number;

  peerGroupGap?: number;

  relatedVocSnippets?: string[];

  correlationLevel?: string;

  recommendationFocus?: string;

  evidence?: string[];

  severity?:
    RootCauseSeverity;
}


export interface ActionPlanRequest {
  department: string;

  peerGroup?: string;

  peerGroupLabel?: string;

  sourceSheet?: string;

  parentDepartment?: string;

  parentCenter?: string;

  overallScore?: number;

  previousScore?: number;

  scoreChange?: number;

  hospitalAvg?: number;

  peerGroupAvg?: number;

  peerGroupRank?: number;

  peerGroupSize?: number;

  /**
   * 실제 취약 평가영역 / 세부문항
   *
   * Root Cause가 없더라도 weakItems가 존재하면
   * 점검·모니터링 중심의 보수적인 Action Plan 근거로 사용할 수 있습니다.
   */
  weakItems?: WeakItemInput[];

  /**
   * 현재 분석단위에 직접 연결된 실제 비식별 VOC
   *
   * Action Plan 생성 시 근거 우선순위:
   * 1) Root Cause
   * 2) 실제 VOC
   * 3) weakItems
   *
   * 환자등록번호 등 직접 식별정보는 포함하지 않습니다.
   */
  vocItems?: VocInputItem[];

  /**
   * 기존/다른 호출부 호환용 alias
   *
   * 신규 코드에서는 vocItems 사용을 권장합니다.
   */
  relatedVocItems?: VocInputItem[];

  /**
   * 기존 Root Cause / Summary 요청 구조와의 호환용 alias
   *
   * 신규 Action Plan 호출에서는 vocItems 사용을 권장합니다.
   */
  vocList?: VocInputItem[];

  /**
   * Root Cause 실제 결과
   */
  rootCauses?:
    ActionPlanRootCauseInput[];

  /**
   * 이전 구조 호환용
   */
  analysisInputs?:
    ActionPlanRootCauseInput[];

  /**
   * 동일유형 Benchmark
   */
  benchmark?:
    BenchmarkInput;
}


export interface ActionPlanItemResponse {
  /**
   * 숫자 1, 2, 3 권장
   */
  priority?:
    | number
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  title: string;

  targetIssue?: string;

  /**
   * 기존 Prompt 구조
   */
  timeline?: string;

  owner?: string;

  specificTasks?: string[];

  expectedImpact?: string;

  /**
   * 신규 Feedback Sheet 구조
   */
  method?: string;

  target?: string;

  schedule?: string;

  expectedEffect?: string;

  kpi?: string;
}


export interface ActionPlanResponse {
  /**
   * 0~3개 허용
   *
   * 근거가 충분하면 최대 3개까지 생성하며,
   * Root Cause / VOC / weakItems 모두 근거가 부족한 경우에는
   * 빈 배열도 정상 결과로 허용합니다.
   */
  actionPlans:
    ActionPlanItemResponse[];
}


/**
 * ============================================================
 * 4. Final Summary
 * ============================================================
 */

export interface SummaryVocAnalysisInput {
  summary?: string;

  keyIssues?: Array<{
    category?: string;

    count?: number;

    sentiment?: string;

    summary?: string;

    issue?: string;

    representativeQuotes?: string[];
  }>;

  sentimentDistribution?: {
    positive?: number;

    neutral?: number;

    negative?: number;
  };

  urgencyLevel?: string;
}


export interface SummaryRootCauseInput {
  matches?: Array<{
    domainName?: string;

    /**
     * 이전 구조 호환
     */
    domain?: string;

    questionText?: string;

    /**
     * 이전 구조 호환
     */
    question?: string;

    currentScore?: number;

    scoreChange?: number;

    /**
     * 이전 구조 호환
     */
    change?: number;

    hospitalGap?: number;

    peerGroupGap?: number;

    vocCount?: number;

    relatedVocSnippets?: string[];

    estimatedRootCause?: string;

    correlationLevel?: string;

    recommendationFocus?: string;

    evidence?: string[];

    severity?: string;
  }>;

  comprehensiveDiagnosis?: string;
}


export interface SummaryActionPlanInput {
  actionPlans?: Array<{
    priority?: number | string;

    title?: string;

    method?: string;

    target?: string;

    schedule?: string;

    expectedEffect?: string;

    kpi?: string;
  }>;
}


export interface SummaryRequest {
  department: string;

  peerGroup?: string;

  peerGroupLabel?: string;

  sourceSheet?: string;

  parentDepartment?: string;

  parentCenter?: string;

  overallScore: number;

  previousScore?: number;

  scoreChange?: number;

  /**
   * 해당 Sheet의
   * "은평성모병원" 기준값
   */
  hospitalAvg?: number;

  peerGroupAvg: number;

  peerGroupRank: number;

  peerGroupSize: number;

  /**
   * 실제 취약 영역 + 세부문항
   */
  weakItems?: WeakItemInput[];

  /**
   * 최종 Summary에는 일부 대표 VOC만 전달
   */
  vocList?: VocInputItem[];

  /**
   * STEP 1
   */
  vocAnalysis?:
    SummaryVocAnalysisInput;

  /**
   * STEP 2
   */
  rootCauseAnalysis?:
    SummaryRootCauseInput;

  /**
   * STEP 3
   */
  actionPlanAnalysis?:
    SummaryActionPlanInput;

  /**
   * Peer Benchmark
   * +
   * 우수부서 긍정 VOC
   */
  benchmarkData?:
    BenchmarkInput;

  /**
   * 이전 버전 호환용
   */
  keyIssues?: Array<{
    issue?: string;
    summary?: string;
  }>;

  rootCauses?: Array<{
    cause?: string;
    estimatedRootCause?: string;
  }>;

  actionPlans?: Array<{
    title?: string;
  }>;
}


/**
 * ============================================================
 * AI Recommended Benchmark
 * ============================================================
 *
 * ACTUAL:
 * 실제 별도 운영사례 데이터가 있는 경우만 사용
 *
 * AI_RECOMMENDED:
 * 우수부서의 실제 긍정 VOC를 근거로
 * AI가 참고사례를 제안한 경우
 *
 * NONE:
 * 근거 없음
 */

export type BenchmarkBestPracticeSource =
  | "ACTUAL"
  | "AI_RECOMMENDED"
  | "NONE";


export interface BenchmarkBestPracticeResponse {
  sourceType:
    BenchmarkBestPracticeSource;

  sourceDepartment?: string;

  title?: string;

  description?: string;

  /**
   * 실제 제공된 긍정 VOC에서만 선택
   */
  evidenceQuotes?: string[];

  aiRecommended?: boolean;

  disclaimer?: string;
}


/**
 * ============================================================
 * Summary Response
 * ============================================================
 */

export interface SummaryResponse {
  executiveSummary: string;

  coreProblem?: string;

  evidence?: string[];

  detailedDiagnosis?: string;

  priorityOrder?: string[];

  /**
   * 우수부서 긍정 VOC를 기반으로
   * AI가 추천한 경우에만 반환
   */
  benchmarkBestPractice?:
    BenchmarkBestPracticeResponse;

  /**
   * 이전 Prompt 호환용
   */
  strategicDirectives?: string[];

  conclusion?: string;
}