import {
  DepartmentSummary,
  DepartmentType,
  PeerGroup,
  PEER_GROUP_LABELS,
  DomainScore,
  QuestionScore,
  RawVocItem,
  UploadedFileMetadata,
  VocCategory,
  SheetType,
  CXSourceSheet,
  CareType,
  ParsedScoreColumn,
} from "../types";

import { PrivacyService } from "./privacyService";

/**
 * ============================================================
 * Validation / Result Types
 * ============================================================
 */

export interface NormalizationValidationSummary {
  totalFiles: number;
  totalSheets: number;
  validSheets: number;
  excludedSheets: number;
  totalDepartmentRows: number;
  totalVocRows: number;
  totalDepartmentsDetected: number;
  warnings: string[];
  excludedDetails: {
    sheetName: string;
    reason: string;
  }[];
}

export interface NormalizedDataset {
  departments: DepartmentSummary[];
  vocList: RawVocItem[];
  period: string;
  validationSummary: NormalizationValidationSummary;
}

/**
 * 내부 Score Sheet 파싱 구조
 */
interface WorkingScoreSheet {
  sheetName: string;
  sourceSheet: CXSourceSheet;
  sheetType: SheetType;
  rows: any[][];
  file: UploadedFileMetadata;
}

interface ScoreSheetLayout {
  topHeaderRowIndex: number;
  subHeaderRowIndex: number;
  dataStartRowIndex: number;

  entityColumnIndex: number;
  parentColumnIndex?: number;

  sampleSizeColumnIndex: number;
  overallScoreColumnIndex: number;

  scoreColumns: ParsedScoreColumn[];
}

interface BaselineData {
  overallScore: number;
  sampleSize: number;
  columnScores: Map<number, number>;
}

interface ParsedEntityRow {
  rawName: string;
  displayName: string;

  parentDepartment?: string;
  parentCenter?: string;

  type: DepartmentType;
  peerGroup: PeerGroup;

  sampleSize: number;
  overallScore: number;

  sourceSheet: CXSourceSheet;

  row: any[];
}

/**
 * ============================================================
 * Safe Cell Helpers
 * ============================================================
 */

export function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\r/g, "")
    .trim();
}

export function normalizeCellLower(value: unknown): string {
  return normalizeCell(value).toLowerCase();
}

function normalizeComparable(value: unknown): string {
  return normalizeCell(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()_\-./]/g, "");
}

