import React from "react";
import { DepartmentSummary } from "../../types";
import { AnalysisEngine } from "../../services/analysisEngine";
import { Award } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface BenchmarkViewProps {
  departments: DepartmentSummary[];
  hospitalAvg: number;
  selectedDeptId: string;
  onSelectDeptId: (id: string) => void;
}

export const BenchmarkView: React.FC<BenchmarkViewProps> = ({
  departments,
  hospitalAvg,
  selectedDeptId,
  onSelectDeptId,
}) => {
  const currentDept =
    departments.find((d) => d.id === selectedDeptId) || departments[0];

  if (!currentDept || departments.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs">
        <Award className="mx-auto h-12 w-12 text-[#94A3B8] mb-3" />
        <h3 className="text-base font-bold text-[#1E293B]">벤치마킹 데이터가 없습니다</h3>
        <p className="mt-1 text-xs text-[#64748B]">
          부서 평가 데이터를 업로드하면 병원 평균, 동일 그룹, 우수 부서와의 다차원 비교 분석이 제공됩니다.
        </p>
      </div>
    );
  }

  const { benchmarks, topPerformer, groupAvg } = AnalysisEngine.generateBenchmarkComparison(
    currentDept,
    departments
  );

  // Prepare Chart Comparison Data
  const chartData = benchmarks.map((b) => ({
    영역: b.domainName,
    해당부서: b.targetScore,
    병원평균: b.hospitalAvg,
    동일그룹평균: b.groupAvg,
    우수부서: b.topPerformerScore,
  }));

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                벤치마킹 분석
              </span>
              <span className="text-xs text-[#64748B] font-medium">비교 및 다차원 벤치마킹</span>
            </div>
            <h2 className="mt-1.5 text-base font-bold text-[#1E293B]">
              병원 전체평균·동일그룹·우수부서 다차원 비교 분석
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              해당 부서의 6대 평가영역별 점수를 병원 전체 평균, 동일 부서군({currentDept.type}군), 최고 득점 우수 부서와 정밀 비교합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-[#64748B]">분석 대상 부서:</label>
            <select
              value={currentDept.id}
              onChange={(e) => onSelectDeptId(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-1.5 text-xs font-bold text-[#1E293B] focus:border-[#243B53] focus:outline-hidden"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type}) - {d.overallScore}점
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Top KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-bold text-[#243B53]">{currentDept.name} 종합점수</span>
          <div className="mt-1 text-2xl font-black text-[#1E293B]">{currentDept.overallScore}점</div>
          <span className="text-[11px] text-[#64748B] font-medium">전기 대비 {currentDept.scoreChange > 0 ? "+" : ""}{currentDept.scoreChange}점</span>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-bold text-[#64748B]">병원 전체 평균</span>
          <div className="mt-1 text-2xl font-black text-[#1E293B]">{hospitalAvg}점</div>
          <span className="text-[11px] text-[#B94A48] font-bold">
            격차: {Number((currentDept.overallScore - hospitalAvg).toFixed(1))}점
          </span>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4.5 shadow-2xs">
          <span className="text-xs font-bold text-[#64748B]">{currentDept.type}군 평균</span>
          <div className="mt-1 text-2xl font-black text-[#1E293B]">{groupAvg}점</div>
          <span className="text-[11px] text-[#64748B] font-medium">
            동일 진료단위 격차: {Number((currentDept.overallScore - groupAvg).toFixed(1))}점
          </span>
        </div>

        <div className="rounded-xl border border-[#F9E7C4] bg-[#FEF8EC] p-4.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#B87A24]">원내 최우수 부서</span>
            <Award className="h-4 w-4 text-[#B87A24]" />
          </div>
          <div className="mt-1 text-xl font-bold text-[#78350F]">
            {topPerformer?.name || "52병동"} ({topPerformer?.overallScore || 91.2}점)
          </div>
          <span className="text-[11px] text-[#B87A24] font-bold">
            최대 갭: {Number(((topPerformer?.overallScore || 91.2) - currentDept.overallScore).toFixed(1))}점
          </span>
        </div>
      </div>

      {/* Radar Chart & Bar Chart Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs lg:col-span-6">
          <h3 className="text-xs font-bold text-[#1E293B] border-b border-[#EEF1F4] pb-3">
            4자 비교 다각형 레이더 프로파일
          </h3>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData}>
                <PolarGrid stroke="#EEF1F4" />
                <PolarAngleAxis dataKey="영역" tick={{ fontSize: 10, fill: "#475569" }} />
                <PolarRadiusAxis domain={[60, 95]} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                <Radar name={currentDept.name} dataKey="해당부서" stroke="#243B53" fill="#243B53" fillOpacity={0.25} />
                <Radar name="병원평균" dataKey="병원평균" stroke="#94A3B8" fill="#94A3B8" fillOpacity={0.15} />
                <Radar name="우수부서" dataKey="우수부서" stroke="#B87A24" fill="#B87A24" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs lg:col-span-6">
          <h3 className="text-xs font-bold text-[#1E293B] border-b border-[#EEF1F4] pb-3">
            영역별 점수 및 벤치마크 바 차트
          </h3>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="영역" tick={{ fontSize: 10, fill: "#475569" }} interval={0} angle={-15} textAnchor="end" />
                <YAxis domain={[60, 95]} tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="해당부서" fill="#243B53" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="병원평균" fill="#CBD5E1" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="동일그룹평균" fill="#5F8079" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="우수부서" fill="#B87A24" radius={[3, 3, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Domain Benchmark Gap Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-[#1E293B] border-b border-[#EEF1F4] pb-3">
          영역별 벤치마크 격차 및 벤치마킹 포인트
        </h3>

        <div className="mt-3 rounded-xl border border-[#E2E8F0] overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#F8F9FA] text-[#64748B] font-semibold border-b border-[#EEF1F4]">
              <tr>
                <th className="py-2.5 px-3.5">평가영역</th>
                <th className="py-2.5 px-3 text-right">해당부서</th>
                <th className="py-2.5 px-3 text-right">병원평균</th>
                <th className="py-2.5 px-3 text-right">병원평균 격차</th>
                <th className="py-2.5 px-3 text-right">우수부서 점수</th>
                <th className="py-2.5 px-3 text-right">우수부서 격차</th>
                <th className="py-2.5 px-4">벤치마킹 핵심 포인트</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {benchmarks.map((b) => (
                <tr key={b.domainName} className="hover:bg-[#F8F9FA]">
                  <td className="py-3 px-3.5 font-bold text-[#1E293B]">{b.domainName}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#243B53]">{b.targetScore.toFixed(1)}점</td>
                  <td className="py-3 px-3 text-right text-[#64748B]">{b.hospitalAvg.toFixed(1)}점</td>
                  <td className="py-3 px-3 text-right">
                    <span className={b.gapWithHospital < 0 ? "text-[#B94A48] font-bold" : "text-[#2E7D5B] font-bold"}>
                      {b.gapWithHospital > 0 ? `+${b.gapWithHospital}` : b.gapWithHospital}점
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-[#64748B]">{b.topPerformerScore.toFixed(1)}점</td>
                  <td className="py-3 px-3 text-right font-bold text-[#B87A24]">{b.gapWithTopPerformer}점</td>
                  <td className="py-3 px-4 text-[#475569]">{b.benchmarkingPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
