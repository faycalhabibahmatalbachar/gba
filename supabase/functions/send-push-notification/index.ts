import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Base64URL encode ──────────────────────────────────────────────────
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ADMIN_ID is used as a fallback placeholder; all admin lookups now use DB roles
const FCM_V1_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

// ── i18n translations ────────────────────────────────────────────────
type Lang = 'fr' | 'en' | 'ar';
const t: Record<string, Record<Lang, string>> = {
  new_product_title:        { fr: 'Nouveau produit disponible !',       en: 'New product available!',           ar: 'منتج جديد متاح!' },
  new_product_body:         { fr: '{name} vient d\'être ajouté',        en: '{name} has just been added',       ar: 'تمت إضافة {name}' },
  new_order_title:          { fr: 'Nouvelle commande !',                en: 'New order!',                       ar: 'طلب جديد!' },
  new_order_body:           { fr: 'Commande #{num} - {amount} FCFA',    en: 'Order #{num} - {amount} FCFA',     ar: 'طلب #{num} - {amount} FCFA' },
  order_update_title:       { fr: 'Mise à jour de votre commande',      en: 'Order update',                     ar: 'تحديث طلبك' },
  order_update_body:        { fr: 'Commande #{num} est {status}',       en: 'Order #{num} is {status}',         ar: 'الطلب #{num} أصبح {status}' },
  status_confirmed:         { fr: 'confirmée',       en: 'confirmed',        ar: 'مؤكد' },
  status_pending:           { fr: 'en attente',      en: 'pending',          ar: 'في انتظار التأكيد' },
  status_processing:        { fr: 'en cours de traitement', en: 'processing',   ar: 'قيد المعالجة' },
  status_preparing:         { fr: 'en préparation',  en: 'being prepared',   ar: 'قيد التحضير' },
  status_ready:             { fr: 'prête',           en: 'ready',            ar: 'جاهز' },
  status_shipped:           { fr: 'expédiée',        en: 'shipped',          ar: 'تم الشحن' },
  status_out_for_delivery:  { fr: 'en livraison',   en: 'out for delivery',  ar: 'في طريق التوصيل' },
  status_delivered:         { fr: 'livrée',          en: 'delivered',        ar: 'تم التوصيل' },
  status_cancelled:         { fr: 'annulée',         en: 'cancelled',        ar: 'ملغى' },
  status_refunded:          { fr: 'remboursée',      en: 'refunded',         ar: 'تم الاسترداد' },
  chat_support_title:       { fr: 'Nouveau message du support',         en: 'New support message',              ar: 'رسالة جديدة من الدعم' },
  chat_support_body:        { fr: 'Vous avez un nouveau message',       en: 'You have a new message',           ar: 'لديك رسالة جديدة' },
  chat_from_title:          { fr: 'Message de {name}',                  en: 'Message from {name}',              ar: 'رسالة من {name}' },
  chat_new_body:            { fr: 'Nouveau message',                    en: 'New message',                      ar: 'رسالة جديدة' },
  delivery_pickup_title:    { fr: 'Commande en cours de livraison',     en: 'Order out for delivery',           ar: 'الطلب في طريقه إليك' },
  delivery_pickup_body:     { fr: 'Votre commande #{num} est en route !', en: 'Your order #{num} is on its way!', ar: 'طلبك #{num} في الطريق!' },
  delivery_done_title:      { fr: 'Commande livrée !',                  en: 'Order delivered!',                 ar: 'تم توصيل الطلب!' },
  delivery_done_body:       { fr: 'La commande #{num} a été livrée avec succès', en: 'Order #{num} has been delivered successfully', ar: 'تم توصيل الطلب #{num} بنجاح' },
  driver_assigned_title:    { fr: 'Livreur assigné !',                  en: 'Driver assigned!',                 ar: 'تم تعيين سائق!' },
  driver_assigned_body:     { fr: 'Un livreur a été assigné à votre commande #{num}', en: 'A driver has been assigned to your order #{num}', ar: 'تم تعيين سائق لطلبك #{num}' },
  driver_new_order_title:   { fr: '📦 Nouvelle livraison !',              en: '📦 New delivery!',                  ar: '📦 توصيل جديد!' },
  driver_new_order_body:    { fr: 'Commande #{num} vous a été assignée', en: 'Order #{num} has been assigned to you', ar: 'تم تعيين الطلب #{num} لك' },
  banner_title:             { fr: 'Nouvelle promotion !',               en: 'New promotion!',                   ar: 'عرض جديد!' },
  banner_body:              { fr: 'Découvrez notre nouvelle offre',     en: 'Check out our new offer',          ar: 'اكتشف عرضنا الجديد' },
  special_order_title:      { fr: 'Mise à jour commande spéciale',      en: 'Special order update',             ar: 'تحديث الطلب الخاص' },
  special_order_body:       { fr: 'Votre commande spéciale #{num} est {status}', en: 'Your special order #{num} is {status}', ar: 'طلبك الخاص #{num} أصبح {status}' },
  fallback_title:           { fr: 'Notification',                       en: 'Notification',                     ar: 'إشعار' },
  client:                   { fr: 'Client',                             en: 'Customer',                         ar: 'عميل' },
};

