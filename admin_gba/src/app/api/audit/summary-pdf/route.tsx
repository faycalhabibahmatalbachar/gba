import React from 'react';
import { NextResponse } from 'next/server';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 15, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 9, color: '#444', marginBottom: 12 },
  row: { marginBottom: 3, flexDirection: 'row' },
  label: { width: 160, color: '#333' },
  value: { flex: 1 },
  h2: { fontSize: 10, marginTop: 10, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  foot: { marginTop: 14, fontSize: 8, color: '#666' },
});

function SummaryDoc(props: {
  generatedAt: string;
  from: string;
  to: string;
  total: number;
  failed: number;
  actors: number;
  lines: string[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Résumé audit administrateur</Text>
        <Text style={styles.subtitle}>
          Période : {props.from.slice(0, 10)} → {props.to.slice(0, 10)} — généré le {props.generatedAt}
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>Événements</Text>
          <Text style={styles.value}>{props.total}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Échecs</Text>
          <Text style={styles.value}>{props.failed}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Acteurs distincts (approx.)</Text>
          <Text style={styles.value}>{props.actors}</Text>
        </View>
        <Text style={styles.h2}>Échantillon d&apos;événements récents</Text>
        {props.lines.map((line, i) => (
          <Text key={i} style={{ fontFamily: 'Courier', marginBottom: 2, fontSize: 7 }} wrap>
            {line}
          </Text>
        ))}
        <Text style={styles.foot}>
          Document interne — données issues de audit_logs (échantillon limité). Conservez selon votre politique de
          conformité.
        </Text>
      </Page>
    </Document>
  );
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const toParam = searchParams.get('to')?.trim();
  const fromParam = searchParams.get('from')?.trim();
  const toD = toParam ? new Date(toParam) : new Date();
  const fromD = fromParam ? new Date(fromParam) : new Date(toD.getTime() - 90 * 86400000);
  const pFrom = fromD.toISOString();
  const pTo = toD.toISOString();
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  try {
    const { count: totalC } = await sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', pFrom)
      .lte('created_at', pTo);
    const { count: failC } = await sb
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', pFrom)
      .lte('created_at', pTo)
      .eq('status', 'failed');

    const { data: recent } = await sb
      .from('audit_logs')
      .select('created_at, action_type, entity_type, user_email, action_description')
      .gte('created_at', pFrom)
      .lte('created_at', pTo)
      .order('created_at', { ascending: false })
      .limit(40);

    const lines = (recent || []).map((r) => {
      const t = String(r.created_at || '').replace('T', ' ').slice(0, 19);
      const desc = r.action_description ? String(r.action_description).slice(0, 120) : '';
      return `${t} | ${r.action_type} | ${r.entity_type} | ${r.user_email || '—'} | ${desc}`;
    });

    const { data: uidSample } = await sb
      .from('audit_logs')
      .select('user_id')
      .gte('created_at', pFrom)
      .lte('created_at', pTo)
      .not('user_id', 'is', null)
      .limit(8000);
    const actors = new Set((uidSample || []).map((r) => String(r.user_id))).size;

    const buf = await renderToBuffer(
      <SummaryDoc
        generatedAt={generatedAt}
        from={pFrom}
        to={pTo}
        total={totalC ?? 0}
        failed={failC ?? 0}
        actors={actors}
        lines={lines}
      />,
    );

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-resume-${generatedAt.slice(0, 10)}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
