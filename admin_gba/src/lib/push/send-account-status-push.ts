/**
 * Best-effort FCM via Supabase Edge Function (same contract as /api/admin/push).
 * Client localizes from data.template + data.account_status.
 */
export async function sendAccountStatusPush(userId: string, status: 'suspended' | 'active'): Promise<void> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return;

  const title = status === 'suspended' ? 'Compte suspendu' : 'Compte actif';
  const body =
    status === 'suspended'
      ? 'Votre accès a été restreint. Ouvrez l’app pour plus d’informations.'
      : 'Votre compte est à nouveau actif.';

  try {
    const res = await fetch(`${base}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        user_ids: [userId],
        data: {
          template: 'account_status',
          account_status: status,
          message_type: 'account_status',
          route: status === 'suspended' ? '/blocked' : '/home',
        },
      }),
    });
    if (!res.ok) {
      console.warn('[push] account status', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[push] account status failed', e);
  }
}
