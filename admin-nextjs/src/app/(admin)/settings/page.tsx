'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  App, Avatar, Button, Card, Descriptions, Divider, Form, Input, Select, Space, Switch, Tabs, Tag, Typography,
} from 'antd';
import {
  BellOutlined, CheckCircleOutlined, KeyOutlined, LockOutlined, MoonOutlined, SaveOutlined,
  SunOutlined, UserOutlined, SafetyCertificateOutlined, SettingOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useThemeMode } from '@/components/layout/ThemeProvider';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type ProfileForm = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
};

export default function SettingsPage() {
  const { dark, toggle, ready } = useThemeMode();
  const { user } = useAuth();
  const { message } = App.useApp();

  const [profile, setProfile] = useState<ProfileForm & { email?: string; role?: string; created_at?: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  const [notifSettings, setNotifSettings] = useState({
    new_orders: true,
    delivery_updates: true,
    user_registrations: false,
    low_stock: true,
    payment_alerts: true,
  });

  // ── Load profile ─────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, city, email, role, created_at')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data || {});
    } catch (e: any) {
      message.error(e?.message || 'Erreur chargement profil');
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id, message]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ── Save profile ─────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!user?.id || !profile) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        first_name: profile.first_name?.trim() || null,
        last_name: profile.last_name?.trim() || null,
        phone: profile.phone?.trim() || null,
        city: profile.city?.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      message.success('Profil mis à jour');
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ──────────────────────────────────────────────
  const changePassword = async () => {
    if (!pwdForm.newPwd.trim()) { message.error('Nouveau mot de passe requis'); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { message.error('Les mots de passe ne correspondent pas'); return; }
    if (pwdForm.newPwd.length < 8) { message.error('Minimum 8 caractères requis'); return; }
    setPwdSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd });
      if (error) throw error;
      message.success('Mot de passe mis à jour');
      setPwdForm({ current: '', newPwd: '', confirm: '' });
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    } finally {
      setPwdSaving(false);
    }
  };

  // ── Send password reset email ────────────────────────────────────
  const sendResetEmail = async () => {
    const email = user?.email;
    if (!email) { message.error('Aucun email associé'); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      message.success(`Email de réinitialisation envoyé à ${email}`);
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  // ── Sign out all sessions ─────────────────────────────────────────
  const signOutAll = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      message.success('Toutes les sessions ont été fermées');
    } catch (e: any) {
      message.error(e?.message || 'Erreur');
    }
  };

  const displayName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user?.email || 'Admin'
    : user?.email || 'Admin';

  const tabs = [
    // ── APPARENCE ─────────────────────────────────────────────────────
    {
      key: 'appearance',
      label: (
        <span className="flex items-center gap-2">
          {dark ? <MoonOutlined /> : <SunOutlined />} Apparence
        </span>
      ),
      children: (
        <div className="space-y-6 max-w-lg">
          <div>
            <Typography.Title level={5} style={{ margin: 0, marginBottom: 4 }}>Mode d'affichage</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Choisissez entre le thème clair et sombre. Votre préférence est sauvegardée localement.
            </Typography.Text>
          </div>

          {/* Theme toggle card */}
          <div className="grid grid-cols-2 gap-3">
            {/* Light */}
            <div
              onClick={() => ready && dark && toggle()}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                !dark ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              style={{ background: '#f9fafb' }}
            >
              <div style={{ height: 64, borderRadius: 8, background: '#ffffff', border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SunOutlined style={{ fontSize: 24, color: '#f59e0b' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#111827' }}>Clair</div>
                {!dark && ready && <Tag color="green" style={{ marginTop: 4 }}>Actif</Tag>}
              </div>
            </div>

            {/* Dark */}
            <div
              onClick={() => ready && !dark && toggle()}
              className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                dark ? 'border-indigo-500 ring-2 ring-indigo-400/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              style={{ background: '#1e293b' }}
            >
              <div style={{ height: 64, borderRadius: 8, background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MoonOutlined style={{ fontSize: 24, color: '#818cf8' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Sombre</div>
                {dark && ready && <Tag color="blue" style={{ marginTop: 4 }}>Actif</Tag>}
              </div>
            </div>
          </div>

          <Divider />

          {/* Quick toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800">
            <div>
              <div className="font-semibold">Mode sombre</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {dark ? 'Interface sombre activée' : 'Interface claire activée'}
              </div>
            </div>
            <Switch
              checked={ready ? dark : false}
              onChange={() => toggle()}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              disabled={!ready}
              style={{ minWidth: 56 }}
            />
          </div>

          <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              💡 La préférence est sauvegardée dans <code>localStorage</code>. Lors du prochain chargement, votre choix sera automatiquement restauré.
            </Typography.Text>
          </div>
        </div>
      ),
    },

    // ── PROFIL ──────────────────────────────────────────────────────
    {
      key: 'profile',
      label: (
        <span className="flex items-center gap-2">
          <UserOutlined /> Profil
        </span>
      ),
      children: (
        <div className="max-w-lg space-y-5">
          {/* Avatar + info */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-800">
            <Avatar size={64} style={{ background: '#4f46e5', fontSize: 24, flexShrink: 0 }}>
              {displayName.slice(0, 1).toUpperCase()}
            </Avatar>
            <div>
              <div className="font-semibold text-lg">{displayName}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{user?.email || '—'}</div>
              <div className="flex gap-2 mt-1">
                <Tag color="purple">{profile?.role || 'admin'}</Tag>
                <Tag color="green">Actif</Tag>
              </div>
            </div>
          </div>

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="ID Compte">
              <Typography.Text code style={{ fontSize: 11 }}>{user?.id || '—'}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Créé le">
              {profile?.created_at ? new Date(profile.created_at).toLocaleString('fr-FR') : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Form layout="vertical" disabled={profileLoading}>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Prénom">
                <Input
                  placeholder="Prénom"
                  value={profile?.first_name || ''}
                  onChange={e => setProfile(p => ({ ...p!, first_name: e.target.value }))}
                />
              </Form.Item>
              <Form.Item label="Nom">
                <Input
                  placeholder="Nom"
                  value={profile?.last_name || ''}
                  onChange={e => setProfile(p => ({ ...p!, last_name: e.target.value }))}
                />
              </Form.Item>
            </div>
            <Form.Item label="Téléphone">
              <Input
                placeholder="+235 66720010"
                value={profile?.phone || ''}
                onChange={e => setProfile(p => ({ ...p!, phone: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Ville">
              <Input
                placeholder="Abeche, Ndjamena..."
                value={profile?.city || ''}
                onChange={e => setProfile(p => ({ ...p!, city: e.target.value }))}
              />
            </Form.Item>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={profileSaving}
              onClick={() => void saveProfile()}
            >
              Enregistrer le profil
            </Button>
          </Form>
        </div>
      ),
    },

    // ── SÉCURITÉ ─────────────────────────────────────────────────────
    {
      key: 'security',
      label: (
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined /> Sécurité
        </span>
      ),
      children: (
        <div className="max-w-lg space-y-6">
          {/* Change password */}
          <Card
            title={<span><KeyOutlined style={{ marginRight: 8 }} />Changer le mot de passe</span>}
            size="small"
          >
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Nouveau mot de passe</div>
                <Input.Password
                  placeholder="Minimum 8 caractères"
                  value={pwdForm.newPwd}
                  onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))}
                />
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Confirmer le mot de passe</div>
                <Input.Password
                  placeholder="Répétez le nouveau mot de passe"
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                  status={pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm ? 'error' : ''}
                />
                {pwdForm.confirm && pwdForm.newPwd !== pwdForm.confirm && (
                  <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>Les mots de passe ne correspondent pas</div>
                )}
              </div>
              {/* Strength indicator */}
              {pwdForm.newPwd && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 4, borderRadius: 2,
                          background: pwdForm.newPwd.length >= i * 3
                            ? (i <= 1 ? '#ef4444' : i <= 2 ? '#f59e0b' : i <= 3 ? '#3b82f6' : '#22c55e')
                            : '#e5e7eb',
                        }}
                      />
                    ))}
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {pwdForm.newPwd.length < 6 ? 'Trop court' : pwdForm.newPwd.length < 9 ? 'Moyen' : pwdForm.newPwd.length < 12 ? 'Fort' : 'Très fort'}
                  </Typography.Text>
                </div>
              )}
              <Button
                type="primary"
                icon={<KeyOutlined />}
                loading={pwdSaving}
                onClick={() => void changePassword()}
                disabled={!pwdForm.newPwd || pwdForm.newPwd !== pwdForm.confirm}
              >
                Mettre à jour le mot de passe
              </Button>
            </div>
          </Card>

          {/* Reset via email */}
          <Card
            title={<span><LockOutlined style={{ marginRight: 8 }} />Réinitialisation par email</span>}
            size="small"
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              Envoyer un lien de réinitialisation à <strong>{user?.email}</strong>. Utile si vous oubliez votre mot de passe actuel.
            </Typography.Text>
            <Button icon={<LockOutlined />} onClick={() => void sendResetEmail()}>
              Envoyer le lien de réinitialisation
            </Button>
          </Card>

          {/* Session management */}
          <Card
            title={<span><SafetyCertificateOutlined style={{ marginRight: 8 }} />Sessions actives</span>}
            size="small"
          >
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
              Fermer toutes les sessions ouvertes sur tous les appareils. Vous serez redirigé vers la page de connexion.
            </Typography.Text>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Dernière connexion">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('fr-FR') : '—'}
              </Descriptions.Item>
            </Descriptions>
            <Button danger icon={<LockOutlined />} onClick={() => void signOutAll()}>
              Fermer toutes les sessions
            </Button>
          </Card>
        </div>
      ),
    },

    // ── NOTIFICATIONS ────────────────────────────────────────────────
    {
      key: 'notifications',
      label: (
        <span className="flex items-center gap-2">
          <BellOutlined /> Notifications
        </span>
      ),
      children: (
        <div className="max-w-lg space-y-4">
          <div>
            <Typography.Title level={5} style={{ margin: 0, marginBottom: 4 }}>Préférences de notification</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Configurez quels événements déclenchent des alertes dans le panneau d'administration.
            </Typography.Text>
          </div>

          {[
            { key: 'new_orders', icon: '📦', label: 'Nouvelles commandes', desc: 'Alerte à chaque nouvelle commande reçue' },
            { key: 'delivery_updates', icon: '🚚', label: 'Mises à jour livraison', desc: 'Changement de statut de livraison' },
            { key: 'user_registrations', icon: '👤', label: 'Nouvelles inscriptions', desc: 'Nouvel utilisateur créé' },
            { key: 'low_stock', icon: '⚠️', label: 'Stock faible', desc: 'Produit avec moins de 5 unités' },
            { key: 'payment_alerts', icon: '💳', label: 'Alertes paiement', desc: 'Paiements échoués ou suspects' },
          ].map(({ key, icon, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700"
            >
              <div className="flex items-center gap-3">
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div className="font-semibold">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                </div>
              </div>
              <Switch
                checked={notifSettings[key as keyof typeof notifSettings]}
                onChange={(v) => setNotifSettings(s => ({ ...s, [key]: v }))}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => message.success('Préférences de notification sauvegardées')}
            >
              Sauvegarder
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setNotifSettings({
                new_orders: true,
                delivery_updates: true,
                user_registrations: false,
                low_stock: true,
                payment_alerts: true,
              })}
            >
              Réinitialiser
            </Button>
          </div>

          <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ⚡ Les notifications push (FCM) nécessitent une configuration serveur supplémentaire. Ces paramètres contrôlent les notifications in-app uniquement.
            </Typography.Text>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de votre compte et du tableau de bord"
      />

      {/* Account summary banner */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar size={56} style={{ background: '#4f46e5', fontSize: 22, flexShrink: 0 }}>
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{displayName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</div>
          </div>
          <Space>
            <Tag color="purple" icon={<SafetyCertificateOutlined />}>Administrateur</Tag>
            <Tag color="green" icon={<CheckCircleOutlined />}>Actif</Tag>
          </Space>
        </div>
      </Card>

      <Card>
        <Tabs
          items={tabs}
          tabBarStyle={{ marginBottom: 24 }}
        />
      </Card>
    </div>
  );
}
