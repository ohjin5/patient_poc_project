import React from "react";

import {
  MenuItemId,
} from "./Sidebar";

import {
  Check,
  Sparkles,
} from "lucide-react";


interface ProcessStepperProps {
  activeMenu:
    MenuItemId;

  onSelectMenu:
    (
      menu:
        MenuItemId
    ) => void;
}


interface StepGroup {
  groupId:
    number;

  groupTitle:
    string;

  subSummary:
    string;

  targetMenu:
    MenuItemId;

  subSteps: {
    label:
      string;

    stepId?:
      MenuItemId;
  }[];
}


/**
 * ============================================================
 * Main Analysis Flow
 * ============================================================
 *
 * 현재 실제 사용자 흐름만 표시합니다.
 *
 * ① 데이터 준비
 * ② 분석 설정
 * ③ AI 분석
 * ④ 결과
 *
 * 분석이력(history)은 실제 저장 기능 연결 전까지
 * Process Stepper에서도 제외합니다.
 */
const STEP_GROUPS:
  StepGroup[] = [

  {
    groupId:
      1,

    groupTitle:
      "① 데이터 준비",

    subSummary:
      "업로드 및 무결성 검증",

    targetMenu:
      "upload",

    subSteps: [
      {
        label:
          "데이터 업로드",
      },

      {
        label:
          "데이터 검증",
      },
    ],
  },


  {
    groupId:
      2,

    groupTitle:
      "② 분석 설정",

    subSummary:
      "선별 기준 & 취약부서 확인",

    targetMenu:
      "criteria",

    subSteps: [
      {
        label:
          "기준 설정",
      },

      {
        label:
          "취약부서 선정",
      },
    ],
  },


  {
    groupId:
      3,

    groupTitle:
      "③ AI 분석",

    subSummary:
      "점수·VOC·원인·Action Plan",

    targetMenu:
      "detail",

    subSteps: [
      {
        label:
          "점수 분석",
      },

      {
        label:
          "VOC 분석",
      },

      {
        label:
          "Root Cause",
      },

      {
        label:
          "Benchmark",
      },

      {
        label:
          "Action Plan",
      },
    ],
  },


  {
    groupId:
      4,

    groupTitle:
      "④ 결과",

    subSummary:
      "Feedback Sheet & 문서 다운로드",

    targetMenu:
      "feedback",

    subSteps: [
      {
        label:
          "CX Feedback Sheet",
      },

      {
        label:
          "Word/PDF 다운로드",
      },
    ],
  },
];


export const ProcessStepper:
  React.FC<
    ProcessStepperProps
  > = ({
    activeMenu,
    onSelectMenu,
  }) => {

    /**
     * ========================================================
     * Current Step
     * ========================================================
     */

    const getActiveGroupId =
      (): number => {

        switch (
          activeMenu
        ) {

          case "upload":
            return 1;


          case "criteria":
          case "vulnerable":
            return 2;


          case "detail":
          case "benchmark":
            return 3;


          case "feedback":
            return 4;


          /**
           * history는 현재 사용자 흐름에서
           * 사용하지 않습니다.
           *
           * 혹시 내부 코드에서 history 상태가 남아 있어도
           * 정상적인 ④ 결과 단계로 표시하지 않습니다.
           */
          case "history":
            return 0;


          default:
            return 0;
        }
      };


    const activeGroupId =
      getActiveGroupId();


    const currentGroup =
      STEP_GROUPS.find(
        (
          group
        ) =>
          group.groupId ===
          activeGroupId
      );


    return (
      <div className="border-b border-[#E2E8F0] bg-white px-6 py-2.5 shadow-2xs">

        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">

          {/* =================================================
              Main Flow Step Cards
          ================================================== */}

          <div className="grid w-full max-w-3xl flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 md:w-auto">

            {STEP_GROUPS.map(
              (
                group
              ) => {

                const isCompleted =
                  activeGroupId >
                    0 &&
                  group.groupId <
                    activeGroupId;


                const isCurrent =
                  group.groupId ===
                  activeGroupId;


                return (
                  <button
                    key={
                      group.groupId
                    }
                    type="button"
                    onClick={() =>
                      onSelectMenu(
                        group.targetMenu
                      )
                    }
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                      isCurrent
                        ? "border-[#243B53] bg-[#243B53] text-white shadow-xs"
                        : isCompleted
                        ? "border-[#E2E8F0] bg-[#F8F9FA] text-[#1E293B] hover:bg-[#EEF2F6]"
                        : "border-[#EEF1F4] bg-white text-[#94A3B8] hover:bg-[#F8F9FA]"
                    }`}
                  >

                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isCurrent
                          ? "bg-white text-[#243B53]"
                          : isCompleted
                          ? "border border-[#C7E6D7] bg-[#EBF5F0] text-[#2E7D5B]"
                          : "bg-[#F1F5F9] text-[#94A3B8]"
                      }`}
                    >

                      {isCompleted
                        ? (
                          <Check className="h-3 w-3" />
                        )
                        : group.groupId}

                    </span>


                    <div className="min-w-0">

                      <div
                        className={`truncate text-xs font-bold leading-tight ${
                          isCurrent
                            ? "text-white"
                            : isCompleted
                            ? "text-[#1E293B]"
                            : "text-[#64748B]"
                        }`}
                      >
                        {group.groupTitle}
                      </div>


                      <div
                        className={`truncate text-[10px] ${
                          isCurrent
                            ? "text-slate-200"
                            : "text-[#94A3B8]"
                        }`}
                      >
                        {group.subSummary}
                      </div>

                    </div>

                  </button>
                );
              }
            )}

          </div>


          {/* =================================================
              Current Step Detail
          ================================================== */}

          {currentGroup && (

            <div className="hidden items-center gap-1.5 rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] px-3 py-1.5 text-xs text-[#475569] lg:flex">

              <span className="flex items-center gap-1 font-bold text-[#243B53]">

                <Sparkles className="h-3.5 w-3.5 text-[#3B5B7E]" />

                세부 절차:

              </span>


              <div className="flex items-center gap-1.5 text-xs">

                {currentGroup
                  .subSteps
                  .map(
                    (
                      subStep,
                      index
                    ) => (

                      <React.Fragment
                        key={
                          subStep.label
                        }
                      >

                        <span className="font-medium text-[#334155]">
                          {subStep.label}
                        </span>


                        {index <
                          currentGroup
                            .subSteps
                            .length -
                            1 && (

                          <span className="text-[#CBD5E1]">
                            ·
                          </span>
                        )}

                      </React.Fragment>
                    )
                  )}

              </div>

            </div>
          )}

        </div>

      </div>
    );
  };