'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, History, ImageIcon, LayoutTemplate, RadioTower } from 'lucide-react';
import { NotifComposerTab } from './NotifComposerTab';
import { NotifTemplatesTab } from './NotifTemplatesTab';
import { NotifHistoryTab } from './NotifHistoryTab';
import { NotifTokensTab } from './NotifTokensTab';
import { NotifMediaTab } from './NotifMediaTab';
import type { PushDraft } from './notif-types';

const TAB_IDS = new Set(['composer', 'templates', 'history', 'tokens', 'media']);

export function NotificationsHubPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState('composer');
  const [composerDraft, setComposerDraft] = React.useState<PushDraft | null>(null);

  React.useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_IDS.has(t)) setTab(t);
  }, [searchParams]);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Hub notifications"
        subtitle="Push FCM, templates, segments, médias et planifications — données via API admin (service role)."
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line" className="flex h-auto w-full flex-wrap justify-start gap-1 md:h-9 md:flex-nowrap">
          <TabsTrigger value="composer" className="gap-1.5">
            <RadioTower className="size-3.5" /> Composer
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate className="size-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="size-3.5" /> Historique
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-1.5">
            <Bell className="size-3.5" /> Tokens
          </TabsTrigger>
          <TabsTrigger value="media" className="gap-1.5">
            <ImageIcon className="size-3.5" /> Médias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="composer" className="mt-0">
          <NotifComposerTab
            draftFromTemplate={composerDraft}
            onConsumeDraft={() => setComposerDraft(null)}
          />
        </TabsContent>
        <TabsContent value="templates" className="mt-0">
          <NotifTemplatesTab
            onApplyTemplate={(d) => {
              setComposerDraft(d);
              setTab('composer');
            }}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <NotifHistoryTab />
        </TabsContent>
        <TabsContent value="tokens" className="mt-0">
          <NotifTokensTab />
        </TabsContent>
        <TabsContent value="media" className="mt-0">
          <NotifMediaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
