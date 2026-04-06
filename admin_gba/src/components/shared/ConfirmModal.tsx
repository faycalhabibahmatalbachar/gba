'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmationPhrase?: string;
  confirmationLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmationPhrase,
  confirmationLabel = 'Saisir la confirmation exacte',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'destructive',
  loading,
  onConfirm,
}: ConfirmModalProps) {
  const [input, setInput] = React.useState('');

  React.useEffect(() => {
    if (!open) setInput('');
  }, [open]);

  const ok = !confirmationPhrase || input.trim() === confirmationPhrase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {variant === 'destructive' ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-base leading-snug">{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>
        {confirmationPhrase ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-name" className="text-xs text-muted-foreground">
              {confirmationLabel}{' '}
              <span className="font-mono text-foreground">« {confirmationPhrase} »</span>
            </Label>
            <Input
              id="confirm-name"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              className="font-mono text-sm"
            />
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            disabled={loading || !ok}
            onClick={() => void onConfirm()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
