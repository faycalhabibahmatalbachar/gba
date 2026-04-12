'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

type Attachment = { url: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  to: string;
  setTo: (v: string) => void;
  subject: string;
  setSubject: (v: string) => void;
  bodyHtml: string;
  setBodyHtml: (v: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (index: number) => void;
  onPickFile: (file: File) => void;
  onSend: () => void;
  sendPending: boolean;
  uploadPending: boolean;
};

export function EmailLogsComposeSheet({
  open,
  onOpenChange,
  to,
  setTo,
  subject,
  setSubject,
  bodyHtml,
  setBodyHtml,
  attachments,
  onRemoveAttachment,
  onPickFile,
  onSend,
  sendPending,
  uploadPending,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-4 py-4 text-left shrink-0">
          <SheetTitle>Nouvel envoi</SheetTitle>
          <SheetDescription>Destinataires, sujet et corps HTML. Pièces jointes via stockage sécurisé.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="elog-compose-to">Destinataires</Label>
            <Input
              id="elog-compose-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="a@x.com, b@y.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="elog-compose-subj">Sujet</Label>
            <Input id="elog-compose-subj" value={subject} onChange={(e) => setSubject(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="elog-compose-body">Corps HTML</Label>
            <Textarea id="elog-compose-body" rows={10} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="elog-compose-file">Pièces jointes (JPG / PNG / PDF)</Label>
            <Input
              id="elog-compose-file"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              disabled={uploadPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={`${a.url}-${i}`} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-1 text-xs">
                  {a.name}
                  <button
                    type="button"
                    className="rounded-full hover:bg-muted px-1 leading-none"
                    onClick={() => onRemoveAttachment(i)}
                    aria-label={`Retirer ${a.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t px-4 py-3 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={onSend} disabled={!to.trim() || !subject.trim() || sendPending}>
            {sendPending ? 'Envoi…' : 'Envoyer'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
