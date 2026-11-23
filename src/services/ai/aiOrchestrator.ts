import {



  AIProvider,



  FeedbackReportContext,



} from "./aiProviderInterface";







import { GeminiAIProvider } from "./geminiProvider";







import { PrivacyService } from "../privacyService";







import { AnalysisEngine } from "../analysisEngine";







import {



  DepartmentSummary,



  RawVocItem,



  CXFeedbackSheetData,



  BenchmarkBestPractice,



  CX_REPORT_AUTHOR_DEPARTMENT,



  ActionPlanItem,



} from "../../types";











/**



 * ============================================================



 * Progress Callback



 * ============================================================



 */







export type AnalysisStepProgressCallback = (



  step: number,



  message: string,



  percent: number



) => void;











/**



 * ============================================================



 * CX AI Analysis Orchestrator



 * ============================================================



 *



 * 전체 처리 흐름



 *



 * 실제 Excel



 * ↓



 * Normalization



 * ↓



 * AnalysisEngine 정량 계산



 * ↓



 * 대상 분석단위 VOC 추출



 * ↓



 * 개인정보 비식별화



 * ↓



 * 동일 Peer Group Benchmark 계산



 * ↓



 * Gemini VOC 분석



 * ↓



 * Gemini Root Cause 분석



 * ↓



 * Gemini Action Plan



 * ↓



 * Gemini 최종 Summary



 * ↓



 * CX Feedback Sheet



 *



 *



 * 운영 원칙



 *



 * 1. Mock AI 금지



 * 2. Sample AI 결과 금지



 * 3. 다른 부서 VOC fallback 금지



 * 4. 관련 VOC가 없으면 없다고 표시



 * 5. 정량 계산은 코드에서 수행



 * 6. AI는 정성분석만 수행



 * 7. 환자등록번호 등 개인정보는 Gemini로 보내지 않음



 * 8. Benchmark 모범사례를 임의 생성하지 않음



 */



export class AIOrchestrator {







  private provider: AIProvider;











  constructor() {



    this.provider =



      new GeminiAIProvider();



  }











  /**



   * ==========================================================



   * Provider



   * ==========================================================



   */







  public getProviderMode(): boolean {



    return true;



  }











  /**



   * 기존 UI 호환용



   *



   * 운영버전에서는 Mock AI를 활성화하지 않습니다.



   */



  public setProviderMode(



    useGemini: boolean



  ): void {







    if (!useGemini) {



      console.warn(



        "[AIOrchestrator] Mock AI mode is disabled. Gemini provider will continue to be used."



      );



    }







    this.provider =



      new GeminiAIProvider();



  }











  /**



   * ==========================================================



   * VOC Matching



   * ==========================================================



   *



   * 중요:



   *



   * 문자열 includes 방식으로 부서를 다시 찾지 않습니다.



   *



   * normalizationService.ts에서 이미



   *



   * VOC



   * → 센터



   * → 진료과



   * → 의사



   * → 병동



   * → 검사실



   *



   * 관계를 분석하여 relatedUnitIds에 넣었으므로



   * 이를 Source of Truth로 사용합니다.



   */







  private filterDepartmentVoc(



    targetDepartment: DepartmentSummary,



    allVocItems: RawVocItem[]



  ): RawVocItem[] {







    if (



      !Array.isArray(allVocItems) ||



      allVocItems.length === 0



    ) {



      return [];



    }







    return allVocItems.filter(



      (voc) =>



        Array.isArray(



          voc.relatedUnitIds



        ) &&



        voc.relatedUnitIds.includes(



          targetDepartment.id



        )



    );



  }











  /**



   * ==========================================================



   * Positive VOC



   * ==========================================================



   *



   * Benchmark 우수부서의



   * 실제 긍정 VOC만 추출합니다.



   */







  private filterPositiveVoc(



    department: DepartmentSummary | null,



    allVocItems: RawVocItem[]



  ): RawVocItem[] {







    if (!department) {



      return [];



    }







    return this



      .filterDepartmentVoc(



        department,



        allVocItems



      )



      .filter(



        (voc) =>



          voc.sentiment ===



          "POSITIVE"



      );



  }















