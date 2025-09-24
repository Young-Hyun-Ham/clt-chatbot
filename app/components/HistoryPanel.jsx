'use client';
import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store';
import { useTranslations } from '../hooks/useTranslations';
import styles from './HistoryPanel.module.css';
import ProfileModal from './ProfileModal';
import SearchModal from './SearchModal';
import DevBoardModal from './DevBoardModal';
import NotificationModal from './NotificationModal';
import ManualModal from './ManualModal';
import ConversationItem from './ConversationItem';
import MenuIcon from './icons/MenuIcon';
import BellIcon from './icons/BellIcon';
import SearchIcon from './icons/SearchIcon';
import EditIcon from './icons/EditIcon';
import ManualIcon from './icons/ManualIcon';

export default function HistoryPanel() {
  const {
    user,
    conversations,
    loadConversation,
    createNewConversation,
    currentConversationId,
    deleteConversation,
    updateConversationTitle,
    isHistoryPanelOpen,
    toggleHistoryPanel,
    isSearchModalOpen,
    openSearchModal,
    isProfileModalOpen,
    openProfileModal,
    isDevBoardModalOpen,
    isNotificationModalOpen,
    openNotificationModal,
    hasUnreadNotifications,
    isManualModalOpen,
    openManualModal,
    // --- 👇 [추가된 부분] ---
    expandedConversationId,
    scenariosForConversation,
    toggleConversationExpansion,
    openScenarioPanel, 
    // --- 👆 [여기까지] ---
  } = useChatStore();
  const { t } = useTranslations();

  if (!user) return null;

  const handleDelete = (e, convoId) => {
    e.stopPropagation();
    if (window.confirm(t('deleteConvoConfirm'))) {
        deleteConversation(convoId);
    }
  };

  return (
    <>
      <div className={`${styles.historyPanel} ${isHistoryPanelOpen ? styles.open : styles.closed}`}>
        <button
            className={`${styles.toggleButton} ${!isHistoryPanelOpen ? styles.floatingToggleButton : ''}`}
            onClick={toggleHistoryPanel}
        >
            <MenuIcon />
        </button>
        <div className={styles.panelContentWrapper}>
            <div className={styles.header}>
                <div className={styles.headerTopRow}>
                    <div className={styles.headerIconGroup}>
                        <button
                            className={`${styles.iconButton} ${hasUnreadNotifications ? styles.unread : ''}`}
                            onClick={openNotificationModal}
                        >
                            <BellIcon />
                        </button>
                        <button className={styles.iconButton} onClick={openSearchModal}>
                            <SearchIcon />
                        </button>
                    </div>
                </div>
                <button className={styles.newChatButton} onClick={createNewConversation}>
                    <EditIcon />
                    <span className={styles.newChatText}>{t('newChat')}</span>
                </button>
            </div>

            <div className={styles.panelContent}>
            <div className={styles.conversationList}>
                {conversations.map((convo) => (
                    // --- 👇 [수정된 부분] ---
                    <ConversationItem
                        key={convo.id}
                        convo={convo}
                        isActive={convo.id === currentConversationId}
                        onClick={loadConversation}
                        onDelete={handleDelete}
                        onUpdateTitle={updateConversationTitle}
                        isExpanded={convo.id === expandedConversationId}
                        scenarios={scenariosForConversation[convo.id]}
                        onToggleExpand={toggleConversationExpansion}
                        onScenarioClick={openScenarioPanel}
                    />
                    // --- 👆 [여기까지] ---
                ))}
            </div>
            <div className={styles.footer}>
                <div className={styles.avatarWrapper} onClick={openProfileModal}>
                    <img
                        src={user.photoURL}
                        alt="User Avatar"
                        className={styles.userAvatar}
                    />
                </div>
                <button className={styles.iconButton} onClick={openManualModal}>
                    <ManualIcon />
                </button>
            </div>
            </div>
        </div>
      </div>

      {isProfileModalOpen && <ProfileModal />}
      {isSearchModalOpen && <SearchModal />}
      {isDevBoardModalOpen && <DevBoardModal />}
      {isNotificationModalOpen && <NotificationModal />}
      {isManualModalOpen && <ManualModal />}
    </>
  );
}