import React, { useMemo, useState } from "react";

import {
  DepartmentSummary,
  RawVocItem,
  RootCauseMatch,
} from "../../types";

import {
  StatusBadge,
  PriorityBadge,
  ScoreDelta,
} from "../common/StatusBadge";

import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Sparkles,
  FileText,
  Lightbulb,
  Building2,
  Users,
  CalendarDays,
  Stethoscope,
  FlaskConical,
  MapPin,
  ThumbsUp,
  AlertCircle,
} from "lucide-react";


interface DepartmentDetailViewProps {
  department: DepartmentSummary;

  allDepartments: DepartmentSummary[];

  vocList: RawVocItem[];

  /**
   * 기존 App.tsx 호환을 위해 유지합니다.
   *
   * 실제 부서 분석에서는
   * department.hospitalAvg를 우선 사용합니다.
   */
  hospitalAvg: number;

  onGenerateFeedbackSheet: (
    dept: DepartmentSummary
  ) => void | Promise<void>;

  onSelectDepartment: (
    deptId: string
  ) => void;

  /**
   * 실제 AI Root Cause 분석이
   * 별도 State로 관리되는 경우 전달합니다.
   *
   * 전달되지 않으면
   * 임의 결과를 만들지 않습니다.
   */
  rootCauseMatches?: RootCauseMatch[];

  isAiAnalyzing?: boolean;
}


/**
 * ============================================================
 * Department Detail View
 * ============================================================
 */

export const DepartmentDetailView: React.FC<
  DepartmentDetailViewProps
