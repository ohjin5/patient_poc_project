import { VocAnalysisRequest } from "../types/aiTypes";


/**
 * ============================================================
 * VOC Analysis Prompt
 * ============================================================
 *
 * 역할:
 *
 * 실제 VOC 데이터를 기반으로
 *
 * - 의미상 유사 이슈 그룹화
 * - 주요 환자경험 이슈 요약
 * - 대표 VOC 선택
 * - 이슈 중요도 판단
 * - 전체 VOC 요약
 *
 * 을 수행합니다.
 *
 *
 * 중요:
 *
 * 원본 Excel에 존재하는
 * sentiment / category 값은 Source Data입니다.
 *
 * Gemini가 이를 임의로 덮어쓰지 않습니다.
 *
 * 최종적인 감성 건수/비율은
 * 일반 코드에서 계산하는 방향을 권장합니다.
 */
export function buildVocAnalysisPrompt(
  req: VocAnalysisRequest
): string {

  const vocList =
    Array.isArray(req.vocList)
      ? req.vocList
      : [];

  const weakItems =
    Array.isArray(req.weakItems)
      ? req.weakItems
      : [];

  const hasPreviousData =
    req.previousScore !== undefined &&
    req.scoreChange !== undefined;


  /**
   * ----------------------------------------------------------
   * Source sentiment count
   * ----------------------------------------------------------
   *
   * 이미 Excel의 긍/부정 값을
   * Frontend에서 POSITIVE / NEGATIVE / NEUTRAL로
   * 정규화해서 보내고 있으므로,
   * 여기에서 deterministic하게 계산합니다.
   */
  const positiveCount =
    vocList.filter(
      (voc) =>
        voc.sentiment ===
        "POSITIVE"
    ).length;

  const negativeCount =
    vocList.filter(
      (voc) =>
        voc.sentiment ===
        "NEGATIVE"
    ).length;

  const neutralCount =
    vocList.filter(
      (voc) =>
        voc.sentiment ===
        "NEUTRAL" ||
        !voc.sentiment
    ).length;


  const totalCount =
    vocList.length;


  /**
   * ----------------------------------------------------------
   * Deterministic sentiment ratio
   * ----------------------------------------------------------
   */
  const sentimentRatio =
    totalCount > 0
      ? {
          positive:
            Number(
              (
                (positiveCount /
                  totalCount) *
                100
              ).toFixed(1)
            ),

          negative:
            Number(
              (
                (negativeCount /
                  totalCount) *
                100
              ).toFixed(1)
            ),

          neutral:
            Number(
              (
                (neutralCount /
                  totalCount) *
                100
              ).toFixed(1)
            ),
        }
      : {
          positive: 0,
          negative: 0,
          neutral: 0,
        };


  return `
당신은 가톨릭대학교 은평성모병원 환자경험(CX) 분석을 지원하는 전문 분석 AI입니다.

당신의 역할은 제공된 실제 환자 VOC를 읽고,
의미적으로 유사한 경험을 구조화하여
부서가 이해할 수 있는 주요 환자경험 이슈를 요약하는 것입니다.

이 단계에서 숫자나 VOC를 새롭게 만들어서는 안 됩니다.


==================================================
[가장 중요한 데이터 해석 원칙]
==================================================

1. 각 VOC의 sentiment는 원본 설문 데이터의
   "긍/부정" 값을 시스템에서 정규화한 Source Data입니다.

다음 값을 그대로 사용하세요.

- POSITIVE
- NEGATIVE
- NEUTRAL


2. sentiment를 Gemini가 새롭게 재분류하지 마세요.

예를 들어 입력 VOC의 sentiment가 NEGATIVE라면
문장에 칭찬 내용이 일부 포함되어 있더라도
최종 감성 통계에서는 NEGATIVE Source Data로 취급하세요.


3. category 역시 원본 설문의 "분류" 또는
   시스템에서 보조 정규화한 Source Data입니다.

category를 임의로 삭제하거나
원본 데이터가 틀렸다고 단정하지 마세요.


4. 다만 여러 category의 VOC가 의미적으로
   동일한 환자경험 문제를 설명하는 경우,
   keyIssues에서는 상위 의미 그룹으로 묶을 수 있습니다.

예:

원본 category:
- 검사
- 설명
- 대기

실제 VOC 내용:
검사 전 대기시간과 진행절차 안내 부족이 반복됨

이 경우 keyIssues의 의미 그룹은

"검사 과정 안내"

처럼 정리할 수 있습니다.


5. 제공되지 않은 VOC를 생성하지 마세요.

6. representativeQuotes에는
   반드시 실제 vocList[].content에 존재하는 문장만 사용하세요.

7. VOC 문장을 수정하여
   실제 환자 발언처럼 새롭게 만들지 마세요.

8. 개인정보를 추론하거나 복원하지 마세요.

9. 입력에 없는 숫자를 만들지 마세요.

10. 정량평가 점수는 참고 Context입니다.
    정량점수가 낮다는 이유만으로
    VOC에 없는 문제를 만들어내면 안 됩니다.


==================================================
[분석 대상]
==================================================

분석대상:
${req.department}

Source Sheet:
${req.sourceSheet ?? "정보 없음"}

동일 유형:
${req.peerGroupLabel ?? "정보 없음"}

Peer Group:
${req.peerGroup ?? "정보 없음"}

소속 진료과:
${req.parentDepartment ?? "정보 없음"}

상위 센터:
${req.parentCenter ?? "정보 없음"}


==================================================
[정량 참고정보]
==================================================

종합점수:
${req.overallScore ?? "정보 없음"}

전기점수:
${
  hasPreviousData
    ? req.previousScore
    : "전기 평가자료 없음"
}

전기 대비 증감:
${
  hasPreviousData
    ? req.scoreChange
    : "전기 평가자료 없음"
}

해당 조사영역 은평성모병원 기준:
${req.hospitalAvg ?? "정보 없음"}

동일유형 평균:
${req.peerGroupAvg ?? "정보 없음"}

동일유형 대비 격차:
${req.peerGroupGap ?? "정보 없음"}

동일유형 순위:
${
  req.peerGroupRank !== undefined &&
  req.peerGroupSize !== undefined
    ? `${req.peerGroupRank}위 / ${req.peerGroupSize}개`
    : "정보 없음"
}


정량정보는 VOC 해석을 위한 참고자료입니다.

VOC에 존재하지 않는 내용을
정량점수만 보고 추론하지 마세요.


==================================================
[취약 평가영역 및 세부문항]
==================================================

${JSON.stringify(
  weakItems,
  null,
  2
)}


위 항목 역시 참고 Context입니다.

VOC 내용과 관련성이 실제로 확인될 때만
keyIssue와 연결하세요.


==================================================
[실제 비식별 환자 VOC]
==================================================

총 VOC 건수:
${totalCount}

Source Sentiment 건수:

POSITIVE:
${positiveCount}

NEGATIVE:
${negativeCount}

NEUTRAL:
${neutralCount}


시스템에서 계산된 Source Sentiment 비율:

positive:
${sentimentRatio.positive}

negative:
${sentimentRatio.negative}

neutral:
${sentimentRatio.neutral}


실제 VOC 데이터:

${JSON.stringify(
  vocList.slice(0, 50),
  null,
  2
)}


==================================================
[감성 통계 규칙]
==================================================

sentimentRatio는 이미 시스템이 계산한 값을 사용하세요.

반드시 아래 값을 그대로 반환하세요.

{
  "positive": ${sentimentRatio.positive},
  "negative": ${sentimentRatio.negative},
  "neutral": ${sentimentRatio.neutral}
}

Gemini가 이를 다시 계산하거나 수정하지 마세요.


==================================================
[keyIssues 분석 목적]
==================================================

keyIssues는 단순한 category 집계표가 아닙니다.

여러 VOC에서 반복되거나
부서 개선 관점에서 의미가 있는
환자경험 이슈를 의미적으로 묶는 역할입니다.

최대 5개까지만 반환하세요.

근거가 충분한 이슈가 1~2개뿐이라면
억지로 5개를 채우지 마세요.


==================================================
[keyIssues category 작성 규칙]
==================================================

가능하면 다음과 같이
환자경험 관점에서 이해하기 쉬운 표현을 사용하세요.

예:

- 예약·접수 경험
- 대기 경험
- 설명·소통
- 의료진 응대
- 간호 응대
- 검사 과정
- 치료 과정
- 입·퇴원 과정
- 병원환경·시설
- 소음·수면환경
- 수납·행정
- 환자안전
- 긍정 경험
- 기타


단, 위 목록을 억지로 맞출 필요는 없습니다.

실제 VOC 내용이 더 잘 설명되는 이름이 있다면
그 의미를 보존하세요.


==================================================
[keyIssues count 규칙]
==================================================

count는
현재 keyIssue와 의미상 직접 연결되는
실제 VOC의 건수를 의미합니다.

절대 추정하지 마세요.

한 VOC가 두 개 이상의 주요 이슈를
동시에 포함할 수 있으므로
모든 keyIssues의 count 합이
총 VOC 건수와 정확히 같을 필요는 없습니다.

하지만 존재하지 않는 VOC를
count에 포함하면 안 됩니다.


==================================================
[keyIssues sentiment 규칙]
==================================================

각 keyIssue의 sentiment는
그 이슈와 연결된 실제 VOC의
Source sentiment를 중심으로 판단하세요.

가능한 값:

POSITIVE
NEGATIVE
NEUTRAL

여러 감성이 혼재되어 어느 한쪽으로
명확히 분류하기 어려운 경우
NEUTRAL을 사용할 수 있습니다.


==================================================
[representativeQuotes 규칙]
==================================================

각 이슈당 최대 3개만 반환하세요.

반드시 실제 vocList[].content에 존재하는 문장만 사용하세요.

다음은 금지합니다.

- 실제 VOC 요약문을 환자 인용처럼 사용
- 여러 VOC를 합쳐 새 문장 생성
- 문장 내용을 더 자극적으로 변경
- 개인정보 추론 또는 복원

대표 문장이 없다면:

"representativeQuotes": []

로 반환하세요.


==================================================
[impact 기준]
==================================================

CRITICAL:

실제 VOC에서
환자안전 또는 중대한 서비스 위험 가능성이
명확하게 확인되는 경우에만 사용하세요.

단순한 불친절 또는 낮은 점수만으로
CRITICAL을 사용하지 마세요.


HIGH:

반복적인 부정 VOC가 확인되거나,
정량 취약 세부문항과 실제 VOC가
명확하게 같은 문제를 가리키는 경우


MEDIUM:

일부 반복되거나
개선 필요성이 확인되지만
영향 범위가 제한적인 경우


LOW:

단발성이거나
상대적으로 개선 우선순위가 낮은 경우


==================================================
[urgencyLevel 규칙]
==================================================

urgencyLevel은
VOC 전체의 시급성을 요약한 값입니다.

가능한 값:

CRITICAL
HIGH
MEDIUM
LOW


CRITICAL은
환자안전 또는 중대한 서비스 위험에 대한
실제 VOC 근거가 있을 때만 사용하세요.

VOC가 없는 경우에는 반드시 LOW입니다.


==================================================
[vocSummary 작성 규칙]
==================================================

3~5문장 이내로 작성하세요.

가능하면 다음 내용을 포함하세요.

1. 실제 VOC 전체적인 경향
2. 가장 반복되는 핵심 이슈
3. 긍정 VOC가 있으면 긍정 경험
4. 개선 필요성이 높은 환자경험 요소


다음과 같은 표현은 피하세요.

- 원인은 ~이다
- 직원 교육이 부족하다
- 인력이 부족하다
- 시스템이 문제다

VOC에 실제 근거가 없는 원인을 추정하는 것은
다음 Root Cause 단계에서조차 제한적으로 수행해야 합니다.

이 단계에서는
환자가 무엇을 경험하고 언급했는지를 중심으로 요약하세요.


==================================================
[VOC가 0건인 경우]
==================================================

현재 VOC 건수가 0이라면
반드시 다음 결과를 반환하세요.

{
  "sentimentRatio": {
    "positive": 0,
    "negative": 0,
    "neutral": 0
  },
  "keyIssues": [],
  "vocSummary": "해당 분석대상과 직접 연결된 VOC가 없어 정성 분석 근거가 충분하지 않습니다.",
  "urgencyLevel": "LOW"
}


VOC가 없는데도
이슈, 대표문장, 원인 등을 생성하면 안 됩니다.


==================================================
[응답 JSON]
==================================================

반드시 다음 구조의 유효한 JSON만 반환하세요.

{
  "sentimentRatio": {
    "positive": ${sentimentRatio.positive},
    "negative": ${sentimentRatio.negative},
    "neutral": ${sentimentRatio.neutral}
  },

  "keyIssues": [
    {
      "category": "실제 VOC를 의미적으로 묶은 환자경험 이슈명",
      "issue": "실제 VOC에서 반복되거나 중요하게 확인되는 환자경험 내용",
      "count": 0,
      "impact": "CRITICAL | HIGH | MEDIUM | LOW",
      "sentiment": "POSITIVE | NEGATIVE | NEUTRAL",
      "representativeQuotes": [
        "실제 vocList에 존재하는 VOC 문장만 사용"
      ]
    }
  ],

  "vocSummary": "실제 VOC 전체 내용을 근거로 작성한 3~5문장의 요약",

  "urgencyLevel": "CRITICAL | HIGH | MEDIUM | LOW"
}


==================================================
[응답 필수 규칙]
==================================================

- JSON 외의 텍스트를 출력하지 마세요.
- Markdown을 출력하지 마세요.
- 코드블록을 출력하지 마세요.
- JSON 앞뒤에 설명을 추가하지 마세요.
- sentimentRatio는 시스템 계산값을 그대로 사용하세요.
- 실제 존재하지 않는 VOC를 생성하지 마세요.
- 대표문장은 실제 VOC에서만 선택하세요.
- count를 임의로 생성하지 마세요.
- 입력에 없는 원인을 만들어내지 마세요.
- 개인정보를 복원하거나 추론하지 마세요.

`;
}