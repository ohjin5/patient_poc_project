import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { login } from "../../services/authService";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [accessCode, setAccessCode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await login(accessCode.trim());
    setLoading(false);

    if (res.success) {
      onLoginSuccess();
    } else {
      setErrorMsg(res.error || "접근코드가 올바르지 않습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Card Container */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 sm:p-10 space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="가톨릭대학교 은평성모병원 로고"
                className="h-12 object-contain"
                onError={(e) => {
                  // Fallback icon if logo image is unavailable
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            
            <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
              환자경험평가(CX) 분석 시스템
            </h1>
            <p className="text-xs text-[#64748B]">
              시스템에 접속하려면 접근코드를 입력해주세요.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="accessCode" className="block text-xs font-semibold text-[#475569]">
                접근코드
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="accessCode"
                  type="password"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="● ● ● ●"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#F8F9FA] border border-[#CBD5E1] rounded-xl text-sm font-semibold tracking-widest text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#243B53] focus:border-transparent transition"
                  autoFocus
                />
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs text-[#B94A48] bg-[#FDF2F2] rounded-xl border border-[#F8D7DA]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !accessCode}
              className="w-full py-3 px-4 bg-[#243B53] hover:bg-[#1B2C3F] active:bg-[#121E2B] disabled:bg-[#94A3B8] text-white text-xs font-bold rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>인증 확인 중...</span>
                </>
              ) : (
                <>
                  <span>접속하기</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[#F1F5F9] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#2E7D5B]" />
              <span>가톨릭대학교 은평성모병원 CX 종합 분석 체계</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
