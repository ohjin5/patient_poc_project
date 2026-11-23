import React, {
  useState,
} from "react";

import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Trash2,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  HelpCircle,
  FileX2,
  CalendarRange,
  CalendarDays,
  Plus,
} from "lucide-react";

import {
  UploadedFileMetadata,
  SheetValidationReport,
  DepartmentSummary,
  PEER_GROUP_LABELS,
} from "../../types";

import {
  ExcelService,
} from "../../services/excelService";

import {
  Modal,
} from "../common/StatusBadge";

import {
  NormalizationValidationSummary,
} from "../../services/normalizationService";


type UploadDatasetMode =
  | "CURRENT"
  | "COMPARISON";


interface DataUploadViewProps {
  uploadedFiles:
    UploadedFileMetadata[];

  onAddUploadedFile: (
    fileMeta:
      UploadedFileMetadata,
    datasetMode?:
      UploadDatasetMode
  ) => void;

  onRemoveFile: (
    fileId: string
  ) => void;

  /** 비교기간 파일 목록 */
  comparisonUploadedFiles?:
    UploadedFileMetadata[];

  /** 비교기간 파일 제거 */
  onRemoveComparisonFile?: (
    fileId:
      string
  ) => void;

  /**
   * App.tsx 기존 Props 호환용.
   * 운영 화면에서는 사용하지 않습니다.
   */
  onLoadSampleData?: () => void;

  onProceedToCriteria:
    () => void;

  departments?:
    DepartmentSummary[];

  departmentsCount?:
    number;

  vocCount?:
    number;

  validationSummary?:
    NormalizationValidationSummary;
}


