'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Spin } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  _pending?: boolean;
  deleted_at?: string | null;
};

type Props = {
  msgs: MessageRow[];
  loading: boolean;
  isImageUrl: (t?: string | null) => boolean;
  fmtTime: (ts?: string | null) => string;
  ChatBubble: React.ComponentType<{ m: MessageRow; wide?: boolean }>;
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
  wide?: boolean;
};

const MSG_PAGE_SIZE = 50;

function formatDateHeader(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

export function groupMessagesByDate(msgs: MessageRow[]): { date: string; messages: MessageRow[] }[] {
  const groups: { date: string; messages: MessageRow[] }[] = [];
  let currentDate = '';
  let currentGroup: MessageRow[] = [];

  for (const m of msgs) {
    const dateKey = new Date(m.created_at).toDateString();
    if (dateKey !== currentDate) {
      if (currentGroup.length) {
        groups.push({ date: currentDate, messages: currentGroup });
      }
      currentDate = dateKey;
      currentGroup = [m];
    } else {
      currentGroup.push(m);
    }
  }
  if (currentGroup.length) {
    groups.push({ date: currentDate, messages: currentGroup });
  }
  return groups;
}

export default function ConversationThread({
  msgs,
  loading,
  isImageUrl,
  fmtTime,
  ChatBubble,
  onLoadMore,
  hasMore,
  loadingMore,
  endRef,
  wide = false,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const prevScrollHeightRef = useRef(0);
  const isUserScrolledUpRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    const threshold = 120;
    setShowJumpToLatest(scrollHeight - scrollTop - clientHeight > threshold);

    if (scrollTop < 200 && hasMore && !loadingMore) {
      isUserScrolledUpRef.current = true;
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || loading || !msgs.length) return;

    requestAnimationFrame(() => {
      if (!isUserScrolledUpRef.current) {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        const newHeight = el.scrollHeight;
        const diff = newHeight - prevScrollHeightRef.current;
        if (diff > 0) {
          el.scrollTop += diff;
        }
        prevScrollHeightRef.current = newHeight;
      }
    });
  }, [msgs.length, loading]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) prevScrollHeightRef.current = el.scrollHeight;
  }, [msgs]);

  const scrollToBottom = useCallback(() => {
    isUserScrolledUpRef.current = false;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowJumpToLatest(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const el = scrollRef.current;
    if (el) prevScrollHeightRef.current = el.scrollHeight;
    await onLoadMore();
  }, [hasMore, loadingMore, onLoadMore]);

  const groups = groupMessagesByDate(msgs);

  if (loading) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center">
        <Spin description="Chargement des messages..." />
      </div>
    );
  }

  if (!msgs.length) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center text-gray-500">
        Aucun message
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col min-h-0">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 min-h-0"
        style={{
          background: 'var(--msg-thread-bg, #efeae2)',
        }}
      >
        {hasMore && (
          <div className="flex justify-center py-3">
            <Button
              type="link"
              size="small"
              icon={<ArrowUpOutlined />}
              loading={loadingMore}
              onClick={loadMore}
            >
              Charger les messages précédents
            </Button>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.date} className="mb-4">
            <div
              className="sticky top-0 z-10 flex justify-center py-2"
              style={{ background: 'transparent' }}
            >
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: 'var(--msg-date-bg, rgba(0,0,0,0.08))',
                  color: 'var(--msg-date-fg, #64748b)',
                }}
              >
                {formatDateHeader(g.messages[0]?.created_at || '')}
              </span>
            </div>
            <div className="space-y-2">
              {g.messages.map((m, idx) => (
                <ChatBubble key={m.id ? `${m.id}-${idx}` : `msg-${idx}`} m={m} wide={wide} />
              ))}
            </div>
          </div>
        ))}

        <div ref={endRef} />
      </div>

      {showJumpToLatest && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
          <Button
            type="primary"
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={scrollToBottom}
            className="shadow-lg"
          >
            Nouveaux messages
          </Button>
        </div>
      )}
    </div>
  );
}
