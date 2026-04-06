'use client';

import * as React from 'react';
import type { ChatMessage, MessagesPanel } from './types';

export type { MessagesPanel };

type MessagesContextValue = {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  replyTo: ChatMessage | null;
  setReplyTo: (msg: ChatMessage | null) => void;
  mobilePanel: MessagesPanel;
  setMobilePanel: (p: MessagesPanel) => void;
};

const MessagesContext = React.createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [mobilePanel, setMobilePanel] = React.useState<MessagesPanel>('list');

  const setSel = React.useCallback((id: string | null) => {
    setSelectedConversationId(id);
    if (id) setMobilePanel('thread');
  }, []);

  const value = React.useMemo(
    () => ({
      selectedConversationId,
      setSelectedConversationId: setSel,
      replyTo,
      setReplyTo,
      mobilePanel,
      setMobilePanel,
    }),
    [selectedConversationId, setSel, replyTo, mobilePanel],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessagesContext(): MessagesContextValue {
  const ctx = React.useContext(MessagesContext);
  if (!ctx) throw new Error('useMessagesContext inside MessagesProvider');
  return ctx;
}
