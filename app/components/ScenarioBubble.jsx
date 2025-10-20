"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store";
import { useTranslations } from "../hooks/useTranslations";
import styles from "./Chat.module.css";
import { validateInput, interpolateMessage } from "../lib/chatbotEngine";
import LogoIcon from "./icons/LogoIcon";
import ChevronDownIcon from "./icons/ChevronDownIcon";

const FormRenderer = ({ node, onFormSubmit, disabled, language, slots }) => {
  const [formData, setFormData] = useState({});
  const dateInputRef = useRef(null);
  const { t } = useTranslations();

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMultiInputChange = (name, value, checked) => {
    setFormData((prev) => {
      const existing = prev[name] || [];
      const newValues = checked
        ? [...existing, value]
        : existing.filter((v) => v !== value);
      return { ...prev, [name]: newValues };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    for (const element of node.data.elements) {
      if (element.type === "input" || element.type === "date") {
        const value = formData[element.name] || "";
        const { isValid, message } = validateInput(
          value,
          element.validation,
          language
        );
        if (!isValid) {
          alert(message);
          return;
        }
      }
    }
    onFormSubmit(formData);
  };

  const handleDateInputClick = () => {
    try {
      dateInputRef.current?.showPicker();
    } catch (error) {
      console.error("Failed to show date picker:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h3>{node.data.title}</h3>
      {node.data.elements?.map((el) => {
        const dateProps = {};
        if (el.type === "date" && el.validation) {
          if (el.validation.type === "today after") {
            dateProps.min = new Date().toISOString().split("T")[0];
          } else if (el.validation.type === "today before") {
            dateProps.max = new Date().toISOString().split("T")[0];
          } else if (el.validation.type === "custom") {
            if (el.validation.startDate)
              dateProps.min = el.validation.startDate;
            if (el.validation.endDate) dateProps.max = el.validation.endDate;
          }
        }
        return (
          <div key={el.id} className={styles.formElement}>
            {el.type !== 'grid' && <label className={styles.formLabel}>{el.label}</label>}

            {el.type === "input" && (
              <input
                className={styles.formInput}
                type="text"
                placeholder={el.placeholder}
                value={formData[el.name] || ""}
                onChange={(e) => handleInputChange(el.name, e.target.value)}
                disabled={disabled}
              />
            )}

            {el.type === "date" && (
              <input
                ref={dateInputRef}
                className={styles.formInput}
                type="date"
                value={formData[el.name] || ""}
                onChange={(e) => handleInputChange(el.name, e.target.value)}
                onClick={handleDateInputClick}
                disabled={disabled}
                {...dateProps}
              />
            )}

            {el.type === "dropbox" && (
              <select
                value={formData[el.name] || ""}
                onChange={(e) => handleInputChange(el.name, e.target.value)}
                disabled={disabled}
              >
                <option value="" disabled>
                  {t("select")}
                </option>
                {el.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {el.type === "checkbox" &&
              el.options?.map((opt) => (
                <div key={opt}>
                  <input
                    type="checkbox"
                    id={`${el.id}-${opt}`}
                    value={opt}
                    onChange={(e) =>
                      handleMultiInputChange(el.name, opt, e.target.checked)
                    }
                    disabled={disabled}
                  />
                  <label htmlFor={`${el.id}-${opt}`}>{opt}</label>
                </div>
              ))}

            {/* --- 👇 [수정된 부분] --- */}
            {el.type === 'grid' && (() => {
              const columns = el.columns || 2;
              const nodeData = el.data;
              let sourceData = []; // 최종적으로 셀에 표시될 값들의 배열

              // el.data가 배열 형태인지 확인 (예: ["{vvdInfo[0].vvd}", "{vvdInfo[0].pol}", ...])
              if (Array.isArray(nodeData)) {
                  // 배열의 각 항목(문자열)을 interpolateMessage를 사용해 실제 값으로 변환
                  sourceData = nodeData.map(item =>
                      typeof item === 'string' ? interpolateMessage(item, slots) : String(item || '')
                  );
              } else if (typeof nodeData === 'string' && nodeData.startsWith('{') && nodeData.endsWith('}')) {
                  // el.data가 슬롯 변수 참조 문자열인 경우 (예: "{myGridData}")
                  const slotName = nodeData.substring(1, nodeData.length - 1);
                  const slotValue = slots[slotName];
                  // 슬롯 값이 배열이라면, 각 항목을 문자열로 변환 (객체/배열은 직접 표시 어려움)
                  if (Array.isArray(slotValue)) {
                      sourceData = slotValue.map(item => String(item || ''));
                  }
              }

              // 실제 값들(sourceData)을 기반으로 테이블 행(rowsData) 구성
              const rowsData = [];
              if (sourceData.length > 0) {
                for (let i = 0; i < sourceData.length; i += columns) {
                  rowsData.push(sourceData.slice(i, i + columns));
                }
              }

              return (
                <table className={styles.formGridTable}>
                  <tbody>
                    {rowsData.map((row, r) => (
                      <tr key={r}>
                        {row.map((cellValue, c) => ( // cellValue는 이미 보간된 실제 값
                          <td key={c}>
                            {cellValue}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            {/* --- 👆 [여기까지] --- */}
          </div>
        );
      })}
      {!disabled && (
        <button type="submit" className={styles.formSubmitButton}>
          {t("submit")}
        </button>
      )}
    </form>
  );
};


const ScenarioStatusBadge = ({ status, t }) => {
  if (!status) return null;
  let text;
  let statusClass;

  switch (status) {
    case "completed":
      text = t("statusCompleted");
      statusClass = "done";
      break;
    case "active":
      text = t("statusActive");
      statusClass = "incomplete";
      break;
    case "failed":
      text = t("statusFailed");
      statusClass = "failed";
      break;
    case "generating":
      text = t("statusGenerating");
      statusClass = "generating";
      break;
    case "canceled":
      text = t("statusCanceled");
      statusClass = "canceled";
      break;
    default:
      return null;
  }
  return (
    <span className={`${styles.scenarioBadge} ${styles[statusClass]}`}>
      {text}
    </span>
  );
};

export default function ScenarioBubble({ scenarioSessionId }) {
  const {
    messages,
    scenarioStates,
    handleScenarioResponse,
    endScenario,
    setActivePanel,
    activePanel,
    activeScenarioSessionId: focusedSessionId,
    scrollBy,
    dimUnfocusedPanels,
    setScenarioSelectedOption,
  } = useChatStore();
  const { t, language } = useTranslations();

  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeScenario = scenarioSessionId
    ? scenarioStates[scenarioSessionId]
    : null;
  const isCompleted =
    activeScenario?.status === "completed" ||
    activeScenario?.status === "failed" ||
    activeScenario?.status === "canceled";
  const scenarioMessages = activeScenario?.messages || [];
  const isScenarioLoading = activeScenario?.isLoading || false;
  const currentScenarioNodeId = activeScenario?.state?.currentNodeId;
  const scenarioId = activeScenario?.scenarioId;
  const isFocused =
    activePanel === "scenario" && focusedSessionId === scenarioSessionId;

  const historyRef = useRef(null);
  const bubbleRef = useRef(null);

  useEffect(() => {
    setIsCollapsed(false);
  }, []);

  useEffect(() => {
    const scrollContainer = historyRef.current;
    if (!scrollContainer || isCollapsed) return;

    const scrollToBottom = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    scrollToBottom();
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(scrollContainer, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [scenarioMessages, isCollapsed]);

  if (!activeScenario) {
    return null;
  }

  const handleFormSubmit = (formData) => {
    handleScenarioResponse({
      scenarioSessionId: scenarioSessionId,
      currentNodeId: currentScenarioNodeId,
      formData: formData,
    });
  };

  const handleBubbleClick = (e) => {
    e.stopPropagation();
    if (!isCompleted) {
      setActivePanel("scenario", scenarioSessionId);
    }
  };

  const handleToggleCollapse = (e) => {
    e.stopPropagation();

    if (isCollapsed) {
      setIsCollapsed(false);
      setTimeout(() => {
        const isLastMessage =
          messages.length > 0 &&
          messages[messages.length - 1].scenarioSessionId ===
            scenarioSessionId;

        if (isLastMessage) {
          setActivePanel("main");
          if (bubbleRef.current) {
            const contentHeight = bubbleRef.current.scrollHeight - 60;
            scrollBy(contentHeight);
          }
        }

        if (
          activeScenario?.status === "active" ||
          activeScenario?.status === "generating"
        ) {
          const focusDelay = isLastMessage ? 350 : 0;
          setTimeout(() => {
            setActivePanel("scenario", scenarioSessionId);
          }, focusDelay);
        }
      }, 400);
    } else {
      if (
        isFocused &&
        (activeScenario?.status === "active" ||
          activeScenario?.status === "generating")
      ) {
        setActivePanel("main");
      }
      setIsCollapsed(true);
    }
  };

  return (
    <div
      className={`${styles.messageRow} ${styles.userRow}`}
      onClick={handleBubbleClick}
      ref={bubbleRef}
    >
      <div
        className={`GlassEffect ${styles.scenarioBubbleContainer} ${
          isCollapsed ? styles.collapsed : ""
        } ${!isFocused && dimUnfocusedPanels ? styles.dimmed : ""}`}
      >
        <div
          className={styles.header}
          onClick={handleToggleCollapse}
          style={{ cursor: "pointer" }}
        >
          <div className={styles.headerContent}>
            <ChevronDownIcon isRotated={isCollapsed} />
            <span className={styles.headerTitle}>
              {t("scenarioTitle")(scenarioId)}
            </span>
          </div>
          <div className={styles.headerButtons}>
            <ScenarioStatusBadge status={activeScenario?.status} t={t} />
            {!isCompleted && (
              <button
                className={`${styles.headerRestartButton} `}
                onClick={(e) => {
                  e.stopPropagation();
                  endScenario(scenarioSessionId, "canceled");
                }}
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </div>

        <div className={styles.history} ref={historyRef}>
          {scenarioMessages
            .filter((msg) => msg.node?.type !== "set-slot")
            .map((msg, index) => (
              <div
                key={`${msg.id}-${index}`}
                className={`${styles.messageRow} ${
                  msg.sender === "user" ? styles.userRow : ""
                }`}
              >
                <div
                  className={`GlassEffect ${styles.message} ${
                    msg.sender === "bot" ? styles.botMessage : styles.userMessage
                  }`}
                >
                  <div className={styles.scenarioMessageContentWrapper}>
                    {msg.sender === "bot" && <LogoIcon />}
                    <div className={styles.messageContent}>
                      {msg.node?.type === "form" ? (
                        <FormRenderer
                          node={msg.node}
                          onFormSubmit={handleFormSubmit}
                          disabled={isCompleted}
                          language={language}
                          slots={activeScenario?.slots}
                        />
                      ) : msg.node?.type === "iframe" ? (
                        <div className={styles.iframeContainer}>
                          <iframe
                            src={msg.node.data.url}
                            width={msg.node.data.width || "100%"}
                            height={msg.node.data.height || "250"}
                            style={{ border: "none", borderRadius: "18px" }}
                            title="chatbot-iframe"
                          ></iframe>
                        </div>
                      ) : msg.node?.type === "link" ? (
                        <div>
                          <span>Opening link in a new tab: </span>
                          <a
                            href={msg.node.data.content}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {msg.node.data.display || msg.node.data.content}
                          </a>
                        </div>
                      ) : (
                        <p>{msg.text || msg.node?.data.content}</p>
                      )}
                      {msg.node?.type === "branch" && msg.node.data.replies && (
                        <div className={styles.scenarioList}>
                          {msg.node.data.replies.map((reply) => {
                            const selectedOption = msg.selectedOption;
                            const isSelected = selectedOption === reply.display;
                            const isDimmed = selectedOption && !isSelected;

                            return (
                              <button
                                key={reply.value}
                                className={`${styles.optionButton} ${
                                  isSelected ? styles.selected : ""
                                } ${isDimmed ? styles.dimmed : ""}`}
                                onClick={() => {
                                  if (selectedOption) return;
                                  setScenarioSelectedOption(
                                    scenarioSessionId,
                                    msg.node.id,
                                    reply.display
                                  );
                                  handleScenarioResponse({
                                    scenarioSessionId: scenarioSessionId,
                                    currentNodeId: msg.node.id,
                                    sourceHandle: reply.value,
                                    userInput: reply.display,
                                  });
                                }}
                                disabled={isCompleted || !!selectedOption}
                              >
                                {reply.display}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          {isScenarioLoading && (
            <div className={styles.messageRow}>
              <img
                src="/images/avatar-loading.png"
                alt="Avatar"
                className={styles.avatar}
              />
              <div className={`${styles.message} ${styles.botMessage}`}>
                <img
                  src="/images/Loading.gif"
                  alt={t("loading")}
                  style={{ width: "40px", height: "30px" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}