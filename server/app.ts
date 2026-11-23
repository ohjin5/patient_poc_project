import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth.js";
import aiRouter from "./routes/ai.js";

dotenv.config();


/**
 * ============================================================
 * Express Application
 * ============================================================
 *
 * 역할:
 * - API 라우트만 담당
 * - Vite 정적 파일은 제공하지 않음
 * - app.listen() 하지 않음
 *
 * Local:
 *   server/index.ts에서 이 app을 import하여 listen
 *
 * Vercel:
 *   api/index.ts에서 이 app을 import하여 Server Function으로 export
 */
const app =
  express();


/**
 * ============================================================
 * CORS
 * ============================================================
 *
 * Local:
 *   FRONTEND_ORIGIN=http://localhost:5173
 *
 * Vercel Production:
 *   Frontend와 API가 동일 Origin이면 FRONTEND_ORIGIN을
 *   별도로 지정하지 않아도 됩니다.
 *
 * 별도 Frontend Origin을 사용할 경우에만
 * Vercel 환경변수 FRONTEND_ORIGIN에 정확한 URL을 등록합니다.
 */
app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      true,

    credentials: true,
  })
);


/**
 * ============================================================
 * Common Middleware
 * ============================================================
 */
app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  cookieParser()
);


/**
 * ============================================================
 * Health Check
 * ============================================================
 */
app.get(
  "/api/health",
  (_req, res) => {
    return res.json({
      status: "ok",

      service:
        "cx-analysis-backend",

      provider:
        "google-ai-studio",

      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite",

      time:
        new Date().toISOString(),
    });
  }
);


/**
 * ============================================================
 * API Routes
 * ============================================================
 */
app.use(
  "/api/auth",
  authRouter
);

app.use(
  "/api/ai",
  aiRouter
);


/**
 * ============================================================
 * Unknown API Route
 * ============================================================
 *
 * API 요청에 index.html 같은 Frontend 문서를 반환하지 않습니다.
 */
app.use(
  "/api",
  (_req, res) => {
    return res
      .status(404)
      .json({
        success: false,
        error:
          "API_NOT_FOUND",
      });
  }
);


/**
 * ============================================================
 * Express Error Handler
 * ============================================================
 *
 * 예상하지 못한 Express 오류도
 * HTML 에러 페이지 대신 JSON으로 반환합니다.
 *
 * 환자 VOC 원문이나 요청 전체 Body는 로그하지 않습니다.
 */
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {

    console.error(
      "[CX Analysis Backend] Unhandled Express error:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );


    if (
      res.headersSent
    ) {
      return;
    }


    return res
      .status(500)
      .json({
        success: false,
        error:
          "서버 처리 중 오류가 발생했습니다.",
      });
  }
);


export default app;
