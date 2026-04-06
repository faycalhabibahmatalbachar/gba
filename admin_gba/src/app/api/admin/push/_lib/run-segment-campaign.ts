import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';
import { listUserIdsForPush, type PushFilters } from '@/app/api/admin/push/_lib/segment-users';

const CHUNK = 40;
export const MAX_SYNC_USERS = 400;

async function callEdgePush(
  base: string,
  serviceKey: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

export type RunCampaignInput = {
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, string>;
  filters: PushFilters;
  scheduledAt?: string | null;
};

export type RunCampaignAuth = { userId: string; email: string | null };

export async function runSegmentCampaign(
  sb: SupabaseClient,
  baseUrl: string,
  serviceKey: string,
  auth: RunCampaignAuth,
  input: RunCampaignInput,
): Promise<{
  job_id: string;
  estimated_devices: number;
  processed_users: number;
  capped: boolean;
  status: string;
}> {
  const { title, body: msgBody, imageUrl, data, filters, scheduledAt } = input;

  const userIds = await listUserIdsForPush(sb, filters, 50_000);
  const totalTargeted = userIds.length;
  const targetSlice = userIds.slice(0, MAX_SYNC_USERS);

  const { data: campaign, error: insErr } = await sb
    .from('push_campaigns')
    .insert({
      title,
      target_filter: filters as Record<string, unknown>,
      total_targeted: totalTargeted,
      body: msgBody,
      image_url: imageUrl ?? null,
      created_by: auth.userId,
      status: scheduledAt ? 'scheduled' : 'processing',
      scheduled_at: scheduledAt ?? null,
      sent_count: 0,
      delivered_count: 0,
      failed_count: 0,
      metadata: { data: data ?? {} },
    })
    .select('id')
    .single();

  if (insErr) throw new Error(insErr.message);
  const jobId = campaign?.id as string;

  if (scheduledAt) {
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'send_notification',
      entityType: 'notification',
      entityId: jobId,
      description: `Campagne planifiée: ${title.slice(0, 80)}`,
      changes: { after: { scheduledAt, totalTargeted } },
    });
    return {
      job_id: jobId,
      estimated_devices: totalTargeted,
      processed_users: 0,
      capped: totalTargeted > MAX_SYNC_USERS,
      status: 'scheduled',
    };
  }

  let sentBatches = 0;
  let deliveredApprox = 0;
  let failedApprox = 0;

  for (let i = 0; i < targetSlice.length; i += CHUNK) {
    const chunk = targetSlice.slice(i, i + CHUNK);
    const edgePayload: Record<string, unknown> = {
      type: 'admin_manual_push',
      title,
      body: msgBody,
      data: data ?? {},
      user_ids: chunk,
    };
    if (imageUrl) edgePayload.image_url = imageUrl;

    const r = await callEdgePush(baseUrl, serviceKey, edgePayload);
    sentBatches += 1;
    if (r.ok) deliveredApprox += chunk.length;
    else failedApprox += chunk.length;
  }

  const finalStatus = failedApprox > 0 && deliveredApprox === 0 ? 'failed' : 'completed';

  await sb
    .from('push_campaigns')
    .update({
      status: finalStatus,
      sent_count: targetSlice.length,
      delivered_count: deliveredApprox,
      failed_count: failedApprox,
      completed_at: new Date().toISOString(),
      error_detail: failedApprox > 0 && deliveredApprox === 0 ? 'Tous les envois ont échoué' : null,
    })
    .eq('id', jobId);

  try {
    await sb.from('push_logs').insert({
      campaign_id: jobId,
      campaign_name: title,
      target_type: 'segment',
      target_filters: filters as Record<string, unknown>,
      total_targeted: totalTargeted,
      total_sent: targetSlice.length,
      delivered: deliveredApprox,
      failed: failedApprox,
      status: finalStatus === 'failed' ? 'failed' : 'done',
      sent_by: auth.userId,
      batch_results: [{ batches: sentBatches, capped: totalTargeted > MAX_SYNC_USERS }],
    });
  } catch {
    /* push_logs optionnel si migration non appliquée */
  }

  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'send_notification',
    entityType: 'notification',
    entityId: jobId,
    description: `Campagne push: ${title.slice(0, 80)}`,
    changes: { after: { totalTargeted, sent: targetSlice.length, deliveredApprox, failedApprox } },
  });

  return {
    job_id: jobId,
    estimated_devices: totalTargeted,
    processed_users: targetSlice.length,
    capped: totalTargeted > MAX_SYNC_USERS,
    status: finalStatus,
  };
}
