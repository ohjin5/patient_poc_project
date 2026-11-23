import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  convertInchesToTwip,
} from "docx";

import { saveAs } from "file-saver";

import {
  CXFeedbackSheetData,
} from "../types";


export class WordExportService {
  /**
   * ==========================================================
   * Export
   * ==========================================================
   */
  public static async exportFeedbackSheetToDocx(
    sheetData: CXFeedbackSheetData
  ): Promise<void> {

    const doc =
      new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top:
                    convertInchesToTwip(
                      0.65
                    ),

                  bottom:
                    convertInchesToTwip(
                      0.65
                    ),

                  left:
                    convertInchesToTwip(
                      0.65
                    ),

                  right:
                    convertInchesToTwip(
                      0.65
                    ),
                },
              },
            },

            children: [
              this.buildHeader(
                sheetData
              ),

              this.spacing(100),

              this.buildKpiSummaryTable(
                sheetData
              ),

              this.spacing(160),

              this.buildSectionTitle(
                "1. 평가영역 및 세부문항 현황"
              ),

              this.buildDomainScoresTable(
                sheetData
              ),

              this.spacing(160),

              this.buildSectionTitle(
                "2. AI 종합 진단"
              ),

              this.buildDiagnosisBox(
                sheetData
              ),

              this.spacing(160),

              this.buildSectionTitle(
                "3. 주요 환자 VOC 분석"
              ),

              this.buildVocSection(
                sheetData
              ),

              this.spacing(160),

              this.buildSectionTitle(
                "4. 부서 맞춤형 개선 Action Plan"
              ),

              this.buildActionPlansTable(
                sheetData
              ),

              this.spacing(160),

              this.buildSectionTitle(
                "5. 동일유형 우수부서 Benchmark"
              ),

              this.buildBenchmarkBox(
                sheetData
              ),

              this.spacing(180),

              this.buildFooter(
                sheetData
              ),
            ],
          },
        ],
      });


    const blob =
      await Packer.toBlob(
        doc
      );


    const sanitizedDeptName =
      this.sanitizeFileName(
        sheetData.departmentName
      );


    const sanitizedPeriod =
      this.sanitizeFileName(
        sheetData.period ||
          "현재자료"
      );


    const fileName =
      `CX_Feedback_${sanitizedDeptName}_${sanitizedPeriod}.docx`;


    saveAs(
      blob,
      fileName
    );
  }


  /**
   * ==========================================================
   * Header
   * ==========================================================
   */
  private static buildHeader(
    sheetData: CXFeedbackSheetData
  ): Table {

    const reportDepartment =
      sheetData
        .reportAuthorDepartment ||
      "고객행복팀";


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders: {
        top: {
          style:
            BorderStyle.NONE,
        },

        left: {
          style:
            BorderStyle.NONE,
        },

        right: {
          style:
            BorderStyle.NONE,
        },

        bottom: {
          style:
            BorderStyle.SINGLE,
          size: 16,
          color:
            "243B53",
        },

        insideHorizontal: {
          style:
            BorderStyle.NONE,
        },

        insideVertical: {
          style:
            BorderStyle.NONE,
        },
      },

      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: 64,
                type:
                  WidthType.PERCENTAGE,
              },

              children: [
                new Paragraph({
                  spacing: {
                    after: 50,
                  },

                  children: [
                    new TextRun({
                      text:
                        `가톨릭대학교 은평성모병원 · ${reportDepartment}`,

                      size: 16,

                      bold: true,

                      color:
                        "243B53",
                    }),
                  ],
                }),

                new Paragraph({
                  spacing: {
                    after: 50,
                  },

                  children: [
                    new TextRun({
                      text:
                        "환자경험평가(CX) Feedback Sheet",

                      size: 30,

                      bold: true,

                      color:
                        "0F172A",
                    }),
                  ],
                }),

                new Paragraph({
                  children: [
                    new TextRun({
                      text:
                        `평가기간: ${sheetData.period || "현재 업로드 자료"}  |  작성부서: ${reportDepartment}`,

                      size: 17,

                      color:
                        "475569",
                    }),
                  ],
                }),
              ],
            }),

            new TableCell({
              width: {
                size: 36,
                type:
                  WidthType.PERCENTAGE,
              },

              children: [
                new Paragraph({
                  alignment:
                    AlignmentType.RIGHT,

                  spacing: {
                    after: 40,
                  },

                  children: [
                    new TextRun({
                      text:
                        `분석유형: ${
                          sheetData.peerGroupLabel ||
                          sheetData.departmentType
                        }`,

                      size: 15,

                      color:
                        "64748B",
                    }),
                  ],
                }),

                new Paragraph({
                  alignment:
                    AlignmentType.RIGHT,

                  spacing: {
                    after: 40,
                  },

                  children: [
                    new TextRun({
                      text:
                        sheetData.departmentName,

                      size: 25,

                      bold: true,

                      color:
                        "243B53",
                    }),
                  ],
                }),

                new Paragraph({
                  alignment:
                    AlignmentType.RIGHT,

                  children: [
                    new TextRun({
                      text:
                        `관리등급: ${sheetData.priority} / ${sheetData.status}`,

                      size: 16,

                      bold: true,

                      color:
                        "334155",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * KPI
   * ==========================================================
   */
  private static buildKpiSummaryTable(
    sheetData: CXFeedbackSheetData
  ): Table {

    const sheetAny =
      sheetData as any;


    const hasPreviousData =
      Boolean(
        sheetAny.previousPeriod &&
        sheetAny.previousSampleSize >
          0
      );


    const hospitalGap =
      Number(
        (
          sheetData.overallScore -
          sheetData.hospitalAvg
        ).toFixed(1)
      );


    const peerAvg =
      sheetData.peerGroupAvg ??
      0;


    const peerGap =
      peerAvg > 0
        ? Number(
            (
              sheetData.overallScore -
              peerAvg
            ).toFixed(1)
          )
        : null;


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(),

      rows: [
        new TableRow({
          children: [
            this.createKpiCell(
              "종합점수",

              `${sheetData.overallScore.toFixed(
                1
              )}점`,

              `사례수 ${sheetData.sampleSize.toLocaleString()}건`
            ),

            this.createKpiCell(
              "은평성모병원 기준",

              `${sheetData.hospitalAvg.toFixed(
                1
              )}점`,

              `격차 ${this.formatSigned(
                hospitalGap
              )}점`
            ),

            this.createKpiCell(
              "동일유형 평균",

              peerAvg > 0
                ? `${peerAvg.toFixed(
                    1
                  )}점`
                : "-",

              peerGap !== null
                ? `격차 ${this.formatSigned(
                    peerGap
                  )}점`
                : "비교정보 없음"
            ),

            this.createKpiCell(
              "동일유형 순위",

              `${sheetData.rank}위 / ${sheetData.totalRanked}개`,

              sheetData.peerGroupLabel ||
                sheetData.departmentType
            ),

            this.createKpiCell(
              "전기 대비",

              hasPreviousData
                ? `${this.formatSigned(
                    sheetData.scoreChange
                  )}점`
                : "-",

              hasPreviousData
                ? `전기 ${sheetData.previousScore.toFixed(
                    1
                  )}점`
                : "비교 데이터 없음"
            ),
          ],
        }),
      ],
    });
  }


  private static createKpiCell(
    label: string,
    mainValue: string,
    subValue: string
  ): TableCell {

    return new TableCell({
      shading: {
        type:
          ShadingType.CLEAR,

        fill:
          "F8FAFC",
      },

      margins: {
        top: 100,
        bottom: 100,
        left: 70,
        right: 70,
      },

      children: [
        new Paragraph({
          alignment:
            AlignmentType.CENTER,

          spacing: {
            after: 30,
          },

          children: [
            new TextRun({
              text:
                label,

              size: 14,

              color:
                "64748B",
            }),
          ],
        }),

        new Paragraph({
          alignment:
            AlignmentType.CENTER,

          spacing: {
            after: 30,
          },

          children: [
            new TextRun({
              text:
                mainValue,

              size: 23,

              bold: true,

              color:
                "1E293B",
            }),
          ],
        }),

        new Paragraph({
          alignment:
            AlignmentType.CENTER,

          children: [
            new TextRun({
              text:
                subValue,

              size: 12,

              color:
                "94A3B8",
            }),
          ],
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * Domain / Question Table
   * ==========================================================
   */
  private static buildDomainScoresTable(
    sheetData: CXFeedbackSheetData
  ): Table {

    const headerRow =
      new TableRow({
        tableHeader:
          true,

        children: [
          this.createTableHeaderCell(
            "평가영역 / 세부문항",
            AlignmentType.LEFT,
            38
          ),

          this.createTableHeaderCell(
            "현재",
            AlignmentType.RIGHT,
            13
          ),

          this.createTableHeaderCell(
            "병원 기준",
            AlignmentType.RIGHT,
            13
          ),

          this.createTableHeaderCell(
            "동일유형 평균",
            AlignmentType.RIGHT,
            13
          ),

          this.createTableHeaderCell(
            "동일유형 최고",
            AlignmentType.RIGHT,
            13
          ),

          this.createTableHeaderCell(
            "상태",
            AlignmentType.CENTER,
            10
          ),
        ],
      });


    const rows:
      TableRow[] = [];


    for (
      const domain of
      sheetData.domainScores
    ) {

      rows.push(
        new TableRow({
          children: [
            this.createTableCell(
              domain.domainName,
              AlignmentType.LEFT,
              38,
              true,
              "1E293B",
              "FFFFFF"
            ),

            this.createTableCell(
              this.formatScore(
                domain.currentScore
              ),
              AlignmentType.RIGHT,
              13,
              true,
              "1E293B",
              "FFFFFF"
            ),

            this.createTableCell(
              this.formatScore(
                domain.hospitalAvg
              ),
              AlignmentType.RIGHT,
              13,
              false,
              "64748B",
              "FFFFFF"
            ),

            this.createTableCell(
              this.formatScore(
                domain.peerGroupAvg
              ),
              AlignmentType.RIGHT,
              13,
              false,
              "64748B",
              "FFFFFF"
            ),

            this.createTableCell(
              this.formatScore(
                domain.topScore
              ),
              AlignmentType.RIGHT,
              13,
              false,
              "243B53",
              "FFFFFF"
            ),

            this.createTableCell(
              domain.status,
              AlignmentType.CENTER,
              10,
              true,
              "475569",
              "FFFFFF"
            ),
          ],
        })
      );


      const questions =
        Array.isArray(
          (domain as any)
            .questions
        )
          ? (domain as any)
              .questions
          : [];


      for (
        const question of
        questions
      ) {

        rows.push(
          new TableRow({
            children: [
              this.createTableCell(
                `↳ ${question.questionText}`,

                AlignmentType.LEFT,

                38,

                false,

                "475569",

                "F8FAFC"
              ),

              this.createTableCell(
                this.formatScore(
                  question.currentScore
                ),

                AlignmentType.RIGHT,

                13,

                true,

                "334155",

                "F8FAFC"
              ),

              this.createTableCell(
                this.formatScore(
                  question.hospitalAvg
                ),

                AlignmentType.RIGHT,

                13,

                false,

                "64748B",

                "F8FAFC"
              ),

              this.createTableCell(
                this.formatScore(
                  question.peerGroupAvg
                ),

                AlignmentType.RIGHT,

                13,

                false,

                "64748B",

                "F8FAFC"
              ),

              this.createTableCell(
                this.formatScore(
                  question.topPerformerScore
                ),

                AlignmentType.RIGHT,

                13,

                false,

                "64748B",

                "F8FAFC"
              ),

              this.createTableCell(
                question.totalDepartments
                  ? `${question.rank}위`
                  : "-",

                AlignmentType.CENTER,

                10,

                false,

                "64748B",

                "F8FAFC"
              ),
            ],
          })
        );
      }
    }


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(),

      rows: [
        headerRow,
        ...rows,
      ],
    });
  }


  /**
   * ==========================================================
   * Diagnosis
   * ==========================================================
   */
  private static buildDiagnosisBox(
    sheetData: CXFeedbackSheetData
  ): Table {

    const evidenceParagraphs =
      (
        sheetData
          .aiDiagnosis
          .evidence ||
        []
      ).map(
        (
          evidence
        ) =>
          new Paragraph({
            spacing: {
              after: 35,
            },

            children: [
              new TextRun({
                text:
                  "• ",

                bold: true,

                size: 16,

                color:
                  "243B53",
              }),

              new TextRun({
                text:
                  evidence,

                size: 16,

                color:
                  "475569",
              }),
            ],
          })
      );


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(
          "D9E1EA"
        ),

      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: {
                type:
                  ShadingType.CLEAR,

                fill:
                  "F8FAFC",
              },

              margins: {
                top: 120,
                bottom: 120,
                left: 130,
                right: 130,
              },

              children: [
                new Paragraph({
                  spacing: {
                    after: 60,
                  },

                  children: [
                    new TextRun({
                      text:
                        "핵심 문제: ",

                      size: 17,

                      bold: true,

                      color:
                        "243B53",
                    }),

                    new TextRun({
                      text:
                        sheetData
                          .aiDiagnosis
                          .coreProblem ||
                        "분석 결과 없음",

                      size: 17,

                      bold: true,

                      color:
                        "1E293B",
                    }),
                  ],
                }),

                new Paragraph({
                  spacing: {
                    after: 70,
                  },

                  children: [
                    new TextRun({
                      text:
                        sheetData
                          .aiDiagnosis
                          .executiveSummary ||
                        "",

                      size: 16,

                      color:
                        "334155",
                    }),
                  ],
                }),

                new Paragraph({
                  spacing: {
                    after: 35,
                  },

                  children: [
                    new TextRun({
                      text:
                        "[주요 근거]",

                      size: 16,

                      bold: true,

                      color:
                        "1E293B",
                    }),
                  ],
                }),

                ...evidenceParagraphs,

                new Paragraph({
                  spacing: {
                    before: 50,
                  },

                  children: [
                    new TextRun({
                      text:
                        "[상세 진단] ",

                      size: 16,

                      bold: true,

                      color:
                        "1E293B",
                    }),

                    new TextRun({
                      text:
                        sheetData
                          .aiDiagnosis
                          .detailedDiagnosis ||
                        "",

                      size: 16,

                      color:
                        "475569",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * VOC
   * ==========================================================
   */
  private static buildVocSection(
    sheetData: CXFeedbackSheetData
  ): Table {

    const relatedVocItems =
      Array.isArray(
        sheetData.relatedVocItems
      )
        ? sheetData
            .relatedVocItems
        : [];


    /**
     * 직접 연결 VOC 없음
     */
    if (
      relatedVocItems.length ===
      0
    ) {

      return new Table({
        width: {
          size: 100,
          type:
            WidthType.PERCENTAGE,
        },

        borders:
          this.standardBorders(),

        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: {
                  type:
                    ShadingType.CLEAR,

                  fill:
                    "F8FAFC",
                },

                margins: {
                  top: 120,
                  bottom: 120,
                  left: 120,
                  right: 120,
                },

                children: [
                  new Paragraph({
                    alignment:
                      AlignmentType.CENTER,

                    children: [
                      new TextRun({
                        text:
                          "해당 분석대상과 직접 연결된 VOC 없음",

                        size: 16,

                        bold: true,

                        color:
                          "475569",
                      }),
                    ],
                  }),

                  new Paragraph({
                    alignment:
                      AlignmentType.CENTER,

                    spacing: {
                      before: 30,
                    },

                    children: [
                      new TextRun({
                        text:
                          "다른 부서의 VOC는 대체하여 표시하지 않습니다.",

                        size: 13,

                        color:
                          "94A3B8",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    }


    const rows =
      relatedVocItems
        .slice(0, 10)
        .map(
          (
            voc: any
          ) => {

            const metaParts =
              [
                voc.division
                  ? `부문 ${voc.division}`
                  : "",

                voc.center
                  ? `센터 ${voc.center}`
                  : "",

                voc.department
                  ? `진료과 ${voc.department}`
                  : "",

                voc.doctor
                  ? `의사 ${voc.doctor}`
                  : "",

                voc.ward
                  ? `병동 ${voc.ward}`
                  : "",

                voc.examRoom
                  ? `검사실 ${voc.examRoom}`
                  : "",
              ]
                .filter(Boolean)
                .join(
                  " | "
                );


            return new TableRow({
              children: [
                this.createTableCell(
                  voc.date ||
                    "응답일 미확인",

                  AlignmentType.LEFT,

                  15,

                  false,

                  "64748B",

                  "FFFFFF"
                ),

                this.createTableCell(
                  this.sentimentLabel(
                    voc.sentiment
                  ),

                  AlignmentType.CENTER,

                  10,

                  true,

                  this.sentimentColor(
                    voc.sentiment
                  ),

                  "FFFFFF"
                ),

                this.createTableCell(
                  voc.category ||
                    "기타",

                  AlignmentType.LEFT,

                  15,

                  true,

                  "475569",

                  "FFFFFF"
                ),

                new TableCell({
                  width: {
                    size: 60,
                    type:
                      WidthType.PERCENTAGE,
                  },

                  margins: {
                    top: 75,
                    bottom: 75,
                    left: 85,
                    right: 85,
                  },

                  children: [
                    metaParts
                      ? new Paragraph({
                          spacing: {
                            after: 30,
                          },

                          children: [
                            new TextRun({
                              text:
                                metaParts,

                              size: 12,

                              color:
                                "94A3B8",
                            }),
                          ],
                        })
                      : new Paragraph({
                          text: "",
                        }),

                    new Paragraph({
                      children: [
                        new TextRun({
                          text:
                            voc.content ||
                            "",

                          size: 15,

                          color:
                            "475569",
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            });
          }
        );


    const header =
      new TableRow({
        tableHeader:
          true,

        children: [
          this.createTableHeaderCell(
            "응답일",
            AlignmentType.LEFT,
            15
          ),

          this.createTableHeaderCell(
            "감성",
            AlignmentType.CENTER,
            10
          ),

          this.createTableHeaderCell(
            "분류",
            AlignmentType.LEFT,
            15
          ),

          this.createTableHeaderCell(
            "실제 관련 VOC",
            AlignmentType.LEFT,
            60
          ),
        ],
      });


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(),

      rows: [
        header,
        ...rows,
      ],
    });
  }


  /**
   * ==========================================================
   * Action Plans
   * ==========================================================
   */
  private static buildActionPlansTable(
    sheetData: CXFeedbackSheetData
  ): Table {

    const plans =
      (
        sheetData.actionPlans ||
        []
      ).slice(
        0,
        3
      );


    if (
      plans.length ===
      0
    ) {

      return new Table({
        width: {
          size: 100,
          type:
            WidthType.PERCENTAGE,
        },

        borders:
          this.standardBorders(),

        rows: [
          new TableRow({
            children: [
              this.createTableCell(
                "생성된 Action Plan이 없습니다.",

                AlignmentType.CENTER,

                100,

                false,

                "64748B",

                "F8FAFC"
              ),
            ],
          }),
        ],
      });
    }


    const headerRow =
      new TableRow({
        tableHeader:
          true,

        children: [
          this.createTableHeaderCell(
            "과제",
            AlignmentType.CENTER,
            10
          ),

          this.createTableHeaderCell(
            "개선과제 / 실행방법",
            AlignmentType.LEFT,
            37
          ),

          this.createTableHeaderCell(
            "적용대상 / 일정",
            AlignmentType.LEFT,
            25
          ),

          this.createTableHeaderCell(
            "기대효과 / KPI",
            AlignmentType.LEFT,
            28
          ),
        ],
      });


    const rows =
      plans.map(
        (
          action,
          index
        ) =>
          new TableRow({
            children: [
              this.createTableCell(
                `과제 ${index + 1}`,

                AlignmentType.CENTER,

                10,

                true,

                "243B53",

                "F8FAFC"
              ),

              new TableCell({
                width: {
                  size: 37,
                  type:
                    WidthType.PERCENTAGE,
                },

                margins: {
                  top: 80,
                  bottom: 80,
                  left: 90,
                  right: 90,
                },

                children: [
                  new Paragraph({
                    spacing: {
                      after: 35,
                    },

                    children: [
                      new TextRun({
                        text:
                          action.title,

                        size: 16,

                        bold: true,

                        color:
                          "1E293B",
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          "실행방법: ",

                        size: 14,

                        bold: true,

                        color:
                          "475569",
                      }),

                      new TextRun({
                        text:
                          action.method ||
                          "-",

                        size: 14,

                        color:
                          "475569",
                      }),
                    ],
                  }),
                ],
              }),

              new TableCell({
                width: {
                  size: 25,
                  type:
                    WidthType.PERCENTAGE,
                },

                margins: {
                  top: 80,
                  bottom: 80,
                  left: 90,
                  right: 90,
                },

                children: [
                  new Paragraph({
                    spacing: {
                      after: 30,
                    },

                    children: [
                      new TextRun({
                        text:
                          `적용대상: ${action.target || "-"}`,

                        size: 14,

                        color:
                          "475569",
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          `적용일정: ${action.schedule || "-"}`,

                        size: 14,

                        color:
                          "64748B",
                      }),
                    ],
                  }),
                ],
              }),

              new TableCell({
                width: {
                  size: 28,
                  type:
                    WidthType.PERCENTAGE,
                },

                margins: {
                  top: 80,
                  bottom: 80,
                  left: 90,
                  right: 90,
                },

                children: [
                  new Paragraph({
                    spacing: {
                      after: 30,
                    },

                    children: [
                      new TextRun({
                        text:
                          `기대효과: ${action.expectedEffect || "-"}`,

                        size: 14,

                        color:
                          "2E7D5B",
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          `KPI: ${action.kpi || "-"}`,

                        size: 14,

                        bold: true,

                        color:
                          "243B53",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          })
      );


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(),

      rows: [
        headerRow,
        ...rows,
      ],
    });
  }


  /**
   * ==========================================================
   * Benchmark
   * ==========================================================
   */
  private static buildBenchmarkBox(
    sheetData: CXFeedbackSheetData
  ): Table {

    const benchmark =
      sheetData
        .benchmarkBestPractice;


    /**
     * 근거 없음
     */
    if (
      !benchmark ||
      benchmark.sourceType ===
        "NONE"
    ) {

      return new Table({
        width: {
          size: 100,
          type:
            WidthType.PERCENTAGE,
        },

        borders:
          this.standardBorders(),

        rows: [
          new TableRow({
            children: [
              new TableCell({
                shading: {
                  type:
                    ShadingType.CLEAR,

                  fill:
                    "F8FAFC",
                },

                margins: {
                  top: 110,
                  bottom: 110,
                  left: 120,
                  right: 120,
                },

                children: [
                  new Paragraph({
                    spacing: {
                      after: 40,
                    },

                    children: [
                      new TextRun({
                        text:
                          benchmark?.title ||
                          "관련 모범사례 없음",

                        size: 16,

                        bold: true,

                        color:
                          "475569",
                      }),
                    ],
                  }),

                  new Paragraph({
                    spacing: {
                      after: 35,
                    },

                    children: [
                      new TextRun({
                        text:
                          benchmark?.description ||
                          "동일유형 우수부서는 확인되나 실제 운영사례 또는 관련 긍정 VOC 근거가 충분하지 않아 구체적인 모범사례를 제시하지 않습니다.",

                        size: 15,

                        color:
                          "64748B",
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          `동일유형 우수부서: ${sheetData.topPerformerName || "정보 없음"}`,

                        size: 13,

                        color:
                          "94A3B8",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      });
    }


    const evidenceParagraphs =
      (
        benchmark.evidenceQuotes ||
        []
      ).map(
        (
          quote
        ) =>
          new Paragraph({
            spacing: {
              after: 35,
            },

            children: [
              new TextRun({
                text:
                  `“${quote}”`,

                size: 14,

                italics: true,

                color:
                  "78350F",
              }),
            ],
          })
      );


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders:
        this.standardBorders(
          "F9E7C4"
        ),

      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: {
                type:
                  ShadingType.CLEAR,

                fill:
                  "FEF8EC",
              },

              margins: {
                top: 110,
                bottom: 110,
                left: 120,
                right: 120,
              },

              children: [
                new Paragraph({
                  spacing: {
                    after: 40,
                  },

                  children: [
                    new TextRun({
                      text:
                        benchmark.sourceType ===
                        "AI_RECOMMENDED"
                          ? `[AI 추천] ${benchmark.title || ""}`
                          : benchmark.title ||
                            "",

                      size: 17,

                      bold: true,

                      color:
                        "8A5B1D",
                    }),
                  ],
                }),

                benchmark.sourceDepartment
                  ? new Paragraph({
                      spacing: {
                        after: 35,
                      },

                      children: [
                        new TextRun({
                          text:
                            `참고부서: ${benchmark.sourceDepartment}`,

                          size: 14,

                          bold: true,

                          color:
                            "78350F",
                        }),
                      ],
                    })
                  : new Paragraph({
                      text:
                        "",
                    }),

                new Paragraph({
                  spacing: {
                    after: 45,
                  },

                  children: [
                    new TextRun({
                      text:
                        benchmark.description ||
                        "",

                      size: 15,

                      color:
                        "78350F",
                    }),
                  ],
                }),

                ...(evidenceParagraphs.length >
                0
                  ? [
                      new Paragraph({
                        spacing: {
                          after: 30,
                        },

                        children: [
                          new TextRun({
                            text:
                              "[실제 긍정 VOC 근거]",

                            size: 14,

                            bold: true,

                            color:
                              "78350F",
                          }),
                        ],
                      }),

                      ...evidenceParagraphs,
                    ]
                  : []),

                benchmark.disclaimer
                  ? new Paragraph({
                      spacing: {
                        before: 35,
                      },

                      children: [
                        new TextRun({
                          text:
                            benchmark.disclaimer,

                          size: 12,

                          color:
                            "8A5B1D",
                        }),
                      ],
                    })
                  : new Paragraph({
                      text:
                        "",
                    }),
              ],
            }),
          ],
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * Footer
   * ==========================================================
   */
  private static buildFooter(
    sheetData: CXFeedbackSheetData
  ): Table {

    const reportDepartment =
      sheetData
        .reportAuthorDepartment ||
      "고객행복팀";


    return new Table({
      width: {
        size: 100,
        type:
          WidthType.PERCENTAGE,
      },

      borders: {
        top: {
          style:
            BorderStyle.SINGLE,

          size: 6,

          color:
            "E2E8F0",
        },

        bottom: {
          style:
            BorderStyle.NONE,
        },

        left: {
          style:
            BorderStyle.NONE,
        },

        right: {
          style:
            BorderStyle.NONE,
        },
      },

      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: 50,
                type:
                  WidthType.PERCENTAGE,
              },

              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text:
                        `발행일자: ${sheetData.generatedAt}  |  작성부서: ${reportDepartment}`,

                      size: 13,

                      color:
                        "64748B",
                    }),
                  ],
                }),
              ],
            }),

            new TableCell({
              width: {
                size: 50,
                type:
                  WidthType.PERCENTAGE,
              },

              children: [
                new Paragraph({
                  alignment:
                    AlignmentType.RIGHT,

                  children: [
                    new TextRun({
                      text:
                        "본 자료는 환자경험 개선을 위한 내부 참고자료입니다.",

                      size: 12,

                      color:
                        "94A3B8",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * Section Title
   * ==========================================================
   */
  private static buildSectionTitle(
    title: string
  ): Paragraph {

    return new Paragraph({
      heading:
        HeadingLevel.HEADING_2,

      spacing: {
        before: 90,
        after: 70,
      },

      children: [
        new TextRun({
          text:
            title,

          size: 21,

          bold: true,

          color:
            "243B53",
        }),
      ],
    });
  }


  /**
   * ==========================================================
   * Helpers
   * ==========================================================
   */
  private static createTableHeaderCell(
    text: string,

    align:
      (typeof AlignmentType)[keyof typeof AlignmentType],

    widthPct: number
  ): TableCell {

    return new TableCell({
      width: {
        size: widthPct,
        type:
          WidthType.PERCENTAGE,
      },

      shading: {
        type:
          ShadingType.CLEAR,

        fill:
          "F1F5F9",
      },

      margins: {
        top: 75,
        bottom: 75,
        left: 75,
        right: 75,
      },

      children: [
        new Paragraph({
          alignment:
            align,

          children: [
            new TextRun({
              text,

              size: 14,

              bold: true,

              color:
                "243B53",
            }),
          ],
        }),
      ],
    });
  }


  private static createTableCell(
    text: string,

    align:
      (typeof AlignmentType)[keyof typeof AlignmentType],

    widthPct: number,

    isBold: boolean,

    colorHex: string,

    bgHex: string
  ): TableCell {

    return new TableCell({
      width: {
        size: widthPct,
        type:
          WidthType.PERCENTAGE,
      },

      shading: {
        type:
          ShadingType.CLEAR,

        fill:
          bgHex,
      },

      margins: {
        top: 65,
        bottom: 65,
        left: 75,
        right: 75,
      },

      children: [
        new Paragraph({
          alignment:
            align,

          children: [
            new TextRun({
              text,

              size: 14,

              bold:
                isBold,

              color:
                colorHex,
            }),
          ],
        }),
      ],
    });
  }


  private static standardBorders(
    color =
      "CBD5E1"
  ) {

    return {
      top: {
        style:
          BorderStyle.SINGLE,
        size: 6,
        color,
      },

      bottom: {
        style:
          BorderStyle.SINGLE,
        size: 6,
        color,
      },

      left: {
        style:
          BorderStyle.SINGLE,
        size: 6,
        color,
      },

      right: {
        style:
          BorderStyle.SINGLE,
        size: 6,
        color,
      },

      insideHorizontal: {
        style:
          BorderStyle.SINGLE,
        size: 3,
        color:
          "E2E8F0",
      },

      insideVertical: {
        style:
          BorderStyle.SINGLE,
        size: 3,
        color:
          "E2E8F0",
      },
    };
  }


  private static spacing(
    after: number
  ): Paragraph {

    return new Paragraph({
      text:
        "",

      spacing: {
        after,
      },
    });
  }


  private static formatScore(
    value?:
      | number
      | null
  ): string {

    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(value)
    ) {
      return "-";
    }


    return `${value.toFixed(
      1
    )}점`;
  }


  private static formatSigned(
    value: number
  ): string {

    if (
      !Number.isFinite(value)
    ) {
      return "-";
    }


    return `${
      value > 0
        ? "+"
        : ""
    }${value.toFixed(
      1
    )}`;
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


  private static sentimentColor(
    sentiment?: string
  ): string {

    if (
      sentiment ===
      "POSITIVE"
    ) {
      return "2E7D5B";
    }


    if (
      sentiment ===
      "NEGATIVE"
    ) {
      return "B94A48";
    }


    return "64748B";
  }


  private static sanitizeFileName(
    value: string
  ): string {

    const sanitized =
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


    return sanitized ||
      "report";
  }
}