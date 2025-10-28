"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChatStore } from "../store";
import { useTranslations } from "../hooks/useTranslations";
import styles from "./Chat.module.css";
import FavoritePanel from "./FavoritePanel";
import ScenarioBubble from "./ScenarioBubble";
import CheckCircle from "./icons/CheckCircle";
import MoonIcon from "./icons/MoonIcon";
import LogoIcon from "./icons/LogoIcon";
import CopyIcon from "./icons/CopyIcon";

// JSON 파싱 및 렌더링을 위한 헬퍼 함수 (기존 코드 유지)
const tryParseJson = (text) => {
  try {
    if (
      typeof text === "string" &&
      text.startsWith("{") &&
      text.endsWith("}")
    ) {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (e) {
    // JSON 파싱 실패 시 무시
  }
  return null;
};

// MessageWithButtons 컴포넌트 (기존 코드 유지)
const MessageWithButtons = ({ text, messageId }) => {
  const { handleShortcutClick, scenarioCategories, selectedOptions } =
    useChatStore();
  const selectedOption = selectedOptions[messageId];

  const findShortcutByTitle = useCallback(
    (title) => {
      if (!scenarioCategories) return null;
      for (const category of scenarioCategories) {
        for (const subCategory of category.subCategories) {
          const item = subCategory.items.find((i) => i.title === title);
          if (item) return item;
        }
      }
      return null;
    },
    [scenarioCategories]
  );

  if (!text) return null;

  // "Loop back to Supervisor" 포함 여부 확인 (기존 코드 유지)
  const showLoadingGifForLoopback =
    typeof text === "string" && text.includes("Loop back to Supervisor");
  if (showLoadingGifForLoopback) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span>init flow..</span>
        <img
          src="/images/Loading.gif"
          alt="Loading..."
          style={{ width: "60px", height: "45px", marginTop: "8px" }}
        />
      </div>
    );
  }

  // JSON 메시지 처리 로직 (기존 코드 유지)
  const jsonContent = tryParseJson(text);
  if (jsonContent && jsonContent.next && jsonContent.instructions) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span>{jsonContent.instructions}</span>
        <img
          src="/images/Loading.gif"
          alt="Loading..."
          style={{ width: "60px", height: "45px", marginTop: "8px" }}
        />
      </div>
    );
  }

  // 버튼 파싱 및 렌더링 로직 (기존 코드 유지)
  const regex = /\[BUTTON:(.+?)\]/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  if (typeof text === "string") {
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.substring(lastIndex, match.index),
        });
      }
      parts.push({ type: "button", content: match[1] });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.substring(lastIndex) });
    }
  } else {
    parts.push({ type: "text", content: text });
  }

  if (parts.length === 0) {
    return typeof text === "string" ? <>{text}</> : <></>;
  }

  return (
    <div>
      {parts.map((part, index) => {
        if (part.type === "text") {
          const contentString =
            typeof part.content === "string"
              ? part.content
              : JSON.stringify(part.content);
          return <span key={index}>{contentString}</span>;
        } else if (part.type === "button") {
          const buttonText = part.content;
          const shortcutItem = findShortcutByTitle(buttonText);
          const isSelected = selectedOption === buttonText;
          const isDimmed = selectedOption && !isSelected;

          if (shortcutItem) {
            return (
              <button
                key={index}
                className={`${styles.optionButton} ${
                  isSelected ? styles.selected : ""
                } ${isDimmed ? styles.dimmed : ""}`}
                style={{ margin: "4px 4px 4px 0", display: "block" }}
                onClick={() => handleShortcutClick(shortcutItem, messageId)}
                disabled={!!selectedOption}
              >
                {buttonText}
              </button>
            );
          }
          return <span key={index}>{`[BUTTON:${part.content}]`}</span>;
        }
        return null;
      })}
    </div>
  );
};


