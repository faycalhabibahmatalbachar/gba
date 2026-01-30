import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20',
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('Missing Stripe-Signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') as string,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = (session.metadata?.order_id ?? session.client_reference_id)?.toString();

      const piId = session.payment_intent?.toString() ?? null;

      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id: piId,
        })
        .eq('stripe_checkout_session_id', session.id);

      if (orderId) {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'processing',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: piId,
          })
          .eq('id', orderId);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'processing',
            })
            .eq('id', orderId);
        }
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.order_id?.toString();

      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id: pi.id,
        })
        .eq('stripe_payment_intent_id', pi.id);

      if (orderId) {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'processing',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: pi.id,
          })
          .eq('id', orderId);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'processing',
            })
            .eq('id', orderId);
        }
      } else {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'processing',
            paid_at: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', pi.id);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'processing',
            })
            .eq('stripe_payment_intent_id', pi.id);
        }
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata?.order_id?.toString();

      await supabase
        .from('payments')
        .update({
          status: 'failed',
          stripe_payment_intent_id: pi.id,
        })
        .eq('stripe_payment_intent_id', pi.id);

      if (orderId) {
        const { error: updErr1 } = await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
          })
          .eq('id', orderId);

        if (updErr1) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed',
            })
            .eq('stripe_payment_intent_id', pi.id);
        }
      } else {
        await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
          })
          .eq('stripe_payment_intent_id', pi.id);
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
