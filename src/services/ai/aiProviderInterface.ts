import {
  RawVocItem,
  DepartmentSummary,
  RootCauseMatch,
  ActionPlanItem,
  VocCategory,
  SentimentType,
  BenchmarkBestPractice,
} from "../../types";


/**
 * ============================================================
 * VOC Analysis
 * ============================================================
 */

export interface VocAnalysisOutput {
  summary: string;

  keyIssues: {
    category: VocCategory;

    count: number;

    sentiment: SentimentType;

    summary: string;

    representativeQuotes: string[];
  }[];

  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };

  urgencyLevel:
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";
}


/**
 * ============================================================
 * Root Cause Analysis
 * ============================================================
 */

export interface RootCauseOutput {
  matches: RootCauseMatch[];

  comprehensiveDiagnosis: string;
}


/**
 * ============================================================
 * Action Plan
 * ============================================================
 */

export interface ActionPlanOutput {
  /**
   * 최종 Feedback Sheet에서는
   * 최대 3개만 사용합니다.
   */
  actionPlans: ActionPlanItem[];
}


/**
 * ============================================================
 * Final Feedback Report
 * ============================================================
 */

export interface FeedbackReportOutput {
  executiveSummary: string;

  coreProblem: string;

  evidence: string[];

  detailedDiagnosis: string;

  priorityOrder: string[];

  /**
   * 동일유형 우수부서의 실제 긍정 VOC를
   * 기반으로 Gemini가 추천한 경우에만 존재
   *
   * 실제 근거가 없으면 undefined
   */
  benchmarkBestPractice?: BenchmarkBestPractice;
}


/**
 * ============================================================
 * Final Report Context
 * ============================================================
 *
 * 최종 Summary는 새로운 분석을 처음부터 수행하는 것이 아니라
 * 앞 단계의 결과들을 종합하는 역할입니다.
 */

export interface FeedbackReportContext {
  /**
   * STEP 1
   * 실제 관련 VOC 분석 결과
   */
  vocAnalysis: VocAnalysisOutput;

  /**
   * STEP 2
   * 정량점수 + VOC Root Cause 분석 결과
   */
  rootCauseAnalysis: RootCauseOutput;

  /**
   * STEP 3
   * Root Cause + 실제 관련 VOC 기반 Action Plan
   */
  actionPlanAnalysis: ActionPlanOutput;

  /**
   * 동일 Peer Group Benchmark
   *
   * 여기에 다음과 같은 정보가 들어갈 수 있음:
   *
   * - 동일유형 평균
   * - 동일유형 순위
   * - 동일유형 우수부서
   * - 우수부서 점수
   * - 우수부서 실제 긍정 VOC
   */
  benchmarkData?: {
    benchmarks?: unknown[];

    peerGroupAvg?: number;

    peerGroupRank?: number;

    peerGroupSize?: number;

    isSmallPeerGroup?: boolean;

    topPerformer?: {
      id?: string;
      name?: string;
      overallScore?: number;
      sourceSheet?: string;
    } | null;

    /**
     * 실제 긍정 VOC 근거만 들어갑니다.
     */
    topPerformerPositiveVoc?: Array<{
      id?: string;
      content?: string;
      category?: string;
      sentiment?: string;
      date?: string;
      recommendationScore?: number;
      division?: string;
      center?: string;
      department?: string;
      doctor?: string;
      ward?: string;
      examRoom?: string;
    }>;

    [key: string]: unknown;
  };
}


/**
 * ============================================================
 * AI Provider Interface
 * ============================================================
 */

export interface AIProvider {
  /**
   * 실제 해당 분석대상 VOC의
   * 의미 / 감성 / 주요 이슈 분석
   */
  analyzeVOC(
    vocList: RawVocItem[],
    departmentName?: string
  ): Promise<VocAnalysisOutput>;


  /**
   * 정량평가 + 실제 VOC를
   * 교차분석하여 Root Cause 추정
   */
  analyzeRootCause(
    department: DepartmentSummary,

    vocList: RawVocItem[],

    /**
     * Benchmark / VOC Analysis 등
     * 추가 Context
     */
    scoreContext?: {
      benchmarks?: unknown;

      vocAnalysis?: VocAnalysisOutput;

      peerGroupAvg?: number;

      hospitalAvg?: number;

      peerGroupRank?: number;

      peerGroupSize?: number;

      domains?: unknown;

      topPerformer?: {
        id?: string;
        name?: string;
        peerGroup?: string;
        overallScore?: number;
        positiveVocCount?: number;
      } | null;

      topPerformerPositiveVoc?: RawVocItem[];

      [key: string]: unknown;
    }
  ): Promise<RootCauseOutput>;


  /**
   * Root Cause + 실제 관련 VOC를 함께 사용하여
   * 부서 맞춤형 3대 Action Plan 생성
   *
   * vocList에는 현재 분석대상과 직접 연결되고,
   * 개인정보 비식별화가 완료된 VOC만 전달합니다.
   */
  generateActionPlan(
    department: DepartmentSummary,

    rootCauses: RootCauseMatch[],

    vocList: RawVocItem[],

    benchmarkGap?: {
      benchmarks?: unknown;

      peerGroupAvg?: number;

      topPerformer?: {
        name?: string;
        overallScore?: number;
      } | null;

      [key: string]: unknown;
    }
  ): Promise<ActionPlanOutput>;


  /**
   * VOC Analysis
   * +
   * Root Cause
   * +
   * Action Plan
   * +
   * Benchmark
   *
   * 결과를 종합한 최종 Feedback Report 생성
   */
  generateFeedbackReport(
    department: DepartmentSummary,

    vocList: RawVocItem[],

    context: FeedbackReportContext
  ): Promise<FeedbackReportOutput>;
}
