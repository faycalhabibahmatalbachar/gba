-- Agrégats KPI pour la page Audit (admin) — période paramétrable
CREATE OR REPLACE FUNCTION public.audit_page_kpis(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE (
  total_events bigint,
  distinct_actors bigint,
  failed_count bigint,
  success_or_partial bigint,
  distinct_role_values bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint AS total_events,
    count(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS distinct_actors,
    count(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
    count(*) FILTER (WHERE COALESCE(status, 'success') IN ('success', 'partial'))::bigint AS success_or_partial,
    count(DISTINCT COALESCE(user_role, ''))::bigint AS distinct_role_values
  FROM public.audit_logs
  WHERE (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);
$$;

COMMENT ON FUNCTION public.audit_page_kpis(timestamptz, timestamptz) IS 'KPIs agrégés audit_logs pour le dashboard admin (période optionnelle).';

GRANT EXECUTE ON FUNCTION public.audit_page_kpis(timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.audit_role_breakdown(p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL)
RETURNS TABLE (role_label text, event_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(trim(user_role), ''), 'inconnu') AS role_label,
         count(*)::bigint AS event_count
  FROM public.audit_logs
  WHERE (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to)
  GROUP BY 1
  ORDER BY event_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.audit_role_breakdown(timestamptz, timestamptz) TO service_role;
