'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../store';
import { useTranslations } from '../hooks/useTranslations';
import styles from './ChatInput.module.css';
import StarIcon from './icons/StarIcon'; // --- [추가]

const ChevronDownIcon = ({ size = 16, style = {} }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
        <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
        activeScenarioSessionId,
        scenarioStates,
        handleScenarioResponse,
        focusRequest,
        openScenarioPanel,
        scenarioCategories,
    } = useChatStore();
    
    const { t } = useTranslations();
    const inputRef = useRef(null);
    const quickRepliesSlider = useDraggableScroll();
    const [openMenu, setOpenMenu] = useState(null);
    const menuRef = useRef(null);

    const activeScenario = activeScenarioSessionId ? scenarioStates[activeScenarioSessionId] : null;
    const scenarioMessages = activeScenario?.messages || [];
    const mainMessages = useChatStore(state => state.messages);
    
    const isInputDisabled = activePanel === 'scenario' 
        ? activeScenario?.isLoading ?? false 
        : isLoading;

    const lastMessage = activePanel === 'main' 
            ? mainMessages[mainMessages.length - 1] 
            : scenarioMessages[scenarioMessages.length - 1];
    
    const currentBotMessageNode = lastMessage?.sender === 'bot' ? lastMessage.node : null;
    const currentScenarioNodeId = activeScenario?.state?.currentNodeId;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);


    useEffect(() => {
        if (!isInputDisabled) {
            inputRef.current?.focus();
        }
    }, [isInputDisabled, focusRequest, activePanel]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const input = e.target.elements.userInput.value;
        if (!input.trim() || isInputDisabled) return;

        if (activePanel === 'scenario') {
            handleScenarioResponse({
                scenarioSessionId: activeScenarioSessionId,
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
                scenarioSessionId: activeScenarioSessionId,
                currentNodeId: currentScenarioNodeId,
                sourceHandle: reply.value,
                userInput: reply.display
            });
        } else {
            handleResponse({ text: reply.display });
        }
    }
    
    const handleScenarioClick = (item) => {
        if (item.scenarioId === 'GET_SCENARIO_LIST') {
            handleResponse({ text: item.title });
        } else {
            openScenarioPanel(item.scenarioId);
        }
        setOpenMenu(null);
    };
    
    return (
        <div className={styles.inputArea}>
            <div className={styles.quickActionsContainer} ref={menuRef}>
                {scenarioCategories.map(category => (
                    <div key={category.name} className={styles.categoryWrapper}>
                        <button 
                            className={`${styles.categoryButton} ${openMenu === category.name ? styles.active : ''}`}
                            onClick={() => setOpenMenu(openMenu === category.name ? null : category.name)}
                        >
                            {category.name} <ChevronDownIcon style={{ transform: openMenu === category.name ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}/>
                        </button>
                        {openMenu === category.name && (
                            <div className={styles.dropdownMenu}>
                               {category.subCategories.map(subCategory => (
                                   <div key={subCategory.title} className={styles.subCategorySection}>
                                       <h4 className={styles.subCategoryTitle}>{subCategory.title}</h4>
                                       {subCategory.items.map(item => (
                                           <button 
                                                key={item.title} 
                                                className={styles.dropdownItem}
                                                onClick={() => handleScenarioClick(item)}
                                            >
                                                <div className={styles.itemIcon}><StarIcon size={14} /></div>
                                                <div className={styles.itemContent}>
                                                    <span className={styles.itemTitle}>{item.title}</span>
                                                    <span className={styles.itemDescription}>{item.description}</span>
                                                </div>
                                           </button>
                                       ))}
                                   </div>
                               ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

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
                            <button key={reply.value} className={styles.optionButton} onClick={() => handleQuickReplyClick(reply)} disabled={isInputDisabled}>
                                {reply.display}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            <form className={styles.inputForm} onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    name="userInput"
                    className={styles.textInput}
                    placeholder={activePanel === 'scenario' ? t('enterResponse') : t('askAboutService')}
                    autoComplete="off"
                    disabled={isInputDisabled}
                />
                 <button type="submit" className={styles.sendButton} disabled={isInputDisabled}>Send</button>
            </form>
        </div>
    );
}