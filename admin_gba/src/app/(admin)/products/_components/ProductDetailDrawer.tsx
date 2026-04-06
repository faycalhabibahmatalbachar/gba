'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Area,
  Bar,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CreditCard,
  Heart,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseApiJson } from '@/lib/fetch-api-json';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { ChartWrapper } from '@/components/ui/custom/ChartWrapper';
import { AvatarWithInitials } from '@/components/ui/custom/AvatarWithInitials';
import { ProductDetailSkeleton } from './ProductDetailSkeleton';
import { ProductOrdersTable } from './ProductOrdersTable';
import { ProductAuditTimeline } from './ProductAuditTimeline';

export interface ProductDetailDrawerProps {
  productId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}

type CategoryEmbed = { id: string; name: string | null; slug: string | null } | null;

type ProductPayload = {
  id: string;
  name: string;
  slug?: string;
  sku?: string | null;
  description?: string | null;
  price?: number;
  compare_at_price?: number | null;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  stock_quantity?: number;
  quantity?: number;
  stock_alert_threshold?: number | null;
  status?: string | null;
  listing_status?: string | null;
  is_featured?: boolean;
  is_active?: boolean;
  main_image?: string | null;
  gallery_urls?: string[] | null;
  images?: unknown;
  tags?: string[] | null;
  custom_fields?: Record<string, unknown> | null;
  weight_g?: number | null;
  dimensions?: { l?: number; w?: number; h?: number } | null;
  rating?: number | null;
  reviews_count?: number | null;
  view_count?: number | null;
  return_rate?: number | null;
  last_sold_at?: string | null;
  category?: CategoryEmbed;
  totalRevenue?: number;
  totalUnitsSold?: number;
  totalOrders?: number;
  wishlistCount?: number;
  avgBasket?: number;
};

type ChartPoint = { date: string; revenue: number; units: number };

type ReviewRow = {
  id: string;
  rating: number;
  title?: string | null;
  body?: string | null;
  moderation_status?: string | null;
  admin_response?: string | null;
  created_at: string;
  profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  } | null;
};

type DetailJson = {
  product: ProductPayload;
  chartData: ChartPoint[];
  reviews: ReviewRow[];
};

function collectImages(p: ProductPayload): string[] {
  const out: string[] = [];
  if (p.main_image) out.push(p.main_image);
  if (Array.isArray(p.gallery_urls)) {
    for (const u of p.gallery_urls) {
      if (typeof u === 'string' && u) out.push(u);
    }
  }
  if (Array.isArray(p.images)) {
    for (const x of p.images) {
      if (typeof x === 'string' && x) out.push(x);
      else if (x && typeof x === 'object' && 'url' in x && typeof (x as { url: string }).url === 'string') {
        out.push((x as { url: string }).url);
      }
    }
  }
  return [...new Set(out)];
}

