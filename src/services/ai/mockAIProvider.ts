import {
  AIProvider,
  VocAnalysisOutput,
  RootCauseOutput,
  ActionPlanOutput,
  FeedbackReportOutput,
} from "./aiProviderInterface";
import { RawVocItem, DepartmentSummary, RootCauseMatch, ActionPlanItem } from "../../types";

export class MockAIProvider implements AIProvider {
  public async analyzeVOC(vocList: RawVocItem[], departmentName?: string): Promise<VocAnalysisOutput> {
    const total = vocList.length || 1;
    let pos = 0;
    let neu = 0;
    let neg = 0;

    const categoryMap: Record<string, { count: number; quotes: string[] }> = {};

    vocList.forEach((v) => {
      if (v.sentiment === "POSITIVE") pos++;
      else if (v.sentiment === "NEGATIVE") neg++;
      else neu++;

      const cat = v.category || "기타";
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, quotes: [] };
      categoryMap[cat].count++;
      if (categoryMap[cat].quotes.length < 2 && v.content) {
        categoryMap[cat].quotes.push(v.content);
      }
    });

    const keyIssues = Object.entries(categoryMap)
      .map(([cat, val]) => {
        let summary = `${cat} 관련 환자 불편 및 개선 요구사항 다수 접수`;
        if (cat === "검사안내") summary = "검사 및 시술 전 예상 대기시간과 진행 절차에 대한 사전 안내 결여";
        else if (cat === "소음") summary = "야간 처치 및 스테이션 대화로 인한 수면 방해 호소";
        else if (cat === "대기시간") summary = "진료 및 검사 순서 지연 시 실시간 원인 설명 부재";
        else if (cat === "투약과정") summary = "약제 추가 및 부작용에 대한 사전 복약지도 부족";
        else if (cat === "설명부족") summary = "의사 회진시간 사전 공지 미흡 및 짧은 면담 시간 불만";

        return {
          category: cat as any,
          count: val.count,
          sentiment: (val.count > 0 && cat !== "친절/응대" ? "NEGATIVE" : "NEUTRAL") as any,
          summary,
          representativeQuotes: val.quotes.length > 0 ? val.quotes : [`${cat} 관련 개선이 필요합니다.`],
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const negativeRatio = neg / total;
    const urgencyLevel = negativeRatio > 0.6 ? "CRITICAL" : negativeRatio > 0.4 ? "HIGH" : "MEDIUM";

    return {
      summary: `${departmentName || "해당 부서"}의 주관식 VOC 총 ${total}건 분석 결과, 부정적 의견 비율이 ${(negativeRatio * 100).toFixed(1)}%로 나타났으며, 특히 '${keyIssues[0]?.category || "설명부족"}' 및 '${keyIssues[1]?.category || "검사안내"}' 영역에서 반복적인 불만이 관찰되었습니다.`,
      keyIssues,
      sentimentDistribution: {
        positive: Math.round((pos / total) * 100),
        neutral: Math.round((neu / total) * 100),
        negative: Math.round((neg / total) * 100),
      },
      urgencyLevel,
    };
  }

  public async analyzeRootCause(
    department: DepartmentSummary,
    vocList: RawVocItem[],
    scoreContext?: any
  ): Promise<RootCauseOutput> {
    const matches: RootCauseMatch[] = [];

    // Find dropped questions/domains
    (department.domains || []).forEach((domain) => {
      if (domain.change < -3.0 || domain.currentScore < 76) {
        let snippet = "검사 안내가 제대로 되지 않아 불안했습니다.";
        let estimated = `${domain.domainName} 영역의 표준화된 업무 매뉴얼 준수 미흡과 부서 간 인계 체계 결함이 주된 관련 요인으로 추정됨`;
        let recommendation = "현장 체크리스트 도입 및 일일 브리핑 활성화";

        if (domain.domainName.includes("투약") || domain.domainName.includes("치료")) {
          snippet = "검사 전 준비사항과 주의점에 대한 설명이 부족했습니다.";
          estimated = "검사 및 시술 전 예상 대기시간 브리핑 체계 미비와 투약 부작용 사전 안내 프로세스 누락이 해당 항목의 유의미한 점수 하락 요인으로 분석됨";
          recommendation = "검사 전 3단계 필수 설명 체크포인트 도입 및 복약 안내문 배부";
        } else if (domain.domainName.includes("환경")) {
          snippet = "야간에 카트 끄는 소리와 스테이션 소음 때문에 잠을 잘 수 없었습니다.";
          estimated = "야간 교대근무 및 야간 처치 시 소음 저감 프로토콜 부재와 시설 노후 바퀴 소음이 환자 수면 만족도 저하와 밀접하게 연계된 것으로 관찰됨";
          recommendation = "야간 정숙 환경 캠페인(Quiet Hospital) 및 카트 바퀴 완충패드 부착";
        } else if (domain.domainName.includes("의사")) {
          snippet = "회진 시간을 미리 알 수 없어 질문을 준비하기 어려웠습니다.";
          estimated = "회진 예고제 알림의 실시간 연동 미비 및 회진 시 일방향 설명 위주 진료 패턴이 환자 체감 만족도 하락의 주요 상관 요인으로 판단됨";
          recommendation = "모바일 회진 알림톡 전송 및 양방향 회진 카드(질문노트) 비치";
        } else if (domain.domainName.includes("간호사")) {
          snippet = "호출벨을 누른 뒤 대기시간이 너무 길었습니다.";
          estimated = "특정 피크 타임 환자 호출 집중 시 우선순위 트리아지 부재 및 응대 지연 사유 안내 결여가 주요 원인으로 추정됨";
          recommendation = "호출벨 응대 표준 프로토콜(5분 내 확인 원칙) 수립";
        }

        const relatedQuotes = vocList
          .filter((v) => v.content && (v.relatedDomain === domain.domainName || v.category === "검사안내" || v.category === "소음"))
          .map((v) => v.content)
          .slice(0, 2);

        matches.push({
          domainName: domain.domainName,
          questionText: `${domain.domainName} 핵심 세부항목`,
          currentScore: domain.currentScore,
          scoreChange: domain.change,
          hospitalGap: Number((domain.currentScore - domain.hospitalAvg).toFixed(1)),
          vocCount: Math.max(3, Math.floor(vocList.length * 0.3)),
          relatedVocSnippets: relatedQuotes.length > 0 ? relatedQuotes : [snippet],
          estimatedRootCause: estimated,
          correlationLevel: "HIGH",
          recommendationFocus: recommendation,
        });
      }
    });

    if (matches.length === 0) {
      matches.push({
        domainName: "투약 및 치료과정",
        questionText: "검사/처치 전 사전 설명",
        currentScore: 74.5,
        scoreChange: -4.2,
        hospitalGap: -6.5,
        vocCount: 8,
        relatedVocSnippets: ["검사 안내와 대기시간 안내가 부족했습니다."],
        estimatedRootCause: "검사 전 소요시간 및 주의사항에 대한 표준 가이드라인 미준수가 주된 영향 요인으로 추정됨",
        correlationLevel: "HIGH",
        recommendationFocus: "사전 설명 표준화",
      });
    }

    return {
      matches,
      comprehensiveDiagnosis: `${department.name}은 정량 점수(전기 대비 ${department.scoreChange > 0 ? "+" : ""}${department.scoreChange}점)와 VOC 분석 결과, 검사/처치 사전 브리핑 체계 및 야간 환경 관리에 개선 우선순위가 집중되어 있는 것으로 종합 진단됩니다.`,
    };
  }

  public async generateActionPlan(
    department: DepartmentSummary,
    keyIssues?: any[],
    benchmarkGap?: any
  ): Promise<ActionPlanOutput> {
    const isWard = department.type === "WARD";

    const actionPlans: ActionPlanItem[] = isWard
      ? [
          {
            priority: 1,
            title: "검사 및 시술 전 3단계 표준 체크리스트(Check-Point) 도입",
            method: "검사 1시간 전 간호사가 환자에게 4대 필수정보(검사명, 목적, 예상대기시간, 금식/주의사항) 구두 설명 후 EMR 서명 확인",
            target: "입원 환자 및 당일 검사/시술 대상 환자 전체",
            schedule: "익월 1주차 표준 서식 배포 및 전 병동 즉시 적용",
            expectedEffect: "검사 관련 설명 만족도 8.5점 이상 개선 및 관련 불만 VOC 50% 이상 감소",
            kpi: "검사설명 점수 85.0점 달성",
          },
          {
            priority: 2,
            title: "야간 정숙 환경(Quiet Hospital) 3대 수칙 운영",
            method: "22:00 이후 복도 조명 50% 조도 하향, 야간 처치 카트 바퀴 실리콘 완충패드 전면 부착, 스테이션 대화 소음 45dB 이하 유지",
            target: "병동 야간 교대 간호팀 및 입원 환자",
            schedule: "즉시 시행 (시설팀 완충패드 지급 완료)",
            expectedEffect: "야간 수면 방해 및 소음 관련 부정 VOC 70% 감소",
            kpi: "병원환경/소음 점수 82.0점 회복",
          },
          {
            priority: 3,
            title: "퇴원 2시간 전 '1:1 맞춤형 복약·주의사항 브리핑' 프로토콜",
            method: "퇴원 당일 서류 및 퇴원약을 사전에 일괄 패키징하고, 퇴원 전담자가 침상에서 1:1로 주의사항 및 외래 예약일자를 재확인",
            target: "퇴원 예정 환자 및 동행 보호자",
            schedule: "익월 2주차 시범 적용 후 상시 운영",
            expectedEffect: "퇴원 절차 혼선 방지 및 전반적 추천 의향 만족도 증대",
            kpi: "퇴원안내 만족도 88.0점 유지",
          },
        ]
      : [
          {
            priority: 1,
            title: "외래 진료 대기 지연 시 '실시간 15분 알림제' 운영",
            method: "진료 예정시간보다 15분 이상 지연 발생 시 외래 간호사가 대기 환자에게 지연 사유(응급처치 등)와 예상 대기시간을 직접 안내",
            target: "외래 진료 대기 환자 전체",
            schedule: "즉시 운영 및 외래 데스크 모니터 연동",
            expectedEffect: "대기시간 체감 불만 VOC 60% 이상 완화",
            kpi: "외래 대기시간 만족도 80점 이상 확보",
          },
          {
            priority: 2,
            title: "외래 검사 동선 안내 '컬러 라인 및 모바일 네비게이션' 배포",
            method: "피검사, X-ray, 초음파 등 다빈도 검사실 이동 경로를 바닥 컬러 라인 및 영수증 하단 바코드로 안내",
            target: "외래 초진 및 당일 검사 환자",
            schedule: "익월 적용",
            expectedEffect: "검사실 위치 문의 감소 및 원내 길 찾기 편의성 증대",
            kpi: "병원 환경/안내 점수 84점 달성",
          },
          {
            priority: 3,
            title: "외래 접수 간호사 고객 경험(CX) 소통 코칭 워크숍",
            method: "첫인사 및 질문 시 '경청 및 공감 언어' 3대 표준 멘트 체화 교육 주 1회 실시",
            target: "외래 접수 및 안내 데스크 전 직원",
            schedule: "분기 내 4회 집중 과정 운영",
            expectedEffect: "직원 응대 태도 만족도 10% 개선",
            kpi: "간호사 영역 점수 86점 도달",
          },
        ];

    return { actionPlans };
  }

  public async generateFeedbackReport(
    department: DepartmentSummary,
    vocList: RawVocItem[]
  ): Promise<FeedbackReportOutput> {
    const isVulnerable = department.priority === "CRITICAL" || department.priority === "HIGH";

    return {
      executiveSummary: `${department.name}의 ${department.period} 환자경험평가 종합 점수는 ${department.overallScore}점으로, 전기 대비 ${department.scoreChange > 0 ? "+" : ""}${department.scoreChange}점 하락하여 병원 전체 ${department.totalRanked}개 부서 중 ${department.rank}위를 기록하였습니다. 특히 투약·치료과정 설명 및 병원환경 영역에서 집중적인 개선 노력이 요구됩니다.`,
      coreProblem: isVulnerable
        ? "검사 전 사전 설명 부재와 야간 환경 소음으로 인한 환자 체감 불안 및 불만족 집중"
        : "전반적으로 우수한 관리 수준을 유지하고 있으나, 퇴원 후 관리 안내의 표준화 보완 필요",
      evidence: [
        `투약 및 치료과정 영역 점수: ${department.domains.find((d) => d.domainId === "D3")?.currentScore || 71.8}점 (전기 대비 ${department.domains.find((d) => d.domainId === "D3")?.change || -7.4}점 하락)`,
        `병원 전체 평균(${department.hospitalAvg}점) 대비 종합 ${Number((department.overallScore - department.hospitalAvg).toFixed(1))}점 격차 발생`,
        `주관식 VOC 총 ${vocList.length}건 중 설명부족 및 소음 관련 불만 비율 65% 이상 차지`,
      ],
      detailedDiagnosis: `정량 지표와 정성 VOC 데이터를 결합하여 분석한 결과, ${department.name}은 의료진의 임상적 전문성에 대한 신뢰도는 양호하나, 환자가 직접 겪는 '검사 대기 중 불안감 해소'와 '야간 취침 시 병동 정숙도' 관리 프로세스에서 정서적 케어 갭이 발생하고 있습니다. 이는 단순한 친절도 문제가 아니라 부서 내 소통 프로토콜의 표준화 부재에 기인한 것으로 판단됩니다.`,
      priorityOrder: [
        "1순위: 검사 및 시술 전 3단계 표준 체크리스트(Check-Point) 현장 의무화",
        "2순위: 22시 이후 야간 정숙 환경(Quiet Hospital) 소음 저감 수칙 가동",
        "3순위: 퇴원 당일 1:1 맞춤형 복약 및 주의사항 침상 브리핑 체계화",
      ],
    };
  }
}
