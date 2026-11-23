import * as XLSX from "xlsx";

import {
  UploadedFileMetadata,
  ParsedSheetData,
  SheetValidationReport,
  CXFeedbackSheetData,
  WardTeamExcelReportData,
} from "../types";

import {
  PrivacyService,
} from "./privacyService";

import {
  NormalizationService,
  normalizeCell,
  normalizeCellLower,
  COLUMN_ALIASES,
} from "./normalizationService";


/**
 * ExcelService 내부 검증용 보조 Alias
 *
 * 실제 2단 헤더 해석은 NormalizationService가 담당합니다.
 * 이 값은 업로드 검증 단계에서만 사용하며,
 * normalizationService의 COLUMN_ALIASES에 해당 key가 없어도
 * TypeScript 오류 없이 안전하게 동작하도록 분리합니다.
 */
const EXCEL_VALIDATION_ALIASES: {
  domain: string[];
  question: string[];
  period: string[];
} = {
  domain: [
    "영역",
    "평가영역",
    "영역명",
    "domain",
  ],

  question: [
    "문항",
    "문항명",
    "세부문항",
    "질문",
    "question",
  ],

  period: [
    "평가기간",
    "조사기간",
    "기간",
    "period",
  ],
};


export class ExcelService {

  /**
   * ==========================================================
   * 1. Upload Excel Parsing / Validation
   * ==========================================================
   */
  public static async parseFileMetadata(
    file: File
  ): Promise<UploadedFileMetadata> {

    const arrayBuffer =
      await file.arrayBuffer();


    const workbook =
      XLSX.read(
        arrayBuffer,
        {
          type: "array",
        }
      );


    const sheetNames =
      workbook.SheetNames || [];


    const parsedSheets:
      ParsedSheetData[] = [];


    const sheetReports:
      SheetValidationReport[] = [];


    const validationErrors:
      string[] = [];


    const validationWarnings:
      string[] = [];


    let totalRowCount =
      0;


    let privacyWarnings =
      0;


    /**
     * 실제 파일에서 기간을 확인하지 못하면
     * 임의의 분기를 만들지 않습니다.
     */
    let detectedPeriod =
      "";


    const deptSet =
      new Set<string>();


    let totalVocCount =
      0;


    /**
     * ========================================================
     * Sheet Loop
     * ========================================================
     */

    for (
      const sheetName of
      sheetNames
    ) {

      try {

        const worksheet =
          workbook.Sheets[
            sheetName
          ];


        if (!worksheet) {
          continue;
        }


        const rawJson =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              header: 1,
              defval: "",
              raw: true,
            }
          ) as any[][];


        /**
         * ----------------------------------------------------
         * Empty Sheet
         * ----------------------------------------------------
         */

        if (
          !Array.isArray(
            rawJson
          ) ||
          rawJson.length ===
            0
        ) {

          sheetReports.push({
            sheetName,
            sheetType:
              "UNKNOWN",
            status:
              "EXCLUDED",
            rowCount:
              0,
            headerRowIndex:
              0,
            headers:
              [],
            matchedColumns:
              {},
            warnings: [
              "시트 내용이 비어있습니다.",
            ],
            errors:
              [],
          });

          continue;
        }


        /**
         * 완전히 빈 행만 제거
         */
        const nonEmptyRows =
          rawJson.filter(
            (
              row
            ) =>
              Array.isArray(
                row
              ) &&
              row.some(
                (
                  cell
                ) =>
                  normalizeCell(
                    cell
                  ) !== ""
              )
          );


        if (
          nonEmptyRows.length ===
          0
        ) {

          sheetReports.push({
            sheetName,
            sheetType:
              "UNKNOWN",
            status:
              "EXCLUDED",
            rowCount:
              0,
            headerRowIndex:
              0,
            headers:
              [],
            matchedColumns:
              {},
            warnings: [
              "유효한 데이터 행이 존재하지 않습니다.",
            ],
            errors:
              [],
          });

          continue;
        }


        /**
         * ----------------------------------------------------
         * Header / Sheet Type
         * ----------------------------------------------------
         */

        const {
          index:
            headerRowIndex,
          headers,
          emptyColumnCount,
        } =
          NormalizationService
            .detectHeaderRow(
              nonEmptyRows
            );


        const sheetType =
          NormalizationService
            .detectSheetType(
              sheetName,
              headers
            );


        const dataRows =
          nonEmptyRows.slice(
            headerRowIndex +
              1
          );


        totalRowCount +=
          dataRows.length;


        const matchedColumns:
          Record<
            string,
            string
          > = {};


        const sheetWarnings:
          string[] = [];


        const sheetErrors:
          string[] = [];


        if (
          emptyColumnCount >
          0
        ) {

          sheetWarnings.push(
            `빈 헤더 컬럼 ${emptyColumnCount}개가 자동 제외되었습니다.`
          );
        }


        /**
         * ====================================================
         * VOC Sheet
         * ====================================================
         */

        if (
          sheetType ===
          "VOC"
        ) {

          const deptIdx =
            NormalizationService
              .findColumnByAlias(
                headers,
                COLUMN_ALIASES
                  .departmentName
              );


          const contentIdx =
            NormalizationService
              .findColumnByAlias(
                headers,
                COLUMN_ALIASES
                  .vocContent
              );


          const dateIdx =
            NormalizationService
              .findColumnByAlias(
                headers,
                COLUMN_ALIASES
                  .vocDate
              );


          const catIdx =
            NormalizationService
              .findColumnByAlias(
                headers,
                COLUMN_ALIASES
                  .vocCategory
              );


          if (
            deptIdx >=
            0
          ) {
            matchedColumns[
              "진료과"
            ] =
              headers[
                deptIdx
              ];
          }


          if (
            contentIdx >=
            0
          ) {
            matchedColumns[
              "VOC내용"
            ] =
              headers[
                contentIdx
              ];
          }


          if (
            dateIdx >=
            0
          ) {
            matchedColumns[
              "응답완료일"
            ] =
              headers[
                dateIdx
              ];
          }


          if (
            catIdx >=
            0
          ) {
            matchedColumns[
              "분류"
            ] =
              headers[
                catIdx
              ];
          }


          /**
           * VOC 내용만 필수
           *
           * 현재 실제 파일은
           * 센터/진료과/의사/병동/검사실 중
           * 분석단위에 따라 연결될 수 있으므로
           * 진료과 컬럼을 일괄 필수로 보지 않습니다.
           */
          if (
            contentIdx ===
            -1
          ) {

            sheetErrors.push(
              "VOC 내용 컬럼을 찾을 수 없습니다."
            );
          }


          let vocInSheet =
            0;


          dataRows.forEach(
            (
              row
            ) => {

              const content =
                contentIdx >=
                  0 &&
                row[
                  contentIdx
                ]
                  ? normalizeCell(
                      row[
                        contentIdx
                      ]
                    )
                  : "";


              if (!content) {
                return;
              }


              vocInSheet++;


              /**
               * 업로드 검증 단계에서
               * 개인정보 가능성만 탐지
               */
              const privacyResult =
                PrivacyService
                  .sanitize(
                    content
                  );


              if (
                privacyResult
                  .hasPrivacyInfo
              ) {
                privacyWarnings++;
              }
            }
          );


          totalVocCount +=
            vocInSheet;


          const report:
            SheetValidationReport =
            {
              sheetName,
              sheetType,

              status:
                sheetErrors.length >
                0
                  ? "ERROR"
                  : sheetWarnings.length >
                    0
                  ? "WARNING"
                  : "VALID",

              rowCount:
                dataRows.length,

              headerRowIndex,

              headers,

              matchedColumns,

              warnings:
                sheetWarnings,

              errors:
                sheetErrors,

              vocCount:
                vocInSheet,
            };


          sheetReports.push(
            report
          );


          parsedSheets.push({
            sheetName,
            sheetType,
            headerRowIndex,
            headers,
            rows:
              nonEmptyRows,
            report,
          });


          continue;
        }


        /**
         * ====================================================
         * Unknown Sheet
         * ====================================================
         */

        if (
          sheetType ===
          "UNKNOWN"
        ) {

          sheetWarnings.push(
            "현재 분석규칙에서 지원하지 않는 시트로 분류되어 분석대상에서 제외되었습니다."
          );


          sheetReports.push({
            sheetName,
            sheetType,
            status:
              "EXCLUDED",
            rowCount:
              dataRows.length,
            headerRowIndex,
            headers,
            matchedColumns,
            warnings:
              sheetWarnings,
            errors:
              sheetErrors,
          });


          continue;
        }


        /**
         * ====================================================
         * Score Sheet
         * ====================================================
         *
         * 실제 점수 파싱은 NormalizationService가 수행합니다.
         *
         * 이 단계에서는 업로드 파일에
         * 분석 가능한 구조가 있는지만 확인합니다.
         */

        const deptIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              COLUMN_ALIASES
                .departmentName
            );


