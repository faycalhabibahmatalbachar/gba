'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
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
    showContactPanel,
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
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-in-out',
            showConversationList ? 'w-[300px]' : 'w-0',
          )}
          aria-hidden={!showConversationList}
        >
          {showConversationList ? <ConversationsList /> : null}
        </aside>

        <MessageThread adminUserId={adminUserId} />

        <aside
          className={cn(
            'flex shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-[width] duration-200 ease-in-out',
            showContactPanel ? 'w-[320px]' : 'w-0',
          )}
          aria-hidden={!showContactPanel}
        >
          {showContactPanel ? <ContactDetailPanel /> : null}
        </aside>
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
