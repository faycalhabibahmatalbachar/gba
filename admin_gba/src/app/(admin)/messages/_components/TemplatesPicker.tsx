'use client';

import * as React from 'react';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Template = { id: string; name: string; body: string; shortcut?: string | null };

export function TemplatesPicker({ onSelect }: { onSelect: (t: Template) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [list, setList] = React.useState<Template[]>([]);

  React.useEffect(() => {
    if (!open) return;
    void fetch('/api/messages/templates')
      .then((r) => r.json())
      .then((j: { templates?: Template[] }) => setList(j.templates || []))
      .catch(() => setList([]));
  }, [open]);

  const filtered = list.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()) || t.body.toLowerCase().includes(q.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" title="Templates">
            <Zap className="h-4 w-4" />
          </Button>
        }
      />
      <PopoverContent className="w-80 p-2" align="start">
        <Input className="mb-2 h-8 text-xs" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full rounded border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-muted/50"
              onClick={() => {
                onSelect(t);
                setOpen(false);
              }}
            >
              <span className="font-medium">{t.name}</span>
              <p className="line-clamp-2 text-muted-foreground">{t.body}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
