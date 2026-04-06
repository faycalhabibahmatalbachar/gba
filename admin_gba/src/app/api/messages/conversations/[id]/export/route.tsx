import { NextResponse } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 16, marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  meta: { fontSize: 9, color: '#666', marginBottom: 16 },
  row: { marginBottom: 8, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#ddd' },
  ts: { fontSize: 8, color: '#888' },
  author: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  body: { fontSize: 10 },
});

function ExportDoc({
  title,
  exportedAt,
  lines,
}: {
  title: string;
  exportedAt: string;
  lines: { at: string; author: string; body: string }[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>GBA — {title}</Text>
        <Text style={styles.meta}>Exporté le {exportedAt}</Text>
        {lines.map((l, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={styles.ts}>{l.at}</Text>
            <Text style={styles.author}>{l.author}</Text>
            <Text style={styles.body}>{l.body}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: conv } = await sb
      .from('chat_conversations')
      .select('id, user_id, title')
      .eq('id', id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

    let contact = 'Contact';
    if (conv.user_id) {
      const { data: p } = await sb
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', conv.user_id)
        .maybeSingle();
      if (p) {
        const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
        contact = n || p.email || contact;
      }
    }

    const { data: msgs } = await sb
      .from('chat_messages')
      .select('id, sender_id, message, created_at')
      .eq('conversation_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    const senderIds = [...new Set((msgs || []).map((m: { sender_id: string }) => m.sender_id))];
    const { data: profs } = await sb.from('profiles').select('id, email, first_name, last_name').in('id', senderIds);
    const pmap = new Map((profs || []).map((p: { id: string; email?: string; first_name?: string; last_name?: string }) => [p.id, p]));

    const lines = (msgs || []).map((m: { sender_id: string; message: string | null; created_at: string }) => {
      const pr = pmap.get(m.sender_id);
      const label = pr
        ? [pr.first_name, pr.last_name].filter(Boolean).join(' ') || pr.email || m.sender_id
        : m.sender_id;
      return {
        at: new Date(m.created_at).toISOString(),
        author: label,
        body: (m.message || '').slice(0, 4000),
      };
    });

    const exportedAt = new Date().toLocaleString('fr-FR');
    const title = `Conversation avec ${contact}`;
    const doc = <ExportDoc title={title} exportedAt={exportedAt} lines={lines} />;
    const buf = await renderToBuffer(doc);
    const body = new Uint8Array(buf);

    const fname = `conversation-${id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
