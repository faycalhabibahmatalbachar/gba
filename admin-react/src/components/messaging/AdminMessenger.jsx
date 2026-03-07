import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Paper, Typography, Avatar, IconButton, TextField,
  InputAdornment, Chip, Badge, CircularProgress, Divider, Skeleton,
} from '@mui/material';
import { Send, Search, MoreVertical, MessageCircle, CheckCheck,
  UserX, UserCheck, X, Paperclip, Plus, Download } from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useSnackbar } from 'notistack';
import { useDark } from '../Layout';
import './AdminMessenger.css';

const MSG_PAGE = 50;

const isImageUrl = t => t && (
  t.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/) ||
  t.includes('/storage/v1/object/public/')
);

const fmtTime = ts => {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? 'Hier'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

const getName = p => {
  if (!p) return 'Utilisateur';
  return `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || '?';
};
const getInitials = p => {
  if (!p) return '?';
  return ((p.first_name?.[0] || '') + (p.last_name?.[0] || '')).toUpperCase()
    || p.email?.[0]?.toUpperCase() || '?';
};

const ConvSkeleton = () => (
  <div className="flex items-center gap-3 px-3 py-2">
    <Skeleton variant="circular" width={44} height={44} />
    <div className="flex-1">
      <Skeleton width="55%" height={13} sx={{ mb: 0.5 }} />
      <Skeleton width="80%" height={11} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminMessenger() {
  const { dark } = useDark();
  const { enqueueSnackbar } = useSnackbar();
  const adminId   = useRef(null);
  const chRef     = useRef(null);
  const endRef    = useRef(null);
  const areaRef   = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);
  const selRef    = useRef(null);
  const atBot     = useRef(true);

  const [convs, setConvs]           = useState([]);
  const [sel, setSel]               = useState(null);
  const [msgs, setMsgs]             = useState([]);
  const [hasMore, setHasMore]       = useState(false);
  const [offset, setOffset]         = useState(0);
  const [ldConvs, setLdConvs]       = useState(true);
  const [ldMsgs, setLdMsgs]         = useState(false);
  const [ldMore, setLdMore]         = useState(false);
  const [sending, setSending]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [text, setText]             = useState('');
  const [search, setSearch]         = useState('');
  const [dSearch, setDSearch]       = useState('');
  const [showDown, setShowDown]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [newDlg, setNewDlg]         = useState(false);
  const [allUsers, setAllUsers]     = useState([]);
  const [ldUsers, setLdUsers]       = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);


  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      adminId.current = user?.id || null;
    });
    loadConvs();
    setupRT();
    return () => chRef.current?.unsubscribe();
  }, []);

  useEffect(() => { selRef.current = sel; }, [sel]);

  useEffect(() => { if (atBot.current) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConvs = async () => {
    setLdConvs(true);
    try {
      const { data: convData, error } = await supabase
        .from('chat_conversations')
        .select('id, user_id, status, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles separately (no FK hint needed)
      const userIds = [...new Set((convData || []).map(c => c.user_id).filter(Boolean))];
      let profileMap = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles')
          .select('id, first_name, last_name, email, avatar_url, is_blocked')
          .in('id', userIds);
        (profs || []).forEach(p => { profileMap[p.id] = p; });
      }
      // Déduplication par user_id : garder uniquement la conv la plus récente par user
      const seenUsers = new Set();
      const dedupedConvs = (convData || []).filter(c => {
        if (!c.user_id || seenUsers.has(c.user_id)) return false;
        seenUsers.add(c.user_id); return true;
      });
      const data = dedupedConvs.map(c => ({ ...c, profile: profileMap[c.user_id] || null }));

      const ids = (data || []).map(c => c.id);
      let unreadMap = {};
      if (ids.length && adminId.current) {
        const { data: ur } = await supabase.from('chat_messages')
          .select('conversation_id').in('conversation_id', ids)
          .eq('is_read', false).neq('sender_id', adminId.current);
        (ur || []).forEach(r => { unreadMap[r.conversation_id] = (unreadMap[r.conversation_id] || 0) + 1; });
      }

      const withMeta = await Promise.all((data || []).map(async c => {
        const { data: lm } = await supabase.from('chat_messages').select('message,sender_id,created_at')
          .eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        return { ...c, unread: unreadMap[c.id] || 0, lastMsg: lm || null };
      }));
      setConvs(withMeta);
    } catch (e) {
      console.error('[AdminMessenger] loadConvs', e);
    } finally { setLdConvs(false); }
  };

  // ── Realtime ────────────────────────────────────────────────────────────────
  const setupRT = useCallback(() => {
    chRef.current?.unsubscribe();
    chRef.current = supabase.channel('admin-messenger-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: m }) => {
        if (!m) return;
        const s = selRef.current;
        if (s?.id === m.conversation_id) {
          setMsgs(p => p.some(x => x.id === m.id) ? p : [...p, m]);
          if (m.sender_id !== adminId.current)
            supabase.from('chat_messages').update({ is_read: true }).eq('id', m.id).then(() => {});
        }
        setConvs(p => p.map(c => c.id !== m.conversation_id ? c : {
          ...c,
          lastMsg: { message: m.message, sender_id: m.sender_id, created_at: m.created_at },
          unread: m.sender_id !== adminId.current && s?.id !== m.conversation_id
            ? (c.unread || 0) + 1 : c.unread,
          updated_at: m.created_at,
        }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversations' }, loadConvs)
      .subscribe();
  }, []);

  // ── Load messages ───────────────────────────────────────────────────────────
  const loadMsgs = useCallback(async (conv, off = 0) => {
    if (!conv) return;
    off === 0 ? setLdMsgs(true) : setLdMore(true);
    try {
      const { data, error } = await supabase.from('chat_messages').select('*')
        .eq('conversation_id', conv.id).order('created_at', { ascending: false })
        .range(off, off + MSG_PAGE - 1);
      if (error) throw error;
      const ordered = (data || []).reverse();
      if (off === 0) { setMsgs(ordered); setOffset(ordered.length); atBot.current = true; }
      else { setMsgs(p => [...ordered, ...p]); setOffset(o => o + ordered.length); }
      setHasMore((data || []).length === MSG_PAGE);

      if (adminId.current) {
        const ids = (data || []).filter(m => !m.is_read && m.sender_id !== adminId.current).map(m => m.id);
        if (ids.length) {
          await supabase.from('chat_messages').update({ is_read: true }).in('id', ids);
          setConvs(p => p.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
        }
      }
    } catch (e) {
      console.error('[AdminMessenger] loadMsgs', e);
    } finally { setLdMsgs(false); setLdMore(false); }
  }, []);

  const selectConv = useCallback(async (conv) => {
    setMenuOpen(false);
    setSel(conv); setMsgs([]); setOffset(0); setHasMore(false);
    await loadMsgs(conv, 0);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [loadMsgs]);

  // ── Send ─────────────────────────────────────────────────────────────────────
  const sendMsg = async (content) => {
    if (!sel?.id || !content?.trim() || !adminId.current) return;
    const tmp = `tmp-${Date.now()}`;
    setMsgs(p => [...p, { id: tmp, conversation_id: sel.id, sender_id: adminId.current,
      message: content, is_read: false, created_at: new Date().toISOString(), _pending: true }]);
    try {
      const { data, error } = await supabase.from('chat_messages')
        .insert({ conversation_id: sel.id, sender_id: adminId.current, message: content, is_read: false })
        .select().single();
      if (error) throw error;
      setMsgs(p => p.map(m => m.id === tmp ? data : m));
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', sel.id);
      // Push notification is handled by SQL trigger trg_chat_message_created
    } catch (e) {
      setMsgs(p => p.filter(m => m.id !== tmp));
      enqueueSnackbar('Erreur envoi', { variant: 'error' });
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !sel || sending) return;
    setSending(true);
    const c = text.trim(); setText('');
    await sendMsg(c);
    setSending(false);
  };

  const downloadImg = async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = url.split('?')[0].split('.').pop() || 'jpg';
      a.download = `image-${Date.now()}.${ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch { enqueueSnackbar('Erreur téléchargement', { variant: 'error' }); }
  };

  const handleImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sel || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: ue } = await supabase.storage.from('chat-images').upload(path, file, { contentType: file.type });
      if (ue) throw ue;
      const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
      await sendMsg(data.publicUrl);
    } catch (err) {
      console.error('[Upload]', err);
      enqueueSnackbar(`Erreur upload: ${err?.message || 'inconnue'}`, { variant: 'error' });
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const toggleBlock = async () => {
    if (!sel?.profile) return;
    const blocked = sel.profile.is_blocked;
    try {
      const { error } = await supabase.from('profiles').update({
        is_blocked: !blocked,
        blocked_at: !blocked ? new Date().toISOString() : null,
        blocked_by: !blocked ? adminId.current : null,
      }).eq('id', sel.user_id);
      if (error) throw error;
      const upd = { ...sel, profile: { ...sel.profile, is_blocked: !blocked } };
      setSel(upd);
      setConvs(p => p.map(c => c.id === sel.id ? upd : c));
      enqueueSnackbar(!blocked ? 'Utilisateur bloqué' : 'Débloqué', { variant: 'success' });
      setMenuOpen(false);
    } catch { enqueueSnackbar('Erreur', { variant: 'error' }); }
  };

  const openNewConv = async () => {
    setNewDlg(true);
    setUserSearch('');
    setLdUsers(true);
    try {
      const { data: profiles } = await supabase.from('profiles')
        .select('id, first_name, last_name, email, avatar_url')
        .or('role.is.null,role.eq.client')
        .order('created_at', { ascending: false })
        .limit(200);
      // Déduplication par id
      const seen = new Set();
      const unique = (profiles || []).filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      const existingUserIds = new Set(convs.map(c => c.user_id));
      setAllUsers(unique.filter(p => !existingUserIds.has(p.id)));
    } catch (e) {
      console.error('[AdminMessenger] loadUsers', e);
    } finally { setLdUsers(false); }
  };

  const createConvWith = async (userId) => {
    setNewDlg(false);
    try {
      const { data: existing } = await supabase.from('chat_conversations')
        .select('id').eq('user_id', userId).maybeSingle();
      if (existing) {
        const found = convs.find(c => c.id === existing.id);
        if (found) { selectConv(found); return; }
      }
      const { data: conv, error } = await supabase.from('chat_conversations')
        .insert({ user_id: userId, status: 'active' })
        .select('id, user_id, status, updated_at')
        .single();
      if (error) throw error;
      // Fetch profile separately
      const { data: prof } = await supabase.from('profiles')
        .select('id, first_name, last_name, email, avatar_url, is_blocked')
        .eq('id', userId).maybeSingle();
      const newConv = { ...conv, profile: prof || null, unread: 0, lastMsg: null };
      setConvs(p => [newConv, ...p]);
      selectConv(newConv);
      enqueueSnackbar('Conversation cr\u00e9\u00e9e', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Erreur cr\u00e9ation conversation', { variant: 'error' });
      console.error(e);
    }
  };

  const onScroll = () => {
    const el = areaRef.current; if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBot.current = dist < 80; setShowDown(dist > 150);
  };

  const filtered = useMemo(() => {
    if (!dSearch) return convs;
    const q = dSearch.toLowerCase();
    return convs.filter(c =>
      getName(c.profile).toLowerCase().includes(q) ||
      (c.profile?.email || '').toLowerCase().includes(q) ||
      (c.lastMsg?.message || '').toLowerCase().includes(q));
  }, [convs, dSearch]);

  const totalUnread = convs.reduce((s, c) => s + (c.unread || 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div onClick={() => menuOpen && setMenuOpen(false)}
      className={`flex overflow-hidden -m-6 h-[calc(100vh-64px)] relative ${dark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* SIDEBAR */}
      <div
        style={{ width: sidebarOpen ? 300 : 0, flexShrink: 0, transition: 'width .22s ease' }}
        className={`flex flex-col overflow-hidden border-r ${dark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
      >
        <div className={`shrink-0 p-3 border-b ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <MessageCircle size={18} color="#667eea" />
            <span className="font-bold text-[15px]">Messages</span>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-px">{totalUnread}</span>
            )}
            <span className="flex-1" />
            <IconButton size="small" onClick={openNewConv} title="Nouvelle conversation"
              sx={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'#fff', width:28, height:28,
                '&:hover':{ background:'linear-gradient(135deg,#5a67d8,#6b46c1)' } }}>
              <Plus size={15} />
            </IconButton>
          </div>
        </div>

        <div className="px-3 py-2 shrink-0">
          <TextField fullWidth size="small" placeholder="Rechercher..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={15} color="#94a3b8" /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}><X size={13} /></IconButton>
              </InputAdornment> : null,
              sx: { borderRadius: 2.5, background: '#f8fafc', fontSize: 13 },
            }} />
        </div>
        <Divider />

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
          {ldConvs ? Array.from({ length: 7 }).map((_, i) => <ConvSkeleton key={i} />)
            : filtered.length === 0
              ? <div className="p-8 text-center text-slate-400">
                  <MessageCircle size={36} style={{ opacity: 0.2, margin: '0 auto 8px' }} />
                  <p className="text-sm">{dSearch ? 'Aucun résultat' : 'Aucune conversation'}</p>
                </div>
              : filtered.map(conv => (
                <div key={conv.id}
                  onClick={() => selectConv(conv)}
                  className={`flex items-center px-3.5 py-2.5 cursor-pointer border-b shrink-0 transition-colors duration-100
                    ${dark ? 'border-slate-700' : 'border-slate-100'}
                    ${sel?.id === conv.id ? (dark ? 'bg-indigo-900/40' : 'bg-violet-50') : conv.unread > 0 ? (dark ? 'bg-purple-900/30' : 'bg-purple-50') : (dark ? 'hover:bg-slate-700' : 'hover:bg-slate-50')}`}>
                  <Badge badgeContent={conv.unread || 0} color="error" overlap="circular"
                    sx={{ '& .MuiBadge-badge': { fontSize: 9, minWidth: 15, height: 15 } }}>
                    <Avatar src={conv.profile?.avatar_url}
                      sx={{ width: 42, height: 42, fontSize: 13, background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0 }}>
                      {getInitials(conv.profile)}
                    </Avatar>
                  </Badge>
                  <div className="flex-1 min-w-0 ml-3">
                    <div className="flex justify-between">
                      <span className={`text-[13px] truncate ${conv.unread > 0 ? 'font-bold' : 'font-medium'}`}>
                        {getName(conv.profile)}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-1">
                        {fmtTime(conv.lastMsg?.created_at || conv.updated_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-400 truncate">
                      {conv.lastMsg ? (isImageUrl(conv.lastMsg.message) ? '📷 Photo' : conv.lastMsg.message) : 'Aucun message'}
                    </p>
                    {conv.profile?.is_blocked && (
                      <span className="text-[9px] text-red-500 border border-red-200 rounded px-1">Bloqué</span>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* MAIN */}
      <div className={`flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden relative ${dark ? 'bg-slate-900' : 'bg-white'}`}>
        {sel ? (
          <>
            {/* Header */}
            <div className={`flex items-center px-4 py-2.5 shrink-0 border-b min-h-[60px] ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
              <IconButton size="small" onClick={() => setSidebarOpen(o => !o)}
                title={sidebarOpen ? 'Masquer contacts' : 'Afficher contacts'}
                sx={{ mr: 1, color: '#94a3b8', flexShrink: 0 }}>
                {sidebarOpen ? <X size={16} /> : <MessageCircle size={16} color="#667eea" />}
              </IconButton>
              <Avatar src={sel.profile?.avatar_url}
                sx={{ width: 36, height: 36, fontSize: 12, background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0 }}>
                {getInitials(sel.profile)}
              </Avatar>
              <div className="flex-1 min-w-0 ml-3">
                <p className="font-bold text-[14px] truncate">{getName(sel.profile)}</p>
                <p className="text-[12px] text-slate-400 truncate">
                  {sel.profile?.email || ''}
                  {sel.profile?.is_blocked && <span className="text-red-500 ml-1">· Bloqué</span>}
                </p>
              </div>
              <div className="relative shrink-0">
                <IconButton size="small" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}>
                  <MoreVertical size={17} />
                </IconButton>
                {menuOpen && (
                  <Paper elevation={8} onClick={e => e.stopPropagation()}
                    sx={{ position:'absolute', right:0, top:34, zIndex:99, minWidth:170, borderRadius:2, overflow:'hidden' }}>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={toggleBlock}>
                      {sel.profile?.is_blocked
                        ? <><UserCheck size={15} color="#10b981" /><span className="text-[13px] text-emerald-500">Débloquer</span></>
                        : <><UserX size={15} color="#ef4444" /><span className="text-[13px] text-red-500">Bloquer</span></>}
                    </div>
                  </Paper>
                )}
              </div>
            </div>
            <Divider />

            {hasMore && (
              <div className="text-center py-2 shrink-0">
                <Chip label={ldMore ? '...' : 'Charger plus'} size="small" variant="outlined"
                  onClick={() => !ldMore && loadMsgs(sel, offset)}
                  sx={{ cursor: 'pointer', fontSize: 12 }} />
              </div>
            )}

            {/* Messages */}
            <div ref={areaRef} onScroll={onScroll}
              className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4 flex flex-col gap-1.5 overscroll-contain"
              style={{ background: dark ? '#0f172a' : 'linear-gradient(180deg,#f8fafc 0%,#fff 100%)' }}>
              {ldMsgs
                ? <div className="p-4 flex flex-col gap-2">
                    <Skeleton width="60%" height={40} sx={{ borderRadius: 3, ml: 'auto' }} />
                    <Skeleton width="70%" height={40} sx={{ borderRadius: 3 }} />
                    <Skeleton width="50%" height={40} sx={{ borderRadius: 3, ml: 'auto' }} /></div>
                : msgs.length === 0
                  ? <div className="flex flex-col items-center justify-center flex-1 p-8 text-slate-400">
                      <MessageCircle size={40} style={{ opacity: 0.15, marginBottom: 8 }} />
                      <p className="text-sm">Aucun message. Envoyez le premier !</p>
                    </div>
                  : msgs.map(msg => {
                      const isAdmin = msg.sender_id === adminId.current;
                      return (
                        <div key={msg.id} style={{ animation: 'msgIn .18s ease' }}
                          className={`flex items-end gap-1.5 max-w-[75%] shrink-0 ${isAdmin ? 'self-end flex-row-reverse' : 'self-start'}`}>
                          {!isAdmin && (
                            <Avatar src={sel.profile?.avatar_url}
                              sx={{ width: 28, height: 28, fontSize: 10, background: '#667eea', alignSelf: 'flex-end', flexShrink: 0 }}>
                              {getInitials(sel.profile)}
                            </Avatar>
                          )}
                          <div style={{ opacity: msg._pending ? 0.65 : 1 }}
                            className={`px-3 py-2 rounded-[18px] max-w-full break-words shadow-sm relative group
                              ${isAdmin ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-br-[4px]'
                                        : dark ? 'bg-slate-700 text-slate-100 rounded-bl-[4px]' : 'bg-slate-100 text-slate-900 rounded-bl-[4px]'}`}>
                            {isImageUrl(msg.message)
                              ? <div className="relative inline-block">
                                  <img src={msg.message} alt="img"
                                    style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, display: 'block', cursor: 'pointer' }}
                                    onClick={() => window.open(msg.message, '_blank')}
                                    onError={e => { e.target.style.display = 'none'; }} />
                                  <span
                                    className="am-dl-btn"
                                    onClick={e => { e.stopPropagation(); downloadImg(msg.message); }}
                                    style={{ position: 'absolute', top: 4, right: 4,
                                      background: 'rgba(0,0,0,0.55)', borderRadius: '50%',
                                      width: 26, height: 26, display: 'flex', alignItems: 'center',
                                      justifyContent: 'center', opacity: 0, transition: 'opacity .2s', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.55)'} role="button">
                                    <Download size={13} color="#fff" />
                                  </span>
                                </div>
                              : <p className="text-[13.5px] whitespace-pre-wrap break-words">{msg.message}</p>}
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] opacity-65">{fmtTime(msg.created_at)}</span>
                              {isAdmin && (msg._pending
                                ? <span className="text-[10px] opacity-50">⏳</span>
                                : msg.is_read ? <CheckCheck size={12} color="#a5b4fc" /> : null)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
              <div ref={endRef} />
            </div>

            {showDown && (
              <button
                onClick={() => { atBot.current = true; endRef.current?.scrollIntoView({ behavior:'smooth' }); }}
                className="absolute bottom-[76px] right-5 w-8 h-8 rounded-full bg-[#667eea] text-white flex items-center justify-center cursor-pointer text-base z-10 shadow-lg hover:scale-110 transition-transform border-0"
              >↓</button>
            )}

            {/* Input */}
            <div className={`flex items-end gap-2 px-3.5 py-2.5 border-t shrink-0 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImg} />
              <IconButton size="small" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <CircularProgress size={16} /> : <Paperclip size={18} color="#64748b" />}
              </IconButton>
              <TextField
                fullWidth multiline maxRows={4} size="small" placeholder="Tapez un message..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                inputRef={inputRef}
                disabled={sending}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, fontSize: 13 } }}
              />
              <IconButton
                onClick={handleSend}
                disabled={!text.trim() || sending}
                sx={{ background: text.trim() && !sending ? 'linear-gradient(135deg,#667eea,#764ba2)' : undefined,
                  color: text.trim() && !sending ? '#fff' : undefined,
                  borderRadius: 2, '&:hover': { background: 'linear-gradient(135deg,#5a67d8,#6b46c1)' } }}>
                {sending ? <CircularProgress size={18} color="inherit" /> : <Send size={18} />}
              </IconButton>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <MessageCircle size={56} style={{ opacity: 0.15 }} />
            <p className="text-lg font-semibold text-slate-300">Sélectionnez une conversation</p>
            <p className="text-sm text-slate-300">Choisissez un utilisateur dans la liste</p>
          </div>
        )}
      </div>

      {/* NEW CONVERSATION DIALOG */}
      {newDlg && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setNewDlg(false)}>
          <div className={`rounded-2xl shadow-2xl w-[400px] max-w-[92vw] max-h-[70vh] flex flex-col overflow-hidden ${dark ? 'bg-slate-800' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? 'border-slate-700' : 'border-slate-100'}`}>
              <span className="font-bold text-[15px]">Nouvelle conversation</span>
              <IconButton size="small" onClick={() => setNewDlg(false)}><X size={16} /></IconButton>
            </div>
            <div className="px-4 py-3">
              <TextField fullWidth size="small" placeholder="Rechercher un utilisateur..."
                value={userSearch} onChange={e => setUserSearch(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search size={14} color="#94a3b8" /></InputAdornment>,
                  sx: { borderRadius: 2, fontSize: 13 },
                }} />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[340px]">
              {ldUsers ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2">
                  <Skeleton variant="circular" width={36} height={36} />
                  <div className="flex-1"><Skeleton width="60%" height={13} /><Skeleton width="80%" height={11} /></div>
                </div>
              )) : (() => {
                const q = userSearch.toLowerCase();
                const list = q ? allUsers.filter(u =>
                  getName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                ) : allUsers;
                return list.length === 0
                  ? <div className="p-6 text-center text-slate-400 text-sm">
                      {allUsers.length === 0 ? 'Tous les utilisateurs ont déjà une conversation' : 'Aucun résultat'}
                    </div>
                  : list.map(u => (
                    <div key={u.id} className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${dark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`}
                      onClick={() => createConvWith(u.id)}>
                      <Avatar src={u.avatar_url}
                        sx={{ width: 36, height: 36, fontSize: 12, background: 'linear-gradient(135deg,#667eea,#764ba2)', flexShrink: 0 }}>
                        {getInitials(u)}
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">{getName(u)}</p>
                        <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
