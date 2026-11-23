import {

  AIProvider,

  VocAnalysisOutput,

  RootCauseOutput,

  ActionPlanOutput,

  FeedbackReportOutput,

  FeedbackReportContext,

} from "./aiProviderInterface";



import {

  fetchVocAnalysis,

  fetchRootCause,

  fetchActionPlan,

  fetchSummary,

} from "../aiService";



import {

  RawVocItem,

  DepartmentSummary,

  RootCauseMatch,

} from "../../types";





/**

 * ============================================================

 * Gemini AI Provider

 * ============================================================

 *

 * Frontend

 *   ↓

 * aiService

 *   ↓

 * Backend API

 *   ↓

 * GeminiService

 *   ↓

 * ADC

 *   ↓

 * Vertex AI Gemini

 *

 *

 * 운영 원칙

 *

 * 1. Browser에서 Gemini 직접 호출 금지

 * 2. API Key 사용 금지

 * 3. Mock/Fallback AI 결과 사용 금지

 * 4. 실제 업로드 데이터만 전달

 * 5. 정량 계산은 Frontend AnalysisEngine에서 수행

 * 6. Gemini는 VOC / Root Cause / Action Plan / Summary 담당

 * 7. 다른 부서 VOC fallback 금지

 */

export class GeminiAIProvider

  implements AIProvider

