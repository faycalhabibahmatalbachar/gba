import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Refresh as RefreshIcon,
  LocalShipping as LocalShippingIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  Map as MapIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

const statusColors = {
  pending: '#FFA726',
  confirmed: '#66BB6A',
  processing: '#42A5F5',
  shipped: '#AB47BC',
  delivered: '#26A69A',
  cancelled: '#EF5350',
  refunded: '#FF7043',
};

function buildDestinationAddress(order) {
  const parts = [
    order.shipping_address,
    order.shipping_district,
    order.shipping_city,
    order.shipping_country,
  ].filter(Boolean);
  return parts.join(', ');
}

function buildGoogleMapsDirectionsUrl(order) {
  const lat = Number(order.delivery_lat);
  const lng = Number(order.delivery_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const params = new URLSearchParams({
      api: '1',
      destination: `${lat},${lng}`,
      travelmode: 'driving',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const destination = buildDestinationAddress(order);
  if (!destination) return null;

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildOsmUrl(order) {
  const lat = Number(order.delivery_lat);
  const lng = Number(order.delivery_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const zoom = 16;
    return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=${zoom}/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;
  }

  const destination = buildDestinationAddress(order);
  if (!destination) return null;
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(destination)}`;
}

export default function Deliveries() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [assignmentsByOrderId, setAssignmentsByOrderId] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('order_details_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      enqueueSnackbar('Erreur chargement livraisons', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('id,name,is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (e) {
      // ignore
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_assignments')
        .select('order_id,driver_id,status,assigned_at')
        .order('assigned_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const map = {};
      for (const row of (data || [])) {
        if (!row?.order_id) continue;
        map[row.order_id] = row;
      }
      setAssignmentsByOrderId(map);
    } catch (e) {
      // ignore
    }
  };

  const assignDriver = async (orderId, driverId) => {
    try {
      const payload = {
        order_id: orderId,
        driver_id: driverId || null,
        status: driverId ? 'assigned' : 'unassigned',
      };

      const { error } = await supabase
        .from('delivery_assignments')
        .upsert(payload, { onConflict: 'order_id' });

      if (error) throw error;
      enqueueSnackbar('Affectation mise à jour', { variant: 'success' });
      fetchAssignments();
    } catch (e) {
      enqueueSnackbar('Erreur affectation livreur (RLS?)', { variant: 'error' });
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('id,status')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Mise à jour refusée (RLS)');

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      enqueueSnackbar('Statut mis à jour', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Erreur mise à jour statut (RLS?)', { variant: 'error' });
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    fetchAssignments();

    const subscription = supabase
      .channel('deliveries_orders_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    const driversSub = supabase
      .channel('deliveries_drivers_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();

    const assignmentsSub = supabase
      .channel('deliveries_assignments_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => {
        fetchAssignments();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      driversSub.unsubscribe();
      assignmentsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return (orders || []).filter((o) => {
      const status = (o.status || '').toLowerCase();

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? !['delivered', 'cancelled', 'refunded'].includes(status)
            : status === statusFilter;

      const matchesQuery =
        !q ||
        (o.order_number || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q) ||
        (o.customer_phone || o.customer_phone_profile || '').toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [orders, searchTerm, statusFilter]);

  const rows = useMemo(() => {
    return filteredOrders.map((o) => ({
      id: o.id,
      ...o,
    }));
  }, [filteredOrders]);

  const columns = useMemo(
    () => [
      {
        field: 'order_number',
        headerName: 'Commande',
        flex: 1,
        minWidth: 150,
        valueGetter: (params) => params.row.order_number || params.row.id,
      },
      {
        field: 'customer_name',
        headerName: 'Client',
        flex: 1,
        minWidth: 160,
        valueGetter: (params) => params.row.customer_name || '—',
      },
      {
        field: 'customer_phone_profile',
        headerName: 'Téléphone',
        flex: 1,
        minWidth: 140,
        valueGetter: (params) => params.row.customer_phone || params.row.customer_phone_profile || '—',
      },
      {
        field: 'shipping_address',
        headerName: 'Adresse',
        flex: 2,
        minWidth: 240,
        valueGetter: (params) => buildDestinationAddress(params.row) || '—',
      },
      {
        field: 'driver',
        headerName: 'Livreur',
        minWidth: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const orderId = params.row.id;
          const assignment = assignmentsByOrderId[orderId] || null;
          const selected = assignment?.driver_id || '';

          return (
            <FormControl size="small" fullWidth onClick={(e) => e.stopPropagation()}>
              <Select
                value={selected}
                displayEmpty
                onChange={(e) => {
                  assignDriver(orderId, e.target.value);
                }}
              >
                <MenuItem value="">
                  <em>Non assigné</em>
                </MenuItem>
                {(drivers || []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        },
      },
      {
        field: 'status',
        headerName: 'Statut',
        minWidth: 130,
        renderCell: (params) => {
          const orderId = params.row.id;
          const status = (params.value || '').toLowerCase();
          const color = statusColors[status] || '#999';

          return (
            <FormControl size="small" fullWidth onClick={(e) => e.stopPropagation()}>
              <Select
                value={status || ''}
                onChange={(e) => updateOrderStatus(orderId, e.target.value)}
                sx={{
                  fontWeight: 700,
                  bgcolor: `${color}12`,
                  borderRadius: 1,
                }}
              >
                {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        },
      },
      {
        field: 'total_amount',
        headerName: 'Total',
        minWidth: 120,
        valueGetter: (params) => {
          const val = Number(params.row.total_amount ?? 0);
          return Number.isFinite(val) ? val.toFixed(0) : '0';
        },
      },
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        filterable: false,
        minWidth: 190,
        renderCell: (params) => {
          const mapsUrl = buildGoogleMapsDirectionsUrl(params.row);
          const osmUrl = buildOsmUrl(params.row);

          return (
            <Box display="flex" gap={0.5}>
              <Tooltip title={mapsUrl ? 'Itinéraire Google Maps' : 'Adresse/GPS manquant'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!mapsUrl}
                    onClick={() => {
                      if (!mapsUrl) return;
                      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <LocalShippingIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title={osmUrl ? 'Ouvrir OpenStreetMap (GPS)' : 'GPS non disponible'}>
                <span>
                  <IconButton
                    size="small"
                    disabled={!osmUrl}
                    onClick={() => {
                      if (!osmUrl) return;
                      window.open(osmUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <MapIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Voir commande">
                <IconButton
                  size="small"
                  onClick={() => {
                    const orderId = params.row.id;
                    const url = `/orders?orderId=${encodeURIComponent(orderId)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Ouvrir détails (navigateur)">
                <IconButton
                  size="small"
                  onClick={() => {
                    const orderId = params.row.id;
                    const url = `/orders?orderId=${encodeURIComponent(orderId)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          );
        },
      },
    ],
    [assignmentsByOrderId, drivers]
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Livraisons (GPS)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ouvre un itinéraire Google Maps depuis l’adresse de livraison. (Phase 1: adresse texte)
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchOrders} variant="outlined">
          Actualiser
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Recherche: commande, client, email, téléphone…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={statusFilter}
                label="Statut"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="active">Actives (non livrées)</MenuItem>
                <MenuItem value="all">Toutes</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="confirmed">Confirmée</MenuItem>
                <MenuItem value="processing">En traitement</MenuItem>
                <MenuItem value="shipped">Expédiée</MenuItem>
                <MenuItem value="delivered">Livrée</MenuItem>
                <MenuItem value="cancelled">Annulée</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<LocalShippingIcon />}
              onClick={() => {
                enqueueSnackbar(
                  'Astuce: Ajoute delivery_lat/lng côté DB pour des itinéraires plus précis.',
                  { variant: 'info' }
                );
              }}
            >
              Mode GPS (phase 2)
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ height: 640, borderRadius: 3 }}>
        <DataGrid
          loading={loading}
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
        />
      </Paper>
    </Box>
  );
}