export const DataUploadView:
  React.FC<
    DataUploadViewProps
  > = ({
    uploadedFiles,
    onAddUploadedFile,
    onRemoveFile,
    comparisonUploadedFiles = [],
    onRemoveComparisonFile,
    onProceedToCriteria,
    departments = [],
    departmentsCount = 0,
    vocCount = 0,
    validationSummary,
  }) => {

    /**
     * ========================================================
     * State
     * ========================================================
     */

    const [
      isDragging,
      setIsDragging,
    ] =
      useState<boolean>(
        false
      );


    const [
      isProcessing,
      setIsProcessing,
    ] =
      useState<boolean>(
        false
      );


    /**
     * 업로드 대상 Dataset
     *
     * CURRENT:
     * 현재 분석·기준설정·Feedback Sheet 생성에 사용하는 파일
     *
     * COMPARISON:
     * 기간 비교에만 사용하는 과거/다른 기간 파일
     */
    const [
      datasetMode,
      setDatasetMode,
    ] =
      useState<UploadDatasetMode>(
        "CURRENT"
      );


    const [
      uploadError,
      setUploadError,
    ] =
      useState<
        string | null
      >(null);


    const [
      previewModalOpen,
      setPreviewModalOpen,
    ] =
      useState<boolean>(
        false
      );


    const [
      previewData,
      setPreviewData,
    ] =
      useState<{
        headers:
          string[];

        rows:
          any[][];
      }>({
        headers: [],
        rows: [],
      });


    const [
      previewTitle,
      setPreviewTitle,
    ] =
      useState<string>(
        ""
      );


    const [
      expandedFiles,
      setExpandedFiles,
    ] =
      useState<
        Record<
          string,
          boolean
        >
      >({});


    /**
     * ========================================================
     * File Expansion
     * ========================================================
     */

    const toggleFileExpansion =
      (
        fileId: string
      ) => {

        setExpandedFiles(
          (
            previous
          ) => ({
            ...previous,

            [fileId]:
              !previous[
                fileId
              ],
          })
        );
      };


    /**
     * ========================================================
     * Drag & Drop
     * ========================================================
     */

    const handleFileDrop =
      async (
        event:
          React.DragEvent<HTMLDivElement>
      ) => {

        event.preventDefault();

        setIsDragging(
          false
        );

        setUploadError(
          null
        );


        if (
          event.dataTransfer
            .files &&
          event.dataTransfer
            .files.length >
            0
        ) {

          await processFiles(
            Array.from(
              event.dataTransfer
                .files
            )
          );
        }
      };


    /**
     * ========================================================
     * File Input
     * ========================================================
     */

    const handleFileInputChange =
      async (
        event:
          React.ChangeEvent<HTMLInputElement>
      ) => {

        setUploadError(
          null
        );


        if (
          event.target.files &&
          event.target.files
            .length >
            0
        ) {

          await processFiles(
            Array.from(
              event.target.files
            )
          );


          event.target.value =
            "";
        }
      };


    /**
     * ========================================================
     * File Processing
     * ========================================================
     *
     * ExcelService가 실제 시트 구성으로
     * SCORE / VOC / COMBINED 등을 자동 판정합니다.
     *
     * 사용자가 파일 종류를 수동 지정하여
     * 자동 판정 결과를 덮어쓰지 않습니다.
     */

    const processFiles =
      async (
        files: File[]
      ) => {

        setIsProcessing(
          true
        );

        setUploadError(
          null
        );


        try {

          for (
            const file of
            files
          ) {

            /**
             * 지원 확장자 확인
             */
            const fileName =
              file.name.toLowerCase();


            const supported =
              fileName.endsWith(
                ".xlsx"
              ) ||
              fileName.endsWith(
                ".xls"
              ) ||
              fileName.endsWith(
                ".csv"
              );


            if (
              !supported
            ) {

              throw new Error(
                `지원하지 않는 파일 형식입니다: ${file.name}`
              );
            }


            const metadata =
              await ExcelService
                .parseFileMetadata(
                  file
                );


            onAddUploadedFile(
              metadata,
              datasetMode
            );
          }

        } catch (
          error
        ) {

          console.error(
            "[DataUploadView] File parse error:",
            error instanceof
            Error
              ? error.message
              : error
          );


          setUploadError(
            error instanceof
            Error
              ? error.message
              : "파일을 처리하는 중 오류가 발생했습니다."
          );

        } finally {

          setIsProcessing(
            false
          );
        }
      };


    /**
     * ========================================================
     * Preview
     * ========================================================
     */

    const openSheetPreview =
      (
        fileName: string,
        sheetReport:
          SheetValidationReport,
        file:
          UploadedFileMetadata
      ) => {

        setPreviewTitle(
          `${fileName} > ${sheetReport.sheetName} 시트 미리보기`
        );


        const parsedSheet =
          file.parsedSheets
            ?.find(
              (
                sheet
              ) =>
                sheet.sheetName ===
                sheetReport.sheetName
            );


        if (
          parsedSheet &&
          parsedSheet.rows
            .length >
            0
        ) {

          const headers =
            parsedSheet.headers;


          const rows =
            parsedSheet.rows.slice(
              parsedSheet
                .headerRowIndex +
                1,
              parsedSheet
                .headerRowIndex +
                30
            );


          setPreviewData({
            headers,
            rows,
          });


          setPreviewModalOpen(
            true
          );


          return;
        }


        if (
          file.parsedData &&
          Array.isArray(
            file.parsedData
          ) &&
          file.parsedData
            .length >
            0
        ) {

          const headers =
            (
              file.parsedData[
                0
              ] ||
              []
            ).map(
              (
                header:
                  any,
                index:
                  number
              ) =>
                String(
                  header ||
                    `열_${
                      index +
                      1
                    }`
                )
            );


          const rows =
            file.parsedData
              .slice(
                1,
                30
              );


          setPreviewData({
            headers,
            rows,
          });


          setPreviewModalOpen(
            true
          );
        }
      };


    /**
     * 현재 선택된 Dataset의 파일 목록
     */
    const activeUploadedFiles =
      datasetMode ===
      "CURRENT"
        ? uploadedFiles
        : comparisonUploadedFiles;


    const activeRemoveFile =
      (
        fileId:
          string
      ) => {

        if (
          datasetMode ===
          "COMPARISON"
        ) {

          onRemoveComparisonFile?.(
            fileId
          );

          return;
        }


        onRemoveFile(
          fileId
        );
      };


    /**
     * ========================================================
     * Aggregate Statistics
     * ========================================================
     */

    const totalSheetsCount =
      activeUploadedFiles.reduce(
        (
          total,
          file
        ) =>
          total +
          (
            file.sheetNames
              ?.length ||
            1
          ),
        0
      );


    const totalRawRows =
      activeUploadedFiles.reduce(
        (
          total,
          file
        ) =>
          total +
          (
            file.rowCount ||
            0
          ),
        0
      );


    const allSheetReports:
      Array<{
        fileName:
          string;

        report:
          SheetValidationReport;

        file:
          UploadedFileMetadata;
      }> = [];


    activeUploadedFiles.forEach(
      (
        file
      ) => {

        if (
          file.sheetReports &&
          file.sheetReports
            .length >
            0
        ) {

          file.sheetReports
            .forEach(
              (
                report
              ) => {

                allSheetReports.push({
                  fileName:
                    file.fileName,

                  report,

                  file,
                });
              }
            );
        }
      }
    );


    const excludedSheets =
      allSheetReports
        .filter(
          (
            item
          ) =>
            item.report
              .status ===
            "EXCLUDED"
        );


    const warningSheets =
      allSheetReports
        .filter(
          (
            item
          ) =>
            item.report
              .status ===
            "WARNING"
        );


    const errorSheets =
      allSheetReports
        .filter(
          (
            item
          ) =>
            item.report
              .status ===
            "ERROR"
        );


    const validSheets =
      allSheetReports
        .filter(
          (
            item
          ) =>
            item.report
              .status ===
              "VALID" ||
            item.report
              .status ===
              "WARNING"
        );


    const vocItemsCount =
      allSheetReports
        .filter(
          (
            item
          ) =>
            item.report
              .sheetType ===
            "VOC"
        )
        .reduce(
          (
            total,
            item
          ) =>
            total +
            (
              item.report
                .vocCount ||
              item.report
                .rowCount ||
              0
            ),
          0
        );


    const privacyWarningCount =
      activeUploadedFiles.reduce(
        (
          total,
          file
        ) =>
          total +
          (
            file.privacyWarnings ||
            0
          ),
        0
      );


    const hasUsableData =
      departmentsCount >
        0 ||
      vocItemsCount >
        0;


    /**
     * ========================================================
     * Render
     * ========================================================
     */

    return (
      <div className="space-y-6">

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>

              <div className="flex items-center gap-2">

                <span className="inline-flex items-center rounded-md bg-[#ECF2F7] px-2.5 py-0.5 text-xs font-bold text-[#243B53]">
                  데이터 업로드 & 자동 검증
                </span>

                <span className="text-xs font-medium text-[#64748B]">
                  환자경험평가 Excel의 시트 구조를 자동으로 인식합니다.
                </span>

              </div>

              <h2 className="mt-1 text-base font-bold tracking-tight text-[#1E293B]">
                평가점수 및 VOC 데이터 등록
              </h2>

            </div>


            <div className="rounded-lg border border-[#D9E1EA] bg-[#F8F9FA] px-3 py-2 text-[11px] leading-relaxed text-[#64748B]">

              <strong className="text-[#334155]">
                운영 데이터 기준
              </strong>

              <span className="ml-1">
                실제 설문결과 Excel/CSV 파일을 업로드해주세요.
              </span>

            </div>

          </div>

        </div>


        {/* ==================================================
            ERROR
        =================================================== */}

        {uploadError && (
          <div className="flex items-center justify-between rounded-xl border border-[#F6D3D3] bg-[#FDF2F2] p-4 text-xs text-[#B94A48]">

            <div className="flex items-center gap-2 font-bold">

              <AlertTriangle className="h-4 w-4 shrink-0" />

              <span>
                {uploadError}
              </span>

            </div>


            <button
              type="button"
              onClick={() =>
                setUploadError(
                  null
                )
              }
              className="font-bold hover:underline"
            >
              닫기
            </button>

          </div>
        )}


        {/* ==================================================
            PERIOD DATASET MODE
        =================================================== */}

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">

            <div>

              <div className="flex items-center gap-2">

                <CalendarRange className="h-4 w-4 text-[#243B53]" />

                <h3 className="text-xs font-bold text-[#1E293B]">
                  분석기간 데이터 등록 방식
                </h3>

              </div>


              <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                현재 분석할 기간의 파일을 먼저 등록하고,
                이후 비교할 과거 또는 다른 기간의 파일을 별도 Dataset으로 추가할 수 있도록 구성합니다.
              </p>

            </div>


            <span className="rounded-md border border-[#D9E1EA] bg-[#F8F9FA] px-2.5 py-1 text-[10px] font-semibold text-[#64748B]">
              파일 내 평가기간 자동 탐지
            </span>

          </div>


          <div className="mt-4 grid gap-3 md:grid-cols-2">

            <button
              type="button"
              onClick={() =>
                setDatasetMode(
                  "CURRENT"
                )
              }
              className={`rounded-xl border p-4 text-left transition-all ${
                datasetMode ===
                "CURRENT"
                  ? "border-[#B8C7D8] bg-[#ECF2F7]"
                  : "border-[#E2E8F0] bg-white hover:bg-[#F8F9FA]"
              }`}
            >

              <div className="flex items-start justify-between gap-3">

                <div className="flex items-start gap-2.5">

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">

                    <CalendarDays className="h-4 w-4 text-[#243B53]" />

                  </div>


                  <div>

                    <div className="text-xs font-bold text-[#1E293B]">
                      현재 분석기간
                    </div>

                    <div className="mt-0.5 text-[10px] leading-relaxed text-[#64748B]">
                      지금 분석하고 기준설정·Feedback Sheet 생성에 사용할 파일입니다.
                    </div>

                  </div>

                </div>


                <div className="flex flex-col items-end gap-1">

                  {datasetMode ===
                    "CURRENT" && (

                    <span className="rounded bg-[#243B53] px-2 py-0.5 text-[9px] font-bold text-white">
                      선택됨
                    </span>
                  )}


                  <span className="text-[9px] font-semibold text-[#64748B]">
                    {uploadedFiles.length}개 파일
                  </span>

                </div>

              </div>

            </button>


            <button
              type="button"
              onClick={() =>
                setDatasetMode(
                  "COMPARISON"
                )
              }
              className={`rounded-xl border p-4 text-left transition-all ${
                datasetMode ===
                "COMPARISON"
                  ? "border-[#B8C7D8] bg-[#ECF2F7]"
                  : "border-[#E2E8F0] bg-white hover:bg-[#F8F9FA]"
              }`}
            >

              <div className="flex items-start justify-between gap-3">

                <div className="flex items-start gap-2.5">

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">

                    <Plus className="h-4 w-4 text-[#243B53]" />

                  </div>


                  <div>

                    <div className="text-xs font-bold text-[#1E293B]">
                      비교기간 추가
                    </div>

                    <div className="mt-0.5 text-[10px] leading-relaxed text-[#64748B]">
                      과거 또는 다른 기간 파일을 별도 Dataset으로 등록해 기간 비교에 사용합니다.
                    </div>

                  </div>

                </div>


                <div className="flex flex-col items-end gap-1">

                  {datasetMode ===
                    "COMPARISON" && (

                    <span className="rounded bg-[#243B53] px-2 py-0.5 text-[9px] font-bold text-white">
                      선택됨
                    </span>
                  )}


                  <span className="text-[9px] font-semibold text-[#64748B]">
                    {comparisonUploadedFiles.length}개 파일
                  </span>

                </div>

              </div>

            </button>

          </div>


          {(uploadedFiles.length >
            0 ||
            comparisonUploadedFiles.length >
              0) && (

            <div className="mt-3 rounded-lg border border-[#D9E1EA] bg-[#F8FAFC] px-3 py-2.5 text-[10px] leading-relaxed text-[#64748B]">

              <strong className="text-[#334155]">
                현재 등록 상태
              </strong>

              <span className="ml-1">

                현재 분석기간{" "}
                <strong className="text-[#243B53]">
                  {uploadedFiles.length}개 파일
                </strong>

                {" · "}

                비교기간{" "}
                <strong className="text-[#243B53]">
                  {comparisonUploadedFiles.length}개 파일
                </strong>

              </span>


              <div className="mt-1 text-[#64748B]">
                비교기간 파일은 현재 분석 결과에 합쳐지지 않으며, 기간 비교 화면에서만 사용됩니다.
              </div>

            </div>
          )}

        </div>


        {/* ==================================================
            MAIN GRID
        =================================================== */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* =================================================
              LEFT
          ================================================== */}

          <div className="space-y-4 lg:col-span-8">

            {/* ===============================================
                Upload Zone
            ================================================ */}

            <div
              onDragOver={
                (
                  event
                ) => {

                  event.preventDefault();

                  setIsDragging(
                    true
                  );
                }
              }

              onDragLeave={() =>
                setIsDragging(
                  false
                )
              }

              onDrop={
                handleFileDrop
              }

              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-9 text-center transition-all ${
                isDragging
                  ? "border-[#243B53] bg-[#ECF2F7]/60"
                  : "border-[#E2E8F0] bg-[#F8F9FA] hover:bg-[#F1F5F9]"
              }`}
            >

              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ECF2F7] text-[#243B53]">

                <UploadCloud className="h-6 w-6" />

              </div>


              <p className="text-xs font-bold text-[#1E293B]">
                {datasetMode ===
                "CURRENT"
                  ? "현재 분석기간의 Excel 또는 CSV 파일을 끌어다 놓으세요"
                  : "비교할 과거 또는 다른 기간의 Excel/CSV 파일을 끌어다 놓으세요"}
              </p>


              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#64748B]">
                {datasetMode ===
                "CURRENT"
                  ? "동일 기간의 다중 시트 구성, VOC 시트, 2단 헤더 및 평가유형을 자동으로 확인합니다."
                  : "업로드 파일의 평가기간을 자동 탐지하고 현재 분석기간과 분리해 보관합니다."}
              </p>


              <label className="mt-4 cursor-pointer rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#334155] shadow-2xs transition-colors hover:bg-[#F8F9FA]">

                내 컴퓨터에서 파일 선택

                <input
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv"
                  onChange={
                    handleFileInputChange
                  }
                  className="hidden"
                />

              </label>


              {isProcessing && (
                <div className="mt-3 text-xs font-bold text-[#243B53]">
                  시트 구조 및 데이터 정합성을 확인하고 있습니다...
                </div>
              )}

            </div>


            {/* ===============================================
                Uploaded Files
            ================================================ */}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

              <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5">

                <h3 className="flex items-center gap-2 text-xs font-bold text-[#1E293B]">

                  <FileSpreadsheet className="h-4 w-4 text-[#243B53]" />

                  {datasetMode ===
                  "CURRENT"
                    ? "현재 분석기간 파일 및 시트 구성"
                    : "비교기간 파일 및 시트 구성"}

                  <span className="font-normal text-[#64748B]">
                    ({activeUploadedFiles.length}개 파일 / {totalSheetsCount}개 시트)
                  </span>

                </h3>


                {activeUploadedFiles.length >
                  0 && (
                  <span className="text-[11px] text-[#64748B]">

                    {datasetMode ===
                    "CURRENT"
                      ? `분석단위 ${departmentsCount}개 · 관련 VOC ${
                          vocCount ||
                          vocItemsCount
                        }건`
                      : `비교기간 파일 ${activeUploadedFiles.length}개 · VOC 시트 기준 ${vocItemsCount}건`}

                  </span>
                )}

              </div>


              {activeUploadedFiles.length ===
              0 ? (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  아직 등록된 파일이 없습니다.
                </div>
              ) : (
                <div className="mt-3 space-y-3">

                  {activeUploadedFiles.map(
                    (
                      file
                    ) => {

                      const isExpanded =
                        expandedFiles[
                          file.id
                        ] ??
                        true;


                      const reports =
                        file.sheetReports ||
                        [];


                      return (
                        <div
                          key={
                            file.id
                          }
                          className="rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] p-3 text-xs"
                        >

                          {/* =================================
                              File Header
                          ================================== */}

                          <div className="flex items-center justify-between gap-2">

                            <div className="flex min-w-0 items-center gap-2.5">

                              <button
                                type="button"
                                onClick={() =>
                                  toggleFileExpansion(
                                    file.id
                                  )
                                }
                                className="rounded p-1 text-[#64748B] hover:bg-[#EEF1F4]"
                              >

                                {isExpanded
                                  ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  )
                                  : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}

                              </button>


                              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#243B53]" />


                              <div className="min-w-0">

                                <div className="flex flex-wrap items-center gap-2">

                                  <span className="max-w-[420px] truncate font-bold text-[#1E293B]">
                                    {file.fileName}
                                  </span>

                                  <span className="rounded bg-[#E2E8F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#475569]">
                                    {(file.fileSize / 1024).toFixed(1)} KB
                                  </span>

                                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                                    {file.fileType}
                                  </span>

                                </div>


                                <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                                  {file.detectedPeriod
                                    ? `탐지기간: ${file.detectedPeriod}`
                                    : "평가기간 정보 미탐지"}
                                </div>

                              </div>

                            </div>


                            <div className="flex shrink-0 items-center gap-2">

                              <ValidationBadge
                                status={
                                  file.validationStatus
                                }
                              />


                              <button
                                type="button"
                                onClick={() =>
                                  activeRemoveFile(
                                    file.id
                                  )
                                }
                                className="rounded p-1.5 text-[#94A3B8] transition-colors hover:bg-white hover:text-[#B94A48]"
                                title="파일 제거"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>

                            </div>

                          </div>


                          {/* =================================
                              File Errors / Warnings
                          ================================== */}

                          {file.validationErrors &&
                            file.validationErrors
                              .length >
                              0 && (
                            <div className="mt-2 rounded-lg border border-[#F6D3D3] bg-[#FDF2F2] p-2 text-[10px] text-[#B94A48]">

                              {file.validationErrors.map(
                                (
                                  message,
                                  index
                                ) => (
                                  <div
                                    key={
                                      index
                                    }
                                  >
                                    • {message}
                                  </div>
                                )
                              )}

                            </div>
                          )}


                          {file.validationWarnings &&
                            file.validationWarnings
                              .length >
                              0 && (
                            <div className="mt-2 rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] p-2 text-[10px] text-[#8C5E1E]">

                              {file.validationWarnings.map(
                                (
                                  message,
                                  index
                                ) => (
                                  <div
                                    key={
                                      index
                                    }
                                  >
                                    • {message}
                                  </div>
                                )
                              )}

                            </div>
                          )}


                          {/* =================================
                              Sheet List
                          ================================== */}

                          {isExpanded &&
                            reports.length >
                              0 && (
                            <div className="mt-3 overflow-x-auto rounded-md border border-[#E2E8F0] bg-white">

                              <table className="min-w-[760px] w-full text-left text-[11px]">

                                <thead className="bg-[#EEF1F4] font-bold text-[#475569]">

                                  <tr>
                                    <th className="px-2.5 py-1.5">
                                      시트명
                                    </th>

                                    <th className="px-2.5 py-1.5">
                                      자동분류
                                    </th>

                                    <th className="px-2.5 py-1.5">
                                      데이터 행
                                    </th>

                                    <th className="px-2.5 py-1.5">
                                      인식 컬럼
                                    </th>

                                    <th className="px-2.5 py-1.5">
                                      상태
                                    </th>

                                    <th className="px-2.5 py-1.5 text-right">
                                      미리보기
                                    </th>
                                  </tr>

                                </thead>


                                <tbody className="divide-y divide-[#F1F5F9]">

                                  {reports.map(
                                    (
                                      report,
                                      index
                                    ) => {

                                      const badge =
                                        getSheetTypeBadge(
                                          report.sheetType
                                        );


                                      return (
                                        <tr
                                          key={
                                            `${report.sheetName}-${index}`
                                          }
                                          className="hover:bg-[#F8F9FA]"
                                        >

                                          <td className="px-2.5 py-1.5 font-bold text-[#1E293B]">
                                            {report.sheetName}
                                          </td>


                                          <td className="px-2.5 py-1.5">

                                            <span
                                              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${badge.className}`}
                                            >
                                              {badge.label}
                                            </span>

                                          </td>


                                          <td className="px-2.5 py-1.5 text-[#334155]">
                                            {report.rowCount >
                                            0
                                              ? `${report.rowCount}행`
                                              : "-"}
                                          </td>


                                          <td className="px-2.5 py-1.5 text-[#64748B]">

                                            {Object.keys(
                                              report.matchedColumns
                                            ).length >
                                            0
                                              ? Object.keys(
                                                  report.matchedColumns
                                                ).join(", ")
                                              : (
                                                <span className="text-[#94A3B8]">
                                                  정규화 단계에서 확인
                                                </span>
                                              )}

                                          </td>


                                          <td className="px-2.5 py-1.5">
                                            <SheetStatusText
                                              status={
                                                report.status
                                              }
                                            />
                                          </td>


                                          <td className="px-2.5 py-1.5 text-right">

                                            {report.status !==
                                              "EXCLUDED" && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  openSheetPreview(
                                                    file.fileName,
                                                    report,
                                                    file
                                                  )
                                                }
                                                className="inline-flex items-center gap-1 text-[10px] text-[#243B53] hover:underline"
                                              >
                                                <Eye className="h-3 w-3" />
                                                보기
                                              </button>
                                            )}

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
                      );
                    }
                  )}

                </div>
              )}

            </div>


            {/* ===============================================
                Peer Group Verification
            ================================================ */}

            {datasetMode ===
              "CURRENT" &&
              departments.length >
                0 && (
              <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

                <div className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5">

                  <div className="flex items-center gap-2">

                    <Layers className="h-4 w-4 text-[#243B53]" />

                    <h3 className="text-xs font-bold text-[#1E293B]">
                      분석단위별 Peer Group 자동 배정
                      {" "}
                      ({departments.length}개)
                    </h3>

                  </div>


                  <span className="rounded bg-[#ECF2F7] px-2 py-0.5 text-[11px] font-semibold text-[#243B53]">
                    9개 유형 분리 비교
                  </span>

                </div>


                <div className="max-h-72 overflow-auto rounded-lg border border-[#E2E8F0]">

                  <table className="min-w-[840px] w-full text-left text-[11px]">

                    <thead className="sticky top-0 border-b border-[#E2E8F0] bg-[#F8F9FA] font-bold text-[#475569]">

                      <tr>
                        <th className="px-3 py-2">
                          원본명
                        </th>

                        <th className="px-3 py-2">
                          표시명
                        </th>

                        <th className="px-3 py-2">
                          Source Sheet
                        </th>

                        <th className="px-3 py-2">
                          Peer Group
                        </th>

                        <th className="px-3 py-2">
                          유형명
                        </th>

                        <th className="px-3 py-2 text-right">
                          그룹 규모 / 적용기준
                        </th>
                      </tr>

                    </thead>


                    <tbody className="divide-y divide-[#F1F5F9]">

                      {departments.map(
                        (
                          department
                        ) => {

                          const groupSize =
                            department.peerGroupSize ||
                            1;


                          const isSmall =
                            department.isSmallPeerGroup ??
                            (
                              groupSize <
                              5
                            );


                          return (
                            <tr
                              key={
                                department.id
                              }
                              className="hover:bg-[#F8F9FA]"
                            >

                              <td className="px-3 py-1.5 font-medium text-[#64748B]">
                                {department.rawName ||
                                  department.name}
                              </td>


                              <td className="px-3 py-1.5 font-bold text-[#1E293B]">
                                {department.displayName ||
                                  department.name}
                              </td>


                              <td className="px-3 py-1.5 text-[#64748B]">
                                {department.sourceSheet ||
                                  "-"}
                              </td>


                              <td className="px-3 py-1.5">

                                <code className="rounded bg-[#EEF1F4] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#243B53]">
                                  {department.peerGroup}
                                </code>

                              </td>


                              <td className="px-3 py-1.5 font-semibold text-[#334155]">
                                {department.peerGroupLabel ||
                                  PEER_GROUP_LABELS[
                                    department.peerGroup
                                  ] ||
                                  "기타"}
                              </td>


                              <td className="px-3 py-1.5 text-right">

                                {isSmall
                                  ? (
                                    <span className="inline-flex rounded border border-[#F9E7C4] bg-[#FEF8EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#B87A24]">
                                      {groupSize}개 · 백분위 제외 / 평균·격차 적용
                                    </span>
                                  )
                                  : (
                                    <span className="inline-flex rounded border border-[#C7E6D7] bg-[#EBF5F0] px-1.5 py-0.5 text-[10px] font-semibold text-[#2E7D5B]">
                                      {groupSize}개 · 백분위 / 평균·격차 적용
                                    </span>
                                  )}

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

          </div>


          {/* =================================================
              RIGHT
          ================================================== */}

          <div className="space-y-4 lg:col-span-4">

            {/* ===============================================
                Validation Summary
            ================================================ */}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs">

              <h3 className="flex items-center justify-between border-b border-[#EEF1F4] pb-2.5 text-xs font-bold text-[#1E293B]">

                <span>
                  파일 확인 및 검증 결과
                </span>


                {activeUploadedFiles.length >
                0
                  ? (
                    <CheckCircle2 className="h-4 w-4 text-[#2E7D5B]" />
                  )
                  : (
                    <Info className="h-4 w-4 text-[#94A3B8]" />
                  )}

              </h3>


              {activeUploadedFiles.length ===
              0 ? (
                <div className="py-6 text-center text-xs text-[#94A3B8]">
                  파일을 등록하면 시트별 검증결과가 표시됩니다.
                </div>
              ) : (
                <div className="mt-3 space-y-3">

                  <div className="space-y-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8F9FA] p-3 text-xs">

                    <SummaryRow
                      label="전체 시트"
                      value={`${totalSheetsCount}개`}
                    />

                    <SummaryRow
                      label="원본 데이터 행"
                      value={`${totalRawRows.toLocaleString()}행`}
                    />

                    <SummaryRow
                      label="분석 가능 시트"
                      value={`${validSheets.length}개`}
                    />

                    <SummaryRow
                      label="제외 시트"
                      value={`${excludedSheets.length}개`}
                    />

                    <SummaryRow
                      label="분석단위"
                      value={`${departmentsCount}개`}
                      emphasized
                    />

                    <SummaryRow
                      label="관련 VOC"
                      value={`${vocCount || vocItemsCount}건`}
                      emphasized
                    />

                  </div>


                  {/* =========================================
                      Error
                  ========================================== */}

                  {errorSheets.length >
                    0 && (
                    <div className="space-y-1.5 rounded-lg border border-[#F6D3D3] bg-[#FDF2F2] p-3 text-[11px] text-[#B94A48]">

                      <div className="flex items-center gap-1.5 font-bold">
                        <FileX2 className="h-3.5 w-3.5" />
                        오류 확인
                      </div>


                      {errorSheets.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="leading-relaxed"
                          >
                            • {item.report.sheetName}:{" "}
                            {item.report.errors.join(
                              ", "
                            )}
                          </div>
                        )
                      )}

                    </div>
                  )}


                  {/* =========================================
                      Warning / Excluded
                  ========================================== */}

                  {(excludedSheets.length >
                    0 ||
                    warningSheets.length >
                    0) && (
                    <div className="space-y-1.5 rounded-lg border border-[#F9E7C4] bg-[#FEF8EC] p-3 text-[11px] text-[#8C5E1E]">

                      <div className="flex items-center gap-1.5 font-bold text-[#B87A24]">

                        <AlertTriangle className="h-3.5 w-3.5" />

                        주의 및 제외 안내

                      </div>


                      {excludedSheets.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              `excluded-${index}`
                            }
                          >
                            • {item.report.sheetName}: 분석대상 제외
                          </div>
                        )
                      )}


                      {warningSheets.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            key={
                              `warning-${index}`
                            }
                          >
                            • {item.report.sheetName}:{" "}
                            {item.report.warnings.join(
                              ", "
                            )}
                          </div>
                        )
                      )}

                    </div>
                  )}


                  {/* =========================================
                      Privacy
                  ========================================== */}

                  <div className="rounded-lg border border-[#C7E6D7] bg-[#EBF5F0]/70 p-3 text-[11px] leading-relaxed text-[#2E7D5B]">

                    <div className="flex items-start gap-2">

                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />

                      <div>

                        <div className="font-bold">
                          개인정보 보호 확인
                        </div>

                        <div className="mt-0.5">
                          주관식 VOC에서 개인정보 가능성이 있는 표현을 사전 탐지하며,
                          AI 전송 전 비식별화·최소전송 절차를 적용합니다.
                        </div>


                        {privacyWarningCount >
                          0 && (
                          <div className="mt-1 font-semibold text-[#B87A24]">
                            개인정보 가능 표현 탐지: {privacyWarningCount}건
                          </div>
                        )}

                      </div>

                    </div>

                  </div>


                  {/* =========================================
                      Normalization Validation
                  ========================================== */}

                  {validationSummary && (
                    <div className="rounded-lg border border-[#D9E1EA] bg-white p-3 text-[11px] text-[#64748B]">

                      <div className="mb-1 font-bold text-[#334155]">
                        정규화 검증
                      </div>

                      <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed">
                        {JSON.stringify(
                          validationSummary,
                          null,
                          2
                        )}
                      </pre>

                    </div>
                  )}


                  {/* =========================================
                      Proceed
                  ========================================== */}

                  {datasetMode ===
                    "CURRENT"
                    ? (

                      <button
                        type="button"
                        onClick={
                          onProceedToCriteria
                        }
                        disabled={
                          !hasUsableData
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#243B53] py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#1B2F44] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >

                        <span>
                          취약 분석 기준 설정으로 이동
                        </span>

                        <ArrowRight className="h-4 w-4" />

                      </button>

                    )
                    : (

                      <button
                        type="button"
                        onClick={() =>
                          setDatasetMode(
                            "CURRENT"
                          )
                        }
                        disabled={
                          comparisonUploadedFiles.length ===
                          0
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D9E1EA] bg-[#F8F9FA] py-3 text-xs font-bold text-[#334155] transition-colors hover:bg-[#EEF2F6] disabled:cursor-not-allowed disabled:text-[#94A3B8]"
                      >

                        <span>
                          비교기간 등록 완료 · 현재 분석기간으로 돌아가기
                        </span>

                        <ArrowRight className="h-4 w-4" />

                      </button>
                    )}

                </div>
              )}

            </div>


            {/* ===============================================
                Guide
            ================================================ */}

            <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-white p-4 text-xs text-[#64748B]">

              <h4 className="flex items-center gap-1.5 font-bold text-[#1E293B]">

                <HelpCircle className="h-3.5 w-3.5 text-[#243B53]" />

                실제 병원 Excel 업로드 안내

              </h4>


              <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed">

                <li>
                  점수와 VOC가 하나의 Excel에 여러 시트로 있어도 자동으로 분류합니다.
                </li>

                <li>
                  병합된 2단 헤더 구조는 정규화 단계에서 다시 해석합니다.
                </li>

                <li>
                  분석에 사용되지 않는 시트는 제외 상태로 표시합니다.
                </li>

                <li>
                  동일 이름의 진료과라도 외래·입원 등 유형별 Peer Group을 분리합니다.
                </li>

                <li>
                  Peer Group이 5개 미만이면 백분위만 제외하고 다른 비교기준은 유지합니다.
                </li>

                <li>
                  비교기간 파일은 현재기간 분석에 합쳐지지 않으며 기간 비교용으로만 별도 보관합니다.
                </li>

              </ul>

            </div>

          </div>

        </div>


        {/* ==================================================
            Preview Modal
        =================================================== */}

        <Modal
          isOpen={
            previewModalOpen
          }

          onClose={() =>
            setPreviewModalOpen(
              false
            )
          }

          title={
            previewTitle
          }

          maxWidth="4xl"
        >

          <div className="max-h-[60vh] overflow-auto">

            {previewData.headers
              .length ===
            0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                표시할 데이터가 없습니다.
              </div>
            ) : (
              <table className="w-full border border-[#E2E8F0] text-left text-xs">

                <thead className="sticky top-0 border-b border-[#E2E8F0] bg-[#F8F9FA] font-bold text-[#64748B]">

                  <tr>

                    {previewData.headers.map(
                      (
                        header,
                        index
                      ) => (
                        <th
                          key={
                            index
                          }
                          className="whitespace-nowrap border-r border-[#E2E8F0] px-3 py-2.5"
                        >
                          {header}
                        </th>
                      )
                    )}

                  </tr>

                </thead>


                <tbody className="divide-y divide-[#F1F5F9]">

                  {previewData.rows.map(
                    (
                      row,
                      rowIndex
                    ) => (
                      <tr
                        key={
                          rowIndex
                        }
                        className="hover:bg-[#F8F9FA]"
                      >

                        {previewData.headers.map(
                          (
                            _,
                            columnIndex
                          ) => (
                            <td
                              key={
                                columnIndex
                              }
                              className="max-w-[340px] whitespace-pre-wrap border-r border-[#EEF1F4] px-3 py-2 align-top text-[#334155]"
                            >
                              {row &&
                              row[
                                columnIndex
                              ] !==
                                undefined &&
                              row[
                                columnIndex
                              ] !==
                                null
                                ? String(
                                    row[
                                      columnIndex
                                    ]
                                  )
                                : ""}
                            </td>
                          )
                        )}

                      </tr>
                    )
                  )}

                </tbody>

              </table>
            )}

          </div>


          <div className="mt-4 flex justify-end">

            <button
              type="button"
              onClick={() =>
                setPreviewModalOpen(
                  false
                )
              }
              className="rounded-lg bg-[#243B53] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1B2F44]"
            >
              닫기
            </button>

          </div>

        </Modal>

      </div>
    );
  };