{

  /**

   * ==========================================================

   * 1. VOC Analysis

   * ==========================================================

   */

  public async analyzeVOC(

    vocList: RawVocItem[],

    departmentName?: string

  ): Promise<VocAnalysisOutput> {

    try {

      const safeVocList =

        Array.isArray(vocList)

          ? vocList

          : [];



      const payload = {

        department:

          departmentName ||

          "분석대상 미지정",



        /**

         * VOC 분석 단계에서는

         * 실제 관련 VOC만 전달합니다.

         */

        vocList:

          safeVocList.map(

            (voc) => ({

              id: voc.id,



              content:

                voc.content,



              sentiment:

                voc.sentiment,



              category:

                voc.category,



              date:

                voc.responseDate ||

                voc.date,



              recommendationScore:

                voc.recommendationScore,



              division:

                voc.division,



              center:

                voc.center,



              department:

                voc.department,



              doctor:

                voc.doctor,



              ward:

                voc.ward,



              examRoom:

                voc.examRoom,

            })

          ),

      };





      console.info(

        `[Gemini] VOC 분석 요청 | ${departmentName || "분석대상 미지정"} | ${safeVocList.length}건`

      );





      const data =

        await fetchVocAnalysis(

          payload

        );





      if (!data) {

        throw new Error(

          "VOC 분석 응답이 없습니다."

        );

      }





      if (

        !Array.isArray(

          data.keyIssues

        )

      ) {

        throw new Error(

          "VOC 분석 결과의 keyIssues 형식이 올바르지 않습니다."

        );

      }





      const sentimentRatio =

        data.sentimentRatio || {};





      return {

        summary:

          String(

            data.vocSummary ??

              data.summary ??

              ""

          ),



        keyIssues:

          data.keyIssues.map(

            (issue: any) => ({

              category:

                issue.category ||

                "기타",



              count:

                Number(

                  issue.count

                ) || 0,



              sentiment:

                this.normalizeSentiment(

                  issue.sentiment

                ),



              summary:

                String(

                  issue.summary ??

                    issue.issue ??

                    ""

                ),



              representativeQuotes:

                Array.isArray(

                  issue.representativeQuotes

                )

                  ? issue.representativeQuotes.map(

                      String

                    )

                  : Array.isArray(

                      issue.quotes

                    )

                  ? issue.quotes.map(

                      String

                    )

                  : [],

            })

          ),



        sentimentDistribution: {

          positive:

            Number(

              sentimentRatio.positive

            ) || 0,



          neutral:

            Number(

              sentimentRatio.neutral

            ) || 0,



          negative:

            Number(

              sentimentRatio.negative

            ) || 0,

        },



        urgencyLevel:

          this.normalizeUrgency(

            data.urgencyLevel

          ),

      };

    } catch (error) {

      console.error(

        "[GeminiAIProvider] VOC 분석 실패:",

        error

      );



      throw new Error(

        "Gemini VOC 분석을 완료하지 못했습니다."

      );

    }

  }





  /**

   * ==========================================================

   * 2. Root Cause Analysis

   * ==========================================================

   *

   * 실제 정량 데이터

   * +

   * 세부문항

   * +

   * 실제 관련 VOC

   * +

   * 앞 단계 VOC 분석결과

   *

   * 를 Backend로 전달합니다.

   */

  public async analyzeRootCause(

    department: DepartmentSummary,

    vocList: RawVocItem[],

    scoreContext?: any

  ): Promise<RootCauseOutput> {

    try {

      /**

       * ------------------------------------------------------

       * 취약 영역 + 세부문항 추출

       * ------------------------------------------------------

       *

       * 전기자료가 없는 경우 change는

       * 판단기준으로 사용하지 않습니다.

       */



      const hasPreviousData =

        Boolean(

          department.previousPeriod &&

            department

              .previousSampleSize >

              0

        );





      const weakItems =

        this.buildWeakItems(

          department,

          hasPreviousData

        );





      const vocAnalysis =

        scoreContext?.vocAnalysis;





      const payload = {

        department:

          department.displayName ||

          department.name,



        peerGroup:

          department.peerGroup,



        peerGroupLabel:

          department.peerGroupLabel,



        sourceSheet:

          department.sourceSheet,



        parentDepartment:

          department.parentDepartment,



        overallScore:

          department.overallScore,



        previousScore:

          hasPreviousData

            ? department.previousScore

            : undefined,



        scoreChange:

          hasPreviousData

            ? department.scoreChange

            : undefined,



        /**

         * 해당 Sheet의

         * 은평성모병원 기준값

         */

        hospitalAvg:

          department.hospitalAvg,



        peerGroupAvg:

          department.peerGroupAvg,



        peerGroupGap:

          department.peerGroupGap,



        peerGroupRank:

          department.peerGroupRank,



        peerGroupSize:

          department.peerGroupSize,



        weakItems,



        /**

         * 앞 단계 AI VOC 분석

         */

        keyIssues:

          Array.isArray(

            vocAnalysis?.keyIssues

          )

            ? vocAnalysis.keyIssues.map(

                (issue: any) => ({

                  category:

                    issue.category,



                  issue:

                    issue.summary,



                  summary:

                    issue.summary,



                  count:

                    issue.count,



                  sentiment:

                    issue.sentiment,



                  representativeQuotes:

                    issue.representativeQuotes,

                })

              )

            : [],



        vocSummary:

          vocAnalysis?.summary ||

          "",



        /**

         * 실제 관련 VOC

         */

        vocList:

          (vocList || []).map(

            (voc) => ({

              id:

                voc.id,



              content:

                voc.content,



              sentiment:

                voc.sentiment,



              category:

                voc.category,



              date:

                voc.responseDate ||

                voc.date,



              recommendationScore:

                voc.recommendationScore,



              division:

                voc.division,



              center:

                voc.center,



              department:

                voc.department,



              doctor:

                voc.doctor,



              ward:

                voc.ward,



              examRoom:

                voc.examRoom,

            })

          ),



        /**

         * 정량 Benchmark 등

         * 추가 Context

         */

        scoreContext:

          scoreContext

            ? {

                benchmarks:

                  scoreContext.benchmarks,



                peerGroupAvg:

                  scoreContext.peerGroupAvg,



                hospitalAvg:

                  scoreContext.hospitalAvg,



                peerGroupRank:

                  scoreContext.peerGroupRank,



                peerGroupSize:

                  scoreContext.peerGroupSize,



                topPerformer:

                  scoreContext.topPerformer,



                topPerformerPositiveVoc:

                  scoreContext.topPerformerPositiveVoc,

              }

            : undefined,

      };





      console.info(

        `[Gemini] Root Cause 분석 요청 | ${department.name} | 취약항목 ${weakItems.length}개 | VOC ${vocList.length}건`

      );





      const data =

        await fetchRootCause(

          payload

        );





      if (

        !data ||

        !Array.isArray(

          data.rootCauses

        )

      ) {

        throw new Error(

          "Root Cause 분석 응답 형식이 올바르지 않습니다."

        );

      }





      const matches:

        RootCauseMatch[] =

        data.rootCauses.map(

          (

            rootCause: any,

            index: number

          ) => {

            const matchedWeakItem =

              this.findMatchingWeakItem(

                weakItems,

                rootCause

              );





            return {

              domainName:

                String(

                  rootCause.dimension ??

                    rootCause.domain ??

                    matchedWeakItem

                      ?.domainName ??

                    "기타"

                ),



              questionText:

                String(

                  rootCause.question ??

                    matchedWeakItem

                      ?.questionText ??

                    rootCause.cause ??

                    ""

                ),



              currentScore:

                this.numberOrFallback(

                  rootCause.currentScore,

                  matchedWeakItem

                    ?.currentScore ??

                    department

                      .overallScore

                ),



              scoreChange:

                hasPreviousData

                  ? this.numberOrFallback(

                      rootCause.change,

                      matchedWeakItem

                        ?.change ??

                        department

                          .scoreChange

                    )

                  : 0,



              hospitalGap:

                this.numberOrFallback(

                  rootCause.hospitalGap,

                  matchedWeakItem

                    ?.gapWithHospital ??

                    department

                      .hospitalGap

                ),



              peerGroupGap:

                this.numberOrFallback(

                  rootCause.peerGroupGap,

                  matchedWeakItem

                    ?.gapWithPeerGroup ??

                    department

                      .peerGroupGap

                ),



              vocCount:

                this.extractVocCount(

                  rootCause

                ),



              relatedVocSnippets:

                this.extractEvidenceQuotes(

                  rootCause

                ),



              estimatedRootCause:

                String(

                  rootCause

                    .estimatedRootCause ??

                    rootCause.cause ??

                    ""

                ),



              correlationLevel:

                this.normalizeCorrelation(

                  rootCause

                    .correlationLevel ??

                    rootCause.confidence

                ),



              recommendationFocus:

                String(

                  rootCause

                    .recommendationFocus ??

                    rootCause

                      .recommendation ??

                    ""

                ),



              evidence:

                this.extractEvidenceArray(

                  rootCause.evidence

                ),



              severity:

                this.normalizeSeverity(

                  rootCause.severity

                ),

            };

          }

        );





      return {

        matches,



        comprehensiveDiagnosis:

          String(

            data.analysisOverview ??

              data.comprehensiveDiagnosis ??

              ""

          ),

      };

    } catch (error) {

      console.error(

        "[GeminiAIProvider] Root Cause 분석 실패:",

        error

      );



      throw new Error(

        "Gemini Root Cause 분석을 완료하지 못했습니다."

      );

    }

  }





  /**

   * ==========================================================

   * 3. Action Plan

   * ==========================================================

   *

   * Root Cause를 입력받아

   * 실제 실행 가능한 Action Plan 생성

   */

  public async generateActionPlan(

    department: DepartmentSummary,

    rootCauses: RootCauseMatch[],

    vocList: RawVocItem[],

    benchmarkGap?: any

  ): Promise<ActionPlanOutput> {

    try {

      const hasPreviousData =

        Boolean(

          department.previousPeriod &&

            department

              .previousSampleSize >

              0

        );





      const weakItems =

        this.buildWeakItems(

          department,

          hasPreviousData

        );





      /**
       * Action Plan에도 현재 분석대상과 직접 연결되고
       * 비식별화가 완료된 VOC만 전달합니다.
       */
      const safeVocList =

        Array.isArray(vocList)

          ? vocList

          : [];





      const payload = {

        department:

          department.displayName ||

          department.name,



        peerGroup:

          department.peerGroup,



        peerGroupLabel:

          department.peerGroupLabel,



        sourceSheet:

          department.sourceSheet,



        parentDepartment:

          department.parentDepartment,



        overallScore:

          department.overallScore,



        previousScore:

          hasPreviousData

            ? department.previousScore

            : undefined,



        scoreChange:

          hasPreviousData

            ? department.scoreChange

            : undefined,



        hospitalAvg:

          department.hospitalAvg,



        peerGroupAvg:

          department.peerGroupAvg,



        peerGroupRank:

          department.peerGroupRank,



        peerGroupSize:

          department.peerGroupSize,



        weakItems,



        /**

         * 실제 관련 VOC

         *

         * Backend GeminiService는 Action Plan에서

         * vocItems를 표준 입력명으로 사용합니다.

         */

        vocItems:

          safeVocList.map(

            (voc) => ({

              id:

                voc.id,



              content:

                voc.content,



              sentiment:

                voc.sentiment,



              category:

                voc.category,



              date:

                voc.responseDate ||

                voc.date,



              recommendationScore:

                voc.recommendationScore,



              division:

                voc.division,



              center:

                voc.center,



              department:

                voc.department,



              doctor:

                voc.doctor,



              ward:

                voc.ward,



              examRoom:

                voc.examRoom,

            })

          ),



        /**

         * Root Cause 실제 결과

         */

        rootCauses:

          (rootCauses || []).map(

            (rootCause) => ({

              dimension:

                rootCause.domainName,



              domain:

                rootCause.domainName,



              question:

                rootCause.questionText,



              cause:

                rootCause.estimatedRootCause,



              estimatedRootCause:

                rootCause.estimatedRootCause,



              currentScore:

                rootCause.currentScore,



              change:

                hasPreviousData

                  ? rootCause.scoreChange

                  : undefined,



              hospitalGap:

                rootCause.hospitalGap,



              peerGroupGap:

                rootCause.peerGroupGap,



              relatedVocSnippets:

                rootCause.relatedVocSnippets,



              correlationLevel:

                rootCause.correlationLevel,



              recommendationFocus:

                rootCause.recommendationFocus,



              evidence:

                rootCause.evidence,



              severity:

                rootCause.severity,

            })

          ),



        /**

         * 이전 버전 Prompt와의

         * 호환성

         */

        analysisInputs:

          (rootCauses || []).map(

            (rootCause) => ({

              domain:

                rootCause.domainName,



              question:

                rootCause.questionText,



              estimatedRootCause:

                rootCause.estimatedRootCause,



              currentScore:

                rootCause.currentScore,



              relatedVocSnippets:

                rootCause.relatedVocSnippets,



              correlationLevel:

                rootCause.correlationLevel,

            })

          ),



        benchmark:

          benchmarkGap ||

          undefined,

      };





      console.info(

        `[Gemini] Action Plan 생성 요청 | ${department.name} | Root Cause ${rootCauses.length}건 | VOC ${safeVocList.length}건`

      );





      const data =

        await fetchActionPlan(

          payload

        );





      if (

        !data ||

        !Array.isArray(

          data.actionPlans

        )

      ) {

        throw new Error(

          "Action Plan 응답 형식이 올바르지 않습니다."

        );

      }





      /**

       * 3대 Action Plan

       *

       * Provider 단계에서도 최대 3개로 제한

       */

      const plans =

        data.actionPlans

          .slice(0, 3)

          .map(

            (

              actionPlan: any,

              index: number

            ) => ({

              priority:

                this.normalizeActionPriority(

                  actionPlan.priority,

                  index

                ),



              title:

                String(

                  actionPlan.title ??

                    ""

                ),



              /**

               * 실행방법

               */

              method:

                this.normalizeActionMethod(

                  actionPlan

                ),



              /**

               * 적용대상

               */

              target:

                String(

                  actionPlan.target ??

                    actionPlan.owner ??

                    ""

                ),



              /**

               * 적용일정

               */

              schedule:

                String(

                  actionPlan.schedule ??

                    actionPlan.timeline ??

                    ""

                ),



              /**

               * 기대효과

               */

              expectedEffect:

                String(

                  actionPlan

                    .expectedEffect ??

                    actionPlan

                      .expectedImpact ??

                    ""

                ),



              kpi:

                String(

                  actionPlan.kpi ??

                    ""

                ),

            })

          );





      return {

        actionPlans:

          plans,

      };

    } catch (error) {

      console.error(

        "[GeminiAIProvider] Action Plan 생성 실패:",

        error

      );



      throw new Error(

        "Gemini Action Plan을 생성하지 못했습니다."

      );

    }

  }





  /**

   * ==========================================================

   * 4. Final Feedback Report

   * ==========================================================

   *

   * 매우 중요:

   *

   * VOC Analysis

   * +

   * Root Cause

   * +

   * Action Plan

   * +

   * Benchmark

   *

   * 를 전부 Backend Summary API에 전달합니다.

   */

  public async generateFeedbackReport(

    department: DepartmentSummary,

    vocList: RawVocItem[],

    context: FeedbackReportContext

  ): Promise<FeedbackReportOutput> {

    try {

      if (!context) {

        throw new Error(

          "Feedback Report 분석 Context가 없습니다."

        );

      }





      const hasPreviousData =

        Boolean(

          department.previousPeriod &&

            department

              .previousSampleSize >

              0

        );





      const weakItems =

        this.buildWeakItems(

          department,

          hasPreviousData

        );





      const payload = {

        department:

          department.displayName ||

          department.name,



        peerGroup:

          department.peerGroup,



        peerGroupLabel:

          department.peerGroupLabel,



        sourceSheet:

          department.sourceSheet,



        parentDepartment:

          department.parentDepartment,



        parentCenter:

          department.parentCenter,



        overallScore:

          department.overallScore,



        previousScore:

          hasPreviousData

            ? department.previousScore

            : undefined,



        scoreChange:

          hasPreviousData

            ? department.scoreChange

            : undefined,



        hospitalAvg:

          department.hospitalAvg,



        peerGroupAvg:

          department.peerGroupAvg,



        peerGroupRank:

          department.peerGroupRank,



        peerGroupSize:

          department.peerGroupSize,



        weakItems,



        /**

         * 최종 Summary에 VOC 원문을

         * 또 많이 보내지 않도록

         * 최대 15건으로 제한

         */

        vocList:

          (vocList || [])

            .slice(0, 15)

            .map(

              (voc) => ({

                id:

                  voc.id,



                content:

                  voc.content,



                sentiment:

                  voc.sentiment,



                category:

                  voc.category,



                date:

                  voc.responseDate ||

                  voc.date,

              })

            ),



        /**

         * ================================================

         * STEP 1 결과

         * ================================================

         */

        vocAnalysis: {

          summary:

            context.vocAnalysis

              .summary,



          keyIssues:

            context.vocAnalysis

              .keyIssues,



          sentimentDistribution:

            context.vocAnalysis

              .sentimentDistribution,



          urgencyLevel:

            context.vocAnalysis

              .urgencyLevel,

        },



        /**

         * ================================================

         * STEP 2 결과

         * ================================================

         */

        rootCauseAnalysis: {

          matches:

            context

              .rootCauseAnalysis

              .matches,



          comprehensiveDiagnosis:

            context

              .rootCauseAnalysis

              .comprehensiveDiagnosis,

        },



        /**

         * ================================================

         * STEP 3 결과

         * ================================================

         */

        actionPlanAnalysis: {

          actionPlans:

            context

              .actionPlanAnalysis

              .actionPlans,

        },



        /**

         * ================================================

         * Benchmark

         * ================================================

         */

        benchmarkData:

          context.benchmarkData,

      };





      console.info(

        `[Gemini] Final Feedback Report 요청 | ${department.name}`

      );





      const data =

        await fetchSummary(

          payload

        );





      if (

        !data ||

        !data.executiveSummary

      ) {

        throw new Error(

          "Gemini 최종 종합 분석 응답 형식이 올바르지 않습니다."

        );

      }





      const output:

        FeedbackReportOutput = {

        executiveSummary:

          String(

            data.executiveSummary

          ),



        coreProblem:

          String(

            data.coreProblem ??

              ""

          ),



        evidence:

          Array.isArray(

            data.evidence

          )

            ? data.evidence.map(

                String

              )

            : [],



        detailedDiagnosis:

          String(

            data.detailedDiagnosis ??

              data.conclusion ??

              ""

          ),



        priorityOrder:

          Array.isArray(

            data.priorityOrder

          )

            ? data.priorityOrder.map(

                String

              )

            : Array.isArray(

                data.strategicDirectives

              )

            ? data.strategicDirectives.map(

                String

              )

            : [],

      };





      /**

       * Summary Prompt에서

       * Benchmark AI 추천을 반환하도록

       * 다음 단계에서 Interface에 추가 예정.

       *

       * 현재는 타입 호환을 위해

       * 런타임 값이 있으면 보존합니다.

       */

      if (

        data.benchmarkBestPractice

      ) {

        (

          output as any

        ).benchmarkBestPractice =

          data.benchmarkBestPractice;

      }





      return output;

    } catch (error) {

      console.error(

        "[GeminiAIProvider] Feedback Report 생성 실패:",

        error

      );



      throw new Error(

        "Gemini 종합 Feedback Report를 생성하지 못했습니다."

      );

    }

  }





  /**

   * ==========================================================

   * Weak Item Builder

   * ==========================================================

   *

   * 영역평균만 보지 않고

   * 실제 세부문항까지 후보로 만듭니다.

   */

  private buildWeakItems(

    department:

      DepartmentSummary,

    hasPreviousData: boolean

  ): Array<{

    itemKey: string;



    domainName: string;



    questionText: string;



    itemName: string;



    currentScore: number;



    previousScore?: number;



    change?: number;



    hospitalAvg: number;



    peerAvg: number;



    gapWithHospital: number;



    gapWithPeerGroup: number;



    level:

      | "DOMAIN"

      | "QUESTION";

  }> {

    const items: Array<{

      itemKey: string;

      domainName: string;

      questionText: string;

      itemName: string;

      currentScore: number;

      previousScore?: number;

      change?: number;

      hospitalAvg: number;

      peerAvg: number;

      gapWithHospital: number;

      gapWithPeerGroup: number;

      level:

        | "DOMAIN"

        | "QUESTION";

    }> = [];





    for (

      const domain of

      department.domains || []

    ) {

      const domainPeerAvg =

        domain.peerGroupAvg ??

        0;



      const domainGapHospital =

        this.round1(

          domain.currentScore -

            domain.hospitalAvg

        );



      const domainGapPeer =

        this.round1(

          domain.currentScore -

            domainPeerAvg

        );





      const domainIsWeak =

        domain.status ===

          "위험" ||

        domain.status ===

          "개선필요" ||

        domain.currentScore < 80 ||

        domainGapPeer <= -3 ||

        domainGapHospital <= -3 ||

        (hasPreviousData &&

          domain.change <= -3);





      if (domainIsWeak) {

        items.push({

          itemKey:

            domain.domainId,



          domainName:

            domain.domainName,



          questionText:

            "",



          itemName:

            domain.domainName,



          currentScore:

            domain.currentScore,



          previousScore:

            hasPreviousData

              ? domain.previousScore

              : undefined,



          change:

            hasPreviousData

              ? domain.change

              : undefined,



          hospitalAvg:

            domain.hospitalAvg,



          peerAvg:

            domainPeerAvg,



          gapWithHospital:

            domainGapHospital,



          gapWithPeerGroup:

            domainGapPeer,



          level:

            "DOMAIN",

        });

      }





      /**

       * 세부문항

       */

      for (

        const question of

        domain.questions || []

      ) {

        const questionPeerAvg =

          question.peerGroupAvg ??

          0;



        const gapHospital =

          this.round1(

            question.currentScore -

              question.hospitalAvg

          );



        const gapPeer =

          this.round1(

            question.currentScore -

              questionPeerAvg

          );





        const questionIsWeak =

          question.status ===

            "위험" ||

          question.status ===

            "개선필요" ||

          question.currentScore <

            80 ||

          gapPeer <= -3 ||

          gapHospital <= -3 ||

          (hasPreviousData &&

            question.change <= -3);





        if (

          !questionIsWeak

        ) {

          continue;

        }





        items.push({

          itemKey:

            question.questionId,



          domainName:

            domain.domainName,



          questionText:

            question.questionText,



          itemName:

            `${domain.domainName} > ${question.questionText}`,



          currentScore:

            question.currentScore,



          previousScore:

            hasPreviousData

              ? question.previousScore

              : undefined,



          change:

            hasPreviousData

              ? question.change

              : undefined,



          hospitalAvg:

            question.hospitalAvg,



          peerAvg:

            questionPeerAvg,



          gapWithHospital:

            gapHospital,



          gapWithPeerGroup:

            gapPeer,



          level:

            "QUESTION",

        });

      }

    }





    /**

     * 우선순위 정렬:

     *

     * 1. Peer 평균 대비 격차

     * 2. 병원 기준 대비 격차

     * 3. 현재 점수

     *

     * 가장 취약한 항목부터

     */

    return items

      .sort(

        (a, b) => {

          if (

            a.gapWithPeerGroup !==

            b.gapWithPeerGroup

          ) {

            return (

              a.gapWithPeerGroup -

              b.gapWithPeerGroup

            );

          }



          if (

            a.gapWithHospital !==

            b.gapWithHospital

          ) {

            return (

              a.gapWithHospital -

              b.gapWithHospital

            );

          }



          return (

            a.currentScore -

            b.currentScore

          );

        }

      )

      .slice(0, 12);

  }





  /**

   * ==========================================================

   * Weak Item Matcher

   * ==========================================================

   */

  private findMatchingWeakItem(

    weakItems: any[],

    rootCause: any

  ): any | undefined {

    const question =

      this.normalizeText(

        rootCause.question

      );



    const dimension =

      this.normalizeText(

        rootCause.dimension ??

          rootCause.domain

      );





    if (question) {

      const questionMatch =

        weakItems.find(

          (item) =>

            this.normalizeText(

              item.questionText

            ) === question ||

            this.normalizeText(

              item.itemName

            ).includes(question)

        );



      if (questionMatch) {

        return questionMatch;

      }

    }





    if (dimension) {

      return weakItems.find(

        (item) =>

          this.normalizeText(

            item.domainName

          ) === dimension

      );

    }





    return undefined;

  }





  /**

   * ==========================================================

   * Normalizers

   * ==========================================================

   */



  private normalizeSentiment(

    value: unknown

  ):

    | "POSITIVE"

    | "NEUTRAL"

    | "NEGATIVE" {

    const normalized =

      String(value ?? "")

        .trim()

        .toUpperCase();





    if (

      normalized ===

        "POSITIVE" ||

      normalized === "긍정"

    ) {

      return "POSITIVE";

    }





    if (

      normalized ===

        "NEGATIVE" ||

      normalized === "부정"

    ) {

      return "NEGATIVE";

    }





    return "NEUTRAL";

  }





  private normalizeUrgency(

    value: unknown

  ):

    | "CRITICAL"

    | "HIGH"

    | "MEDIUM"

    | "LOW" {

    const normalized =

      String(value ?? "")

        .trim()

        .toUpperCase();





    if (

      normalized ===

      "CRITICAL"

    ) {

      return "CRITICAL";

    }





    if (

      normalized === "HIGH"

    ) {

      return "HIGH";

    }





    if (

      normalized === "LOW"

    ) {

      return "LOW";

    }





    return "MEDIUM";

  }





  private normalizeCorrelation(

    value: unknown

  ):

    | "VERY_HIGH"

    | "HIGH"

    | "MEDIUM"

    | "LOW" {

    const normalized =

      String(value ?? "")

        .trim()

        .toUpperCase();





    if (

      normalized ===

        "VERY_HIGH" ||

      normalized ===

        "VERY HIGH"

    ) {

      return "VERY_HIGH";

    }





    if (

      normalized === "HIGH" ||

      normalized === "STRONG"

    ) {

      return "HIGH";

    }





    if (

      normalized === "LOW"

    ) {

      return "LOW";

    }





    return "MEDIUM";

  }





  private normalizeSeverity(

    value: unknown

  ):

    | "CRITICAL"

    | "WARNING"

    | "NOTICE" {

    const normalized =

      String(value ?? "")

        .trim()

        .toUpperCase();





    if (

      normalized ===

      "CRITICAL"

    ) {

      return "CRITICAL";

    }





    if (

      normalized ===

        "WARNING" ||

      normalized === "HIGH"

    ) {

      return "WARNING";

    }





    return "NOTICE";

  }





  private normalizeActionPriority(

    value: unknown,

    index: number

  ): number {

    const parsed =

      Number(value);





    if (

      Number.isFinite(parsed) &&

      parsed > 0

    ) {

      return parsed;

    }





    const normalized =

      String(value ?? "")

        .trim()

        .toUpperCase();





    if (

      normalized === "HIGH" ||

      normalized ===

        "CRITICAL"

    ) {

      return 1;

    }





    if (

      normalized === "MEDIUM"

    ) {

      return 2;

    }





    if (

      normalized === "LOW"

    ) {

      return 3;

    }





    return index + 1;

  }





  private normalizeActionMethod(

    actionPlan: any

  ): string {

    if (

      actionPlan.method

    ) {

      return String(

        actionPlan.method

      );

    }





    if (

      Array.isArray(

        actionPlan.specificTasks

      )

    ) {

      return actionPlan

        .specificTasks

        .map(String)

        .filter(Boolean)

        .join("\n");

    }





    return String(

      actionPlan.targetIssue ??

        ""

    );

  }





  private extractEvidenceQuotes(

    rootCause: any

  ): string[] {

    if (

      Array.isArray(

        rootCause

          .relatedVocSnippets

      )

    ) {

      return rootCause

        .relatedVocSnippets

        .map(String)

        .filter(Boolean);

    }





    /**

     * evidence는 정량근거일 수도 있으므로

     * 관련 VOC 인용문으로 무조건 쓰지 않습니다.

     */

    return [];

  }





  private extractEvidenceArray(

    evidence: unknown

  ): string[] {

    if (

      Array.isArray(

        evidence

      )

    ) {

      return evidence

        .map(String)

        .filter(Boolean);

    }





    if (

      typeof evidence ===

        "string" &&

      evidence.trim()

    ) {

      return [

        evidence.trim(),

      ];

    }





    return [];

  }





  private extractVocCount(

    rootCause: any

  ): number {

    const explicit =

      Number(

        rootCause.vocCount

      );





    if (

      Number.isFinite(

        explicit

      )

    ) {

      return explicit;

    }





    if (

      Array.isArray(

        rootCause

          .relatedVocSnippets

      )

    ) {

      return rootCause

        .relatedVocSnippets

        .length;

    }





    return 0;

  }





  private numberOrFallback(

    value: unknown,

    fallback: number

  ): number {

    const parsed =

      Number(value);





    if (

      Number.isFinite(parsed)

    ) {

      return parsed;

    }





    return fallback;

  }





  private round1(

    value: number

  ): number {

    if (

      !Number.isFinite(value)

    ) {

      return 0;

    }





    return Number(

      value.toFixed(1)

    );

  }





  private normalizeText(

    value: unknown

  ): string {

    return String(

      value ?? ""

    )

      .trim()

      .toLowerCase()

      .replace(/\s+/g, "")

      .replace(

        /[()_.\/-]/g,

        ""

      );

  }

}