'use client';

import { useChatStore } from '../app/store/chatStore';
import Chat from '../app/components/Chat';
import Login from '../app/components/Login';
import HistoryPanel from '../app/components/HistoryPanel';
import ChatInput from '../app/components/ChatInput';
import ScenarioChat from '../app/components/ScenarioChat'; 
import styles from './page.module.css';

export default function HomePage() {
  const { user, scenarioPanel, activePanel, setActivePanel } = useChatStore(); 

  return (
    <main className={styles.main}>
      {user ? (
        <div className={styles.chatLayout}>
          <HistoryPanel />
          <div className={styles.contentAndInputWrapper}>
            <div className={styles.panelsWrapper}>
              <div 
                className={`${styles.mainContent} ${activePanel !== 'main' && scenarioPanel.isOpen ? styles.inactivePanel : ''}`} 
                onClick={() => setActivePanel('main')}
              >
                <Chat />
              </div>
              {scenarioPanel.isOpen && (
                <div 
                  className={`${styles.scenarioContent} ${activePanel !== 'scenario' ? styles.inactivePanel : ''}`} 
                  onClick={() => setActivePanel('scenario')}
                >
                  <ScenarioChat />
                </div>
              )}
            </div>
            <ChatInput />
          </div>
        </div>
      ) : (
        <Login />
      )}
    </main>
  );
}