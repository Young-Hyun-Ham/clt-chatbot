'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import styles from './ChatInput.module.css';

const AttachIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#555" strokeWidth="1.5"/>
        <path d="M12 8V16" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 12H16" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

const useDraggableScroll = () => {
    const ref = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onMouseDown = (e) => {
        setIsDragging(true);
        if (ref.current) {
            setStartX(e.pageX - ref.current.offsetLeft);
            setScrollLeft(ref.current.scrollLeft);
        }
    };
    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e) => {
        if (!isDragging || !ref.current) return;
        e.preventDefault();
        const x = e.pageX - ref.current.offsetLeft;
        const walk = (x - startX) * 2;
        ref.current.scrollLeft = scrollLeft - walk;
    };
    return { ref, isDragging, onMouseDown, onMouseLeave, onMouseUp, onMouseMove };
};

export default function ChatInput() {
    const { 
        isLoading, 
        handleResponse,
        activePanel,
        scenarioPanel,
        currentScenarioNodeId,
        handleScenarioResponse,
        focusRequest // --- 👈 [추가] 
    } = useChatStore();
    
    const inputRef = useRef(null);
    const quickRepliesSlider = useDraggableScroll();

    // --- 👇 [수정된 부분] ---
    const lastMessage = useChatStore(state => 
        state.activePanel === 'main' 
            ? state.messages[state.messages.length - 1] 
            : state.scenarioMessages[state.scenarioMessages.length - 1]
    );
    const currentBotMessageNode = lastMessage?.sender === 'bot' ? lastMessage.node : null;

    // 포커스 로직을 명시적인 요청과 로딩 상태에만 의존하도록 단순화
    useEffect(() => {
        if (!isLoading) {
            inputRef.current?.focus();
        }
    }, [isLoading, focusRequest]);
    // --- 👆 [여기까지 수정] ---

    const handleSubmit = (e) => {
        e.preventDefault();
        const input = e.target.elements.userInput.value;
        if (!input.trim() || isLoading) return;

        console.log(`[ChatInput] Form submitted. Current activePanel is: '${activePanel}'`);

        if (activePanel === 'scenario') {
            handleScenarioResponse({
                scenarioId: scenarioPanel.scenarioId,
                currentNodeId: currentScenarioNodeId,
                userInput: input,
            });
        } else {
            handleResponse({ text: input });
        }
        e.target.reset();
    };
    
    const handleQuickReplyClick = (reply) => {
        if (activePanel === 'scenario') {
            handleScenarioResponse({ 
                scenarioId: scenarioPanel.scenarioId,
                currentNodeId: currentScenarioNodeId,
                sourceHandle: reply.value,
                userInput: reply.display
            });
        } else {
            handleResponse({ text: reply.display });
        }
    }
    
    return (
        <div className={styles.inputArea}>
            {(currentBotMessageNode?.data?.replies) && (
                <div className={styles.buttonRow}>
                    <div
                        ref={quickRepliesSlider.ref}
                        className={`${styles.quickRepliesContainer} ${quickRepliesSlider.isDragging ? styles.dragging : ''}`}
                        onMouseDown={quickRepliesSlider.onMouseDown}
                        onMouseLeave={quickRepliesSlider.onMouseLeave}
                        onMouseUp={quickRepliesSlider.onMouseUp}
                        onMouseMove={quickRepliesSlider.onMouseMove}
                    >
                        {currentBotMessageNode.data.replies.map(reply => (
                            <button key={reply.value} className={styles.optionButton} onClick={() => handleQuickReplyClick(reply)} disabled={isLoading}>
                                {reply.display}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            <form className={styles.inputForm} onSubmit={handleSubmit}>
                <button type="button" className={styles.attachButton}>
                    <AttachIcon />
                </button>
                <input
                    ref={inputRef}
                    name="userInput"
                    className={styles.textInput}
                    placeholder={activePanel === 'scenario' ? '응답을 입력하세요...' : 'Ask about this Booking Master Page'}
                    autoComplete="off"
                    disabled={isLoading}
                />
            </form>
        </div>
    );
}