        const scoreIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              COLUMN_ALIASES
                .score
            );


        const domainIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              EXCEL_VALIDATION_ALIASES
                .domain
            );


        const questionIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              EXCEL_VALIDATION_ALIASES
                .question
            );


        const periodIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              EXCEL_VALIDATION_ALIASES
                .period
            );


        const sampleSizeIdx =
          NormalizationService
            .findColumnByAlias(
              headers,
              COLUMN_ALIASES
                .sampleSize
            );


        if (
          deptIdx >=
          0
        ) {
          matchedColumns[
            "분석대상"
          ] =
            headers[
              deptIdx
            ];
        }


        if (
          scoreIdx >=
          0
        ) {
          matchedColumns[
            "점수"
          ] =
            headers[
              scoreIdx
            ];
        }


        if (
          domainIdx >=
          0
        ) {
          matchedColumns[
            "평가영역"
          ] =
            headers[
              domainIdx
            ];
        }


        if (
          questionIdx >=
          0
        ) {
          matchedColumns[
            "세부문항"
          ] =
            headers[
              questionIdx
            ];
        }


        if (
          periodIdx >=
          0
        ) {
          matchedColumns[
            "평가기간"
          ] =
            headers[
              periodIdx
            ];
        }


        if (
          sampleSizeIdx >=
          0
        ) {
          matchedColumns[
            "사례수"
          ] =
            headers[
              sampleSizeIdx
            ];
        }


        /**
         * 실제 workbook은 2단 헤더 구조이므로
         * 단순 alias 탐색으로 컬럼이 안 잡힐 수도 있습니다.
         *
         * 따라서 이 단계에서
         * 바로 ERROR 처리하지 않고 WARNING 처리합니다.
         *
         * 실제 지원 시트 여부는
         * NormalizationService가 최종 판단합니다.
         */
        if (
          deptIdx ===
            -1 &&
          scoreIdx ===
            -1
        ) {

          sheetWarnings.push(
            "단일 헤더 기준으로 주요 컬럼을 찾지 못했습니다. 2단 헤더 구조는 정규화 단계에서 다시 해석합니다."
          );
        }


        let sheetDeptCount =
          0;


        dataRows.forEach(
          (
            row
          ) => {

            const deptName =
              deptIdx >=
                0 &&
              row[
                deptIdx
              ]
                ? normalizeCell(
                    row[
                      deptIdx
                    ]
                  )
                : "";


            if (
              deptName
            ) {

              deptSet.add(
                deptName
              );

              sheetDeptCount++;
            }


            if (
              periodIdx >=
                0 &&
              row[
                periodIdx
              ]
            ) {

              const period =
                normalizeCell(
                  row[
                    periodIdx
                  ]
                );


              if (
                period
              ) {
                detectedPeriod =
                  period;
              }
            }
          }
        );


        const report:
          SheetValidationReport =
          {
            sheetName,
            sheetType,

            status:
              sheetErrors.length >
              0
                ? "ERROR"
                : sheetWarnings.length >
                  0
                ? "WARNING"
                : "VALID",

            rowCount:
              dataRows.length,

            headerRowIndex,

            headers,

            matchedColumns,

            warnings:
              sheetWarnings,

            errors:
              sheetErrors,

            departmentCount:
              sheetDeptCount,

            detectedPeriod:
              detectedPeriod ||
              undefined,
          };


        sheetReports.push(
          report
        );


        parsedSheets.push({
          sheetName,
          sheetType,
          headerRowIndex,
          headers,
          rows:
            nonEmptyRows,
          report,
        });

      } catch (
        error
      ) {

        sheetReports.push({
          sheetName,
          sheetType:
            "UNKNOWN",
          status:
            "ERROR",
          rowCount:
            0,
          headerRowIndex:
            0,
          headers:
            [],
          matchedColumns:
            {},
          warnings:
            [],
          errors: [
            `시트 처리 중 오류: ${
              error instanceof
              Error
                ? error.message
                : "알 수 없는 오류"
            }`,
          ],
        });
      }
    }


    /**
     * ========================================================
     * File Type
     * ========================================================
     */

    const lowerName =
      normalizeCellLower(
        file.name
      );


    let fileType:
      | "SCORE"
      | "VOC"
      | "PAST_SCORE"
      | "COMBINED" =
      "SCORE";


    if (
      lowerName.includes(
        "voc"
      ) ||
      lowerName.includes(
        "의견"
      ) ||
      lowerName.includes(
        "주관식"
      )
    ) {

      fileType =
        "VOC";

    } else if (
      lowerName.includes(
        "과거"
      ) ||
      lowerName.includes(
        "이전"
      ) ||
      lowerName.includes(
        "past"
      )
    ) {

      fileType =
        "PAST_SCORE";

    } else if (
      sheetReports.some(
        (
          sheet
        ) =>
          sheet.sheetType ===
          "VOC"
      ) &&
      sheetReports.some(
        (
          sheet
        ) =>
          sheet.sheetType !==
            "VOC" &&
          sheet.sheetType !==
            "UNKNOWN"
      )
    ) {

      fileType =
        "COMBINED";
    }


    /**
     * ========================================================
     * Validation Summary
     * ========================================================
     */

    const hasValidSheet =
      sheetReports.some(
        (
          sheet
        ) =>
          sheet.status ===
            "VALID" ||
          sheet.status ===
            "WARNING"
      );


    const hasError =
      sheetReports.some(
        (
          sheet
        ) =>
          sheet.status ===
          "ERROR"
      );


    let validationStatus:
      | "VALID"
      | "WARNING"
      | "ERROR" =
      "VALID";


    if (
      !hasValidSheet
    ) {

      validationStatus =
        "ERROR";


      validationErrors.push(
        "분석 가능한 평가점수 또는 VOC 시트를 찾을 수 없습니다."
      );

    } else if (
      hasError ||
      privacyWarnings >
        0 ||
      sheetReports.some(
        (
          sheet
        ) =>
          sheet.status ===
          "WARNING"
      )
    ) {

      validationStatus =
        "WARNING";
    }


    if (
      privacyWarnings >
      0
    ) {

      validationWarnings.push(
        `주관식 VOC에서 개인정보로 추정되는 표현 ${privacyWarnings}건이 탐지되었습니다. AI 전송 전 비식별화 처리를 적용합니다.`
      );
    }


    const defaultSheet =
      parsedSheets[0]
        ?.sheetName ||
      sheetNames[0] ||
      "Sheet1";


    return {
      id:
        `FILE-${Date.now()}-${Math.random()
          .toString(36)
          .substring(
            2,
            6
          )}`,

      fileName:
        file.name,

      fileSize:
        file.size,

      fileType,

      sheetNames,

      selectedSheet:
        defaultSheet,

      rowCount:
        totalRowCount,

      /**
       * 기간을 못 찾았으면 빈 문자열
       *
       * "2026년 2분기" 등을 자동 생성하지 않음
       */
      detectedPeriod:
        detectedPeriod,

      detectedDepartmentCount:
        deptSet.size >
        0
          ? deptSet.size
          : undefined,

      detectedVocCount:
        totalVocCount >
        0
          ? totalVocCount
          : undefined,

      validationStatus,

      validationErrors,

      validationWarnings,

      privacyWarnings,

      parsedData:
        parsedSheets[0]
          ?.rows ||
        [],

      parsedSheets,

      sheetReports,
    };
  }


  /**
   * ==========================================================
   * 2. Sheet Preview
   * ==========================================================
   */
  public static async getSheetPreview(
    file: File,
    sheetName: string
  ): Promise<{
    headers: string[];
    rows: any[][];
  }> {

    try {

      const arrayBuffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          arrayBuffer,
          {
            type: "array",
          }
        );


      const targetSheetName =
        sheetName ||
        workbook
          .SheetNames[0];


      const worksheet =
        workbook.Sheets[
          targetSheetName
        ];


      if (
        !worksheet
      ) {

        return {
          headers: [],
          rows: [],
        };
      }


      const rawJson =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            header: 1,
            defval: "",
          }
        ) as any[][];


      if (
        !Array.isArray(
          rawJson
        ) ||
        rawJson.length ===
          0
      ) {

        return {
          headers: [],
          rows: [],
        };
      }


      const nonEmptyRows =
        rawJson.filter(
          (
            row
          ) =>
            Array.isArray(
              row
            ) &&
            row.some(
              (
                cell
              ) =>
                normalizeCell(
                  cell
                ) !== ""
            )
        );


      if (
        nonEmptyRows.length ===
        0
      ) {

        return {
          headers: [],
          rows: [],
        };
      }


      const {
        index:
          headerIndex,
        headers,
      } =
        NormalizationService
          .detectHeaderRow(
            nonEmptyRows
          );


      const rows =
        nonEmptyRows.slice(
          headerIndex +
            1,
          headerIndex +
            30
        );


      return {
        headers,
        rows,
      };

    } catch (
      error
    ) {

      console.error(
        "[ExcelService] Sheet preview failed:",
        error instanceof
        Error
          ? error.message
          : error
      );


      return {
        headers: [],
        rows: [],
      };
    }
  }


  /**
   * ==========================================================
   * 3. Feedback Sheet Excel Export
   * ==========================================================
   */
  public static exportFeedbackSheetToExcel(
    sheetData:
      CXFeedbackSheetData
  ): void {

    const workbook =
      XLSX.utils.book_new();


    const sheetAny =
      sheetData as any;


    const reportDepartment =
      sheetData
        .reportAuthorDepartment ||
      "고객행복팀";


    const peerGroupAvg =
      sheetData
        .peerGroupAvg ??
      null;


    const hasPreviousData =
      Boolean(
        sheetAny.previousPeriod &&
        sheetAny.previousSampleSize >
          0
      );


    /**
     * ========================================================
     * Sheet 1: Feedback Summary
     * ========================================================
     */

    const overviewData:
      any[][] = [

      [
        "환자경험평가(CX) Feedback Sheet",
        "",
      ],

      [
        "분석대상",
        sheetData.departmentName,
      ],

      [
        "분석유형",
        sheetData.peerGroupLabel ||
          sheetData.departmentType,
      ],

      [
        "Source Sheet",
        sheetData.sourceSheet ||
          "",
      ],

      [
        "평가기간",
        sheetData.period ||
          "현재 업로드 자료",
      ],

      [
        "작성부서",
        reportDepartment,
      ],

      [
        "사례수",
        sheetData.sampleSize,
      ],

      [
        "종합점수",
        sheetData.overallScore,
      ],

      [
        "은평성모병원 기준",
        sheetData.hospitalAvg,
      ],

      [
        "병원 기준 대비 격차",
        Number(
          (
            sheetData.overallScore -
            sheetData.hospitalAvg
          ).toFixed(1)
        ),
      ],

      [
        "동일유형 평균",
        peerGroupAvg ??
          "",
      ],

      [
        "동일유형 평균 대비 격차",
        peerGroupAvg !==
        null
          ? Number(
              (
                sheetData.overallScore -
                peerGroupAvg
              ).toFixed(1)
            )
          : "",
      ],

      [
        "동일유형 순위",
        `${sheetData.rank}위 / ${sheetData.totalRanked}개`,
      ],

      [
        "전기 비교",
        hasPreviousData
          ? `${sheetData.previousScore} → ${sheetData.overallScore} (${this.formatSigned(
              sheetData.scoreChange
            )})`
          : "비교 데이터 없음",
      ],

      [
        "관리등급",
        sheetData.priority,
      ],

      [
        "상태",
        sheetData.status,
      ],

      [],

      [
        "[AI 종합 진단]",
        "",
      ],

      [
        "핵심 문제",
        sheetData.aiDiagnosis
          .coreProblem,
      ],

      [
        "종합 분석",
        sheetData.aiDiagnosis
          .executiveSummary,
      ],

      [
        "상세 진단",
        sheetData.aiDiagnosis
          .detailedDiagnosis,
      ],

      [],

      [
        "[주요 근거]",
        "",
      ],

      ...(
        sheetData.aiDiagnosis
          .evidence ||
        []
      ).map(
        (
          evidence,
          index
        ) => [
          `${index + 1}`,
          evidence,
        ]
      ),
    ];


    const overviewSheet =
      XLSX.utils.aoa_to_sheet(
        overviewData
      );


    overviewSheet[
      "!cols"
    ] = [
      {
        wch: 26,
      },
      {
        wch: 90,
      },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        overviewSheet,
        "Feedback요약"
      );


    /**
     * ========================================================
     * Sheet 2: Quantitative Scores
     * ========================================================
     */

    const scoreRows:
      any[][] = [
      [
        "구분",
        "평가영역",
        "세부문항",
        "현재점수",
        "은평성모병원 기준",
        "동일유형 평균",
        "동일유형 최고",
        "동일유형 순위",
        "상태",
      ],
    ];


    sheetData.domainScores
      .forEach(
        (
          domain: any
        ) => {

          scoreRows.push([
            "영역",
            domain.domainName,
            "",
            this.excelValue(
              domain.currentScore
            ),
            this.excelValue(
              domain.hospitalAvg
            ),
            this.excelValue(
              domain.peerGroupAvg
            ),
            this.excelValue(
              domain.topScore
            ),
            "",
            domain.status ||
              "",
          ]);


          const questions =
            Array.isArray(
              domain.questions
            )
              ? domain.questions
              : [];


          questions.forEach(
            (
              question: any
            ) => {

              scoreRows.push([
                "세부문항",
                domain.domainName,
                question.questionText ||
                  "",
                this.excelValue(
                  question.currentScore
                ),
                this.excelValue(
                  question.hospitalAvg
                ),
                this.excelValue(
                  question.peerGroupAvg
                ),
                this.excelValue(
                  question.topPerformerScore
                ),
                question.totalDepartments
                  ? `${question.rank}위 / ${question.totalDepartments}개`
                  : "",
                question.status ||
                  "",
              ]);
            }
          );
        }
      );


    const scoreSheet =
      XLSX.utils.aoa_to_sheet(
        scoreRows
      );


    scoreSheet[
      "!cols"
    ] = [
      { wch: 12 },
      { wch: 24 },
      { wch: 60 },
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        scoreSheet,
        "정량분석"
      );


    /**
     * ========================================================
     * Sheet 3: Actual Related VOC
     * ========================================================
     */

    const relatedVocItems =
      Array.isArray(
        sheetData.relatedVocItems
      )
        ? sheetData
            .relatedVocItems
        : [];


    const vocRows:
      any[][] = [
      [
        "응답일",
        "원본 감성",
        "추천의향",
        "원본 분류",
        "부문",
        "센터",
        "진료과",
        "의사",
        "병동",
        "검사실",
        "VOC 내용",
      ],
    ];


    relatedVocItems
      .forEach(
        (
          voc: any
        ) => {

          vocRows.push([
            voc.date ||
              "",
            this.sentimentLabel(
              voc.sentiment
            ),
            voc.recommendationScore ??
              "",
            voc.category ||
              "",
            voc.division ||
              "",
            voc.center ||
              "",
            voc.department ||
              "",
            voc.doctor ||
              "",
            voc.ward ||
              "",
            voc.examRoom ||
              "",
            voc.content ||
              "",
          ]);
        }
      );


    /**
     * VOC가 없으면 가짜 행을 만들지 않습니다.
     */
    if (
      relatedVocItems.length ===
      0
    ) {

      vocRows.push([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "해당 분석대상과 직접 연결된 VOC 없음",
      ]);
    }


    const vocSheet =
      XLSX.utils.aoa_to_sheet(
        vocRows
      );


    vocSheet[
      "!cols"
    ] = [
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 100 },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        vocSheet,
        "관련VOC"
      );


    /**
     * ========================================================
     * Sheet 4: AI VOC Issues
     * ========================================================
     */

    const aiVocRows:
      any[][] = [
      [
        "이슈",
        "건수",
        "감성",
        "요약",
        "대표 VOC",
      ],
    ];


    (
      sheetData.topVocIssues ||
      []
    ).forEach(
      (
        issue
      ) => {

        aiVocRows.push([
          issue.category,
          issue.count,
          issue.sentiment,
          issue.summary,
          (
            issue.representativeQuotes ||
            []
          ).join(
            "\n"
          ),
        ]);
      }
    );


    const aiVocSheet =
      XLSX.utils.aoa_to_sheet(
        aiVocRows
      );


    aiVocSheet[
      "!cols"
    ] = [
      { wch: 24 },
      { wch: 10 },
      { wch: 12 },
      { wch: 70 },
      { wch: 100 },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        aiVocSheet,
        "AI_VOC분석"
      );


    /**
     * ========================================================
     * Sheet 5: Action Plans
     * ========================================================
     */

    const actionRows:
      any[][] = [
      [
        "우선순위",
        "개선과제명",
        "실행방법",
        "적용대상",
        "적용일정",
        "기대효과",
        "KPI",
      ],
    ];


    (
      sheetData.actionPlans ||
      []
    )
      .slice(
        0,
        3
      )
      .forEach(
        (
          action,
          index
        ) => {

          actionRows.push([
            index + 1,
            action.title,
            action.method,
            action.target,
            action.schedule,
            action.expectedEffect,
            action.kpi,
          ]);
        }
      );


    const actionSheet =
      XLSX.utils.aoa_to_sheet(
        actionRows
      );


    actionSheet[
      "!cols"
    ] = [
      { wch: 10 },
      { wch: 36 },
      { wch: 80 },
      { wch: 30 },
      { wch: 30 },
      { wch: 60 },
      { wch: 40 },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        actionSheet,
        "ActionPlan"
      );


    /**
     * ========================================================
     * Sheet 6: Benchmark
     * ========================================================
     */

    const benchmark =
      sheetData
        .benchmarkBestPractice;


    const benchmarkRows:
      any[][] = [
      [
        "항목",
        "내용",
      ],

      [
        "동일유형 우수부서",
        sheetData.topPerformerName ||
          "",
      ],

      [
        "근거 유형",
        benchmark?.sourceType ||
          "NONE",
      ],

      [
        "참고부서",
        benchmark?.sourceDepartment ||
          sheetData.topPerformerName ||
          "",
      ],

      [
        "제목",
        benchmark?.title ||
          "관련 모범사례 없음",
      ],

      [
        "설명",
        benchmark?.description ||
          "실제 운영사례 또는 관련 긍정 VOC 근거가 충분하지 않아 구체적인 모범사례를 제시하지 않습니다.",
      ],

      [
        "AI 추천 여부",
        benchmark?.aiRecommended
          ? "예"
          : "아니오",
      ],

      [
        "실제 긍정 VOC 근거",
        (
          benchmark?.evidenceQuotes ||
          []
        ).join(
          "\n"
        ),
      ],

      [
        "안내",
        benchmark?.disclaimer ||
          "",
      ],
    ];


    const benchmarkSheet =
      XLSX.utils.aoa_to_sheet(
        benchmarkRows
      );


    benchmarkSheet[
      "!cols"
    ] = [
      { wch: 26 },
      { wch: 110 },
    ];


    XLSX.utils
      .book_append_sheet(
        workbook,
        benchmarkSheet,
        "Benchmark"
      );


    /**
     * ========================================================
     * Download
     * ========================================================
     */

    const safeDepartmentName =
      this.sanitizeFileName(
        sheetData.departmentName
      );


    const safePeriod =
      this.sanitizeFileName(
        sheetData.period ||
          "현재자료"
      );


    XLSX.writeFile(
      workbook,
      `${safeDepartmentName}_CX_Feedback_${safePeriod}.xlsx`
    );
  }


  /**
   * ==========================================================
   * 4. Batch Feedback Sheet Excel Export
   * ==========================================================
   *
   * 여러 분석단위에서 생성된 Feedback Sheet를
   * 하나의 Excel Workbook으로 묶어서 다운로드합니다.
   *
   * 구성:
   * - 00_목록
   * - 분석대상별 Feedback Report Sheet
   *
   * 각 분석대상은 한 장의 Sheet 안에서
   * 정량결과 / AI 진단 / VOC / Action Plan까지 확인할 수 있습니다.
   */
  public static exportBatchFeedbackSheetsToExcel(
    feedbackSheets:
      CXFeedbackSheetData[]
  ): void {

    const safeSheets =
      Array.isArray(
        feedbackSheets
      )
        ? feedbackSheets.filter(
            Boolean
          )
        : [];


    if (
      safeSheets.length ===
      0
    ) {

      throw new Error(
        "NO_BATCH_FEEDBACK_SHEETS"
      );
    }


    const workbook =
      XLSX.utils.book_new();


    const indexRows:
      any[][] = [
        [
          "No.",
          "분석대상",
          "분석유형",
          "평가기간",
          "사례수",
          "종합점수",
          "동일유형 평균",
          "그룹 내 순위",
          "관리등급",
          "상태",
          "Sheet명",
        ],
      ];


    const usedSheetNames =
      new Set<string>([
        "00_목록",
      ]);


    safeSheets.forEach(
      (
        sheetData,
        index
      ) => {

        const rawSheetName =
          `${index + 1}_${sheetData.departmentName}`;


        const reportSheetName =
          this.makeUniqueExcelSheetName(
            rawSheetName,
            usedSheetNames
          );


        usedSheetNames.add(
          reportSheetName
        );


        indexRows.push([
          index + 1,
          sheetData.departmentName,
          sheetData.peerGroupLabel ||
            sheetData.departmentType,
          sheetData.period ||
            "현재 업로드 자료",
          sheetData.sampleSize,
          sheetData.overallScore,
          this.excelValue(
            sheetData.peerGroupAvg
          ),
          this.rankLabel(
            sheetData
          ),
          sheetData.priority,
          sheetData.status,
          reportSheetName,
        ]);


        const reportRows =
          this.buildCompactFeedbackReportRows(
            sheetData
          );


        const reportSheet =
          XLSX.utils.aoa_to_sheet(
            reportRows
          );


        reportSheet["!cols"] = [
          { wch: 22 },
          { wch: 80 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
          { wch: 18 },
        ];


        reportSheet["!freeze"] = {
          xSplit: 0,
          ySplit: 2,
        };


        XLSX.utils
          .book_append_sheet(
            workbook,
            reportSheet,
            reportSheetName
          );
      }
    );


    const indexSheet =
      XLSX.utils.aoa_to_sheet(
        indexRows
      );


    indexSheet["!cols"] = [
      { wch: 8 },
      { wch: 26 },
      { wch: 20 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 28 },
    ];


    indexSheet["!autofilter"] = {
      ref:
        `A1:K${Math.max(
          1,
          indexRows.length
        )}`,
    };


    indexSheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
    };


    /**
     * 첫 번째 Sheet가 목록이 되도록 새 Workbook에 다시 구성
     */
    const finalWorkbook =
      XLSX.utils.book_new();


    XLSX.utils
      .book_append_sheet(
        finalWorkbook,
        indexSheet,
        "00_목록"
      );


    workbook.SheetNames.forEach(
      (
        sheetName
      ) => {

        const sheet =
          workbook.Sheets[
            sheetName
          ];


        if (
          sheet
        ) {

          XLSX.utils
            .book_append_sheet(
              finalWorkbook,
              sheet,
              sheetName
            );
        }
      }
    );


    this.enableWorkbookRecalculation(
      finalWorkbook
    );


    const safePeriod =
      this.sanitizeFileName(
        safeSheets[0]
          ?.period ||
          "현재자료"
      );


    XLSX.writeFile(
      finalWorkbook,
      `CX_Feedback_일괄보고서_${safePeriod}.xlsx`
    );
  }


  /**
   * ==========================================================
   * 5. Ward Nursing Team Integrated Excel Export
   * ==========================================================
   *
   * 병동간호 1팀 / 2팀 통합보고서
   *
   * Sheet 1: 병동Feedback조회
   * - B3에 병동명을 선택/입력
   * - 선택 병동의 Feedback Report 핵심내용 표시
   *
   * Sheet 2: 병동종합현황
   * - 병동간호 1팀 / 2팀 병동별 종합점수
   * - 팀 내 순위
   * - 표본수
   * - 최저 영역 및 점수
   *
   * Sheet 3: Feedback원본
   * - 조회 Sheet에서 INDEX/MATCH가 참조하는 데이터
   */
  public static exportWardTeamIntegratedReportToExcel(
    reportData:
      WardTeamExcelReportData
  ): void {

    if (
      !reportData ||
      !Array.isArray(
        reportData.rows
      ) ||
      reportData.rows.length ===
        0
    ) {

      throw new Error(
        "NO_WARD_TEAM_REPORT_DATA"
      );
    }


    const workbook =
      XLSX.utils.book_new();


    const includedRows =
      reportData.rows.filter(
        (
          row
        ) =>
          row.team ===
            "NURSING_TEAM_1" ||
          row.team ===
            "NURSING_TEAM_2"
      );


    if (
      includedRows.length ===
      0
    ) {

      throw new Error(
        "NO_WARD_TEAM_1_OR_2_DATA"
      );
    }


    const feedbackSheets =
      Array.isArray(
        reportData.feedbackSheets
      )
        ? reportData.feedbackSheets
        : [];


    const feedbackByDepartmentId =
      new Map(
        feedbackSheets.map(
          (
            item
          ) => [
            item.departmentId,
            item,
          ]
        )
      );


    /**
     * ----------------------------------------------------------
     * Sheet 3 데이터를 먼저 생성
     * ----------------------------------------------------------
     */
    const rawRows:
      any[][] = [
        [
          "병동명",
          "병동ID",
          "간호팀",
          "평가기간",
          "표본수",
          "종합점수",
          "팀내순위",
          "팀병동수",
          "최저영역",
          "최저영역점수",
          "AI 핵심문제",
          "AI 종합진단",
          "Action Plan 1",
          "Action Plan 2",
          "Action Plan 3",
        ],
      ];


    includedRows.forEach(
      (
        row
      ) => {

        const feedback =
          feedbackByDepartmentId.get(
            row.departmentId
          );


        const plans =
          feedback?.actionPlans ||
          [];


        rawRows.push([
          row.departmentName,
          row.departmentId,
          this.wardTeamLabel(
            row.team
          ),
          row.period ||
            reportData.period ||
            "",
          row.sampleSize,
          row.overallScore,
          row.teamRank,
          row.teamSize,
          row.lowestDomainName ||
            "",
          this.excelValue(
            row.lowestDomainScore
          ),
          feedback?.aiDiagnosis
            ?.coreProblem ||
            "",
          feedback?.aiDiagnosis
            ?.executiveSummary ||
            "",
          plans[0]
            ? `${plans[0].title} | ${plans[0].method}`
            : "",
          plans[1]
            ? `${plans[1].title} | ${plans[1].method}`
            : "",
          plans[2]
            ? `${plans[2].title} | ${plans[2].method}`
            : "",
        ]);
      }
    );


    const rawSheet =
      XLSX.utils.aoa_to_sheet(
        rawRows
      );


    rawSheet["!cols"] = [
      { wch: 24 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 28 },
      { wch: 14 },
      { wch: 60 },
      { wch: 90 },
      { wch: 80 },
      { wch: 80 },
      { wch: 80 },
    ];


    /**
     * ----------------------------------------------------------
     * Sheet 1: 병동 Feedback 조회
     * ----------------------------------------------------------
     */
    const lookupRows:
      any[][] = [
        [
          "병동간호 1·2팀 Feedback 통합 조회",
          "",
        ],
        [
          "평가기간",
          reportData.period ||
            "",
        ],
        [
          "병동 선택",
          includedRows[0]
            ?.departmentName ||
            "",
        ],
        [],
        [
          "항목",
          "조회 결과",
        ],
        [
          "간호팀",
          "",
        ],
        [
          "사례수",
          "",
        ],
        [
          "종합점수",
          "",
        ],
        [
          "팀 내 순위",
          "",
        ],
        [
          "최저 점수 영역",
          "",
        ],
        [
          "최저 영역 점수",
          "",
        ],
        [],
        [
          "AI 핵심 문제",
          "",
        ],
        [
          "AI 종합 진단",
          "",
        ],
        [],
        [
          "Action Plan 1",
          "",
        ],
        [
          "Action Plan 2",
          "",
        ],
        [
          "Action Plan 3",
          "",
        ],
        [],
        [
          "사용 안내",
          "B3 셀에서 병동명을 선택하거나 병동명을 직접 입력하면 해당 병동의 보고서가 자동 조회됩니다.",
        ],
      ];


    const lookupSheet =
      XLSX.utils.aoa_to_sheet(
        lookupRows
      );


    /**
     * INDEX/MATCH 방식으로 병동 선택값(B3)을 조회합니다.
     * XLOOKUP보다 구버전 Excel 호환성이 높습니다.
     *
     * Feedback원본:
     * A 병동명
     * C 간호팀
     * E 표본수
     * F 종합점수
     * G 팀내순위
     * H 팀병동수
     * I 최저영역
     * J 최저영역점수
     * K AI핵심문제
     * L AI종합진단
     * M~O Action Plan
     */
    lookupSheet["B6"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$C:$C,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B7"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$E:$E,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B8"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$F:$F,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B9"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$G:$G,MATCH($B$3,Feedback원본!$A:$A,0))&"위 / "&INDEX(Feedback원본!$H:$H,MATCH($B$3,Feedback원본!$A:$A,0))&"개","")`,
    };


    lookupSheet["B10"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$I:$I,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B11"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$J:$J,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B13"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$K:$K,MATCH($B$3,Feedback원본!$A:$A,0)),"Feedback Sheet 미생성")`,
    };


    lookupSheet["B14"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$L:$L,MATCH($B$3,Feedback원본!$A:$A,0)),"Feedback Sheet 미생성")`,
    };


    lookupSheet["B16"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$M:$M,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B17"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$N:$N,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    lookupSheet["B18"] = {
      t: "n",
      f:
        `IFERROR(INDEX(Feedback원본!$O:$O,MATCH($B$3,Feedback원본!$A:$A,0)),"")`,
    };


    /**
     * SheetJS 버전에 따라 Data Validation 보존 지원이 달라질 수 있으므로
     * 선택목록을 별도 셀에도 제공하고,
     * 가능한 환경에서는 B3에 목록형 Validation 메타데이터도 함께 기록합니다.
     */
    lookupSheet["D2"] = {
      t: "s",
      v: "선택 가능한 병동",
    };


    includedRows.forEach(
      (
        row,
        index
      ) => {

        const cellAddress =
          XLSX.utils.encode_cell({
            r:
              index +
              2,
            c:
              3,
          });


        lookupSheet[
          cellAddress
        ] = {
          t: "s",
          v:
            row.departmentName,
        };
      }
    );


    (
      lookupSheet as any
    )["!dataValidation"] = [
      {
        sqref:
          "B3",

        type:
          "list",

        allowBlank:
          false,

        formula1:
          `$D$3:$D$${includedRows.length + 2}`,
      },
    ];


    lookupSheet["!cols"] = [
      { wch: 24 },
      { wch: 90 },
      { wch: 4 },
      { wch: 28 },
    ];


    /**
     * ----------------------------------------------------------
     * Sheet 2: 병동 종합현황
     * ----------------------------------------------------------
     */
    const summaryRows:
      any[][] = [
        [
          "병동간호팀",
          "병동명",
          "평가기간",
          "표본수",
          "종합점수",
          "팀 내 순위",
          "팀 병동수",
          "최저 점수 영역",
          "최저 영역 점수",
        ],
      ];


    includedRows
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          this.wardTeamSortOrder(
            a.team
          ) -
            this.wardTeamSortOrder(
              b.team
            ) ||
          a.teamRank -
            b.teamRank ||
          b.overallScore -
            a.overallScore
      )
      .forEach(
        (
          row
        ) => {

          summaryRows.push([
            this.wardTeamLabel(
              row.team
            ),
            row.departmentName,
            row.period ||
              reportData.period ||
              "",
            row.sampleSize,
            row.overallScore,
            row.teamRank,
            row.teamSize,
            row.lowestDomainName ||
              "",
            this.excelValue(
              row.lowestDomainScore
            ),
          ]);
        }
      );


    /**
     * 팀 요약도 같은 Sheet 하단에 추가
     */
    summaryRows.push(
      [],
      [
        "[팀별 요약]",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "병동간호팀",
        "병동수",
        "총 표본수",
        "평균점수",
        "최고점 병동",
        "최고점",
        "최저점 병동",
        "최저점",
        "",
      ]
    );


    (
      reportData.teamSummaries ||
      []
    )
      .filter(
        (
          item
        ) =>
          item.team ===
            "NURSING_TEAM_1" ||
          item.team ===
            "NURSING_TEAM_2"
      )
      .forEach(
        (
          item
        ) => {

          summaryRows.push([
            item.teamLabel ||
              this.wardTeamLabel(
                item.team
              ),
            item.wardCount,
            item.sampleSize,
            item.averageScore,
            item.topWardName ||
              "",
            this.excelValue(
              item.topWardScore
            ),
            item.bottomWardName ||
              "",
            this.excelValue(
              item.bottomWardScore
            ),
            "",
          ]);
        }
      );


    const summarySheet =
      XLSX.utils.aoa_to_sheet(
        summaryRows
      );


    summarySheet["!cols"] = [
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
      { wch: 14 },
    ];


    summarySheet["!autofilter"] = {
      ref:
        `A1:I${includedRows.length + 1}`,
    };


    summarySheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
    };


    /**
     * 요구한 순서:
     * 1) 병동 선택형 Feedback 조회
     * 2) 병동 종합현황
     * 3) 조회용 원본
     */
    XLSX.utils
      .book_append_sheet(
        workbook,
        lookupSheet,
        "병동Feedback조회"
      );


    XLSX.utils
      .book_append_sheet(
        workbook,
        summarySheet,
        "병동종합현황"
      );


    XLSX.utils
      .book_append_sheet(
        workbook,
        rawSheet,
        "Feedback원본"
      );


    this.enableWorkbookRecalculation(
      workbook
    );


    const safePeriod =
      this.sanitizeFileName(
        reportData.period ||
        "현재자료"
      );


    XLSX.writeFile(
      workbook,
      `병동간호1_2팀_CX_종합보고서_${safePeriod}.xlsx`
    );
  }


  /**
   * ==========================================================
   * 6. Legacy Sample Template API
   * ==========================================================
   *
   * 운영버전에서는 샘플 데이터 파일을 생성하지 않습니다.
   *
   * 기존 UI에서 이 메서드를 참조할 가능성이 있으므로
   * 현재는 메서드 시그니처만 유지합니다.
   *
   * 다음 단계에서 DataUploadView의
   * 샘플 양식 버튼 자체를 제거합니다.
   */
  public static downloadSampleTemplate(): void {

    console.warn(
      "[ExcelService] Sample template download is disabled in production."
    );
  }


  /**
   * ==========================================================
   * Helpers
   * ==========================================================
   */

  private static buildCompactFeedbackReportRows(
    sheetData:
      CXFeedbackSheetData
  ): any[][] {

    const rows:
      any[][] = [
        [
          "환자경험평가(CX) Feedback Report",
          "",
        ],
        [
          "분석대상",
          sheetData.departmentName,
        ],
        [
          "분석유형",
          sheetData.peerGroupLabel ||
            sheetData.departmentType,
        ],
        [
          "평가기간",
          sheetData.period ||
            "현재 업로드 자료",
        ],
        [
          "표본수",
          sheetData.sampleSize,
        ],
        [
          "종합점수",
          sheetData.overallScore,
        ],
        [
          "동일유형 평균",
          this.excelValue(
            sheetData.peerGroupAvg
          ),
        ],
        [
          "그룹 내 순위",
          this.rankLabel(
            sheetData
          ),
        ],
        [
          "관리등급",
          sheetData.priority,
        ],
        [
          "상태",
          sheetData.status,
        ],
        [],
        [
          "[AI 종합 진단]",
          "",
        ],
        [
          "핵심 문제",
          sheetData.aiDiagnosis
            ?.coreProblem ||
            "",
        ],
        [
          "종합 분석",
          sheetData.aiDiagnosis
            ?.executiveSummary ||
            "",
        ],
        [
          "상세 진단",
          sheetData.aiDiagnosis
            ?.detailedDiagnosis ||
            "",
        ],
        [],
        [
          "[평가영역별 점수]",
          "",
          "",
          "",
          "",
          "",
          "",
        ],
        [
          "평가영역",
          "현재점수",
          "병원 기준",
          "동일유형 평균",
          "동일유형 최고",
          "상태",
          "",
        ],
      ];


    (
      sheetData.domainScores ||
      []
    ).forEach(
      (
        domain
      ) => {

        rows.push([
          domain.domainName,
          this.excelValue(
            domain.currentScore
          ),
          this.excelValue(
            domain.hospitalAvg
          ),
          this.excelValue(
            domain.peerGroupAvg
          ),
          this.excelValue(
            domain.topScore
          ),
          domain.status ||
            "",
          "",
        ]);
      }
    );


    rows.push(
      [],
      [
        "[주요 VOC]",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "분류",
        "건수",
        "감성",
        "요약",
        "대표 VOC",
        "",
        "",
      ]
    );


    (
      sheetData.topVocIssues ||
      []
    ).forEach(
      (
        issue
      ) => {

        rows.push([
          issue.category,
          issue.count,
          issue.sentiment,
          issue.summary,
          (
            issue.representativeQuotes ||
            []
          ).join(
            "\n"
          ),
          "",
          "",
        ]);
      }
    );


    if (
      (
        sheetData.topVocIssues ||
        []
      ).length ===
      0
    ) {

      rows.push([
        "",
        0,
        "",
        "해당 분석단위와 직접 연결된 VOC 없음",
        "",
        "",
        "",
      ]);
    }


    rows.push(
      [],
      [
        "[Action Plan]",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [
        "우선순위",
        "개선과제명",
        "실행방법",
        "적용대상",
        "적용일정",
        "기대효과",
        "KPI",
      ]
    );


    (
      sheetData.actionPlans ||
      []
    )
      .slice(
        0,
        3
      )
      .forEach(
        (
          action,
          index
        ) => {

          rows.push([
            index + 1,
            action.title,
            action.method,
            action.target,
            action.schedule,
            action.expectedEffect,
            action.kpi,
          ]);
        }
      );


    if (
      (
        sheetData.actionPlans ||
        []
      ).length ===
      0
    ) {

      rows.push([
        "",
        "근거가 충분한 Action Plan 없음",
        "",
        "",
        "",
        "",
        "",
      ]);
    }


    return rows;
  }


  private static rankLabel(
    sheetData:
      CXFeedbackSheetData
  ): string {

    const rank =
      sheetData.peerGroupRank ??
      sheetData.rank;


    const size =
      sheetData.peerGroupSize ??
      sheetData.totalRanked;


    if (
      !Number.isFinite(
        rank
      ) ||
      !Number.isFinite(
        size
      ) ||
      rank <=
        0 ||
      size <=
        0
    ) {

      return "순위 제외";
    }


    return `${rank}위 / ${size}개`;
  }


  private static makeUniqueExcelSheetName(
    rawName:
      string,
    used:
      Set<string>
  ): string {

    const sanitized =
      String(
        rawName ||
        "Report"
      )
        .replace(
          /[\\/?*[\]:]/g,
          "_"
        )
        .trim();


    const base =
      (
        sanitized ||
        "Report"
      ).slice(
        0,
        31
      );


    if (
      !used.has(
        base
      )
    ) {

      return base;
    }


    for (
      let index = 2;
      index <
        1000;
      index += 1
    ) {

      const suffix =
        `_${index}`;


      const candidate =
        `${base.slice(
          0,
          Math.max(
            1,
            31 -
              suffix.length
          )
        )}${suffix}`;


      if (
        !used.has(
          candidate
        )
      ) {

        return candidate;
      }
    }


    return `Report_${Date.now()}`.slice(
      0,
      31
    );
  }


  private static wardTeamLabel(
    team:
      string
  ): string {

    if (
      team ===
      "NURSING_TEAM_1"
    ) {
      return "병동간호 1팀";
    }


    if (
      team ===
      "NURSING_TEAM_2"
    ) {
      return "병동간호 2팀";
    }


    if (
      team ===
      "EXCLUDED"
    ) {
      return "순위 제외";
    }


    return "미분류";
  }


  private static wardTeamSortOrder(
    team:
      string
  ): number {

    if (
      team ===
      "NURSING_TEAM_1"
    ) {
      return 1;
    }


    if (
      team ===
      "NURSING_TEAM_2"
    ) {
      return 2;
    }


    if (
      team ===
      "EXCLUDED"
    ) {
      return 3;
    }


    return 4;
  }


  private static enableWorkbookRecalculation(
    workbook:
      XLSX.WorkBook
  ): void {

    const workbookAny =
      workbook as any;


    workbookAny.Workbook =
      workbookAny.Workbook ||
      {};


    workbookAny.Workbook.CalcPr = {
      calcMode:
        "auto",

      fullCalcOnLoad:
        true,

      forceFullCalc:
        true,
    };
  }


  private static excelValue(
    value:
      | number
      | null
      | undefined
  ):
    | number
    | string {

    if (
      value === null ||
      value === undefined ||
      !Number.isFinite(
        value
      )
    ) {
      return "";
    }


    return value;
  }


  private static sentimentLabel(
    sentiment?: string
  ): string {

    if (
      sentiment ===
      "POSITIVE"
    ) {
      return "긍정";
    }


    if (
      sentiment ===
      "NEGATIVE"
    ) {
      return "부정";
    }


    return "중립";
  }


  private static formatSigned(
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


  private static sanitizeFileName(
    value: string
  ): string {

    const result =
      String(
        value || ""
      )
        .replace(
          /[^a-zA-Z0-9가-힣]/g,
          "_"
        )
        .replace(
          /_+/g,
          "_"
        )
        .replace(
          /^_|_$/g,
          ""
        );


    return (
      result ||
      "report"
    );
  }
}