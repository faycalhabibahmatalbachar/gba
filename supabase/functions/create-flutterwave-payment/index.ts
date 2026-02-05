import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const flwSecretKey = Deno.env.get('FLW_SECRET_KEY');
    if (!flwSecretKey) {
      return new Response('Missing FLW_SECRET_KEY', { status: 500, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response('Missing SUPABASE_URL or SUPABASE_ANON_KEY', {
        status: 500,
        headers: corsHeaders,
      });
    }
    if (!supabaseServiceRoleKey) {
      return new Response('Missing SUPABASE_SERVICE_ROLE_KEY', {
        status: 500,
        headers: corsHeaders,
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const callerUserId = userData.user.id;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload = await req.json().catch(() => ({}));
    const orderId = payload?.order_id?.toString();
    if (!orderId) {
      return new Response('Missing order_id', { status: 400, headers: corsHeaders });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id,user_id,order_number,total_amount,currency,customer_email,customer_name,customer_phone')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return new Response(orderErr?.message ?? 'Order not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    if (order.user_id?.toString() !== callerUserId) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    const amountXaf = Number(order.total_amount);
    if (!Number.isFinite(amountXaf) || amountXaf <= 0) {
      return new Response('Invalid amount', { status: 400, headers: corsHeaders });
    }

    const xafPerUsd = Number(Deno.env.get('XAF_PER_USD') ?? '600');
    if (!Number.isFinite(xafPerUsd) || xafPerUsd <= 0) {
      return new Response('Invalid XAF_PER_USD', { status: 500, headers: corsHeaders });
    }

    const amountUsdRaw = amountXaf / xafPerUsd;
    const amountUsd = Math.max(1, Math.round(amountUsdRaw * 100) / 100);

    const txRef = `order_${order.id}_${Date.now()}`;

    const siteUrl = origin && origin.startsWith('http')
      ? origin
      : (Deno.env.get('SITE_URL') ?? 'https://gba-vc4s.vercel.app');

    const redirectUrl = `${siteUrl}/#/checkout/flutterwave-return?order_id=${order.id}`;

    const customerEmail = (order.customer_email ?? userData.user.email ?? '').toString();
    const customerName = (order.customer_name ?? '').toString();
    const customerPhone = (order.customer_phone ?? '').toString();

    const flwResp = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amountUsd.toFixed(2),
        currency: 'USD',
        redirect_url: redirectUrl,
        customer: {
          email: customerEmail,
          name: customerName,
          phonenumber: customerPhone,
        },
        customizations: {
          title: `Commande ${order.order_number ?? order.id}`,
        },
        meta: {
          order_id: order.id,
          amount_xaf: amountXaf,
          currency_xaf: (order.currency ?? 'XAF'),
        },
      }),
    });

    const flwBody = await flwResp.text();
    let flwJson: any;
    try {
      flwJson = JSON.parse(flwBody);
    } catch {
      flwJson = null;
    }

    if (!flwResp.ok) {
      const msg = flwJson?.message ?? flwBody ?? 'Flutterwave error';
      return new Response(String(msg), { status: 502, headers: corsHeaders });
    }

    const link = flwJson?.data?.link?.toString();
    if (!link) {
      return new Response('Missing Flutterwave payment link', {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { error: updErr1 } = await supabaseAdmin
      .from('orders')
      .update({
        payment_provider: 'flutterwave',
        payment_method: 'card',
        payment_status: 'pending',
      })
      .eq('id', order.id);

    if (updErr1) {
      const { error: updErr2 } = await supabaseAdmin
        .from('orders')
        .update({
          payment_method: 'card',
          payment_status: 'pending',
        })
        .eq('id', order.id);

      if (updErr2) {
        return new Response(updErr2.message, { status: 400, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ link }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});