function tr(key: string, lang: Lang, params?: Record<string, string>): string {
  let text = t[key]?.[lang] ?? t[key]?.['fr'] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, v);
    }
  }
  return text;
}

function resolveLang(pref?: string | null): Lang {
  if (pref === 'en') return 'en';
  if (pref === 'ar') return 'ar';
  return 'fr';
}

// ── OAuth2 Access Token via Service Account JWT ──────────────────────
async function getAccessToken(): Promise<string> {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) throw new Error('MISSING_FIREBASE_SERVICE_ACCOUNT');

  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(new TextEncoder().encode(JSON.stringify({
    alg: 'RS256', typ: 'JWT',
  })));

  const claims = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: FCM_V1_SCOPE,
  })));

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );

  const sigInput = new TextEncoder().encode(`${header}.${claims}`);
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, sigInput);
  const signature = base64url(new Uint8Array(sigBuffer));

  const jwt = `${header}.${claims}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(`OAUTH2_TOKEN_ERROR: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// ── Send a single FCM v1 message ─────────────────────────────────────
async function sendFcmV1(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token,
      notification: { title, body },
      data,
      android: {
        priority: 'HIGH' as const,
        ttl: '86400s',
        notification: {
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          channel_id: 'high_importance_channel',
        },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1,
            'mutable-content': 1,
          },
        },
        fcm_options: { analytics_label: 'gba_push' },
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: { icon: '/icons/icon-192x192.png' },
      },
    },
  };

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (resp.ok) return { success: true };

      const errBody = await resp.json().catch(() => ({}));
      const errCode = errBody?.error?.details?.[0]?.errorCode ??
                      errBody?.error?.status ?? '';
      const errMsg = errBody?.error?.message ?? resp.statusText;

      // Retry on rate-limit or server errors
      if (attempt < maxRetries && (resp.status === 429 || resp.status >= 500)) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      return { success: false, error: errMsg, errorCode: errCode };
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return { success: false, error: String(e), errorCode: 'NETWORK_ERROR' };
    }
  }
  return { success: false, error: 'Max retries exceeded', errorCode: 'MAX_RETRIES' };
}

