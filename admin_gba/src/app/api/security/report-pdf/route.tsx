import React from 'react';
import { NextResponse } from 'next/server';
import { subHours } from 'date-fns';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 8 },
  subtitle: { fontSize: 10, color: '#444', marginBottom: 14 },
  h2: { fontSize: 11, marginTop: 10, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  row: { marginBottom: 3, flexDirection: 'row' },
  label: { width: 140, color: '#333' },
  value: { flex: 1 },
  foot: { marginTop: 16, fontSize: 8, color: '#666' },
});

function ReportDoc(props: {
  generatedAt: string;
  audit24h: number;
  failed24h: number;
  logins24h: number;
  lines: string[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Rapport urgence — Sécurité admin</Text>
        <Text style={styles.subtitle}>Généré le {props.generatedAt} (UTC)</Text>

        <Text style={styles.h2}>Indicateurs 24 h</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Événements audit</Text>
          <Text style={styles.value}>{props.audit24h}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Échecs audit</Text>
          <Text style={styles.value}>{props.failed24h}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tentatives connexion (échantillon)</Text>
          <Text style={styles.value}>{props.logins24h}</Text>
        </View>

        <Text style={styles.h2}>Derniers événements audit</Text>
        {props.lines.map((line, i) => (
          <Text key={i} style={{ fontFamily: 'Courier', marginBottom: 2, fontSize: 7 }} wrap>
            {line}
          </Text>
        ))}

        <Text style={styles.foot}>
          Document interne — à conserver selon votre politique de conformité. Les chiffres sont issus des tables
          audit_logs et sources connexions (échantillons limités).
        </Text>
      </Page>
    </Document>
  );
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const since = subHours(new Date(), 24).toISOString();
  const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  try {
    const [{ count: audit24h }, { count: failed24h }, { data: recent }, { count: loginsCount }] = await Promise.all([
      sb.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
      sb.from('audit_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', since),
      sb
        .from('audit_logs')
        .select('created_at, action_type, entity_type, user_email, status')
        .order('created_at', { ascending: false })
        .limit(35),
      sb.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action_type', 'login').gte('created_at', since),
    ]);

    const lines = (recent || []).map((r) => {
      const row = r as {
        created_at?: string;
        action_type?: string;
        entity_type?: string;
        user_email?: string;
        status?: string;
      };
      const t = row.created_at ? row.created_at.replace('T', ' ').slice(0, 19) : '?';
      return `${t} | ${row.action_type ?? '?'} | ${row.entity_type ?? '?'} | ${row.user_email ?? '—'} | ${row.status ?? ''}`;
    });

    const buffer = await renderToBuffer(
      <ReportDoc
        generatedAt={generatedAt}
        audit24h={audit24h ?? 0}
        failed24h={failed24h ?? 0}
        logins24h={loginsCount ?? 0}
        lines={lines}
      />,
    );

    const fname = `gba-securite-urgence-${generatedAt.slice(0, 10)}.pdf`;
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fname}"`,
      },
    });
  } catch (e) {
    console.error('[api/security/report-pdf]', e);
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
