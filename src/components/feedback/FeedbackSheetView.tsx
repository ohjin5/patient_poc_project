import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CXFeedbackSheetData,
  ActionPlanItem,
  VocIssueSummary,
} from "../../types";

import {
  StatusBadge,
  PriorityBadge,
  Modal,
} from "../common/StatusBadge";

import {
  WordExportService,
} from "../../services/wordExportService";

import {
  ExcelService,
} from "../../services/excelService";

import {
  feedbackHistoryService,
} from "../../services/feedbackHistoryService";

import {
  FileText,
  Printer,
  Copy,
  CheckCircle2,
  Edit3,
  Lock,
  Check,
  X,
  FileSpreadsheet,
  MoreVertical,
  Award,
  Loader2,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Quote,
  FolderOpen,
  Save,
  ArrowLeft,
} from "lucide-react";


interface FeedbackSheetViewProps {
  sheetData:
    | CXFeedbackSheetData
    | null;

  onUpdateSheetData?: (
    updated:
      CXFeedbackSheetData
  ) => void;

  onSelectAnotherDept?: () => void;

  /**
   * 일괄 생성 결과 목록에서 이 Feedback Sheet를 연 경우,
   * 이전 일괄 생성 결과 화면으로 돌아가기 위한 콜백입니다.
   */
  onBackToBatchResults?: () => void;
}


