'use client';

import * as React from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { MessagesProvider, useMessagesContext } from './MessagesContext';
import { ConversationsList } from './ConversationsList';
import { MessageThread } from './MessageThread';
import { ContactDetailPanel } from './ContactDetailPanel';

function MobileChrome({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}

function HubInner() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const {
    mobilePanel,
    setMobilePanel,
    selectedConversationId,
    showConversationList,
    setShowConversationList,
    showContactPanel,
    setShowContactPanel,
  } = useMessagesContext();
  const [adminUserId, setAdminUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setAdminUserId(data.user?.id ?? null));
  }, []);

  if (isMobile) {
    return (
      <MobileChrome>
        {mobilePanel === 'list' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ConversationsList />
          </div>
        )}
        {mobilePanel === 'thread' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-10 shrink-0 items-center border-b border-border px-2">
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setMobilePanel('list')}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setMobilePanel('detail')} disabled={!selectedConversationId}>
                Détails
              </Button>
            </div>
            <MessageThread adminUserId={adminUserId} />
          </div>
        )}
        {mobilePanel === 'detail' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-10 shrink-0 items-center border-b border-border px-2">
              <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setMobilePanel('thread')}>
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
            </div>
            <ContactDetailPanel />
          </div>
        )}
      </MobileChrome>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] w-full flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-muted/20 px-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowConversationList(!showConversationList)}
        >
          {showConversationList ? 'Masquer liste' : 'Afficher liste'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowContactPanel(!showContactPanel)}
        >
          {showContactPanel ? 'Masquer fiche' : 'Afficher fiche'}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showConversationList ? (
          <ConversationsList />
        ) : (
          <button
            type="button"
            className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-background py-3 text-muted-foreground hover:bg-muted/50"
            onClick={() => setShowConversationList(true)}
            title="Afficher la liste des conversations"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <MessageThread adminUserId={adminUserId} />
        {showContactPanel ? (
          <ContactDetailPanel />
        ) : (
          <button
            type="button"
            className="flex w-10 shrink-0 flex-col items-center border-l border-border bg-background py-3 text-muted-foreground hover:bg-muted/50"
            onClick={() => setShowContactPanel(true)}
            title="Afficher la fiche contact"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function MessagesHubPage() {
  return (
    <MessagesProvider>
      <HubInner />
    </MessagesProvider>
  );
}
