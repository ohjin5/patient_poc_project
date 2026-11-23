import dotenv from "dotenv";

import app from "./app";

dotenv.config();


/**
 * ============================================================
 * Local / General Node Server Entry
 * ============================================================
 *
 * 역할:
 * - server/app.ts에서 만든 Express app을 실행
 * - 로컬 개발 및 일반 Node 실행용
 *
 * Vercel에서는 이 파일을 직접 사용하지 않고,
 * api/index.ts에서 동일한 app을 Server Function으로 export합니다.
 */
const PORT =
  Number(
    process.env.PORT ||
    3001
  );


app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `[CX Analysis Backend] Server running on http://0.0.0.0:${PORT}`
    );


    console.log(
      `[CX Analysis Backend] AI provider=Google AI Studio | model=${
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite"
      } | apiKeyConfigured=${Boolean(
        process.env.GEMINI_API_KEY?.trim()
      )}`
    );

  }
);