function parseNumericValue(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  const text = normalizeCell(value);

  if (
    !text ||
    text === "-" ||
    text === "–" ||
    text === "—" ||
    text.toLowerCase() === "n/a"
  ) {
    return null;
  }

  const parsed = Number(
    text
      .replace(/,/g, "")
      .replace(/점/g, "")
      .replace(/%/g, "")
      .replace(/[^0-9.+-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function parseIntegerValue(
  value: unknown
): number {
  const parsed = parseNumericValue(value);

  if (parsed === null) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(parsed)
  );
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function safeScore(
  value: unknown,
  fallback = 0
): number {
  const parsed =
    parseNumericValue(value);

  return parsed === null
    ? fallback
    : parsed;
}

/**
 * ============================================================
 * Name Helpers
 * ============================================================
 */

export function normalizeWardName(
  value: unknown
): string {
  const name =
    normalizeCell(value);

  if (/^\d+U$/i.test(name)) {
    return name.replace(
      /U$/i,
      "Unit"
    );
  }

  if (/^\d+Unit$/i.test(name)) {
    return name.replace(
      /unit$/i,
      "Unit"
    );
  }

  return name;
}

export function getDepartmentNamePair(
  value: unknown,
  type?: DepartmentType
): {
  rawName: string;
  displayName: string;
} {
  const rawName =
    normalizeCell(value);

  if (!rawName) {
    return {
      rawName: "",
      displayName: "",
    };
  }

  if (
    type === "WARD" ||
    /^\d+U$/i.test(rawName)
  ) {
    return {
      rawName,
      displayName:
        normalizeWardName(rawName),
    };
  }

  return {
    rawName,
    displayName: rawName,
  };
}

/**
 * ============================================================
 * Source Sheet Mapping
 * ============================================================
 */

const KNOWN_SOURCE_SHEETS: CXSourceSheet[] = [
  "외래_센터",
  "외래_진료과",
  "외래_진료과(요약)",
  "외래_의사",
  "입원_병동",
  "입원_진료과",
  "입원_의사",
  "응급_진료과",
  "응급_의사",
  "검사",
  "VOC",
];

const SCORE_SOURCE_SHEETS: CXSourceSheet[] =
  KNOWN_SOURCE_SHEETS.filter(
    (sheet) =>
      sheet !== "VOC" &&
      sheet !== "UNKNOWN"
  );

function detectSourceSheet(
  sheetName: string
): CXSourceSheet {
  const clean =
    normalizeCell(sheetName);

  const exact =
    KNOWN_SOURCE_SHEETS.find(
      (name) =>
        normalizeComparable(name) ===
        normalizeComparable(clean)
    );

  return exact || "UNKNOWN";
}

function mapSourceSheetToSheetType(
  sourceSheet: CXSourceSheet
): SheetType {
  switch (sourceSheet) {
    case "외래_센터":
      return "CENTER";

    case "외래_진료과":
    case "외래_진료과(요약)":
    case "입원_진료과":
    case "응급_진료과":
      return "DEPARTMENT";

    case "입원_병동":
      return "WARD";

    case "외래_의사":
    case "입원_의사":
    case "응급_의사":
      return "DOCTOR";

    case "검사":
      return "EXAM";

    case "VOC":
      return "VOC";

    default:
      return "UNKNOWN";
  }
}

function mapSourceSheetToPeerGroup(
  sourceSheet: CXSourceSheet
): PeerGroup {
  switch (sourceSheet) {
    case "외래_센터":
      return "OUTPATIENT_CENTER";

    case "외래_진료과":
    case "외래_진료과(요약)":
      return "OUTPATIENT_DEPARTMENT";

    case "외래_의사":
      return "OUTPATIENT_DOCTOR";

    case "입원_병동":
      return "INPATIENT_WARD";

    case "입원_진료과":
      return "INPATIENT_DEPARTMENT";

    case "입원_의사":
      return "INPATIENT_DOCTOR";

    case "응급_진료과":
      return "EMERGENCY_DEPARTMENT";

    case "응급_의사":
      return "EMERGENCY_DOCTOR";

    case "검사":
      return "EXAM";

    default:
      return "UNKNOWN";
  }
}

function mapPeerGroupToDepartmentType(
  peerGroup: PeerGroup
): DepartmentType {
  switch (peerGroup) {
    case "OUTPATIENT_CENTER":
      return "CENTER";

    case "OUTPATIENT_DEPARTMENT":
    case "INPATIENT_DEPARTMENT":
    case "EMERGENCY_DEPARTMENT":
      return "DEPARTMENT";

    case "OUTPATIENT_DOCTOR":
    case "INPATIENT_DOCTOR":
    case "EMERGENCY_DOCTOR":
      return "DOCTOR";

    case "INPATIENT_WARD":
      return "WARD";

    case "EXAM":
      return "EXAM";

    default:
      return "UNKNOWN";
  }
}

/**
 * ============================================================
 * Column Aliases
 * ============================================================
 */

export const COLUMN_ALIASES = {
  departmentId: [
    "부서코드",
    "병동코드",
    "과코드",
    "dept_id",
    "department_id",
    "code",
    "id",
  ],

  departmentName: [
    "부서명",
    "진료과명",
    "진료과",
    "병동명",
    "병동",
    "센터명",
    "센터",
    "검사실명",
    "검사실",
    "검사(치료실)",
    "부서",
  ],

  centerName: [
    "센터",
    "센터명",
    "전문센터",
    "진료센터",
  ],

  doctorName: [
    "의사",
    "의사명",
    "교수",
    "교수명",
    "주치의",
    "담당의",
  ],

  wardName: [
    "병동",
    "병동명",
    "병실",
    "unit",
    "ward",
  ],

  examRoomName: [
    "검사실",
    "검사실명",
    "검사(치료실)",
    "검사부서",
  ],

  sampleSize: [
    "사례수",
    "응답수",
    "응답건수",
    "표본수",
    "응답자수",
    "n수",
    "건수",
  ],

  score: [
    "종합점수",
    "평가점수",
    "점수",
    "현재점수",
  ],

  vocContent: [
    "내용",
    "voc",
    "의견",
    "주관식",
    "환자의견",
    "주관식의견",
  ],

  vocDate: [
    "응답완료일",
    "작성일자",
    "작성일",
    "날짜",
    "일자",
  ],

  vocCategory: [
    "분류",
    "카테고리",
    "유형",
  ],

  vocSentiment: [
    "긍/부정",
    "긍부정",
    "감성",
    "sentiment",
  ],

  recommendation: [
    "추천의향",
    "추천점수",
  ],

  division: [
    "부문",
    "입원/외래",
    "환자구분",
  ],

  surveySerial: [
    "설문일련번호",
    "설문번호",
  ],

  patientRegistration: [
    "환자등록번호",
    "등록번호",
  ],
};

/**
 * ============================================================
 * Main Normalization Service
 * ============================================================
 */

export class NormalizationService {
  /**
   * ----------------------------------------------------------
   * Generic column alias lookup
   * ----------------------------------------------------------
   */
  public static findColumnByAlias(
    headers: string[],
    aliases?: string[] | null
  ): number {
    if (
      !Array.isArray(headers) ||
      headers.length === 0
    ) {
      return -1;
    }

    /**
     * COLUMN_ALIASES에 정의되지 않은 항목이 전달되어도
     * 런타임 오류가 발생하지 않도록 방어합니다.
     */
    if (
      !Array.isArray(aliases) ||
      aliases.length === 0
    ) {
      return -1;
    }

    const normalizedHeaders =
      headers.map(
        normalizeComparable
      );

    /**
     * 1차: 완전 일치
     */
    for (
      const alias of aliases
    ) {
      const normalizedAlias =
        normalizeComparable(alias);

      if (!normalizedAlias) {
        continue;
      }

      const exactIndex =
        normalizedHeaders.findIndex(
          (header) =>
            header ===
            normalizedAlias
        );

      if (exactIndex >= 0) {
        return exactIndex;
      }
    }

    /**
     * 2차: 포함 일치
     */
    for (
      const alias of aliases
    ) {
      const normalizedAlias =
        normalizeComparable(alias);

      if (!normalizedAlias) {
        continue;
      }

      const containsIndex =
        normalizedHeaders.findIndex(
          (header) =>
            header.includes(
              normalizedAlias
            )
        );

      if (containsIndex >= 0) {
        return containsIndex;
      }
    }

    return -1;
  }

  /**
   * ----------------------------------------------------------
   * Generic header detector
   *
   * VOC / 기타 단일 헤더 Sheet용
   * ----------------------------------------------------------
   */
  public static detectHeaderRow(
    rows: unknown[][]
  ): {
    index: number;
    headers: string[];
    emptyColumnCount: number;
  } {
    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return {
        index: 0,
        headers: [],
        emptyColumnCount: 0,
      };
    }

    const keywords = [
      "진료과",
      "병동",
      "사례수",
      "종합점수",
      "검사",
      "내용",
      "부문",
      "센터",
      "의사",
      "응답완료일",
      "긍/부정",
      "추천의향",
    ];

    const scanLimit =
      Math.min(rows.length, 10);

    let bestIndex = 0;
    let bestScore = -1;

    for (
      let rowIndex = 0;
      rowIndex < scanLimit;
      rowIndex++
    ) {
      const row =
        Array.isArray(rows[rowIndex])
          ? rows[rowIndex]
          : [];

      const values =
        row.map(
          normalizeCellLower
        );

      let score = 0;

      for (
        const keyword of keywords
      ) {
        if (
          values.some(
            (value) =>
              value.includes(
                keyword.toLowerCase()
              )
          )
        ) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = rowIndex;
      }
    }

    const rawHeaders =
      Array.isArray(rows[bestIndex])
        ? rows[bestIndex]
        : [];

    let emptyColumnCount = 0;

    const headers =
      rawHeaders.map(
        (cell, index) => {
          const value =
            normalizeCell(cell);

          if (!value) {
            emptyColumnCount++;

            return `__EMPTY_${index}`;
          }

          return value;
        }
      );

    return {
      index: bestIndex,
      headers,
      emptyColumnCount,
    };
  }

  /**
   * ----------------------------------------------------------
   * Sheet type detector
   * ----------------------------------------------------------
   */
  public static detectSheetType(
    sheetName: string,
    headers: string[] = []
  ): SheetType {
    const source =
      detectSourceSheet(sheetName);

    if (source !== "UNKNOWN") {
      return mapSourceSheetToSheetType(
        source
      );
    }

    const name =
      normalizeCellLower(sheetName);

    const headerText =
      headers
        .map(normalizeCellLower)
        .join(" ");

    if (
      name.includes("voc") ||
      headerText.includes("응답완료일") ||
      headerText.includes("추천의향")
    ) {
      return "VOC";
    }

    if (name.includes("센터")) {
      return "CENTER";
    }

    if (name.includes("의사")) {
      return "DOCTOR";
    }

    if (name.includes("병동")) {
      return "WARD";
    }

    if (
      name === "검사" ||
      name.includes("검사실")
    ) {
      return "EXAM";
    }

    if (
      name.includes("진료과")
    ) {
      return "DEPARTMENT";
    }

    return "UNKNOWN";
  }

  /**
   * ----------------------------------------------------------
   * Department type compatibility helpers
   * ----------------------------------------------------------
   */
  public static inferDeptType(
    name: string,
    sheetTypeHint?: SheetType
  ): DepartmentType {
    if (sheetTypeHint === "CENTER") {
      return "CENTER";
    }

    if (sheetTypeHint === "DOCTOR") {
      return "DOCTOR";
    }

    if (sheetTypeHint === "WARD") {
      return "WARD";
    }

    if (sheetTypeHint === "EXAM") {
      return "EXAM";
    }

    if (
      sheetTypeHint === "DEPARTMENT" ||
      sheetTypeHint === "OUTPATIENT"
    ) {
      return "DEPARTMENT";
    }

    const clean =
      normalizeCell(name);

    if (
      clean.includes("센터") ||
      clean.endsWith("병원")
    ) {
      return "CENTER";
    }

    if (
      this.isWardUnitName(clean)
    ) {
      return "WARD";
    }

    if (
      clean.includes("검사실") ||
      clean.includes("촬영실") ||
      clean.includes("초음파실") ||
      clean.includes("채혈실") ||
      clean.includes("핵의학실")
    ) {
      return "EXAM";
    }

    if (clean.endsWith("과")) {
      return "DEPARTMENT";
    }

    return "UNKNOWN";
  }

  public static inferPeerGroup(
    name: string,
    deptType?: DepartmentType,
    sheetTypeHint?: SheetType | string,
    careTypeHint?: string
  ): PeerGroup {
    const sourceSheet =
      detectSourceSheet(
        String(sheetTypeHint || "")
      );

    if (
      sourceSheet !== "UNKNOWN"
    ) {
      return mapSourceSheetToPeerGroup(
        sourceSheet
      );
    }

    const sheet =
      normalizeCellLower(
        sheetTypeHint
      );

    const care =
      normalizeCellLower(
        careTypeHint
      );

    if (
      deptType === "EXAM"
    ) {
      return "EXAM";
    }

    if (
      deptType === "CENTER"
    ) {
      return "OUTPATIENT_CENTER";
    }

    if (
      deptType === "WARD"
    ) {
      return "INPATIENT_WARD";
    }

    if (
      deptType === "DOCTOR"
    ) {
      if (
        sheet.includes("응급") ||
        care.includes("응급")
      ) {
        return "EMERGENCY_DOCTOR";
      }

      if (
        sheet.includes("입원") ||
        care.includes("입원")
      ) {
        return "INPATIENT_DOCTOR";
      }

      return "OUTPATIENT_DOCTOR";
    }

    if (
      sheet.includes("응급") ||
      care.includes("응급")
    ) {
      return "EMERGENCY_DEPARTMENT";
    }

    if (
      sheet.includes("입원") ||
      care.includes("입원")
    ) {
      return "INPATIENT_DEPARTMENT";
    }

    return "OUTPATIENT_DEPARTMENT";
  }

  /**
   * ----------------------------------------------------------
   * Main entry
   * ----------------------------------------------------------
   */
  public static normalizeUploadedData(
    files: UploadedFileMetadata[]
  ): NormalizedDataset {
    const warnings: string[] = [];

    const excludedDetails: {
      sheetName: string;
      reason: string;
    }[] = [];

    let totalSheets = 0;
    let validSheets = 0;
    let excludedSheets = 0;
    let totalDepartmentRows = 0;
    let totalVocRows = 0;

    const workingSheets:
      WorkingScoreSheet[] = [];

    /**
     * ========================================================
     * STEP 1
     * Workbook Sheet 수집
     * ========================================================
     */
    for (const file of files) {
      if (
        file.parsedSheets &&
        file.parsedSheets.length > 0
      ) {
        for (
          const sheet of
          file.parsedSheets
        ) {
          totalSheets++;

          const sourceSheet =
            detectSourceSheet(
              sheet.sheetName
            );

          workingSheets.push({
            sheetName:
              sheet.sheetName,
            sourceSheet,
            sheetType:
              sourceSheet !==
              "UNKNOWN"
                ? mapSourceSheetToSheetType(
                    sourceSheet
                  )
                : sheet.sheetType,
            rows:
              Array.isArray(
                sheet.rows
              )
                ? sheet.rows
                : [],
            file,
          });
        }

        continue;
      }

      if (
        Array.isArray(
          file.parsedData
        ) &&
        file.parsedData.length > 0
      ) {
        totalSheets++;

        const sheetName =
          file.selectedSheet ||
          file.fileName;

        const sourceSheet =
          detectSourceSheet(
            sheetName
          );

        workingSheets.push({
          sheetName,
          sourceSheet,
          sheetType:
            sourceSheet !==
            "UNKNOWN"
              ? mapSourceSheetToSheetType(
                  sourceSheet
                )
              : this.detectSheetType(
                  sheetName
                ),
          rows:
            file.parsedData,
          file,
        });
      }
    }

    /**
     * ========================================================
     * STEP 2
     * 실제 외래 진료과 공식 목록 확보
     *
     * 외래_센터 Sheet 안에는
     * 센터명 + 진료과명이 같이 존재하므로
     * 외래_진료과(요약)을 기준으로 구분합니다.
     * ========================================================
     */
    const outpatientDepartmentNames =
      this.collectOutpatientDepartmentNames(
        workingSheets
      );

    /**
     * ========================================================
     * STEP 3
     * 현재 평가기간
     * ========================================================
     */
    const detectedPeriod =
      this.resolveDetectedPeriod(
        files
      );

    /**
     * ========================================================
     * STEP 4
     * Score Sheet Parsing
     * ========================================================
     */
    const departments:
      DepartmentSummary[] = [];

    const parsedKeys =
      new Set<string>();

    /**
     * 외래_진료과(요약)이 존재하면
     * 외래_진료과는 중복 source이므로
     * 실제 Peer 분석은 요약 Sheet를 우선 사용
     */
    const hasOutpatientSummary =
      workingSheets.some(
        (sheet) =>
          sheet.sourceSheet ===
          "외래_진료과(요약)"
      );

    for (
      const sheet of workingSheets
    ) {
      if (
        sheet.sourceSheet === "VOC"
      ) {
        continue;
      }

      if (
        sheet.sourceSheet ===
          "외래_진료과" &&
        hasOutpatientSummary
      ) {
        excludedSheets++;

        excludedDetails.push({
          sheetName:
            sheet.sheetName,
          reason:
            "외래_진료과(요약) 시트를 외래 진료과 공식 분석 Source로 사용하므로 중복 방지를 위해 제외했습니다.",
        });

        continue;
      }

      if (
        sheet.sourceSheet ===
        "UNKNOWN"
      ) {
        excludedSheets++;

        excludedDetails.push({
          sheetName:
            sheet.sheetName,
          reason:
            "지원 대상 설문결과 Sheet가 아니거나 Sheet 유형을 확인할 수 없습니다.",
        });

        continue;
      }

      try {
        const parsed =
          this.parseScoreSheet(
            sheet,
            outpatientDepartmentNames,
            detectedPeriod
          );

        for (
          const department of parsed
        ) {
          const uniqueKey =
            `${department.peerGroup}|${normalizeComparable(
              department.rawName ||
                department.name
            )}|${normalizeComparable(
              department.parentDepartment
            )}`;

          if (
            parsedKeys.has(
              uniqueKey
            )
          ) {
            continue;
          }

          parsedKeys.add(
            uniqueKey
          );

          departments.push(
            department
          );

          totalDepartmentRows++;
        }

        validSheets++;
      } catch (error) {
        excludedSheets++;

        excludedDetails.push({
          sheetName:
            sheet.sheetName,
          reason:
            error instanceof Error
              ? error.message
              : "점수 시트 처리 중 오류가 발생했습니다.",
        });
      }
    }

    /**
     * ========================================================
     * STEP 5
     * Peer 수준 정량값 계산
     * ========================================================
     */
    this.populatePeerStatistics(
      departments
    );

    /**
     * ========================================================
     * STEP 6
     * VOC Parsing
     * ========================================================
     */
    const rawVocList:
      RawVocItem[] = [];

    for (
      const sheet of workingSheets
    ) {
      if (
        sheet.sourceSheet !== "VOC" &&
        sheet.sheetType !== "VOC"
      ) {
        continue;
      }

      try {
        const vocItems =
          this.parseVocSheet(
            sheet
          );

        rawVocList.push(
          ...vocItems
        );

        totalVocRows +=
          vocItems.length;

        validSheets++;
      } catch (error) {
        excludedSheets++;

        excludedDetails.push({
          sheetName:
            sheet.sheetName,
          reason:
            error instanceof Error
              ? error.message
              : "VOC 시트 처리 중 오류가 발생했습니다.",
        });
      }
    }

    /**
     * ========================================================
     * STEP 7
     * VOC ↔ 분석단위 관계 연결
     * ========================================================
     */
    this.linkVocToDepartments(
      departments,
      rawVocList
    );

    /**
     * ========================================================
     * STEP 8
     * Validation
     * ========================================================
     */
    if (
      rawVocList.length === 0
    ) {
      warnings.push(
        "VOC 데이터가 확인되지 않았습니다. 정량분석은 가능하지만 VOC 기반 AI 분석은 제한됩니다."
      );
    }

    if (
      departments.length === 0
    ) {
      warnings.push(
        "분석 가능한 점수 데이터가 확인되지 않았습니다."
      );
    }

    const validationSummary:
      NormalizationValidationSummary = {
      totalFiles:
        files.length,

      totalSheets,

      validSheets,

      excludedSheets,

      totalDepartmentRows,

      totalVocRows,

      totalDepartmentsDetected:
        departments.length,

      warnings,

      excludedDetails,
    };

    console.info(
      "================================================="
    );

    console.info(
      "[CX Workbook Normalization]"
    );

    console.info(
      `분석단위: ${departments.length}개`
    );

    console.info(
      `VOC: ${rawVocList.length}건`
    );

    departments.forEach(
      (department) => {
        console.info(
          `${department.sourceSheet} | ${department.name} | ${department.peerGroup} | 사례수 ${department.sampleSize} | 종합 ${department.overallScore} | VOC ${department.vocCount}`
        );
      }
    );

    console.info(
      "================================================="
    );

    return {
      departments,
      vocList:
        rawVocList,
      period:
        detectedPeriod,
      validationSummary,
    };
  }

  /**
   * ============================================================
   * Score Sheet Parser
   * ============================================================
   */

  private static parseScoreSheet(
    sheet: WorkingScoreSheet,
    outpatientDepartmentNames: Set<string>,
    period: string
  ): DepartmentSummary[] {
    const {
      sourceSheet,
      rows,
    } = sheet;

    if (
      !Array.isArray(rows) ||
      rows.length < 3
    ) {
      throw new Error(
        "점수 시트에 필요한 2단 헤더 또는 데이터 행이 없습니다."
      );
    }

    const layout =
      this.detectScoreSheetLayout(
        sourceSheet,
        rows
      );

    const baseline =
      this.extractBaseline(
        rows,
        layout
      );

    if (!baseline) {
      throw new Error(
        "'은평성모병원' 기준행을 찾을 수 없습니다."
      );
    }

    const result:
      DepartmentSummary[] = [];

    for (
      let rowIndex =
        layout.dataStartRowIndex;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        Array.isArray(
          rows[rowIndex]
        )
          ? rows[rowIndex]
          : [];

      if (
        row.length === 0
      ) {
        continue;
      }

      const parsedEntity =
        this.parseEntityRow(
          sourceSheet,
          row,
          layout,
          outpatientDepartmentNames
        );

      if (!parsedEntity) {
        continue;
      }

      const domains =
        this.parseDomainsForRow(
          row,
          layout,
          baseline
        );

      const peerGroup =
        parsedEntity.peerGroup;

      const overallScore =
        parsedEntity.overallScore;

      const hospitalAvg =
        baseline.overallScore;

      /**
       * 현재 Workbook에는 전기 데이터가 없으므로
       * 없는 전기점수를 임의 생성하지 않습니다.
       *
       * 기존 타입 호환을 위해 현재점수와 동일하게 두고
       * scoreChange=0으로 처리합니다.
       *
       * 추후 PAST_SCORE 파일이 들어오면
       * 별도 비교 Service에서 갱신합니다.
       */
      const previousScore =
        overallScore;

      const id =
        this.normalizeDeptId(
          [
            peerGroup,
            parsedEntity.parentDepartment ||
              "",
            parsedEntity.rawName,
          ].join("-")
        );

      result.push({
        id,

        name:
          parsedEntity.displayName,

        rawName:
          parsedEntity.rawName,

        displayName:
          parsedEntity.displayName,

        type:
          parsedEntity.type,

        peerGroup,

        peerGroupLabel:
          PEER_GROUP_LABELS[
            peerGroup
          ],

        sourceSheet,

        parentDepartment:
          parsedEntity.parentDepartment,

        parentCenter:
          parsedEntity.parentCenter,

        period,

        previousPeriod: "",

        sampleSize:
          parsedEntity.sampleSize,

        previousSampleSize: 0,

        overallScore,

        previousScore,

        scoreChange: 0,

        hospitalAvg,

        typeAvg: 0,

        peerGroupAvg: 0,

        hospitalGap:
          round1(
            overallScore -
              hospitalAvg
          ),

        peerGroupGap: 0,

        rank: 0,
        totalRanked: 0,

        peerGroupRank: 0,
        peerGroupSize: 0,
        peerGroupPercentile: 0,

        peerGroupTopScore: 0,
        peerGroupTop20Avg: 0,

        isSmallPeerGroup: false,

        status: "관찰",

        priority: "NORMAL",

        vulnerabilityReasons: [],

        domains,

        vocCount: 0,

        negativeVocRatio: 0,

        positiveVocCount: 0,
        negativeVocCount: 0,

        relatedVocIds: [],
      });
    }

    return result;
  }

  /**
   * 실제 설문결과 Workbook:
   *
   * 일반:
   * row 0 = 대영역
   * row 1 = 세부문항
   * row 2 = 은평성모병원
   *
   * 의사:
   * col0 = 진료과
   * col1 = 의사/진료과 집계
   * col2 = 사례수
   * col3 = 종합점수
   */
  private static detectScoreSheetLayout(
    sourceSheet: CXSourceSheet,
    rows: any[][]
  ): ScoreSheetLayout {
    const topHeaderRowIndex = 0;
    const subHeaderRowIndex = 1;
    const dataStartRowIndex = 2;

    const doctorSheet =
      sourceSheet ===
        "외래_의사" ||
      sourceSheet ===
        "입원_의사" ||
      sourceSheet ===
        "응급_의사";

    const entityColumnIndex =
      doctorSheet ? 1 : 0;

    const parentColumnIndex =
      doctorSheet
        ? 0
        : undefined;

    const sampleSizeColumnIndex =
      doctorSheet ? 2 : 1;

    const overallScoreColumnIndex =
      doctorSheet ? 3 : 2;

    const scoreStartColumn =
      doctorSheet ? 4 : 3;

    const scoreColumns =
      this.buildTwoLevelScoreColumns(
        rows[topHeaderRowIndex] ||
          [],
        rows[subHeaderRowIndex] ||
          [],
        scoreStartColumn,
        sourceSheet
      );

    return {
      topHeaderRowIndex,
      subHeaderRowIndex,
      dataStartRowIndex,

      entityColumnIndex,
      parentColumnIndex,

      sampleSizeColumnIndex,
      overallScoreColumnIndex,

      scoreColumns,
    };
  }

  /**
   * ============================================================
   * 2단 헤더 Parsing
   * ============================================================
   */
  private static buildTwoLevelScoreColumns(
    topHeaderRow: any[],
    subHeaderRow: any[],
    startColumnIndex: number,
    sourceSheet: CXSourceSheet
  ): ParsedScoreColumn[] {
    const columns:
      ParsedScoreColumn[] = [];

    let currentDomain = "";

    const maxColumns =
      Math.max(
        topHeaderRow.length,
        subHeaderRow.length
      );

    const NON_SCORE_DOMAINS = [
      "응답자",
      "성별",
      "나이",
      "초진/재진",
      "예약방법",
      "연령",
      "성별구분",
      "환자구분",
    ];

    for (
      let columnIndex =
        startColumnIndex;
      columnIndex < maxColumns;
      columnIndex++
    ) {
      const top =
        normalizeCell(
          topHeaderRow[
            columnIndex
          ]
        );

      const sub =
        normalizeCell(
          subHeaderRow[
            columnIndex
          ]
        );

      if (top) {
        currentDomain = top;
      }

      if (!currentDomain) {
        continue;
      }

      const isMetadataDomain =
        NON_SCORE_DOMAINS.some(
          (metadata) =>
            normalizeComparable(
              currentDomain
            ) ===
            normalizeComparable(
              metadata
            )
        );

      if (isMetadataDomain) {
        continue;
      }

      if (!sub) {
        continue;
      }

      const isDomainAverage =
        /^(영역평균|항목평균|평균)$/i.test(
          sub.replace(/\s/g, "")
        );

      let careType:
        CareType | undefined;

      if (
        sourceSheet === "검사"
      ) {
        if (
          normalizeComparable(
            sub
          ) === "외래"
        ) {
          careType =
            "OUTPATIENT";
        } else if (
          normalizeComparable(
            sub
          ) === "입원"
        ) {
          careType =
            "INPATIENT";
        } else if (
          normalizeComparable(
            sub
          ) === "응급"
        ) {
          careType =
            "EMERGENCY";
        } else if (
          isDomainAverage
        ) {
          careType =
            "COMMON";
        }
      }

      columns.push({
        columnIndex,

        domainName:
          this.cleanHeaderText(
            currentDomain
          ),

        questionName:
          this.cleanHeaderText(
            sub
          ),

        normalizedKey:
          `${this.cleanHeaderText(
            currentDomain
          )}::${this.cleanHeaderText(
            sub
          )}`,

        isDomainAverage,

        careType,

        rawTopHeader:
          currentDomain,

        rawSubHeader:
          sub,
      });
    }

    return columns;
  }

  private static cleanHeaderText(
    value: unknown
  ): string {
    return normalizeCell(value)
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * ============================================================
   * "은평성모병원" Baseline
   * ============================================================
   */
  private static extractBaseline(
    rows: any[][],
    layout: ScoreSheetLayout
  ): BaselineData | null {
    for (
      let rowIndex =
        layout.dataStartRowIndex;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        Array.isArray(
          rows[rowIndex]
        )
          ? rows[rowIndex]
          : [];

      const entityName =
        normalizeCell(
          row[
            layout.entityColumnIndex
          ]
        );

      const parentName =
        layout.parentColumnIndex !==
        undefined
          ? normalizeCell(
              row[
                layout
                  .parentColumnIndex
              ]
            )
          : "";

      const isHospitalBaseline =
        normalizeComparable(
          entityName
        ) ===
          normalizeComparable(
            "은평성모병원"
          ) ||
        normalizeComparable(
          parentName
        ) ===
          normalizeComparable(
            "은평성모병원"
          );

      if (
        !isHospitalBaseline
      ) {
        continue;
      }

      const columnScores =
        new Map<
          number,
          number
        >();

      for (
        const column of
        layout.scoreColumns
      ) {
        const value =
          parseNumericValue(
            row[
              column.columnIndex
            ]
          );

        if (
          value !== null
        ) {
          columnScores.set(
            column.columnIndex,
            value
          );
        }
      }

      return {
        overallScore:
          safeScore(
            row[
              layout
                .overallScoreColumnIndex
            ]
          ),

        sampleSize:
          parseIntegerValue(
            row[
              layout
                .sampleSizeColumnIndex
            ]
          ),

        columnScores,
      };
    }

    return null;
  }

  /**
   * ============================================================
   * Entity row parser
   * ============================================================
   */
  private static parseEntityRow(
    sourceSheet: CXSourceSheet,
    row: any[],
    layout: ScoreSheetLayout,
    outpatientDepartmentNames: Set<string>
  ): ParsedEntityRow | null {
    const rawEntityName =
      normalizeCell(
        row[
          layout.entityColumnIndex
        ]
      );

    if (!rawEntityName) {
      return null;
    }

    if (
      normalizeComparable(
        rawEntityName
      ) ===
      normalizeComparable(
        "은평성모병원"
      )
    ) {
      return null;
    }

    const parentDepartment =
      layout.parentColumnIndex !==
      undefined
        ? normalizeCell(
            row[
              layout.parentColumnIndex
            ]
          )
        : undefined;

    /**
     * 의사 Sheet에서:
     *
     * 가정의학과 | 가정의학과
     *
     * 같은 행은 진료과 집계행이므로
     * 의사 Peer Group에 넣지 않습니다.
     */
    if (
      sourceSheet ===
        "외래_의사" ||
      sourceSheet ===
        "입원_의사" ||
      sourceSheet ===
        "응급_의사"
    ) {
      if (
        !parentDepartment ||
        normalizeComparable(
          parentDepartment
        ) ===
          normalizeComparable(
            rawEntityName
          )
      ) {
        return null;
      }
    }

    /**
     * 외래센터 Sheet에는
     * 센터와 하위 진료과가 같이 있음.
     *
     * 센터만 분석 대상으로 유지.
     */
    if (
      sourceSheet ===
      "외래_센터"
    ) {
      const normalized =
        normalizeComparable(
          rawEntityName
        );

      if (
        outpatientDepartmentNames.has(
          normalized
        )
      ) {
        return null;
      }

      const looksLikeCenter =
        rawEntityName.includes(
          "센터"
        ) ||
        rawEntityName.endsWith(
          "병원"
        );

      if (!looksLikeCenter) {
        return null;
      }
    }

    /**
     * 입원_병동 Sheet:
     * 병동행 아래 진료과별 세부행이 함께 있음.
     *
     * 실제 병동만 유지.
     */
    if (
      sourceSheet ===
        "입원_병동" &&
      !this.isWardUnitName(
        rawEntityName
      )
    ) {
      return null;
    }

    /**
     * 검사 Sheet:
     * 검사 그룹 집계행은 제외하고
     * 실제 검사실만 Peer Group에 포함.
     */
    if (
      sourceSheet ===
        "검사" &&
      this.isExamAggregateRow(
        rawEntityName
      )
    ) {
      return null;
    }

    const peerGroup =
      mapSourceSheetToPeerGroup(
        sourceSheet
      );

    const type =
      mapPeerGroupToDepartmentType(
        peerGroup
      );

    const {
      rawName,
      displayName,
    } =
      getDepartmentNamePair(
        rawEntityName,
        type
      );

    return {
      rawName,

      displayName,

      parentDepartment:
        parentDepartment ||
        undefined,

      type,

      peerGroup,

      sampleSize:
        parseIntegerValue(
          row[
            layout
              .sampleSizeColumnIndex
          ]
        ),

      overallScore:
        safeScore(
          row[
            layout
              .overallScoreColumnIndex
          ]
        ),

      sourceSheet,

      row,
    };
  }

  private static isWardUnitName(
    name: string
  ): boolean {
    const clean =
      normalizeCell(name);

    return (
      /^\d+U$/i.test(clean) ||
      /^\d+Unit$/i.test(clean) ||
      /집중치료실U$/i.test(clean) ||
      /중환자실U$/i.test(clean) ||
      /병동$/i.test(clean)
    );
  }

  private static isExamAggregateRow(
    name: string
  ): boolean {
    const normalized =
      normalizeComparable(name);

    const aggregateNames = [
      "기능 검사",
      "센터/외래 검사",
      "영상/핵의학 검사",
      "진단 검사",
    ].map(
      normalizeComparable
    );

    return aggregateNames.includes(
      normalized
    );
  }

  /**
   * ============================================================
   * Domain / Question Score Parsing
   * ============================================================
   */
  private static parseDomainsForRow(
    row: any[],
    layout: ScoreSheetLayout,
    baseline: BaselineData
  ): DomainScore[] {
    const domainMap =
      new Map<
        string,
        {
          averageColumn?: ParsedScoreColumn;
          questions: ParsedScoreColumn[];
        }
      >();

    for (
      const column of
      layout.scoreColumns
    ) {
      if (
        !domainMap.has(
          column.domainName
        )
      ) {
        domainMap.set(
          column.domainName,
          {
            questions: [],
          }
        );
      }

      const entry =
        domainMap.get(
          column.domainName
        )!;

      if (
        column.isDomainAverage
      ) {
        entry.averageColumn =
          column;
      } else {
        entry.questions.push(
          column
        );
      }
    }

    const domains:
      DomainScore[] = [];

    let domainIndex = 1;

    domainMap.forEach(
      (
        structure,
        domainName
      ) => {
        const averageColumn =
          structure.averageColumn;

        let currentScore:
          number | null = null;

        let hospitalAvg:
          number | null = null;

        if (averageColumn) {
          currentScore =
            parseNumericValue(
              row[
                averageColumn
                  .columnIndex
              ]
            );

          hospitalAvg =
            baseline.columnScores.get(
              averageColumn
                .columnIndex
            ) ?? null;
        }

        const questions:
          QuestionScore[] = [];

        for (
          let questionIndex = 0;
          questionIndex <
          structure.questions.length;
          questionIndex++
        ) {
          const questionColumn =
            structure.questions[
              questionIndex
            ];

          const questionScore =
            parseNumericValue(
              row[
                questionColumn
                  .columnIndex
              ]
            );

          if (
            questionScore === null
          ) {
            continue;
          }

          const questionHospitalAvg =
            baseline.columnScores.get(
              questionColumn
                .columnIndex
            ) ?? 0;

          const domainId =
            `D${domainIndex}`;

          questions.push({
            questionId:
              `${domainId}-Q${
                questionIndex + 1
              }`,

            questionText:
              questionColumn
                .questionName,

            domainId,

            domainName,

            currentScore:
              questionScore,

            /**
             * 전기 데이터 미제공
             */
            previousScore:
              questionScore,

            change: 0,

            hospitalAvg:
              questionHospitalAvg,

            departmentTypeAvg: 0,

            peerGroupAvg: 0,

            topPerformerScore: 0,

            rank: 0,

            totalDepartments: 0,

            status: "관찰",

            sourceHeader:
              questionColumn
                .normalizedKey,

            sourceColumnIndex:
              questionColumn
                .columnIndex,

            hasScore: true,
          });
        }

        /**
         * 영역평균이 존재하지 않는 경우
         * 임의 평균을 만들지 않습니다.
         *
         * 다만 검사 Sheet처럼
         * 항목평균이 있으면 그것을 사용.
         */
        if (
          currentScore === null
        ) {
          return;
        }

        const domainId =
          `D${domainIndex}`;

        domains.push({
          domainId,

          domainName,

          rawDomainName:
            domainName,

          currentScore,

          previousScore:
            currentScore,

          change: 0,

          hospitalAvg:
            hospitalAvg ?? 0,

          departmentTypeAvg: 0,

          peerGroupAvg: 0,

          topPerformerScore: 0,

          questions,

          status: "관찰",

          averageColumnIndex:
            averageColumn
              ?.columnIndex,
        });

        domainIndex++;
      }
    );

    return domains;
  }

  /**
   * ============================================================
   * Outpatient official department names
   * ============================================================
   */
  private static collectOutpatientDepartmentNames(
    sheets: WorkingScoreSheet[]
  ): Set<string> {
    const result =
      new Set<string>();

    const preferred =
      sheets.find(
        (sheet) =>
          sheet.sourceSheet ===
          "외래_진료과(요약)"
      );

    const fallback =
      sheets.find(
        (sheet) =>
          sheet.sourceSheet ===
          "외래_진료과"
      );

    const sheet =
      preferred || fallback;

    if (!sheet) {
      return result;
    }

    for (
      let rowIndex = 2;
      rowIndex <
      sheet.rows.length;
      rowIndex++
    ) {
      const name =
        normalizeCell(
          sheet.rows[
            rowIndex
          ]?.[0]
        );

      if (
        !name ||
        name === "은평성모병원" ||
        name === "일반"
      ) {
        continue;
      }

      /**
       * 요약 Sheet라면 모두 공식 진료과
       */
      if (
        sheet.sourceSheet ===
        "외래_진료과(요약)"
      ) {
        result.add(
          normalizeComparable(name)
        );

        continue;
      }

      /**
       * 상세 Sheet fallback에서는
       * 명백한 진료과명만 사용
       */
      if (
        name.endsWith("과")
      ) {
        result.add(
          normalizeComparable(name)
        );
      }
    }

    return result;
  }

  /**
   * ============================================================
   * Peer Statistics
   * ============================================================
   */
  private static populatePeerStatistics(
    departments:
      DepartmentSummary[]
  ): void {
    const peerGroups =
      new Map<
        PeerGroup,
        DepartmentSummary[]
      >();

    for (
      const department of
      departments
    ) {
      if (
        !peerGroups.has(
          department.peerGroup
        )
      ) {
        peerGroups.set(
          department.peerGroup,
          []
        );
      }

      peerGroups
        .get(
          department.peerGroup
        )!
        .push(department);
    }

    peerGroups.forEach(
      (members) => {
        if (
          members.length === 0
        ) {
          return;
        }

        const scores =
          members
            .map(
              (member) =>
                member.overallScore
            )
            .filter(
              Number.isFinite
            );

        const average =
          scores.length > 0
            ? round1(
                scores.reduce(
                  (sum, score) =>
                    sum + score,
                  0
                ) /
                  scores.length
              )
            : 0;

        const sorted =
          [...members].sort(
            (a, b) =>
              b.overallScore -
              a.overallScore
          );

        const topScore =
          sorted[0]
            ?.overallScore ??
          0;

        const top20Count =
          Math.max(
            1,
            Math.ceil(
              sorted.length * 0.2
            )
          );

        const top20Avg =
          round1(
            sorted
              .slice(
                0,
                top20Count
              )
              .reduce(
                (
                  sum,
                  member
                ) =>
                  sum +
                  member.overallScore,
                0
              ) /
              top20Count
          );

        for (
          const member of members
        ) {
          const rank =
            sorted.findIndex(
              (candidate) =>
                candidate.id ===
                member.id
            ) + 1;

          member.peerGroupAvg =
            average;

          member.typeAvg =
            average;

          member.peerGroupGap =
            round1(
              member.overallScore -
                average
            );

          member.peerGroupRank =
            rank;

          member.rank = rank;

          member.peerGroupSize =
            members.length;

          member.totalRanked =
            members.length;

          member.peerGroupTopScore =
            topScore;

          member.peerGroupTop20Avg =
            top20Avg;

          member.isSmallPeerGroup =
            members.length < 5;

          /**
           * 1위 = 100 percentile에 가까운 개념
           */
          member.peerGroupPercentile =
            members.length <= 1
              ? 100
              : round1(
                  ((members.length -
                    rank) /
                    (members.length -
                      1)) *
                    100
                );
        }

        /**
         * Domain별 Peer Average /
         * Top performer 계산
         */
        this.populateDomainStatistics(
          members
        );
      }
    );
  }

  private static populateDomainStatistics(
    members:
      DepartmentSummary[]
  ): void {
    const domainNames =
      new Set<string>();

    members.forEach(
      (member) =>
        member.domains.forEach(
          (domain) =>
            domainNames.add(
              domain.domainName
            )
        )
    );

    domainNames.forEach(
      (domainName) => {
        const domainEntries =
          members
            .map((member) => ({
              member,
              domain:
                member.domains.find(
                  (domain) =>
                    domain.domainName ===
                    domainName
                ),
            }))
            .filter(
              (
                item
              ): item is {
                member: DepartmentSummary;
                domain: DomainScore;
              } =>
                Boolean(
                  item.domain
                )
            );

        if (
          domainEntries.length ===
          0
        ) {
          return;
        }

        const peerAvg =
          round1(
            domainEntries.reduce(
              (sum, item) =>
                sum +
                item.domain
                  .currentScore,
              0
            ) /
              domainEntries.length
          );

        const topScore =
          Math.max(
            ...domainEntries.map(
              (item) =>
                item.domain
                  .currentScore
            )
          );

        domainEntries.forEach(
          ({ domain }) => {
            domain.peerGroupAvg =
              peerAvg;

            domain.departmentTypeAvg =
              peerAvg;

            domain.topPerformerScore =
              topScore;

            this.populateQuestionStatistics(
              domainName,
              domain,
              domainEntries.map(
                (item) =>
                  item.domain
              )
            );
          }
        );
      }
    );
  }

  private static populateQuestionStatistics(
    _domainName: string,
    targetDomain: DomainScore,
    peerDomains: DomainScore[]
  ): void {
    for (
      const question of
      targetDomain.questions
    ) {
      const comparable =
        peerDomains
          .flatMap(
            (domain) =>
              domain.questions
          )
          .filter(
            (candidate) =>
              normalizeComparable(
                candidate.questionText
              ) ===
              normalizeComparable(
                question.questionText
              )
          );

      if (
        comparable.length === 0
      ) {
        continue;
      }

      const sorted =
        [...comparable].sort(
          (a, b) =>
            b.currentScore -
            a.currentScore
        );

      question.peerGroupAvg =
        round1(
          comparable.reduce(
            (sum, item) =>
              sum +
              item.currentScore,
            0
          ) /
            comparable.length
        );

      question.departmentTypeAvg =
        question.peerGroupAvg;

      question.topPerformerScore =
        sorted[0]
          .currentScore;

      question.rank =
        sorted.findIndex(
          (candidate) =>
            candidate ===
            question
        ) + 1;

      question.totalDepartments =
        comparable.length;
    }
  }

  /**
   * ============================================================
   * VOC Parser
   * ============================================================
   */
  private static parseVocSheet(
    sheet: WorkingScoreSheet
  ): RawVocItem[] {
    const rows =
      sheet.rows;

    if (
      !Array.isArray(rows) ||
      rows.length < 2
    ) {
      return [];
    }

    const {
      index: headerRowIndex,
      headers,
    } =
      this.detectHeaderRow(
        rows
      );

    const dateIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.vocDate
      );

    const sentimentIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.vocSentiment
      );

    const recommendationIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.recommendation
      );

    const categoryIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.vocCategory
      );

    const contentIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.vocContent
      );

    const divisionIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.division
      );

    const centerIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.centerName
      );

    const departmentIdx =
      this.findColumnByAlias(
        headers,
        [
          "진료과",
          "진료과명",
        ]
      );

    const doctorIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.doctorName
      );

    const wardIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.wardName
      );

    const examIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.examRoomName
      );

    const surveySerialIdx =
      this.findColumnByAlias(
        headers,
        COLUMN_ALIASES.surveySerial
      );

    if (contentIdx < 0) {
      throw new Error(
        "VOC '내용' 컬럼을 찾을 수 없습니다."
      );
    }

    const result:
      RawVocItem[] = [];

    for (
      let rowIndex =
        headerRowIndex + 1;
      rowIndex < rows.length;
      rowIndex++
    ) {
      const row =
        Array.isArray(
          rows[rowIndex]
        )
          ? rows[rowIndex]
          : [];

      const rawContent =
        normalizeCell(
          row[contentIdx]
        );

      if (!rawContent) {
        continue;
      }

      const privacy =
        PrivacyService.sanitize(
          rawContent
        );

      const division =
        divisionIdx >= 0
          ? this.cleanDashValue(
              row[divisionIdx]
            )
          : undefined;

      const center =
        centerIdx >= 0
          ? this.cleanDashValue(
              row[centerIdx]
            )
          : undefined;

      const department =
        departmentIdx >= 0
          ? this.cleanDashValue(
              row[
                departmentIdx
              ]
            )
          : undefined;

      const doctor =
        doctorIdx >= 0
          ? this.cleanDashValue(
              row[doctorIdx]
            )
          : undefined;

      const rawWard =
        wardIdx >= 0
          ? this.cleanDashValue(
              row[wardIdx]
            )
          : undefined;

      const ward =
        rawWard
          ? normalizeWardName(
              rawWard
            )
          : undefined;

      const examRoom =
        examIdx >= 0
          ? this.cleanDashValue(
              row[examIdx]
            )
          : undefined;

      const rawCategory =
        categoryIdx >= 0
          ? normalizeCell(
              row[categoryIdx]
            )
          : "";

      const category =
        this.mapVocCategory(
          rawCategory,
          privacy.sanitizedText
        );

      const rawSentiment =
        sentimentIdx >= 0
          ? normalizeCell(
              row[
                sentimentIdx
              ]
            )
          : "";

      const sentiment =
        this.mapVocSentiment(
          rawSentiment,
          privacy.sanitizedText
        );

      const recommendationScore =
        recommendationIdx >= 0
          ? parseNumericValue(
              row[
                recommendationIdx
              ]
            ) ?? undefined
          : undefined;

      const date =
        dateIdx >= 0
          ? normalizeCell(
              row[dateIdx]
            )
          : "";

      const careType =
        this.mapDivisionToCareType(
          division,
          ward,
          examRoom
        );

      /**
       * 기존 departmentName 호환용
       *
       * 실제 관계분석은 center/department/
       * doctor/ward/examRoom 필드를 사용합니다.
       */
      const primaryName =
        department ||
        ward ||
        center ||
        examRoom ||
        doctor ||
        "공통";

      const surveySerial =
        surveySerialIdx >= 0
          ? normalizeCell(
              row[
                surveySerialIdx
              ]
            )
          : "";

      const id =
        surveySerial
          ? `VOC-${surveySerial}`
          : `VOC-${rowIndex}`;

      result.push({
        id,

        departmentId:
          this.normalizeDeptId(
            primaryName
          ),

        departmentName:
          primaryName,

        date,

        responseDate:
          date,

        surveySerial:
          surveySerial ||
          undefined,

        recommendationScore,

        category,

        rawCategory:
          rawCategory ||
          undefined,

        sentiment,

        /**
         * 비식별된 내용만 저장
         */
        content:
          privacy.sanitizedText,

        hadPrivacyData:
          privacy.hasPrivacyInfo,

        relatedDomain:
          this.inferRelatedDomain(
            privacy.sanitizedText,
            category
          ),

        center,
        department,
        doctor,
        ward,
        examRoom,

        division,

        careType,

        relatedUnitIds: [],

        /**
         * 환자등록번호는
         * Normalization 결과에 저장하지 않음.
         */
        patientRegistrationNumber:
          undefined,
      });
    }

    return result;
  }

  private static cleanDashValue(
    value: unknown
  ): string | undefined {
    const clean =
      normalizeCell(value);

    if (
      !clean ||
      clean === "-" ||
      clean === "–" ||
      clean === "—"
    ) {
      return undefined;
    }

    return clean;
  }

  private static mapDivisionToCareType(
    division?: string,
    ward?: string,
    examRoom?: string
  ): CareType {
    const normalized =
      normalizeComparable(
        division
      );

    if (
      normalized.includes(
        "입원"
      )
    ) {
      return "INPATIENT";
    }

    if (
      normalized.includes(
        "응급"
      )
    ) {
      return "EMERGENCY";
    }

    if (
      normalized.includes(
        "외래"
      )
    ) {
      return "OUTPATIENT";
    }

    if (ward) {
      return "INPATIENT";
    }

    if (examRoom) {
      return "EXAM";
    }

    return "COMMON";
  }

  /**
   * ============================================================
   * VOC ↔ Analysis Unit Matching
   * ============================================================
   */
  private static linkVocToDepartments(
    departments:
      DepartmentSummary[],
    vocList: RawVocItem[]
  ): void {
    for (
      const voc of vocList
    ) {
      const relatedIds:
        string[] = [];

      for (
        const department of
        departments
      ) {
        if (
          this.isVocRelatedToUnit(
            voc,
            department
          )
        ) {
          relatedIds.push(
            department.id
          );
        }
      }

      voc.relatedUnitIds =
        relatedIds;
    }

    for (
      const department of
      departments
    ) {
      const related =
        vocList.filter(
          (voc) =>
            voc.relatedUnitIds?.includes(
              department.id
            )
        );

      department.relatedVocIds =
        related.map(
          (voc) => voc.id
        );

      department.vocCount =
        related.length;

      const positiveCount =
        related.filter(
          (voc) =>
            voc.sentiment ===
            "POSITIVE"
        ).length;

      const negativeCount =
        related.filter(
          (voc) =>
            voc.sentiment ===
            "NEGATIVE"
        ).length;

      department.positiveVocCount =
        positiveCount;

      department.negativeVocCount =
        negativeCount;

      department.negativeVocRatio =
        related.length > 0
          ? Number(
              (
                negativeCount /
                related.length
              ).toFixed(2)
            )
          : 0;
    }
  }

  public static isVocRelatedToUnit(
    voc: RawVocItem,
    unit: DepartmentSummary
  ): boolean {
    const unitName =
      unit.rawName ||
      unit.name;

    switch (
      unit.peerGroup
    ) {
      case "OUTPATIENT_CENTER":
        return (
          this.namesEqual(
            voc.center,
            unitName
          )
        );

      case "OUTPATIENT_DEPARTMENT":
        return (
          voc.careType ===
            "OUTPATIENT" &&
          this.namesEqual(
            voc.department,
            unitName
          )
        );

      case "OUTPATIENT_DOCTOR":
        return (
          voc.careType ===
            "OUTPATIENT" &&
          this.namesEqual(
            voc.department,
            unit.parentDepartment
          ) &&
          this.doctorNamesMatch(
            voc.doctor,
            unitName
          )
        );

      case "INPATIENT_WARD":
        return this.namesEqual(
          voc.ward,
          unit.displayName ||
            unitName
        );

      case "INPATIENT_DEPARTMENT":
        return (
          voc.careType ===
            "INPATIENT" &&
          this.namesEqual(
            voc.department,
            unitName
          )
        );

      case "INPATIENT_DOCTOR":
        return (
          voc.careType ===
            "INPATIENT" &&
          this.namesEqual(
            voc.department,
            unit.parentDepartment
          ) &&
          this.doctorNamesMatch(
            voc.doctor,
            unitName
          )
        );

      case "EMERGENCY_DEPARTMENT":
        return (
          voc.careType ===
            "EMERGENCY" &&
          this.namesEqual(
            voc.department,
            unitName
          )
        );

      case "EMERGENCY_DOCTOR":
        return (
          voc.careType ===
            "EMERGENCY" &&
          this.namesEqual(
            voc.department,
            unit.parentDepartment
          ) &&
          this.doctorNamesMatch(
            voc.doctor,
            unitName
          )
        );

      case "EXAM":
        /**
         * 외래 환자 VOC여도
         * 검사실이 존재하면 EXAM에도 연결 가능
         */
        return this.namesEqual(
          voc.examRoom,
          unitName
        );

      default:
        return false;
    }
  }

  private static namesEqual(
    a?: string,
    b?: string
  ): boolean {
    if (!a || !b) {
      return false;
    }

    return (
      normalizeComparable(a) ===
      normalizeComparable(b)
    );
  }

  /**
   * VOC 의사명이 김*경처럼
   * 부분 마스킹되어 있는 경우 지원
   */
  private static doctorNamesMatch(
    maskedName?: string,
    actualName?: string
  ): boolean {
    if (
      !maskedName ||
      !actualName
    ) {
      return false;
    }

    const masked =
      normalizeCell(maskedName)
        .replace(/\s/g, "");

    const actual =
      normalizeCell(actualName)
        .replace(/\s/g, "");

    if (
      normalizeComparable(
        masked
      ) ===
      normalizeComparable(
        actual
      )
    ) {
      return true;
    }

    if (
      !masked.includes("*")
    ) {
      return false;
    }

    const visibleHangul =
      masked.match(/[가-힣]/g) ||
      [];

    if (
      visibleHangul.length === 0
    ) {
      return false;
    }

    /**
     * 김*경 → 김OO경
     */
    const first =
      visibleHangul[0];

    const last =
      visibleHangul[
        visibleHangul.length - 1
      ];

    if (
      visibleHangul.length >= 2
    ) {
      return (
        actual.startsWith(first) &&
        actual.endsWith(last)
      );
    }

    return actual.startsWith(
      first
    );
  }

  /**
   * ============================================================
   * VOC Category / Sentiment
   * ============================================================
   */
  private static mapVocCategory(
    rawCategory: string,
    content: string
  ): VocCategory {
    const raw =
      normalizeComparable(
        rawCategory
      );

    if (
      raw.includes("칭찬")
    ) {
      return "칭찬";
    }

    if (
      raw.includes("대기") ||
      raw.includes("지연")
    ) {
      return "대기시간";
    }

    if (
      raw.includes("검사")
    ) {
      return "검사안내";
    }

    if (
      raw.includes("설명") ||
      raw.includes("안내")
    ) {
      return "설명부족";
    }

    if (
      raw.includes("친절") ||
      raw.includes("응대")
    ) {
      return "친절/응대";
    }

    if (
      raw.includes("시설") ||
      raw.includes("환경")
    ) {
      return "시설환경";
    }

    if (
      raw.includes("소음")
    ) {
      return "소음";
    }

    if (
      raw.includes("식사")
    ) {
      return "식사";
    }

    if (
      raw.includes("수납")
    ) {
      return "수납";
    }

    if (
      raw.includes("예약") ||
      raw.includes("접수")
    ) {
      return "예약/접수";
    }

    if (
      raw.includes("안전")
    ) {
      return "환자안전";
    }

    return this.inferVocCategory(
      content
    );
  }

  private static mapVocSentiment(
    rawSentiment: string,
    content: string
  ):
    | "POSITIVE"
    | "NEGATIVE"
    | "NEUTRAL" {
    const raw =
      normalizeComparable(
        rawSentiment
      );

    if (
      raw.includes("긍정")
    ) {
      return "POSITIVE";
    }

    if (
      raw.includes("부정")
    ) {
      return "NEGATIVE";
    }

    if (
      raw.includes("중립")
    ) {
      return "NEUTRAL";
    }

    return this.inferVocSentiment(
      content
    );
  }

  public static inferVocCategory(
    text: string
  ): VocCategory {
    const clean =
      normalizeCell(text);

    if (
      /감사|칭찬|고맙|친절했|잘해주/i.test(
        clean
      )
    ) {
      return "칭찬";
    }

    if (
      /예약|접수/i.test(clean)
    ) {
      return "예약/접수";
    }

    if (
      /대기|지연|기다|늦/i.test(
        clean
      )
    ) {
      return "대기시간";
    }

    if (
      /검사|채혈|촬영|ct|mri|초음파|내시경/i.test(
        clean
      )
    ) {
      return "검사안내";
    }

    if (
      /설명|안내|알려|질문/i.test(
        clean
      )
    ) {
      return "설명부족";
    }

    if (
      /불친절|친절|태도|응대|말투/i.test(
        clean
      )
    ) {
      return "친절/응대";
    }

    if (
      /간호|수액|처치|통증|치료/i.test(
        clean
      )
    ) {
      return "치료/간호";
    }

    if (
      /약|투약|복약/i.test(
        clean
      )
    ) {
      return "투약과정";
    }

    if (
      /퇴원/i.test(clean)
    ) {
      return "퇴원안내";
    }

    if (
      /화장실|시설|청결|주차|냄새/i.test(
        clean
      )
    ) {
      return "시설환경";
    }

    if (
      /소음|시끄|잠|수면/i.test(
        clean
      )
    ) {
      return "소음";
    }

    if (
      /식사|밥|반찬|급식/i.test(
        clean
      )
    ) {
      return "식사";
    }

    if (
      /수납|비용|결제/i.test(
        clean
      )
    ) {
      return "수납";
    }

    if (
      /안전|본인확인|낙상/i.test(
        clean
      )
    ) {
      return "환자안전";
    }

    return "기타";
  }

  public static inferVocSentiment(
    text: string
  ):
    | "POSITIVE"
    | "NEGATIVE"
    | "NEUTRAL" {
    const clean =
      normalizeCell(text);

    const negative =
      /불만|불친절|짜증|화나|늦|지연|기다|힘들|불쾌|최악|답답|아쉽|불편|개선|문제|부족/i.test(
        clean
      );

    const positive =
      /감사|친절|좋았|좋습니다|만족|고맙|칭찬|편안|신속|안심|잘해/i.test(
        clean
      );

    if (
      negative &&
      !positive
    ) {
      return "NEGATIVE";
    }

    if (
      positive &&
      !negative
    ) {
      return "POSITIVE";
    }

    /**
     * 긍정과 부정이 한 VOC에 같이 있으면
     * 규칙으로 단정하지 않고 NEUTRAL.
     * 실제 Gemini 단계에서 의미 분석 가능.
     */
    return "NEUTRAL";
  }

  public static inferRelatedDomain(
    text: string,
    category: string
  ): string {
    const clean =
      normalizeCell(text);

    switch (category) {
      case "예약/접수":
        return "예약 및 접수 절차";

      case "검사안내":
        return "검사 과정";

      case "설명부족":
        if (
          /의사|교수|주치의|회진/i.test(
            clean
          )
        ) {
          return "의사 영역";
        }

        if (
          /간호/i.test(clean)
        ) {
          return "간호사 영역";
        }

        return "전반적 평가";

      case "친절/응대":
        if (
          /의사|교수/i.test(
            clean
          )
        ) {
          return "의사 영역";
        }

        if (
          /간호/i.test(clean)
        ) {
          return "간호사 영역";
        }

        return "전반적 평가";

      case "치료/간호":
        return "간호사 영역";

      case "투약과정":
        return "투약 및 치료과정";

      case "퇴원안내":
        return "퇴원 절차";

      case "시설환경":
      case "소음":
        return "환자안전과 병원환경";

      case "수납":
        return "수납절차 및 기타";

      case "환자안전":
        return "환자안전과 병원환경";

      default:
        return "전반적 평가";
    }
  }

  /**
   * ============================================================
   * Compatibility Helpers
   * ============================================================
   */

  public static mapStringToDeptType(
    value: string,
    sheetTypeHint?: SheetType
  ): DepartmentType {
    const clean =
      normalizeCellLower(
        value
      );

    if (
      clean.includes("센터")
    ) {
      return "CENTER";
    }

    if (
      clean.includes("의사") ||
      clean.includes("교수")
    ) {
      return "DOCTOR";
    }

    if (
      clean.includes("병동") ||
      clean.includes("unit")
    ) {
      return "WARD";
    }

    if (
      clean.includes("검사")
    ) {
      return "EXAM";
    }

    if (
      clean.includes("진료과") ||
      clean.endsWith("과")
    ) {
      return "DEPARTMENT";
    }

    return this.inferDeptType(
      value,
      sheetTypeHint
    );
  }

  public static normalizeDeptId(
    name: string
  ): string {
    const clean =
      normalizeCell(name)
        .replace(
          /[^a-zA-Z0-9가-힣]/g,
          ""
        );

    if (!clean) {
      return "DEP-UNKNOWN";
    }

    return `DEP-${clean}`;
  }

  /**
   * 기존 코드와의 호환성 유지.
   * 실제 Workbook의 영역명은 더 이상 임의 6대 영역으로
   * 강제 변환하지 않고 원본 명칭을 우선 보존.
   */
  public static standardizeDomainName(
    raw: string
  ): string {
    return this.cleanHeaderText(
      raw
    );
  }

  public static getDomainId(
    name: string
  ): string {
    const normalized =
      normalizeComparable(name);

    if (
      normalized.includes(
        "예약"
      ) ||
      normalized.includes(
        "접수"
      )
    ) {
      return "D1";
    }

    if (
      normalized.includes(
        "간호"
      )
    ) {
      return "D2";
    }

    if (
      normalized.includes(
        "의사"
      )
    ) {
      return "D3";
    }

    if (
      normalized.includes(
        "검사"
      ) ||
      normalized.includes(
        "치료"
      )
    ) {
      return "D4";
    }

    if (
      normalized.includes(
        "안전"
      ) ||
      normalized.includes(
        "환경"
      )
    ) {
      return "D5";
    }

    if (
      normalized.includes(
        "수납"
      )
    ) {
      return "D6";
    }

    if (
      normalized.includes(
        "전반"
      )
    ) {
      return "D7";
    }

    return `D-${Math.abs(
      this.simpleHash(
        normalized
      )
    )}`;
  }

  private static simpleHash(
    input: string
  ): number {
    let hash = 0;

    for (
      let i = 0;
      i < input.length;
      i++
    ) {
      hash =
        (hash << 5) -
        hash +
        input.charCodeAt(i);

      hash |= 0;
    }

    return hash;
  }

  /**
   * ============================================================
   * Period
   * ============================================================
   */
  private static resolveDetectedPeriod(
    files: UploadedFileMetadata[]
  ): string {
    const explicit =
      files
        .map(
          (file) =>
            file.detectedPeriod
        )
        .find(Boolean);

    if (explicit) {
      return explicit;
    }

    /**
     * 파일명에 2026 등이 있으면
     * 연도까지만 안전하게 사용.
     *
     * 분기는 임의 추정하지 않음.
     */
    for (
      const file of files
    ) {
      const yearMatch =
        file.fileName.match(
          /(20\d{2})/
        );

      if (yearMatch) {
        return `${yearMatch[1]}년`;
      }
    }

    return "평가기간 미지정";
  }
}