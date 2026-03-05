import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Truck, Users, Package,
  Image, MessageCircle, ShoppingBasket, Heart, BarChart3,
  Monitor, Settings, Bell, LogOut, ChevronRight, Menu,
  Maximize2, Minimize2, RefreshCw, HelpCircle,
  MapPin, Layers, X, Search, ChevronDown,
  PanelLeftClose, PanelLeftOpen, ArrowRight, Moon, Sun,
  CheckCheck, ShoppingBag, ChevronUp, UserPlus, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import toast from 'react-hot-toast';

// ── Dark Mode Context ─────────────────────────────────────────────────────────
export const DarkModeContext = createContext({ dark: false, toggle: () => {} });
export const useDark = () => useContext(DarkModeContext);

// ── Menu structure ────────────────────────────────────────────────────────────
const menuSections = [
  {
    label: 'Gestion Commerciale',
    items: [
      { title: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
      { title: 'Commandes', path: '/orders', icon: ShoppingCart, badgeKey: 'orders' },
      {
        title: 'Livraisons',
        path: '/deliveries',
        icon: Truck,
        badgeKey: 'deliveries',
        subItems: [
          { title: 'Suivi livraisons', path: '/deliveries', icon: Truck },
          { title: 'Tracking GPS', path: '/delivery-tracking', icon: MapPin },
        ],
      },
      { title: 'Livreurs', path: '/drivers', icon: Users },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      {
        title: 'Produits',
        path: '/products',
        icon: Package,
        subItems: [
          { title: 'Tous les produits', path: '/products', icon: Package },
          { title: 'Catégories', path: '/products/categories', icon: Layers },
        ],
      },
      { title: 'Bannières', path: '/banners', icon: Image },
    ],
  },
  {
    label: 'Utilisateurs',
    items: [
      { title: 'Utilisateurs', path: '/users', icon: Users },
      { title: 'Messages', path: '/messages', icon: MessageCircle, badgeKey: 'messages' },
      { title: 'Paniers', path: '/monitoring/carts', icon: ShoppingBasket },
      { title: 'Favoris', path: '/monitoring/favorites', icon: Heart },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { title: 'Analyses', path: '/analytics', icon: BarChart3 },
      { title: 'Monitoring', path: '/monitoring/products', icon: Monitor },
    ],
  },
  {
    label: 'Paramètres',
    items: [
      {
        title: 'Paramètres',
        path: '/settings',
        icon: Settings,
        subItems: [
          { title: 'Général', path: '/settings', icon: Settings },
          { title: 'Notifications', path: '/settings/notifications', icon: Bell },
          { title: 'Sécurité', path: '/settings/security', icon: HelpCircle },
        ],
      },
    ],
  },
];

// Flat list for search & breadcrumbs
const allPages = menuSections.flatMap(s =>
  s.items.flatMap(i => [
    { title: i.title, path: i.path, icon: i.icon, section: s.label },
    ...(i.subItems || []).map(sub => ({ title: sub.title, path: sub.path, icon: sub.icon, section: s.label })),
  ])
);

// ── Tooltip wrapper ────────────────────────────────────────────────────────────
function Tooltip({ label, children }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute left-full ml-3 z-[200] px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg whitespace-nowrap shadow-xl pointer-events-none"
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Scroll To Top ─────────────────────────────────────────────────────────────
function ScrollToTop() {
  const { dark } = useDark();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('main-scroll');
    if (!el) return;
    const h = () => setVisible(el.scrollTop > 300);
    el.addEventListener('scroll', h);
    return () => el.removeEventListener('scroll', h);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.7, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 10 }}
          transition={{ duration: 0.18 }}
          onClick={() => document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full shadow-xl flex items-center justify-center
            ${dark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'} text-white transition-colors`}
          title="Remonter en haut"
        >
          <ChevronUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Notifications Panel ───────────────────────────────────────────────────────
const NOTIF_META = {
  order:    { Icon: ShoppingBag,   light: 'bg-indigo-100 text-indigo-600', dark: 'bg-indigo-900/60 text-indigo-300' },
  message:  { Icon: MessageCircle, light: 'bg-blue-100 text-blue-600',     dark: 'bg-blue-900/60 text-blue-300' },
  user:     { Icon: UserPlus,      light: 'bg-green-100 text-green-600',   dark: 'bg-green-900/60 text-green-300' },
  delivery: { Icon: Truck,         light: 'bg-amber-100 text-amber-600',   dark: 'bg-amber-900/60 text-amber-300' },
  alert:    { Icon: AlertCircle,   light: 'bg-red-100 text-red-600',       dark: 'bg-red-900/60 text-red-300' },
};

function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onClose }) {
  const { dark } = useDark();
  const panelRef = useRef(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const h = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 50);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.16 }}
      className={`absolute right-0 top-12 w-80 rounded-2xl shadow-2xl border z-50 overflow-hidden
        ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <Bell size={15} className={dark ? 'text-slate-300' : 'text-gray-600'} />
          <span className={`font-semibold text-sm ${dark ? 'text-white' : 'text-gray-800'}`}>Notifications</span>
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">{unread}</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={onMarkAllRead} className={`text-xs flex items-center gap-1 font-medium ${dark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
            <CheckCheck size={12} /> Tout lire
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={28} className={`mx-auto mb-2 ${dark ? 'text-slate-600' : 'text-gray-200'}`} />
            <p className={`text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucune notification</p>
          </div>
        ) : notifications.map(n => {
          const meta = NOTIF_META[n.type] || { Icon: Bell, light: 'bg-gray-100 text-gray-600', dark: 'bg-slate-700 text-slate-300' };
          const Icon = meta.Icon;
          const iconCls = dark ? meta.dark : meta.light;
          return (
            <button key={n.id} onClick={() => onMarkRead(n.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b last:border-0
                ${dark
                  ? `border-slate-700/50 ${n.read ? 'hover:bg-slate-700/30' : 'bg-indigo-900/20 hover:bg-slate-700/50'}`
                  : `border-gray-50 ${n.read ? 'hover:bg-gray-50' : 'bg-indigo-50/60 hover:bg-indigo-50'}`}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconCls}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${dark ? 'text-slate-200' : 'text-gray-800'} ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{n.body}</p>
                <p className={`text-[10px] mt-1 ${dark ? 'text-slate-600' : 'text-gray-300'}`}>{n.time}</p>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className={`px-4 py-2.5 border-t text-center ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
        <button className={`text-xs font-medium ${dark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}>
          Voir toutes les notifications
        </button>
      </div>
    </motion.div>
  );
}

// ── Search Modal ───────────────────────────────────────────────────────────────
function SearchModal({ onClose }) {
  const { dark } = useDark();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const results = query.trim()
    ? allPages.filter(p => p.title.toLowerCase().includes(query.toLowerCase()) || p.section.toLowerCase().includes(query.toLowerCase()))
    : allPages.slice(0, 8);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}
        className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
        onClick={e => e.stopPropagation()}>
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${dark ? 'border-slate-700' : 'border-gray-100'}`}>
          <Search size={18} className={`shrink-0 ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une page… (Échap pour fermer)"
            className={`flex-1 text-sm outline-none bg-transparent ${dark ? 'text-slate-100 placeholder-slate-500' : 'text-gray-800 placeholder-gray-400'}`} />
        </div>
        <div className="py-2 max-h-72 overflow-y-auto">
          {results.length === 0
            ? <p className={`text-center text-sm py-6 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Aucun résultat</p>
            : results.map(page => {
                const Icon = page.icon;
                return (
                  <button key={page.path} onClick={() => { navigate(page.path); onClose(); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${dark ? 'hover:bg-slate-700' : 'hover:bg-indigo-50'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${dark ? 'bg-indigo-900/60 group-hover:bg-indigo-800/60' : 'bg-indigo-100 group-hover:bg-indigo-200'}`}>
                      {Icon && <Icon size={15} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{page.title}</p>
                      <p className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{page.section}</p>
                    </div>
                    <ArrowRight size={13} className={`shrink-0 ${dark ? 'text-slate-600 group-hover:text-indigo-400' : 'text-gray-300 group-hover:text-indigo-400'}`} />
                  </button>
                );
              })}
        </div>
        <div className={`px-4 py-2 border-t text-[11px] flex gap-4 ${dark ? 'border-slate-700 text-slate-500' : 'border-gray-100 text-gray-400'}`}>
          <span><kbd className={`px-1 rounded font-mono ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>↑↓</kbd> naviguer</span>
          <span><kbd className={`px-1 rounded font-mono ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>↵</kbd> ouvrir</span>
          <span><kbd className={`px-1 rounded font-mono ${dark ? 'bg-slate-700' : 'bg-gray-100'}`}>ESC</kbd> fermer</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, onClose, badges }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState({ Livraisons: true, Produits: true });

  const isActive = (path) => location.pathname === path;
  const isParentActive = (item) =>
    item.subItems?.some(s => location.pathname === s.path) || location.pathname === item.path;

  const toggleExpand = (title) =>
    setExpandedItems(prev => ({ ...prev, [title]: !prev[title] }));

  const renderItem = (item, depth = 0) => {
    const Icon = item.icon;
    const hasChildren = item.subItems?.length > 0;
    const active = isActive(item.path);
    const parentActive = hasChildren && isParentActive(item);
    const expanded = expandedItems[item.title];
    const badge = item.badgeKey ? (badges?.[item.badgeKey] || 0) : 0;

    return (
      <div key={item.title}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (hasChildren) toggleExpand(item.title);
            else { navigate(item.path); onClose?.(); }
          }}
          className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-xl transition-all duration-150 mb-0.5 group
            ${depth > 0 ? 'pl-9' : ''}
            ${active || parentActive
              ? 'bg-gradient-to-r from-indigo-500/25 to-purple-500/20 text-white'
              : 'text-slate-300 hover:bg-white/8 hover:text-white'}`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {Icon && (
              <span className={`shrink-0 ${active || parentActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-200'}`}>
                <Icon size={depth > 0 ? 14 : 16} />
              </span>
            )}
            <span className="truncate">{item.title}</span>
            {badge > 0 && (
              <span className="ml-auto shrink-0 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </div>
          {hasChildren && (
            <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.18 }} className="shrink-0 ml-2">
              <ChevronRight size={13} className="text-slate-500" />
            </motion.div>
          )}
        </motion.button>

        {hasChildren && (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="sub"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-0.5 space-y-0.5 mb-1">
                  {item.subItems.map(child => renderItem(child, depth + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  return (
    <motion.div
      animate={{ width: collapsed ? 0 : 264 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white flex flex-col shadow-2xl overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center justify-between py-4 border-b border-white/8 shrink-0 px-4 min-w-[264px]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <div>
            <h2 className="font-bold text-[15px] leading-none">GBA Admin</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Panneau de gestion</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10 px-3 min-w-[264px]">
        {menuSections.map((section, idx) => (
          <div key={section.label}>
            {idx > 0 && <div className="border-t border-white/5 mb-3" />}
            <p className="text-[9.5px] font-bold uppercase tracking-widest text-slate-600 px-2 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => renderItem(item))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-white/5 shrink-0 min-w-[264px]">
        <p className="text-[10px] text-slate-600">GBA Admin v2.0</p>
      </div>
    </motion.div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────────
function Header({ collapsed, onToggleCollapse, onMobileMenuClick, onSearchOpen, badges, notifications, onMarkRead, onMarkAllRead }) {
  const { user, signOut } = useAuth();
  const { dark, toggle: toggleDark } = useDark();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const userMenuRef = useRef(null);

  const currentPage = allPages.find(p => location.pathname === p.path);
  const currentTitle = currentPage?.title || 'GBA Admin';

  const breadcrumb = (() => {
    const section = menuSections.find(s =>
      s.items.some(i => i.path === location.pathname || i.subItems?.some(sub => sub.path === location.pathname))
    );
    return section ? [section.label, currentTitle] : [currentTitle];
  })();

  useEffect(() => { document.title = `${currentTitle} — GBA Admin`; }, [currentTitle]);

  useEffect(() => {
    const h = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const handleRefresh = () => { setIsRefreshing(true); window.location.reload(); };
  const handleLogout = async () => { setShowUserMenu(false); await signOut(); toast.success('Déconnecté'); };

  const initials = user?.email?.[0]?.toUpperCase() || 'A';
  const unreadCount = notifications.filter(n => !n.read).length;

  const btn = `p-2 rounded-lg transition-colors ${dark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-100 text-gray-500'}`;

  return (
    <header className={`border-b sticky top-0 z-30 shadow-sm ${dark ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-gray-100'}`}>
      <div className="px-4 sm:px-5 h-14 flex items-center justify-between gap-3">

        {/* Left */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onMobileMenuClick} className={`lg:hidden ${btn}`}><Menu size={19} /></button>
          <button onClick={onToggleCollapse} className={`hidden lg:flex ${btn}`} title={collapsed ? 'Développer' : 'Réduire'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={crumb}>
                {i > 0 && <ChevronRight size={13} className={dark ? 'text-slate-600 shrink-0' : 'text-gray-300 shrink-0'} />}
                <span className={i === breadcrumb.length - 1
                  ? `font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`
                  : `truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </nav>
          <span className={`sm:hidden font-semibold text-sm truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{currentTitle}</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Search */}
          <button onClick={onSearchOpen}
            className={`hidden md:flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors mr-1
              ${dark ? 'text-slate-400 bg-slate-800 hover:bg-slate-700 border-slate-700' : 'text-gray-400 bg-gray-50 hover:bg-gray-100 border-gray-200'}`}>
            <Search size={14} />
            <span>Rechercher…</span>
            <kbd className={`text-[10px] px-1.5 py-0.5 rounded font-mono ml-1 ${dark ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-500'}`}>⌘K</kbd>
          </button>
          <button onClick={onSearchOpen} className={`md:hidden ${btn}`}><Search size={18} /></button>

          <button onClick={handleRefresh} className={btn} title="Rafraîchir">
            <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleFullscreen} className={`hidden sm:flex ${btn}`}>
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>

          {/* Dark mode toggle */}
          <button onClick={toggleDark} className={btn} title={dark ? 'Mode clair' : 'Mode sombre'}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotifications(v => !v)} className={`relative ${btn}`} title="Notifications">
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <NotificationsPanel
                  notifications={notifications}
                  onMarkRead={(id) => { onMarkRead(id); }}
                  onMarkAllRead={() => { onMarkAllRead(); }}
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* User menu */}
          <div className="relative ml-1" ref={userMenuRef}>
            <button onClick={() => setShowUserMenu(v => !v)}
              className={`flex items-center gap-2 p-1.5 rounded-xl transition-colors ${dark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'}`}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <ChevronDown size={13} className={`transition-transform ${showUserMenu ? 'rotate-180' : ''} ${dark ? 'text-slate-400' : 'text-gray-400'}`} />
            </button>
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.13 }}
                  className={`absolute right-0 mt-2 w-52 rounded-xl shadow-xl border overflow-hidden z-50
                    ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}
                >
                  <div className={`px-4 py-3 border-b ${dark ? 'border-slate-700 bg-gradient-to-r from-indigo-900/40 to-purple-900/30' : 'border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50'}`}>
                    <p className={`text-sm font-semibold truncate ${dark ? 'text-slate-100' : 'text-gray-800'}`}>{user?.email}</p>
                    <p className="text-xs text-indigo-400 mt-0.5 font-medium">Administrateur</p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
                        ${dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <Settings size={14} className={dark ? 'text-slate-500' : 'text-gray-400'} /><span>Paramètres</span>
                    </button>
                    <div className={`border-t my-1 ${dark ? 'border-slate-700' : 'border-gray-100'}`} />
                    <button onClick={handleLogout}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors
                        ${dark ? 'text-red-400 hover:bg-red-900/20' : 'text-red-500 hover:bg-red-50'}`}>
                      <LogOut size={14} /><span>Déconnexion</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Main Layout ────────────────────────────────────────────────────────────────
function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Dark mode ────────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('gba-dark') === 'true'; } catch { return false; }
  });
  const toggleDark = useCallback(() => {
    setDark(v => {
      const next = !v;
      try { localStorage.setItem('gba-dark', String(next)); } catch {}
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  }, []);
  // Apply on mount
  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => { setMobileSidebarOpen(false); }, [location.pathname]);

  const toggleCollapse = useCallback(() => {
    setCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }, []);

  // ── Search ───────────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Badges (live Supabase) ───────────────────────────────────────────────────
  const [badges, setBadges] = useState({ orders: 0, messages: 0, deliveries: 0 });

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const [r1, r2, r3] = await Promise.all([
          supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('chat_conversations').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['processing', 'shipped']),
        ]);
        setBadges({ orders: r1.count || 0, messages: r2.count || 0, deliveries: r3.count || 0 });
      } catch {}
    };
    fetchBadges();
    const iv = setInterval(fetchBadges, 60000);
    const ch = supabase.channel('layout-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, fetchBadges)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, []);

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const buildNotifications = async () => {
      try {
        const [ordersRes, msgsRes] = await Promise.all([
          supabase.from('orders').select('id, order_number, status, created_at, profiles(first_name, last_name)')
            .eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
          supabase.from('chat_conversations').select('id, created_at, profiles(first_name, last_name)')
            .eq('status', 'open').order('created_at', { ascending: false }).limit(5),
        ]);
        const now = Date.now();
        const fmt = (iso) => {
          const d = new Date(iso);
          const diff = Math.floor((now - d) / 60000);
          if (diff < 1) return 'À l\'instant';
          if (diff < 60) return `il y a ${diff} min`;
          if (diff < 1440) return `il y a ${Math.floor(diff / 60)}h`;
          return d.toLocaleDateString('fr-FR');
        };
        const notifs = [
          ...(ordersRes.data || []).map(o => ({
            id: `order-${o.id}`, type: 'order', read: false,
            title: `Nouvelle commande #${o.order_number || o.id?.slice(0, 8)}`,
            body: `Client : ${o.profiles?.first_name || ''} ${o.profiles?.last_name || ''}`.trim() || 'Client inconnu',
            time: fmt(o.created_at),
          })),
          ...(msgsRes.data || []).map(m => ({
            id: `msg-${m.id}`, type: 'message', read: false,
            title: 'Message en attente',
            body: `De : ${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim() || 'Client inconnu',
            time: fmt(m.created_at),
          })),
        ];
        setNotifications(notifs);
      } catch {}
    };
    buildNotifications();
    const iv = setInterval(buildNotifications, 90000);
    return () => clearInterval(iv);
  }, []);

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);
  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // ── Global keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    let gPressed = false;
    let gTimer = null;
    const handler = (e) => {
      // Cmd+K / Ctrl+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); return; }
      // Escape → close search
      if (e.key === 'Escape') { setSearchOpen(false); return; }
      // G+x shortcuts (ignore when typing in an input)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'g' || e.key === 'G') {
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1000);
        return;
      }
      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimer);
        const map = { d: '/dashboard', o: '/orders', u: '/users', p: '/products', a: '/analytics', m: '/messages', l: '/deliveries' };
        const dest = map[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); navigate(dest); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <DarkModeContext.Provider value={{ dark, toggle: toggleDark }}>
      <div className={`min-h-screen flex ${dark ? 'bg-slate-950' : 'bg-gray-50'}`}>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block shrink-0">
          <div className="sticky top-0 h-screen">
            <Sidebar collapsed={collapsed} badges={badges} />
          </div>
        </div>

        {/* Mobile Sidebar overlay */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
                className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="lg:hidden fixed left-0 top-0 z-50 h-screen"
              >
                <Sidebar collapsed={false} onClose={() => setMobileSidebarOpen(false)} badges={badges} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main area */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          <Header
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            onMobileMenuClick={() => setMobileSidebarOpen(v => !v)}
            onSearchOpen={() => setSearchOpen(true)}
            badges={badges}
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />

          <main id="main-scroll" className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-auto`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Search modal */}
        <AnimatePresence>
          {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
        </AnimatePresence>

        {/* Scroll to top */}
        <ScrollToTop />
      </div>
    </DarkModeContext.Provider>
  );
}

export default Layout;
