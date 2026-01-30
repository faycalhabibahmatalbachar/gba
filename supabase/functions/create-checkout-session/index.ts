import Stripe from 'https://esm.sh/stripe@14?target=denonext';
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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return new Response('Missing STRIPE_SECRET_KEY', {
        status: 500,
        headers: corsHeaders,
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20',
    });

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
      .select('id,user_id,order_number,total_amount,currency,payment_status,stripe_payment_intent_id')
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

    const paymentStatus = (order.payment_status ?? '').toString().toLowerCase();
    if (paymentStatus == 'paid') {
      return new Response('Order already paid', { status: 409, headers: corsHeaders });
    }

    const currency = (order.currency ?? 'XAF').toLowerCase();
    const amount = Number(order.total_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response('Invalid amount', { status: 400, headers: corsHeaders });
    }

    const unitAmount = Math.round(amount);

    const existingPiId = order.stripe_payment_intent_id?.toString();

    let paymentIntent: Stripe.PaymentIntent;
    if (existingPiId) {
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(existingPiId);
      } catch {
        paymentIntent = await stripe.paymentIntents.create(
          {
            amount: unitAmount,
            currency,
            automatic_payment_methods: { enabled: true },
            description: `Commande ${order.order_number ?? order.id}`,
            metadata: {
              order_id: order.id,
              order_number: order.order_number ?? '',
            },
          },
          {
            idempotencyKey: `order_${order.id}`,
          },
        );
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: unitAmount,
          currency,
          automatic_payment_methods: { enabled: true },
          description: `Commande ${order.order_number ?? order.id}`,
          metadata: {
            order_id: order.id,
            order_number: order.order_number ?? '',
          },
        },
        {
          idempotencyKey: `order_${order.id}`,
        },
      );
    }

    const { data: existingPaymentRows } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .limit(1);

    if (!existingPaymentRows || existingPaymentRows.length === 0) {
      await supabaseAdmin.from('payments').insert({
        user_id: order.user_id,
        order_id: order.id,
        provider: 'stripe',
        status: 'pending',
        amount: amount,
        currency: (order.currency ?? 'XAF'),
        stripe_payment_intent_id: paymentIntent.id,
      });
    }

    const { error: updErr1 } = await supabaseAdmin
      .from('orders')
      .update({
        payment_provider: 'stripe',
        payment_method: 'card',
        payment_status: 'pending',
        stripe_payment_intent_id: paymentIntent.id,
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

    if (!paymentIntent.client_secret) {
      return new Response('Missing payment intent client_secret', {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});
