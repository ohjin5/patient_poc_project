import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ChevronRight,
  FileText,
  FolderOpen,
  History,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

import {
  CXFeedbackSheetData,
  FeedbackDeliveryMethod,
  FeedbackExecutionRecord,
  FeedbackFollowUpStatus,
} from "../../types";

import {
  feedbackHistoryService,
  FeedbackHistoryRecord,
} from "../../services/feedbackHistoryService";


interface FeedbackHistoryViewProps {
  onOpenFeedbackSheet?: (
    sheet:
      CXFeedbackSheetData
  ) => void;
}


type FollowUpFilter =
  | "ALL"
  | FeedbackFollowUpStatus;


interface FeedbackFormState {
  id?: string;
  feedbackHistoryId: string;
  departmentId: string;
  departmentName: string;
  period: string;
  feedbackDate: string;
  method: FeedbackDeliveryMethod;
  methodDetail: string;
  recipient: string;
  feedbackText: string;
  followUpStatus: FeedbackFollowUpStatus;
  followUpMemo: string;
  nextFollowUpDate: string;
}


const METHOD_META:
  Record<
    FeedbackDeliveryMethod,
    string
  > = {
    EMAIL:
      "이메일",

    MEETING:
      "대면/회의",

    OFFICIAL_DOCUMENT:
      "공문",

    PHONE:
      "전화",

    MESSENGER:
      "메신저",

    OTHER:
      "기타",
  };


const FOLLOW_UP_META:
  Record<
    FeedbackFollowUpStatus,
    {
      label: string;
      className: string;
    }
  > = {
    DRAFT: {
      label:
        "작성중",
      className:
        "border-[#D9E1EA] bg-[#F8FAFC] text-[#64748B]",
    },

    DELIVERED: {
      label:
        "전달완료",
      className:
        "border-[#B8C7D8] bg-[#ECF2F7] text-[#243B53]",
    },

    WAITING_RESPONSE: {
      label:
        "회신대기",
      className:
        "border-[#F9E7C4] bg-[#FEF8EC] text-[#8C5E1E]",
    },

    IN_PROGRESS: {
      label:
        "개선진행",
      className:
        "border-[#CFE2F3] bg-[#EFF6FC] text-[#315E86]",
    },

    COMPLETED: {
      label:
        "완료",
      className:
        "border-[#C7E6D7] bg-[#EBF5F0] text-[#2E7D5B]",
    },
  };