/**
 * ============================================================
 * Validation Badge
 * ============================================================
 */

function ValidationBadge({
  status,
}: {
  status:
    UploadedFileMetadata["validationStatus"];
}) {

  if (
    status ===
    "VALID"
  ) {

    return (
      <span className="inline-flex items-center gap-1 rounded border border-[#C7E6D7] bg-[#EBF5F0] px-2 py-0.5 text-[10px] font-bold text-[#2E7D5B]">

        <CheckCircle2 className="h-3 w-3" />

        정상

      </span>
    );
  }


  if (
    status ===
    "WARNING"
  ) {

    return (
      <span className="inline-flex items-center gap-1 rounded border border-[#F9E7C4] bg-[#FEF8EC] px-2 py-0.5 text-[10px] font-bold text-[#B87A24]">

        <AlertTriangle className="h-3 w-3" />

        확인 필요

      </span>
    );
  }


  return (
    <span className="inline-flex items-center gap-1 rounded border border-[#F6D3D3] bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-bold text-[#B94A48]">

      <FileX2 className="h-3 w-3" />

      오류

    </span>
  );
}


/**
 * ============================================================
 * Sheet Status
 * ============================================================
 */

function SheetStatusText({
  status,
}: {
  status:
    SheetValidationReport["status"];
}) {

  if (
    status ===
    "VALID"
  ) {

    return (
      <span className="font-bold text-[#2E7D5B]">
        ✓ 정상
      </span>
    );
  }


  if (
    status ===
    "WARNING"
  ) {

    return (
      <span className="font-bold text-[#B87A24]">
        △ 확인
      </span>
    );
  }


  if (
    status ===
    "EXCLUDED"
  ) {

    return (
      <span className="italic text-[#64748B]">
        제외
      </span>
    );
  }


  return (
    <span className="font-bold text-[#B94A48]">
      ✕ 오류
    </span>
  );
}


