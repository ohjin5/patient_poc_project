import { GoogleGenAI } from "@google/genai";



import {

  VocAnalysisRequest,

  VocAnalysisResponse,

  RootCauseRequest,

  RootCauseResponse,

  ActionPlanRequest,

  ActionPlanResponse,

  SummaryRequest,

  SummaryResponse,

} from "../types/aiTypes";



import {

  buildVocAnalysisPrompt,

} from "../prompts/vocAnalysisPrompt";



import {

  buildRootCausePrompt,

} from "../prompts/rootCausePrompt";



import {

  buildActionPlanPrompt,

} from "../prompts/actionPlanPrompt";



import {

  buildSummaryPrompt,

} from "../prompts/summaryPrompt";





/**
 * ============================================================
 * Gemini Client
 * ============================================================
 *
 * Google AI Studio / Gemini Developer API 방식
 *
 * - Vertex AI 사용하지 않음
 * - GOOGLE_CLOUD_PROJECT 사용하지 않음
 * - GOOGLE_CLOUD_LOCATION 사용하지 않음
 * - Application Default Credentials 사용하지 않음
 * - Service Account JSON 사용하지 않음
 *
 * 서버 환경변수:
 *   GEMINI_API_KEY
 *
 * 중요:
 * - API Key를 소스코드에 직접 작성하지 않음
 * - 브라우저에 노출되는 VITE_GEMINI_API_KEY 사용 금지
 * - Vercel에서는 Server-side Environment Variable로만 등록
 */

function initGeminiClient(): GoogleGenAI {

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (
    !apiKey ||
    !apiKey.trim()
  ) {
    throw new Error(
      "GEMINI_API_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  return new GoogleGenAI({
    apiKey:
      apiKey.trim(),
  });
}


/**
 * ============================================================
 * JSON Parser

 * ============================================================

 *

 * 중요:

 *

 * - JSON 파싱 실패 시 fallback 생성 금지

 * - Gemini 원문 전체 로그 출력 금지

 * - 오류는 상위 Route로 전달

 */

function parseJsonResponse<T>(

  rawText: string,

  operationName: string

): T {



  if (

    !rawText ||

    !rawText.trim()

  ) {

    throw new Error(

      `${operationName}: Gemini 응답이 비어 있습니다.`

    );

  }





  try {



    let cleanText =

      rawText.trim();





    /**

     * 혹시 Markdown Code Block이 포함된 경우 제거

     */

    if (

      cleanText.startsWith(

        "```json"

      )

    ) {



      cleanText =

        cleanText

          .replace(

            /^```json\s*/i,

            ""

          )

          .replace(

            /\s*```$/,

            ""

          );



    } else if (

      cleanText.startsWith(

        "```"

      )

    ) {



      cleanText =

        cleanText

          .replace(

            /^```\s*/,

            ""

          )

          .replace(

            /\s*```$/,

            ""

          );

    }





    return JSON.parse(

      cleanText

    ) as T;



  } catch (error) {



    /**

     * 환자 VOC 원문이나

     * Gemini 전체 응답은 로그에 남기지 않습니다.

     */

    console.error(

      `[GeminiService] ${operationName} JSON parsing failed`,

      error instanceof Error

        ? error.message

        : error

    );





    throw new Error(

      `${operationName}: Gemini 응답 JSON 형식이 올바르지 않습니다.`

    );

  }

}





/**

 * ============================================================

 * Validation Helpers

 * ============================================================

 */



function isFiniteNumber(

  value: unknown

): value is number {



  return (

    typeof value === "number" &&

    Number.isFinite(value)

  );

}





function isStringArray(

  value: unknown

): value is string[] {



  return (

    Array.isArray(value) &&

    value.every(

      (item) =>

        typeof item ===

        "string"

    )

  );

}





function assertObject(

  value: unknown,

  label: string

): asserts value is Record<string, unknown> {



  if (

    !value ||

    typeof value !==

      "object" ||

    Array.isArray(value)

  ) {



    throw new Error(

      `${label} 형식이 올바르지 않습니다.`

    );

  }

}