export const FeedbackSheetView:
  React.FC<
    FeedbackSheetViewProps
  > = ({
    sheetData,
    onUpdateSheetData,
    onSelectAnotherDept,
    onBackToBatchResults,
  }) => {

    const printAreaRef =
      useRef<HTMLDivElement>(
        null
      );


    /**
     * ========================================================
     * Local State
     * ========================================================
     */

    const [
      currentSheet,
      setCurrentSheet,
    ] =
      useState<
        CXFeedbackSheetData | null
      >(sheetData);


    const [
      isEditMode,
      setIsEditMode,
    ] =
      useState<boolean>(
        false
      );


    const [
      editingDiagnosis,
      setEditingDiagnosis,
    ] =
      useState<boolean>(
        false
      );


    const [
      copied,
      setCopied,
    ] =
      useState<boolean>(
        false
      );


    const [
      isExportingWord,
      setIsExportingWord,
    ] =
      useState<boolean>(
        false
      );


    const [
      showMoreMenu,
      setShowMoreMenu,
    ] =
      useState<boolean>(
        false
      );


    /**
     * ========================================================
     * Feedback History
     * ========================================================
     */
    const [
      historyGuideOpen,
      setHistoryGuideOpen,
    ] =
      useState<boolean>(
        false
      );


    const [
      isSavingHistory,
      setIsSavingHistory,
    ] =
      useState<boolean>(
        false
      );


    const [
      historyMessage,
      setHistoryMessage,
    ] =
      useState<
        string | null
      >(null);


    const [
      editDiagnosis,
      setEditDiagnosis,
    ] =
      useState({
        coreProblem:
          sheetData?.aiDiagnosis
            ?.coreProblem || "",

        executiveSummary:
          sheetData?.aiDiagnosis
            ?.executiveSummary ||
          "",

        detailedDiagnosis:
          sheetData?.aiDiagnosis
            ?.detailedDiagnosis ||
          "",

        evidence:
          sheetData?.aiDiagnosis
            ?.evidence
            ? [
                ...sheetData
                  .aiDiagnosis
                  .evidence,
              ]
            : [],
      });


    /**
     * ========================================================
     * Sync
     * ========================================================
     */

    useEffect(() => {

      setCurrentSheet(
        sheetData
      );


      if (sheetData) {

        setEditDiagnosis({
          coreProblem:
            sheetData
              .aiDiagnosis
              .coreProblem,

          executiveSummary:
            sheetData
              .aiDiagnosis
              .executiveSummary,

          detailedDiagnosis:
            sheetData
              .aiDiagnosis
              .detailedDiagnosis,

          evidence: [
            ...sheetData
              .aiDiagnosis
              .evidence,
          ],
        });
      }

    }, [sheetData]);


    /**
     * ========================================================
     * Empty State
     * ========================================================
     */

    if (!currentSheet) {

      return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-12 text-center shadow-2xs">

          <FileText className="mx-auto mb-3 h-12 w-12 text-[#94A3B8]" />

          <h3 className="text-base font-bold text-[#1E293B]">
            생성된 Feedback Sheet가 없습니다
          </h3>

          <p className="mt-1 text-xs text-[#64748B]">
            분석 대상을 선택한 후 Feedback Sheet 생성을 실행해주세요.
          </p>

          {onSelectAnotherDept && (
            <button
              type="button"
              onClick={
                onSelectAnotherDept
              }
              className="mt-5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44]"
            >
              분석대상 선택
            </button>
          )}

        </div>
      );
    }


    /**
     * ========================================================
     * Derived Data
     * ========================================================
     */

    const sheetAny =
      currentSheet as any;


    const hasPreviousData =
      Boolean(
        sheetAny.previousPeriod &&
        sheetAny.previousSampleSize >
          0
      );


    const reportDepartment =
      currentSheet
        .reportAuthorDepartment ||
      "고객행복팀";


    const peerGroupAvg =
      currentSheet.peerGroupAvg ??
      0;


    const hospitalGap =
      Number(
        (
          currentSheet.overallScore -
          currentSheet.hospitalAvg
        ).toFixed(1)
      );


    const peerGap =
      peerGroupAvg > 0
        ? Number(
            (
              currentSheet
                .overallScore -
              peerGroupAvg
            ).toFixed(1)
          )
        : null;


    const relatedVocItems:
      any[] =
      Array.isArray(
        currentSheet.relatedVocItems
      )
        ? currentSheet
            .relatedVocItems
        : [];


    const benchmark =
      currentSheet
        .benchmarkBestPractice;


    const actionPlans =
      (
        currentSheet.actionPlans ||
        []
      ).slice(0, 3);


    /**
     * ========================================================
     * Save Helpers
     * ========================================================
     */

    const saveSheet = (
      updated:
        CXFeedbackSheetData
    ) => {

      setCurrentSheet(
        updated
      );

      onUpdateSheetData?.(
        updated
      );
    };


    /**
     * ========================================================
     * Export
     * ========================================================
     */

    const handleExportWord =
      async () => {

        setIsExportingWord(
          true
        );


        try {

          await WordExportService
            .exportFeedbackSheetToDocx(
              currentSheet
            );

        } catch (error) {

          console.error(
            "Word export error:",
            error instanceof Error
              ? error.message
              : error
          );

          alert(
            "Word 문서 생성 중 오류가 발생했습니다."
          );

        } finally {

          setIsExportingWord(
            false
          );
        }
      };


    const handlePrint =
      () => {

        window.print();
      };


    const handleExportExcel =
      () => {

        ExcelService
          .exportFeedbackSheetToExcel(
            currentSheet
          );

        setShowMoreMenu(
          false
        );
      };


    /**
     * ========================================================
     * Feedback History Save
     * ========================================================
     */

    const saveCurrentSheetToHistory =
      async () => {

        if (
          !currentSheet
        ) {
          return;
        }


        setIsSavingHistory(
          true
        );

        setHistoryMessage(
          null
        );


        try {

          await feedbackHistoryService
            .saveFeedbackHistory({
              sheetData:
                currentSheet,

              historyStatus:
                "DRAFT",
            });


          setHistoryMessage(
            "피드백 이력에 저장되었습니다."
          );


          window.setTimeout(
            () =>
              setHistoryMessage(
                null
              ),
            3000
          );

        } catch (
          error
        ) {

          console.error(
            "[FeedbackHistory] 저장 실패:",
            error instanceof Error
              ? error.message
              : error
          );


          const message =
            error instanceof Error
              ? error.message
              : "";


          if (
            message ===
            "HISTORY_FOLDER_NOT_CONNECTED"
          ) {

            setHistoryGuideOpen(
              true
            );

          } else if (
            message ===
            "HISTORY_FOLDER_PERMISSION_DENIED"
          ) {

            alert(
              "이력 폴더에 대한 읽기/쓰기 권한이 필요합니다."
            );

          } else {

            alert(
              "피드백 이력을 저장하는 중 오류가 발생했습니다."
            );
          }

        } finally {

          setIsSavingHistory(
            false
          );
        }
      };


    const handleConnectHistoryFolder =
      async () => {

        if (
          !feedbackHistoryService
            .isSupported()
        ) {

          alert(
            "현재 브라우저에서는 로컬 폴더 연결 기능을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 사용해주세요."
          );

          return;
        }


        setIsSavingHistory(
          true
        );


        try {

          const folderName =
            await feedbackHistoryService
              .connectHistoryFolder();


          setHistoryGuideOpen(
            false
          );


          await feedbackHistoryService
            .saveFeedbackHistory({
              sheetData:
                currentSheet,

              historyStatus:
                "DRAFT",
            });


          setHistoryMessage(
            `${folderName} 폴더에 피드백 이력이 저장되었습니다.`
          );


          window.setTimeout(
            () =>
              setHistoryMessage(
                null
              ),
            3500
          );

        } catch (
          error
        ) {

          console.error(
            "[FeedbackHistory] 폴더 연결 또는 저장 실패:",
            error instanceof Error
              ? error.message
              : error
          );


          const errorName =
            error instanceof DOMException
              ? error.name
              : "";


          if (
            errorName ===
            "AbortError"
          ) {
            return;
          }


          alert(
            "이력 폴더를 연결하거나 저장하는 중 오류가 발생했습니다."
          );

        } finally {

          setIsSavingHistory(
            false
          );
        }
      };


    /**
     * ========================================================
     * Copy Summary
     * ========================================================
     */

    const handleCopySummaryText =
      async () => {

        const actionText =
          actionPlans
            .map(
              (
                action,
                index
              ) => (
`[개선과제 ${index + 1}] ${action.title}
- 실행방법: ${action.method}
- 적용대상: ${action.target}
- 적용일정: ${action.schedule}
- 기대효과: ${action.expectedEffect}
- KPI: ${action.kpi}`
              )
            )
            .join(
              "\n\n"
            );


        const text =
`[환자경험평가(CX) Feedback Sheet]

분석대상: ${currentSheet.departmentName}
평가기간: ${currentSheet.period}
작성부서: ${reportDepartment}

종합점수: ${currentSheet.overallScore.toFixed(1)}점
은평성모병원 기준: ${currentSheet.hospitalAvg.toFixed(1)}점
동일유형 평균: ${
  peerGroupAvg > 0
    ? `${peerGroupAvg.toFixed(1)}점`
    : "-"
}
동일유형 순위: ${currentSheet.rank}위 / ${currentSheet.totalRanked}개

[AI 종합 진단]
${currentSheet.aiDiagnosis.coreProblem}

${currentSheet.aiDiagnosis.executiveSummary}

[주요 근거]
${currentSheet.aiDiagnosis.evidence
  .map(
    (item) =>
      `- ${item}`
  )
  .join("\n")}

[부서 맞춤형 개선 Action Plan]
${actionText}`;


        try {

          await navigator
            .clipboard
            .writeText(
              text
            );

          setCopied(
            true
          );

          window.setTimeout(
            () =>
              setCopied(
                false
              ),
            2000
          );

        } catch {

          alert(
            "클립보드 복사에 실패했습니다."
          );
        }
      };


    /**
     * ========================================================
     * Diagnosis Editing
     * ========================================================
     */

    const handleSaveDiagnosis =
      () => {

        const updated:
          CXFeedbackSheetData = {

          ...currentSheet,

          aiDiagnosis: {

            ...currentSheet
              .aiDiagnosis,

            coreProblem:
              editDiagnosis
                .coreProblem,

            executiveSummary:
              editDiagnosis
                .executiveSummary,

            detailedDiagnosis:
              editDiagnosis
                .detailedDiagnosis,

            evidence:
              editDiagnosis
                .evidence,
          },
        };


        saveSheet(
          updated
        );

        setEditingDiagnosis(
          false
        );
      };


    const handleCancelDiagnosis =
      () => {

        setEditDiagnosis({
          coreProblem:
            currentSheet
              .aiDiagnosis
              .coreProblem,

          executiveSummary:
            currentSheet
              .aiDiagnosis
              .executiveSummary,

          detailedDiagnosis:
            currentSheet
              .aiDiagnosis
              .detailedDiagnosis,

          evidence: [
            ...currentSheet
              .aiDiagnosis
              .evidence,
          ],
        });


        setEditingDiagnosis(
          false
        );
      };


    /**
     * ========================================================
     * Action Plan Editing
     * ========================================================
     */

    const updateActionPlan =
      (
        index: number,
        field:
          keyof ActionPlanItem,
        value: unknown
      ) => {

        const plans = [
          ...currentSheet
            .actionPlans,
        ];


        plans[index] = {
          ...plans[index],
          [field]: value,
        };


        saveSheet({
          ...currentSheet,
          actionPlans:
            plans,
        });
      };


    /**
     * ========================================================
     * VOC Issue Editing
     * ========================================================
     */

    const updateVocIssue =
      (
        index: number,
        field:
          keyof VocIssueSummary,
        value: unknown
      ) => {

        const issues = [
          ...currentSheet
            .topVocIssues,
        ];


        issues[index] = {
          ...issues[index],
          [field]: value,
        };


        saveSheet({
          ...currentSheet,
          topVocIssues:
            issues,
        });
      };


    /**
     * ========================================================
     * Render
     * ========================================================
     */

    return (
      <div className="space-y-4">

        {onBackToBatchResults && (

          <div className="no-print">

            <button
              type="button"
              onClick={
                onBackToBatchResults
              }
              className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-semibold text-[#64748B] transition-colors hover:text-[#243B53]"
            >

              <ArrowLeft className="h-3.5 w-3.5" />

              일괄 생성 결과

            </button>

          </div>
        )}


        {/* ==================================================
            TOOLBAR
        =================================================== */}

        <div className="no-print rounded-xl border border-[#D9E1EA] bg-white p-4 shadow-2xs sm:p-5">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="min-w-0">

              <div className="flex items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1F3A5F] text-sm font-bold text-white">
                  CX
                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">

                    <span className="shrink-0 rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                      Feedback Sheet
                    </span>

                    <span className="min-w-0 text-[11px] font-medium leading-relaxed text-[#64748B] sm:text-xs">
                      내용을 검토·수정한 후 Word 또는 PDF로 활용할 수 있습니다.
                    </span>

                  </div>

                  <h2 className="mt-1 text-base font-bold leading-tight text-[#1E293B]">
                    {currentSheet.departmentName}
                  </h2>

                </div>

              </div>

            </div>


            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:justify-end">

              <button
                type="button"
                onClick={() =>
                  setIsEditMode(
                    !isEditMode
                  )
                }
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold sm:w-auto ${
                  isEditMode
                    ? "border-[#243B53] bg-[#ECF2F7] text-[#243B53]"
                    : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8F9FA]"
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />

                {isEditMode
                  ? "편집 종료"
                  : "내용 수정"}
              </button>


              <button
                type="button"
                onClick={
                  handleCopySummaryText
                }
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] sm:w-auto"
              >
                {copied
                  ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7D5B]" />
                  )
                  : (
                    <Copy className="h-3.5 w-3.5 text-[#64748B]" />
                  )}

                {copied
                  ? "복사 완료"
                  : "요약 복사"}
              </button>


              <button
                type="button"
                onClick={
                  handlePrint
                }
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] sm:w-auto"
              >
                <Printer className="h-3.5 w-3.5" />
                PDF / 인쇄
              </button>


              <button
                type="button"
                onClick={
                  handleExportWord
                }
                disabled={
                  isExportingWord
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:opacity-50 sm:w-auto"
              >
                {isExportingWord
                  ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )
                  : (
                    <FileText className="h-4 w-4" />
                  )}

                Word 다운로드
              </button>


              <button
                type="button"
                onClick={
                  saveCurrentSheetToHistory
                }
                disabled={
                  isSavingHistory
                }
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#B8C7D8] bg-[#ECF2F7] px-3.5 py-2 text-xs font-bold text-[#243B53] transition-colors hover:bg-[#DCE7F0] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >

                {isSavingHistory
                  ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )
                  : (
                      <Save className="h-3.5 w-3.5" />
                    )}

                피드백 이력에 저장

              </button>


              <div className="relative w-full sm:w-auto">

                <button
                  type="button"
                  onClick={() =>
                    setShowMoreMenu(
                      !showMoreMenu
                    )
                  }
                  className="flex h-full w-full items-center justify-center rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#64748B] hover:bg-[#F8F9FA] sm:h-auto sm:w-auto"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>


                {showMoreMenu && (
                  <div className="absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-[#E2E8F0] bg-white p-1.5 text-xs shadow-lg">

                    <button
                      type="button"
                      onClick={
                        handleExportExcel
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-medium text-[#334155] hover:bg-[#F8F9FA]"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-[#2E7D5B]" />

                      분석 데이터 Excel 다운로드
                    </button>

                  </div>
                )}

              </div>

            </div>

          </div>

        </div>


        {historyMessage && (

          <div className="no-print flex items-center gap-2 rounded-xl border border-[#C7E6D7] bg-[#EBF5F0] px-4 py-3 text-xs font-semibold text-[#2E7D5B]">

            <CheckCircle2 className="h-4 w-4 shrink-0" />

            <span>
              {historyMessage}
            </span>

          </div>
        )}


        {/* ==================================================
            EDIT NOTICE
        =================================================== */}

        {isEditMode && (
          <div className="no-print flex items-center justify-between rounded-xl border border-[#D9E1EA] bg-[#ECF2F7] p-3.5 text-xs text-[#243B53]">

            <div className="flex items-center gap-2">

              <Edit3 className="h-4 w-4" />

              <span>
                <strong>
                  편집 모드입니다.
                </strong>{" "}
                AI 소견·VOC 요약·Action Plan 텍스트만 수정할 수 있으며 정량값은 변경할 수 없습니다.
              </span>

            </div>

          </div>
        )}


        {/* ==================================================
            REPORT
        =================================================== */}

        <div
          ref={
            printAreaRef
          }
          id="printable-feedback-sheet"
          className="mx-auto max-w-5xl rounded-xl border border-[#E2E8F0] bg-white p-8 text-[#334155] shadow-2xs print:max-w-full print:border-none print:p-0 print:shadow-none md:p-10"
        >

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="border-b-2 border-[#243B53] pb-5">

            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-[#64748B]">

              <span className="font-bold text-[#243B53]">
                가톨릭대학교 은평성모병원 · {reportDepartment}
              </span>

              <span>
                분석유형: {currentSheet.peerGroupLabel || currentSheet.departmentType}
              </span>

            </div>


            <div className="flex items-end justify-between gap-4">

              <div>

                <h1 className="text-2xl font-black tracking-tight text-[#1E293B]">
                  환자경험평가(CX) Feedback Sheet
                </h1>

                <p className="mt-1 text-xs font-medium text-[#64748B]">
                  평가기간:{" "}
                  <span className="font-bold text-[#1E293B]">
                    {currentSheet.period || "현재 업로드 자료"}
                  </span>
                  {" "}· 작성부서:{" "}
                  <span className="font-bold text-[#1E293B]">
                    {reportDepartment}
                  </span>
                </p>

              </div>


              <div className="text-right">

                <div className="text-2xl font-extrabold text-[#243B53]">
                  {currentSheet.departmentName}
                </div>

                <div className="mt-1 flex items-center justify-end gap-1.5">

                  <PriorityBadge
                    priority={
                      currentSheet.priority
                    }
                    size="sm"
                  />

                  <StatusBadge
                    status={
                      currentSheet.status
                    }
                    size="sm"
                  />

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              KPI
          ================================================== */}

          <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4 text-center text-xs md:grid-cols-5">

            <MetricBox
              label="종합점수"
              value={`${currentSheet.overallScore.toFixed(1)}점`}
              sub={`사례수 ${currentSheet.sampleSize.toLocaleString()}건`}
            />

            <MetricBox
              label="은평성모병원 기준"
              value={`${currentSheet.hospitalAvg.toFixed(1)}점`}
              sub={`격차 ${formatSigned(hospitalGap)}점`}
            />

            <MetricBox
              label="동일유형 평균"
              value={
                peerGroupAvg > 0
                  ? `${peerGroupAvg.toFixed(1)}점`
                  : "-"
              }
              sub={
                peerGap !== null
                  ? `격차 ${formatSigned(peerGap)}점`
                  : "비교정보 없음"
              }
            />

            <MetricBox
              label="동일유형 순위"
              value={`${currentSheet.rank}위`}
              sub={`/ ${currentSheet.totalRanked}개`}
              emphasis
            />

            <MetricBox
              label="전기 대비"
              value={
                hasPreviousData
                  ? formatSigned(
                      currentSheet.scoreChange
                    ) + "점"
                  : "-"
              }
              sub={
                hasPreviousData
                  ? `전기 ${currentSheet.previousScore.toFixed(1)}점`
                  : "비교 데이터 없음"
              }
            />

          </div>


          {/* =================================================
              SECTION 1
          ================================================== */}

          <ReportSection
            number="1"
            title="평가영역 및 세부문항 현황"
            right={
              <span className="flex items-center gap-1 text-[10px] text-[#94A3B8]">
                <Lock className="h-3 w-3" />
                정량 자동 산출
              </span>
            }
          >

            <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">

              <table className="min-w-[760px] w-full text-left text-xs">

                <thead className="border-b border-[#E2E8F0] bg-[#F8F9FA] font-semibold text-[#64748B]">

                  <tr>
                    <th className="px-3.5 py-2.5">
                      평가영역 / 세부문항
                    </th>

                    <th className="px-3 py-2.5 text-right">
                      현재
                    </th>

                    <th className="px-3 py-2.5 text-right">
                      병원 기준
                    </th>

                    <th className="px-3 py-2.5 text-right">
                      동일유형 평균
                    </th>

                    <th className="px-3 py-2.5 text-right">
                      동일유형 최고
                    </th>

                    <th className="px-3 py-2.5 text-center">
                      상태
                    </th>
                  </tr>

                </thead>


                <tbody className="divide-y divide-[#F1F5F9]">

                  {currentSheet.domainScores.map(
                    (
                      domain
                    ) => (
                      <React.Fragment
                        key={
                          domain.domainName
                        }
                      >

                        <tr>

                          <td className="px-3.5 py-2.5 font-bold text-[#1E293B]">
                            {domain.domainName}
                          </td>

                          <td className="px-3 py-2.5 text-right font-bold">
                            {formatScore(domain.currentScore)}
                          </td>

                          <td className="px-3 py-2.5 text-right text-[#64748B]">
                            {formatScore(domain.hospitalAvg)}
                          </td>

                          <td className="px-3 py-2.5 text-right text-[#64748B]">
                            {formatScore(domain.peerGroupAvg)}
                          </td>

                          <td className="px-3 py-2.5 text-right text-[#243B53]">
                            {formatScore(domain.topScore)}
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge
                              status={
                                domain.status
                              }
                              size="sm"
                            />
                          </td>

                        </tr>


                        {Array.isArray(
                          (domain as any).questions
                        ) &&
                          (domain as any)
                            .questions.map(
                              (
                                question: any
                              ) => (
                                <tr
                                  key={
                                    question.questionId ||
                                    question.questionText
                                  }
                                  className="bg-[#F8F9FA]"
                                >

                                  <td className="py-2 pl-8 pr-3 text-[11px] text-[#475569]">
                                    ↳ {question.questionText}
                                  </td>

                                  <td className="px-3 py-2 text-right text-[11px] font-semibold">
                                    {formatScore(question.currentScore)}
                                  </td>

                                  <td className="px-3 py-2 text-right text-[11px] text-[#64748B]">
                                    {formatScore(question.hospitalAvg)}
                                  </td>

                                  <td className="px-3 py-2 text-right text-[11px] text-[#64748B]">
                                    {formatScore(question.peerGroupAvg)}
                                  </td>

                                  <td className="px-3 py-2 text-right text-[11px] text-[#64748B]">
                                    {formatScore(question.topPerformerScore)}
                                  </td>

                                  <td className="px-3 py-2 text-center text-[10px] text-[#64748B]">
                                    {question.totalDepartments
                                      ? `${question.rank}위`
                                      : "-"}
                                  </td>

                                </tr>
                              )
                            )}

                      </React.Fragment>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </ReportSection>


          {/* =================================================
              SECTION 2
          ================================================== */}

          <ReportSection
            number="2"
            title="AI 종합 진단"
            right={
              isEditMode &&
              !editingDiagnosis
                ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditingDiagnosis(
                        true
                      )
                    }
                    className="no-print flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    수정
                  </button>
                )
                : null
            }
          >

            {editingDiagnosis
              ? (
                <div className="space-y-3 rounded-xl border border-[#5F8079] bg-[#ECF2F7]/40 p-4">

                  <EditField
                    label="핵심 문제"
                    value={
                      editDiagnosis.coreProblem
                    }
                    onChange={
                      (
                        value
                      ) =>
                        setEditDiagnosis({
                          ...editDiagnosis,
                          coreProblem:
                            value,
                        })
                    }
                  />

                  <EditTextArea
                    label="종합 분석 요약"
                    value={
                      editDiagnosis.executiveSummary
                    }
                    rows={4}
                    onChange={
                      (
                        value
                      ) =>
                        setEditDiagnosis({
                          ...editDiagnosis,
                          executiveSummary:
                            value,
                        })
                    }
                  />

                  <EditTextArea
                    label="상세 진단"
                    value={
                      editDiagnosis.detailedDiagnosis
                    }
                    rows={4}
                    onChange={
                      (
                        value
                      ) =>
                        setEditDiagnosis({
                          ...editDiagnosis,
                          detailedDiagnosis:
                            value,
                        })
                    }
                  />


                  <div className="flex justify-end gap-2">

                    <button
                      type="button"
                      onClick={
                        handleCancelDiagnosis
                      }
                      className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs"
                    >
                      취소
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleSaveDiagnosis
                      }
                      className="flex items-center gap-1 rounded-lg bg-[#243B53] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                      적용
                    </button>

                  </div>

                </div>
              )
              : (
                <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4 text-xs">

                  <div>

                    <div className="font-bold text-[#243B53]">
                      핵심 문제
                    </div>

                    <p className="mt-1 leading-relaxed text-[#334155]">
                      {currentSheet.aiDiagnosis.coreProblem ||
                        "AI 진단 결과 없음"}
                    </p>

                  </div>


                  <div className="border-t border-[#E2E8F0] pt-3">

                    <div className="font-bold text-[#1E293B]">
                      종합 분석
                    </div>

                    <p className="mt-1 leading-relaxed text-[#475569]">
                      {currentSheet.aiDiagnosis.executiveSummary}
                    </p>

                  </div>


                  {currentSheet.aiDiagnosis
                    .evidence.length >
                    0 && (
                    <div className="border-t border-[#E2E8F0] pt-3">

                      <div className="mb-1 font-bold text-[#1E293B]">
                        주요 근거
                      </div>

                      <ul className="list-inside list-disc space-y-1 text-[#475569]">

                        {currentSheet.aiDiagnosis
                          .evidence.map(
                            (
                              evidence,
                              index
                            ) => (
                              <li key={index}>
                                {evidence}
                              </li>
                            )
                          )}

                      </ul>

                    </div>
                  )}


                  {currentSheet.aiDiagnosis
                    .detailedDiagnosis && (
                    <div className="border-t border-[#E2E8F0] pt-3">

                      <div className="font-bold text-[#1E293B]">
                        상세 진단
                      </div>

                      <p className="mt-1 leading-relaxed text-[#475569]">
                        {currentSheet.aiDiagnosis.detailedDiagnosis}
                      </p>

                    </div>
                  )}

                </div>
              )}

          </ReportSection>


          {/* =================================================
              SECTION 3
          ================================================== */}

          <ReportSection
            number="3"
            title="주요 환자 VOC 분석"
          >

            {relatedVocItems.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8F9FA] p-5 text-center">

                <MessageSquare className="mx-auto h-6 w-6 text-[#94A3B8]" />

                <div className="mt-2 text-xs font-bold text-[#475569]">
                  해당 분석대상과 직접 연결된 VOC 없음
                </div>

                <p className="mt-1 text-[11px] text-[#64748B]">
                  다른 부서의 VOC는 대체하여 표시하지 않습니다.
                </p>

              </div>
            ) : (
              <>
                {currentSheet.topVocIssues
                  .length >
                  0 && (
                  <div className="mb-4 grid gap-2 md:grid-cols-3">

                    {currentSheet
                      .topVocIssues
                      .slice(0, 3)
                      .map(
                        (
                          issue,
                          index
                        ) => (
                          <div
                            key={
                              `${issue.category}-${index}`
                            }
                            className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-3 text-xs"
                          >

                            <div className="flex items-center justify-between gap-2">

                              <span className="font-bold text-[#1E293B]">
                                {issue.category}
                              </span>

                              <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-[#64748B]">
                                {issue.count}건
                              </span>

                            </div>


                            {isEditMode
                              ? (
                                <textarea
                                  rows={2}
                                  value={
                                    issue.summary
                                  }
                                  onChange={
                                    (
                                      event
                                    ) =>
                                      updateVocIssue(
                                        index,
                                        "summary",
                                        event
                                          .target
                                          .value
                                      )
                                  }
                                  className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-white p-2 text-[11px]"
                                />
                              )
                              : (
                                <p className="mt-2 leading-relaxed text-[#475569]">
                                  {issue.summary}
                                </p>
                              )}

                          </div>
                        )
                      )}

                  </div>
                )}


                <div className="space-y-2">

                  {relatedVocItems
                    .slice(0, 10)
                    .map(
                      (
                        voc
                      ) => (
                        <div
                          key={
                            voc.id
                          }
                          className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs"
                        >

                          <div className="flex flex-wrap items-center justify-between gap-2">

                            <div className="flex flex-wrap items-center gap-1.5">

                              <VocSentimentBadge
                                sentiment={
                                  voc.sentiment
                                }
                              />

                              {voc.category && (
                                <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                                  {voc.category}
                                </span>
                              )}

                              {voc.recommendationScore !==
                                undefined && (
                                <span className="text-[10px] text-[#64748B]">
                                  추천의향 {voc.recommendationScore}
                                </span>
                              )}

                            </div>


                            <span className="text-[10px] text-[#94A3B8]">
                              {voc.date || "응답일 미확인"}
                            </span>

                          </div>


                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748B]">

                            {voc.division && (
                              <span>
                                부문 {voc.division}
                              </span>
                            )}

                            {voc.center && (
                              <span>
                                센터 {voc.center}
                              </span>
                            )}

                            {voc.department && (
                              <span>
                                진료과 {voc.department}
                              </span>
                            )}

                            {voc.doctor && (
                              <span>
                                의사 {voc.doctor}
                              </span>
                            )}

                            {voc.ward && (
                              <span>
                                병동 {voc.ward}
                              </span>
                            )}

                            {voc.examRoom && (
                              <span>
                                검사실 {voc.examRoom}
                              </span>
                            )}

                          </div>


                          <div className="mt-2 flex gap-2 rounded-lg bg-[#F8F9FA] p-2.5 leading-relaxed text-[#475569]">

                            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />

                            <span>
                              {voc.content}
                            </span>

                          </div>

                        </div>
                      )
                    )}

                </div>
              </>
            )}

          </ReportSection>


          {/* =================================================
              SECTION 4
          ================================================== */}

          <ReportSection
            number="4"
            title="부서 맞춤형 개선 Action Plan"
          >

            {actionPlans.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8F9FA] p-5 text-center text-xs text-[#64748B]">
                생성된 Action Plan이 없습니다.
              </div>
            ) : (
              <div className="space-y-3">

                {actionPlans.map(
                  (
                    action,
                    index
                  ) => {

                    const actionPlanKey =
                      `${action.priority}-${index}`;


                    return (
                      <React.Fragment
                        key={
                          actionPlanKey
                        }
                      >
                        <ActionPlanCard
                          action={
                            action
                          }
                          index={
                            index
                          }
                          editable={
                            isEditMode
                          }
                          onChange={
                            updateActionPlan
                          }
                        />
                      </React.Fragment>
                    );
                  }
                )}

              </div>
            )}

          </ReportSection>


          {/* =================================================
              SECTION 5
          ================================================== */}

          <ReportSection
            number="5"
            title="동일유형 타 부서 긍정 VOC 참고사례"
          >

            {!benchmark ||
            benchmark.sourceType ===
              "NONE" ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4 text-xs">

                <div className="flex items-center gap-2 font-bold text-[#475569]">

                  <AlertCircle className="h-4 w-4 text-[#94A3B8]" />

                  {benchmark?.title ||
                    "관련 모범사례 없음"}

                </div>

                <p className="mt-2 leading-relaxed text-[#64748B]">
                  {benchmark?.description ||
                    "동일유형 내에서 타 부서 실제 긍정 VOC 근거를 가진 참고부서를 확인하지 못해 구체적인 벤치마킹 사례를 제시하지 않습니다."}
                </p>


                {currentSheet
                  .topPerformerName && (
                  <div className="mt-2 text-[11px] text-[#94A3B8]">
                    동일유형 점수 1위 부서:{" "}
                    <strong>
                      {currentSheet.topPerformerName}
                    </strong>
                  </div>
                )}

              </div>
            ) : (
              <div className="rounded-xl border border-[#F9E7C4] bg-[#FEF8EC] p-4 text-xs">

                <div className="flex flex-wrap items-center gap-2">

                  <Award className="h-4 w-4 text-[#B87A24]" />

                  <span className="font-bold text-[#8A5B1D]">
                    {benchmark.sourceType ===
                    "AI_RECOMMENDED"
                      ? "[AI 추천] "
                      : ""}
                    {benchmark.title}
                  </span>

                </div>


                {benchmark.sourceDepartment && (
                  <div className="mt-2 text-[11px] text-[#8A5B1D]">
                    Benchmark 참고부서:{" "}
                    <strong>
                      {benchmark.sourceDepartment}
                    </strong>
                  </div>
                )}


                <div className="mt-3 rounded-lg border border-[#F9E7C4] bg-white/70 px-3 py-2 text-[10px] leading-relaxed text-[#8A5B1D]">
                  동일 유형 내 실제 긍정 VOC가 확인된 타 부서의 사례를 참고용으로 제시합니다.
                  점수 1위 부서와 Benchmark 참고부서는 다를 수 있습니다.
                </div>


                <p className="mt-2 leading-relaxed text-[#78350F]">
                  {benchmark.description}
                </p>


                {Array.isArray(
                  benchmark.evidenceQuotes
                ) &&
                  benchmark
                    .evidenceQuotes
                    .length >
                    0 && (
                    <div className="mt-3 space-y-2">

                      <div className="font-bold text-[#78350F]">
                        실제 긍정 VOC 근거
                      </div>

                      {benchmark
                        .evidenceQuotes
                        .map(
                          (
                            quote,
                            index
                          ) => (
                            <div
                              key={
                                index
                              }
                              className="rounded-lg border border-[#F9E7C4] bg-white/80 p-2.5 italic text-[#78350F]"
                            >
                              “{quote}”
                            </div>
                          )
                        )}

                    </div>
                  )}


                {benchmark.disclaimer && (
                  <div className="mt-3 rounded-lg border border-[#F9E7C4] bg-white/70 p-2 text-[10px] leading-relaxed text-[#8A5B1D]">

                    <Sparkles className="mr-1 inline h-3 w-3" />

                    {benchmark.disclaimer}

                  </div>
                )}

              </div>
            )}

          </ReportSection>


          {/* =================================================
              FOOTER
          ================================================== */}

          <div className="mt-8 flex flex-col justify-between gap-2 border-t border-[#EEF1F4] pt-4 text-[10px] text-[#94A3B8] sm:flex-row">

            <div>
              발행일자: {currentSheet.generatedAt}
            </div>

            <div>
              작성부서: {reportDepartment}
            </div>

            <div>
              본 자료는 환자경험 개선을 위한 내부 참고자료입니다.
            </div>

          </div>

        </div>


        <Modal
          isOpen={
            historyGuideOpen
          }
          onClose={() =>
            setHistoryGuideOpen(
              false
            )
          }
          title="피드백 이력 저장소 연결"
          maxWidth="lg"
        >

          <div className="space-y-4 text-xs leading-relaxed text-[#475569]">

            <div className="flex items-start gap-3 rounded-xl border border-[#D9E1EA] bg-[#F8FAFC] p-4">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#ECF2F7]">

                <FolderOpen className="h-5 w-5 text-[#243B53]" />

              </div>


              <div>

                <div className="font-bold text-[#1E293B]">
                  피드백 이력을 저장할 폴더를 연결해주세요.
                </div>


                <div className="mt-1">
                  선택한 폴더에는 Feedback Sheet 이력이 JSON 파일 형태로 저장됩니다.
                  기존 이력 JSON이 있는 폴더를 선택하면 이후 이력 화면에서 함께 불러올 수 있습니다.
                </div>

              </div>

            </div>


            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">

              <div className="font-bold text-[#334155]">
                저장되는 내용
              </div>


              <div className="mt-2 space-y-1 text-[11px] text-[#64748B]">

                <div>
                  · 분석기간 및 분석대상 정보
                </div>

                <div>
                  · 최종 검토·수정된 Feedback Sheet
                </div>

                <div>
                  · Action Plan 및 비식별 VOC 근거
                </div>

                <div>
                  · 저장일시 및 이력 상태
                </div>

              </div>

            </div>


            <div className="rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] px-3 py-2.5 text-[11px] text-[#8C5E1E]">
              브라우저 보안정책상 폴더는 사용자가 직접 선택해야 하며, 앱이 임의로 로컬 경로에 접근하지 않습니다.
            </div>


            <div className="flex justify-end gap-2">

              <button
                type="button"
                onClick={() =>
                  setHistoryGuideOpen(
                    false
                  )
                }
                className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8F9FA]"
              >
                취소
              </button>


              <button
                type="button"
                onClick={
                  handleConnectHistoryFolder
                }
                disabled={
                  isSavingHistory
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:opacity-50"
              >

                {isSavingHistory
                  ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  : (
                      <FolderOpen className="h-4 w-4" />
                    )}

                이력 폴더 선택

              </button>

            </div>

          </div>

        </Modal>

      </div>
    );
  };


