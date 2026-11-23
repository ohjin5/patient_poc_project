import {
  Router,
  Request,
  Response,
} from "express";

import {
  requireAuth,
} from "../middleware/authMiddleware.js";

import {
  GeminiService,
} from "../services/geminiService.js";

import type {
  VocAnalysisRequest,
  RootCauseRequest,
  ActionPlanRequest,
  SummaryRequest,
} from "../types/aiTypes.js";


const router =
  Router();


/**
 * ============================================================
 * 공통 인증
 * ============================================================
 *
 * 모든 AI Endpoint는
 * 로그인 사용자만 접근 가능
 */
router.use(
  requireAuth
);


/**
 * ============================================================
 * Helpers
 * ============================================================
 */

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}


function hasNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}


function sendBadRequest(
  res: Response,
  message: string
) {
  return res
    .status(400)
    .json({
      success: false,
      error: message,
    });
}


function sendServerError(
  res: Response,
  message: string
) {
  return res
    .status(500)
    .json({
      success: false,
      error: message,
    });
}


/**
 * ============================================================
 * Health Check
 * ============================================================
 *
 * Gemini API를 실제 호출하지 않습니다.
 *
 * Backend AI Route와
 * 인증 Middleware가 정상 동작하는지 확인하는 용도입니다.
 */
router.get(
  "/health",
  (_req, res) => {
    return res.json({
      status: "ok",
      service:
        "cx-ai-router",
      provider:
        "google-ai-studio",
    });
  }
);


/**
 * ============================================================
 * 1. VOC Analysis
 * ============================================================
 */
router.post(
  "/voc-analysis",

  async (
    req: Request<
      Record<string, never>,
      unknown,
      VocAnalysisRequest
    >,
    res: Response
  ) => {
    try {
      if (
        !isPlainObject(
          req.body
        )
      ) {
        return sendBadRequest(
          res,
          "VOC 분석 요청 데이터가 올바르지 않습니다."
        );
      }


      if (
        !hasNonEmptyString(
          req.body.department
        )
      ) {
        return sendBadRequest(
          res,
          "VOC 분석 대상 정보가 없습니다."
        );
      }


      if (
        !Array.isArray(
          req.body.vocList
        )
      ) {
        return sendBadRequest(
          res,
          "VOC 목록 형식이 올바르지 않습니다."
        );
      }


      /**
       * 환자 VOC 원문이나
       * 전체 req.body는 로그에 남기지 않습니다.
       */
      console.info(
        `[AI Route] VOC analysis request | department=${req.body.department} | vocCount=${req.body.vocList.length}`
      );


      const result =
        await GeminiService
          .analyzeVoc(
            req.body
          );


      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "[AI Route] VOC analysis failed:",
        err instanceof Error
          ? err.message
          : "Unknown error"
      );


      return sendServerError(
        res,
        "VOC 분석 중 오류가 발생했습니다."
      );
    }
  }
);


/**
 * ============================================================
 * 2. Root Cause Analysis
 * ============================================================
 */
router.post(
  "/root-cause",

  async (
    req: Request<
      Record<string, never>,
      unknown,
      RootCauseRequest
    >,
    res: Response
  ) => {
    try {
      if (
        !isPlainObject(
          req.body
        )
      ) {
        return sendBadRequest(
          res,
          "Root Cause 분석 요청 데이터가 올바르지 않습니다."
        );
      }


      if (
        !hasNonEmptyString(
          req.body.department
        )
      ) {
        return sendBadRequest(
          res,
          "Root Cause 분석 대상 정보가 없습니다."
        );
      }


      if (
        !Array.isArray(
          req.body.weakItems
        )
      ) {
        return sendBadRequest(
          res,
          "취약 평가항목 형식이 올바르지 않습니다."
        );
      }


      if (
        req.body.vocList !==
          undefined &&
        !Array.isArray(
          req.body.vocList
        )
      ) {
        return sendBadRequest(
          res,
          "Root Cause 분석용 VOC 목록 형식이 올바르지 않습니다."
        );
      }


      console.info(
        `[AI Route] Root Cause request | department=${req.body.department} | weakItems=${req.body.weakItems.length} | vocCount=${req.body.vocList?.length ?? 0}`
      );


      const result =
        await GeminiService
          .analyzeRootCause(
            req.body
          );


      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "[AI Route] Root Cause analysis failed:",
        err instanceof Error
          ? err.message
          : "Unknown error"
      );


      return sendServerError(
        res,
        "Root Cause 분석 중 오류가 발생했습니다."
      );
    }
  }
);


/**
 * ============================================================
 * 3. Action Plan
 * ============================================================
 *
 * 현재 정책:
 *
 * - Root Cause가 있으면 Root Cause 기반 생성
 * - Root Cause가 없어도 실제 VOC가 있으면 보수적 VOC 기반 생성
 * - Root Cause/VOC가 없어도 취약항목이 있으면 점검·모니터링 중심 생성
 * - 근거가 전혀 없으면 GeminiService에서 빈 배열 반환
 */
