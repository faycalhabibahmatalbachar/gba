'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  errorId?: string;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  errorId,
  autoComplete = 'current-password',
  disabled,
  placeholder = '••••••••',
}: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false);
  const describedBy = error && errorId ? errorId : undefined;
  const invalid = Boolean(error);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn('h-11 min-h-11 pr-12', invalid && 'border-destructive')}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </Button>
      </div>
      {error && errorId ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
