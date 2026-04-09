'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatApiError } from '@/lib/format-api-error';

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function BroadcastInAppDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = React.useState(1);
  const [target, setTarget] = React.useState<'specific' | 'segment' | 'all'>('all');
  const [userIds, setUserIds] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [body, setBody] = React.useState('');
  const [sendPush, setSendPush] = React.useState(false);
  const [pushTitle, setPushTitle] = React.useState('');
  const [pushBody, setPushBody] = React.useState('');

  const mut = useMutation({
    mutationFn: async () => {
      const parsedIds = userIds.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
      if (target === 'specific') {
        if (parsedIds.length === 0) throw new Error('Saisissez au moins un UUID utilisateur');
        const invalid = parsedIds.filter((id) => !UUID_RE.test(id));
        if (invalid.length) {
          throw new Error(
            `UUID invalides : ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '…' : ''}`,
          );
        }
      }
      const r = await fetch('/api/messages/broadcast-inapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target,
          user_ids: target === 'specific' ? parsedIds : [],
          filters: { country: country || undefined },
          message: { body, message_type: 'text', attachments: [] },
          send_push: sendPush,
          push_title: pushTitle || undefined,
          push_body: pushBody || undefined,
        }),
      });
      const x = (await r.json().catch(() => ({}))) as unknown;
      if (!r.ok) throw new Error(formatApiError(x, 'Échec broadcast'));
      return x as { sent_count: number };
    },
    onSuccess: (x) => {
      toast.success(`Message envoyé à ${x.sent_count} utilisateurs`);
      onOpenChange(false);
      setStep(1);
      setBody('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Broadcast In-App</DialogTitle></DialogHeader>
        {step === 1 ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant={target === 'specific' ? 'default' : 'outline'} onClick={() => setTarget('specific')}>Utilisateurs spécifiques</Button>
              <Button variant={target === 'segment' ? 'default' : 'outline'} onClick={() => setTarget('segment')}>Par segment</Button>
              <Button variant={target === 'all' ? 'default' : 'outline'} onClick={() => setTarget('all')}>Tous les clients</Button>
            </div>
            {target === 'specific' ? <Input value={userIds} onChange={(e) => setUserIds(e.target.value)} placeholder="UUID1,UUID2,..." /> : null}
            {target === 'segment' ? <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="Filtre pays ex: TD" /> : null}
            <div className="flex justify-end"><Button onClick={() => setStep(2)}>Suivant</Button></div>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="space-y-3">
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Rédigez votre message..." maxLength={500} />
            <p className="text-xs text-muted-foreground">{body.length}/500</p>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} />
              <span className="text-sm">Envoyer push en même temps</span>
            </div>
            {sendPush ? (
              <div className="grid gap-2">
                <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="Titre push" />
                <Input value={pushBody} onChange={(e) => setPushBody(e.target.value)} placeholder="Corps push" />
              </div>
            ) : null}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Précédent</Button>
              <Button onClick={() => setStep(3)} disabled={!body.trim()}>Suivant</Button>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p><b>Ciblage:</b> {target}</p>
              <p><b>Aperçu:</b> {body.slice(0, 180)}</p>
              {sendPush ? <p><b>Push:</b> {pushTitle}</p> : null}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Précédent</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Envoyer le broadcast</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
