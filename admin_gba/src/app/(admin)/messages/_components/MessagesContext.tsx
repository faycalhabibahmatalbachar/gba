'use client';

import * as React from 'react';
import type { ChatMessage, MessagesPanel } from './types';

export type { MessagesPanel };

const LS_CONV_LIST = 'gba-msg-show-conv-list';
const LS_CONTACT = 'gba-msg-show-contact';

type MessagesContextValue = {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  replyTo: ChatMessage | null;
  setReplyTo: (msg: ChatMessage | null) => void;
  mobilePanel: MessagesPanel;
  setMobilePanel: (p: MessagesPanel) => void;
  showConversationList: boolean;
  setShowConversationList: (v: boolean) => void;
  showContactPanel: boolean;
  setShowContactPanel: (v: boolean) => void;
};

const MessagesContext = React.createContext<MessagesContextValue | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null);
  const [mobilePanel, setMobilePanel] = React.useState<MessagesPanel>('list');
  const [showConversationList, setShowConversationListState] = React.useState(true);
  const [showContactPanel, setShowContactPanelState] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(LS_CONV_LIST) === '0') setShowConversationListState(false);
      if (localStorage.getItem(LS_CONTACT) === '0') setShowContactPanelState(false);
    } catch {
      /* ignore */
    }
  }, []);

  const setShowConversationList = React.useCallback((v: boolean) => {
    setShowConversationListState(v);
    try {
      localStorage.setItem(LS_CONV_LIST, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const setShowContactPanel = React.useCallback((v: boolean) => {
    setShowContactPanelState(v);
    try {
      localStorage.setItem(LS_CONTACT, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

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
      showConversationList,
      setShowConversationList,
      showContactPanel,
      setShowContactPanel,
    }),
    [
      selectedConversationId,
      setSel,
      replyTo,
      mobilePanel,
      showConversationList,
      setShowConversationList,
      showContactPanel,
      setShowContactPanel,
    ],
  );

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

export function useMessagesContext(): MessagesContextValue {
  const ctx = React.useContext(MessagesContext);
  if (!ctx) throw new Error('useMessagesContext inside MessagesProvider');
  return ctx;
}