/**
 * ============================================================
 * Gemini Retry Helpers
 * ============================================================
 *
 * Gemini Developer API의 일시적인 capacity / backend 오류만 재시도합니다.
 *
 * 재시도 대상:
 * - 429 RESOURCE_EXHAUSTED
 * - 500 INTERNAL
 * - 503 UNAVAILABLE
 *
 * JSON 파싱/검증 오류, 인증/권한 오류 등은 재시도하지 않습니다.
 */

const GEMINI_MAX_ATTEMPTS = 4;
const GEMINI_RETRY_BASE_DELAY_MS = 2000;


function sleep(
  milliseconds: number
): Promise<void> {

  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


function getErrorText(
  error: unknown
): string {

  if (
    error instanceof Error
  ) {
    return error.message || "";
  }


  try {
    return JSON.stringify(
      error
    );
  } catch {
    return String(
      error
    );
  }
}


function isRetryableGeminiError(
  error: unknown
): boolean {

  const errorObject =
    error &&
    typeof error === "object"
      ? error as {
          code?: unknown;
          status?: unknown;
          error?: {
            code?: unknown;
            status?: unknown;
          };
        }
      : null;


  const numericCodes = [
    errorObject?.code,
    errorObject?.error?.code,
  ]
    .map(
      (value) =>
        typeof value === "number"
          ? value
          : Number(value)
    )
    .filter(
      (value) =>
        Number.isFinite(value)
    );


  if (
    numericCodes.some(
      (code) =>
        code === 429 ||
        code === 500 ||
        code === 503
    )
  ) {
    return true;
  }


  const statusValues = [
    errorObject?.status,
    errorObject?.error?.status,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string"
    )
    .map(
      (value) =>
        value.toUpperCase()
    );


  if (
    statusValues.some(
      (status) =>
        status === "RESOURCE_EXHAUSTED" ||
        status === "INTERNAL" ||
        status === "UNAVAILABLE"
    )
  ) {
    return true;
  }


  const errorText =
    getErrorText(
      error
    ).toUpperCase();


  return (
    /(^|[^0-9])429([^0-9]|$)/.test(
      errorText
    ) ||
    /(^|[^0-9])500([^0-9]|$)/.test(
      errorText
    ) ||
    /(^|[^0-9])503([^0-9]|$)/.test(
      errorText
    ) ||
    errorText.includes(
      "RESOURCE_EXHAUSTED"
    ) ||
    errorText.includes(
      "UNAVAILABLE"
    ) ||
    errorText.includes(
      "INTERNAL"
    )
  );
}


async function generateContentWithRetry(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  operationName: string,
  temperature: number
) {

  let lastError: unknown;


  for (
    let attempt = 1;
    attempt <= GEMINI_MAX_ATTEMPTS;
    attempt += 1
  ) {

    try {

      return await ai.models.generateContent({
        model,

        contents:
          prompt,

        config: {
          responseMimeType:
            "application/json",

          temperature,
        },
      });

    } catch (error) {

      lastError =
        error;


      const retryable =
        isRetryableGeminiError(
          error
        );


      const isLastAttempt =
        attempt ===
        GEMINI_MAX_ATTEMPTS;


      if (
        !retryable ||
        isLastAttempt
      ) {
        throw error;
      }


      const exponentialDelay =
        GEMINI_RETRY_BASE_DELAY_MS *
        2 ** (
          attempt - 1
        );


      const jitter =
        Math.floor(
          Math.random() *
          500
        );


      const retryDelay =
        exponentialDelay +
        jitter;


      console.warn(
        `[GeminiService] ${operationName} transient Gemini API error | attempt=${attempt}/${GEMINI_MAX_ATTEMPTS} | retryInMs=${retryDelay}`
      );


      await sleep(
        retryDelay
      );
    }
  }


  throw lastError;
}


/**
 * ============================================================
 * Gemini Service
 * ============================================================
 */

export class GeminiService {



  /**

   * ==========================================================

   * Gemini Model

   * ==========================================================

   */



  private static getModelName(): string {

    /**
     * 환경변수가 있으면 해당 모델을 사용하고,
     * 없으면 비용 효율적인 Flash-Lite 기본값을 사용합니다.
     *
     * 운영 시에는 Vercel 환경변수에 GEMINI_MODEL을
     * 명시적으로 등록하는 것을 권장합니다.
     */
    return (
      process.env.GEMINI_MODEL ||
      "gemini-2.5-flash-lite"
    ).trim();
  }


  /**
   * ==========================================================
   * Common generateContent

   * ==========================================================

   */



  private static async generateJson<T>(

    prompt: string,

    operationName: string,

    temperature = 0.2

  ): Promise<T> {



    const ai =

      initGeminiClient();





    const response =
      await generateContentWithRetry(
        ai,
        this.getModelName(),
        prompt,
        operationName,
        temperature
      );





    const text =

      response.text || "";





    return parseJsonResponse<T>(

      text,

      operationName

    );

  }





  /**

   * ==========================================================

   * 1. VOC Analysis

   * ==========================================================

   */



  public static async analyzeVoc(

    req: VocAnalysisRequest

  ): Promise<VocAnalysisResponse> {



    if (!req) {

      throw new Error(

        "VOC 분석 요청 데이터가 없습니다."

      );

    }





    if (

      !req.department ||

      !req.department.trim()

    ) {

      throw new Error(

        "VOC 분석 대상 부서가 없습니다."

      );

    }





    if (

      !Array.isArray(

        req.vocList

      )

    ) {

      throw new Error(

        "VOC 목록 형식이 올바르지 않습니다."

      );

    }





    try {



      console.info(

        `[GeminiService] VOC analysis start | department=${req.department} | vocCount=${req.vocList.length}`

      );





      const prompt =

        buildVocAnalysisPrompt(

          req

        );





      const result =

        await this.generateJson<VocAnalysisResponse>(

          prompt,

          "VOC 분석",

          0.2

        );





      this.validateVocAnalysisResponse(

        result

      );





      console.info(

        `[GeminiService] VOC analysis success | department=${req.department}`

      );





      return result;



    } catch (error) {



      console.error(

        `[GeminiService] VOC analysis failed | department=${req.department}`,

        error instanceof Error

          ? error.message

          : error

      );





      /**

       * Mock/Fallback 절대 사용하지 않음

       */

      throw error;

    }

  }





  /**

   * ==========================================================

   * 2. Root Cause Analysis

   * ==========================================================

   */



  public static async analyzeRootCause(

    req: RootCauseRequest

  ): Promise<RootCauseResponse> {



    if (!req) {

      throw new Error(

        "Root Cause 분석 요청 데이터가 없습니다."

      );

    }





    if (

      !req.department ||

      !req.department.trim()

    ) {

      throw new Error(

        "Root Cause 분석 대상 부서가 없습니다."

      );

    }





    if (

      !Array.isArray(

        req.weakItems

      )

    ) {

      throw new Error(

        "Root Cause 분석용 취약 평가항목 형식이 올바르지 않습니다."

      );

    }





    if (

      req.vocList !== undefined &&

      !Array.isArray(

        req.vocList

      )

    ) {

      throw new Error(

        "Root Cause 분석용 VOC 목록 형식이 올바르지 않습니다."

      );

    }





    try {



      console.info(

        `[GeminiService] Root Cause analysis start | department=${req.department} | weakItems=${req.weakItems.length} | vocCount=${req.vocList?.length ?? 0}`

      );





      const prompt =

        buildRootCausePrompt(

          req

        );





      const result =

        await this.generateJson<RootCauseResponse>(

          prompt,

          "Root Cause 분석",

          0.2

        );





      this.validateRootCauseResponse(

        result

      );





      console.info(

        `[GeminiService] Root Cause analysis success | department=${req.department} | causes=${result.rootCauses.length}`

      );





      return result;



    } catch (error) {



      console.error(

        `[GeminiService] Root Cause analysis failed | department=${req.department}`,

        error instanceof Error

          ? error.message

          : error

      );





      throw error;

    }

  }





  /**

   * ==========================================================

   * 3. Action Plan

   * ==========================================================

   */



  public static async generateActionPlan(

    req: ActionPlanRequest

  ): Promise<ActionPlanResponse> {



    if (!req) {

      throw new Error(

        "Action Plan 요청 데이터가 없습니다."

      );

    }





    if (

      !req.department ||

      !req.department.trim()

    ) {

      throw new Error(

        "Action Plan 대상 부서가 없습니다."

      );

    }





    const rootCauseInputs =

      Array.isArray(

        req.rootCauses

      )

        ? req.rootCauses

        : Array.isArray(

            req.analysisInputs

          )

        ? req.analysisInputs

        : [];





    const weakItemInputs =

      Array.isArray(

        req.weakItems

      )

        ? req.weakItems

        : [];





    /**

     * ActionPlanRequest의 버전 차이를 고려하여

     * 실제 연결 VOC가 어느 필드로 전달되더라도

     * Prompt에 동일하게 넘길 수 있도록 정규화합니다.

     */

    const requestWithVoc =

      req as ActionPlanRequest & {

        vocList?: unknown[];

        vocItems?: unknown[];

        relatedVocItems?: unknown[];

      };





    const vocInputs =

      Array.isArray(

        requestWithVoc.vocItems

      )

        ? requestWithVoc.vocItems

        : Array.isArray(

            requestWithVoc.relatedVocItems

          )

        ? requestWithVoc.relatedVocItems

        : Array.isArray(

            requestWithVoc.vocList

          )

        ? requestWithVoc.vocList

        : [];





    /**

     * Root Cause / VOC / 취약항목이 모두 없는 경우에는

     * 근거 없는 Action Plan을 생성하지 않습니다.

     *

     * 이는 오류가 아니라 정상적인 "생성할 근거 없음" 상태입니다.

     */

    if (

      rootCauseInputs.length === 0 &&

      weakItemInputs.length === 0 &&

      vocInputs.length === 0

    ) {



      console.info(

        `[GeminiService] Action Plan skipped | department=${req.department} | reason=no evidence`

      );





      return {

        actionPlans: [],

      };

    }





    try {



      console.info(

        `[GeminiService] Action Plan generation start | department=${req.department} | rootCauses=${rootCauseInputs.length} | weakItems=${weakItemInputs.length} | vocCount=${vocInputs.length}`

      );





      /**

       * Prompt에서는 vocItems를 표준 입력명으로 사용합니다.

       */

      const promptRequest =

        {

          ...req,

          vocItems:

            vocInputs,

        } as ActionPlanRequest;





      const prompt =

        buildActionPlanPrompt(

          promptRequest

        );





      const result =

        await this.generateJson<ActionPlanResponse>(

          prompt,

          "Action Plan 생성",

          0.3

        );





      this.validateActionPlanResponse(

        result

      );





      /**

       * Feedback Sheet 정책:

       *

       * 최대 3개만 사용.

       *

       * Gemini가 4개 이상 생성해도

       * Backend에서 한 번 더 제한합니다.

       */

      const normalizedResult:

        ActionPlanResponse = {



        actionPlans:

          result.actionPlans

            .slice(0, 3)

            .map(

              (

                plan,

                index

              ) => ({



                ...plan,



                priority:

                  plan.priority ??

                  index + 1,

              })

            ),

      };





      console.info(

        `[GeminiService] Action Plan generation success | department=${req.department} | plans=${normalizedResult.actionPlans.length}`

      );





      return normalizedResult;



    } catch (error) {



      console.error(

        `[GeminiService] Action Plan generation failed | department=${req.department}`,

        error instanceof Error

          ? error.message

          : error

      );





      throw error;

    }

  }





  /**

   * ==========================================================

   * 4. Final CX Feedback Summary

   * ==========================================================

   *

   * VOC Analysis

   * +

   * Root Cause

   * +

   * Action Plan

   * +

   * Benchmark

   *

   * 를 종합합니다.

   */



  public static async generateSummary(

    req: SummaryRequest

  ): Promise<SummaryResponse> {



    if (!req) {

      throw new Error(

        "종합 분석 요청 데이터가 없습니다."

      );

    }





    if (

      !req.department ||

      !req.department.trim()

    ) {

      throw new Error(

        "종합 분석 대상 부서가 없습니다."

      );

    }





    if (

      !isFiniteNumber(

        req.overallScore

      )

    ) {

      throw new Error(

        "종합 분석 대상의 종합점수가 올바르지 않습니다."

      );

    }





    if (

      !isFiniteNumber(

        req.peerGroupAvg

      )

    ) {

      throw new Error(

        "동일유형 평균값이 올바르지 않습니다."

      );

    }





    if (

      !isFiniteNumber(

        req.peerGroupRank

      ) ||

      !isFiniteNumber(

        req.peerGroupSize

      )

    ) {

      throw new Error(

        "동일유형 순위 정보가 올바르지 않습니다."

      );

    }





    try {



      console.info(

        `[GeminiService] Final summary generation start | department=${req.department}`

      );





      const prompt =

        buildSummaryPrompt(

          req

        );





      const result =

        await this.generateJson<SummaryResponse>(

          prompt,

          "최종 종합 분석",

          0.2

        );





      this.validateSummaryResponse(

        result

      );





      console.info(

        `[GeminiService] Final summary generation success | department=${req.department}`

      );





      return result;



    } catch (error) {



      console.error(

        `[GeminiService] Final summary generation failed | department=${req.department}`,

        error instanceof Error

          ? error.message

          : error

      );





      throw error;

    }

  }





  /**

   * ==========================================================

   * VOC Response Validation

   * ==========================================================

   */



  private static validateVocAnalysisResponse(

    result: VocAnalysisResponse

  ): void {



    assertObject(

      result,

      "VOC 분석 결과"

    );





    if (

      !result.sentimentRatio ||

      typeof result.sentimentRatio !==

        "object"

    ) {

      throw new Error(

        "VOC 분석 결과에 sentimentRatio가 없습니다."

      );

    }





    const {

      positive,

      negative,

      neutral,

    } =

      result.sentimentRatio;





    if (

      !isFiniteNumber(

        positive

      ) ||

      !isFiniteNumber(

        negative

      ) ||

      !isFiniteNumber(

        neutral

      )

    ) {

      throw new Error(

        "VOC sentimentRatio 값이 올바르지 않습니다."

      );

    }





    if (

      !Array.isArray(

        result.keyIssues

      )

    ) {

      throw new Error(

        "VOC 분석 결과에 keyIssues가 없습니다."

      );

    }





    for (

      const issue of

      result.keyIssues

    ) {



      if (

        !issue ||

        typeof issue !==

          "object"

      ) {

        throw new Error(

          "VOC keyIssues 항목 형식이 올바르지 않습니다."

        );

      }





      if (

        typeof issue.category !==

          "string"

      ) {

        throw new Error(

          "VOC keyIssues.category가 올바르지 않습니다."

        );

      }





      if (

        typeof issue.issue !==

          "string"

      ) {

        throw new Error(

          "VOC keyIssues.issue가 올바르지 않습니다."

        );

      }





      if (

        !isFiniteNumber(

          issue.count

        )

      ) {

        throw new Error(

          "VOC keyIssues.count가 올바르지 않습니다."

        );

      }

    }





    if (

      typeof result.vocSummary !==

        "string"

    ) {

      throw new Error(

        "VOC 분석 결과의 vocSummary가 올바르지 않습니다."

      );

    }

  }





  /**

   * ==========================================================

   * Root Cause Validation

   * ==========================================================

   */



  private static validateRootCauseResponse(

    result: RootCauseResponse

  ): void {



    assertObject(

      result,

      "Root Cause 분석 결과"

    );





    if (

      !Array.isArray(

        result.rootCauses

      )

    ) {

      throw new Error(

        "Root Cause 분석 결과에 rootCauses가 없습니다."

      );

    }





    for (

      const cause of

      result.rootCauses

    ) {



      if (

        !cause ||

        typeof cause !==

          "object"

      ) {

        throw new Error(

          "Root Cause 항목 형식이 올바르지 않습니다."

        );

      }





      if (

        typeof cause.dimension !==

          "string"

      ) {

        throw new Error(

          "Root Cause dimension이 올바르지 않습니다."

        );

      }





      if (

        typeof cause.cause !==

          "string"

      ) {

        throw new Error(

          "Root Cause cause가 올바르지 않습니다."

        );

      }





      if (

        !(

          typeof cause.evidence ===

            "string" ||

          isStringArray(

            cause.evidence

          )

        )

      ) {

        throw new Error(

          "Root Cause evidence 형식이 올바르지 않습니다."

        );

      }





      if (

        cause.relatedVocSnippets !==

          undefined &&

        !isStringArray(

          cause.relatedVocSnippets

        )

      ) {

        throw new Error(

          "Root Cause relatedVocSnippets 형식이 올바르지 않습니다."

        );

      }

    }





    if (

      typeof result.analysisOverview !==

        "string"

    ) {

      throw new Error(

        "Root Cause analysisOverview 형식이 올바르지 않습니다."

      );

    }

  }





  /**

   * ==========================================================

   * Action Plan Validation

   * ==========================================================

   */



  private static validateActionPlanResponse(

    result: ActionPlanResponse

  ): void {



    assertObject(

      result,

      "Action Plan 결과"

    );





    if (

      !Array.isArray(

        result.actionPlans

      )

    ) {

      throw new Error(

        "Action Plan 결과에 actionPlans가 없습니다."

      );

    }





    /**

     * 0개 Action Plan도 정상 응답으로 허용합니다.

     *

     * Root Cause / 실제 VOC / 취약 평가항목 등

     * 충분한 근거가 없는 경우에는

     * 가짜 개선안을 만들지 않는 것이 현재 정책입니다.

     */

    if (

      result.actionPlans.length ===

      0

    ) {

      return;

    }





    for (

      const plan of

      result.actionPlans

    ) {



      if (

        !plan ||

        typeof plan !==

          "object"

      ) {

        throw new Error(

          "Action Plan 항목 형식이 올바르지 않습니다."

        );

      }





      if (

        !plan.title ||

        typeof plan.title !==

          "string"

      ) {

        throw new Error(

          "Action Plan title이 없습니다."

        );

      }





      /**

       * 신규 Prompt 구조에서는

       * method / target / schedule / expectedEffect 사용

       *

       * 구버전 필드도 호환

       */

      const hasMethod =

        Boolean(

          plan.method ||

          plan.targetIssue ||

          (

            Array.isArray(

              plan.specificTasks

            ) &&

            plan.specificTasks.length >

              0

          )

        );





      if (!hasMethod) {

        throw new Error(

          `Action Plan "${plan.title}"의 실행방법이 없습니다.`

        );

      }

    }

  }





  /**

   * ==========================================================

   * Summary Validation

   * ==========================================================

   */



  private static validateSummaryResponse(

    result: SummaryResponse

  ): void {



    assertObject(

      result,

      "최종 종합 분석 결과"

    );





    if (

      !result.executiveSummary ||

      typeof result.executiveSummary !==

        "string"

    ) {

      throw new Error(

        "최종 종합 분석 결과에 executiveSummary가 없습니다."

      );

    }





    if (

      result.evidence !==

        undefined &&

      !isStringArray(

        result.evidence

      )

    ) {

      throw new Error(

        "최종 종합 분석의 evidence 형식이 올바르지 않습니다."

      );

    }





    if (

      result.priorityOrder !==

        undefined &&

      !isStringArray(

        result.priorityOrder

      )

    ) {

      throw new Error(

        "최종 종합 분석의 priorityOrder 형식이 올바르지 않습니다."

      );

    }





    /**

     * Feedback Sheet 정책:

     * 최대 3대 Action Plan

     */

    if (

      Array.isArray(

        result.priorityOrder

      ) &&

      result.priorityOrder.length >

        3

    ) {



      result.priorityOrder =

        result.priorityOrder.slice(

          0,

          3

        );

    }





    if (

      Array.isArray(

        result.strategicDirectives

      ) &&

      result.strategicDirectives.length >

        3

    ) {



      result.strategicDirectives =

        result.strategicDirectives.slice(

          0,

          3

        );

    }





    /**

     * ======================================================

     * Benchmark Best Practice

     * ======================================================

     */



    const benchmark =

      result.benchmarkBestPractice;





    if (!benchmark) {



      /**

       * 새 Prompt에서는 반환하도록 요구하지만,

       * 누락된 경우 가짜 값을 만들지는 않습니다.

       *

       * 여기서는 에러로 처리하여

       * Prompt/Model 응답 문제를 명확하게 드러냅니다.

       */

      throw new Error(

        "최종 종합 분석 결과에 benchmarkBestPractice가 없습니다."

      );

    }





    assertObject(

      benchmark,

      "benchmarkBestPractice"

    );





    const allowedSources =

      new Set([

        "ACTUAL",

        "AI_RECOMMENDED",

        "NONE",

      ]);





    if (

      !allowedSources.has(

        benchmark.sourceType

      )

    ) {

      throw new Error(

        "benchmarkBestPractice.sourceType 값이 올바르지 않습니다."

      );

    }





    /**

     * 현재 시스템에는 공식 Best Practice

     * 별도 입력기능이 아직 없기 때문에

     * ACTUAL을 반환하면 거부합니다.

     */

    if (

      benchmark.sourceType ===

      "ACTUAL"

    ) {



      throw new Error(

        "현재 입력에는 공식 Best Practice 데이터가 없으므로 benchmarkBestPractice.sourceType=ACTUAL을 사용할 수 없습니다."

      );

    }





    if (

      benchmark.sourceType ===

      "AI_RECOMMENDED"

    ) {



      if (

        benchmark.aiRecommended !==

        true

      ) {

        throw new Error(

          "AI_RECOMMENDED Benchmark는 aiRecommended=true여야 합니다."

        );

      }





      if (

        !benchmark.sourceDepartment ||

        !benchmark.title ||

        !benchmark.description

      ) {

        throw new Error(

          "AI 추천 Benchmark의 부서명/제목/설명이 누락되었습니다."

        );

      }





      if (

        !Array.isArray(

          benchmark.evidenceQuotes

        ) ||

        benchmark.evidenceQuotes.length ===

          0

      ) {

        throw new Error(

          "AI 추천 Benchmark에는 실제 긍정 VOC 근거가 필요합니다."

        );

      }





      if (

        !benchmark.disclaimer

      ) {

        throw new Error(

          "AI 추천 Benchmark에는 AI 추천 안내문이 필요합니다."

        );

      }

    }





    if (

      benchmark.sourceType ===

      "NONE"

    ) {



      /**

       * NONE인데 AI 추천 표시가 true이면 오류

       */

      if (

        benchmark.aiRecommended ===

        true

      ) {

        throw new Error(

          "Benchmark sourceType=NONE인 경우 aiRecommended=true일 수 없습니다."

        );

      }





      /**

       * NONE이면 VOC 인용문이 없어야 함

       */

      if (

        Array.isArray(

          benchmark.evidenceQuotes

        ) &&

        benchmark.evidenceQuotes.length >

          0

      ) {

        throw new Error(

          "Benchmark sourceType=NONE인데 evidenceQuotes가 포함되어 있습니다."

        );

      }

    }

  }

}