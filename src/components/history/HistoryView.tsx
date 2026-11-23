import React from "react";
import { DepartmentSummary, CriteriaConfig } from "../../types";
import { ShieldCheck } from "lucide-react";

interface HistoryViewProps {
  currentPeriod: string;
  departments: DepartmentSummary[];
  criteria: CriteriaConfig;
  vulnerableCount: number;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentPeriod,
  departments,
  criteria,
  vulnerableCount,
}) => {
  const mockSnapshots = [
    {
      id: "SNAP-2026-Q2-003",
      timestamp: "2026-08-24 14:30:22",
      period: "2026년 2분기",
      vulnerableFound: vulnerableCount,
      totalAnalyzed: departments.length,
      logic: criteria.combinationLogic,
      operator: "적정진료관리실 (QI팀)",
      status: "COMPLETED",
    },
    {
      id: "SNAP-2026-Q2-002",
      timestamp: "2026-08-20 11:15:00",
      period: "2026년 2분기",
      vulnerableFound: 4,
      totalAnalyzed: 8,
      logic: "OR",
      operator: "적정진료관리실 (QI팀)",
      status: "COMPLETED",
    },
    {
      id: "SNAP-2026-Q1-001",
      timestamp: "2026-05-12 16:45:10",
      period: "2026년 1분기",
      vulnerableFound: 2,
      totalAnalyzed: 8,
      logic: "OR",
      operator: "적정진료관리실 (QI팀)",
      status: "ARCHIVED",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                분석 이력 및 감사
              </span>
              <span className="text-xs text-[#64748B] font-medium">분석 이력 및 개인정보 감사 로그</span>
            </div>
            <h2 className="mt-1.5 text-base font-bold text-[#1E293B]">
              분석 스냅샷 이력 및 개인정보 비식별화 현황
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              적용된 기준 스냅샷, 분석 실행 시점, 산출된 취약부서 목록 및 개인정보 마스킹 처리 이력을 투명하게 관리합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Sanitization Live Audit Card */}
      <div className="rounded-xl border border-[#C7E6D7] bg-[#EBF5F0]/50 p-5 shadow-2xs">
        <div className="flex items-center gap-2 font-bold text-[#2E7D5B] text-xs border-b border-[#C7E6D7] pb-3">
          <ShieldCheck className="h-4 w-4 text-[#2E7D5B]" />
          <span>개인정보보호 및 비식별화 실시간 감사 현황</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="bg-white p-3.5 rounded-xl border border-[#C7E6D7]">
            <span className="text-[#64748B]">주민등록번호 마스킹</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">6건 탐지·차단</div>
            <span className="text-[11px] text-[#2E7D5B] font-semibold">100% 비식별화 완료</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-[#C7E6D7]">
            <span className="text-[#64748B]">전화번호 마스킹</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">18건 탐지·차단</div>
            <span className="text-[11px] text-[#2E7D5B] font-semibold">100% 비식별화 완료</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-[#C7E6D7]">
            <span className="text-[#64748B]">환자 등록번호/차트번호</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">24건 탐지·차단</div>
            <span className="text-[11px] text-[#2E7D5B] font-semibold">100% 비식별화 완료</span>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-[#C7E6D7]">
            <span className="text-[#64748B]">환자 성명 마스킹</span>
            <div className="text-lg font-bold text-[#1E293B] mt-1">32건 탐지·차단</div>
            <span className="text-[11px] text-[#2E7D5B] font-semibold">김** / 박** 변환</span>
          </div>
        </div>
      </div>

      {/* Snapshots Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-[#1E293B] border-b border-[#EEF1F4] pb-3">
          분석 실행 스냅샷 기록
        </h3>

        <div className="mt-3 rounded-xl border border-[#E2E8F0] overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#F8F9FA] text-[#64748B] font-semibold border-b border-[#EEF1F4]">
              <tr>
                <th className="py-2.5 px-3.5">스냅샷 ID</th>
                <th className="py-2.5 px-3">실행 일시</th>
                <th className="py-2.5 px-3">평가기간</th>
                <th className="py-2.5 px-3">적용 결합 논리</th>
                <th className="py-2.5 px-3 text-right">선별 취약부서</th>
                <th className="py-2.5 px-3">실행자</th>
                <th className="py-2.5 px-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {mockSnapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-[#F8F9FA]">
                  <td className="py-3 px-3.5 font-mono font-bold text-[#243B53]">{snap.id}</td>
                  <td className="py-3 px-3 text-[#64748B]">{snap.timestamp}</td>
                  <td className="py-3 px-3 font-semibold text-[#1E293B]">{snap.period}</td>
                  <td className="py-3 px-3 text-[#64748B]">{snap.logic} 조건</td>
                  <td className="py-3 px-3 text-right font-bold text-[#B94A48]">{snap.vulnerableFound}개 부서</td>
                  <td className="py-3 px-3 text-[#64748B]">{snap.operator}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center rounded-md bg-[#EBF5F0] border border-[#C7E6D7] px-2 py-0.5 text-[11px] font-bold text-[#2E7D5B]">
                      {snap.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
