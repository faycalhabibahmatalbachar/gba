import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Bell, Palette, Store, Mail, Phone,
  Lock, Pencil, Save, X, Upload, Sun, Moon,
  Key, ShoppingBag, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useDark } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

const inputCls = "w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white dark:bg-slate-800 dark:text-slate-100 transition disabled:bg-gray-50 dark:disabled:bg-slate-900 disabled:text-gray-500 dark:disabled:text-slate-500";
const selectCls = "w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-800 dark:text-slate-100 transition";

function SettingRow({ icon: Icon, label, desc, children }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">{label}</p>
          {desc && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0 ml-4">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const TABS = [
  { label: 'Profil', Icon: User },
  { label: 'Notifications', Icon: Bell },
  { label: 'Sécurité', Icon: Shield },
  { label: 'Boutique', Icon: Store },
  { label: 'Apparence', Icon: Palette },
];

function Settings() {
  const { dark, toggle: toggleDarkMode } = useDark();
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#667eea');
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    name: 'Faycal Habib',
    email: user?.email || 'faycalhabibahmat@gmail.com',
    phone: '+1 234 567 8900',
    bio: 'Admin at GBA Store',
  });

  const [notifications, setNotifications] = useState({
    emailOrders: true, emailProducts: true, emailUsers: false,
    pushOrders: true, pushProducts: false, pushUsers: false,
  });

  const [storeSettings, setStoreSettings] = useState({
    storeName: 'GBA Store',
    storeEmail: 'support@gbastore.com',
    storePhone: '+1 234 567 8900',
    storeAddress: '123 Main St, City',
    currency: 'XAF',
    language: 'fr',
    timezone: 'UTC+1',
    taxRate: '19.25',
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30',
    passwordExpiry: '90',
    ipRestriction: false,
  });

  const handleSaveProfile    = () => { setEditMode(false); toast.success('Profil mis à jour'); };
  const handleSaveNotifications = () => toast.success('Notifications sauvegardées');
  const handleSaveStore      = () => toast.success('Paramètres boutique sauvegardés');
  const handleSaveSecurity   = () => toast.success('Sécurité sauvegardée');

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className={`text-xl sm:text-2xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Paramètres</h1>
        <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>Gérez votre compte et les préférences de l'application</p>
      </motion.div>

      <Card className="overflow-hidden">
        <div className={`flex overflow-x-auto border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === i ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : `border-transparent ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
              <t.Icon size={15} />{t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── Profil ── */}
          {tab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`rounded-2xl p-6 flex flex-col items-center text-center ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold mb-4 shadow-lg">
                  {profile.name[0]}
                </div>
                <label className="w-full cursor-pointer">
                  <Button variant="outline" size="sm" className="w-full" asChild><span><Upload size={14} /> Changer l'avatar</span></Button>
                  <input type="file" className="hidden" accept="image/*" />
                </label>
                <p className={`text-xs mt-2 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>JPG, PNG ou GIF. Max 2 Mo</p>
              </div>
              <div className={`md:col-span-2 rounded-2xl p-6 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>Informations du profil</h2>
                  {!editMode
                    ? <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}><Pencil size={14} /> Modifier</Button>
                    : <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditMode(false)}><X size={14} /> Annuler</Button>
                        <Button size="sm" onClick={handleSaveProfile}><Save size={14} /> Enregistrer</Button>
                      </div>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Nom complet"><input className={inputCls} value={profile.name} disabled={!editMode} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></Field>
                  <Field label="Email"><input className={inputCls} value={profile.email} disabled={!editMode} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} /></Field>
                  <Field label="Téléphone"><input className={inputCls} value={profile.phone} disabled={!editMode} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} /></Field>
                  <Field label="Rôle"><input className={inputCls} value="Administrateur" disabled /></Field>
                  <div className="sm:col-span-2">
                    <Field label="Bio"><textarea className={inputCls} rows={3} value={profile.bio} disabled={!editMode} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} /></Field>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`rounded-2xl p-5 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>Notifications email</h2>
                <SettingRow icon={Mail} label="Nouvelles commandes" desc="Email pour chaque commande">
                  <Toggle checked={notifications.emailOrders} onChange={v => setNotifications(p => ({ ...p, emailOrders: v }))} />
                </SettingRow>
                <SettingRow icon={ShoppingBag} label="Changements produits" desc="Alertes de modification">
                  <Toggle checked={notifications.emailProducts} onChange={v => setNotifications(p => ({ ...p, emailProducts: v }))} />
                </SettingRow>
                <SettingRow icon={User} label="Activité utilisateurs" desc="Nouvelles inscriptions">
                  <Toggle checked={notifications.emailUsers} onChange={v => setNotifications(p => ({ ...p, emailUsers: v }))} />
                </SettingRow>
              </div>
              <div className={`rounded-2xl p-5 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>Notifications push</h2>
                <SettingRow icon={Bell} label="Nouvelles commandes" desc="Push pour commandes">
                  <Toggle checked={notifications.pushOrders} onChange={v => setNotifications(p => ({ ...p, pushOrders: v }))} />
                </SettingRow>
                <SettingRow icon={ShoppingBag} label="Changements produits" desc="Push pour produits">
                  <Toggle checked={notifications.pushProducts} onChange={v => setNotifications(p => ({ ...p, pushProducts: v }))} />
                </SettingRow>
                <SettingRow icon={User} label="Activité utilisateurs" desc="Push pour utilisateurs">
                  <Toggle checked={notifications.pushUsers} onChange={v => setNotifications(p => ({ ...p, pushUsers: v }))} />
                </SettingRow>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button size="sm" onClick={handleSaveNotifications}><Save size={15} /> Enregistrer</Button>
              </div>
            </div>
          )}

          {/* ── Sécurité ── */}
          {tab === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`md:col-span-2 flex items-start gap-3 p-3 rounded-xl text-sm ${dark ? 'bg-blue-900/30 border border-blue-800 text-blue-300' : 'bg-blue-50 border border-blue-100 text-blue-700'}`}>
                <Info size={15} className="shrink-0 mt-0.5" />
                Renforcez la sécurité de votre compte en activant les options ci-dessous.
              </div>
              <div className={`rounded-2xl p-5 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>Options de sécurité</h2>
                <SettingRow icon={Key} label="Double authentification" desc="Couche de sécurité supplémentaire">
                  <Toggle checked={security.twoFactor} onChange={v => setSecurity(p => ({ ...p, twoFactor: v }))} />
                </SettingRow>
                <SettingRow icon={Shield} label="Restriction IP" desc="Restreindre l'accès à des IPs spécifiques">
                  <Toggle checked={security.ipRestriction} onChange={v => setSecurity(p => ({ ...p, ipRestriction: v }))} />
                </SettingRow>
              </div>
              <div className={`rounded-2xl p-5 space-y-4 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>Mot de passe & Session</h2>
                <Button variant="outline" className="w-full"><Lock size={14} /> Changer le mot de passe</Button>
                <Field label="Timeout session (min)"><input type="number" className={inputCls} value={security.sessionTimeout} onChange={e => setSecurity(p => ({ ...p, sessionTimeout: e.target.value }))} /></Field>
                <Field label="Expiration mot de passe (jours)"><input type="number" className={inputCls} value={security.passwordExpiry} onChange={e => setSecurity(p => ({ ...p, passwordExpiry: e.target.value }))} /></Field>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button size="sm" onClick={handleSaveSecurity}><Save size={15} /> Enregistrer</Button>
              </div>
            </div>
          )}

          {/* ── Boutique ── */}
          {tab === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className={`rounded-2xl p-5 space-y-4 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>Informations boutique</h2>
                <Field label="Nom de la boutique"><input className={inputCls} value={storeSettings.storeName} onChange={e => setStoreSettings(p => ({ ...p, storeName: e.target.value }))} /></Field>
                <Field label="Email boutique"><input className={inputCls} value={storeSettings.storeEmail} onChange={e => setStoreSettings(p => ({ ...p, storeEmail: e.target.value }))} /></Field>
                <Field label="Téléphone boutique"><input className={inputCls} value={storeSettings.storePhone} onChange={e => setStoreSettings(p => ({ ...p, storePhone: e.target.value }))} /></Field>
                <Field label="Adresse"><textarea className={inputCls} rows={2} value={storeSettings.storeAddress} onChange={e => setStoreSettings(p => ({ ...p, storeAddress: e.target.value }))} /></Field>
              </div>
              <div className={`rounded-2xl p-5 space-y-4 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>Paramètres régionaux</h2>
                <Field label="Devise">
                  <select className={selectCls} value={storeSettings.currency} onChange={e => setStoreSettings(p => ({ ...p, currency: e.target.value }))}>
                    <option value="XAF">XAF - Franc CFA</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </Field>
                <Field label="Langue">
                  <select className={selectCls} value={storeSettings.language} onChange={e => setStoreSettings(p => ({ ...p, language: e.target.value }))}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Field>
                <Field label="Fuseau horaire">
                  <select className={selectCls} value={storeSettings.timezone} onChange={e => setStoreSettings(p => ({ ...p, timezone: e.target.value }))}>
                    <option value="UTC+1">UTC+1 (Afrique Centrale)</option>
                    <option value="UTC">UTC</option>
                    <option value="UTC-5">UTC-5 (Est USA)</option>
                  </select>
                </Field>
                <Field label="Taux de TVA (%)"><input type="number" className={inputCls} value={storeSettings.taxRate} onChange={e => setStoreSettings(p => ({ ...p, taxRate: e.target.value }))} /></Field>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button size="sm" onClick={handleSaveStore}><Save size={15} /> Enregistrer</Button>
              </div>
            </div>
          )}

          {/* ── Apparence ── */}
          {tab === 4 && (
            <div className="max-w-lg space-y-5">
              <div className={`rounded-2xl p-5 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold mb-4 ${dark ? 'text-white' : 'text-gray-800'}`}>Thème</h2>
                <SettingRow icon={dark ? Sun : Moon} label="Mode sombre" desc="Basculer entre clair et sombre">
                  <Toggle checked={dark} onChange={toggleDarkMode} />
                </SettingRow>
              </div>
              <div className={`rounded-2xl p-5 ${dark ? 'bg-slate-800/60' : 'bg-gray-50'}`}>
                <h2 className={`font-semibold mb-3 ${dark ? 'text-white' : 'text-gray-800'}`}>Couleur principale</h2>
                <div className="flex gap-3">
                  {['#667eea', '#f093fb', '#30cfd0', '#f5576c', '#764ba2'].map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className="w-10 h-10 rounded-xl transition-all hover:scale-110"
                      style={{ background: color, outline: selectedColor === color ? `3px solid ${color}` : 'none', outlineOffset: 2 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default Settings;
