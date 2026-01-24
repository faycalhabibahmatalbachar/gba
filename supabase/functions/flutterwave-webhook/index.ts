import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function extractOrderIdFromTxRef(txRef: string | null | undefined): string | null {
  if (!txRef) return null;
  const m = /^order_([0-9a-fA-F-]{36})_/.exec(txRef);
  return m?.[1] ?? null;
}

function extractOrderId(payload: any): string | null {
  const txRef = payload?.data?.tx_ref?.toString();
  const fromRef = extractOrderIdFromTxRef(txRef);
  if (fromRef) return fromRef;

  const metaOrderId = payload?.data?.meta?.order_id?.toString();
  if (metaOrderId && metaOrderId.length > 0) return metaOrderId;

  return null;
}

Deno.serve(async (req) => {
  const verifHash = req.headers.get('verif-hash');
  const rawBody = await req.text();

  const secretHash = Deno.env.get('FLW_SECRET_HASH');
  if (!secretHash) {
    return new Response('Missing FLW_SECRET_HASH', { status: 500 });
  }

  if (!verifHash || verifHash !== secretHash) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const flwSecretKey = Deno.env.get('FLW_SECRET_KEY');
  if (!flwSecretKey) {
    return new Response('Missing FLW_SECRET_KEY', { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const data = payload?.data;
  const transactionId = data?.id?.toString();
  const txRef = data?.tx_ref?.toString();

  if (!transactionId) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const orderId = extractOrderId(payload);

  try {
    const verifyResp = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${flwSecretKey}`,
      },
    });

    const verifyBody = await verifyResp.text();
    let verifyJson: any;
    try {
      verifyJson = JSON.parse(verifyBody);
    } catch {
      verifyJson = null;
    }

    if (!verifyResp.ok) {
      return new Response('Failed to verify transaction', { status: 500 });
    }

    const status = verifyJson?.data?.status?.toString();

    if (orderId) {
      if (status === 'successful') {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'processing',
            payment_provider: 'flutterwave',
            payment_method: 'card',
          })
          .eq('id', orderId);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
            })
            .eq('id', orderId);
        }
      } else if (status === 'failed' || status === 'cancelled') {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            payment_provider: 'flutterwave',
            payment_method: 'card',
          })
          .eq('id', orderId);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed',
            })
            .eq('id', orderId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
