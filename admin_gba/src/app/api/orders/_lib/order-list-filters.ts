/**
 * Filtres liste commandes — partagés entre GET /api/orders et GET /api/orders/stats
 * pour garantir les mêmes résultats (évite KPI ≠ tableau).
 */

export type OrdersListKind = 'all' | 'special_mobile' | 'standard';

export type ListFilterParams = {
  status?: string;
  driverId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  amountMin?: number | null;
  amountMax?: number | null;
  search?: string;
  kind?: OrdersListKind;
};

/** OR PostgREST : heuristique « commande spéciale » (alignée sur mapOrderRow côté serveur). */
export const SPECIAL_ORDER_OR_FILTERS =
  'order_number.ilike.sp-%,notes.ilike.%special%,notes.ilike.%devis%,notes.ilike.%quote%,notes.ilike.%quotation%,metadata.ilike.%special%,metadata.ilike.%quote%,metadata.ilike.%devis%';

/** Même logique sans colonne metadata (si absente en base). */
export const SPECIAL_ORDER_OR_FILTERS_NO_METADATA =
  'order_number.ilike.sp-%,notes.ilike.%special%,notes.ilike.%devis%,notes.ilike.%quote%,notes.ilike.%quotation%';

/** Chaîne supabase-js (PostgrestFilterBuilder) — typée en `any` pour compatibilité des surcharges `.not` / `.or`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterChain = any;

/**
 * Commandes « standard » = ne matchent pas le groupe OR « spécial ».
 * Utilise not.or=(...) PostgREST (évite les chaînes .or()/.not() imbriquées qui renvoyaient 0 ligne).
 */
export function applyKindFilter(q: FilterChain, kind: ListFilterParams['kind'], useMetadataInFilter: boolean): FilterChain {
  if (kind === 'special_mobile') {
    return q.or(useMetadataInFilter ? SPECIAL_ORDER_OR_FILTERS : SPECIAL_ORDER_OR_FILTERS_NO_METADATA);
  }
  if (kind === 'standard') {
    const group = useMetadataInFilter ? SPECIAL_ORDER_OR_FILTERS : SPECIAL_ORDER_OR_FILTERS_NO_METADATA;
    // PostgREST: ?not.or=(a,b,...) — supabase .filter() cannot emit this (wrong encoding); append on builder URL.
    const u = q?.url as URL | undefined;
    if (u) u.searchParams.append('not.or', `(${group})`);
    return q;
  }
  return q;
}

export function applyListFilters(q: FilterChain, params: ListFilterParams, useMetadataInFilter: boolean): FilterChain {
  let qq = q;
  if (params.status && params.status !== 'all') qq = qq.eq('status', params.status);
  if (params.driverId) qq = qq.eq('driver_id', params.driverId);
  if (params.dateFrom) qq = qq.gte('created_at', params.dateFrom);
  if (params.dateTo) qq = qq.lte('created_at', params.dateTo);
  if (params.amountMin != null) qq = qq.gte('total_amount', params.amountMin);
  if (params.amountMax != null) qq = qq.lte('total_amount', params.amountMax);

  const kind = params.kind ?? 'all';
  const hasSearch = Boolean(params.search?.trim());
  const s = hasSearch ? params.search!.trim() : '';

  /**
   * Deux `.or()` successifs = deux paramètres `or=` dans l’URL → PostgREST peut répondre 4xx/5xx ou résultats incohérents.
   * Pour spécial + recherche : un seul `and=(or(recherche),or(heuristique spéciale))`.
   */
  if (hasSearch && kind === 'special_mobile') {
    const searchInner = `order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`;
    const specInner = useMetadataInFilter ? SPECIAL_ORDER_OR_FILTERS : SPECIAL_ORDER_OR_FILTERS_NO_METADATA;
    const u = qq.url as URL | undefined;
    if (u) u.searchParams.append('and', `(or(${searchInner}),or(${specInner}))`);
    const out = qq;
    // #region agent log
    try {
      const urlObj = out?.url as URL | undefined;
      fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
        body: JSON.stringify({
          sessionId: '789a98',
          location: 'order-list-filters.ts:applyListFilters',
          message: 'filter chain built',
          data: {
            hypothesisId: 'H1-fix',
            mergedSearchAndSpecial: true,
            kind,
            useMetadataInFilter,
            orParamCount: urlObj ? urlObj.searchParams.getAll('or').length : 0,
            andParamCount: urlObj ? urlObj.searchParams.getAll('and').length : 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
    // #endregion
    return out;
  }

  if (hasSearch) {
    qq = qq.or(`order_number.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`);
  }
  const out = applyKindFilter(qq, kind, useMetadataInFilter);
  // #region agent log
  try {
    const urlObj = out?.url as URL | undefined;
    const orCount = urlObj ? urlObj.searchParams.getAll('or').length : 0;
    const notOrCount = urlObj ? urlObj.searchParams.getAll('not.or').length : 0;
    fetch('http://127.0.0.1:7316/ingest/cbc4d87d-0063-4626-a2b8-cd3c21b6e6d2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '789a98' },
      body: JSON.stringify({
        sessionId: '789a98',
        location: 'order-list-filters.ts:applyListFilters',
        message: 'filter chain built',
        data: {
          hypothesisId: 'H1',
          kind,
          useMetadataInFilter,
          hasSearch,
          orParamCount: orCount,
          notOrParamCount: notOrCount,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  // #endregion
  return out;
}

export function parseListFilterParams(url: URL): ListFilterParams {
  const status = url.searchParams.get('status') || 'all';
  const driverId = url.searchParams.get('driverId');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const amountMinRaw = url.searchParams.get('amountMin');
  const amountMaxRaw = url.searchParams.get('amountMax');
  const amountMin = amountMinRaw != null && amountMinRaw !== '' ? Number(amountMinRaw) : null;
  const amountMax = amountMaxRaw != null && amountMaxRaw !== '' ? Number(amountMaxRaw) : null;
  const search = url.searchParams.get('search') || url.searchParams.get('q') || '';
  const kindRaw = url.searchParams.get('kind') || 'all';
  const kind: OrdersListKind =
    kindRaw === 'special_mobile' || kindRaw === 'standard' ? kindRaw : 'all';

  return {
    status: status === 'all' ? undefined : status,
    driverId: driverId || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    amountMin: Number.isFinite(amountMin as number) ? amountMin : null,
    amountMax: Number.isFinite(amountMax as number) ? amountMax : null,
    search,
    kind,
  };
}
