'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bike, Car, Check, ChevronLeft, ChevronRight, KeyRound, Loader2, Truck } from 'lucide-react';

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
import { cn } from '@/lib/utils';

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

const VEHICLE_OPTIONS = [
  { value: 'Moto', label: 'Moto', Icon: Bike },
  { value: 'Van', label: 'Van', Icon: Truck },
  { value: 'Voiture', label: 'Voiture', Icon: Car },
  { value: 'Vélo', label: 'Vélo', Icon: Bike },
] as const;

export function DriverUpsertDialog({ open, onOpenChange, mode, initial }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = React.useState(0);

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [vehicleType, setVehicleType] = React.useState('');
  const [vehiclePlate, setVehiclePlate] = React.useState('');
  const [vehicleColor, setVehicleColor] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [invitePassword, setInvitePassword] = React.useState('');
  const [invitePassword2, setInvitePassword2] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setName(initial.name || '');
      setPhone(initial.phone || '');
      setVehicleType(initial.vehicle_type || '');
      setVehiclePlate(initial.vehicle_plate || '');
      setVehicleColor(initial.vehicle_color || '');
    } else if (mode === 'create') {
      setStep(0);
      setName('');
      setPhone('');
      setVehicleType('');
      setVehiclePlate('');
      setVehicleColor('');
      setInviteEmail('');
      setInvitePassword('');
      setInvitePassword2('');
    }
  }, [open, mode, initial]);

  const pwdOk =
    invitePassword.length >= 8 && /[A-Z]/.test(invitePassword) && /[0-9]/.test(invitePassword);
  const canNext0 = name.trim().length > 0 && phone.trim().length > 0;
  const canNext1 = vehicleType.trim().length > 0 && vehiclePlate.trim().length > 0;
  const canNext2 =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim()) && pwdOk && invitePassword === invitePassword2;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (mode === 'edit' && !initial?.id) throw new Error('Livreur introuvable');
      if (!name.trim()) throw new Error('Nom obligatoire');
      if (mode === 'create') {
        if (!phone.trim()) throw new Error('Téléphone obligatoire');
        if (!vehicleType.trim() || !vehiclePlate.trim()) throw new Error('Véhicule et plaque obligatoires');
        if (!canNext2) throw new Error('Vérifiez l’e-mail et le mot de passe');
      }
      const body: Record<string, unknown> = {
        user_id: null,
        name: name.trim(),
        phone: phone.trim() || null,
        vehicle_type: vehicleType.trim() || null,
        vehicle_plate: vehiclePlate.trim() || null,
        vehicle_color: vehicleColor.trim() || null,
      };
      if (mode === 'create') {
        body.invite_email = inviteEmail.trim().toLowerCase();
        body.invite_password = invitePassword;
        const r = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) {
          const err = j.error;
          const msg =
            typeof err === 'string'
              ? err
              : err && typeof err === 'object'
                ? JSON.stringify(err)
                : 'Échec création';
          throw new Error(msg);
        }
        return j;
      }
      const editId = initial?.id;
      if (!editId) throw new Error('Livreur introuvable');
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
      if (!r.ok) {
        const err = j.error;
        const msg = typeof err === 'string' ? err : err && typeof err === 'object' ? JSON.stringify(err) : 'Échec';
        throw new Error(msg);
      }
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

  const createStepCount = 4;
  const stepLabels = ['Identité', 'Véhicule', 'Accès app', 'Confirmation'];

  function goNext() {
    if (mode !== 'create') return;
    if (step === 0 && !canNext0) {
      toast.error('Nom et téléphone sont requis');
      return;
    }
    if (step === 1 && !canNext1) {
      toast.error('Type de véhicule et plaque sont requis');
      return;
    }
    if (step === 2 && !canNext2) {
      toast.error('E-mail valide, mot de passe conforme et identique à la confirmation');
      return;
    }
    setStep((s) => Math.min(s + 1, createStepCount - 1));
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-y-auto border-0 bg-gradient-to-b from-violet-50/80 to-background shadow-2xl sm:max-w-lg">
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500" />
        <DialogHeader className="space-y-1 pt-1">
          <DialogTitle className="text-lg">
            {mode === 'create' ? 'Nouveau livreur' : 'Modifier le livreur'}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {mode === 'create'
              ? 'Création du profil livreur et des identifiants de connexion à l’application mobile livreur.'
              : 'Mettre à jour les informations affichées pour ce livreur.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'create' ? (
          <div className="flex gap-1 py-2">
            {stepLabels.map((label, i) => (
              <div
                key={label}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center',
                  i === step ? 'bg-violet-500/15 text-violet-900 dark:text-violet-200' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
                    i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-violet-600 text-white' : 'bg-muted',
                  )}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="hidden text-[10px] font-medium sm:block">{label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 py-2">
          {mode === 'create' && step === 0 ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="drv-name">Nom complet du livreur *</Label>
                <Input id="drv-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="drv-phone">Numéro de téléphone *</Label>
                <Input id="drv-phone" className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          ) : null}

          {mode === 'create' && step === 1 ? (
            <div className="space-y-3">
              <Label>Type de véhicule *</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VEHICLE_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVehicleType(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-sm font-medium transition-colors',
                      vehicleType === value
                        ? 'border-violet-600 bg-violet-500/10 text-violet-900 dark:text-violet-100'
                        : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    <Icon className="size-8 text-[#6C47FF]" />
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <Label htmlFor="drv-color">Couleur du véhicule</Label>
                <Input id="drv-color" className="mt-1" value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="drv-plate">Numéro de plaque *</Label>
                <Input id="drv-plate" className="mt-1" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
              </div>
            </div>
          ) : null}

          {mode === 'create' && step === 2 ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 text-xs text-muted-foreground">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <p>
                  Ces identifiants sont ceux que le livreur utilisera pour se connecter à l’application mobile livreur.
                </p>
              </div>
              <div>
                <Label htmlFor="drv-email">E-mail (identifiant de connexion) *</Label>
                <Input
                  id="drv-email"
                  type="email"
                  className="mt-1"
                  autoComplete="off"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="drv-pw">Mot de passe *</Label>
                <Input
                  id="drv-pw"
                  type="password"
                  className="mt-1"
                  autoComplete="new-password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                />
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li className={invitePassword.length >= 8 ? 'text-emerald-600' : ''}>Au moins 8 caractères</li>
                  <li className={/[A-Z]/.test(invitePassword) ? 'text-emerald-600' : ''}>Au moins une majuscule</li>
                  <li className={/[0-9]/.test(invitePassword) ? 'text-emerald-600' : ''}>Au moins un chiffre</li>
                </ul>
              </div>
              <div>
                <Label htmlFor="drv-pw2">Confirmation du mot de passe *</Label>
                <Input
                  id="drv-pw2"
                  type="password"
                  className="mt-1"
                  autoComplete="new-password"
                  value={invitePassword2}
                  onChange={(e) => setInvitePassword2(e.target.value)}
                />
                {invitePassword2 && invitePassword !== invitePassword2 ? (
                  <p className="mt-1 text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {mode === 'create' && step === 3 ? (
            <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
              <p className="font-semibold text-foreground">Récapitulatif</p>
              <dl className="grid gap-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Nom</dt>
                  <dd className="text-right font-medium">{name.trim() || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Téléphone</dt>
                  <dd className="text-right font-medium">{phone.trim() || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Véhicule</dt>
                  <dd className="text-right font-medium">
                    {[vehicleType, vehicleColor, vehiclePlate].filter(Boolean).join(' · ') || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Connexion app</dt>
                  <dd className="text-right font-medium">{inviteEmail.trim() || '—'}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {mode === 'edit' ? (
            <div className="space-y-3">
              <div>
                <Label>Nom affiché *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>Type véhicule</Label>
                <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Moto, Van…" />
              </div>
              <div>
                <Label>Plaque</Label>
                <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
              </div>
              <div>
                <Label>Couleur</Label>
                <Input value={vehicleColor} onChange={(e) => setVehicleColor(e.target.value)} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {mode === 'create' && step > 0 ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={goBack}>
              <ChevronLeft className="mr-1 size-4" />
              Retour
            </Button>
          ) : (
            <span className="hidden sm:block sm:flex-1" />
          )}
          <div className="flex w-full flex-1 justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            {mode === 'create' && step < createStepCount - 1 ? (
              <Button type="button" onClick={goNext}>
                Suivant
                <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === 'create' ? 'Créer le livreur' : 'Enregistrer'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
