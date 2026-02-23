// app/components/ScenarioBubble.jsx
"use client";

// --- 👇 [수정] 임포트 정리 (xlsx 제거, 컴포넌트 추가) ---
import { useCallback, useRef, useEffect, useState } from "react";
// import * as XLSX from "xlsx"; // [제거]
import { useChatStore } from "../store";
import { useTranslations } from "../hooks/useTranslations";
import styles from "./Chat.module.css";
import { validateInput, interpolateMessage } from "../lib/chatbotEngine";
import LogoIcon from "./icons/LogoIcon";
import ArrowDropDownIcon from "./icons/ArrowDropDownIcon";
import CheckCircle from "./icons/CheckCircle";
import OpenInNewIcon from "./icons/OpenInNew";
import ChevronDownIcon from "./icons/ChevronDownIcon";
// --- 👇 [추가] 추출된 컴포넌트 임포트 ---
import FormRenderer from "./FormRenderer";
import ScenarioStatusBadge from "./ScenarioStatusBadge";
// --- 👆 [추가] ---

// --- 👇 [제거] 엑셀 날짜 변환 헬퍼 (FormRenderer.jsx로 이동) ---
// function convertExcelDate(serial) { ... }
// --- 👆 [제거] ---

// --- 👇 [제거] FormRenderer 컴포넌트 (FormRenderer.jsx로 이동) ---
// const FormRenderer = ({ ... }) => { ... };
// --- 👆 [제거] ---

// --- 👇 [제거] ScenarioStatusBadge 컴포넌트 (ScenarioStatusBadge.jsx로 이동) ---
// const ScenarioStatusBadge = ({ ... }) => { ... };
// --- 👆 [제거] ---

// ScenarioBubble 컴포넌트 본체
export default function ScenarioBubble({ scenarioSessionId }) {
  const {
    scenarioStates,
    endScenario,
    setActivePanel,
    activePanel,
    activeScenarioSessionId: focusedSessionId,
    dimUnfocusedPanels,
  } = useChatStore();
  const { t } = useTranslations(); // language 제거

  const activeScenario = scenarioSessionId
    ? scenarioStates[scenarioSessionId]
    : null;
  const isCompleted =
    activeScenario?.status === "completed" ||
    activeScenario?.status === "failed" ||
    activeScenario?.status === "canceled";
  const scenarioTitle = activeScenario?.title || "Scenario";  // ✅ id → title로 변경
  const scenarioBody = activeScenario?.messages?.[0]?.text || activeScenario?.messages?.[0]?.node?.data?.content || "";  // ✅ body content 가져오기
  const isFocused =
    activePanel === "scenario" && focusedSessionId === scenarioSessionId;

  if (!activeScenario) {
    return null;
  }

  const handleBubbleClick = (e) => {
    const formElements = [
      "INPUT",
      "SELECT",
      "BUTTON",
      "LABEL",
      "OPTION",
      "TABLE",
      "THEAD",
      "TBODY",
      "TR",
      "TH",
      "TD",
    ];
    if (formElements.includes(e.target.tagName)) {
      const clickedRow = e.target.closest("tr");
      const isSelectableRow =
        clickedRow &&
        clickedRow.closest("table")?.classList.contains(styles.formGridTable) &&
        clickedRow.tagName === "TR" &&
        clickedRow.onclick;
      if (!isSelectableRow) {
        e.stopPropagation();
      }
      return;
    }

    e.stopPropagation();
    setActivePanel("scenario", scenarioSessionId);
  };

  return (
    <div
      data-message-id={scenarioSessionId}
      className={`${styles.messageRow} ${styles.userRow}`}
      onClick={handleBubbleClick}
      style={{ cursor: "pointer" }}
    >
      <div
        className={`GlassEffect ${styles.scenarioBubbleContainer} ${
          styles.collapsed
        } ${
          // 항상 collapsed
          !isFocused && dimUnfocusedPanels ? styles.dimmed : ""
        } ${isFocused ? styles.focusedBubble : ""}`}
      >
        <div className={styles.header} style={{ cursor: "pointer" }}>
          <div className={styles.headerContent}>
            {/* --- 👇 [수정] 컴포넌트 사용 --- */}
            <ScenarioStatusBadge
              status={activeScenario?.status}
              t={t}
              isSelected={isFocused}
              styles={styles} // ScenarioBubble.jsx는 Chat.module.css를 사용하므로
            />
            {/* --- 👆 [수정] --- */}

            <span className={styles.scenarioHeaderTitle}>
              {t("scenarioTitle")(
                interpolateMessage(scenarioTitle, activeScenario?.slots)
              )}
            </span>
          </div>
          <div className={styles.headerButtons}>
            <div style={{ rotate: "270deg" }}>
              <ChevronDownIcon />
            </div>
          </div>
        </div>
        {/* ✅ Body content 표시 */}
        {scenarioBody && (
          <div className={styles.messageContent}>
            <p>{scenarioBody}</p>
          </div>
        )}
      </div>
    </div>
  );
}