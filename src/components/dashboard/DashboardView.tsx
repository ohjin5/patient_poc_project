import React from "react";
import {
  DepartmentSummary,
  RawVocItem,
} from "../../types";
import { MetricCard } from "../common/MetricCard";
import { StatusBadge, PriorityBadge, ScoreDelta } from "../common/StatusBadge";
import { AnalysisEngine } from "../../services/analysisEngine";
import {
  Building2,
  AlertOctagon,
  MessageSquareWarning,
  Flame,
  ArrowRight,
  UploadCloud,
  FilePlus2,
  FileText,
} from "lucide-react";

interface DashboardViewProps {
  departments: DepartmentSummary[];
  vulnerableDepartments: DepartmentSummary[];
  vocList: RawVocItem[];
  hospitalAvg: number;
  scoreChangeAvg: number;
  onSelectDepartment: (deptId: string) => void;
  onNavigate: (menu: any) => void;
  onLoadSampleData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  departments,
  vulnerableDepartments,
  vocList,
  hospitalAvg,
  scoreChangeAvg,
  onSelectDepartment,
  onNavigate,
  onLoadSampleData,
}) => {
  // Empty State
  if (!departments || departments.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECF2F7] text-[#243B53] mb-4">
          <UploadCloud className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-[#1E293B]">아직 분석된 데이터가 없습니다</h2>
        <p className="mx-auto mt-2 max-w-md text-xs text-[#64748B] leading-relaxed">
          환자경험평가 점수와 VOC 데이터를 업로드하면 취약부서와 핵심 개선과제를 자동으로 분석합니다.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate("upload")}
            className="inline-flex items-center gap-2 rounded-lg bg-[#243B53] hover:bg-[#1B2F44] px-5 py-2.5 text-xs font-bold text-white transition-colors shadow-xs"
          >
            <UploadCloud className="h-4 w-4" />
            <span>데이터 업로드 시작</span>
          </button>
          {onLoadSampleData && (
            <button
              type="button"
              onClick={onLoadSampleData}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-5 py-2.5 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] transition-colors shadow-2xs"
            >
              <FilePlus2 className="h-4 w-4 text-[#64748B]" />
              <span>샘플 데이터 불러오기</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const vocStats = AnalysisEngine.aggregateVocStats(vocList);

  // Prepare Domain Declining Rankings
  const domainNames = [
    "간호사 영역",
    "의사 영역",
    "투약 및 치료과정",
    "병원환경",
    "환자권리보장",
    "전반적 평가",
  ];

  const domainChartData = domainNames.map((name) => {
    let currentTotal = 0;
    let prevTotal = 0;
    let count = 0;
    
    departments.forEach((dept) => {
      const d = dept.domains.find((item) => item.domainName === name);
      if (d) {
        currentTotal += d.currentScore;
        prevTotal += d.previousScore;
        count++;
      }
    });

    const currentAvg = count > 0 ? Number((currentTotal / count).toFixed(1)) : 80;
    const prevAvg = count > 0 ? Number((prevTotal / count).toFixed(1)) : 80;
    const change = Number((currentAvg - prevAvg).toFixed(1));

    return {
      domain: name,
      currentScore: currentAvg,
      previousScore: prevAvg,
      change,
    };
  });

  const top5DecliningDomains = [...domainChartData].sort((a, b) => a.change - b.change).slice(0, 5);
  const top5Vulnerable = vulnerableDepartments.slice(0, 5);
  const topPriorityDept = vulnerableDepartments[0] || departments[0];

  return (
    <div className="space-y-6">
      {/* 1. Header Guidance */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                Dashboard Overview
              </span>
              <span className="text-xs text-[#64748B] font-medium">
                환자경험평가 및 VOC 분석 결과를 한눈에 확인하세요.
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-[#1E293B] tracking-tight">
              2026년 2분기 환자경험(CX) 종합 모니터링
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("vulnerable")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] transition-colors shadow-2xs"
            >
              <AlertOctagon className="h-4 w-4 text-[#B94A48]" />
              <span>취약부서 ({vulnerableDepartments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("feedback")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] hover:bg-[#1B2F44] px-4 py-2 text-xs font-bold text-white transition-colors shadow-xs"
            >
              <FileText className="h-4 w-4" />
              <span>Feedback Sheet 보기</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top 4 Core KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* KPI 1: 전체 평균 점수 */}
        <MetricCard
          id="kpi-hospital-avg"
          title="전체 평균 점수"
          value={`${hospitalAvg.toFixed(1)}점`}
          delta={scoreChangeAvg}
          deltaLabel="전기 대비"
          variant="primary"
          icon={Building2}
        />

        {/* KPI 2: 취약부서 수 */}
        <MetricCard
          id="kpi-vulnerable-count"
          title="취약부서 수"
          value={`${vulnerableDepartments.length}개`}
          subValue={`총 ${departments.length}개 중 ${Math.round((vulnerableDepartments.length / departments.length) * 100)}%`}
          variant="danger"
          icon={AlertOctagon}
        />

        {/* KPI 3: 부정 VOC 건수 */}
        <MetricCard
          id="kpi-voc-count"
          title="부정 VOC 건수"
          value={`${vocStats.sentimentCounts.negative}건`}
          subValue={`전체 수집 ${vocStats.totalCount}건 중`}
          icon={MessageSquareWarning}
        />

        {/* KPI 4: 가장 우선 개선 부서 */}
        <div className="rounded-xl border border-[#E2E8F0] border-t-2 border-t-[#B87A24] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#64748B] mb-1">
              <span className="text-xs font-semibold text-[#64748B]">가장 우선 개선 부서</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FEF8EC] text-[#B87A24]">
                <Flame className="h-4 w-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-[#1E293B] truncate mt-1">
              {topPriorityDept ? (topPriorityDept.displayName || topPriorityDept.name) : "-"}
            </div>
            <div className="text-xs text-[#64748B] mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#1E293B]">
                {topPriorityDept ? `${topPriorityDept.overallScore.toFixed(1)}점` : ""}
              </span>
              {topPriorityDept && (
                <span className="text-[10px] text-[#243B53] bg-[#ECF2F7] px-1.5 py-0.5 rounded font-medium">
                  {topPriorityDept.peerGroupLabel} {topPriorityDept.peerGroupRank || topPriorityDept.rank}위/{topPriorityDept.peerGroupSize || topPriorityDept.totalRanked}개
                </span>
              )}
              {topPriorityDept && <ScoreDelta delta={topPriorityDept.scoreChange} className="text-[11px]" />}
            </div>
          </div>
          {topPriorityDept && (
            <button
              type="button"
              onClick={() => onSelectDepartment(topPriorityDept.id)}
              className="mt-3 inline-flex items-center justify-between text-xs font-bold text-[#243B53] hover:text-[#1B2F44] bg-[#ECF2F7] px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <span>원인 진단 바로가기</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Mid Core TOP 5 Analysis Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* TOP 5 Vulnerable Departments */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5 mb-3">
              <h3 className="text-xs font-bold text-[#1E293B]">취약부서 TOP 5</h3>
              <button
                type="button"
                onClick={() => onNavigate("vulnerable")}
                className="text-[11px] font-semibold text-[#3B5B7E] hover:text-[#243B53] hover:underline"
              >
                전체보기 →
              </button>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {top5Vulnerable.map((dept, idx) => (
                <div
                  key={dept.id}
                  onClick={() => onSelectDepartment(dept.id)}
                  className="flex items-center justify-between py-2.5 hover:bg-[#F8F9FA] px-1.5 rounded-lg cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#94A3B8]">0{idx + 1}</span>
                    <span className="font-bold text-[#1E293B]">{dept.displayName || dept.name}</span>
                    <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded">
                      {dept.peerGroupLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1E293B]">{dept.overallScore.toFixed(1)}점</span>
                    <ScoreDelta delta={dept.scoreChange} className="text-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TOP 5 Declining Domains */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5 mb-3">
              <h3 className="text-xs font-bold text-[#1E293B]">하락 평가영역 TOP 5</h3>
              <span className="text-[11px] text-[#94A3B8]">전기 대비</span>
            </div>

            <div className="divide-y divide-[#F1F5F9]">
              {top5DecliningDomains.map((item, idx) => (
                <div key={item.domain} className="flex items-center justify-between py-2.5 px-1.5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold text-[#94A3B8]">0{idx + 1}</span>
                    <span className="font-semibold text-[#334155]">{item.domain}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#64748B]">{item.currentScore.toFixed(1)}점</span>
                    <ScoreDelta delta={item.change} className="text-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TOP 5 VOC Issues */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5 mb-3">
              <h3 className="text-xs font-bold text-[#1E293B]">주요 VOC 이슈 TOP 5</h3>
              <span className="text-[11px] text-[#94A3B8]">총 {vocStats.totalCount}건</span>
            </div>

            <div className="space-y-2 text-xs">
              {vocStats.topIssueCategories.slice(0, 5).map((issue, idx) => (
                <div key={issue.category} className="rounded-lg bg-[#F8F9FA] border border-[#EEF1F4] p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E293B]">
                      <span className="font-mono text-[#94A3B8] font-normal mr-1.5">0{idx + 1}</span>
                      {issue.category}
                    </span>
                    <span className="text-[11px] font-bold text-[#B94A48] bg-[#FDF2F2] px-2 py-0.5 rounded-md border border-[#F6D3D3]">
                      {issue.count}건 ({issue.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Detail Table: 취약부서 목록 */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EEF1F4] bg-[#F8F9FA] px-5 py-3.5">
          <div>
            <h3 className="text-xs font-bold text-[#1E293B]">취약부서 전체 목록</h3>
            <p className="text-[11px] text-[#64748B]">부서를 클릭하면 원인 진단 및 개선 계획 화면으로 이동합니다.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("vulnerable")}
            className="text-xs font-semibold text-[#3B5B7E] hover:text-[#243B53] hover:underline"
          >
            취약부서 상세 관리 →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8F9FA] text-[#64748B] font-semibold border-b border-[#EEF1F4]">
              <tr>
                <th className="py-3 px-4">우선순위</th>
                <th className="py-3 px-4">부서명</th>
                <th className="py-3 px-3 text-center">동일유형 순위</th>
                <th className="py-3 px-3 text-right">현재점수</th>
                <th className="py-3 px-3 text-right">전기 대비</th>
                <th className="py-3 px-4">주요 이슈</th>
                <th className="py-3 px-3 text-center">상태</th>
                <th className="py-3 px-4 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {vulnerableDepartments.slice(0, 6).map((dept) => (
                <tr
                  key={dept.id}
                  onClick={() => onSelectDepartment(dept.id)}
                  className="hover:bg-[#F8F9FA] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-bold">
                    <PriorityBadge priority={dept.priority} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-bold text-[#1E293B]">
                    {dept.displayName || dept.name}
                    <span className="text-[11px] font-normal text-[#64748B] block">
                      {dept.peerGroupLabel || dept.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium text-[#1E293B]">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#ECF2F7] text-[#243B53] text-[11px] font-bold">
                      {dept.peerGroupRank || dept.rank}위 / {dept.peerGroupSize || dept.totalRanked}개
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[#1E293B]">
                    {dept.overallScore.toFixed(1)}점
                  </td>
                  <td className="py-3 px-3 text-right">
                    <ScoreDelta delta={dept.scoreChange} />
                  </td>
                  <td className="py-3 px-4 text-[#475569] max-w-xs truncate">
                    {dept.vulnerabilityReasons[0] || "종합 점수 하락"}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <StatusBadge status={dept.status} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onSelectDepartment(dept.id)}
                      className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] hover:text-[#1E293B] transition-colors"
                    >
                      상세 진단
                    </button>
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
