import React from "react";

import {
  LayoutDashboard,
  UploadCloud,
  PlayCircle,
  AlertTriangle,
  FileText,
  LogOut,
  History,
} from "lucide-react";

import {
  BrandLogoSection,
} from "./BrandLogoSection";


/**
 * ============================================================
 * Menu IDs
 * ============================================================
 */
export type MenuItemId =
  | "dashboard"
  | "upload"
  | "criteria"
  | "vulnerable"
  | "detail"
  | "benchmark"
  | "feedback"
  | "history";


interface SidebarProps {
  activeMenu:
    MenuItemId;

  onSelectMenu:
    (
      menu:
        MenuItemId
    ) => void;

  vulnerableCount:
    number;

  totalDepts:
    number;

  onLogout?:
    () => void;
}


interface NavItem {
  id:
    MenuItemId;

  label:
    string;

  subLabel:
    string;

  icon:
    React.ComponentType<{
      className?: string;
    }>;

  badge?:
    boolean;
}


/**
 * ============================================================
 * Main Navigation
 * ============================================================
 */
const MAIN_NAV_ITEMS:
  NavItem[] = [

  {
    id:
      "dashboard",

    label:
      "Dashboard",

    subLabel:
      "종합 현황 및 KPI",

    icon:
      LayoutDashboard,
  },

  {
    id:
      "upload",

    label:
      "데이터 업로드",

    subLabel:
      "점수·VOC 파일 등록",

    icon:
      UploadCloud,
  },

  {
    id:
      "criteria",

    label:
      "분석 실행",

    subLabel:
      "기준 설정 및 선별",

    icon:
      PlayCircle,
  },

  {
    id:
      "vulnerable",

    label:
      "취약부서",

    subLabel:
      "우선 개선 대상 관리",

    icon:
      AlertTriangle,

    badge:
      true,
  },

  {
    id:
      "feedback",

    label:
      "Feedback Report",

    subLabel:
      "결과 및 Word 다운로드",

    icon:
      FileText,
  },

  {
    id:
      "history",

    label:
      "이력관리",

    subLabel:
      "피드백·후속조치 관리",

    icon:
      History,
  },
];


export const Sidebar:
  React.FC<
    SidebarProps
  > = ({
    activeMenu,
    onSelectMenu,
    vulnerableCount,
    totalDepts,
    onLogout,
  }) => {

    /**
     * ========================================================
     * Active Navigation
     * ========================================================
     *
     * detail / benchmark는
     * 분석 실행 단계의 하위 화면으로 봅니다.
     */
    const isNavActive =
      (
        id:
          MenuItemId
      ) => {

        if (
          activeMenu ===
          id
        ) {
          return true;
        }


        if (
          id ===
            "criteria" &&
          (
            activeMenu ===
              "detail" ||
            activeMenu ===
              "benchmark"
          )
        ) {
          return true;
        }


        return false;
      };


    return (
      <aside className="flex w-64 shrink-0 select-none flex-col justify-between border-r border-[#E2E8F0] bg-white text-[#334155]">

        {/* ==================================================
            TOP
        =================================================== */}

        <div>

          {/* ================================================
              Brand Header
          ================================================= */}

          <div className="flex items-center gap-3 border-b border-[#EEF1F4] px-5 py-4.5">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#243B53] text-xs font-bold text-white shadow-xs">
              CX
            </div>


            <div className="min-w-0">

              <div className="truncate text-sm font-bold tracking-tight text-[#1E293B]">
                병원 CX 분석시스템
              </div>


              <div className="truncate text-[11px] text-[#64748B]">
                환자경험평가 & VOC 지능형 분석
              </div>

            </div>

          </div>


          {/* ================================================
              Navigation
          ================================================= */}

          <div className="px-3 py-4">

            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
              주요 메뉴
            </div>


            <nav className="mt-2 space-y-1">

              {MAIN_NAV_ITEMS.map(
                (
                  item
                ) => {

                  const Icon =
                    item.icon;


                  const active =
                    isNavActive(
                      item.id
                    );


                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        onSelectMenu(
                          item.id
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-all ${
                        active
                          ? "bg-[#ECF2F7] font-bold text-[#243B53] shadow-2xs"
                          : "font-medium text-[#64748B] hover:bg-[#F8F9FA] hover:text-[#1E293B]"
                      }`}
                    >

                      <div className="flex min-w-0 items-center gap-3">

                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            active
                              ? "text-[#243B53]"
                              : "text-[#94A3B8]"
                          }`}
                        />


                        <div className="min-w-0 text-left">

                          <div className="truncate text-xs leading-tight">
                            {item.label}
                          </div>


                          <div
                            className={`truncate text-[10px] ${
                              active
                                ? "text-[#3B5B7E]"
                                : "text-[#94A3B8]"
                            }`}
                          >
                            {item.subLabel}
                          </div>

                        </div>

                      </div>


                      {item.badge &&
                        vulnerableCount >
                          0 && (

                        <span className="ml-2 inline-flex shrink-0 items-center justify-center rounded-full border border-[#F6D3D3] bg-[#FDF2F2] px-2 py-0.5 text-[10px] font-bold text-[#B94A48]">

                          {vulnerableCount}

                        </span>
                      )}

                    </button>
                  );
                }
              )}

            </nav>


            {/* ================================================
                Data Summary
            ================================================= */}

            {totalDepts >
              0 && (

              <div className="mx-2 mt-4 rounded-lg border border-[#EEF1F4] bg-[#F8F9FA] px-3 py-2.5">

                <div className="text-[10px] font-medium text-[#94A3B8]">
                  현재 분석 데이터
                </div>


                <div className="mt-0.5 text-xs font-bold text-[#334155]">
                  분석단위 {totalDepts}개
                </div>


                {vulnerableCount >
                  0 && (

                  <div className="mt-0.5 text-[10px] font-semibold text-[#B94A48]">
                    우선 개선 대상 {vulnerableCount}개
                  </div>
                )}

              </div>
            )}

          </div>

        </div>


        {/* ==================================================
            BOTTOM
        =================================================== */}

        <div className="space-y-2 border-t border-[#EEF1F4] p-3">

          <BrandLogoSection />


          {onLogout && (

            <button
              type="button"
              onClick={
                onLogout
              }
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#64748B] transition-colors hover:bg-[#FDF2F2] hover:text-[#B94A48]"
            >

              <LogOut className="h-3.5 w-3.5" />

              <span>
                로그아웃
              </span>

            </button>
          )}

        </div>

      </aside>
    );
  };