export const FeedbackHistoryView:
  React.FC<
    FeedbackHistoryViewProps
  > = ({
    onOpenFeedbackSheet,
  }) => {

    const [
      folderName,
      setFolderName,
    ] =
      useState<string>(
        feedbackHistoryService
          .getConnectedFolderName()
      );


    const [
      rememberedPermissionRequired,
      setRememberedPermissionRequired,
    ] =
      useState<boolean>(
        false
      );


    const [
      restoringFolder,
      setRestoringFolder,
    ] =
      useState<boolean>(
        true
      );


    const [
      reports,
      setReports,
    ] =
      useState<
        FeedbackHistoryRecord[]
      >([]);


    const [
      executions,
      setExecutions,
    ] =
      useState<
        FeedbackExecutionRecord[]
      >([]);


    const [
      skippedFiles,
      setSkippedFiles,
    ] =
      useState<string[]>([]);


    const [
      loading,
      setLoading,
    ] =
      useState<boolean>(false);


    const [
      connecting,
      setConnecting,
    ] =
      useState<boolean>(false);


    const [
      saving,
      setSaving,
    ] =
      useState<boolean>(false);


    const [
      errorMessage,
      setErrorMessage,
    ] =
      useState<string | null>(
        null
      );


    const [
      searchKeyword,
      setSearchKeyword,
    ] =
      useState<string>("");


    const [
      periodFilter,
      setPeriodFilter,
    ] =
      useState<string>("ALL");


    const [
      followUpFilter,
      setFollowUpFilter,
    ] =
      useState<
        FollowUpFilter
      >("ALL");


    const [
      selectedExecution,
      setSelectedExecution,
    ] =
      useState<
        FeedbackExecutionRecord |
        null
      >(null);


    const [
      formOpen,
      setFormOpen,
    ] =
      useState<boolean>(false);


    const [
      form,
      setForm,
    ] =
      useState<
        FeedbackFormState
      >(
        createEmptyForm()
      );


    const reportById =
      useMemo(
        () =>
          new Map(
            reports.map(
              (
                report
              ) => [
                report.id,
                report,
              ]
            )
          ),
        [
          reports,
        ]
      );


    const loadAll =
      async () => {

        if (
          !feedbackHistoryService
            .isConnected()
        ) {

          setReports([]);
          setExecutions([]);
          setSkippedFiles([]);
          setFolderName("");

          return;
        }


        setLoading(true);
        setErrorMessage(null);


        try {

          /**
           * 화면 전환/자동 복원 중에는
           * 브라우저 권한 팝업을 강제로 띄우지 않습니다.
           */
          const permission =
            await feedbackHistoryService
              .ensureConnectedPermission(
                false
              );


          if (
            !permission
          ) {

            setRememberedPermissionRequired(
              true
            );


            throw new Error(
              "HISTORY_FOLDER_PERMISSION_REQUIRED"
            );
          }


          /**
           * File System Access API를 동시에 여러 번 호출하지 않고
           * 순차적으로 읽습니다.
           * 폴더 연결 직후 화면이 불안정해지는 현상을 줄이기 위한 처리입니다.
           */
          const historyResult =
            await feedbackHistoryService
              .loadAllHistory();


          const executionResult =
            await feedbackHistoryService
              .loadFeedbackExecutions();


          setReports(
            historyResult.records
          );

          setSkippedFiles(
            historyResult.skippedFiles
          );

          setExecutions(
            executionResult
          );

          setFolderName(
            feedbackHistoryService
              .getConnectedFolderName()
          );

        } catch (
          error
        ) {

          const message =
            error instanceof Error
              ? error.message
              : "";


          console.error(
            "[FeedbackHistoryView] load error:",
            message ||
              error
          );


          if (
            message !==
            "HISTORY_FOLDER_PERMISSION_REQUIRED"
          ) {

            setErrorMessage(
              "이력관리 데이터를 불러오지 못했습니다. 폴더 연결 상태와 권한을 확인해주세요."
            );
          }

        } finally {

          setLoading(false);
        }
      };


    useEffect(() => {

      let mounted =
        true;


      const restoreFolder =
        async () => {

          try {

            if (
              feedbackHistoryService
                .isConnected()
            ) {

              if (mounted) {
                setFolderName(
                  feedbackHistoryService
                    .getConnectedFolderName()
                );
              }

              await loadAll();
              return;
            }


            const result =
              await feedbackHistoryService
                .restoreRememberedFolder();


            if (!mounted) {
              return;
            }


            if (
              result ===
              "RESTORED"
            ) {

              setFolderName(
                feedbackHistoryService
                  .getConnectedFolderName()
              );

              await loadAll();

            } else if (
              result ===
              "PERMISSION_REQUIRED"
            ) {

              setFolderName(
                feedbackHistoryService
                  .getConnectedFolderName()
              );

              setRememberedPermissionRequired(
                true
              );
            }

          } finally {

            if (mounted) {
              setRestoringFolder(
                false
              );
            }
          }
        };


      void restoreFolder();


      return () => {
        mounted =
          false;
      };

    }, []);


    const reconnectRememberedFolder =
      async () => {

        setConnecting(
          true
        );

        setErrorMessage(
          null
        );


        try {

          const granted =
            await feedbackHistoryService
              .ensureConnectedPermission(
                true
              );


          if (!granted) {

            setErrorMessage(
              "이전 이력 폴더 사용 권한을 다시 허용해주세요."
            );

            return;
          }


          setRememberedPermissionRequired(
            false
          );

          setFolderName(
            feedbackHistoryService
              .getConnectedFolderName()
          );

          await loadAll();

        } finally {

          setConnecting(
            false
          );
        }
      };


    const connectFolder =
      async () => {

        if (
          !feedbackHistoryService
            .isSupported()
        ) {

          setErrorMessage(
            "현재 브라우저에서는 로컬 폴더 연결 기능을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 사용해주세요."
          );

          return;
        }


        setConnecting(true);
        setErrorMessage(null);


        try {

          const connectedName =
            await feedbackHistoryService
              .connectHistoryFolder();


          setFolderName(
            connectedName
          );


          await loadAll();

        } catch (
          error
        ) {

          const errorName =
            error instanceof DOMException
              ? error.name
              : "";


          if (
            errorName !==
            "AbortError"
          ) {
            setErrorMessage(
              "이력 폴더를 연결하지 못했습니다."
            );
          }

        } finally {

          setConnecting(false);
        }
      };


    const periods =
      useMemo(
        () =>
          Array.from(
            new Set(
              [
                ...reports.map(
                  (
                    item
                  ) =>
                    item.period
                ),

                ...executions.map(
                  (
                    item
                  ) =>
                    item.period
                ),
              ].filter(Boolean)
            )
          ).sort(
            (
              a,
              b
            ) =>
              b.localeCompare(a)
          ),
        [
          reports,
          executions,
        ]
      );


    const filteredExecutions =
      useMemo(
        () => {

          const keyword =
            searchKeyword
              .trim()
              .toLowerCase();


          return executions.filter(
            (
              item
            ) => {

              if (
                periodFilter !==
                  "ALL" &&
                item.period !==
                  periodFilter
              ) {
                return false;
              }


              if (
                followUpFilter !==
                  "ALL" &&
                item.followUpStatus !==
                  followUpFilter
              ) {
                return false;
              }


              if (
                keyword
              ) {

                const report =
                  reportById.get(
                    item.feedbackHistoryId
                  );


                const searchText =
                  [
                    item.departmentName,
                    item.period,
                    METHOD_META[item.method],
                    item.recipient,
                    item.feedbackText,
                    item.followUpMemo,
                    report?.peerGroupLabel,
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                if (
                  !searchText.includes(
                    keyword
                  )
                ) {
                  return false;
                }
              }


              return true;
            }
          );
        },
        [
          executions,
          periodFilter,
          followUpFilter,
          searchKeyword,
          reportById,
        ]
      );


    const summary =
      useMemo(
        () => ({
          total:
            executions.length,

          delivered:
            executions.filter(
              (
                item
              ) =>
                item.followUpStatus ===
                "DELIVERED"
            ).length,

          waiting:
            executions.filter(
              (
                item
              ) =>
                item.followUpStatus ===
                "WAITING_RESPONSE"
            ).length,

          progress:
            executions.filter(
              (
                item
              ) =>
                item.followUpStatus ===
                "IN_PROGRESS"
            ).length,

          completed:
            executions.filter(
              (
                item
              ) =>
                item.followUpStatus ===
                "COMPLETED"
            ).length,
        }),
        [
          executions,
        ]
      );


    const openNewForm =
      (
        report?:
          FeedbackHistoryRecord
      ) => {

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);


        setForm({
          ...createEmptyForm(),
          feedbackHistoryId:
            report?.id || "",
          departmentId:
            report?.departmentId || "",
          departmentName:
            report?.departmentName || "",
          period:
            report?.period || "",
          feedbackDate:
            today,
        });


        setFormOpen(true);
      };


    const openEditForm =
      (
        item:
          FeedbackExecutionRecord
      ) => {

        setForm({
          id:
            item.id,
          feedbackHistoryId:
            item.feedbackHistoryId,
          departmentId:
            item.departmentId,
          departmentName:
            item.departmentName,
          period:
            item.period,
          feedbackDate:
            item.feedbackDate,
          method:
            item.method,
          methodDetail:
            item.methodDetail || "",
          recipient:
            item.recipient || "",
          feedbackText:
            item.feedbackText,
          followUpStatus:
            item.followUpStatus,
          followUpMemo:
            item.followUpMemo || "",
          nextFollowUpDate:
            item.nextFollowUpDate || "",
        });


        setFormOpen(true);
      };


    const handleReportChange =
      (
        historyId:
          string
      ) => {

        const report =
          reportById.get(
            historyId
          );


        setForm(
          (
            previous
          ) => ({
            ...previous,
            feedbackHistoryId:
              historyId,
            departmentId:
              report?.departmentId || "",
            departmentName:
              report?.departmentName || "",
            period:
              report?.period || "",
          })
        );
      };


    const saveExecution =
      async () => {

        if (
          !form.feedbackHistoryId
        ) {
          alert(
            "연결할 Feedback Report를 선택해주세요."
          );
          return;
        }


        if (
          !form.feedbackDate
        ) {
          alert(
            "피드백 일자를 입력해주세요."
          );
          return;
        }


        if (
          !form.feedbackText
            .trim()
        ) {
          alert(
            "실제 전달한 피드백 내용을 입력해주세요."
          );
          return;
        }


        setSaving(true);


        try {

          await feedbackHistoryService
            .saveFeedbackExecution({
              id:
                form.id,
              feedbackHistoryId:
                form.feedbackHistoryId,
              departmentId:
                form.departmentId,
              departmentName:
                form.departmentName,
              period:
                form.period,
              feedbackDate:
                form.feedbackDate,
              method:
                form.method,
              methodDetail:
                form.methodDetail,
              recipient:
                form.recipient,
              feedbackText:
                form.feedbackText,
              followUpStatus:
                form.followUpStatus,
              followUpMemo:
                form.followUpMemo,
              nextFollowUpDate:
                form.nextFollowUpDate,
              hasLinkedReport:
                true,
            });


          setFormOpen(false);
          setSelectedExecution(null);

          await loadAll();

        } catch (
          error
        ) {

          console.error(
            "[FeedbackHistoryView] save execution error:",
            error instanceof Error
              ? error.message
              : error
          );

          alert(
            "피드백 이력을 저장하지 못했습니다."
          );

        } finally {

          setSaving(false);
        }
      };


    if (
      restoringFolder
    ) {

      return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center shadow-2xs">

          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#243B53]" />

          <div className="mt-3 text-xs font-bold text-[#334155]">
            이전 이력 폴더 연결을 확인하고 있습니다...
          </div>

        </div>
      );
    }


    if (
      rememberedPermissionRequired
    ) {

      return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 shadow-2xs">

          <div className="mx-auto max-w-2xl text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#ECF2F7]">
              <FolderOpen className="h-7 w-7 text-[#243B53]" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#1E293B]">
              이전 이력 폴더를 기억하고 있습니다
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
              저장된 폴더 연결 정보는 유지되어 있습니다.
              브라우저 보안정책상 권한만 다시 허용하면 기존 폴더를 다시 선택하지 않고 계속 사용할 수 있습니다.
            </p>

            <div className="mt-3 text-[11px] font-semibold text-[#243B53]">
              기억된 폴더: {folderName}
            </div>

            <button
              type="button"
              onClick={
                reconnectRememberedFolder
              }
              disabled={
                connecting
              }
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#243B53] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:opacity-50"
            >
              {connecting
                ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )
                : (
                    <FolderOpen className="h-4 w-4" />
                  )}

              이전 폴더 다시 연결
            </button>

          </div>

        </div>
      );
    }


    if (
      !folderName
    ) {

      return (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 shadow-2xs">

          <div className="mx-auto max-w-2xl text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#ECF2F7]">
              <FolderOpen className="h-7 w-7 text-[#243B53]" />
            </div>

            <h2 className="mt-4 text-lg font-bold text-[#1E293B]">
              이력관리 저장소 연결
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
              Feedback Report와 실제 피드백 전달·후속조치 이력을 함께 관리하려면
              기존 이력 폴더를 연결해주세요.
            </p>

            <button
              type="button"
              onClick={
                connectFolder
              }
              disabled={
                connecting
              }
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#243B53] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:opacity-50"
            >

              {connecting
                ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )
                : (
                    <FolderOpen className="h-4 w-4" />
                  )}

              이력 폴더 선택

            </button>

            {errorMessage && (
              <div className="mt-4 rounded-lg border border-[#F6D3D3] bg-[#FDF2F2] px-4 py-3 text-left text-xs text-[#B94A48]">
                {errorMessage}
              </div>
            )}

          </div>

        </div>
      );
    }


    return (
      <div className="space-y-5">

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D9E1EA] bg-[#ECF2F7] px-2.5 py-1 text-[11px] font-bold text-[#243B53]">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {folderName}
                </span>

                <span className="text-[11px] text-[#64748B]">
                  Feedback Report + 피드백 실행이력
                </span>

              </div>

              <h2 className="mt-2 text-lg font-bold tracking-tight text-[#1E293B]">
                이력관리
              </h2>

              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#64748B]">
                어느 부서에 언제 어떤 방식으로 어떤 내용을 전달했는지 기록하고,
                해당 시점의 Feedback Report와 후속조치 상태를 함께 관리합니다.
              </p>

            </div>


            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={
                  loadAll
                }
                disabled={
                  loading
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-xs font-semibold text-[#334155] hover:bg-[#F8F9FA] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                새로고침
              </button>

              <button
                type="button"
                onClick={() =>
                  openNewForm()
                }
                disabled={
                  reports.length ===
                  0
                }
                title={
                  reports.length ===
                  0
                    ? "먼저 Feedback Report를 이력에 저장해주세요."
                    : "실제 전달한 피드백 내용을 등록합니다."
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                피드백 등록
              </button>

            </div>

          </div>

        </div>


        {errorMessage && (
          <div className="flex items-start gap-2 rounded-xl border border-[#F6D3D3] bg-[#FDF2F2] px-4 py-3 text-xs text-[#B94A48]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}


        {skippedFiles.length >
          0 && (
          <div className="rounded-xl border border-[#F9E7C4] bg-[#FEF8EC] px-4 py-3 text-xs text-[#8C5E1E]">
            손상되었거나 이력 형식이 아닌 JSON {skippedFiles.length}개를 건너뛰었습니다.
          </div>
        )}


        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

          <SummaryCard label="전체 피드백" value={summary.total} />
          <SummaryCard label="전달완료" value={summary.delivered} />
          <SummaryCard label="회신대기" value={summary.waiting} />
          <SummaryCard label="개선진행" value={summary.progress} />
          <SummaryCard label="완료" value={summary.completed} />

        </div>


        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

          <div className="grid gap-3 md:grid-cols-3">

            <FilterSelect
              label="평가기간"
              value={
                periodFilter
              }
              onChange={
                setPeriodFilter
              }
              options={[
                {
                  value:
                    "ALL",
                  label:
                    "전체 기간",
                },
                ...periods.map(
                  (
                    period
                  ) => ({
                    value:
                      period,
                    label:
                      period,
                  })
                ),
              ]}
            />

            <FilterSelect
              label="후속상태"
              value={
                followUpFilter
              }
              onChange={
                (
                  value
                ) =>
                  setFollowUpFilter(
                    value as
                      FollowUpFilter
                  )
              }
              options={[
                {
                  value:
                    "ALL",
                  label:
                    "전체 상태",
                },
                ...Object.entries(
                  FOLLOW_UP_META
                ).map(
                  (
                    [
                      value,
                      meta,
                    ]
                  ) => ({
                    value,
                    label:
                      meta.label,
                  })
                ),
              ]}
            />

            <label className="block">

              <span className="text-[10px] font-bold text-[#64748B]">
                검색
              </span>

              <div className="relative mt-1.5">

                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />

                <input
                  type="text"
                  value={
                    searchKeyword
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setSearchKeyword(
                        event.target.value
                      )
                  }
                  placeholder="부서 / 전달내용 / 대상 검색..."
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] py-2 pl-9 pr-3 text-xs text-[#1E293B] focus:border-[#243B53] focus:outline-none"
                />

              </div>

            </label>

          </div>

        </div>


        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">

          <div className="flex items-center justify-between border-b border-[#EEF1F4] bg-[#F8F9FA] px-4 py-3">

            <div>

              <h3 className="text-xs font-bold text-[#1E293B]">
                피드백 실행 관리대장
              </h3>

              <p className="mt-0.5 text-[10px] text-[#64748B]">
                현재 조건 {filteredExecutions.length}건 · 저장된 Feedback Report {reports.length}건
              </p>

            </div>

          </div>


          {loading
            ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs font-semibold text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin" />
                이력을 불러오고 있습니다...
              </div>
            )
            : filteredExecutions.length ===
              0
            ? (
              <div className="py-12 text-center">

                <History className="mx-auto h-8 w-8 text-[#CBD5E1]" />

                <div className="mt-2 text-xs font-bold text-[#64748B]">
                  등록된 피드백 실행 이력이 없습니다.
                </div>

                <div className="mt-1 text-[11px] text-[#94A3B8]">
                  Feedback Report를 이력에 저장한 뒤 ‘피드백 등록’에서 실제 전달 내용을 기록해주세요.
                </div>

              </div>
            )
            : (
              <div className="overflow-x-auto">

                <table className="min-w-[1180px] w-full text-left text-xs">

                  <thead className="border-b border-[#EEF1F4] bg-[#F8F9FA] font-semibold text-[#64748B]">

                    <tr>

                      <th className="px-4 py-3">피드백일</th>
                      <th className="px-3 py-3">대상부서</th>
                      <th className="px-3 py-3">평가기간</th>
                      <th className="px-3 py-3">방식</th>
                      <th className="px-3 py-3">전달대상</th>
                      <th className="px-3 py-3">피드백 내용</th>
                      <th className="px-3 py-3 text-center">후속상태</th>
                      <th className="px-3 py-3 text-center">Report</th>
                      <th className="px-3 py-3 text-right">관리</th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-[#F1F5F9]">

                    {filteredExecutions.map(
                      (
                        item
                      ) => {

                        const report =
                          reportById.get(
                            item.feedbackHistoryId
                          );


                        return (
                          <tr
                            key={
                              item.id
                            }
                            className="align-top transition-colors hover:bg-[#F8F9FA]"
                          >

                            <td className="px-4 py-3 font-semibold text-[#334155]">
                              {formatDate(
                                item.feedbackDate
                              )}
                            </td>

                            <td className="px-3 py-3">

                              <div className="font-bold text-[#1E293B]">
                                {item.departmentName}
                              </div>

                              {report?.peerGroupLabel && (
                                <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                                  {report.peerGroupLabel}
                                </div>
                              )}

                            </td>

                            <td className="px-3 py-3 text-[#64748B]">
                              {item.period || "-"}
                            </td>

                            <td className="px-3 py-3 text-[#475569]">
                              {METHOD_META[item.method]}
                              {item.method === "OTHER" &&
                                item.methodDetail
                                ? ` · ${item.methodDetail}`
                                : ""}
                            </td>

                            <td className="px-3 py-3 text-[#475569]">
                              {item.recipient || "-"}
                            </td>

                            <td className="max-w-[360px] px-3 py-3">

                              <div className="line-clamp-3 leading-relaxed text-[#334155]">
                                {item.feedbackText}
                              </div>

                              {item.followUpMemo && (
                                <div className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-[#64748B]">
                                  후속: {item.followUpMemo}
                                </div>
                              )}

                            </td>

                            <td className="px-3 py-3 text-center">

                              <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold ${FOLLOW_UP_META[item.followUpStatus].className}`}>
                                {FOLLOW_UP_META[item.followUpStatus].label}
                              </span>

                            </td>

                            <td className="px-3 py-3 text-center">

                              {report &&
                                onOpenFeedbackSheet
                                ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenFeedbackSheet(
                                        report.feedbackSheet
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-[#D9E1EA] bg-white px-2 py-1 text-[10px] font-bold text-[#243B53] hover:bg-[#ECF2F7]"
                                  >
                                    <FileText className="h-3 w-3" />
                                    보기
                                  </button>
                                )
                                : (
                                  <span className="text-[10px] text-[#94A3B8]">
                                    연결없음
                                  </span>
                                )}

                            </td>

                            <td className="px-3 py-3 text-right">

                              <div className="inline-flex gap-1">

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedExecution(
                                      item
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-[#243B53] hover:bg-[#ECF2F7]"
                                >
                                  상세
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditForm(
                                      item
                                    )
                                  }
                                  className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#243B53]"
                                  aria-label="피드백 이력 수정"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>

                              </div>

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>

                </table>

              </div>
            )}

        </div>


        {selectedExecution && (

          <div className="rounded-xl border border-[#D9E1EA] bg-white p-5 shadow-2xs">

            <div className="flex items-start justify-between gap-3 border-b border-[#EEF1F4] pb-4">

              <div>

                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-[#243B53]" />
                  <span className="text-xs font-bold text-[#1E293B]">
                    피드백 상세
                  </span>
                </div>

                <div className="mt-1 text-lg font-bold text-[#243B53]">
                  {selectedExecution.departmentName}
                </div>

                <div className="mt-1 text-[11px] text-[#64748B]">
                  {formatDate(selectedExecution.feedbackDate)} · {METHOD_META[selectedExecution.method]}
                </div>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedExecution(
                    null
                  )
                }
                className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#64748B] hover:bg-[#F8F9FA]"
              >
                <X className="h-4 w-4" />
              </button>

            </div>


            <div className="mt-4 grid gap-3 md:grid-cols-4">

              <PreviewMetric label="평가기간" value={selectedExecution.period || "-"} />
              <PreviewMetric label="전달대상" value={selectedExecution.recipient || "-"} />
              <PreviewMetric label="후속상태" value={FOLLOW_UP_META[selectedExecution.followUpStatus].label} />
              <PreviewMetric label="다음 확인일" value={selectedExecution.nextFollowUpDate || "-"} />

            </div>


            <div className="mt-4 grid gap-4 lg:grid-cols-2">

              <TextDetail
                label="전달한 피드백 내용"
                value={
                  selectedExecution.feedbackText
                }
              />

              <TextDetail
                label="후속조치 / 회신 메모"
                value={
                  selectedExecution.followUpMemo ||
                  "등록된 후속조치 내용이 없습니다."
                }
              />

            </div>


            <div className="mt-4 flex justify-end gap-2">

              {(() => {

                const report =
                  reportById.get(
                    selectedExecution.feedbackHistoryId
                  );


                if (
                  !report ||
                  !onOpenFeedbackSheet
                ) {
                  return null;
                }


                return (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenFeedbackSheet(
                        report.feedbackSheet
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#B8C7D8] bg-[#ECF2F7] px-3.5 py-2 text-xs font-bold text-[#243B53] hover:bg-[#DCE7F0]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    연결된 Feedback Report 보기
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() =>
                  openEditForm(
                    selectedExecution
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1B2F44]"
              >
                <Pencil className="h-3.5 w-3.5" />
                수정
              </button>

            </div>

          </div>
        )}


        {formOpen && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">

            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D9E1EA] bg-white shadow-2xl">

              <div className="flex items-start justify-between border-b border-[#EEF1F4] px-5 py-4">

                <div>

                  <div className="text-sm font-bold text-[#1E293B]">
                    {form.id
                      ? "피드백 이력 수정"
                      : "피드백 등록"}
                  </div>

                  <div className="mt-1 text-[11px] text-[#64748B]">
                    실제 부서에 전달한 내용과 후속조치 상태를 기록합니다.
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setFormOpen(false)
                  }
                  className="rounded-lg p-2 text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>


              <div className="space-y-4 p-5">

                <FormField label="연결 Feedback Report">

                  <select
                    value={
                      form.feedbackHistoryId
                    }
                    onChange={
                      (
                        event
                      ) =>
                        handleReportChange(
                          event.target.value
                        )
                    }
                    disabled={
                      Boolean(form.id)
                    }
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#243B53] focus:outline-none disabled:bg-[#F8F9FA] disabled:text-[#94A3B8]"
                  >

                    <option value="">
                      Feedback Report 선택
                    </option>

                    {reports.map(
                      (
                        report
                      ) => (
                        <option
                          key={
                            report.id
                          }
                          value={
                            report.id
                          }
                        >
                          {report.period || "기간미확인"} · {report.departmentName} · {formatScore(report.feedbackSheet?.overallScore)}
                        </option>
                      )
                    )}

                  </select>

                </FormField>


                <div className="grid gap-3 md:grid-cols-2">

                  <FormField label="피드백 일자">

                    <input
                      type="date"
                      value={
                        form.feedbackDate
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm({
                            ...form,
                            feedbackDate:
                              event.target.value,
                          })
                      }
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                    />

                  </FormField>


                  <FormField label="피드백 방식">

                    <select
                      value={
                        form.method
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm({
                            ...form,
                            method:
                              event.target.value as
                                FeedbackDeliveryMethod,
                          })
                      }
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                    >

                      {Object.entries(
                        METHOD_META
                      ).map(
                        (
                          [
                            value,
                            label,
                          ]
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {label}
                          </option>
                        )
                      )}

                    </select>

                  </FormField>

                </div>


                {form.method === "OTHER" && (

                  <FormField label="기타 방식">

                    <input
                      type="text"
                      value={
                        form.methodDetail
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm({
                            ...form,
                            methodDetail:
                              event.target.value,
                          })
                      }
                      placeholder="예: 부서 방문 전달"
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                    />

                  </FormField>
                )}


                <FormField
                  label="전달 대상"
                  description="개인 이름 대신 직책·역할 중심 입력을 권장합니다."
                >

                  <input
                    type="text"
                    value={
                      form.recipient
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setForm({
                          ...form,
                          recipient:
                            event.target.value,
                        })
                    }
                    placeholder="예: 수간호사 / 진료과 담당자"
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                  />

                </FormField>


                <FormField label="실제 전달한 피드백 내용">

                  <textarea
                    rows={5}
                    value={
                      form.feedbackText
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setForm({
                          ...form,
                          feedbackText:
                            event.target.value,
                        })
                    }
                    placeholder="예: 설명 관련 점수 저하와 실제 VOC 내용을 공유하고 환자 설명 절차 점검을 요청함."
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs leading-relaxed focus:border-[#243B53] focus:outline-none"
                  />

                </FormField>


                <div className="grid gap-3 md:grid-cols-2">

                  <FormField label="후속조치 상태">

                    <select
                      value={
                        form.followUpStatus
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm({
                            ...form,
                            followUpStatus:
                              event.target.value as
                                FeedbackFollowUpStatus,
                          })
                      }
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                    >

                      {Object.entries(
                        FOLLOW_UP_META
                      ).map(
                        (
                          [
                            value,
                            meta,
                          ]
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {meta.label}
                          </option>
                        )
                      )}

                    </select>

                  </FormField>


                  <FormField label="다음 확인 예정일">

                    <input
                      type="date"
                      value={
                        form.nextFollowUpDate
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm({
                            ...form,
                            nextFollowUpDate:
                              event.target.value,
                          })
                      }
                      className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs focus:border-[#243B53] focus:outline-none"
                    />

                  </FormField>

                </div>


                <FormField label="후속조치 / 회신 메모">

                  <textarea
                    rows={4}
                    value={
                      form.followUpMemo
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setForm({
                          ...form,
                          followUpMemo:
                            event.target.value,
                        })
                    }
                    placeholder="예: 부서에서 안내문 개정 예정이라고 회신함."
                    className="w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-xs leading-relaxed focus:border-[#243B53] focus:outline-none"
                  />

                </FormField>

              </div>


              <div className="flex justify-end gap-2 border-t border-[#EEF1F4] bg-[#F8F9FA] px-5 py-4">

                <button
                  type="button"
                  onClick={() =>
                    setFormOpen(false)
                  }
                  className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  취소
                </button>

                <button
                  type="button"
                  onClick={
                    saveExecution
                  }
                  disabled={
                    saving
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44] disabled:opacity-50"
                >

                  {saving
                    ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )
                    : (
                        <Send className="h-4 w-4" />
                      )}

                  저장

                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    );
  };


function createEmptyForm():
  FeedbackFormState {

  return {
    feedbackHistoryId:
      "",
    departmentId:
      "",
    departmentName:
      "",
    period:
      "",
    feedbackDate:
      "",
    method:
      "EMAIL",
    methodDetail:
      "",
    recipient:
      "",
    feedbackText:
      "",
    followUpStatus:
      "DELIVERED",
    followUpMemo:
      "",
    nextFollowUpDate:
      "",
  };
}


function SummaryCard({
  label,
  value,
}: {
  label:
    string;
  value:
    number;
}) {

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

      <div className="text-[10px] font-semibold text-[#64748B]">
        {label}
      </div>

      <div className="mt-1 text-xl font-bold text-[#1E293B]">
        {value.toLocaleString()}
      </div>

    </div>
  );
}


function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label:
    string;
  value:
    string;
  onChange:
    (
      value:
        string
    ) => void;
  options:
    Array<{
      value: string;
      label: string;
    }>;
}) {

  return (
    <label className="block">

      <span className="text-[10px] font-bold text-[#64748B]">
        {label}
      </span>

      <select
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
        className="mt-1.5 w-full rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-2 text-xs text-[#1E293B] focus:border-[#243B53] focus:outline-none"
      >

        {options.map(
          (
            option
          ) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          )
        )}

      </select>

    </label>
  );
}


function FormField({
  label,
  description,
  children,
}: {
  label:
    string;
  description?:
    string;
  children:
    React.ReactNode;
}) {

  return (
    <label className="block">

      <div className="mb-1.5 text-[11px] font-bold text-[#334155]">
        {label}
      </div>

      {description && (
        <div className="mb-1.5 text-[10px] text-[#94A3B8]">
          {description}
        </div>
      )}

      {children}

    </label>
  );
}


function PreviewMetric({
  label,
  value,
}: {
  label:
    string;
  value:
    string;
}) {

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">

      <div className="text-[10px] font-semibold text-[#94A3B8]">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-[#1E293B]">
        {value}
      </div>

    </div>
  );
}


function TextDetail({
  label,
  value,
}: {
  label:
    string;
  value:
    string;
}) {

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8F9FA] p-4">

      <div className="text-[10px] font-bold text-[#64748B]">
        {label}
      </div>

      <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[#334155]">
        {value}
      </div>

    </div>
  );
}


function formatScore(
  value:
    unknown
): string {

  if (
    typeof value === "number" &&
    Number.isFinite(
      value
    )
  ) {
    return `${value.toFixed(1)}점`;
  }


  return "점수 미확인";
}


function formatDate(
  value:
    string
): string {

  if (
    !value
  ) {
    return "-";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return date.toLocaleDateString(
    "ko-KR"
  );
}
