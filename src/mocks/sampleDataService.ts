import { UploadedFileMetadata, ParsedSheetData, SheetValidationReport } from "../types";

export class SampleDataService {
  public static getSampleUploadedFile(): UploadedFileMetadata {
    const wardHeaders = ["부서코드", "부서명", "구분", "평가기간", "평가영역", "세부문항", "점수", "전기점수", "응답수"];
    const wardRows = [
      wardHeaders,
      // 71U (Vulnerable Ward - Low score & drop)
      ["DEP-71U", "71U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 79.5, 83.0, 78],
      ["DEP-71U", "71U", "WARD", "2026년 2분기", "간호사 영역", "도움 요청 시 신속 응답", 71.0, 77.5, 78],
      ["DEP-71U", "71U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 70.8, 75.4, 78],
      ["DEP-71U", "71U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 69.4, 78.2, 78],
      ["DEP-71U", "71U", "WARD", "2026년 2분기", "병원환경", "야간 소음 통제", 67.2, 72.0, 78],

      // 81U (Vulnerable Ward)
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 80.2, 82.5, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "간호사 영역", "도움 요청 시 신속 응답", 72.3, 78.4, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 71.5, 76.2, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 70.2, 79.1, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "병원환경", "야간 소음 통제", 68.8, 73.5, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "환자권리보장", "공평한 대우", 81.0, 83.0, 84],
      ["DEP-81U", "81U", "WARD", "2026년 2분기", "전반적 평가", "병원 추천 의향", 74.0, 77.0, 84],

      // 52U
      ["DEP-52U", "52U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 84.5, 83.0, 82],
      ["DEP-52U", "52U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 81.2, 80.5, 82],
      ["DEP-52U", "52U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 82.0, 81.0, 82],
      ["DEP-52U", "52U", "WARD", "2026년 2분기", "병원환경", "야간 소음 통제", 79.0, 78.0, 82],

      // 61U
      ["DEP-61U", "61U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 86.0, 85.0, 88],
      ["DEP-61U", "61U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 84.0, 83.5, 88],
      ["DEP-61U", "61U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 83.5, 82.0, 88],

      // 91U (Top Performer Ward)
      ["DEP-91U", "91U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 92.5, 91.0, 92],
      ["DEP-91U", "91U", "WARD", "2026년 2분기", "간호사 영역", "도움 요청 시 신속 응답", 91.2, 90.5, 92],
      ["DEP-91U", "91U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 89.4, 88.0, 92],
      ["DEP-91U", "91U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 93.1, 91.2, 92],
      ["DEP-91U", "91U", "WARD", "2026년 2분기", "병원환경", "야간 소음 통제", 88.0, 87.1, 92],

      // 101U
      ["DEP-101U", "101U", "WARD", "2026년 2분기", "간호사 영역", "존중 및 예의", 87.5, 86.0, 75],
      ["DEP-101U", "101U", "WARD", "2026년 2분기", "의사 영역", "회진시간 관련 정보 제공", 85.2, 84.5, 75],
      ["DEP-101U", "101U", "WARD", "2026년 2분기", "투약 및 치료과정", "검사/치료 전 설명", 86.0, 85.0, 75],
    ];

    const opdHeaders = ["부서코드", "부서명", "구분", "평가기간", "평가영역", "점수", "전기점수", "응답수"];
    const opdRows = [
      opdHeaders,
      // 내과 (Vulnerable Outpatient Dept)
      ["DEP-OPD-MED", "내과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 76.5, 81.0, 120],
      ["DEP-OPD-MED", "내과", "DEPARTMENT", "2026년 2분기", "의사 영역", 74.2, 79.5, 120],
      ["DEP-OPD-MED", "내과", "DEPARTMENT", "2026년 2분기", "전반적 평가", 72.0, 78.0, 120],

      // 소아청소년과 (Vulnerable Outpatient Dept)
      ["DEP-OPD-PED", "소아청소년과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 78.0, 82.5, 95],
      ["DEP-OPD-PED", "소아청소년과", "DEPARTMENT", "2026년 2분기", "의사 영역", 76.5, 80.0, 95],

      // 정형외과
      ["DEP-OPD-OS", "정형외과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 84.0, 83.5, 110],
      ["DEP-OPD-OS", "정형외과", "DEPARTMENT", "2026년 2분기", "의사 영역", 83.5, 82.0, 110],

      // 신경과
      ["DEP-OPD-NEU", "신경과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 85.5, 84.0, 85],
      ["DEP-OPD-NEU", "신경과", "DEPARTMENT", "2026년 2분기", "의사 영역", 86.0, 85.5, 85],

      // 안과
      ["DEP-OPD-EYE", "안과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 88.0, 87.0, 100],
      ["DEP-OPD-EYE", "안과", "DEPARTMENT", "2026년 2분기", "의사 영역", 89.0, 88.0, 100],

      // 외과 (Top Outpatient Dept)
      ["DEP-OPD-SURG", "외과", "DEPARTMENT", "2026년 2분기", "간호사 영역", 91.4, 89.2, 105],
      ["DEP-OPD-SURG", "외과", "DEPARTMENT", "2026년 2분기", "의사 영역", 92.0, 90.0, 105],
      ["DEP-OPD-SURG", "외과", "DEPARTMENT", "2026년 2분기", "전반적 평가", 91.5, 89.0, 105],
    ];

    const examHeaders = ["부서코드", "부서명", "구분", "평가기간", "평가영역", "점수", "전기점수", "응답수"];
    const examRows = [
      examHeaders,
      // 영상의학과 검사실 (Vulnerable Exam)
      ["DEP-EXAM-RAD", "영상의학과 검사실", "EXAM", "2026년 2분기", "병원환경", 73.5, 78.0, 140],
      ["DEP-EXAM-RAD", "영상의학과 검사실", "EXAM", "2026년 2분기", "투약 및 치료과정", 71.0, 77.0, 140],

      // 내시경실
      ["DEP-EXAM-ENDO", "소화기내시경실", "EXAM", "2026년 2분기", "간호사 영역", 81.0, 80.5, 110],
      ["DEP-EXAM-ENDO", "소화기내시경실", "EXAM", "2026년 2분기", "투약 및 치료과정", 80.5, 80.0, 110],

      // 진단검사의학과
      ["DEP-EXAM-LAB", "진단검사의학 채혈실", "EXAM", "2026년 2분기", "간호사 영역", 85.0, 84.0, 160],
      ["DEP-EXAM-LAB", "진단검사의학 채혈실", "EXAM", "2026년 2분기", "병원환경", 84.5, 83.5, 160],

      // 재활치료실
      ["DEP-EXAM-REHAB", "재활치료실", "EXAM", "2026년 2분기", "치료과정", 87.0, 86.0, 90],
      ["DEP-EXAM-REHAB", "재활치료실", "EXAM", "2026년 2분기", "간호사 영역", 88.5, 87.5, 90],

      // 심장초음파실 (Top Exam)
      ["DEP-EXAM-ECHO", "심장초음파실", "EXAM", "2026년 2분기", "검사설명", 90.5, 89.0, 85],
      ["DEP-EXAM-ECHO", "심장초음파실", "EXAM", "2026년 2분기", "친절도", 92.0, 91.0, 85],
    ];

    // Center (Small group test: N=2, so isSmallPeerGroup is true)
    const centerHeaders = ["부서코드", "센터명", "구분", "평가기간", "평가영역", "점수", "전기점수", "응답수"];
    const centerRows = [
      centerHeaders,
      ["DEP-CTR-CARDIO", "심뇌혈관센터", "CENTER", "2026년 2분기", "의사 영역", 87.2, 86.0, 95],
      ["DEP-CTR-CARDIO", "심뇌혈관센터", "CENTER", "2026년 2분기", "간호사 영역", 88.0, 87.5, 95],
      ["DEP-CTR-CANCER", "암센터", "CENTER", "2026년 2분기", "의사 영역", 89.5, 88.0, 110],
      ["DEP-CTR-CANCER", "암센터", "CENTER", "2026년 2분기", "간호사 영역", 90.0, 89.0, 110],
    ];

    const vocHeaders = ["부서명", "병동", "진료과", "담당의", "작성일자", "환자구분", "주관식의견(VOC)", "카테고리"];
    const vocRows = [
      vocHeaders,
      ["71U", "71U", "내과", "김교수", "2026-08-02", "입원환자", "CT 검사 지연되는데 사전 설명이 전혀 없어 2시간 동안 금식 상태로 대기했습니다.", "검사안내"],
      ["71U", "71U", "내과", "이교수", "2026-08-05", "보호자", "야간에 병동 복도에서 카트 끄는 소리와 직원 잡담 때문에 환자가 잠을 못 잤습니다.", "소음"],
      ["71U", "71U", "내과", "김교수", "2026-08-08", "입원환자", "약 복용법에 대한 설명이 너무 빠르고 종이 안내문도 주지 않았습니다.", "투약과정"],
      ["81U", "81U", "외과", "박교수", "2026-08-11", "입원환자", "수액 교체 요청벨을 눌렀는데 20분 이상 오지 않아 불안했습니다.", "치료/간호"],
      ["81U", "81U", "외과", "박교수", "2026-08-14", "입원환자", "주치의 회진 시간이 불규칙하여 궁금한 점을 전혀 물어볼 수 없었습니다.", "설명부족"],
      ["내과", "", "내과", "김교수", "2026-08-04", "외래환자", "진료 예약시간보다 1시간 이상 늦어졌는데 지연 안내 방송이 없었습니다.", "대기시간"],
      ["영상의학과 검사실", "", "", "", "2026-08-07", "외래환자", "탈의실 안내 및 검사 전 금속물질 제거 주의사항 안내가 매우 불친절했습니다.", "친절/응대"],
      ["91U", "91U", "신경과", "최교수", "2026-08-06", "입원환자", "간호사 선생님들이 항상 밝고 친절하게 응대해 주셔서 큰 위로가 되었습니다.", "친절/응대"],
    ];

    const guideHeaders = ["설명 항목", "상세 내용"];
    const guideRows = [
      guideHeaders,
      ["안내", "본 엑셀은 2026년도 2분기 환자경험평가 원본 통합 파일입니다."],
      ["주의사항", "개인정보는 업로드 시 자동 마스킹 처리됩니다."],
    ];

    const wardReport: SheetValidationReport = {
      sheetName: "병동_평가점수",
      sheetType: "WARD",
      status: "VALID",
      rowCount: wardRows.length - 1,
      headerRowIndex: 0,
      headers: wardHeaders,
      matchedColumns: {
        부서코드: "부서코드",
        부서명: "부서명",
        구분: "구분",
        평가기간: "평가기간",
        평가영역: "평가영역",
        세부문항: "세부문항",
        점수: "점수",
        전기점수: "전기점수",
        표본수: "응답수",
      },
      warnings: [],
      errors: [],
      departmentCount: 6,
      detectedPeriod: "2026년 2분기",
    };

    const opdReport: SheetValidationReport = {
      sheetName: "외래_평가점수",
      sheetType: "OUTPATIENT",
      status: "VALID",
      rowCount: opdRows.length - 1,
      headerRowIndex: 0,
      headers: opdHeaders,
      matchedColumns: {
        부서코드: "부서코드",
        부서명: "부서명",
        구분: "구분",
        평가기간: "평가기간",
        평가영역: "평가영역",
        점수: "점수",
        전기점수: "전기점수",
        표본수: "응답수",
      },
      warnings: [],
      errors: [],
      departmentCount: 6,
      detectedPeriod: "2026년 2분기",
    };

    const examReport: SheetValidationReport = {
      sheetName: "검사실_평가점수",
      sheetType: "EXAM",
      status: "VALID",
      rowCount: examRows.length - 1,
      headerRowIndex: 0,
      headers: examHeaders,
      matchedColumns: {
        부서코드: "부서코드",
        부서명: "부서명",
        구분: "구분",
        평가기간: "평가기간",
        평가영역: "평가영역",
        점수: "점수",
        전기점수: "전기점수",
        표본수: "응답수",
      },
      warnings: [],
      errors: [],
      departmentCount: 5,
      detectedPeriod: "2026년 2분기",
    };

    const centerReport: SheetValidationReport = {
      sheetName: "센터_평가점수",
      sheetType: "CENTER",
      status: "VALID",
      rowCount: centerRows.length - 1,
      headerRowIndex: 0,
      headers: centerHeaders,
      matchedColumns: {
        부서코드: "부서코드",
        센터명: "센터명",
        구분: "구분",
        평가기간: "평가기간",
        평가영역: "평가영역",
        점수: "점수",
        전기점수: "전기점수",
        표본수: "응답수",
      },
      warnings: [],
      errors: [],
      departmentCount: 2,
      detectedPeriod: "2026년 2분기",
    };

    const vocReport: SheetValidationReport = {
      sheetName: "주관식_VOC",
      sheetType: "VOC",
      status: "VALID",
      rowCount: vocRows.length - 1,
      headerRowIndex: 0,
      headers: vocHeaders,
      matchedColumns: {
        부서: "부서명",
        작성일자: "작성일자",
        VOC내용: "주관식의견(VOC)",
        카테고리: "카테고리",
      },
      warnings: [],
      errors: [],
      vocCount: vocRows.length - 1,
    };

    const guideReport: SheetValidationReport = {
      sheetName: "작성안내_설명",
      sheetType: "UNKNOWN",
      status: "EXCLUDED",
      rowCount: guideRows.length - 1,
      headerRowIndex: 0,
      headers: guideHeaders,
      matchedColumns: {},
      warnings: ["설명 시트이므로 분석 대상에서 자동 제외되었습니다."],
      errors: [],
    };

    const parsedSheets: ParsedSheetData[] = [
      {
        sheetName: "병동_평가점수",
        sheetType: "WARD",
        headerRowIndex: 0,
        headers: wardHeaders,
        rows: wardRows,
        report: wardReport,
      },
      {
        sheetName: "외래_평가점수",
        sheetType: "OUTPATIENT",
        headerRowIndex: 0,
        headers: opdHeaders,
        rows: opdRows,
        report: opdReport,
      },
      {
        sheetName: "검사실_평가점수",
        sheetType: "EXAM",
        headerRowIndex: 0,
        headers: examHeaders,
        rows: examRows,
        report: examReport,
      },
      {
        sheetName: "센터_평가점수",
        sheetType: "CENTER",
        headerRowIndex: 0,
        headers: centerHeaders,
        rows: centerRows,
        report: centerReport,
      },
      {
        sheetName: "주관식_VOC",
        sheetType: "VOC",
        headerRowIndex: 0,
        headers: vocHeaders,
        rows: vocRows,
        report: vocReport,
      },
      {
        sheetName: "작성안내_설명",
        sheetType: "UNKNOWN",
        headerRowIndex: 0,
        headers: guideHeaders,
        rows: guideRows,
        report: guideReport,
      },
    ];

    return {
      id: "FILE-SAMPLE-2026Q2",
      fileName: "2026_환자경험평가_통합_원본데이터.xlsx",
      fileSize: 58520,
      fileType: "COMBINED",
      sheetNames: ["병동_평가점수", "외래_평가점수", "검사실_평가점수", "센터_평가점수", "주관식_VOC", "작성안내_설명"],
      selectedSheet: "병동_평가점수",
      rowCount: wardRows.length + opdRows.length + examRows.length + centerRows.length + vocRows.length - 5,
      detectedPeriod: "2026년 2분기",
      detectedDepartmentCount: 19,
      detectedVocCount: vocRows.length - 1,
      validationStatus: "VALID",
      validationErrors: [],
      validationWarnings: ["'작성안내_설명' Sheet는 분석 대상에서 자동 제외되었습니다."],
      privacyWarnings: 0,
      parsedSheets,
      sheetReports: [wardReport, opdReport, examReport, centerReport, vocReport, guideReport],
    };
  }
}
