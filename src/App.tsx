import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ShieldCheck,
  AlertCircle,
  X,
  LayoutDashboard,
  CalendarRange,
  History,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Eye,
} from "lucide-react";


/**
 * ============================================================
 * Layout
 * ============================================================
 */

import {
  Header,
} from "./components/layout/Header";

import {
  Sidebar,
  MenuItemId,
} from "./components/layout/Sidebar";

import {
  ProcessStepper,
} from "./components/layout/ProcessStepper";


/**
 * ============================================================
 * Views
 * ============================================================
 */

import {
  DashboardView,
} from "./components/dashboard/DashboardView";

import {
  DataUploadView,
} from "./components/upload/DataUploadView";

import {
  CriteriaView,
} from "./components/criteria/CriteriaView";

import {
  VulnerableListView,
} from "./components/vulnerable/VulnerableListView";

import {
  PeriodComparisonView,
} from "./components/comparison/PeriodComparisonView";

import {
  DepartmentDetailView,
} from "./components/detail/DepartmentDetailView";

import {
  BenchmarkView,
} from "./components/benchmark/BenchmarkView";

import {
  FeedbackSheetView,
} from "./components/feedback/FeedbackSheetView";

import {
  FeedbackHistoryView,
} from "./components/history/FeedbackHistoryView";

/**
 * ============================================================
 * Common Components
 * ============================================================
 */

import {
  AIAnalysisModal,
} from "./components/common/AIAnalysisModal";

import {
  Modal,
} from "./components/common/StatusBadge";

import {
  LoginView,
} from "./components/auth/LoginView";


/**
 * ============================================================
 * Types
 * ============================================================
 */

import {
  AnalysisScopeConfig,
  BatchFeedbackGenerationItem,
  BatchFeedbackGenerationState,
  DepartmentSummary,
  RawVocItem,
  UploadedFileMetadata,
  CriteriaConfig,
  CXFeedbackSheetData,
} from "./types";


/**
 * ============================================================
 * Constants / Services
 * ============================================================
 */

import {
  DEFAULT_CRITERIA,
} from "./constants";

import {
  NormalizationService,
} from "./services/normalizationService";

import {
  AnalysisEngine,
} from "./services/analysisEngine";

import {
  ExcelService,
} from "./services/excelService";

import {
  aiOrchestrator,
} from "./services/ai/aiOrchestrator";

import {
  checkSession,
  logout,
} from "./services/authService";


/**
 * ============================================================
 * Period Dataset Types
 * ============================================================
 */

type UploadDatasetMode =
  | "CURRENT"
  | "COMPARISON";


interface PeriodDataset {
  id:
    string;

  mode:
    UploadDatasetMode;

  period:
    string;

  uploadedFiles:
    UploadedFileMetadata[];

  departments:
    DepartmentSummary[];

  vocList:
    RawVocItem[];
}


/**
 * ============================================================
 * App
 * ============================================================
 */