router.post(
  "/action-plan",

  async (
    req: Request<
      Record<string, never>,
      unknown,
      ActionPlanRequest
    >,
    res: Response
  ) => {
    try {
      if (
        !isPlainObject(
          req.body
        )
      ) {
        return sendBadRequest(
          res,
          "Action Plan 요청 데이터가 올바르지 않습니다."
        );
      }


      if (
        !hasNonEmptyString(
          req.body.department
        )
      ) {
        return sendBadRequest(
          res,
          "Action Plan 대상 정보가 없습니다."
        );
      }


      /**
       * ActionPlanRequest 버전 호환
       *
       * 실제 관련 VOC는 현재 구현에 따라
       * vocItems / relatedVocItems / vocList 중
       * 하나로 전달될 수 있습니다.
       */
      const bodyWithVoc =
        req.body as ActionPlanRequest & {
          vocItems?: unknown[];
          relatedVocItems?: unknown[];
          vocList?: unknown[];
        };


      const rootCauses =
        Array.isArray(
          req.body.rootCauses
        )
          ? req.body.rootCauses
          : Array.isArray(
              req.body.analysisInputs
            )
          ? req.body.analysisInputs
          : [];


      const weakItems =
        Array.isArray(
          req.body.weakItems
        )
          ? req.body.weakItems
          : [];


      const vocItems =
        Array.isArray(
          bodyWithVoc.vocItems
        )
          ? bodyWithVoc.vocItems
          : Array.isArray(
              bodyWithVoc.relatedVocItems
            )
          ? bodyWithVoc.relatedVocItems
          : Array.isArray(
              bodyWithVoc.vocList
            )
          ? bodyWithVoc.vocList
          : [];


      /**
       * Route에서는 근거 없음 상태를 오류로 막지 않습니다.
       *
       * GeminiService.generateActionPlan()이
       * 실제 근거 유무를 최종 판단하고,
       * 근거가 전혀 없으면 actionPlans: []를 반환합니다.
       */
      console.info(
        `[AI Route] Action Plan request | department=${req.body.department} | rootCauses=${rootCauses.length} | weakItems=${weakItems.length} | vocCount=${vocItems.length}`
      );


      const result =
        await GeminiService
          .generateActionPlan(
            req.body
          );


      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "[AI Route] Action Plan generation failed:",
        err instanceof Error
          ? err.message
          : "Unknown error"
      );


      return sendServerError(
        res,
        "Action Plan 생성 중 오류가 발생했습니다."
      );
    }
  }
);


/**
 * ============================================================
 * 4. Final Summary
 * ============================================================
 */
router.post(
  "/summary",

  async (
    req: Request<
      Record<string, never>,
      unknown,
      SummaryRequest
    >,
    res: Response
  ) => {
    try {
      if (
        !isPlainObject(
          req.body
        )
      ) {
        return sendBadRequest(
          res,
          "종합 요약 요청 데이터가 올바르지 않습니다."
        );
      }


      if (
        !hasNonEmptyString(
          req.body.department
        )
      ) {
        return sendBadRequest(
          res,
          "종합 분석 대상 정보가 없습니다."
        );
      }


      if (
        typeof req.body
          .overallScore !==
          "number" ||
        !Number.isFinite(
          req.body.overallScore
        )
      ) {
        return sendBadRequest(
          res,
          "종합점수 정보가 올바르지 않습니다."
        );
      }


      if (
        typeof req.body
          .peerGroupAvg !==
          "number" ||
        !Number.isFinite(
          req.body.peerGroupAvg
        )
      ) {
        return sendBadRequest(
          res,
          "동일유형 평균 정보가 올바르지 않습니다."
        );
      }


      if (
        typeof req.body
          .peerGroupRank !==
          "number" ||
        !Number.isFinite(
          req.body.peerGroupRank
        ) ||
        typeof req.body
          .peerGroupSize !==
          "number" ||
        !Number.isFinite(
          req.body.peerGroupSize
        )
      ) {
        return sendBadRequest(
          res,
          "동일유형 순위 정보가 올바르지 않습니다."
        );
      }


      console.info(
        `[AI Route] Summary request | department=${req.body.department} | peerRank=${req.body.peerGroupRank}/${req.body.peerGroupSize}`
      );


      const result =
        await GeminiService
          .generateSummary(
            req.body
          );


      return res.json(
        result
      );

    } catch (err) {

      console.error(
        "[AI Route] Summary generation failed:",
        err instanceof Error
          ? err.message
          : "Unknown error"
      );


      return sendServerError(
        res,
        "종합 요약 생성 중 오류가 발생했습니다."
      );
    }
  }
);


export default router;