// ── Logging helper ───────────────────────────────────────────────────
async function logNotification(
  supabase: ReturnType<typeof createClient>,
  params: {
    user_id?: string;
    device_token?: string;
    event_type: string;
    title?: string;
    body?: string;
    data?: Record<string, string>;
    status: 'sent' | 'failed' | 'invalid_token' | 'no_tokens';
    fcm_response?: string;
    platform?: string;
    locale?: string;
  },
) {
  try {
    await supabase.from('notification_logs').insert({
      user_id: params.user_id || null,
      device_token: params.device_token ? params.device_token.substring(0, 32) + '...' : null,
      event_type: params.event_type,
      title: params.title || null,
      body: params.body || null,
      data: params.data || {},
      status: params.status,
      fcm_response: params.fcm_response || null,
      platform: params.platform || null,
      locale: params.locale || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    });
  } catch (e) {
    console.error('[LOG] Failed to write notification_log:', e);
  }
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
    'Access-Control-Max-Age': '86400',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // ── GET /send-push-notification → Diagnostic endpoint ──────────────
  if (req.method === 'GET') {
    const diagnostics: Record<string, unknown> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check FIREBASE_SERVICE_ACCOUNT
    const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saRaw) {
      diagnostics.checks = {
        ...diagnostics.checks as object,
        firebase_service_account: '❌ MISSING — Notifications cannot be sent!',
      };
      diagnostics.status = 'error';
    } else {
      try {
        let raw = saRaw.trim();
        if (raw.startsWith('"') && raw.endsWith('"')) {
          try { const p = JSON.parse(raw); if (typeof p === 'string') raw = p; } catch {}
        }
        const sa = JSON.parse(raw);
        diagnostics.checks = {
          ...diagnostics.checks as object,
          firebase_service_account: '✅ Present',
          project_id: sa.project_id || '❌ Missing project_id',
          client_email: sa.client_email ? `✅ ${sa.client_email}` : '❌ Missing client_email',
          private_key: sa.private_key ? '✅ Present (hidden)' : '❌ Missing private_key',
        };
      } catch (e) {
        diagnostics.checks = {
          ...diagnostics.checks as object,
          firebase_service_account: `❌ Invalid JSON: ${String(e).substring(0, 100)}`,
        };
        diagnostics.status = 'error';
      }
    }

    // Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    diagnostics.checks = {
      ...diagnostics.checks as object,
      supabase_url: Deno.env.get('SUPABASE_URL') ? '✅ Present' : '❌ MISSING',
      supabase_service_role_key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ? '✅ Present' : '❌ MISSING',
    };

    // Check device_tokens count
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

      const { count: tokenCount } = await supabase
        .from('device_tokens')
        .select('*', { count: 'exact', head: true });

      diagnostics.checks = {
        ...diagnostics.checks as object,
        device_tokens_count: tokenCount ?? 0,
      };

      // Check notification_logs recent entries
      const { data: recentLogs } = await supabase
        .from('notification_logs')
        .select('event_type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      diagnostics.checks = {
        ...diagnostics.checks as object,
        recent_notification_logs: recentLogs || [],
      };
    } catch (e) {
      diagnostics.checks = {
        ...diagnostics.checks as object,
        database: `❌ Error: ${String(e).substring(0, 100)}`,
      };
    }

    // Try to get an access token (validates the service account)
    if (saRaw) {
      try {
        const accessToken = await getAccessToken();
        diagnostics.checks = {
          ...diagnostics.checks as object,
          fcm_auth: accessToken ? '✅ OAuth2 token obtained successfully' : '❌ No token',
        };
      } catch (e) {
        diagnostics.checks = {
          ...diagnostics.checks as object,
          fcm_auth: `❌ Failed: ${String(e).substring(0, 200)}`,
        };
        diagnostics.status = 'error';
      }
    }

    return new Response(
      JSON.stringify(diagnostics, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── POST: Handle push notification request ─────────────────────────
  try {
    const rawBody = await req.text();
    const cleaned = rawBody.replace(/^\uFEFF/, '').trim();
    let payload: Record<string, unknown> = {};
    try {
      if (!cleaned) {
        payload = {};
      } else {
        const parsed = JSON.parse(cleaned) as unknown;
        payload = typeof parsed === 'string' ? (JSON.parse(parsed) as Record<string, unknown>) : (parsed as Record<string, unknown>);
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body', hint: 'Send raw JSON with Content-Type: application/json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { type, record, old_record } = payload;

    console.log(`[PUSH] ── Event: type=${type} ──`);

    // ── Parse FIREBASE_SERVICE_ACCOUNT ────────────────────────────────
    const saRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!saRaw) {
      console.error('[PUSH] ❌ FIREBASE_SERVICE_ACCOUNT secret is MISSING');
      return new Response(JSON.stringify({
        error: 'Missing FIREBASE_SERVICE_ACCOUNT secret',
        hint: 'Set it in Supabase Dashboard > Edge Functions > Secrets (see docs/FCM_V1_SETUP.md)',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sa: { project_id?: string; client_email?: string; private_key?: string };
    let raw = saRaw.trim();
    if (raw.startsWith('"') && raw.endsWith('"')) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'string') raw = parsed;
      } catch {
        /* keep raw */
      }
    }
    try {
      sa = JSON.parse(raw) as typeof sa;
    } catch {
      try {
        const b64url = raw.replace(/\s/g, '');
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
        const decoded = atob(b64);
        sa = JSON.parse(decoded) as typeof sa;
      } catch {
        console.error('[PUSH] ❌ FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64');
        return new Response(
          JSON.stringify({
            error: 'Invalid FIREBASE_SERVICE_ACCOUNT secret',
            hint: 'Paste raw JSON in Dashboard > Secrets (see docs/FCM_V1_SETUP.md)',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const projectId = sa.project_id!;
    console.log(`[PUSH] Firebase project: ${projectId}`);

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log('[PUSH] ✅ OAuth2 access token obtained');
    } catch (e) {
      console.error(`[PUSH] ❌ OAuth2 token failed: ${e}`);
      return new Response(
        JSON.stringify({ error: `FCM authentication failed: ${String(e)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ── Resolve notification template + target users ─────────────────
    let templateKey = '';
    let targetUserIds: string[] = [];
    let data: Record<string, string> = {};
    let templateParams: Record<string, string> = {};
    let senderName = '';

    switch (type) {
      case 'product_added': {
        templateKey = 'new_product';
        templateParams = { name: record?.name ?? '' };
        data = { route: '/home', category: 'product', template: 'new_product' };
        // Notify all non-admin users
        const { data: adminIds } = await supabase.from('profiles').select('id').eq('role', 'admin');
        const adminIdSet = new Set((adminIds ?? []).map((p: any) => p.id as string));
        const { data: allUsers } = await supabase.from('device_tokens').select('user_id');
        targetUserIds = [...new Set(
          (allUsers ?? [])
            .map((u: any) => u.user_id as string)
            .filter((id) => !adminIdSet.has(id))
        )];
        console.log(`[PUSH] product_added → ${targetUserIds.length} target users`);
        break;
      }

      case 'order_created': {
        templateKey = 'new_order';
        templateParams = {
          num: record?.order_number ?? record?.id ?? '',
          amount: String(record?.total_amount ?? 0),
        };
        data = { route: '/orders', category: 'order', template: 'new_order' };
        // Notify all admin users dynamically
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');
        targetUserIds = (adminProfiles ?? []).map((p: any) => p.id as string);
        console.log(`[PUSH] order_created → notify ${targetUserIds.length} admin(s)`);
        break;
      }

      case 'order_status_changed': {
        templateKey = 'order_update';
        templateParams = {
          num: record?.order_number ?? record?.id ?? '',
        };
        data = { route: '/orders', category: 'order', template: 'order_update', status: record?.status ?? '' };
        if (record?.user_id) targetUserIds = [record.user_id];
        console.log(`[PUSH] order_status_changed → user=${record?.user_id} status=${record?.status}`);
        break;
      }

      case 'chat_message': {
        const senderId = record?.sender_id;
        if (!senderId) {
          console.log('[PUSH] chat_message → no sender_id, skipping');
          break;
        }

        // Resolve sender role to decide direction (admin→user or user→admins)
        const { data: senderProfile } = await supabase
          .from('profiles')
          .select('role, first_name, last_name')
          .eq('id', senderId)
          .single();
        const senderRole = senderProfile?.role ?? 'user';

        if (senderRole === 'admin') {
          // Admin sent → notify the conversation's user
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('user_id')
            .eq('id', record?.conversation_id)
            .single();
          if (conv?.user_id) targetUserIds = [conv.user_id];
          templateKey = 'chat_support';
        } else {
          // User/driver sent → notify all admins
          const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');
          targetUserIds = (adminProfiles ?? []).map((p: any) => p.id as string);
          senderName = senderProfile
            ? `${senderProfile.first_name ?? ''} ${senderProfile.last_name ?? ''}`.trim() || ''
            : '';
          templateKey = 'chat_from';
        }
        data = { route: '/messages', category: 'chat', template: 'new_message', conversation_id: String(record?.conversation_id ?? '') };
        console.log(`[PUSH] chat_message → sender=${senderId} role=${senderRole}, targets=${targetUserIds.length}`);
        break;
      }

      case 'new_message': {
        // new_message: direct push to a specific user (admin sends to user)
        if (record?.user_id) {
          targetUserIds = [record.user_id];
          templateKey = 'chat_support';
        } else if (record?.conversation_id) {
          // Fallback: look up conversation user_id
          const { data: conv } = await supabase
            .from('chat_conversations')
            .select('user_id')
            .eq('id', record.conversation_id)
            .single();
          if (conv?.user_id) targetUserIds = [conv.user_id];
          templateKey = 'chat_support';
        }
        data = { route: '/messages', category: 'chat', template: 'new_message', conversation_id: String(record?.conversation_id ?? '') };
        console.log(`[PUSH] new_message → user=${record?.user_id ?? 'resolved'} (${targetUserIds.length} targets)`);
        break;
      }

      case 'delivery_picked_up': {
        if (record?.user_id) targetUserIds = [record.user_id];
        templateKey = 'delivery_pickup';
        templateParams = { num: record?.order_number ?? record?.id ?? '' };
        data = { route: '/orders', category: 'delivery', template: 'delivery_picked_up' };
        console.log(`[PUSH] delivery_picked_up → user=${record?.user_id}`);
        break;
      }

      case 'delivery_completed': {
        if (record?.user_id) targetUserIds.push(record.user_id as string);
        // Also notify all admins
        const { data: adminProfiles } = await supabase.from('profiles').select('id').eq('role', 'admin');
        for (const p of (adminProfiles ?? [])) targetUserIds.push((p as any).id as string);
        templateKey = 'delivery_done';
        templateParams = { num: record?.order_number ?? record?.id ?? '' };
        data = { route: '/orders', category: 'delivery', template: 'delivery_completed' };
        console.log(`[PUSH] delivery_completed → targets=${targetUserIds.length}`);
        break;
      }

      case 'driver_assigned': {
        const orderNum = record?.order_number ?? record?.id ?? '';
        templateParams = { num: orderNum };
        data = { route: '/orders', category: 'delivery', template: 'driver_assigned' };

        // Notify client: "A driver has been assigned"
        if (record?.user_id) {
          const { data: clientTokens } = await supabase
            .from('device_tokens').select('token, user_id').eq('user_id', record.user_id);
          const { data: clientProfile } = await supabase
            .from('profiles').select('language_preference').eq('id', record.user_id).single();
          const lang = resolveLang(clientProfile?.language_preference);
          const clientTitle = tr('driver_assigned_title', lang);
          const clientBody = tr('driver_assigned_body', lang, { num: orderNum });

          console.log(`[PUSH] driver_assigned → client ${record.user_id}: ${(clientTokens ?? []).length} tokens`);

          for (const { token } of (clientTokens ?? [])) {
            if (!token) continue;
            const result = await sendFcmV1(accessToken, projectId, token, clientTitle, clientBody, data);
            await logNotification(supabase, {
              user_id: record.user_id,
              device_token: token,
              event_type: 'driver_assigned_to_client',
              title: clientTitle,
              body: clientBody,
              data,
              status: result.success ? 'sent' : (
              (result.errorCode === 'UNREGISTERED' || result.errorCode === 'NOT_FOUND') ? 'invalid_token' : 'failed'
            ),
              fcm_response: result.error || 'OK',
              locale: lang,
            });
            // Only delete token if truly expired/unregistered — NOT on INVALID_ARGUMENT (payload error)
            if (result.errorCode === 'UNREGISTERED' || result.errorCode === 'NOT_FOUND') {
              await supabase.from('device_tokens').delete().eq('token', token);
              console.log(`[PUSH] ♻️ Removed expired token for client ${record.user_id}`);
            }
          }
        }

        // Notify driver: "New delivery assigned"
        if (record?.driver_id) {
          const { data: driverTokens } = await supabase
            .from('device_tokens').select('token, user_id').eq('user_id', record.driver_id);
          const { data: driverProfile } = await supabase
            .from('profiles').select('language_preference').eq('id', record.driver_id).single();
          const lang = resolveLang(driverProfile?.language_preference);
          const driverTitle = tr('driver_new_order_title', lang);
          const driverBody = tr('driver_new_order_body', lang, { num: orderNum });

          console.log(`[PUSH] driver_assigned → driver ${record.driver_id}: ${(driverTokens ?? []).length} tokens`);

          for (const { token } of (driverTokens ?? [])) {
            if (!token) continue;
            const result = await sendFcmV1(accessToken, projectId, token, driverTitle, driverBody, data);
            await logNotification(supabase, {
              user_id: record.driver_id,
              device_token: token,
              event_type: 'driver_assigned_to_driver',
              title: driverTitle,
              body: driverBody,
              data,
              status: result.success ? 'sent' : (
              (result.errorCode === 'UNREGISTERED' || result.errorCode === 'NOT_FOUND') ? 'invalid_token' : 'failed'
            ),
              fcm_response: result.error || 'OK',
              locale: lang,
            });
            // Only delete token if truly expired/unregistered — NOT on INVALID_ARGUMENT (payload error)
            if (result.errorCode === 'UNREGISTERED' || result.errorCode === 'NOT_FOUND') {
              await supabase.from('device_tokens').delete().eq('token', token);
              console.log(`[PUSH] ♻️ Removed expired token for driver ${record.driver_id}`);
            }
          }
        }

        return new Response(JSON.stringify({ sent: 'driver_assigned_split', logged: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'special_order_status_changed': {
        templateKey = 'special_order';
        const statusKey = `status_${record?.status}`;
        templateParams = { num: record?.id?.toString()?.substring(0, 8) ?? '' };
        data = { route: '/orders', category: 'order', template: 'special_order_update', status: record?.status ?? '' };
        if (record?.user_id) targetUserIds = [record.user_id];
        console.log(`[PUSH] special_order_status_changed → user=${record?.user_id} status=${record?.status}`);
        break;
      }

      case 'banner_created': {
        templateKey = 'banner';
        data = { route: '/home', category: 'promo', template: 'new_banner' };
        // Notify all non-admin users
        const { data: adminIds } = await supabase.from('profiles').select('id').eq('role', 'admin');
        const adminIdSet = new Set((adminIds ?? []).map((p: any) => p.id as string));
        const { data: allUsers } = await supabase.from('device_tokens').select('user_id');
        targetUserIds = [...new Set(
          (allUsers ?? [])
            .map((u: any) => u.user_id as string)
            .filter((id) => !adminIdSet.has(id))
        )];
        console.log(`[PUSH] banner_created → ${targetUserIds.length} target users`);
        break;
      }

      default: {
        // Generic pass-through (already localized by caller)
        if (payload.user_ids?.length) {
          targetUserIds = payload.user_ids;
          templateKey = '__passthrough';
        }
        data = payload.data ?? {};
        console.log(`[PUSH] default/passthrough type="${type}" → ${targetUserIds.length} targets`);
      }
    }

    targetUserIds = [...new Set(targetUserIds.filter(Boolean))];

    if (targetUserIds.length === 0 || !templateKey) {
      console.log(`[PUSH] ⚠️ No targets or empty template — skipping. targets=${targetUserIds.length} template="${templateKey}"`);
      await logNotification(supabase, {
        event_type: String(type || 'unknown'),
        status: 'no_tokens',
        fcm_response: `No targets (${targetUserIds.length}) or empty template`,
        data,
      });
      return new Response(JSON.stringify({ sent: 0, reason: 'no targets or empty template' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch tokens + user language preferences ─────────────────────
    const { data: tokenRows, error: tokenErr } = await supabase
      .from('device_tokens')
      .select('token, user_id, platform, locale')
      .in('user_id', targetUserIds);

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      console.log(`[PUSH] ⚠️ No device tokens found for users: ${targetUserIds.join(', ')}`);
      await logNotification(supabase, {
        event_type: String(type || 'unknown'),
        status: 'no_tokens',
        fcm_response: tokenErr ? `DB error: ${tokenErr.message}` : 'No tokens in device_tokens table',
        data,
      });
      return new Response(JSON.stringify({ sent: 0, reason: 'no device tokens found', db_error: tokenErr?.message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[PUSH] Found ${tokenRows.length} device token(s) for ${targetUserIds.length} user(s)`);

    // Fetch language preferences for all target users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, language_preference')
      .in('id', targetUserIds);

    const langMap: Record<string, Lang> = {};
    for (const p of (profiles ?? [])) {
      langMap[p.id] = resolveLang(p.language_preference);
    }

    // ── Build localized title/body per token and send ────────────────
    let sentCount = 0;
    const errors: string[] = [];
    const invalidTokens: string[] = [];

    function buildTitleBody(lang: Lang): { title: string; body: string } {
      if (templateKey === '__passthrough') {
        return { title: payload.title ?? 'Notification', body: payload.body ?? '' };
      }

      let title = '';
      let body = '';
      const p = templateParams;

      switch (templateKey) {
        case 'new_product':
          title = tr('new_product_title', lang);
          body = tr('new_product_body', lang, { name: p.name || tr('new_product_title', lang) });
          break;
        case 'new_order':
          title = tr('new_order_title', lang);
          body = tr('new_order_body', lang, { num: p.num, amount: p.amount });
          break;
        case 'order_update': {
          title = tr('order_update_title', lang);
          const statusKey = `status_${record?.status}`;
          const statusLabel = t[statusKey]?.[lang] ?? record?.status ?? '';
          body = tr('order_update_body', lang, { num: p.num, status: statusLabel });
          break;
        }
        case 'chat_support':
          title = tr('chat_support_title', lang);
          // Support both 'message' and 'content' field names
          body = (record?.content ?? record?.message)?.toString().substring(0, 100) ?? tr('chat_support_body', lang);
          break;
        case 'chat_from': {
          const name = senderName || tr('client', lang);
          title = tr('chat_from_title', lang, { name });
          body = (record?.content ?? record?.message)?.toString().substring(0, 100) ?? tr('chat_new_body', lang);
          break;
        }
        case 'delivery_pickup':
          title = tr('delivery_pickup_title', lang);
          body = tr('delivery_pickup_body', lang, { num: p.num });
          break;
        case 'delivery_done':
          title = tr('delivery_done_title', lang);
          body = tr('delivery_done_body', lang, { num: p.num });
          break;
        case 'driver_assigned':
          title = tr('driver_assigned_title', lang);
          body = tr('driver_assigned_body', lang, { num: p.num });
          break;
        case 'special_order':
          title = tr('special_order_title', lang);
          {
            const soStatusKey = `status_${record?.status}`;
            const soStatusLabel = t[soStatusKey]?.[lang] ?? record?.status ?? '';
            body = tr('special_order_body', lang, { num: p.num, status: soStatusLabel });
          }
          break;
        case 'banner':
          title = tr('banner_title', lang);
          body = record?.title ?? record?.description ?? tr('banner_body', lang);
          break;
        default:
          title = tr('fallback_title', lang);
          body = '';
      }
      return { title, body };
    }

    // Send in parallel batches of 20
    const concurrency = 20;
    const tokenList = tokenRows.filter((r: any) => r.token).map((r: any) => ({
      token: r.token as string,
      user_id: r.user_id as string,
      lang: langMap[r.user_id] ?? 'fr',
      platform: r.platform as string,
      locale: r.locale as string,
    }));

    for (let i = 0; i < tokenList.length; i += concurrency) {
      const batch = tokenList.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(({ token, lang }) => {
          const { title, body } = buildTitleBody(lang);
          return sendFcmV1(accessToken, projectId, token, title, body, data);
        }),
      );

      // Process results and log each one
      for (let idx = 0; idx < results.length; idx++) {
        const result = results[idx];
        const tokenInfo = batch[idx];
        const { title, body } = buildTitleBody(tokenInfo.lang);

        if (result.status === 'fulfilled') {
          if (result.value.success) {
            sentCount++;
            await logNotification(supabase, {
              user_id: tokenInfo.user_id,
              device_token: tokenInfo.token,
              event_type: String(type || 'unknown'),
              title,
              body,
              data,
              status: 'sent',
              fcm_response: 'OK',
              platform: tokenInfo.platform,
              locale: tokenInfo.locale,
            });
          } else {
            const err = result.value.error ?? '';
            const errCode = result.value.errorCode ?? '';
            errors.push(err);

            // INVALID_ARGUMENT = payload format error (NOT a bad token) → do NOT delete
            // UNREGISTERED / NOT_FOUND = token truly expired → delete
            const isInvalid = errCode === 'UNREGISTERED' || errCode === 'NOT_FOUND';
            if (isInvalid) {
              invalidTokens.push(tokenInfo.token);
            }

            await logNotification(supabase, {
              user_id: tokenInfo.user_id,
              device_token: tokenInfo.token,
              event_type: String(type || 'unknown'),
              title,
              body,
              data,
              status: isInvalid ? 'invalid_token' : 'failed',
              fcm_response: `${errCode}: ${err}`,
              platform: tokenInfo.platform,
              locale: tokenInfo.locale,
            });

            console.log(`[PUSH] ❌ Failed for user ${tokenInfo.user_id}: ${errCode} ${err}`);
          }
        } else {
          const errMsg = String(result.reason);
          errors.push(errMsg);

          await logNotification(supabase, {
            user_id: tokenInfo.user_id,
            device_token: tokenInfo.token,
            event_type: String(type || 'unknown'),
            title: buildTitleBody(tokenInfo.lang).title,
            body: buildTitleBody(tokenInfo.lang).body,
            data,
            status: 'failed',
            fcm_response: `EXCEPTION: ${errMsg}`,
            platform: tokenInfo.platform,
            locale: tokenInfo.locale,
          });
        }
      }
    }

    // Remove invalid tokens from DB
    if (invalidTokens.length > 0) {
      await supabase.from('device_tokens').delete().in('token', invalidTokens);
      console.log(`[PUSH] ♻️ Removed ${invalidTokens.length} invalid token(s)`);
    }

    const summary = {
      event: type,
      sent: sentCount,
      total_tokens: tokenList.length,
      invalid_tokens_removed: invalidTokens.length,
      errors: [...new Set(errors)],
    };
    console.log(`[PUSH] ── Summary: ${JSON.stringify(summary)} ──`);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error(`[PUSH] ❌ Unhandled error: ${e}`);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