/**
 * ============================================================
 * Summary Row
 * ============================================================
 */

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label:
    string;

  value:
    string;

  emphasized?:
    boolean;
}) {

  return (
    <div className="flex items-center justify-between">

      <span className="text-[#475569]">
        {label}
      </span>

      <span
        className={
          emphasized
            ? "font-bold text-[#243B53]"
            : "font-semibold text-[#334155]"
        }
      >
        {value}
      </span>

    </div>
  );
}


/**
 * ============================================================
 * Sheet Type
 * ============================================================
 */

function getSheetTypeBadge(
  sheetType: string
): {
  label:
    string;

  className:
    string;
} {

  const map:
    Record<
      string,
      {
        label:
          string;

        className:
          string;
      }
    > = {

    WARD: {
      label:
        "병동",
      className:
        "bg-blue-50 text-blue-800 border-blue-200",
    },

    OUTPATIENT: {
      label:
        "외래",
      className:
        "bg-teal-50 text-teal-800 border-teal-200",
    },

    DEPARTMENT: {
      label:
        "진료과",
      className:
        "bg-indigo-50 text-indigo-800 border-indigo-200",
    },

    DOCTOR: {
      label:
        "의사",
      className:
        "bg-cyan-50 text-cyan-800 border-cyan-200",
    },

    EXAM: {
      label:
        "검사",
      className:
        "bg-purple-50 text-purple-800 border-purple-200",
    },

    VOC: {
      label:
        "VOC",
      className:
        "bg-amber-50 text-amber-800 border-amber-200",
    },

    UNKNOWN: {
      label:
        "제외/미분류",
      className:
        "bg-slate-100 text-slate-600 border-slate-200",
    },
  };


  return (
    map[
      sheetType
    ] ||
    map.UNKNOWN
  );
}