import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionCookie = req.cookies?.cx_session;
  const authHeader = req.headers.authorization;

  const isValidSession = sessionCookie === "authenticated" || authHeader === "Bearer authenticated";

  if (!isValidSession) {
    res.status(401).json({
      success: false,
      error: "인증이 필요합니다. 접근코드를 확인해주세요.",
    });
    return;
  }

  next();
}
