import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

function SpecialOrdersRFQ() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  const [selected, setSelected] = useState(null);
  const [offers, setOffers] = useState([]);
  const [events, setEvents] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [form, setForm] = useState({
    currency: 'XOF',
    unitPrice: '',
    shippingFee: '',
    tax: '',
    serviceFee: '',
    paymentTerms: '',
    validHours: '48',
    etaMinDays: '',
    etaMaxDays: '',
  });

  const selectedOrder = useMemo(() => {
    return orders.find((o) => (o?.id ?? '') === selectedId) ?? null;
  }, [orders, selectedId]);

  const formatMoney = (value, currency) => {
    const numVal = typeof value === 'number' ? value : Number(value ?? 0);
    if ((currency ?? '').toUpperCase() === 'XOF') {
      return `${Math.round(numVal)} FCFA`;
    }
    return `${numVal.toFixed(2)} ${(currency ?? '').toUpperCase()}`;
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('special_order_details_view')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      setOrders(data ?? []);
      if (!selectedId && (data?.[0]?.id ?? '')) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      enqueueSnackbar(e.message ?? String(e), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (id) => {
    if (!id) return;
    setDetailsLoading(true);
    try {
      const [{ data: order, error: orderError }, { data: offersData, error: offersError }, { data: eventsData, error: eventsError }] =
        await Promise.all([
          supabase.from('special_order_details_view').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('special_order_offers')
            .select('*')
            .eq('special_order_id', id)
            .order('created_at', { ascending: true }),
          supabase
            .from('special_order_events')
            .select('*')
            .eq('special_order_id', id)
            .order('created_at', { ascending: true }),
        ]);

      if (orderError) throw orderError;
      if (offersError) throw offersError;
      if (eventsError) throw eventsError;

      setSelected(order ?? null);
      setOffers(offersData ?? []);
      setEvents(eventsData ?? []);

      if (order?.currency) {
        setForm((prev) => ({ ...prev, currency: order.currency }));
      }
    } catch (e) {
      enqueueSnackbar(e.message ?? String(e), { variant: 'error' });
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      setOffers([]);
      setEvents([]);
      return;
    }
    loadDetails(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const onSendQuote = async () => {
    if (!selectedId) return;

    const unitPrice = Number(form.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      enqueueSnackbar('Prix unitaire invalide', { variant: 'warning' });
      return;
    }

    const shippingFee = form.shippingFee === '' ? 0 : Number(form.shippingFee);
    const tax = form.tax === '' ? 0 : Number(form.tax);
    const serviceFee = form.serviceFee === '' ? 0 : Number(form.serviceFee);
    const validHours = form.validHours === '' ? null : Number(form.validHours);
    const etaMinDays = form.etaMinDays === '' ? null : Number(form.etaMinDays);
    const etaMaxDays = form.etaMaxDays === '' ? null : Number(form.etaMaxDays);

    if ((etaMinDays != null && (!Number.isFinite(etaMinDays) || etaMinDays < 0)) || (etaMaxDays != null && (!Number.isFinite(etaMaxDays) || etaMaxDays < 0))) {
      enqueueSnackbar('ETA invalide', { variant: 'warning' });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_send_special_order_quote', {
        p_special_order_id: selectedId,
        p_currency: form.currency || 'XOF',
        p_unit_price: unitPrice,
        p_shipping_fee: Number.isFinite(shippingFee) ? shippingFee : 0,
        p_tax: Number.isFinite(tax) ? tax : 0,
        p_service_fee: Number.isFinite(serviceFee) ? serviceFee : 0,
        p_payment_terms: form.paymentTerms || null,
        p_valid_hours: validHours,
        p_eta_min_days: etaMinDays,
        p_eta_max_days: etaMaxDays,
      });

      if (error) throw error;

      enqueueSnackbar('Devis envoyé', { variant: 'success' });

      await loadOrders();
      await loadDetails(selectedId);
      return data;
    } catch (e) {
      enqueueSnackbar(e.message ?? String(e), { variant: 'error' });
      return null;
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Commandes spéciales (RFQ)
        </Typography>
        <Button variant="outlined" onClick={loadOrders} disabled={loading}>
          Rafraîchir
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Demandes
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {loading ? (
                <Typography>Chargement…</Typography>
              ) : orders.length === 0 ? (
                <Typography>Aucune demande</Typography>
              ) : (
                <Stack spacing={1}>
                  {orders.map((o) => {
                    const id = o?.id ?? '';
                    const isSelected = id === selectedId;
                    const currency = o?.currency ?? 'XOF';
                    const quoteTotal = o?.quote_total;
                    return (
                      <Button
                        key={id}
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => setSelectedId(id)}
                        sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                      >
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography sx={{ fontWeight: 800 }}>
                            {o?.product_name ?? 'Commande spéciale'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {o?.status ?? 'pending'} • Qté: {o?.quantity ?? ''} • {formatDate(o?.created_at)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 800 }}>
                            {quoteTotal != null ? formatMoney(quoteTotal, currency) : '—'}
                          </Typography>
                        </Box>
                      </Button>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Détails
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {!selectedId ? (
                <Typography>Sélectionne une demande</Typography>
              ) : detailsLoading ? (
                <Typography>Chargement…</Typography>
              ) : (
                <Stack spacing={2}>
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>
                      {selected?.product_name ?? selectedOrder?.product_name ?? 'Commande spéciale'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      User: {selected?.user_id ?? ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Livraison: {selected?.shipping_method ?? ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Description: {selected?.description ?? ''}
                    </Typography>
                    {selected?.notes ? (
                      <Typography variant="body2" color="text.secondary">
                        Notes: {selected.notes}
                      </Typography>
                    ) : null}
                  </Box>

                  <Card variant="outlined">
                    <CardContent>
                      <Typography sx={{ fontWeight: 800, mb: 1 }}>Envoyer un devis</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Devise"
                            fullWidth
                            value={form.currency}
                            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Prix unitaire"
                            fullWidth
                            value={form.unitPrice}
                            onChange={(e) => setForm((p) => ({ ...p, unitPrice: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Frais livraison"
                            fullWidth
                            value={form.shippingFee}
                            onChange={(e) => setForm((p) => ({ ...p, shippingFee: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Tax"
                            fullWidth
                            value={form.tax}
                            onChange={(e) => setForm((p) => ({ ...p, tax: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Service fee"
                            fullWidth
                            value={form.serviceFee}
                            onChange={(e) => setForm((p) => ({ ...p, serviceFee: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Validité (heures)"
                            fullWidth
                            value={form.validHours}
                            onChange={(e) => setForm((p) => ({ ...p, validHours: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="ETA min (jours)"
                            fullWidth
                            value={form.etaMinDays}
                            onChange={(e) => setForm((p) => ({ ...p, etaMinDays: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="ETA max (jours)"
                            fullWidth
                            value={form.etaMaxDays}
                            onChange={(e) => setForm((p) => ({ ...p, etaMaxDays: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Payment terms"
                            fullWidth
                            value={form.paymentTerms}
                            onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button variant="contained" onClick={onSendQuote}>
                            Envoyer le devis
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  <Box>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>Dernier devis</Typography>
                    {selected?.quote_total != null ? (
                      <Typography>
                        Total: {formatMoney(selected.quote_total, selected?.currency ?? 'XOF')} • Status: {selected?.quote_status ?? ''}
                      </Typography>
                    ) : (
                      <Typography>—</Typography>
                    )}
                    {selected?.quote_valid_until ? (
                      <Typography variant="body2" color="text.secondary">
                        Valable jusqu’au: {formatDate(selected.quote_valid_until)}
                      </Typography>
                    ) : null}
                    {selected?.eta_min_date || selected?.eta_max_date ? (
                      <Typography variant="body2" color="text.secondary">
                        ETA: {formatDate(selected?.eta_min_date)}{selected?.eta_max_date ? ` - ${formatDate(selected.eta_max_date)}` : ''}
                      </Typography>
                    ) : null}
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>Timeline</Typography>
                    {events.length === 0 ? (
                      <Typography>—</Typography>
                    ) : (
                      <Stack spacing={1}>
                        {events.map((e) => (
                          <Card key={e.id} variant="outlined">
                            <CardContent>
                              <Typography sx={{ fontWeight: 700 }}>
                                {e.label || e.event_type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(e.created_at)}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  <Box>
                    <Typography sx={{ fontWeight: 800, mb: 1 }}>Offres / messages</Typography>
                    {offers.length === 0 ? (
                      <Typography>—</Typography>
                    ) : (
                      <Stack spacing={1}>
                        {offers.map((o) => (
                          <Card key={o.id} variant="outlined">
                            <CardContent>
                              <Typography sx={{ fontWeight: 700 }}>
                                {(o.from_role || '').toUpperCase()} • {(o.type || '').toUpperCase()}
                              </Typography>
                              {o.total != null ? (
                                <Typography variant="body2">
                                  Total: {formatMoney(o.total, o.currency || selected?.currency || 'XOF')}
                                </Typography>
                              ) : null}
                              {o.message ? (
                                <Typography variant="body2" color="text.secondary">
                                  {o.message}
                                </Typography>
                              ) : null}
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(o.created_at)}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SpecialOrdersRFQ;