export default function Chat() {
  const {
    messages,
    isLoading,
    openScenarioPanel,
    loadMoreMessages,
    hasMoreMessages,
    theme,
    setTheme,
    fontSize,
    setFontSize,
    scrollToMessageId,
    setScrollToMessageId,
    activePanel,
    forceScrollToBottom,
    setForceScrollToBottom,
    scrollAmount,
    resetScroll,
    selectedOptions,
    setSelectedOption,
    dimUnfocusedPanels,
  } = useChatStore();
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const historyRef = useRef(null);
  const containerRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const { t } = useTranslations();

  // 스크롤 관련 함수 및 useEffect들 (변경 없음 - 코드 유지)
  const updateWasAtBottom = useCallback(() => {
    const scrollContainer = historyRef.current;
    if (!scrollContainer) return;
    const scrollableDistance =
      scrollContainer.scrollHeight -
      scrollContainer.clientHeight -
      scrollContainer.scrollTop;
    wasAtBottomRef.current = scrollableDistance <= 100;
  }, []);

  const handleScroll = useCallback(async () => {
    if (
      historyRef.current?.scrollTop === 0 &&
      hasMoreMessages &&
      !isFetchingMore
    ) {
      setIsFetchingMore(true);
      const initialHeight = historyRef.current.scrollHeight;
      await loadMoreMessages();
      if (historyRef.current) {
        const newHeight = historyRef.current.scrollHeight;
        historyRef.current.scrollTop = newHeight - initialHeight;
      }
      setIsFetchingMore(false);
    }
  }, [hasMoreMessages, isFetchingMore, loadMoreMessages]);

  useEffect(() => {
    if (forceScrollToBottom && historyRef.current) {
      const scrollContainer = historyRef.current;
      setTimeout(() => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        setForceScrollToBottom(false);
        wasAtBottomRef.current = true;
      }, 0);
    }
  }, [forceScrollToBottom, setForceScrollToBottom]);

  useEffect(() => {
    if (scrollAmount && historyRef.current) {
      historyRef.current.scrollBy({ top: scrollAmount, behavior: "smooth" });
      updateWasAtBottom();
      resetScroll();
    }
  }, [scrollAmount, resetScroll, updateWasAtBottom]);

  useEffect(() => {
    const scrollContainer = historyRef.current;
    if (!scrollContainer) return;
    const handleScrollEvent = () => {
      updateWasAtBottom();
      handleScroll();
    };
    updateWasAtBottom();
    scrollContainer.addEventListener("scroll", handleScrollEvent);
    return () => {
      scrollContainer.removeEventListener("scroll", handleScrollEvent);
    };
  }, [handleScroll, updateWasAtBottom]);

   useEffect(() => {
    const scrollContainer = historyRef.current;
    if (!scrollContainer) return;
    const lastMessage = messages[messages.length - 1];
    const shouldAutoScroll = lastMessage?.sender === 'user' || wasAtBottomRef.current;
    if (!shouldAutoScroll) return;
    requestAnimationFrame(() => {
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            wasAtBottomRef.current = true;
        }
    });
  }, [messages]);

  useEffect(() => {
    if (scrollToMessageId && historyRef.current) {
      const element = historyRef.current.querySelector(
        `[data-message-id="${scrollToMessageId}"]`
      );
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add(styles.highlightedMessage);
        setTimeout(() => {
          element.classList.remove(styles.highlightedMessage);
        }, 800);
        setScrollToMessageId(null);
      } else {
          console.warn(`Element with data-message-id="${scrollToMessageId}" not found in main chat.`);
      }
    }
  }, [scrollToMessageId, messages, setScrollToMessageId]);

  useEffect(() => {
    const container = containerRef.current;
    const scrollTarget = historyRef.current;
    if (!container || !scrollTarget) return;
    const handleWheelOutsideHistory = (event) => {
      if (event.defaultPrevented) return;
      const withinHistory = event.target.closest(`.${styles.history}`);
      if (withinHistory) return;
      scrollTarget.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" });
      updateWasAtBottom();
      event.preventDefault();
    };
    container.addEventListener("wheel", handleWheelOutsideHistory, { passive: false });
    return () => { container.removeEventListener("wheel", handleWheelOutsideHistory); };
  }, [updateWasAtBottom]);

  // handleCopy 함수 (변경 없음)
  const handleCopy = (text, id) => {
    let textToCopy = text;
    if (typeof text === 'object' && text !== null) {
      try { textToCopy = JSON.stringify(text, null, 2); } catch (e) { console.error("Failed to stringify object for copying:", e); return; }
    }
    if (!textToCopy || (typeof textToCopy === 'string' && textToCopy.trim() === '')) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 1500);
    });
  };

  const hasMessages = messages.some((m) => m.id !== "initial");

  return (
    <div className={styles.chatContainer} ref={containerRef}>
      <div className={styles.header}>
        {/* 헤더 버튼 (변경 없음) */}
         <div className={styles.headerButtons}>
          <div className={styles.settingControl} style={{ display: 'none' }}>
             <span className={styles.settingLabel}>Large text</span>
             <label className={styles.switch}>
               <input type="checkbox" checked={fontSize === "default"} onChange={() => setFontSize(fontSize === "default" ? "small" : "default")} />
               <span className={styles.slider}></span>
             </label>
           </div>
           <div className={styles.separator} style={{ display: 'none' }}></div>
           <div style={{ display: 'none' }}>
             <button className={styles.themeToggleButton} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
               <MoonIcon />
             </button>
           </div>
        </div>
      </div>

      <div
        className={`${styles.history} ${
          activePanel === "scenario" && dimUnfocusedPanels ? styles.mainChatDimmed : ""
        }`}
        ref={historyRef}
      >
        {!hasMessages ? (
          <FavoritePanel />
        ) : (
          <>
            {/* --- 👇 [수정] 이전 메시지 로딩 인디케이터 코드 복구 --- */}
            {isFetchingMore && (
              <div className={styles.messageRow}>
                <div className={`${styles.message} ${styles.botMessage}`}>
                  <div className={styles.messageContentWrapper}>
                    <LogoIcon />
                    <div className={styles.messageContent}>
                      <img
                        src="/images/Loading.gif"
                        alt={t("loading")}
                        style={{ width: "40px", height: "30px" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* --- 👆 [수정] --- */}
            {/* 메시지 목록 렌더링 */}
            {messages.map((msg) => {
              if (msg.id === "initial") return null;

              if (msg.type === "scenario_bubble") {
                // ScenarioBubble 렌더링
                return (
                  <ScenarioBubble
                    key={msg.id || msg.scenarioSessionId}
                    scenarioSessionId={msg.scenarioSessionId}
                  />
                );
              } else {
                // 일반 메시지 렌더링 (User 또는 Bot 텍스트/버튼 메시지)
                const selectedOption = selectedOptions[msg.id];
                return (
                  <div
                    key={msg.id}
                    className={`${styles.messageRow} ${
                      msg.sender === "user" ? styles.userRow : ""
                    }`}
                    data-message-id={msg.id}
                  >
                    <div
                      className={`GlassEffect ${styles.message} ${
                        msg.sender === "bot"
                          ? styles.botMessage
                          : styles.userMessage
                      } `}
                    >
                      {copiedMessageId === msg.id && (
                        <div className={styles.copyFeedback}>{t("copied")}</div>
                      )}
                      <div className={styles.messageContentWrapper}>
                        {msg.sender === "bot" && <LogoIcon />}
                        <div className={styles.messageContent}>
                          {msg.text !== undefined && msg.text !== null && (
                            <MessageWithButtons
                              text={msg.text}
                              messageId={msg.id}
                            />
                          )}
                           {msg.sender === "bot" && msg.scenarios && (
                            <div className={styles.scenarioList}>
                              {msg.scenarios.map((name) => {
                                const isSelected = selectedOption === name;
                                const isDimmed = selectedOption && !isSelected;
                                return (
                                  <button
                                    key={name}
                                    className={`${styles.optionButton} ${
                                      isSelected ? styles.selected : ""
                                    } ${isDimmed ? styles.dimmed : ""}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedOption(msg.id, name);
                                      openScenarioPanel(name);
                                    }}
                                    disabled={!!selectedOption}
                                  >
                                    <span className={styles.optionButtonText}>
                                      {name}
                                    </span>
                                    <CheckCircle />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      {msg.sender === "bot" && msg.text && (
                        <div className={styles.messageActionArea}>
                          <button
                            className={styles.actionButton}
                            onClick={() => handleCopy(msg.text, msg.id)}
                          >
                            <CopyIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            })}
            {/* 봇 응답 로딩 인디케이터 (변경 없음) */}
            {isLoading && !messages.some(m => m.isStreaming) && (
              <div className={styles.messageRow}>
                <div className={`${styles.message} ${styles.botMessage}`}>
                  <div className={styles.messageContentWrapper}>
                    <LogoIcon />
                    <div className={styles.messageContent}>
                      <img
                        src="/images/Loading.gif"
                        alt={t("loading")}
                        style={{ width: "40px", height: "30px" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}