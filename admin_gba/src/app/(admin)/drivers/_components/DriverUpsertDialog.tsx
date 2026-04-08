'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Loader2, Sparkles, UserPlus } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DriverRowLite = {
  id: string;
  user_id: string | null;
  name: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: 'create' | 'edit';
  initial?: DriverRowLite | null;
};

async function searchProfiles(q: string) {
  const r = await fetch(`/api/users?q=${encodeURIComponent(q)}&role=all`, { credentials: 'include' });
  const j = (await r.json()) as { data?: { id: string; email?: string; first_name?: string; last_name?: string }[] };
  if (!r.ok) throw new Error('Recherche impossible');
  return j.data || [];
}

export function DriverUpsertDialog({ open, onOpenChange, mode, initial }: Props) {
  const qc = useQueryClient();
  const [userQuery, setUserQuery] = React.useState('');
  const [userId, setUserId] = React.useState<string>('');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [vehicleType, setVehicleType] = React.useState('');
  const [vehiclePlate, setVehiclePlate] = React.useState('');
  const [vehicleColor, setVehicleColor] = React.useState('');
  const [createWithAccount, setCreateWithAccount] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [invitePassword, setInvitePassword] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setUserId(initial.user_id || '');
      setName(initial.name || '');
      setPhone(initial.phone || '');
      setVehicleType(initial.vehicle_type || '');
      setVehiclePlate(initial.vehicle_plate || '');
      setVehicleColor(initial.vehicle_color || '');
    } else if (mode === 'create') {
      setUserId('');
      setName('');
      setPhone('');
      setVehicleType('');
      setVehiclePlate('');
      setVehicleColor('');
      setCreateWithAccount(false);
      setInviteEmail('');
      setInvitePassword('');
    }
    setUserQuery('');
  }, [open, mode, initial]);

  const searchQ = useQuery({
    queryKey: ['driver-user-search', userQuery],
    queryFn: () => searchProfiles(userQuery),
    enabled: open && mode === 'create' && userQuery.trim().length >= 2,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (mode === 'edit' && !initial?.id) throw new Error('Livreur introuvable');
      if (!name.trim()) throw new Error('Nom obligatoire');
      const body: Record<string, unknown> = {
        user_id: userId.trim() || null,
        name: name.trim(),
        phone: phone.trim() || null,
        vehicle_type: vehicleType.trim() || null,
        vehicle_plate: vehiclePlate.trim() || null,
        vehicle_color: vehicleColor.trim() || null,
      };
      if (mode === 'create' && createWithAccount) {
        if (!inviteEmail.trim() || invitePassword.length < 8) {
          throw new Error('E-mail et mot de passe (8+ caractères) requis pour le compte livreur');
        }
        body.user_id = null;
        body.invite_email = inviteEmail.trim().toLowerCase();
        body.invite_password = invitePassword;
      }
      if (mode === 'create') {
        const r = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Échec création');
        return j;
      }
      const editId = initial?.id;
      if (!editId) throw new Error('ID livreur manquant');
      const r = await fetch(`/api/drivers/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: body.name,
          phone: body.phone,
          vehicle_type: body.vehicle_type,
          vehicle_plate: body.vehicle_plate,
          vehicle_color: body.vehicle_color,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec mise à jour');
      return j;
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Livreur créé' : 'Livreur mis à jour');
      onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ['drivers'] });
      void qc.invalidateQueries({ queryKey: ['driver-detail'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-y-auto border-0 bg-gradient-to-b from-violet-50/80 to-background shadow-2xl sm:max-w-lg">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500" />
        <DialogHeader className="space-y-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg">
              {mode === 'create' ? 'Nouveau livreur' : 'Modifier le livreur'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs leading-relaxed">
            Fiche <code className="rounded bg-muted px-1">public.drivers</code> — connexion app livreur via compte lié ou
            identifiants créés ici.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {mode === 'create' ? (
            <div className="space-y-3 rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-semibold">Compte pour l’app livreur</Label>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    createWithAccount
                      ? 'bg-violet-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  onClick={() => {
                    setCreateWithAccount((prev) => {
                      const next = !prev;
                      if (next) {
                        setUserId('');
                        setUserQuery('');
                      } else {
                        setInviteEmail('');
                        setInvitePassword('');
                      }
                      return next;
                    });
                  }}
                >
                  {createWithAccount ? 'E-mail + mot de passe' : 'Lier existant'}
                </button>
              </div>
              {createWithAccount ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" />
                    Le livreur se connecte avec cet e-mail et ce mot de passe (app « GBA Livreur »).
                  </div>
                  <div>
                    <Label className="text-xs">E-mail livreur</Label>
                    <Input
                      type="email"
                      className="mt-1"
                      placeholder="livreur@exemple.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Mot de passe (8+ caractères)</Label>
                    <Input
                      type="password"
                      className="mt-1"
                      placeholder="••••••••"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Lier un utilisateur existant (optionnel)</Label>
                  <Input
                    placeholder="Rechercher e-mail / nom (2+)…"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                  />
                  {searchQ.data && searchQ.data.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto rounded-md border text-xs">
                      {searchQ.data.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="block w-full px-2 py-1.5 text-left hover:bg-muted"
                          onClick={() => {
                            setUserId(p.id);
                            setUserQuery(p.email || p.id);
                            if (!name.trim()) {
                              const nm = [p.first_name, p.last_name].filter(Boolean).join(' ');
                              if (nm) setName(nm);
                            }
                          }}
                        >
                          {p.email} — {[p.first_name, p.last_name].filter(Boolean).join(' ')}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <Input
                    placeholder="Ou coller UUID profil"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          ) : null}
          <div>
            <Label>Nom affiché / flotte *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Type véhicule</Label>
              <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Moto, Van…" />
            </div>
            <div>
              <Label>Plaque</Label>
              <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Couleur</Label>
            <Input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
