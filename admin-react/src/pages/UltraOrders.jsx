import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TextField,
  Grid,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  LinearProgress,
  Badge,
  Divider,
  Fade,
  Zoom,
  Skeleton
} from '@mui/material';
import {
  ShoppingBag,
  TrendingUp,
  AttachMoney,
  LocalShipping,
  CheckCircle,
  Cancel,
  AccessTime,
  MoreVert,
  FilterList,
  Search,
  Refresh,
  Download,
  Print,
  Email,
  Phone,
  LocationOn,
  Person,
  CalendarToday,
  Visibility
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../config/supabase';
import { useSnackbar } from 'notistack';

const statusColors = {
  pending: '#FFA726',
  confirmed: '#66BB6A',
  processing: '#42A5F5',
  shipped: '#AB47BC',
  delivered: '#26A69A',
  cancelled: '#EF5350',
  refunded: '#FF7043'
};

const statusIcons = {
  pending: <AccessTime />,
  confirmed: <CheckCircle />,
  processing: <LocalShipping />,
  shipped: <LocalShipping />,
  delivered: <CheckCircle />,
  cancelled: <Cancel />,
  refunded: <AttachMoney />
};

function OrderDetailsDialog({ open, order, onClose, loading }) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const totalAmount = Number(order.total_amount ?? 0);
  const shippingFee = Number(order.shipping_fee ?? order.shipping_cost ?? 0);
  const subtotal = totalAmount - shippingFee;

  const hasClientInfo = Boolean(order.customer_name || order.customer_email || order.customer_phone || order.customer_phone_profile);
  const hasShippingInfo = Boolean(order.shipping_country || order.shipping_city || order.shipping_district || order.shipping_address);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {order.order_number || order.id}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {order.created_at ? new Date(order.created_at).toLocaleString() : ''}
            </Typography>
          </Box>
          <Chip
            icon={statusIcons[order.status]}
            label={(order.status || '').toUpperCase()}
            sx={{
              bgcolor: `${statusColors[order.status] || '#999'}20`,
              color: statusColors[order.status] || '#666',
              border: `1px solid ${(statusColors[order.status] || '#999')}40`,
              fontWeight: 'bold'
            }}
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        <Grid container spacing={2}>
          {hasClientInfo && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }} variant="outlined">
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Client
                </Typography>
                <Box display="flex" alignItems="center" gap={1.5} mb={1}>
                  <Avatar sx={{ bgcolor: '#667eea' }}>
                    {(order.customer_name || 'C')[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    {order.customer_name && (
                      <Typography fontWeight={600}>{order.customer_name}</Typography>
                    )}
                    {order.customer_email && (
                      <Typography variant="body2" color="textSecondary">
                        {order.customer_email}
                      </Typography>
                    )}
                  </Box>
                </Box>
                {(order.customer_phone || order.customer_phone_profile) && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Phone sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {order.customer_phone || order.customer_phone_profile}
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}

          {hasShippingInfo && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, borderRadius: 2 }} variant="outlined">
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Adresse de livraison
                </Typography>
                {(order.shipping_country || order.shipping_city || order.shipping_district) && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2">
                      {[order.shipping_country, order.shipping_city, order.shipping_district].filter(Boolean).join(', ')}
                    </Typography>
                  </Box>
                )}
                {order.shipping_address && (
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                    {order.shipping_address}
                  </Typography>
                )}
              </Paper>
            </Grid>
          )}

          <Grid item xs={12}>
            <Paper sx={{ p: 2, borderRadius: 2 }} variant="outlined">
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Articles ({items.length})
              </Typography>
              {items.length === 0 && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  Aucun article
                </Typography>
              )}
              <List dense disablePadding>
                {items.map((item, idx) => (
                  <ListItem key={idx} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar
                        variant="rounded"
                        src={item.product_image || undefined}
                        sx={{ bgcolor: '#f3f4f6', width: 48, height: 48 }}
                      >
                        <ShoppingBag sx={{ fontSize: 18 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.product_name || ''}
                      secondary={`${Number(item.quantity ?? 0)} x ${Number(item.unit_price ?? 0).toFixed(0)} FCFA`}
                    />
                    <Typography fontWeight="bold">
                      {Number(item.total_price ?? 0).toFixed(0)} FCFA
                    </Typography>
                  </ListItem>
                ))}
              </List>
              <Divider sx={{ my: 1.5 }} />
              <Box display="flex" justifyContent="space-between">
                <Typography color="textSecondary">Sous-total</Typography>
                <Typography fontWeight={700}>{Math.max(0, subtotal).toFixed(0)} FCFA</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" sx={{ mt: 0.5 }}>
                <Typography color="textSecondary">Livraison</Typography>
                <Typography fontWeight={700}>{shippingFee.toFixed(0)} FCFA</Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" sx={{ mt: 1 }}>
                <Typography fontWeight={800}>Total</Typography>
                <Typography fontWeight={800} color="primary">
                  {totalAmount.toFixed(0)} FCFA
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}

function UltraOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    delivered: 0,
    revenue: 0
  });
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchOrders();
    fetchStats();
    
    // Realtime subscription
    const subscription = supabase
      .channel('orders_channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchOrders();
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedOrder?.id) return;
    const updated = orders.find((o) => o.id === selectedOrder.id);
    if (updated) {
      setSelectedOrder(updated);
    }
  }, [orders, selectedOrder?.id]);

  const fetchOrderDetails = async (orderId) => {
    try {
      setDetailsLoading(true);
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (orderError) throw orderError;

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (itemsError) throw itemsError;

      setSelectedOrder({
        ...orderRow,
        items: items || []
      });
    } catch (e) {
      enqueueSnackbar('Erreur chargement détails', { variant: 'error' });
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('order_details_view')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      enqueueSnackbar('Erreur chargement commandes', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_order_statistics', { p_period: 'month' });

      if (error) throw error;
      if (data && data[0]) {
        setStats({
          total: data[0].total_orders || 0,
          pending: data[0].pending_orders || 0,
          delivered: data[0].completed_orders || 0,
          revenue: data[0].total_revenue || 0
        });
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('[UltraOrders] auth.getUser error:', authError);
      } else {
        console.log('[UltraOrders] auth user:', authData?.user?.id, authData?.user?.email);
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('id,status')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          'Mise à jour refusée (0 ligne modifiée). Vérifie les RLS/policies admin sur la table orders.'
        );
      }

      console.log('[UltraOrders] order status updated:', data);
      
      enqueueSnackbar('Statut mis à jour', { variant: 'success' });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      setSelectedOrder((prev) => (prev && prev.id === orderId ? { ...prev, status: newStatus } : prev));
      fetchOrders();

      if (detailsOpen && selectedOrder?.id === orderId) {
        fetchOrderDetails(orderId);
      }

      setAnchorEl(null);
    } catch (error) {
      console.error('[UltraOrders] handleStatusChange error:', error);
      const message =
        (error && typeof error === 'object' && 'message' in error && error.message)
          ? error.message
          : 'Erreur mise à jour';
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Header avec animations */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Gestion des Commandes
        </Typography>
      </motion.div>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Commandes', value: stats.total, icon: <ShoppingBag />, color: '#667eea' },
          { label: 'En Attente', value: stats.pending, icon: <AccessTime />, color: '#FFA726' },
          { label: 'Livrées', value: stats.delivered, icon: <CheckCircle />, color: '#66BB6A' },
          { label: 'Revenus', value: `${stats.revenue.toFixed(0)} FCFA`, icon: <AttachMoney />, color: '#764ba2' }
        ].map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card sx={{
                background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}30 100%)`,
                border: `1px solid ${stat.color}40`,
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden'
              }}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {stat.label}
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" color={stat.color}>
                        {stat.value}
                      </Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: stat.color, width: 56, height: 56 }}>
                      {stat.icon}
                    </Avatar>
                  </Box>
                </CardContent>
                <Box sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: `linear-gradient(90deg, ${stat.color} 0%, ${stat.color}80 100%)`
                }} />
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Rechercher par numéro ou client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={filter}
                label="Statut"
                onChange={(e) => setFilter(e.target.value)}
              >
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="confirmed">Confirmé</MenuItem>
                <MenuItem value="processing">En traitement</MenuItem>
                <MenuItem value="shipped">Expédié</MenuItem>
                <MenuItem value="delivered">Livré</MenuItem>
                <MenuItem value="cancelled">Annulé</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button startIcon={<Refresh />} onClick={fetchOrders}>
              Actualiser
            </Button>
            <Button startIcon={<Download />} variant="outlined">
              Exporter
            </Button>
            <Button startIcon={<Print />} variant="outlined">
              Imprimer
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Orders List */}
      <AnimatePresence>
        {loading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
            ))}
          </Box>
        ) : (
          filteredOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Paper sx={{
                mb: 2,
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.3s',
                '&:hover': {
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={2}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Numéro de commande
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {order.order_number}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        <CalendarToday sx={{ fontSize: 12, mr: 0.5 }} />
                        {new Date(order.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={3}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Client
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#667eea' }}>
                          {order.customer_name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight="500">
                            {order.customer_name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {order.customer_phone_profile}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Articles
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Badge badgeContent={order.total_items} color="primary">
                          <ShoppingBag />
                        </Badge>
                        <Typography variant="body2">
                          {order.total_items} article(s)
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Box>
                      <Typography variant="caption" color="textSecondary">
                        Total
                      </Typography>
                      <Typography variant="h6" fontWeight="bold" color="primary">
                        {order.total_amount?.toFixed(0)} FCFA
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Chip
                      icon={statusIcons[order.status]}
                      label={order.status?.toUpperCase()}
                      sx={{
                        bgcolor: `${statusColors[order.status]}20`,
                        color: statusColors[order.status],
                        border: `1px solid ${statusColors[order.status]}40`,
                        fontWeight: 'bold'
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={1}>
                    <Box display="flex" gap={1}>
                      <Tooltip title="Voir détails">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsOpen(true);
                            fetchOrderDetails(order.id);
                          }}
                          sx={{
                            bgcolor: '#667eea10',
                            '&:hover': { bgcolor: '#667eea20' }
                          }}
                        >
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setAnchorEl(e.currentTarget);
                          setSelectedOrderId(order.id);
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>
                  </Grid>
                </Grid>

                {/* Order Items Preview */}
                {order.items && order.items.length > 0 && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Grid container spacing={1}>
                      {order.items.slice(0, 3).map((item, idx) => (
                        <Grid item key={idx}>
                          <Chip
                            size="small"
                            label={`${item.product_name} x${item.quantity}`}
                            variant="outlined"
                          />
                        </Grid>
                      ))}
                      {order.items.length > 3 && (
                        <Grid item>
                          <Chip
                            size="small"
                            label={`+${order.items.length - 3} autres`}
                            color="primary"
                            variant="outlined"
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}
              </Paper>
            </motion.div>
          ))
        )}
      </AnimatePresence>

      {/* Status Change Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => (
          <MenuItem
            key={status}
            onClick={() => handleStatusChange(selectedOrderId, status)}
          >
            <Box display="flex" alignItems="center" gap={1}>
              {statusIcons[status]}
              <Typography>{status.toUpperCase()}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <OrderDetailsDialog
        open={detailsOpen}
        order={selectedOrder}
        onClose={() => setDetailsOpen(false)}
        loading={detailsLoading}
      />
    </Box>
  );
}

export default UltraOrders;
