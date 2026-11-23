import { Router } from "express";

const router = Router();

router.post("/login", (req, res) => {
  const { accessCode } = req.body || {};
  const validAccessCode = process.env.APP_ACCESS_CODE || "3432";

  if (accessCode === validAccessCode) {
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("cx_session", "authenticated", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: "/",
    });

    res.json({ success: true });
    return;
  }

  res.status(401).json({
    success: false,
    error: "접근코드가 올바르지 않습니다.",
  });
});

router.get("/session", (req, res) => {
  const session = req.cookies?.cx_session;
  if (session === "authenticated") {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("cx_session", { path: "/" });
  res.json({ success: true });
});

export default router;
