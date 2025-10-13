'use client';

import { useEffect } from 'react';
import { useChatStore } from '../store';

export default function ThemeApplier({ children }) {
  const theme = useChatStore((state) => state.theme);
  const fontSize = useChatStore((state) => state.fontSize);
  const fontSizeDefault = useChatStore((state) => state.fontSizeDefault);
  const fontSizeSmall = useChatStore((state) => state.fontSizeSmall);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);
  
  useEffect(() => {
    document.body.classList.remove('font-small');
    if (fontSize === 'small') {
      document.body.classList.add('font-small');
    }
  }, [fontSize]);

  useEffect(() => {
    document.body.style.setProperty('--font-size-default', fontSizeDefault);
    document.body.style.setProperty('--font-size-small', fontSizeSmall);
  }, [fontSizeDefault, fontSizeSmall]);

  return <>{children}</>;
}