function fmtCurrency(n: number) {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} XOF`;
}

export function ProductDetailDrawer({ productId, open, onOpenChange, onUpdated }: ProductDetailDrawerProps) {
  const qc = useQueryClient();
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [period, setPeriod] = React.useState<'7j' | '30j' | '90j'>('30j');
  const [stockDelta, setStockDelta] = React.useState<number>(0);
  const [stockReason, setStockReason] = React.useState('');
  const [replyTexts, setReplyTexts] = React.useState<Record<string, string>>({});

  const detailQuery = useQuery({
    queryKey: ['product-detail', productId],
    queryFn: async () => {
      const r = await fetch(`/api/products/${productId}`, { credentials: 'include' });
      const j = await parseApiJson<DetailJson & { error?: string }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur chargement');
      return j;
    },
    enabled: open && !!productId,
  });

  const p = detailQuery.data?.product;
  const chartFull = detailQuery.data?.chartData ?? [];
  const reviews = detailQuery.data?.reviews ?? [];

  React.useEffect(() => {
    if (p?.main_image) setActiveImage(p.main_image);
  }, [p?.main_image, p?.id]);

  const filteredChart = React.useMemo(() => {
    const n = period === '7j' ? 7 : period === '90j' ? 90 : 30;
    return chartFull.slice(-n);
  }, [chartFull, period]);

  const gallery = p ? collectImages(p) : [];
  const displayImage = activeImage || p?.main_image || gallery[0] || null;
  const statusStr = String(p?.status || p?.listing_status || 'active');
  const threshold = p?.stock_alert_threshold ?? 5;
  const stockVal = Number(p?.stock_quantity ?? p?.quantity ?? 0);
  const reviewCount = Number(p?.reviews_count ?? reviews.length);

  const adjustStock = async () => {
    if (!productId || !stockReason.trim() || !stockDelta) {
      toast.error('Indiquez une variation et un motif');
      return;
    }
    const next = stockVal + stockDelta;
    if (next < 0) {
      toast.error('Stock négatif interdit');
      return;
    }
    try {
      const r = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: next }),
      });
      const j = await parseApiJson<{ error?: unknown }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Stock mis à jour');
      setStockDelta(0);
      setStockReason('');
      void qc.invalidateQueries({ queryKey: ['product-detail', productId] });
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const patchReview = async (reviewId: string, body: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/reviews/${reviewId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await parseApiJson<{ error?: unknown }>(r);
      if (!r.ok) throw new Error(typeof j.error === 'string' ? j.error : 'Erreur');
      toast.success('Avis mis à jour');
      void qc.invalidateQueries({ queryKey: ['product-detail', productId] });
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  return (
    <Sheet
      open={open && !!productId}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setActiveImage(null);
      }}
    >
      <SheetContent side="right" className="w-[min(640px,100vw)] max-w-full overflow-y-auto p-0 gap-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Détail produit</SheetTitle>
        </SheetHeader>

        {detailQuery.isLoading && <ProductDetailSkeleton />}

        {detailQuery.isError && (
          <div className="p-6 text-sm text-destructive">
            {detailQuery.error instanceof Error ? detailQuery.error.message : 'Erreur'}
          </div>
        )}

        {p && (
          <>
            <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt=""
                  fill
                  className="object-cover opacity-30"
                  sizes="640px"
                  unoptimized={displayImage.startsWith('http')}
                />
              ) : null}
              <div className="absolute inset-0 p-6 flex items-end bg-gradient-to-t from-background/90 to-transparent">
                <div className="flex gap-4 items-end w-full">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-background shadow-lg shrink-0 relative">
                    {displayImage ? (
                      <Image
                        src={displayImage}
                        alt={p.name}
                        width={80}
                        height={80}
                        className="object-cover"
                        unoptimized={displayImage.startsWith('http')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <Package size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 mb-1 flex-wrap">
                      <StatusBadge status={statusStr} />
                      {p.is_featured ? (
                        <Badge variant="secondary" className="text-xs">
                          ⭐ Featured
                        </Badge>
                      ) : null}
                    </div>
                    <h2 className="font-bold text-xl truncate">{p.name}</h2>
                    <p className="text-muted-foreground text-sm">
                      {p.sku ?? '—'} · {p.category?.name ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold">{fmtCurrency(Number(p.price ?? 0))}</p>
                    {p.promo_price != null && p.compare_at_price != null ? (
                      <p className="text-muted-foreground line-through text-sm">
                        {fmtCurrency(Number(p.compare_at_price))}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {gallery.length > 0 ? (
              <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border">
                {gallery.map((img) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={cn(
                      'w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition',
                      activeImage === img || (!activeImage && img === p.main_image)
                        ? 'border-primary'
                        : 'border-transparent',
                    )}
                  >
                    <Image
                      src={img}
                      alt=""
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                      unoptimized={img.startsWith('http')}
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <Tabs defaultValue="analytics" className="px-4 pt-4 pb-8">
              <TabsList className="w-full flex flex-wrap h-auto gap-1">
                <TabsTrigger value="info" className="text-xs">
                  Infos
                </TabsTrigger>
                <TabsTrigger value="analytics" className="text-xs">
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="stock" className="text-xs">
                  Stock
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">
                  Commandes
                </TabsTrigger>
                <TabsTrigger value="reviews" className="text-xs">
                  Avis ({reviewCount})
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  Historique
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 pt-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{p.description || '—'}</p>
                </div>
                {p.tags && p.tags.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {p.custom_fields && Object.keys(p.custom_fields).length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Champs personnalisés</p>
                    <dl className="grid grid-cols-2 gap-1 text-sm">
                      {Object.entries(p.custom_fields).map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="font-medium">{String(v)}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </div>
                ) : null}
                {p.weight_g || p.dimensions ? (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {p.weight_g ? (
                      <div>
                        <p className="text-muted-foreground">Poids</p>
                        <p>{p.weight_g} g</p>
                      </div>
                    ) : null}
                    {p.dimensions ? (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">L×l×H</p>
                        <p>
                          {p.dimensions.l ?? '—'}×{p.dimensions.w ?? '—'}×{p.dimensions.h ?? '—'} cm
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'CA cumulé',
                      value: fmtCurrency(Number(p.totalRevenue ?? 0)),
                      icon: TrendingUp,
                      color: 'text-primary',
                    },
                    {
                      label: 'Unités vendues',
                      value: String(p.totalUnitsSold ?? 0),
                      icon: ShoppingBag,
                      color: 'text-emerald-600',
                    },
                    {
                      label: 'Commandes',
                      value: String(p.totalOrders ?? 0),
                      icon: Package,
                      color: 'text-blue-600',
                    },
                    {
                      label: 'Panier moyen',
                      value: fmtCurrency(Number(p.avgBasket ?? 0)),
                      icon: CreditCard,
                      color: 'text-amber-600',
                    },
                    {
                      label: 'Wishlist',
                      value: String(p.wishlistCount ?? 0),
                      icon: Heart,
                      color: 'text-pink-600',
                    },
                    {
                      label: 'Note moyenne',
                      value: `★ ${Number(p.rating ?? 0).toFixed(1)} / 5`,
                      icon: Star,
                      color: 'text-yellow-600',
                    },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className={cn('p-2 rounded-lg bg-background', color)}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-semibold text-sm">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {(['7j', '30j', '90j'] as const).map((x) => (
                    <Button
                      key={x}
                      size="sm"
                      variant={period === x ? 'default' : 'outline'}
                      onClick={() => setPeriod(x)}
                    >
                      {x}
                    </Button>
                  ))}
                </div>

                <ChartWrapper title="Ventes & revenus" minHeight={200}>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={filteredChart}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(d) => {
                          try {
                            return format(new Date(d), 'dd/MM');
                          } catch {
                            return d;
                          }
                        }}
                      />
                      <YAxis
                        yAxisId="revenue"
                        orientation="left"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                      />
                      <YAxis yAxisId="units" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value, name) => {
                          const n = Number(value);
                          if (name === 'revenue') return [fmtCurrency(n), 'Revenu'];
                          return [value, 'Unités'];
                        }}
                      />
                      <Area
                        yAxisId="revenue"
                        type="monotone"
                        dataKey="revenue"
                        fill="color-mix(in oklab, var(--primary) 15%, transparent)"
                        stroke="var(--primary)"
                        strokeWidth={2}
                      />
                      <Bar
                        yAxisId="units"
                        dataKey="units"
                        fill="oklch(0.72 0.14 166)"
                        radius={[2, 2, 0, 0]}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartWrapper>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  {p.last_sold_at ? (
                    <div className="p-2 rounded bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">Dernière vente</p>
                      <p className="font-medium text-xs">
                        {formatDistanceToNow(new Date(p.last_sold_at), { locale: fr, addSuffix: true })}
                      </p>
                    </div>
                  ) : null}
                  <div className="p-2 rounded bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Taux retour</p>
                    <p className="font-medium">{Number(p.return_rate ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Vues</p>
                    <p className="font-medium">{p.view_count ?? 0}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="stock" className="space-y-4 pt-4">
                <div className="p-4 rounded-xl border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium">Stock actuel</p>
                    <span
                      className={cn(
                        'text-2xl font-bold',
                        stockVal === 0
                          ? 'text-destructive'
                          : stockVal <= threshold
                            ? 'text-amber-600'
                            : 'text-emerald-600',
                      )}
                    >
                      {stockVal}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        stockVal === 0
                          ? 'bg-destructive'
                          : stockVal <= threshold
                            ? 'bg-amber-500'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, (stockVal / Math.max(stockVal, 100)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Seuil d&apos;alerte : {threshold} unités</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="flex-1 w-full">
                    <Label>Ajuster le stock (variation)</Label>
                    <Input
                      type="number"
                      value={Number.isNaN(stockDelta) ? '' : stockDelta}
                      onChange={(e) => setStockDelta(parseInt(e.target.value, 10) || 0)}
                      placeholder="+10 ou -5"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <Label>Motif</Label>
                    <Input
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      placeholder="Réception, correction…"
                    />
                  </div>
                  <Button onClick={() => void adjustStock()} disabled={!stockDelta || !stockReason.trim()}>
                    Appliquer
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="pt-4">
                <ProductOrdersTable productId={productId} />
              </TabsContent>

              <TabsContent value="reviews" className="space-y-3 pt-4">
                <div className="p-3 rounded-lg bg-muted/50 flex flex-col sm:flex-row items-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{Number(p.rating ?? 0).toFixed(1)}</p>
                    <div className="flex gap-0.5 justify-center">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={cn(
                            s <= Math.round(Number(p.rating ?? 0))
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground',
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{reviewCount} avis</p>
                  </div>
                  <div className="flex-1 space-y-1 w-full">
                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = reviews.filter((r) => r.rating === s).length;
                      const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                      return (
                        <div key={s} className="flex items-center gap-2 text-xs">
                          <span className="w-4 shrink-0">{s}★</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-6 text-muted-foreground text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {reviews.map((review) => {
                  const pname = `${review.profiles?.first_name ?? ''} ${review.profiles?.last_name ?? ''}`.trim();
                  return (
                    <div key={review.id} className="p-3 border border-border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarWithInitials name={pname || '?'} src={review.profiles?.avatar_url} size="sm" />
                          <div>
                            <p className="text-sm font-medium truncate">{pname || 'Client'}</p>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={10}
                                  className={cn(
                                    s <= review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-muted-foreground',
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={review.moderation_status || 'pending'} size="sm" />
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {review.title ? <p className="text-sm font-medium">{review.title}</p> : null}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.body || '—'}</p>
                      {review.admin_response ? (
                        <div className="bg-primary/5 border border-primary/20 rounded p-2 text-sm">
                          <p className="text-xs font-medium text-primary mb-1">Réponse GBA</p>
                          <p>{review.admin_response}</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Textarea
                            placeholder="Répondre à cet avis…"
                            value={replyTexts[review.id] ?? ''}
                            onChange={(e) =>
                              setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))
                            }
                            className="text-sm"
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end flex-wrap">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void patchReview(review.id, { moderation_status: 'approved' })}
                            >
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void patchReview(review.id, { moderation_status: 'rejected' })}
                            >
                              Rejeter
                            </Button>
                            <Button
                              size="sm"
                              disabled={!(replyTexts[review.id] ?? '').trim()}
                              onClick={() =>
                                void patchReview(review.id, {
                                  admin_response: (replyTexts[review.id] ?? '').trim(),
                                })
                              }
                            >
                              Répondre
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              <TabsContent value="history" className="pt-4">
                <ProductAuditTimeline productId={productId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
