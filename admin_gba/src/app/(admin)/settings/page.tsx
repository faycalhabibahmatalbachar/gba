'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Lock, Bell, Moon, Sun, Save, Loader2, Mail } from 'lucide-react';
import { useTheme } from 'next-themes';

type ProfileForm = { first_name: string; last_name: string; phone: string; city: string; email: string; role: string; created_at: string };

const TABS = [
  { id: 'profile', label: 'Profil', icon: User },
  { id: 'security', label: 'Sécurité', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'appearance', label: 'Apparence', icon: Sun },
] as const;
type TabId = typeof TABS[number]['id'];

export default function SettingsPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<TabId>('profile');

  // Profile
  const [profile, setProfile] = useState<Partial<ProfileForm>>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [pwd, setPwd] = useState({ newPwd: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  // Notifications
  const [notif, setNotif] = useState({ new_orders: true, delivery_updates: true, low_stock: true, payment_alerts: true });

  // Email (Resend / préférences serveur)
  const [emailPrefs, setEmailPrefs] = useState({
    notifications_enabled: true,
    admin_email: '',
    cc_emails: '',
    from_name: '',
    notify_new_order: true,
    notify_special_order: true,
    notify_order_status_changed: true,
    notify_new_user: true,
    notify_new_message: true,
    notify_security: true,
    notify_all_audit_events: false,
    email_provider: 'auto',
    dedup_window_sec: 120,
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    const { data } = await supabase.from('profiles').select('first_name,last_name,phone,city,email,role,created_at').eq('id', user.id).maybeSingle();
    setProfile(data || {});
    setProfileLoading(false);
  }, [user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadEmailPrefs = useCallback(async () => {
    setEmailLoading(true);
    try {
      const r = await fetch('/api/settings/email', { credentials: 'include' });
      const j = (await r.json()) as { data?: Record<string, unknown> };
      const d = j.data || {};
      setEmailPrefs({
        notifications_enabled: d.notifications_enabled !== false,
        admin_email: String(d.admin_email || ''),
        cc_emails: String(d.cc_emails || ''),
        from_name: String(d.from_name || ''),
        notify_new_order: d.notify_new_order !== false,
        notify_special_order: d.notify_special_order !== false,
        notify_order_status_changed: d.notify_order_status_changed !== false,
        notify_new_user: d.notify_new_user !== false,
        notify_new_message: d.notify_new_message !== false,
        notify_security: d.notify_security !== false,
        notify_all_audit_events: d.notify_all_audit_events === true,
        email_provider: String(d.email_provider || 'auto'),
        dedup_window_sec: Number(d.dedup_window_sec || 120),
      });
    } catch {
      toast.error('Chargement préférences email impossible');
    } finally {
      setEmailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'email') void loadEmailPrefs();
  }, [tab, loadEmailPrefs]);

  const saveEmailPrefs = async () => {
    setEmailSaving(true);
    try {
      const r = await fetch('/api/settings/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          notifications_enabled: emailPrefs.notifications_enabled,
          admin_email: emailPrefs.admin_email.trim() || null,
          cc_emails: emailPrefs.cc_emails.trim() || null,
          from_name: emailPrefs.from_name.trim() || null,
          notify_new_order: emailPrefs.notify_new_order,
          notify_special_order: emailPrefs.notify_special_order,
          notify_order_status_changed: emailPrefs.notify_order_status_changed,
          notify_new_user: emailPrefs.notify_new_user,
          notify_new_message: emailPrefs.notify_new_message,
          notify_security: emailPrefs.notify_security,
          notify_all_audit_events: emailPrefs.notify_all_audit_events,
          email_provider: emailPrefs.email_provider,
          dedup_window_sec: emailPrefs.dedup_window_sec,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      toast.success('Préférences email enregistrées (clé settings.email_notification_prefs)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setEmailSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setEmailTestLoading(true);
    try {
      const r = await fetch('/api/email/test', { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Échec');
      toast.success(`Test envoyé → ${j.to}${j.messageId ? ` (${j.messageId})` : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setEmailTestLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setProfileSaving(true);
    const { error } = await supabase.from('profiles').update({
      first_name: profile.first_name?.trim() || null,
      last_name: profile.last_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      city: profile.city?.trim() || null,
    }).eq('id', user.id);
    setProfileSaving(false);
    if (error) toast.error(error.message);
    else toast.success('Profil mis à jour');
  };

  const changePassword = async () => {
    if (pwd.newPwd !== pwd.confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (pwd.newPwd.length < 8) { toast.error('Minimum 8 caractères'); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.newPwd });
    setPwdSaving(false);
    if (error) toast.error(error.message);
    else { toast.success('Mot de passe modifié'); setPwd({ newPwd: '', confirm: '' }); }
  };

  const Field = ({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <Input type={type} value={value} onChange={e => onChange?.(e.target.value)} disabled={disabled || profileLoading} className="h-9 text-sm" />
    </div>
  );

  return (
    <div className={`space-y-5 ${tab === 'email' ? 'max-w-3xl' : 'max-w-2xl'}`}>
      <PageHeader title="Paramètres" />

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-border">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <span className="text-xl font-bold text-primary">
                  {(profile.first_name || user?.email || 'A')[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold">{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || user?.email}</p>
                <p className="text-xs text-muted-foreground">{profile.role || 'admin'}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prénom" value={profile.first_name || ''} onChange={v => setProfile(p => ({ ...p, first_name: v }))} />
              <Field label="Nom" value={profile.last_name || ''} onChange={v => setProfile(p => ({ ...p, last_name: v }))} />
              <Field label="Email" value={profile.email || user?.email || ''} disabled />
              <Field label="Téléphone" value={profile.phone || ''} onChange={v => setProfile(p => ({ ...p, phone: v }))} />
              <Field label="Ville" value={profile.city || ''} onChange={v => setProfile(p => ({ ...p, city: v }))} />
            </div>
            <Button onClick={saveProfile} disabled={profileSaving} className="h-9">
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security tab */}
      {tab === 'security' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Changer le mot de passe</p>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nouveau mot de passe</label>
                <Input type="password" value={pwd.newPwd} onChange={e => setPwd(p => ({ ...p, newPwd: e.target.value }))} className="h-9 text-sm" placeholder="Min. 8 caractères" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirmer le mot de passe</label>
                <Input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <Button onClick={changePassword} disabled={pwdSaving || !pwd.newPwd} className="h-9">
              {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Mettre à jour
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Préférences de notifications</p>
            <Separator />
            <div className="space-y-4">
              {([
                { key: 'new_orders', label: 'Nouvelles commandes', desc: 'Recevoir une alerte pour chaque nouvelle commande' },
                { key: 'delivery_updates', label: 'Mises à jour livraisons', desc: 'Alertes sur les changements de statut de livraison' },
                { key: 'low_stock', label: 'Stock faible', desc: 'Alerte quand un produit est en rupture de stock' },
                { key: 'payment_alerts', label: 'Alertes paiements', desc: 'Notifications pour les paiements reçus' },
              ] as const).map(n => (
                <div key={n.key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <button
                    onClick={() => setNotif(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${notif[n.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${notif[n.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email tab */}
      {tab === 'email' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Notifications email (Resend prioritaire, SMTP fallback)</p>
            <p className="text-xs text-muted-foreground">
              Si <code className="rounded bg-muted px-1">RESEND_API_KEY</code> est présent, les envois utilisent Resend
              (comme ton test réussi). Sinon fallback SMTP Brevo avec{' '}
              <code className="rounded bg-muted px-1">SMTP_HOST</code>,{' '}
              <code className="rounded bg-muted px-1">SMTP_PORT</code>,{' '}
              <code className="rounded bg-muted px-1">SMTP_USER</code>,{' '}
              <code className="rounded bg-muted px-1">SMTP_PASS</code> dans .env.local (Brevo:
              <code className="rounded bg-muted px-1 ml-1">smtp-relay.brevo.com</code>). Journal :{' '}
              <code className="rounded bg-muted px-1">email_logs</code>.
            </p>
            <Separator />
            {emailLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Notifications activées</p>
                    <p className="text-xs text-muted-foreground">Désactive les envois non critiques côté intégrations futures</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailPrefs((p) => ({ ...p, notifications_enabled: !p.notifications_enabled }))}
                    className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${emailPrefs.notifications_enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${emailPrefs.notifications_enabled ? 'translate-x-4' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Email admin principal</label>
                    <Input
                      className="h-9 text-sm"
                      value={emailPrefs.admin_email}
                      onChange={(e) => setEmailPrefs((p) => ({ ...p, admin_email: e.target.value }))}
                      placeholder="admin@…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Copie (CC), séparés par virgule</label>
                    <Input
                      className="h-9 text-sm"
                      value={emailPrefs.cc_emails}
                      onChange={(e) => setEmailPrefs((p) => ({ ...p, cc_emails: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Nom expéditeur (affichage UI — l’envoi utilise EMAIL_FROM / EMAIL_FROM_NAME du serveur)
                    </label>
                    <Input
                      className="h-9 text-sm"
                      value={emailPrefs.from_name}
                      onChange={(e) => setEmailPrefs((p) => ({ ...p, from_name: e.target.value }))}
                      placeholder="GBA"
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  {(
                    [
                      { key: 'notify_new_order' as const, label: 'Nouvelle commande', desc: 'À brancher sur les routes orders' },
                      { key: 'notify_special_order' as const, label: 'Commande spéciale', desc: 'Commande prioritaire/spéciale' },
                      { key: 'notify_order_status_changed' as const, label: 'Changement statut commande', desc: 'Assignation et transitions clés' },
                      { key: 'notify_new_user' as const, label: 'Nouveau utilisateur', desc: 'Création/invitation via admin' },
                      { key: 'notify_new_message' as const, label: 'Nouveau message', desc: 'Messages chat entrants' },
                      { key: 'notify_security' as const, label: 'Événements sécurité', desc: 'Alertes sessions / IP (intégration progressive)' },
                      { key: 'notify_all_audit_events' as const, label: 'Toutes actions (audit)', desc: 'Phase 2: flux global audit_logs' },
                    ] as const
                  ).map((n) => (
                    <div key={n.key} className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-muted-foreground">{n.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEmailPrefs((prev) => ({ ...prev, [n.key]: !prev[n.key] }))}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${emailPrefs[n.key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${emailPrefs[n.key] ? 'translate-x-4' : 'translate-x-0.5'}`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Provider email</label>
                    <select
                      value={emailPrefs.email_provider}
                      onChange={(e) => setEmailPrefs((p) => ({ ...p, email_provider: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="auto">Auto (Resend puis SMTP)</option>
                      <option value="smtp">SMTP (Brevo)</option>
                      <option value="resend">Resend</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Fenêtre anti-duplication (sec)</label>
                    <Input
                      className="h-9 text-sm"
                      type="number"
                      min={30}
                      max={86400}
                      value={String(emailPrefs.dedup_window_sec)}
                      onChange={(e) => setEmailPrefs((p) => ({ ...p, dedup_window_sec: Number(e.target.value || 120) }))}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={saveEmailPrefs} disabled={emailSaving} className="h-9">
                    {emailSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Sauvegarder
                  </Button>
                  <Button type="button" variant="outline" onClick={sendTestEmail} disabled={emailTestLoading} className="h-9">
                    {emailTestLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                    Envoyer un test
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appearance tab */}
      {tab === 'appearance' && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Thème de l'interface</p>
            <Separator />
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'light', label: 'Clair', icon: Sun },
                { value: 'dark', label: 'Sombre', icon: Moon },
                { value: 'system', label: 'Système', icon: Bell },
              ] as const).map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setTheme(t.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${theme === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-muted-foreground'}`}
                  >
                    <Icon className="h-5 w-5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