  /**
   * ==========================================================
   * Benchmark Reference Department
   * ==========================================================
   *
   * 동일 Peer Group 내에서 현재 분석대상을 제외하고,
   * 실제 긍정 VOC가 존재하는 부서를 점수순으로 탐색합니다.
   *
   * - 전체 VOC를 Gemini에 보내지 않음
   * - 코드에서 후보를 먼저 좁힘
   * - 실제 긍정 VOC가 있는 가장 높은 점수의 부서 1곳만 선택
   * - Gemini에는 해당 부서의 비식별 긍정 VOC 최대 3건만 전달
   */
  private findBenchmarkReferenceDepartment(
    targetDepartment: DepartmentSummary,
    allDepartments: DepartmentSummary[],
    allVocItems: RawVocItem[]
  ): {
    department: DepartmentSummary | null;
    positiveVoc: RawVocItem[];
  } {

    const candidates =
      (allDepartments || [])
        .filter(
          (department) =>
            department &&
            department.id !== targetDepartment.id &&
            department.peerGroup === targetDepartment.peerGroup &&
            Number.isFinite(department.overallScore)
        )
        .sort(
          (a, b) =>
            b.overallScore - a.overallScore
        );


    for (const department of candidates) {

      const positiveVoc =
        this.filterPositiveVoc(
          department,
          allVocItems
        );


      if (positiveVoc.length > 0) {

        return {
          department,
          positiveVoc,
        };
      }
    }


    return {
      department: null,
      positiveVoc: [],
    };
  }

  /**



   * ==========================================================



   * AI 전송용 VOC 최소 데이터



   * ==========================================================



   *



   * Gemini에는 분석에 필요한 필드만 전달합니다.



   *



   * 전달하지 않는 항목:



   *



   * - 환자등록번호



   * - 원본 비식별 전 문장



   * - 내부 raw metadata



   */







  private minimizeVocForAI(



    items: RawVocItem[]



  ): RawVocItem[] {







    return items.map(



      (item) => ({



        id: item.id,







        departmentId:



          item.departmentId,







        departmentName:



          item.departmentName,







        date:



          item.date,







        responseDate:



          item.responseDate,







        content:



          item.content,







        category:



          item.category,







        sentiment:



          item.sentiment,







        relatedDomain:



          item.relatedDomain,







        recommendationScore:



          item.recommendationScore,







        division:



          item.division,







        center:



          item.center,







        department:



          item.department,







        doctor:



          item.doctor,







        ward:



          item.ward,







        examRoom:



          item.examRoom,







        careType:



          item.careType,







        relatedUnitIds:



          item.relatedUnitIds,



      })



    );



  }











  /**



   * ==========================================================



   * Feedback Sheet Main



   * ==========================================================



   */







