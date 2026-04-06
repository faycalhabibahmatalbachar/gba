'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export function BroadcastDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = React.useState('Annonce');
  const [body, setBody] = React.useState('');
  const [role, setRole] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [validOnly, setValidOnly] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);

  const send = async () => {
    if (!body.trim()) {
      toast.error('Corps requis');
      return;
    }
    setSending(true);
    setProgress(10);
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          filters: {
            role: role || undefined,
            country: country || undefined,
            valid_tokens_only: validOnly,
          },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Échec');
      setProgress(100);
      toast.success(`Broadcast : ${j.created ?? 0} messages sur ${j.total ?? 0} profils`);
      onOpenChange(false);
      setBody('');
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[80vw] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau message broadcast</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 max-w-[140px] text-xs" placeholder="Rôle (optionnel)" value={role} onChange={(e) => setRole(e.target.value)} />
            <Input className="h-8 max-w-[140px] text-xs" placeholder="Pays" value={country} onChange={(e) => setCountry(e.target.value)} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={validOnly} onChange={(e) => setValidOnly(e.target.checked)} />
              Tokens valides seulement
            </label>
          </div>
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="mt-1 resize-none" />
          </div>
          {progress !== null ? <Progress value={progress} className="h-2" /> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Fermer
          </Button>
          <Button onClick={() => void send()} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
