'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';

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
      const body = {
        user_id: userId.trim() || null,
        name: name.trim(),
        phone: phone.trim() || null,
        vehicle_type: vehicleType.trim() || null,
        vehicle_plate: vehiclePlate.trim() || null,
        vehicle_color: vehicleColor.trim() || null,
      };
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Nouveau livreur' : 'Modifier le livreur'}</DialogTitle>
          <DialogDescription>
            Fiche dans <code className="text-xs">public.drivers</code>. Compte optionnel (UUID profil) pour lier auth +
            app mobile.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {mode === 'create' ? (
            <div className="space-y-2">
              <Label>Lier un compte utilisateur (optionnel)</Label>
              <Input
                placeholder="Rechercher email / nom (2+ caractères)…"
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
                placeholder="Ou coller UUID utilisateur"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="font-mono text-xs"
              />
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