> = ({
  department,
  allDepartments,
  vocList,
  hospitalAvg,
  onGenerateFeedbackSheet,
  onSelectDepartment,
  rootCauseMatches = [],
  isAiAnalyzing = false,
}) => {
  const [expandedDomainId, setExpandedDomainId] =
    useState<string>("");

  const [activeTab, setActiveTab] =
    useState<
      "SCORE" | "VOC" | "ROOT_CAUSE"
    >("SCORE");


  /**
   * ==========================================================
   * Guard
   * ==========================================================
   */

  if (!department) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs">
        <Building2 className="mx-auto mb-3 h-12 w-12 text-[#94A3B8]" />

        <h3 className="text-base font-bold text-[#1E293B]">
          선택된 분석 대상이 없습니다
        </h3>

        <p className="mt-1 text-xs text-[#64748B]">
          설문결과 파일을 업로드한 후 분석 대상을 선택해주세요.
        </p>
      </div>
    );
  }


  /**
   * ==========================================================
   * VOC
   * ==========================================================
   *
   * Normalization 단계에서 생성한
   * relatedUnitIds만 사용합니다.
   *
   * 다른 부서 VOC fallback은 절대 사용하지 않습니다.
   */

  const relatedVoc = useMemo(() => {
    return (vocList || []).filter(
      (voc) =>
        Array.isArray(voc.relatedUnitIds) &&
        voc.relatedUnitIds.includes(
          department.id
        )
    );
  }, [
    vocList,
    department.id,
  ]);


  const positiveVocCount =
    relatedVoc.filter(
      (voc) =>
        voc.sentiment === "POSITIVE"
    ).length;

  const negativeVocCount =
    relatedVoc.filter(
      (voc) =>
        voc.sentiment === "NEGATIVE"
    ).length;

  const neutralVocCount =
    relatedVoc.filter(
      (voc) =>
        voc.sentiment !== "POSITIVE" &&
        voc.sentiment !== "NEGATIVE"
    ).length;

  const negativeRatio =
    relatedVoc.length > 0
      ? Math.round(
          (negativeVocCount /
            relatedVoc.length) *
            100
        )
      : 0;


  /**
   * ==========================================================
   * Score Context
   * ==========================================================
   */

  const officialHospitalAvg =
    Number.isFinite(
      department.hospitalAvg
    ) &&
    department.hospitalAvg > 0
      ? department.hospitalAvg
      : hospitalAvg;

  const peerGroupAvg =
    department.peerGroupAvg ??
    department.typeAvg ??
    0;

  const hospitalGap =
    Number(
      (
        department.overallScore -
        officialHospitalAvg
      ).toFixed(1)
    );

  const peerGap =
    Number(
      (
        department.overallScore -
        peerGroupAvg
      ).toFixed(1)
    );

  const hasPreviousData =
    Boolean(
      department.previousPeriod &&
      department.previousSampleSize > 0
    );


  /**
   * ==========================================================
   * Handlers
   * ==========================================================
   */

  const toggleDomain = (
    domainId: string
  ) => {
    setExpandedDomainId(
      (previous) =>
        previous === domainId
          ? ""
          : domainId
    );
  };


  /**
   * ==========================================================
   * Render
   * ==========================================================
   */

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

        <div className="flex flex-col justify-between gap-4 border-b border-[#EEF1F4] pb-4 sm:flex-row sm:items-center">

          <div>

            <div className="flex flex-wrap items-center gap-2">

              <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                {department.peerGroupLabel}
              </span>

              {department.sourceSheet && (
                <span className="text-[11px] font-medium text-[#94A3B8]">
                  Source: {department.sourceSheet}
                </span>
              )}

            </div>


            <div className="mt-2 flex flex-wrap items-center gap-3">

              <select
                value={department.id}
                onChange={(event) =>
                  onSelectDepartment(
                    event.target.value
                  )
                }
                className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-1.5 text-sm font-bold text-[#1E293B] focus:border-[#243B53] focus:outline-hidden"
              >
                {allDepartments.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name} ·{" "}
                      {item.peerGroupLabel} ·{" "}
                      {item.overallScore.toFixed(
                        1
                      )}
                      점
                    </option>
                  )
                )}
              </select>

              <PriorityBadge
                priority={
                  department.priority
                }
              />

              <StatusBadge
                status={
                  department.status
                }
              />

            </div>


            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#64748B]">

              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                평가기간{" "}
                {department.period}
              </span>

              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                사례수{" "}
                {department.sampleSize.toLocaleString()}
                건
              </span>

              {department.parentDepartment && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  소속 진료과{" "}
                  {
                    department.parentDepartment
                  }
                </span>
              )}

            </div>

          </div>


          <button
            type="button"
            disabled={isAiAnalyzing}
            onClick={() =>
              onGenerateFeedbackSheet(
                department
              )
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAiAnalyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                AI 분석 중...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Feedback Sheet 생성
              </>
            )}
          </button>

        </div>


        {/* ====================================================
            KPI
        ==================================================== */}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">

          <KpiCard
            label="종합점수"
            value={`${department.overallScore.toFixed(
              1
            )}점`}
          />

          <KpiCard
            label={`동일유형 순위`}
            value={
              department.peerGroupSize >
              0
                ? `${department.peerGroupRank}위 / ${department.peerGroupSize}개`
                : "-"
            }
            emphasis
          />

          <KpiCard
            label={`동일유형 평균`}
            subLabel={
              department.peerGroupLabel
            }
            value={
              peerGroupAvg > 0
                ? `${peerGroupAvg.toFixed(
                    1
                  )}점`
                : "-"
            }
          />

          <KpiCard
            label="동일유형 대비"
            value={
              peerGroupAvg > 0
                ? `${
                    peerGap > 0
                      ? "+"
                      : ""
                  }${peerGap.toFixed(
                    1
                  )}점`
                : "-"
            }
            valueClassName={
              peerGap < 0
                ? "text-[#B94A48]"
                : "text-[#2E7D5B]"
            }
          />

          <KpiCard
            label="병원 기준"
            subLabel="해당 조사영역"
            value={
              officialHospitalAvg >
              0
                ? `${officialHospitalAvg.toFixed(
                    1
                  )}점`
                : "-"
            }
          />

          <KpiCard
            label="병원 기준 대비"
            value={
              officialHospitalAvg >
              0
                ? `${
                    hospitalGap > 0
                      ? "+"
                      : ""
                  }${hospitalGap.toFixed(
                    1
                  )}점`
                : "-"
            }
            valueClassName={
              hospitalGap < 0
                ? "text-[#B94A48]"
                : "text-[#2E7D5B]"
            }
          />

        </div>

      </div>


      {/* ======================================================
          TAB
      ====================================================== */}

      <div className="flex overflow-x-auto rounded-t-xl border-b border-[#E2E8F0] bg-white px-5 shadow-2xs">

        <TabButton
          active={
            activeTab === "SCORE"
          }
          onClick={() =>
            setActiveTab("SCORE")
          }
        >
          평가영역 · 세부문항
        </TabButton>

        <TabButton
          active={
            activeTab === "VOC"
          }
          onClick={() =>
            setActiveTab("VOC")
          }
        >
          <MessageSquare className="h-3.5 w-3.5" />
          환자 VOC

          <span className="rounded-md bg-[#ECF2F7] px-1.5 py-0.5 text-[10px] font-bold text-[#243B53]">
            {relatedVoc.length}
          </span>
        </TabButton>

        <TabButton
          active={
            activeTab ===
            "ROOT_CAUSE"
          }
          onClick={() =>
            setActiveTab(
              "ROOT_CAUSE"
            )
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI 원인 매칭
        </TabButton>

      </div>


      {/* ======================================================
          SCORE TAB
      ====================================================== */}

      {activeTab === "SCORE" && (
        <div className="space-y-4 rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div>
            <h3 className="text-sm font-bold text-[#1E293B]">
              평가영역 및 세부문항 분석
            </h3>

            <p className="mt-1 text-xs text-[#64748B]">
              Excel의 영역평균과 세부문항을 그대로 구분하여,
              해당 조사영역의 병원 기준 및 동일유형 결과와 비교합니다.
            </p>
          </div>


          {department.domains.length ===
          0 ? (
            <EmptyPanel
              title="평가영역 데이터가 없습니다."
              description="현재 선택한 분석 대상에서 영역별 점수를 확인할 수 없습니다."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">

              <table className="min-w-[900px] w-full text-left text-xs">

                <thead className="border-b border-[#EEF1F4] bg-[#F8F9FA] font-semibold text-[#64748B]">
                  <tr>
                    <th className="px-3.5 py-3">
                      평가영역 / 세부문항
                    </th>

                    <th className="px-3 py-3 text-right">
                      현재점수
                    </th>

                    <th className="px-3 py-3 text-right">
                      병원기준
                    </th>

                    <th className="px-3 py-3 text-right">
                      동일유형 평균
                    </th>

                    <th className="px-3 py-3 text-right">
                      동일유형 최고
                    </th>

                    <th className="px-3 py-3 text-center">
                      순위
                    </th>

                    <th className="px-3 py-3 text-center">
                      상태
                    </th>
                  </tr>
                </thead>


                <tbody className="divide-y divide-[#F1F5F9]">

                  {department.domains.map(
                    (domain) => {
                      const isExpanded =
                        expandedDomainId ===
                        domain.domainId;

                      return (
                        <React.Fragment
                          key={
                            domain.domainId
                          }
                        >

                          <tr
                            onClick={() =>
                              toggleDomain(
                                domain.domainId
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? "bg-[#ECF2F7]/50"
                                : "hover:bg-[#F8F9FA]"
                            }`}
                          >

                            <td className="px-3.5 py-3">

                              <div className="flex items-center gap-2">

                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-[#243B53]" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
                                )}

                                <span className="font-bold text-[#1E293B]">
                                  {
                                    domain.domainName
                                  }
                                </span>

                                {domain.questions
                                  ?.length >
                                  0 && (
                                  <span className="text-[10px] font-normal text-[#94A3B8]">
                                    {
                                      domain.questions
                                        .length
                                    }
                                    개 문항
                                  </span>
                                )}

                              </div>

                            </td>


                            <td className="px-3 py-3 text-right font-bold text-[#1E293B]">
                              {formatScore(
                                domain.currentScore
                              )}
                            </td>

                            <td className="px-3 py-3 text-right text-[#64748B]">
                              {formatScore(
                                domain.hospitalAvg
                              )}
                            </td>

                            <td className="px-3 py-3 text-right text-[#64748B]">
                              {formatScore(
                                domain.peerGroupAvg
                              )}
                            </td>

                            <td className="px-3 py-3 text-right font-semibold text-[#243B53]">
                              {formatScore(
                                domain.topPerformerScore
                              )}
                            </td>

                            <td className="px-3 py-3 text-center text-[#64748B]">
                              -
                            </td>

                            <td className="px-3 py-3 text-center">
                              <StatusBadge
                                status={
                                  domain.status
                                }
                                size="sm"
                              />
                            </td>

                          </tr>


                          {isExpanded &&
                            domain.questions?.map(
                              (
                                question
                              ) => (
                                <tr
                                  key={
                                    question.questionId
                                  }
                                  className="border-t border-[#EEF1F4] bg-[#F8F9FA] text-[11px]"
                                >

                                  <td className="px-3.5 py-2.5 pl-10 text-[#475569]">

                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[#94A3B8]">
                                        ↳
                                      </span>

                                      <span>
                                        {
                                          question.questionText
                                        }
                                      </span>
                                    </div>

                                  </td>


                                  <td className="px-3 py-2.5 text-right font-bold text-[#1E293B]">
                                    {formatScore(
                                      question.currentScore
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 text-right text-[#64748B]">
                                    {formatScore(
                                      question.hospitalAvg
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 text-right text-[#64748B]">
                                    {formatScore(
                                      question.peerGroupAvg
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 text-right text-[#64748B]">
                                    {formatScore(
                                      question.topPerformerScore
                                    )}
                                  </td>

                                  <td className="px-3 py-2.5 text-center font-semibold text-[#64748B]">
                                    {question.totalDepartments >
                                    0
                                      ? `${question.rank}위 / ${question.totalDepartments}`
                                      : "-"}
                                  </td>

                                  <td className="px-3 py-2.5 text-center">
                                    <StatusBadge
                                      status={
                                        question.status
                                      }
                                      size="sm"
                                    />
                                  </td>

                                </tr>
                              )
                            )}

                        </React.Fragment>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}


          {!hasPreviousData && (
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-2 text-[11px] text-[#64748B]">
              현재 업로드된 설문결과에는 비교 가능한 전기 평가자료가 없어
              전기 대비 증감은 분석에 포함하지 않았습니다.
            </div>
          )}

        </div>
      )}


      {/* ======================================================
          VOC TAB
      ====================================================== */}

      {activeTab === "VOC" && (
        <div className="space-y-5 rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 border-b border-[#EEF1F4] pb-4 sm:flex-row sm:items-center">

            <div>
              <h3 className="text-sm font-bold text-[#1E293B]">
                {department.name} 관련 환자 VOC
              </h3>

              <p className="mt-1 text-xs text-[#64748B]">
                센터·진료과·의사·병동·검사실 정보를 기준으로
                현재 분석대상과 직접 연결된 VOC만 표시합니다.
              </p>
            </div>


            <div className="flex flex-wrap items-center gap-2">

              <VocCountBadge
                label="긍정"
                count={
                  positiveVocCount
                }
                type="POSITIVE"
              />

              <VocCountBadge
                label="부정"
                count={
                  negativeVocCount
                }
                type="NEGATIVE"
              />

              <VocCountBadge
                label="중립"
                count={
                  neutralVocCount
                }
                type="NEUTRAL"
              />

            </div>

          </div>


          {relatedVoc.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

              <MiniStat
                label="관련 VOC"
                value={`${relatedVoc.length}건`}
              />

              <MiniStat
                label="부정 비율"
                value={`${negativeRatio}%`}
              />

              <MiniStat
                label="긍정 VOC"
                value={`${positiveVocCount}건`}
              />

              <MiniStat
                label="부정 VOC"
                value={`${negativeVocCount}건`}
              />

            </div>
          )}


          {relatedVoc.length ===
          0 ? (
            <EmptyPanel
              title="직접 연결된 VOC가 없습니다."
              description={`${department.name}에 매칭되는 센터·진료과·병동·의사·검사실 VOC가 현재 설문자료에서 확인되지 않았습니다. 다른 부서의 VOC는 대신 표시하지 않습니다.`}
            />
          ) : (
            <div className="space-y-2">

              {relatedVoc.map(
                (item) => (
                  <React.Fragment
                    key={item.id}
                  >
                    <VocCard
                      item={item}
                    />
                  </React.Fragment>
                )
              )}

            </div>
          )}

        </div>
      )}


      {/* ======================================================
          ROOT CAUSE TAB
      ====================================================== */}

      {activeTab ===
        "ROOT_CAUSE" && (
        <div className="space-y-5 rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="border-b border-[#EEF1F4] pb-4">

            <div className="flex items-center gap-2 text-sm font-bold text-[#243B53]">
              <Sparkles className="h-4 w-4 text-[#5F8079]" />
              <span>
                정량 평가 - VOC AI 원인 매칭
              </span>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
              실제 세부문항 점수와 해당 분석대상에 직접 연결된 환자 VOC를
              함께 분석한 Gemini 결과만 표시합니다.
            </p>

          </div>


          {isAiAnalyzing ? (
            <div className="rounded-xl border border-[#D9E1EA] bg-[#F8FAFC] p-8 text-center">

              <Sparkles className="mx-auto h-8 w-8 animate-pulse text-[#5F8079]" />

              <p className="mt-3 text-sm font-bold text-[#1E293B]">
                AI가 정량점수와 VOC를 교차 분석하고 있습니다.
              </p>

              <p className="mt-1 text-xs text-[#64748B]">
                분석이 완료되면 실제 Root Cause 결과가 표시됩니다.
              </p>

            </div>
          ) : rootCauseMatches.length ===
            0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-8 text-center">

              <AlertCircle className="mx-auto h-8 w-8 text-[#94A3B8]" />

              <h4 className="mt-3 text-sm font-bold text-[#1E293B]">
                아직 AI Root Cause 분석 결과가 없습니다.
              </h4>

              <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[#64748B]">
                가상의 예시 결과는 표시하지 않습니다.
                Feedback Sheet 생성을 실행하면 실제 점수와 관련 VOC를
                Gemini가 분석하여 결과를 생성합니다.
              </p>

              <button
                type="button"
                onClick={() =>
                  onGenerateFeedbackSheet(
                    department
                  )
                }
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44]"
              >
                <Sparkles className="h-4 w-4" />
                실제 AI 분석 실행
              </button>

            </div>
          ) : (
            <div className="space-y-4">

              {rootCauseMatches.map(
                (
                  match,
                  index
                ) => {

                  const rootCauseKey =
                    `${match.domainName}-${match.questionText}-${index}`;


                  return (
                    <React.Fragment
                      key={
                        rootCauseKey
                      }
                    >
                      <RootCauseCard
                        match={match}
                      />
                    </React.Fragment>
                  );
                }
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
};


/**
 * ============================================================
 * Sub Components
 * ============================================================
 */

function KpiCard({
  label,
  subLabel,
  value,
  emphasis = false,
  valueClassName = "",
}: {
  label: string;
  subLabel?: string;
  value: string;
  emphasis?: boolean;
  valueClassName?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        emphasis
          ? "border-[#D9E1EA] bg-[#ECF2F7]"
          : "border-[#EEF1F4] bg-[#F8F9FA]"
      }`}
    >
      <div
        className={`text-[11px] font-semibold ${
          emphasis
            ? "text-[#243B53]"
            : "text-[#64748B]"
        }`}
      >
        {label}
      </div>

      {subLabel && (
        <div className="mt-0.5 truncate text-[10px] text-[#94A3B8]">
          {subLabel}
        </div>
      )}

      <div
        className={`mt-1.5 text-base font-bold ${
          valueClassName ||
          (emphasis
            ? "text-[#243B53]"
            : "text-[#1E293B]")
        }`}
      >
        {value}
      </div>
    </div>
  );
}


function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] px-3 py-2.5">
      <div className="text-[10px] font-semibold text-[#94A3B8]">
        {label}
      </div>

      <div className="mt-0.5 text-sm font-bold text-[#1E293B]">
        {value}
      </div>
    </div>
  );
}


function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-bold transition-all ${
        active
          ? "border-[#243B53] text-[#243B53]"
          : "border-transparent text-[#64748B] hover:text-[#1E293B]"
      }`}
    >
      {children}
    </button>
  );
}


function VocCountBadge({
  label,
  count,
  type,
}: {
  label: string;
  count: number;
  type:
    | "POSITIVE"
    | "NEGATIVE"
    | "NEUTRAL";
}) {
  const style =
    type === "POSITIVE"
      ? "border-[#C7E6D7] bg-[#EBF5F0] text-[#2E7D5B]"
      : type === "NEGATIVE"
      ? "border-[#F6D3D3] bg-[#FDF2F2] text-[#B94A48]"
      : "border-[#E2E8F0] bg-[#F8F9FA] text-[#64748B]";

  return (
    <span
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${style}`}
    >
      {label} {count}
    </span>
  );
}


function VocCard({
  item,
}: {
  item: RawVocItem;
}) {
  const negative =
    item.sentiment ===
    "NEGATIVE";

  const positive =
    item.sentiment ===
    "POSITIVE";

  const borderStyle =
    negative
      ? "border-[#F6D3D3]"
      : positive
      ? "border-[#C7E6D7]"
      : "border-[#E2E8F0]";

  const backgroundStyle =
    negative
      ? "bg-[#FDF2F2]/30"
      : positive
      ? "bg-[#EBF5F0]/30"
      : "bg-white";

  const metadata = [
    item.division
      ? {
          label: "부문",
          value:
            item.division,
        }
      : null,

    item.center
      ? {
          label: "센터",
          value:
            item.center,
        }
      : null,

    item.department
      ? {
          label: "진료과",
          value:
            item.department,
        }
      : null,

    item.doctor
      ? {
          label: "의사",
          value:
            item.doctor,
        }
      : null,

    item.ward
      ? {
          label: "병동",
          value:
            item.ward,
        }
      : null,

    item.examRoom
      ? {
          label: "검사실",
          value:
            item.examRoom,
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
  }[];


  return (
    <div
      className={`rounded-xl border p-4 ${borderStyle} ${backgroundStyle}`}
    >

      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">

        <div className="flex flex-wrap items-center gap-2">

          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#475569]">
            {item.category ||
              "기타"}
          </span>

          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
              negative
                ? "bg-[#FDF2F2] text-[#B94A48]"
                : positive
                ? "bg-[#EBF5F0] text-[#2E7D5B]"
                : "bg-[#F1F5F9] text-[#64748B]"
            }`}
          >
            {negative
              ? "부정"
              : positive
              ? "긍정"
              : "중립"}
          </span>

          {item.recommendationScore !==
            undefined && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#64748B]">
              <ThumbsUp className="h-3 w-3" />
              추천의향{" "}
              {
                item.recommendationScore
              }
            </span>
          )}

        </div>


        <span className="text-[10px] font-medium text-[#94A3B8]">
          {item.responseDate ||
            item.date ||
            "응답일 미확인"}
        </span>

      </div>


      {metadata.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-y border-[#EEF1F4] py-2">

          {metadata.map(
            (meta) => (
              <span
                key={`${meta.label}-${meta.value}`}
                className="text-[10px] text-[#64748B]"
              >
                <strong className="font-semibold text-[#475569]">
                  {meta.label}
                </strong>{" "}
                {meta.value}
              </span>
            )
          )}

        </div>
      )}


      <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-[#334155]">
        {item.content}
      </p>

    </div>
  );
}


function RootCauseCard({
  match,
}: {
  match: RootCauseMatch;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

      <div className="flex flex-col justify-between gap-2 border-b border-[#EEF1F4] pb-3 sm:flex-row sm:items-center">

        <div>

          <span className="mr-2 rounded-md bg-[#ECF2F7] px-2 py-0.5 text-[10px] font-bold text-[#243B53]">
            {match.domainName}
          </span>

          <span className="text-xs font-bold text-[#1E293B]">
            {match.questionText}
          </span>

        </div>


        <div className="flex flex-wrap items-center gap-3 text-[11px]">

          <span className="font-bold text-[#1E293B]">
            {match.currentScore.toFixed(
              1
            )}
            점
          </span>

          {Number.isFinite(
            match.peerGroupGap
          ) && (
            <span
              className={
                (match.peerGroupGap ??
                  0) < 0
                  ? "font-semibold text-[#B94A48]"
                  : "font-semibold text-[#2E7D5B]"
              }
            >
              동일유형 대비{" "}
              {(match.peerGroupGap ??
                0) >
              0
                ? "+"
                : ""}
              {(
                match.peerGroupGap ??
                0
              ).toFixed(1)}
              점
            </span>
          )}

        </div>

      </div>


      {match.relatedVocSnippets
        ?.length > 0 && (
        <div className="rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] p-3">

          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[#475569]">
            <MessageSquare className="h-3.5 w-3.5" />
            실제 관련 VOC 근거
          </div>

          <div className="space-y-1.5">

            {match.relatedVocSnippets.map(
              (
                quote,
                index
              ) => (
                <p
                  key={index}
                  className="text-[11px] leading-relaxed text-[#64748B]"
                >
                  • {quote}
                </p>
              )
            )}

          </div>

        </div>
      )}


      <div className="rounded-lg border border-[#D9E1EA] bg-[#ECF2F7]/50 p-3">

        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#243B53]">
          <Lightbulb className="h-3.5 w-3.5 text-[#5F8079]" />
          AI 추정 원인
        </div>

        <p className="text-xs leading-relaxed text-[#334155]">
          {
            match.estimatedRootCause
          }
        </p>

        {match.recommendationFocus && (
          <div className="mt-2 border-t border-[#D9E1EA] pt-2 text-[11px] font-semibold text-[#243B53]">
            개선 검토 방향:{" "}
            {
              match.recommendationFocus
            }
          </div>
        )}

      </div>

    </div>
  );
}


function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8F9FA] p-8 text-center">

      <MessageSquare className="mx-auto h-8 w-8 text-[#94A3B8]" />

      <h4 className="mt-3 text-sm font-bold text-[#1E293B]">
        {title}
      </h4>

      <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-[#64748B]">
        {description}
      </p>

    </div>
  );
}


function formatScore(
  value?: number | null
): string {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "-";
  }

  return `${value.toFixed(1)}점`;
}