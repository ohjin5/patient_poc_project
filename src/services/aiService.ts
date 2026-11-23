/**
 * ============================================================
 * AI API Service
 * ============================================================
 *
 * Frontend
 *   ↓
 * Node / Express Backend
 *   ↓
 * Vertex AI Gemini
 *
 * Browser에서 Gemini SDK를 직접 호출하지 않습니다.
 */

const API_BASE =
  (import.meta as any).env
    ?.VITE_API_BASE_URL ||
  "";


/**
 * ============================================================
 * Types
 * ============================================================
 */

interface ApiErrorResponse {
  success?: boolean;
  error?: string;
  message?: string;
}


type AiEndpoint =
  | "/api/ai/voc-analysis"
  | "/api/ai/root-cause"
  | "/api/ai/action-plan"
  | "/api/ai/summary";


/**
 * ============================================================
 * Common POST
 * ============================================================
 */

async function postAiRequest<TResponse>(
  endpoint: AiEndpoint,
  payload: unknown,
  fallbackErrorMessage: string
): Promise<TResponse> {

  const response =
    await fetch(
      `${API_BASE}${endpoint}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        /**
         * HttpOnly 인증 Cookie 전달
         */
        credentials:
          "include",

        body:
          JSON.stringify(
            payload
          ),
      }
    );


  /**
   * 인증 만료 / 미인증
   */
  if (
    response.status === 401
  ) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }


  /**
   * Backend Error
   */
  if (!response.ok) {

    const serverMessage =
      await readSafeErrorMessage(
        response
      );


    throw new Error(
      serverMessage ||
        fallbackErrorMessage
    );
  }


  /**
   * 성공 응답
   */
  try {

    return (
      await response.json()
    ) as TResponse;

  } catch {

    throw new Error(
      "서버 응답 형식을 확인할 수 없습니다."
    );
  }
}


/**
 * ============================================================
 * Safe Error Reader
 * ============================================================
 *
 * Backend Route가 반환하는
 *
 * {
 *   success: false,
 *   error: "..."
 * }
 *
 * 의 일반 오류 메시지만 읽습니다.
 *
 * 서버 내부 Stack Trace나
 * Gemini Raw Response는 사용하지 않습니다.
 */

async function readSafeErrorMessage(
  response: Response
): Promise<string | null> {

  try {

    const data =
      (
        await response.json()
      ) as ApiErrorResponse;


    if (
      typeof data.error ===
        "string" &&
      data.error.trim()
    ) {
      return data.error.trim();
    }


    if (
      typeof data.message ===
        "string" &&
      data.message.trim()
    ) {
      return data.message.trim();
    }


    return null;

  } catch {

    return null;
  }
}


/**
 * ============================================================
 * 1. VOC Analysis
 * ============================================================
 */

export async function fetchVocAnalysis<
  TResponse = any
>(
  payload: unknown
): Promise<TResponse> {

  return postAiRequest<TResponse>(
    "/api/ai/voc-analysis",
    payload,
    "VOC 분석 요청에 실패했습니다."
  );
}


/**
 * ============================================================
 * 2. Root Cause Analysis
 * ============================================================
 */

export async function fetchRootCause<
  TResponse = any
>(
  payload: unknown
): Promise<TResponse> {

  return postAiRequest<TResponse>(
    "/api/ai/root-cause",
    payload,
    "Root Cause 분석 요청에 실패했습니다."
  );
}


/**
 * ============================================================
 * 3. Action Plan
 * ============================================================
 */

export async function fetchActionPlan<
  TResponse = any
>(
  payload: unknown
): Promise<TResponse> {

  return postAiRequest<TResponse>(
    "/api/ai/action-plan",
    payload,
    "Action Plan 생성 요청에 실패했습니다."
  );
}


/**
 * ============================================================
 * 4. Final Summary
 * ============================================================
 */

export async function fetchSummary<
  TResponse = any
>(
  payload: unknown
): Promise<TResponse> {

  return postAiRequest<TResponse>(
    "/api/ai/summary",
    payload,
    "종합 요약 생성 요청에 실패했습니다."
  );
}