export default function App() {

  const mainScrollRef =
    useRef<HTMLElement | null>(
      null
    );


  /**
   * ==========================================================
   * Authentication
   * ==========================================================
   */

  const [
    authenticated,
    setAuthenticated,
  ] =
    useState<boolean | null>(
      null
    );


  /**
   * ==========================================================
   * Core State
   * ==========================================================
   */

  const [
    currentPeriod,
    setCurrentPeriod,
  ] =
    useState<string>("");


  const [
    activeMenu,
    setActiveMenu,
  ] =
    useState<MenuItemId>(
      "dashboard"
    );


  /**
   * ==========================================================
   * 결과 화면 상위 탭
   * ==========================================================
   *
   * CURRENT : 현재 결과
   * COMPARE : 기간 비교
   * HISTORY : 피드백 이력
   *
   * 기간 비교는 다음 단계에서
   * 다기간 Dataset 구조를 연결한 뒤 활성화합니다.
   */
  const [
    resultWorkspaceTab,
    setResultWorkspaceTab,
  ] = useState<
    "CURRENT" | "COMPARE" | "HISTORY"
  >("CURRENT");


  const [
    criteria,
    setCriteria,
  ] =
    useState<CriteriaConfig>(
      DEFAULT_CRITERIA
    );


  const [
    analysisScope,
    setAnalysisScope,
  ] =
    useState<AnalysisScopeConfig>({
      selectAll:
        true,

      selectedPeerGroups:
        [],

      selectedDepartmentIds:
        [],
    });


  /**
   * 현재 분석기간 파일
   *
   * 기존 uploadedFiles 상태명은
   * 기존 컴포넌트 호환을 위해 그대로 유지합니다.
   */
  const [
    uploadedFiles,
    setUploadedFiles,
  ] =
    useState<
      UploadedFileMetadata[]
    >([]);


  /**
   * 비교기간 파일
   *
   * 현재 분석기간과 물리적으로 분리하여 보관합니다.
   * 다음 단계에서 DataUploadView의 "비교기간 추가" UI를
   * 이 상태와 실제 연결합니다.
   */
  const [
    comparisonUploadedFiles,
    setComparisonUploadedFiles,
  ] =
    useState<
      UploadedFileMetadata[]
    >([]);


  const [
    rawDepartments,
    setRawDepartments,
  ] =
    useState<
      DepartmentSummary[]
    >([]);


  const [
    vocList,
    setVocList,
  ] =
    useState<
      RawVocItem[]
    >([]);


  /**
   * 비교기간 정규화 결과
   *
   * 기간별 파일 묶음을 독립적으로 정규화해 보관합니다.
   */
  const [
    comparisonDatasets,
    setComparisonDatasets,
  ] =
    useState<
      PeriodDataset[]
    >([]);


  const [
    selectedDeptId,
    setSelectedDeptId,
  ] =
    useState<string>("");


  const [
    feedbackSheetData,
    setFeedbackSheetData,
  ] =
    useState<
      CXFeedbackSheetData | null
    >(null);


  /**
   * ==========================================================
   * Batch Feedback Sheet State
   * ==========================================================
   *
   * 여러 분석단위를 선택해 일괄 생성한 Feedback Sheet를
   * 메모리에서 보관합니다.
   *
   * 다음 단계에서 이 배열을 이용해
   * ZIP / Excel / 개별 파일 일괄 다운로드를 연결합니다.
   */
  const [
    batchFeedbackSheets,
    setBatchFeedbackSheets,
  ] =
    useState<
      CXFeedbackSheetData[]
    >([]);


  const [
    batchFeedbackState,
    setBatchFeedbackState,
  ] =
    useState<
      BatchFeedbackGenerationState | null
    >(null);


  const [
    batchFeedbackNotice,
    setBatchFeedbackNotice,
  ] =
    useState<string | null>(
      null
    );


  /**
   * 일괄 생성이 완료된 직후 1회만 노출되는 결과 요약 팝업입니다.
   * 사용자가 닫은 뒤에는 같은 결과에 대해 자동으로 다시 열리지 않습니다.
   */
  const [
    batchCompletionModalOpen,
    setBatchCompletionModalOpen,
  ] =
    useState<boolean>(
      false
    );


  /**
   * 일괄 생성 결과 목록의 "보기"에서 Feedback Sheet를 연 경우에만
   * 뒤로가기 버튼을 노출하기 위한 화면 출처 상태입니다.
   */
  const [
    feedbackOpenedFromBatch,
    setFeedbackOpenedFromBatch,
  ] =
    useState<boolean>(
      false
    );


  /**
   * ==========================================================
   * AI Pipeline State
   * ==========================================================
   */

  const [
    isAnalyzing,
    setIsAnalyzing,
  ] =
    useState<boolean>(
      false
    );


  const [
    aiStep,
    setAiStep,
  ] =
    useState<number>(1);


  const [
    aiMessage,
    setAiMessage,
  ] =
    useState<string>(
      "AI 분석을 준비하고 있습니다..."
    );


  const [
    aiPercent,
    setAiPercent,
  ] =
    useState<number>(0);


  /**
   * AI 실패 메시지
   */
  const [
    aiError,
    setAiError,
  ] =
    useState<string | null>(
      null
    );


  /**
   * ==========================================================
   * Privacy Modal
   * ==========================================================
   */

  const [
    privacyModalOpen,
    setPrivacyModalOpen,
  ] =
    useState<boolean>(
      false
    );


  /**
   * ==========================================================
   * Authentication Check
   * ==========================================================
   */

  useEffect(() => {

    let mounted =
      true;


    checkSession()
      .then(
        (
          isAuthenticated
        ) => {

          if (mounted) {
            setAuthenticated(
              isAuthenticated
            );
          }
        }
      )
      .catch(() => {

        if (mounted) {
          setAuthenticated(
            false
          );
        }
      });


    return () => {
      mounted =
        false;
    };

  }, []);


  /**
   * ==========================================================
   * Logout
   * ==========================================================
   */

  const handleLogout =
    async () => {

      try {

        await logout();

      } finally {

        setAuthenticated(
          false
        );

        /**
         * 민감 데이터 화면상 초기화
         */
        setUploadedFiles([]);
        setComparisonUploadedFiles([]);
        setComparisonDatasets([]);
        setRawDepartments([]);
        setVocList([]);

        setAnalysisScope({
          selectAll:
            true,

          selectedPeerGroups:
            [],

          selectedDepartmentIds:
            [],
        });

        setFeedbackSheetData(
          null
        );

        setBatchFeedbackSheets(
          []
        );

        setBatchFeedbackState(
          null
        );

        setBatchFeedbackNotice(
          null
        );

        setBatchCompletionModalOpen(
          false
        );

        setFeedbackOpenedFromBatch(
          false
        );

        setSelectedDeptId("");
      }
    };


  /**
   * ==========================================================
   * Normalize Uploaded Files
   * ==========================================================
   */

  useEffect(() => {

    /**
     * 파일이 없는 경우
     */
    if (
      uploadedFiles.length ===
      0
    ) {

      setRawDepartments(
        []
      );

      setVocList([]);

      setAnalysisScope({
        selectAll:
          true,

        selectedPeerGroups:
          [],

        selectedDepartmentIds:
          [],
      });

      setSelectedDeptId("");

      setFeedbackSheetData(
        null
      );

      setBatchFeedbackSheets(
        []
      );

      setBatchFeedbackState(
        null
      );

      setBatchFeedbackNotice(
        null
      );

      setBatchCompletionModalOpen(
        false
      );

      setFeedbackOpenedFromBatch(
        false
      );

      setCurrentPeriod("");

      return;
    }


    try {

      const normalized =
        NormalizationService
          .normalizeUploadedData(
            uploadedFiles
          );


      setRawDepartments(
        normalized.departments
      );


      setVocList(
        normalized.vocList
      );


      setAnalysisScope({
        selectAll:
          true,

        selectedPeerGroups:
          [],

        selectedDepartmentIds:
          [],
      });


      /**
       * 새 파일 업로드 시
       * 이전 Feedback Sheet는 폐기
       */
      setFeedbackSheetData(
        null
      );

      setBatchFeedbackSheets(
        []
      );

      setBatchFeedbackState(
        null
      );

      setBatchFeedbackNotice(
        null
      );

      setBatchCompletionModalOpen(
        false
      );

      setFeedbackOpenedFromBatch(
        false
      );


      /**
       * 평가기간은 실제 업로드 데이터에서 탐지된 값만 사용합니다.
       * 기간을 확인하지 못한 경우 빈 문자열로 유지하며,
       * Header에서는 "업로드 데이터 기준"으로 표시합니다.
       */
      setCurrentPeriod(
        normalized.period || ""
      );


      /**
       * 현재 선택된 ID가
       * 새 데이터에도 존재하는지 확인
       */
      const selectedStillExists =
        normalized.departments.some(
          (
            department
          ) =>
            department.id ===
            selectedDeptId
        );


      if (
        normalized
          .departments.length >
          0 &&
        !selectedStillExists
      ) {

        setSelectedDeptId(
          normalized
            .departments[0]
            .id
        );
      }


      /**
       * 운영 로그에는
       * 환자 VOC 원문을 남기지 않음
       */
      console.info(
        `[CX] 데이터 정규화 완료 | 분석단위=${normalized.departments.length} | VOC=${normalized.vocList.length}`
      );

    } catch (error) {

      console.error(
        "[CX] 데이터 정규화 실패:",
        error instanceof Error
          ? error.message
          : error
      );


      setRawDepartments(
        []
      );

      setVocList([]);

      setSelectedDeptId("");

      setFeedbackSheetData(
        null
      );

      setBatchFeedbackSheets(
        []
      );

      setBatchFeedbackState(
        null
      );

      setBatchFeedbackNotice(
        null
      );

      setBatchCompletionModalOpen(
        false
      );

      setFeedbackOpenedFromBatch(
        false
      );


      setAiError(
        "업로드한 파일을 분석하는 과정에서 오류가 발생했습니다. 파일 형식을 확인해주세요."
      );
    }

  }, [
    uploadedFiles,
  ]);


  /**
   * ==========================================================
   * Normalize Comparison Period Files
   * ==========================================================
   *
   * 비교파일은 detectedPeriod 기준으로 묶어
   * 현재기간과 완전히 분리된 Dataset으로 정규화합니다.
   *
   * 평가기간을 탐지하지 못한 파일은
   * 다른 파일과 임의로 합치지 않고 개별 Dataset으로 취급합니다.
   */
  useEffect(() => {

    if (
      comparisonUploadedFiles.length ===
      0
    ) {
      setComparisonDatasets(
        []
      );

      if (
        resultWorkspaceTab ===
        "COMPARE"
      ) {
        setResultWorkspaceTab(
          "CURRENT"
        );
      }

      return;
    }


    try {

      const groupedFiles =
        new Map<
          string,
          UploadedFileMetadata[]
        >();


      comparisonUploadedFiles.forEach(
        (
          file
        ) => {

          const periodKey =
            file.detectedPeriod ||
            `UNDETECTED:${file.id}`;


          if (
            !groupedFiles.has(
              periodKey
            )
          ) {
            groupedFiles.set(
              periodKey,
              []
            );
          }


          groupedFiles
            .get(
              periodKey
            )!
            .push(
              file
            );
        }
      );


      const normalizedDatasets:
        PeriodDataset[] = [];


      groupedFiles.forEach(
        (
          files,
          periodKey
        ) => {

          const normalized =
            NormalizationService
              .normalizeUploadedData(
                files
              );


          normalizedDatasets.push({
            id:
              `comparison-${periodKey}`,

            mode:
              "COMPARISON",

            period:
              normalized.period ||
              (
                periodKey.startsWith(
                  "UNDETECTED:"
                )
                  ? ""
                  : periodKey
              ),

            uploadedFiles:
              files,

            departments:
              normalized.departments,

            vocList:
              normalized.vocList,
          });
        }
      );


      normalizedDatasets.sort(
        (
          a,
          b
        ) =>
          (
            a.period ||
            ""
          ).localeCompare(
            b.period ||
            ""
          )
      );


      setComparisonDatasets(
        normalizedDatasets
      );


      console.info(
        `[CX] 비교기간 Dataset 정규화 완료 | 기간=${normalizedDatasets.length}개`
      );

    } catch (
      error
    ) {

      console.error(
        "[CX] 비교기간 데이터 정규화 실패:",
        error instanceof Error
          ? error.message
          : error
      );


      setComparisonDatasets(
        []
      );


      setAiError(
        "비교기간 파일을 분석하는 과정에서 오류가 발생했습니다. 평가기간과 파일 형식을 확인해주세요."
      );
    }

  }, [
    comparisonUploadedFiles,
  ]);


  /**
   * 현재기간 + 비교기간 Dataset 목록
   *
   * 이후 기간 비교 화면에서는 이 배열만 사용하면 됩니다.
   */
  const periodDatasets =
    useMemo<
      PeriodDataset[]
    >(
      () => {

        const currentDataset:
          PeriodDataset | null =
            rawDepartments.length >
            0
              ? {
                  id:
                    `current-${currentPeriod || "undetected"}`,

                  mode:
                    "CURRENT",

                  period:
                    currentPeriod,

                  uploadedFiles,

                  departments:
                    rawDepartments,

                  vocList,
                }
              : null;


        return [
          ...(
            currentDataset
              ? [
                  currentDataset,
                ]
              : []
          ),

          ...comparisonDatasets,
        ];

      },
      [
        currentPeriod,
        uploadedFiles,
        rawDepartments,
        vocList,
        comparisonDatasets,
      ]
    );


  const hasPeriodComparison =
    periodDatasets.length >=
    2;


  /**
   * ==========================================================
   * Department Analysis
   * ==========================================================
   */

  const departments =
    useMemo(() => {

      if (
        rawDepartments.length ===
        0
      ) {
        return [];
      }


      return AnalysisEngine
        .calculateRankingsAndStatus(
          rawDepartments,
          criteria,
          analysisScope
        );

    }, [
      rawDepartments,
      criteria,
      analysisScope,
    ]);


  /**
   * ==========================================================
   * Vulnerable Departments
   * ==========================================================
   */

  const vulnerableDepartments =
    useMemo(() => {

      if (
        rawDepartments.length ===
        0
      ) {
        return [];
      }


      return AnalysisEngine
        .filterVulnerableDepartments(
          rawDepartments,
          criteria,
          analysisScope
        );

    }, [
      rawDepartments,
      criteria,
      analysisScope,
    ]);


  /**
   * ==========================================================
   * Dashboard Statistics
   * ==========================================================
   */

  const hospitalStats =
    useMemo(() => {

      return AnalysisEngine
        .calculateHospitalStats(
          departments
        );

    }, [
      departments,
    ]);


  /**
   * ==========================================================
   * Selected Department
   * ==========================================================
   */

  const selectedDepartment =
    useMemo(() => {

      if (
        departments.length ===
        0
      ) {
        return null;
      }


      return (
        departments.find(
          (
            department
          ) =>
            department.id ===
            selectedDeptId
        ) ||
        departments[0] ||
        null
      );

    }, [
      departments,
      selectedDeptId,
    ]);


  useEffect(() => {

    if (
      departments.length ===
      0
    ) {
      setSelectedDeptId(
        ""
      );

      return;
    }


    const selectedExists =
      departments.some(
        (
          department
        ) =>
          department.id ===
          selectedDeptId
      );


    if (
      !selectedExists
    ) {
      setSelectedDeptId(
        departments[0].id
      );
    }

  }, [
    departments,
    selectedDeptId,
  ]);


  /**
   * ==========================================================
   * File Handlers
   * ==========================================================
   */

  const handleAddUploadedFile =
    (
      fileMeta:
        UploadedFileMetadata,
      datasetMode:
        UploadDatasetMode =
          "CURRENT"
    ) => {

      if (
        datasetMode ===
        "COMPARISON"
      ) {

        setComparisonUploadedFiles(
          (
            previous
          ) => [
            fileMeta,
            ...previous,
          ]
        );

      } else {

        setUploadedFiles(
          (
            previous
          ) => [
            fileMeta,
            ...previous,
          ]
        );
      }


      setAiError(
        null
      );
    };


  const handleRemoveFile =
    (
      fileId: string
    ) => {

      setUploadedFiles(
        (
          previous
        ) =>
          previous.filter(
            (
              file
            ) =>
              file.id !==
              fileId
          )
      );


      setAiError(
        null
      );
    };


  const handleRemoveComparisonFile =
    (
      fileId:
        string
    ) => {

      setComparisonUploadedFiles(
        (
          previous
        ) =>
          previous.filter(
            (
              file
            ) =>
              file.id !==
              fileId
          )
      );


      setAiError(
        null
      );
    };


  /**
   * ==========================================================
   * Upload Navigation
   * ==========================================================
   */

  const handleOpenUpload =
    () => {

      setAiError(
        null
      );

      setActiveMenu(
        "upload"
      );
    };


  /**
   * ==========================================================
   * Department Selection
   * ==========================================================
   */

  const handleSelectDepartment =
    (
      deptId: string
    ) => {

      setSelectedDeptId(
        deptId
      );

      setActiveMenu(
        "detail"
      );


      /**
       * 다른 부서를 선택하면
       * 이전 AI 오류 메시지 제거
       */
      setAiError(
        null
      );
    };


  /**
   * ==========================================================
   * Feedback Sheet Generation
   * ==========================================================
   */

  const handleGenerateFeedbackSheet =
    async (
      targetDept:
        DepartmentSummary
    ) => {

      /**
       * 중복 실행 방지
       */
      if (isAnalyzing) {
        return;
      }


      if (!targetDept) {

        setAiError(
          "분석할 대상을 선택해주세요."
        );

        return;
      }


      /**
       * 기존 결과를 성공 전에
       * 새 결과처럼 보여주지 않도록 제거
       */
      setFeedbackSheetData(
        null
      );

      setFeedbackOpenedFromBatch(
        false
      );


      setSelectedDeptId(
        targetDept.id
      );


      setAiError(
        null
      );


      setIsAnalyzing(
        true
      );


      setAiStep(1);

      setAiPercent(0);

      setAiMessage(
        "AI 분석을 준비하고 있습니다..."
      );


      try {

        const generatedSheet =
          await aiOrchestrator
            .generateFullFeedbackSheet(
              targetDept,
              AnalysisEngine
                .calculateRankingsAndStatus(
                  rawDepartments,
                  criteria
                ),
              vocList,

              (
                step,
                message,
                percent
              ) => {

                setAiStep(
                  step
                );

                setAiMessage(
                  message
                );

                setAiPercent(
                  percent
                );
              }
            );


        /**
         * 빈 결과 방지
         */
        if (
          !generatedSheet
        ) {
          throw new Error(
            "EMPTY_FEEDBACK_SHEET"
          );
        }


        /**
         * 성공한 경우에만
         * Feedback 화면으로 이동
         */
        setFeedbackSheetData(
          generatedSheet
        );


        setAiStep(8);

        setAiPercent(100);

        setAiMessage(
          "CX Feedback Sheet 생성이 완료되었습니다."
        );


        setIsAnalyzing(
          false
        );


        setActiveMenu(
          "feedback"
        );

      } catch (error) {

        console.error(
          "[CX AI] Feedback Sheet 생성 실패:",
          error instanceof Error
            ? error.message
            : "Unknown error"
        );


        setIsAnalyzing(
          false
        );


        /**
         * 실패한 경우
         * Feedback 화면으로 이동하지 않음
         */
        setFeedbackSheetData(
          null
        );


        /**
         * 인증 세션 만료
         */
        if (
          error instanceof
            Error &&
          error.message ===
            "UNAUTHORIZED"
        ) {

          setAuthenticated(
            false
          );


          setAiError(
            null
          );


          return;
        }


        /**
         * 현재 분석 화면을 유지
         */
        setActiveMenu(
          "detail"
        );


        setAiError(
          "AI 분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의해주세요."
        );
      }
    };


  /**
   * ==========================================================
   * Results Workspace Navigation
   * ==========================================================
   *
   * 일괄 생성 완료 직후 결과 영역이 현재 스크롤 위치 위쪽에
   * 삽입되더라도 사용자가 즉시 볼 수 있도록 현재 결과 화면으로
   * 이동하고 메인 스크롤을 맨 위로 올립니다.
   */
  const focusCurrentResults =
    () => {

      setResultWorkspaceTab(
        "CURRENT"
      );


      setActiveMenu(
        "vulnerable"
      );


      window.requestAnimationFrame(
        () => {

          window.requestAnimationFrame(
            () => {

              mainScrollRef.current
                ?.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
            }
          );
        }
      );
    };


  /**
   * ==========================================================
   * Batch Feedback Sheet Generation
   * ==========================================================
   *
   * 선택한 분석단위를 순차적으로 처리합니다.
   *
   * 이유:
   * - 동시에 여러 AI 요청을 보내 서버/모델 호출이 폭주하는 것을 방지
   * - 각 분석단위별 성공/실패 상태를 독립적으로 추적
   * - 일부 실패가 발생해도 나머지 분석은 계속 진행
   */
  const handleGenerateBatchFeedbackSheets =
    async (
      targetDepartments:
        DepartmentSummary[]
    ) => {

      if (
        isAnalyzing
      ) {
        return;
      }


      const uniqueTargets =
        Array.from(
          new Map(
            (
              Array.isArray(
                targetDepartments
              )
                ? targetDepartments
                : []
            ).map(
              (
                department
              ) => [
                department.id,
                department,
              ]
            )
          ).values()
        );


      if (
        uniqueTargets.length ===
        0
      ) {

        setAiError(
          "Feedback Sheet를 생성할 분석대상을 1개 이상 선택해주세요."
        );

        return;
      }


      /**
       * Benchmark / Peer 비교는 분석범위에 의해 모집단이 줄어들면 안 되므로
       * 전체 원본 분석단위를 기준으로 한 평가 결과를 한 번만 계산해 재사용합니다.
       */
      const fullPeerDepartments =
        AnalysisEngine
          .calculateRankingsAndStatus(
            rawDepartments,
            criteria
          );


      const initialItems:
        BatchFeedbackGenerationItem[] =
          uniqueTargets.map(
            (
              department
            ) => ({
              departmentId:
                department.id,

              departmentName:
                department.displayName ||
                department.name,

              peerGroup:
                department.peerGroup,

              peerGroupLabel:
                department.peerGroupLabel ||
                department.type,

              status:
                "PENDING",
            })
          );


      setBatchFeedbackSheets(
        []
      );


      setBatchFeedbackState({
        totalCount:
          uniqueTargets.length,

        completedCount:
          0,

        successCount:
          0,

        failedCount:
          0,

        items:
          initialItems,
      });


      setBatchFeedbackNotice(
        null
      );

      setBatchCompletionModalOpen(
        false
      );


      setAiError(
        null
      );


      setIsAnalyzing(
        true
      );


      setAiStep(
        1
      );


      setAiPercent(
        0
      );


      setAiMessage(
        `Feedback Sheet 일괄 생성을 시작합니다. (0/${uniqueTargets.length})`
      );


      const successfulSheets:
        CXFeedbackSheetData[] =
          [];


      let successCount =
        0;


      let failedCount =
        0;


      try {

        for (
          let index = 0;
          index <
            uniqueTargets.length;
          index += 1
        ) {

          const targetDept =
            uniqueTargets[index];


          /**
           * 현재 항목을 GENERATING으로 표시
           */
          setBatchFeedbackState(
            (
              previous
            ) => {

              if (
                !previous
              ) {
                return previous;
              }


              return {
                ...previous,

                items:
                  previous.items.map(
                    (
                      item
                    ) =>
                      item.departmentId ===
                        targetDept.id
                        ? {
                            ...item,
                            status:
                              "GENERATING",
                          }
                        : item
                  ),
              };
            }
          );


          setAiMessage(
            `[${index + 1}/${uniqueTargets.length}] ${targetDept.displayName || targetDept.name} Feedback Sheet 생성 중...`
          );


          try {

            const generatedSheet =
              await aiOrchestrator
                .generateFullFeedbackSheet(
                  targetDept,
                  fullPeerDepartments,
                  vocList,

                  (
                    step,
                    message,
                    percent
                  ) => {

                    setAiStep(
                      step
                    );


                    /**
                     * 개별 Sheet 진행률을 전체 Batch 진행률로 환산합니다.
                     */
                    const currentFraction =
                      Math.max(
                        0,
                        Math.min(
                          100,
                          Number.isFinite(
                            percent
                          )
                            ? percent
                            : 0
                        )
                      ) /
                      100;


                    const overallPercent =
                      (
                        (
                          index +
                          currentFraction
                        ) /
                        uniqueTargets.length
                      ) *
                      100;


                    setAiPercent(
                      Math.max(
                        0,
                        Math.min(
                          99,
                          Math.round(
                            overallPercent
                          )
                        )
                      )
                    );


                    setAiMessage(
                      `[${index + 1}/${uniqueTargets.length}] ${targetDept.displayName || targetDept.name} · ${message}`
                    );
                  }
                );


            if (
              !generatedSheet
            ) {
              throw new Error(
                "EMPTY_FEEDBACK_SHEET"
              );
            }


            successfulSheets.push(
              generatedSheet
            );


            successCount +=
              1;


            setBatchFeedbackSheets(
              [
                ...successfulSheets,
              ]
            );


            setBatchFeedbackState(
              (
                previous
              ) => {

                if (
                  !previous
                ) {
                  return previous;
                }


                return {
                  ...previous,

                  completedCount:
                    index + 1,

                  successCount,

                  failedCount,

                  items:
                    previous.items.map(
                      (
                        item
                      ) =>
                        item.departmentId ===
                          targetDept.id
                          ? {
                              ...item,

                              status:
                                "SUCCESS",

                              sheetData:
                                generatedSheet,

                              errorMessage:
                                undefined,
                            }
                          : item
                    ),
                };
              }
            );

          } catch (
            error
          ) {

            if (
              error instanceof
                Error &&
              error.message ===
                "UNAUTHORIZED"
            ) {

              setAuthenticated(
                false
              );


              setAiError(
                null
              );


              setIsAnalyzing(
                false
              );


              return;
            }


            failedCount +=
              1;


            const errorMessage =
              error instanceof
                Error
                ? error.message
                : "UNKNOWN_ERROR";


            console.error(
              `[CX AI] Batch Feedback Sheet 생성 실패 | department=${targetDept.id}:`,
              errorMessage
            );


            setBatchFeedbackState(
              (
                previous
              ) => {

                if (
                  !previous
                ) {
                  return previous;
                }


                return {
                  ...previous,

                  completedCount:
                    index + 1,

                  successCount,

                  failedCount,

                  items:
                    previous.items.map(
                      (
                        item
                      ) =>
                        item.departmentId ===
                          targetDept.id
                          ? {
                              ...item,

                              status:
                                "FAILED",

                              errorMessage:
                                "AI 분석을 완료하지 못했습니다.",
                            }
                          : item
                    ),
                };
              }
            );
          }


          /**
           * 한 분석단위가 끝날 때마다 전체 진행률 보정
           */
          setAiPercent(
            Math.round(
              (
                (
                  index +
                  1
                ) /
                uniqueTargets.length
              ) *
              100
            )
          );
        }


        setAiStep(
          8
        );


        setAiPercent(
          100
        );


        setAiMessage(
          `Feedback Sheet 일괄 생성 완료 · 성공 ${successCount}건 / 실패 ${failedCount}건`
        );


        setBatchFeedbackNotice(
          failedCount >
            0
            ? `Feedback Sheet ${successCount}건 생성 완료 · ${failedCount}건 실패`
            : `Feedback Sheet ${successCount}건이 모두 생성되었습니다.`
        );


        setBatchCompletionModalOpen(
          true
        );


        focusCurrentResults();


        /**
         * 성공 결과 중 첫 번째 Sheet를 현재 Sheet로도 보관합니다.
         * 다만 사용자를 강제로 Feedback 화면으로 이동시키지는 않습니다.
         * 현재 결과 화면에서 이후 일괄 다운로드 작업을 이어갈 수 있습니다.
         */
        if (
          successfulSheets.length >
          0
        ) {

          setFeedbackSheetData(
            successfulSheets[0]
          );
        }

      } finally {

        setIsAnalyzing(
          false
        );
      }
    };


  /**
   * ==========================================================
   * Open Batch Feedback Sheet
   * ==========================================================
   *
   * 일괄 생성 결과 목록에서 개별 Feedback Sheet를 열 때 사용합니다.
   * 이미 생성된 Sheet를 다시 AI 호출하지 않고 그대로 화면에 표시합니다.
   */
  const handleOpenBatchFeedbackSheet =
    (
      sheet:
        CXFeedbackSheetData
    ) => {

      setFeedbackSheetData(
        sheet
      );

      setFeedbackOpenedFromBatch(
        true
      );


      setSelectedDeptId(
        sheet.departmentId
      );


      setAiError(
        null
      );


      setActiveMenu(
        "feedback"
      );
    };


  /**
   * ==========================================================
   * Back To Batch Feedback Results
   * ==========================================================
   *
   * 일괄 생성 결과에서 개별 Sheet를 확인한 뒤,
   * 생성 결과 목록이 있는 현재 결과 화면으로 돌아갑니다.
   * 생성된 Sheet 데이터와 일괄 생성 상태는 그대로 유지합니다.
   */
  const handleBackToBatchFeedbackResults =
    () => {

      setFeedbackOpenedFromBatch(
        false
      );


      focusCurrentResults();


      setAiError(
        null
      );
    };


  /**
   * ==========================================================
   * Batch Completion Modal
   * ==========================================================
   */
  const handleConfirmBatchCompletion =
    () => {

      setBatchCompletionModalOpen(
        false
      );


      focusCurrentResults();


      setAiError(
        null
      );
    };


  /**
   * ==========================================================
   * Feedback / Ward Excel Download
   * ==========================================================
   */

  const handleDownloadBatchFeedbackExcel =
    () => {

      if (
        batchFeedbackSheets.length ===
        0
      ) {

        setAiError(
          "먼저 Feedback Sheet를 1건 이상 일괄 생성해주세요."
        );

        return;
      }


      try {

        ExcelService
          .exportBatchFeedbackSheetsToExcel(
            batchFeedbackSheets
          );


        setAiError(
          null
        );

      } catch (
        error
      ) {

        console.error(
          "[CX] 일괄 Feedback Excel 다운로드 실패:",
          error instanceof Error
            ? error.message
            : error
        );


        setAiError(
          "일괄 Feedback Excel 파일을 생성하지 못했습니다."
        );
      }
    };


  const handleDownloadWardTeamExcel =
    () => {

      if (
        rawDepartments.length ===
        0
      ) {

        setAiError(
          "먼저 설문결과 Excel 파일을 업로드해주세요."
        );

        return;
      }


      try {

        const wardReportData =
          AnalysisEngine
            .buildWardTeamExcelReportData(
              rawDepartments,
              criteria,
              currentPeriod,
              batchFeedbackSheets
            );


        if (
          wardReportData.rows.length ===
          0
        ) {

          setAiError(
            "병동간호 1팀·2팀에 해당하는 입원 병동 데이터를 찾지 못했습니다."
          );

          return;
        }


        ExcelService
          .exportWardTeamIntegratedReportToExcel(
            wardReportData
          );


        setAiError(
          null
        );

      } catch (
        error
      ) {

        console.error(
          "[CX] 병동간호 1·2팀 종합 Excel 다운로드 실패:",
          error instanceof Error
            ? error.message
            : error
        );


        setAiError(
          "병동간호 1·2팀 종합 Excel 파일을 생성하지 못했습니다."
        );
      }
    };


  /**
   * ==========================================================
   * Open Feedback Sheet From History
   * ==========================================================
   *
   * 저장된 JSON 이력의 Feedback Sheet를
   * 현재 Feedback 화면으로 다시 엽니다.
   *
   * 과거 이력을 여는 것이므로
   * 현재 업로드 Dataset이나 현재 분석결과는 변경하지 않습니다.
   */
  const handleOpenHistoryFeedbackSheet =
    (
      sheet:
        CXFeedbackSheetData
    ) => {

      setFeedbackSheetData(
        sheet
      );

      setFeedbackOpenedFromBatch(
        false
      );


      setSelectedDeptId(
        sheet.departmentId
      );


      setAiError(
        null
      );


      setActiveMenu(
        "feedback"
      );
    };


  /**
   * ==========================================================
   * Full Analysis
   * ==========================================================
   *
   * 현재 구조에서는 선택된 분석단위에 대해
   * Feedback Sheet를 생성합니다.
   */

  const handleRunFullAnalysis =
    async () => {

      if (
        departments.length ===
        0
      ) {

        setAiError(
          "먼저 설문결과 Excel 파일을 업로드해주세요."
        );

        setActiveMenu(
          "upload"
        );

        return;
      }


      const target =
        selectedDepartment ||
        departments[0];


      if (target) {

        await handleGenerateFeedbackSheet(
          target
        );
      }
    };


  /**
   * ==========================================================
   * Authentication Loading
   * ==========================================================
   */

  if (
    authenticated === null
  ) {

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA]">

        <div className="flex items-center gap-2 text-sm font-bold text-[#243B53]">

          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#243B53] border-t-transparent" />

          <span>
            보안 세션 확인 중...
          </span>

        </div>

      </div>
    );
  }


  /**
   * ==========================================================
   * Login
   * ==========================================================
   */

  if (
    authenticated === false
  ) {

    return (
      <LoginView
        onLoginSuccess={() => {

          setAuthenticated(
            true
          );

          setAiError(
            null
          );
        }}
      />
    );
  }


  /**
   * ==========================================================
   * Main UI
   * ==========================================================
   */

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">

      {/* =====================================================
          Sidebar
      ====================================================== */}

      <Sidebar
        activeMenu={
          activeMenu
        }

        onSelectMenu={
          (
            menu
          ) => {

            setActiveMenu(
              menu
            );

            setAiError(
              null
            );
          }
        }

        vulnerableCount={
          vulnerableDepartments.length
        }

        totalDepts={
          departments.length
        }

        onLogout={
          handleLogout
        }
      />


      {/* =====================================================
          Main Workspace
      ====================================================== */}

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* ===================================================
            Header
        ==================================================== */}

        <Header
          currentPeriod={
            currentPeriod
          }

          onOpenUpload={
            handleOpenUpload
          }

          onRunFullAnalysis={
            handleRunFullAnalysis
          }

          isAnalyzing={
            isAnalyzing
          }

          activeMenu={
            activeMenu
          }

          hasData={
            departments.length > 0
          }

          onOpenPrivacyModal={() =>
            setPrivacyModalOpen(
              true
            )
          }
        />


        {/* ===================================================
            Process Stepper
        ==================================================== */}

        <ProcessStepper
          activeMenu={
            activeMenu
          }

          onSelectMenu={
            (
              menu
            ) => {

              setActiveMenu(
                menu
              );

              setAiError(
                null
              );
            }
          }
        />


        {/* ===================================================
            Main Content
        ==================================================== */}

        <main
          ref={
            mainScrollRef
          }
          className="flex-1 overflow-y-auto p-6"
        >

          <div className="mx-auto max-w-7xl">

            {/* ===============================================
                Error Banner
            ================================================ */}

            {aiError && (
              <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-[#F6D3D3] bg-[#FDF2F2] px-4 py-3">

                <div className="flex items-start gap-2">

                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B94A48]" />

                  <div>

                    <div className="text-xs font-bold text-[#8E3533]">
                      처리 중 문제가 발생했습니다.
                    </div>

                    <div className="mt-0.5 text-xs leading-relaxed text-[#B94A48]">
                      {aiError}
                    </div>

                  </div>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setAiError(
                      null
                    )
                  }
                  className="shrink-0 rounded-md p-1 text-[#B94A48] hover:bg-[#F6D3D3]"
                  aria-label="오류 메시지 닫기"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>
            )}


            {batchFeedbackNotice && (

              <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-[#CFE3D8] bg-[#F2F8F5] px-4 py-3">

                <div className="flex items-start gap-2">

                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2E7D5B]" />


                  <div>

                    <div className="text-xs font-bold text-[#225E46]">
                      Feedback Sheet 일괄 생성 결과
                    </div>


                    <div className="mt-0.5 text-xs leading-relaxed text-[#2E7D5B]">
                      {batchFeedbackNotice}

                      {batchFeedbackState && (
                        <>
                          {" · "}
                          현재 메모리에 저장된 Sheet {batchFeedbackSheets.length}건
                        </>
                      )}
                    </div>

                  </div>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setBatchFeedbackNotice(
                      null
                    )
                  }
                  className="shrink-0 rounded-md p-1 text-[#2E7D5B] hover:bg-[#DCEFE4]"
                  aria-label="일괄 생성 결과 닫기"
                >
                  <X className="h-4 w-4" />
                </button>

              </div>
            )}


            {/* ===============================================
                Dashboard
            ================================================ */}

            {activeMenu ===
              "dashboard" && (
              <DashboardView
                departments={
                  departments
                }

                vulnerableDepartments={
                  vulnerableDepartments
                }

                vocList={
                  vocList
                }

                hospitalAvg={
                  hospitalStats.hospitalAvg
                }

                scoreChangeAvg={
                  hospitalStats.scoreChangeAvg
                }

                onSelectDepartment={
                  handleSelectDepartment
                }

                onNavigate={
                  (
                    menu
                  ) =>
                    setActiveMenu(
                      menu
                    )
                }
              />
            )}


            {/* ===============================================
                Upload
            ================================================ */}

            {activeMenu ===
              "upload" && (
              <DataUploadView
                uploadedFiles={
                  uploadedFiles
                }

                comparisonUploadedFiles={
                  comparisonUploadedFiles
                }

                onAddUploadedFile={
                  handleAddUploadedFile
                }

                onRemoveFile={
                  handleRemoveFile
                }

                onRemoveComparisonFile={
                  handleRemoveComparisonFile
                }

                onProceedToCriteria={() =>
                  setActiveMenu(
                    "criteria"
                  )
                }

                departments={
                  AnalysisEngine
                    .calculateRankingsAndStatus(
                      rawDepartments,
                      criteria
                    )
                }

                departmentsCount={
                  rawDepartments.length
                }

                vocCount={
                  vocList.length
                }
              />
            )}


            {/* ===============================================
                Criteria
            ================================================ */}

            {activeMenu ===
              "criteria" && (
              <CriteriaView
                criteria={
                  criteria
                }

                onUpdateCriteria={
                  setCriteria
                }

                departments={
                  AnalysisEngine
                    .calculateRankingsAndStatus(
                      rawDepartments,
                      criteria
                    )
                }

                analysisScope={
                  analysisScope
                }

                onUpdateAnalysisScope={
                  setAnalysisScope
                }

                vulnerableCount={
                  vulnerableDepartments.length
                }

                onProceedToVulnerableList={() => {
                  setResultWorkspaceTab(
                    "CURRENT"
                  );

                  setActiveMenu(
                    "vulnerable"
                  );
                }}
              />
            )}


            {/* ===============================================
                Results Workspace
            ================================================ */}

            {activeMenu ===
              "vulnerable" && (

              <div className="space-y-5">

                {/* =============================================
                    상위 결과 탭
                ============================================== */}

                <div className="rounded-xl border border-[#E2E8F0] bg-white p-2 shadow-2xs">

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">

                    <button
                      type="button"
                      onClick={() =>
                        setResultWorkspaceTab(
                          "CURRENT"
                        )
                      }
                      className={`flex min-w-[150px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
                        resultWorkspaceTab ===
                        "CURRENT"
                          ? "bg-[#243B53] text-white shadow-xs"
                          : "text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#243B53]"
                      }`}
                    >

                      <LayoutDashboard className="h-4 w-4" />

                      현재 결과

                    </button>


                    <button
                      type="button"
                      disabled={
                        !hasPeriodComparison
                      }
                      title={
                        hasPeriodComparison
                          ? "등록된 분석기간을 비교합니다."
                          : "현재기간과 비교기간을 합해 2개 이상의 Dataset이 필요합니다."
                      }
                      onClick={() =>
                        setResultWorkspaceTab(
                          "COMPARE"
                        )
                      }
                      className={`flex min-w-[150px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
                        !hasPeriodComparison
                          ? "cursor-not-allowed text-[#94A3B8] opacity-70"
                          : resultWorkspaceTab ===
                            "COMPARE"
                          ? "bg-[#243B53] text-white shadow-xs"
                          : "text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#243B53]"
                      }`}
                    >

                      <CalendarRange className="h-4 w-4" />

                      기간 비교

                      {!hasPeriodComparison && (

                        <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[9px] font-bold text-[#94A3B8]">
                          2개 기간 필요
                        </span>
                      )}

                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setResultWorkspaceTab(
                          "HISTORY"
                        )
                      }
                      className={`flex min-w-[150px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
                        resultWorkspaceTab ===
                        "HISTORY"
                          ? "bg-[#243B53] text-white shadow-xs"
                          : "text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#243B53]"
                      }`}
                    >

                      <History className="h-4 w-4" />

                      피드백 이력

                    </button>

                  </div>

                </div>


                {/* =============================================
                    현재 결과
                ============================================== */}

                {resultWorkspaceTab ===
                  "CURRENT" && (

                  <>

                    <div className="mb-4 rounded-xl border border-[#D9E1EA] bg-white p-4 shadow-2xs">

                      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">

                        <div>

                          <div className="flex items-center gap-2">

                            <FileSpreadsheet className="h-4 w-4 text-[#243B53]" />

                            <h3 className="text-xs font-bold text-[#1E293B]">
                              분석결과 Excel 다운로드
                            </h3>

                          </div>


                          <p className="mt-1 text-[10px] leading-relaxed text-[#64748B]">
                            생성된 Feedback Sheet 일괄보고서와 병동간호 1·2팀 종합현황을 Excel로 내려받을 수 있습니다.
                          </p>

                        </div>


                        <div className="flex flex-wrap items-center gap-2">

                          <button
                            type="button"
                            onClick={
                              handleDownloadBatchFeedbackExcel
                            }
                            disabled={
                              batchFeedbackSheets.length ===
                              0
                            }
                            title={
                              batchFeedbackSheets.length >
                              0
                                ? `생성된 Feedback Sheet ${batchFeedbackSheets.length}건을 하나의 Excel로 다운로드합니다.`
                                : "먼저 분석대상을 선택해 Feedback Sheet를 일괄 생성해주세요."
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E1EA] bg-white px-3.5 py-2 text-[11px] font-bold text-[#334155] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
                          >

                            <Download className="h-3.5 w-3.5" />

                            Feedback 일괄 Excel

                            {batchFeedbackSheets.length >
                              0 && (

                              <span className="rounded bg-[#ECF2F7] px-1.5 py-0.5 text-[9px] font-bold text-[#243B53]">
                                {batchFeedbackSheets.length}건
                              </span>
                            )}

                          </button>


                          <button
                            type="button"
                            onClick={
                              handleDownloadWardTeamExcel
                            }
                            disabled={
                              rawDepartments.length ===
                              0
                            }
                            title="병동간호 1팀·2팀 병동별 종합점수, 팀 내 순위, 최저 영역 및 생성된 Feedback 내용을 함께 다운로드합니다."
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#243B53] px-3.5 py-2 text-[11px] font-bold text-white shadow-xs hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:opacity-40"
                          >

                            <FileSpreadsheet className="h-3.5 w-3.5" />

                            병동 1·2팀 종합 Excel

                          </button>

                        </div>

                      </div>

                    </div>


                    {batchFeedbackState && (

                      <div className="mb-4 rounded-xl border border-[#D9E1EA] bg-white p-4 shadow-2xs">

                        <div className="flex flex-col justify-between gap-3 border-b border-[#EEF1F4] pb-3 sm:flex-row sm:items-center">

                          <div>

                            <div className="flex items-center gap-2">

                              <CheckCircle2 className="h-4 w-4 text-[#2E7D5B]" />

                              <h3 className="text-xs font-bold text-[#1E293B]">
                                일괄 생성 결과
                              </h3>

                              <span className="rounded-md bg-[#ECF2F7] px-2 py-0.5 text-[10px] font-bold text-[#243B53]">
                                성공 {batchFeedbackState.successCount}건
                              </span>

                              {batchFeedbackState.failedCount > 0 && (

                                <span className="rounded-md bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-bold text-[#B94A48]">
                                  실패 {batchFeedbackState.failedCount}건
                                </span>
                              )}

                            </div>


                            <p className="mt-1 text-[10px] leading-relaxed text-[#64748B]">
                              생성된 Feedback Sheet를 앱에서 바로 열어 확인할 수 있습니다. 보기 버튼을 눌러도 AI를 다시 실행하지 않습니다.
                            </p>

                          </div>


                          {batchFeedbackSheets.length > 0 && (

                            <button
                              type="button"
                              onClick={
                                handleDownloadBatchFeedbackExcel
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D9E1EA] bg-white px-3 py-2 text-[11px] font-bold text-[#334155] hover:bg-[#F8F9FA]"
                            >

                              <Download className="h-3.5 w-3.5" />

                              전체 Excel

                            </button>
                          )}

                        </div>


                        <div className="mt-3 grid gap-2">

                          {batchFeedbackState.items.map(
                            (
                              item
                            ) => {

                              const generatedSheet =
                                item.sheetData ||
                                batchFeedbackSheets.find(
                                  (
                                    sheet
                                  ) =>
                                    sheet.departmentId ===
                                    item.departmentId
                                );


                              const isSuccess =
                                item.status ===
                                "SUCCESS" &&
                                Boolean(
                                  generatedSheet
                                );


                              return (

                                <div
                                  key={
                                    item.departmentId
                                  }
                                  className="flex flex-col justify-between gap-3 rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] px-3 py-2.5 sm:flex-row sm:items-center"
                                >

                                  <div className="min-w-0">

                                    <div className="flex flex-wrap items-center gap-2">

                                      <span className="truncate text-xs font-bold text-[#1E293B]">
                                        {item.departmentName}
                                      </span>


                                      <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#64748B]">
                                        {item.peerGroupLabel}
                                      </span>


                                      {item.status ===
                                      "SUCCESS" ? (

                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2E7D5B]">
                                          <CheckCircle2 className="h-3 w-3" />
                                          생성 완료
                                        </span>

                                      ) : item.status ===
                                        "FAILED" ? (

                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#B94A48]">
                                          <AlertCircle className="h-3 w-3" />
                                          생성 실패
                                        </span>

                                      ) : item.status ===
                                        "GENERATING" ? (

                                        <span className="text-[10px] font-bold text-[#8C5E1E]">
                                          생성 중
                                        </span>

                                      ) : (

                                        <span className="text-[10px] font-semibold text-[#94A3B8]">
                                          대기
                                        </span>
                                      )}

                                    </div>


                                    {item.errorMessage && (

                                      <div className="mt-1 text-[10px] text-[#B94A48]">
                                        {item.errorMessage}
                                      </div>
                                    )}

                                  </div>


                                  <button
                                    type="button"
                                    disabled={
                                      !isSuccess ||
                                      !generatedSheet
                                    }
                                    onClick={() => {

                                      if (
                                        generatedSheet
                                      ) {
                                        handleOpenBatchFeedbackSheet(
                                          generatedSheet
                                        );
                                      }
                                    }}
                                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#D9E1EA] bg-white px-3 py-1.5 text-[11px] font-bold text-[#243B53] hover:bg-[#ECF2F7] disabled:cursor-not-allowed disabled:opacity-40"
                                  >

                                    <Eye className="h-3.5 w-3.5" />

                                    보기

                                  </button>

                                </div>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}


                    <VulnerableListView
                    allDepartments={
                      departments
                    }

                    vulnerableDepartments={
                      vulnerableDepartments
                    }

                    hospitalAvg={
                      hospitalStats.hospitalAvg
                    }

                    onSelectDepartment={
                      handleSelectDepartment
                    }

                    onGenerateFeedbackSheet={
                      handleGenerateFeedbackSheet
                    }

                    onGenerateBatchFeedbackSheets={
                      handleGenerateBatchFeedbackSheets
                    }
                  />

                  </>
                )}


                {/* =============================================
                    기간 비교
                ============================================== */}

                {resultWorkspaceTab ===
                  "COMPARE" && (

                  <PeriodComparisonView
                    datasets={
                      periodDatasets
                    }

                    criteria={
                      criteria
                    }
                  />
                )}


                {/* =============================================
                    피드백 이력
                ============================================== */}

                {resultWorkspaceTab ===
                  "HISTORY" && (

                  <FeedbackHistoryView
                    onOpenFeedbackSheet={
                      handleOpenHistoryFeedbackSheet
                    }
                  />
                )}

              </div>
            )}


            {/* ===============================================
                History Management
            ================================================ */}

            {activeMenu ===
              "history" && (

              <FeedbackHistoryView
                onOpenFeedbackSheet={
                  handleOpenHistoryFeedbackSheet
                }
              />
            )}


            {/* ===============================================
                Department Detail
            ================================================ */}

            {activeMenu ===
              "detail" &&
              selectedDepartment && (
              <DepartmentDetailView
                department={
                  selectedDepartment
                }

                allDepartments={
                  departments
                }

                vocList={
                  vocList
                }

                hospitalAvg={
                  hospitalStats.hospitalAvg
                }

                onGenerateFeedbackSheet={
                  handleGenerateFeedbackSheet
                }

                onSelectDepartment={
                  setSelectedDeptId
                }

                isAiAnalyzing={
                  isAnalyzing
                }
              />
            )}


            {/* ===============================================
                Benchmark
            ================================================ */}

            {activeMenu ===
              "benchmark" && (
              <BenchmarkView
                departments={
                  departments
                }

                hospitalAvg={
                  hospitalStats.hospitalAvg
                }

                selectedDeptId={
                  selectedDeptId
                }

                onSelectDeptId={
                  setSelectedDeptId
                }
              />
            )}


            {/* ===============================================
                Feedback Sheet
            ================================================ */}

            {activeMenu ===
              "feedback" && (
              <FeedbackSheetView
                sheetData={
                  feedbackSheetData
                }

                onUpdateSheetData={
                  (
                    updated
                  ) =>
                    setFeedbackSheetData(
                      updated
                    )
                }

                onBackToBatchResults={
                  feedbackOpenedFromBatch
                    ? handleBackToBatchFeedbackResults
                    : undefined
                }

                onSelectAnotherDept={() => {

                  setFeedbackOpenedFromBatch(
                    false
                  );

                  setFeedbackSheetData(
                    null
                  );

                  setActiveMenu(
                    "vulnerable"
                  );
                }}
              />
            )}


          </div>

        </main>

      </div>


      {/* =====================================================
          Batch Completion Modal
      ====================================================== */}

      <Modal
        isOpen={
          batchCompletionModalOpen
        }
        onClose={() =>
          setBatchCompletionModalOpen(
            false
          )
        }
        title="Feedback Sheet 일괄 생성 완료"
        maxWidth="lg"
      >

        <div className="space-y-4">

          <div className="rounded-xl border border-[#CFE3D8] bg-[#F2F8F5] p-4">

            <div className="flex items-start gap-3">

              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2E7D5B] shadow-xs">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">

                <div className="text-sm font-bold text-[#225E46]">
                  일괄 생성이 완료되었습니다.
                </div>

                <div className="mt-1 text-xs leading-relaxed text-[#2E7D5B]">
                  성공 {batchFeedbackState?.successCount ?? batchFeedbackSheets.length}건
                  {" · "}
                  실패 {batchFeedbackState?.failedCount ?? 0}건
                </div>

                <div className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                  아래 결과는 현재 화면의 일괄 생성 결과 영역에서도 계속 확인할 수 있습니다.
                </div>

              </div>

            </div>

          </div>


          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">

            {(batchFeedbackState?.items || []).map(
              (
                item
              ) => (

                <div
                  key={
                    item.departmentId
                  }
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] px-3 py-2.5"
                >

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="truncate text-xs font-bold text-[#1E293B]">
                        {item.departmentName}
                      </span>

                      <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#64748B]">
                        {item.peerGroupLabel}
                      </span>

                    </div>

                  </div>


                  {item.status ===
                  "SUCCESS" ? (

                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#2E7D5B]">
                      <CheckCircle2 className="h-3 w-3" />
                      생성 완료
                    </span>

                  ) : item.status ===
                    "FAILED" ? (

                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#B94A48]">
                      <AlertCircle className="h-3 w-3" />
                      생성 실패
                    </span>

                  ) : (

                    <span className="shrink-0 text-[10px] font-semibold text-[#64748B]">
                      {item.status ===
                      "GENERATING"
                        ? "생성 중"
                        : "대기"}
                    </span>
                  )}

                </div>
              )
            )}

          </div>


          <div className="flex flex-col-reverse gap-2 border-t border-[#EEF1F4] pt-4 sm:flex-row sm:justify-end">

            <button
              type="button"
              onClick={() =>
                setBatchCompletionModalOpen(
                  false
                )
              }
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#F8F9FA]"
            >
              닫기
            </button>


            <button
              type="button"
              onClick={
                handleDownloadBatchFeedbackExcel
              }
              disabled={
                batchFeedbackSheets.length ===
                0
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D9E1EA] bg-white px-4 py-2 text-xs font-bold text-[#334155] hover:bg-[#F8F9FA] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              전체 Excel
            </button>


            <button
              type="button"
              onClick={
                handleConfirmBatchCompletion
              }
              className="rounded-lg bg-[#243B53] px-4 py-2 text-xs font-bold text-white hover:bg-[#1B2F44]"
            >
              결과 확인
            </button>

          </div>

        </div>

      </Modal>


      {/* =====================================================
          AI Progress Modal
      ====================================================== */}

      <AIAnalysisModal
        isOpen={
          isAnalyzing
        }

        currentStep={
          aiStep
        }

        stepMessage={
          aiMessage
        }

        progressPercent={
          aiPercent
        }
      />


      {/* =====================================================
          Privacy Modal
      ====================================================== */}

      <Modal
        isOpen={
          privacyModalOpen
        }

        onClose={() =>
          setPrivacyModalOpen(
            false
          )
        }

        title="환자 개인정보보호 및 데이터 비식별화 안내"

        maxWidth="lg"
      >

        <div className="space-y-4 text-xs leading-relaxed text-slate-700">

          <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">

            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />

            <div>

              <div className="font-bold">
                환자 개인정보 최소 전송 원칙
              </div>

              <div className="text-[11px] text-emerald-800">
                AI 분석 전 개인정보 및 식별 가능 정보의 제거·마스킹 절차를 적용하고,
                분석에 필요한 최소 범위의 데이터만 서버로 전달합니다.
              </div>

            </div>

          </div>


          <div className="space-y-2">

            <h4 className="font-bold text-slate-900">
              1. 비식별화 및 제외 대상
            </h4>

            <ul className="list-inside list-disc space-y-1 pl-1 text-slate-600">

              <li>
                주민등록번호 등 고유식별정보
              </li>

              <li>
                전화번호 및 이메일 주소
              </li>

              <li>
                환자등록번호 및 차트번호
              </li>

              <li>
                환자 성명 등 직접 식별정보
              </li>

              <li>
                기타 환자를 특정할 수 있는 불필요한 정보
              </li>

            </ul>

          </div>


          <div className="space-y-2 border-t border-slate-100 pt-3">

            <h4 className="font-bold text-slate-900">
              2. AI 분석 시 전달 정보
            </h4>

            <p className="text-slate-600">
              AI 분석에는 정량 평가정보와 비식별 처리된 주관식 VOC 등
              분석에 필요한 정보만 전달하도록 구성합니다.
            </p>

          </div>


          <div className="mt-4 flex justify-end">

            <button
              type="button"
              onClick={() =>
                setPrivacyModalOpen(
                  false
                )
              }
              className="rounded bg-blue-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              확인
            </button>

          </div>

        </div>

      </Modal>

    </div>
  );
}