  public async generateFullFeedbackSheet(



    targetDepartment: DepartmentSummary,



    allDepartments: DepartmentSummary[],



    allVocItems: RawVocItem[],



    onProgress?: AnalysisStepProgressCallback



  ): Promise<CXFeedbackSheetData> {







    /**



     * ========================================================



     * Validation



     * ========================================================



     */







    if (!targetDepartment) {



      throw new Error(



        "분석할 부서 정보가 없습니다."



      );



    }







    if (



      !Array.isArray(



        allDepartments



      ) ||



      allDepartments.length === 0



    ) {



      throw new Error(



        "분석 가능한 평가 데이터가 없습니다."



      );



    }







    if (



      !Array.isArray(allVocItems)



    ) {



      allVocItems = [];



    }











    console.info(



      "============================================"



    );







    console.info(



      `[CX AI] Feedback Sheet 생성 시작`



    );







    console.info(



      `[CX AI] 분석대상: ${targetDepartment.name}`



    );







    console.info(



      `[CX AI] Peer Group: ${targetDepartment.peerGroup}`



    );







    console.info(



      `[CX AI] Source Sheet: ${targetDepartment.sourceSheet ?? "-"}`



    );







    console.info(



      "============================================"



    );











    /**



     * ========================================================



     * STEP 1



     * 해당 분석단위의 실제 VOC만 추출



     * ========================================================



     */







    onProgress?.(



      1,



      "현재 분석대상과 직접 연결된 환자 VOC를 확인하고 있습니다...",



      8



    );











    const departmentVoc =



      this.filterDepartmentVoc(



        targetDepartment,



        allVocItems



      );











    console.info(



      `[CX AI] ${targetDepartment.name} 직접 관련 VOC: ${departmentVoc.length}건`



    );











    /**



     * ========================================================



     * STEP 2



     * 개인정보 비식별화



     * ========================================================



     */







    onProgress?.(



      2,



      departmentVoc.length > 0



        ? `관련 VOC ${departmentVoc.length}건을 비식별 처리하고 있습니다...`



        : "관련 VOC가 없어 정량 평가 중심으로 분석을 준비하고 있습니다...",



      15



    );











    const {



      sanitizedItems,



    } =



      PrivacyService.sanitizeVocList(



        departmentVoc



      );











    /**



     * AI에는 필요한 데이터만 전달



     */



    const aiVocItems =



      this.minimizeVocForAI(



        sanitizedItems



      );











    /**



     * ========================================================



     * STEP 3



     * Benchmark



     * ========================================================



     *



     * Gemini가 계산하지 않습니다.



     */







    onProgress?.(



      3,



      "동일 유형 평균·순위·우수부서 Benchmark를 산출하고 있습니다...",



      25



    );











    const {



      benchmarks,



      topPerformer,



      peerGroupAvg,



      isSmallPeerGroup,



    } =



      AnalysisEngine



        .generateBenchmarkComparison(



          targetDepartment,



          allDepartments



        );











    /**
     * 동일 Peer Group 내 Benchmark 참고부서 탐색
     *
     * 기존에는 점수 1위(topPerformer) 부서에
     * 긍정 VOC가 없으면 Benchmark가 비어 있었습니다.
     *
     * 이제는:
     * 1. 동일 Peer Group
     * 2. 현재 분석대상 제외
     * 3. 점수 높은 순
     * 4. 실제 긍정 VOC가 존재하는 첫 부서
     *
     * 를 Benchmark 참고부서로 사용합니다.
     */
    const {
      department:
        benchmarkReferenceDepartment,

      positiveVoc:
        benchmarkReferencePositiveVoc,
    } =
      this.findBenchmarkReferenceDepartment(
        targetDepartment,
        allDepartments,
        allVocItems
      );





    const sanitizedBenchmarkPositiveVoc =

      PrivacyService

        .sanitizeVocList(

          benchmarkReferencePositiveVoc

        )

        .sanitizedItems;





    /**
     * Gemini에 전달하는 Benchmark VOC는
     * 최대 3건으로 제한합니다.
     */
    const benchmarkEvidence =

      this.minimizeVocForAI(

        sanitizedBenchmarkPositiveVoc

      )
        .slice(0, 3);





    console.info(

      `[CX AI] 동일유형 점수 1위 부서: ${

        topPerformer?.name ??

        "없음"

      }`

    );



    console.info(

      `[CX AI] Benchmark 참고부서: ${

        benchmarkReferenceDepartment?.name ??

        "없음"

      } | 실제 긍정 VOC ${benchmarkEvidence.length}건`

    );











    /**



     * ========================================================



     * STEP 4



     * Gemini VOC Analysis



     * ========================================================



     */







    onProgress?.(



      4,



      aiVocItems.length > 0



        ? `관련 VOC ${aiVocItems.length}건의 감성·주요 이슈를 분석하고 있습니다...`



        : "직접 연결된 VOC가 없어 정량평가를 중심으로 분석하고 있습니다...",



      40



    );











    const vocAnalysis =



      await this.provider.analyzeVOC(



        aiVocItems,



        targetDepartment.name



      );











    if (!vocAnalysis) {



      throw new Error(



        "Gemini VOC 분석 결과를 수신하지 못했습니다."



      );



    }











    /**



     * ========================================================



     * STEP 5



     * Gemini Root Cause



     * ========================================================



     */







    onProgress?.(



      5,



      aiVocItems.length > 0



        ? "취약 평가문항과 실제 VOC를 교차 분석하여 관련 원인을 분석하고 있습니다..."



        : "취약 평가문항을 중심으로 개선 필요 원인을 분석하고 있습니다...",



      60



    );











    const rootCauses =



      await this.provider



        .analyzeRootCause(



          targetDepartment,



          aiVocItems,



          {



            benchmarks,







            vocAnalysis,







            /**



             * 실제 정량 Context



             */



            peerGroupAvg,







            hospitalAvg:



              targetDepartment



                .hospitalAvg,







            peerGroupRank:



              targetDepartment



                .peerGroupRank,







            peerGroupSize:



              targetDepartment



                .peerGroupSize,







            domains:



              targetDepartment



                .domains,







            /**



             * Benchmark 우수부서 Context



             */



            topPerformer:
              benchmarkReferenceDepartment



              ? {



                  id:



                    benchmarkReferenceDepartment.id,







                  name:



                    benchmarkReferenceDepartment.name,







                  peerGroup:



                    benchmarkReferenceDepartment.peerGroup,







                  overallScore:



                    benchmarkReferenceDepartment.overallScore,







                  positiveVocCount:



                    benchmarkEvidence.length,



                }



              : null,







            topPerformerPositiveVoc:



              benchmarkEvidence,



          }



        );











    if (!rootCauses) {



      throw new Error(



        "Gemini Root Cause 분석 결과를 수신하지 못했습니다."



      );



    }











    /**



     * ========================================================



     * STEP 6



     * Gemini Action Plan



     * ========================================================



     */







    onProgress?.(

      6,

      aiVocItems.length > 0

        ? "Root Cause와 실제 관련 VOC를 함께 반영하여 부서 맞춤형 3대 개선 Action Plan을 작성하고 있습니다..."

        : "Root Cause와 취약 평가항목을 기반으로 부서 맞춤형 3대 개선 Action Plan을 작성하고 있습니다...",

      75

    );











    console.info(

      `[CX AI] Action Plan 입력 | ${targetDepartment.name} | Root Cause ${rootCauses.matches?.length ?? 0}건 | VOC ${aiVocItems.length}건`

    );























    const actionPlanOutput =

      await this.provider

        .generateActionPlan(



          targetDepartment,







          rootCauses.matches ??



            [],







          /**

           * STEP 2에서 개인정보 비식별화가 완료된 뒤

           * AI 전송용으로 최소화한 실제 관련 VOC만 전달합니다.

           */

          aiVocItems,



          {



            benchmarks,







            peerGroupAvg,







            topPerformer:



              benchmarkReferenceDepartment



                ? {



                    name:



                      benchmarkReferenceDepartment.name,







                    overallScore:



                      topPerformer



                        .overallScore,



                  }



                : null,



          }



        );











    if (!actionPlanOutput) {



      throw new Error(



        "Gemini Action Plan 결과를 수신하지 못했습니다."



      );



    }











    /**



     * 최대 3개만 사용



     *



     * AI가 4개를 반환해도



     * Feedback Sheet에는 3대 Action Plan만 표시



     *



     * 3개 미만인 경우 임의로 추가 생성하지 않음



     */



    const finalActionPlans:



      ActionPlanItem[] =



        (



          actionPlanOutput



            .actionPlans ??



          []



        )



          .slice(0, 3)



          .map(



            (



              plan,



              index



            ) => ({



              ...plan,







              priority:



                typeof plan.priority ===



                "number"



                  ? plan.priority



                  : index + 1,



            })



          );











    /**



     * ========================================================



     * STEP 7



     * Final Gemini Report



     * ========================================================



     */







    onProgress?.(



      7,



      "정량점수·VOC·Root Cause·Action Plan을 종합하여 최종 Feedback Sheet를 작성하고 있습니다...",



      90



    );











    const reportContext:



      FeedbackReportContext & {



        benchmarkEvidence?: unknown;



      } = {







      vocAnalysis,







      rootCauseAnalysis:



        rootCauses,







      actionPlanAnalysis: {



        ...actionPlanOutput,







        actionPlans:



          finalActionPlans,



      },







      benchmarkData: {



        benchmarks,







        peerGroupAvg,







        peerGroupRank:



          targetDepartment



            .peerGroupRank,







        peerGroupSize:



          targetDepartment



            .peerGroupSize,







        isSmallPeerGroup,







        topPerformer:

          benchmarkReferenceDepartment

            ? {

                id:

                  benchmarkReferenceDepartment.id,



                name:

                  benchmarkReferenceDepartment.name,



                overallScore:

                  benchmarkReferenceDepartment

                    .overallScore,



                sourceSheet:

                  benchmarkReferenceDepartment

                    .sourceSheet,

              }

            : null,



        actualTopPerformer:

          topPerformer

            ? {

                id:

                  topPerformer.id,



                name:

                  topPerformer.name,



                overallScore:

                  topPerformer.overallScore,



                sourceSheet:

                  topPerformer.sourceSheet,

              }

            : null,



        topPerformerPositiveVoc:

          benchmarkEvidence,



      },



    };











    const sheetReport =



      await this.provider



        .generateFeedbackReport(



          targetDepartment,



          aiVocItems,



          reportContext



        );











    if (!sheetReport) {



      throw new Error(



        "Gemini 최종 Feedback Report 결과를 수신하지 못했습니다."



      );



    }











    /**



     * ========================================================



     * STEP 8



     * Benchmark Best Practice



     * ========================================================



     *



     * 현재 FeedbackReportOutput 표준 타입에는



     * Benchmark 추천 필드가 아직 없습니다.



     *



     * 따라서:



     *



     * 1. Gemini 응답에 benchmarkBestPractice가



     *    실제로 존재하면 사용



     *



     * 2. 없으면 절대 만들어내지 않고 NONE



     *



     * 다음 단계에서 Prompt / Provider 타입에



     * benchmarkBestPractice를 정식 추가합니다.



     */







    const aiBenchmark =



      (



        sheetReport as any



      )?.benchmarkBestPractice;











    const benchmarkBestPractice:



      BenchmarkBestPractice =



      this.buildBenchmarkBestPractice(
        benchmarkReferenceDepartment,
        benchmarkEvidence,
        aiBenchmark
      );











    /**



     * ========================================================



     * STEP 9



     * 완료



     * ========================================================



     */







    onProgress?.(



      8,



      "CX Feedback Sheet 생성이 완료되었습니다.",



      100



    );











    /**



     * ========================================================



     * Feedback Sheet Data Assembly



     * ========================================================



     */







    const sheetData:



      CXFeedbackSheetData = {







      /**



       * ------------------------------------------------------



       * Basic Information



       * ------------------------------------------------------



       */







      departmentId:



        targetDepartment.id,







      departmentName:



        targetDepartment



          .displayName ||



        targetDepartment.name,







      departmentType:



        targetDepartment.type,







      peerGroup:



        targetDepartment.peerGroup,







      peerGroupLabel:



        targetDepartment



          .peerGroupLabel,







      sourceSheet:



        targetDepartment



          .sourceSheet,







      parentDepartment:



        targetDepartment



          .parentDepartment,







      parentCenter:



        targetDepartment



          .parentCenter,







      period:



        targetDepartment.period,







      sampleSize:



        targetDepartment



          .sampleSize,







      overallScore:



        targetDepartment



          .overallScore,







      previousScore:



        targetDepartment



          .previousScore,







      scoreChange:



        targetDepartment



          .scoreChange,







      /**



       * 해당 Sheet



       * 은평성모병원 기준값



       */



      hospitalAvg:



        targetDepartment



          .hospitalAvg,







      /**



       * 동일 유형 평균



       */



      peerGroupAvg:



        targetDepartment



          .peerGroupAvg,







      rank:



        targetDepartment



          .peerGroupRank ||



        targetDepartment.rank,







      totalRanked:



        targetDepartment



          .peerGroupSize ||



        targetDepartment



          .totalRanked,







      peerGroupRank:



        targetDepartment



          .peerGroupRank,







      peerGroupSize:



        targetDepartment



          .peerGroupSize,







      peerGroupPercentile:



        targetDepartment



          .peerGroupPercentile,







      isSmallPeerGroup:



        targetDepartment



          .isSmallPeerGroup,







      status:



        targetDepartment.status,







      priority:



        targetDepartment.priority,











      /**



       * ------------------------------------------------------



       * 작성부서



       * ------------------------------------------------------



       */







      reportAuthorDepartment:



        CX_REPORT_AUTHOR_DEPARTMENT,











      /**



       * ------------------------------------------------------



       * Section 1



       * 평가영역 + 세부문항



       * ------------------------------------------------------



       */







      domainScores:



        (



          targetDepartment



            .domains ?? []



        ).map(



          (domain) => ({







            domainName:



              domain.domainName,







            previousScore:



              domain.previousScore,







            currentScore:



              domain.currentScore,







            change:



              domain.change,







            /**



             * 공식 병원 기준



             */



            hospitalAvg:



              domain.hospitalAvg,







            peerGroupAvg:



              domain.peerGroupAvg,







            topScore:



              domain



                .topPerformerScore,







            status:



              domain.status,







            /**



             * 실제 세부문항



             */



            questions:



              domain.questions ??



              [],



          })



        ),











      /**



       * ------------------------------------------------------



       * Section 3



       * 실제 VOC 분석 요약



       * ------------------------------------------------------



       */







      topVocIssues:



        vocAnalysis.keyIssues ??



        [],







      relatedVocCount:



        departmentVoc.length,







      hasRelatedVoc:



        departmentVoc.length > 0,







      relatedVocItems:



        departmentVoc.map(



          (voc) => ({



            id:



              voc.id,







            date:



              voc.responseDate ||



              voc.date,







            sentiment:



              voc.sentiment,







            recommendationScore:



              voc.recommendationScore,







            category:



              voc.category,







            /**



             * 화면에도 비식별된 내용만 표시



             */



            content:



              voc.content,







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



       * ------------------------------------------------------



       * Benchmark



       * ------------------------------------------------------



       */







      benchmarks,







      topPerformerName:



        topPerformer



          ?.displayName ||



        topPerformer



          ?.name ||



        "동일 유형 우수부서 없음",







      /**



       * 기존 UI 호환용



       *



       * 임의 데이터 절대 넣지 않음



       */



      topPerformerBestPractices:



        benchmarkBestPractice



          .sourceType ===



            "NONE"



          ? []



          : benchmarkBestPractice



              .description



          ? [



              benchmarkBestPractice



                .description,



            ]



          : [],







      benchmarkBestPractice,











      /**



       * ------------------------------------------------------



       * AI Comprehensive Diagnosis



       * ------------------------------------------------------



       */







      aiDiagnosis: {







        executiveSummary:



          sheetReport



            .executiveSummary ||



          "",







        coreProblem:



          sheetReport



            .coreProblem ||



          "",







        evidence:



          sheetReport.evidence ||



          [],







        detailedDiagnosis:



          sheetReport



            .detailedDiagnosis ||



          rootCauses



            .comprehensiveDiagnosis ||



          "",







        priorityOrder:



          sheetReport



            .priorityOrder ||



          finalActionPlans.map(



            (



              plan,



              index



            ) =>



              `${index + 1}. ${plan.title}`



          ),



      },











      /**



       * ------------------------------------------------------



       * Section 4



       * 3대 Action Plan



       * ------------------------------------------------------



       */







      actionPlans:



        finalActionPlans,











      /**



       * ------------------------------------------------------



       * Metadata



       * ------------------------------------------------------



       */







      generatedAt:



        new Date()



          .toLocaleDateString(



            "ko-KR",



            {



              year: "numeric",



              month: "long",



              day: "numeric",



            }



          ),







      generatedBy:



        "병원 환자경험평가(CX) AI 분석 지원 시스템",



    };











    console.info(



      `[CX AI] Feedback Sheet 생성 완료 | ${targetDepartment.name}`



    );







    console.info(



      `[CX AI] 관련 VOC ${departmentVoc.length}건 | Root Cause ${rootCauses.matches?.length ?? 0}건 | Action Plan ${finalActionPlans.length}건`



    );











    return sheetData;



  }











  /**



   * ==========================================================



   * Benchmark Best Practice Builder



   * ==========================================================



   *



   * AI가 실제로 추천한 결과가 없으면



   * 임의 Best Practice를 만들지 않습니다.



   */







  private buildBenchmarkBestPractice(



    topPerformer:



      DepartmentSummary | null,







    positiveVoc:



      RawVocItem[],







    aiBenchmark?: any



  ): BenchmarkBestPractice {







    /**



     * 우수부서가 없는 경우



     */



    if (!topPerformer) {







      return {



        sourceType:



          "NONE",







        title:



          "관련 모범사례 없음",







        description:



          "동일 유형 내 비교 가능한 우수부서를 확인할 수 없습니다.",







        evidenceQuotes: [],







        aiRecommended:



          false,



      };



    }











    /**



     * AI가 실제 긍정 VOC 근거를 바탕으로



     * Benchmark를 생성한 경우에만



     * AI_RECOMMENDED로 표시



     */



    if (



      aiBenchmark &&



      positiveVoc.length > 0



    ) {







      const description =



        String(



          aiBenchmark.description ??



          aiBenchmark.summary ??



          ""



        ).trim();











      if (description) {







        return {



          sourceType:



            "AI_RECOMMENDED",







          sourceDepartment:



            topPerformer



              .displayName ||



            topPerformer.name,







          title:



            String(



              aiBenchmark.title ??



              "긍정 VOC 기반 AI 추천 벤치마킹 사례"



            ),







          description,







          evidenceQuotes:



            positiveVoc



              .slice(0, 3)



              .map(



                (voc) =>



                  voc.content



              ),







          aiRecommended:



            true,







          disclaimer:



            "동일 유형 타 부서의 실제 긍정 VOC를 기반으로 AI가 구성한 참고사례입니다. 긍정 VOC와 특정 운영방식 간 인과관계를 확정하거나 공식 Best Practice로 검증된 사례를 의미하지 않습니다.",



        };



      }



    }











    /**



     * 실제 긍정 VOC는 있지만



     * Gemini가 Benchmark 사례를



     * 아직 생성하지 않은 경우



     *



     * 코드가 임의로 요약하지 않습니다.



     */



    if (



      positiveVoc.length > 0



    ) {







      return {



        sourceType:



          "NONE",







        sourceDepartment:



          topPerformer



            .displayName ||



          topPerformer.name,







        title:



          "AI 추천 벤치마킹 분석 미생성",







        description:



          "우수부서의 긍정 VOC는 확인되었으나, 현재 AI 응답에서 벤치마킹 추천 결과가 생성되지 않았습니다.",







        evidenceQuotes:



          positiveVoc



            .slice(0, 3)



            .map(



              (voc) =>



                voc.content



            ),







        aiRecommended:



          false,







        disclaimer:



          "실제 긍정 VOC는 존재하지만 이를 임의로 모범사례로 해석하지 않습니다.",



      };



    }











    /**



     * 우수부서는 있으나



     * 긍정 VOC / 실제 사례 근거가 없음



     */



    return {



      sourceType:



        "NONE",







      sourceDepartment:



        topPerformer



          .displayName ||



        topPerformer.name,







      title:



        "관련 모범사례 없음",







      description:



        "동일 유형 내에서 실제 긍정 VOC 근거를 가진 참고부서를 확인하지 못해 구체적인 벤치마킹 사례를 제시하지 않습니다.",







      evidenceQuotes: [],







      aiRecommended:



        false,



    };



  }



}











/**



 * ============================================================



 * Singleton



 * ============================================================



 */







export const aiOrchestrator =



  new AIOrchestrator();