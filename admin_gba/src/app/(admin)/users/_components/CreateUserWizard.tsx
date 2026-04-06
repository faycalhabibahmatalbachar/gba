'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
};

const SECTIONS = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'orders', label: 'Commandes' },
  { id: 'products', label: 'Produits' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'drivers', label: 'Livreurs' },
  { id: 'deliveries', label: 'Livraisons' },
  { id: 'messages', label: 'Messages' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Sécurité' },
  { id: 'audit', label: 'Audit' },
  { id: 'reports', label: 'Rapports' },
  { id: 'analytics', label: 'Analytics' },
] as const;

const ACTIONS = ['view', 'edit', 'export'] as const;

function defaultPerms(): Record<string, Record<string, boolean>> {
  const o: Record<string, Record<string, boolean>> = {};
  for (const s of SECTIONS) {
    o[s.id] = { view: true, edit: false, export: false };
  }
  return o;
}

export function CreateUserWizard({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState('client');
  const [email, setEmail] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [city, setCity] = React.useState('');
  const [country, setCountry] = React.useState('Tchad');
  const [password, setPassword] = React.useState('');
  const [sendInvite, setSendInvite] = React.useState(true);
  const [vehicleType, setVehicleType] = React.useState('moto');
  const [vehiclePlate, setVehiclePlate] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [perms, setPerms] = React.useState<Record<string, Record<string, boolean>>>(() => defaultPerms());

  const isAdminLike = role === 'admin' || role === 'superadmin';
  const isDriver = role === 'driver';

  const steps = React.useMemo(() => {
    const base = ['Profil & rôle', 'Contact & accès', 'Spécifique', 'Récapitulatif'];
    return base;
  }, []);

  const lastStepIndex = 3;

  React.useEffect(() => {
    if (!open) {
      setStep(0);
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setCity('');
      setPassword('');
      setSendInvite(true);
      setVehiclePlate('');
      setRole('client');
      setPerms(defaultPerms());
    }
  }, [open]);

  React.useEffect(() => {
    setStep(0);
  }, [role]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        phone,
        city,
        country,
        password: password || undefined,
        send_invite: sendInvite && !password,
        vehicle_type: vehicleType,
        vehicle_plate: vehiclePlate || undefined,
      };
      if (isAdminLike) {
        payload.admin_permissions = perms;
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(j.error || 'Échec création');
        return;
      }
      toast.success('Compte créé');
      onSuccess();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  function togglePerm(section: string, action: string, v: boolean) {
    setPerms((p) => ({
      ...p,
      [section]: { ...(p[section] || {}), [action]: v },
    }));
  }

  const canNext =
    (step === 0 && firstName.trim()) ||
    (step === 1 && email.trim()) ||
    (step === 2 && (isDriver ? true : isAdminLike ? true : true));

  function stepBody() {
    if (step === 0) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="driver">Livreur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="superadmin">Super administrateur</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Superadmin / admin : création réservée aux super-administrateurs côté API.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />
            </div>
          </div>
        </div>
      );
    }
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pays</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe (optionnel)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vide = invitation" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={sendInvite} onCheckedChange={setSendInvite} id="inv" />
            <Label htmlFor="inv">Envoyer invitation email</Label>
          </div>
        </div>
      );
    }
    if (step === 2) {
      if (isDriver) {
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type véhicule</Label>
              <Select value={vehicleType} onValueChange={(v) => v && setVehicleType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="voiture">Voiture</SelectItem>
                  <SelectItem value="vélo">Vélo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plaque</Label>
              <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
            </div>
          </div>
        );
      }
      if (isAdminLike) {
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Matrice stockée dans <span className="font-mono">settings.admin_permissions_&lt;user_id&gt;</span>. Le respect
              effectif dépend du garde-fou route (à durcir progressivement).
            </p>
            {role === 'superadmin' ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Superadmin : accès complet par défaut côté produit ; la grille sert de documentation / future policy.
              </p>
            ) : null}
            <div className="max-h-[min(52vh,420px)] overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b text-left">
                    <th className="p-2">Module</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="p-2 capitalize">
                        {a}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="p-2 font-medium">{s.label}</td>
                      {ACTIONS.map((a) => (
                        <td key={a} className="p-2">
                          <Switch
                            checked={Boolean(perms[s.id]?.[a])}
                            onCheckedChange={(c) => togglePerm(s.id, a, c)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      return (
        <p className="text-sm text-muted-foreground">
          Aucune étape supplémentaire pour le rôle client. Passez au récapitulatif.
        </p>
      );
    }
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-2">
        <p>
          <span className="text-muted-foreground">Identité :</span> {firstName} {lastName}
        </p>
        <p>
          <span className="text-muted-foreground">Email :</span> {email}
        </p>
        <p>
          <span className="text-muted-foreground">Rôle :</span> {role}
        </p>
        {isDriver ? (
          <p>
            <span className="text-muted-foreground">Véhicule :</span> {vehicleType} {vehiclePlate ? `· ${vehiclePlate}` : ''}
          </p>
        ) : null}
        {isAdminLike ? (
          <p className="text-xs text-muted-foreground">
            Permissions : {Object.keys(perms).filter((k) => perms[k]?.edit || perms[k]?.export).length} module(s) avec droits
            étendus (hors vue seule).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-[880px] sm:w-[min(880px,100%)]">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>Créer un utilisateur</SheetTitle>
          <SheetDescription>Assistant multi-étapes — client, livreur, admin ou superadmin avec droits avancés.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                i === step ? 'border-primary bg-primary/10 font-semibold' : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">{stepBody()}</div>

        <div className="mt-auto flex gap-2 border-t border-border pt-4">
          {step > 0 ? (
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              Retour
            </Button>
          ) : null}
          {step < lastStepIndex ? (
            <Button type="button" className="flex-1" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Suivant
            </Button>
          ) : (
            <Button type="button" className="flex-1" disabled={saving || !email.trim()} onClick={() => void handleCreate()}>
              {saving ? 'Création…' : 'Créer le compte'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