/**
 * ============================================================
 * Report Section
 * ============================================================
 */

function ReportSection({
  number,
  title,
  right,
  children,
}: {
  number: string;
  title: string;
  right?: React.ReactNode;
  children:
    React.ReactNode;
}) {

  return (
    <section className="mt-7">

      <div className="mb-3 flex items-center justify-between border-b border-[#EEF1F4] pb-2">

        <div className="flex items-center gap-2">

          <div className="h-4 w-1.5 rounded-full bg-[#243B53]" />

          <h2 className="text-xs font-bold text-[#1E293B]">
            {number}. {title}
          </h2>

        </div>

        {right}

      </div>

      {children}

    </section>
  );
}


/**
 * ============================================================
 * Metric
 * ============================================================
 */

function MetricBox({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub: string;
  emphasis?: boolean;
}) {

  return (
    <div>

      <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-[#64748B]">
        {label}
        <Lock className="h-2.5 w-2.5 text-[#94A3B8]" />
      </div>

      <div
        className={`mt-1 text-lg font-bold ${
          emphasis
            ? "text-[#243B53]"
            : "text-[#1E293B]"
        }`}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[10px] text-[#94A3B8]">
        {sub}
      </div>

    </div>
  );
}


/**
 * ============================================================
 * Action Plan
 * ============================================================
 */

function ActionPlanCard({
  action,
  index,
  editable,
  onChange,
}: {
  action: ActionPlanItem;
  index: number;
  editable: boolean;

  onChange: (
    index: number,
    field:
      keyof ActionPlanItem,
    value: unknown
  ) => void;
}) {

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs">

      <div className="flex items-start gap-2 border-b border-[#EEF1F4] pb-3">

        <span className="shrink-0 rounded-md bg-[#243B53] px-2 py-0.5 font-bold text-white">
          과제 {index + 1}
        </span>


        {editable
          ? (
            <input
              value={
                action.title
              }
              onChange={
                (
                  event
                ) =>
                  onChange(
                    index,
                    "title",
                    event.target.value
                  )
              }
              className="w-full rounded-lg border border-[#E2E8F0] px-2 py-1 font-bold text-[#1E293B]"
            />
          )
          : (
            <div className="font-bold leading-relaxed text-[#1E293B]">
              {action.title}
            </div>
          )}

      </div>


      <div className="mt-3 grid gap-3 md:grid-cols-2">

        <PlanField
          label="실행방법"
          value={
            action.method
          }
          editable={
            editable
          }
          multiline
          onChange={
            (
              value
            ) =>
              onChange(
                index,
                "method",
                value
              )
          }
        />

        <div className="space-y-3">

          <PlanField
            label="적용대상"
            value={
              action.target
            }
            editable={
              editable
            }
            onChange={
              (
                value
              ) =>
                onChange(
                  index,
                  "target",
                  value
                )
            }
          />

          <PlanField
            label="적용일정"
            value={
              action.schedule
            }
            editable={
              editable
            }
            onChange={
              (
                value
              ) =>
                onChange(
                  index,
                  "schedule",
                  value
                )
            }
          />

          <PlanField
            label="기대효과"
            value={
              action.expectedEffect
            }
            editable={
              editable
            }
            onChange={
              (
                value
              ) =>
                onChange(
                  index,
                  "expectedEffect",
                  value
                )
            }
          />

          <PlanField
            label="KPI"
            value={
              action.kpi
            }
            editable={
              editable
            }
            onChange={
              (
                value
              ) =>
                onChange(
                  index,
                  "kpi",
                  value
                )
            }
          />

        </div>

      </div>

    </div>
  );
}


/**
 * ============================================================
 * Plan Field
 * ============================================================
 */

function PlanField({
  label,
  value,
  editable,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string;
  editable: boolean;
  multiline?: boolean;
  onChange:
    (value: string) => void;
}) {

  return (
    <div>

      <div className="mb-1 text-[10px] font-bold text-[#64748B]">
        {label}
      </div>

      {editable
        ? multiline
          ? (
            <textarea
              rows={4}
              value={
                value || ""
              }
              onChange={
                (
                  event
                ) =>
                  onChange(
                    event.target.value
                  )
              }
              className="w-full rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs leading-relaxed"
            />
          )
          : (
            <input
              value={
                value || ""
              }
              onChange={
                (
                  event
                ) =>
                  onChange(
                    event.target.value
                  )
              }
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs"
            />
          )
        : (
          <div className="whitespace-pre-line leading-relaxed text-[#475569]">
            {value || "-"}
          </div>
        )}

    </div>
  );
}


/**
 * ============================================================
 * VOC Sentiment
 * ============================================================
 */

function VocSentimentBadge({
  sentiment,
}: {
  sentiment?: string;
}) {

  if (
    sentiment === "POSITIVE"
  ) {

    return (
      <span className="rounded-md bg-[#EBF5F0] px-1.5 py-0.5 text-[10px] font-bold text-[#2E7D5B]">
        긍정
      </span>
    );
  }


  if (
    sentiment === "NEGATIVE"
  ) {

    return (
      <span className="rounded-md bg-[#FDF2F2] px-1.5 py-0.5 text-[10px] font-bold text-[#B94A48]">
        부정
      </span>
    );
  }


  return (
    <span className="rounded-md bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold text-[#64748B]">
      중립
    </span>
  );
}


/**
 * ============================================================
 * Edit Fields
 * ============================================================
 */

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange:
    (value: string) => void;
}) {

  return (
    <div>

      <label className="mb-1 block text-[11px] font-bold text-[#243B53]">
        {label}
      </label>

      <input
        type="text"
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event.target.value
            )
        }
        className="w-full rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs"
      />

    </div>
  );
}


function EditTextArea({
  label,
  value,
  rows,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  onChange:
    (value: string) => void;
}) {

  return (
    <div>

      <label className="mb-1 block text-[11px] font-bold text-[#243B53]">
        {label}
      </label>

      <textarea
        rows={
          rows
        }
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event.target.value
            )
        }
        className="w-full rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs leading-relaxed"
      />

    </div>
  );
}


/**
 * ============================================================
 * Formatters
 * ============================================================
 */

function formatScore(
  value?:
    | number
    | null
): string {

  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(
      value
    )
  ) {
    return "-";
  }


  return `${value.toFixed(1)}점`;
}


function formatSigned(
  value: number
): string {

  if (
    !Number.isFinite(
      value
    )
  ) {
    return "-";
  }


  return `${
    value > 0
      ? "+"
      : ""
  }${value.toFixed(1)}`;
}