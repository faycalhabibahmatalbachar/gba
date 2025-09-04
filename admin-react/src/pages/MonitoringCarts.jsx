import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Chip,
  IconButton,
  Avatar,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  ShoppingBasket,
  Person,
  TrendingUp,
  Delete,
  Visibility,
  Warning,
  CheckCircle,
  AccessTime,
  Euro,
  RemoveShoppingCart,
  AddShoppingCart,
  Timeline,
  DonutSmall,
} from '@mui/icons-material';
import { supabase } from '../config/supabase';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

const StatCard = ({ title, value, subtitle, icon, color, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -5 }}
    transition={{ duration: 0.3 }}
  >
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={1}>
              {subtitle}
            </Typography>
            {trend && (
              <Chip
                label={trend}
                size="small"
                color={trend.includes('+') ? 'success' : 'error'}
                sx={{ mt: 1 }}
              />
            )}
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

function MonitoringCarts() {
  const [tabValue, setTabValue] = useState(0);
  const [activeCarts, setActiveCarts] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [selectedCart, setSelectedCart] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    abandoned: 0,
    converted: 0,
  });

  useEffect(() => {
    loadCartsData();
  }, []);

  const loadCartsData = async () => {
    setLoading(true);
    try {
      // Charger les paniers actifs
      const { data: cartItems } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (*),
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      // Grouper par utilisateur
      const cartsByUser = {};
      cartItems?.forEach(item => {
        const userId = item.user_id;
        if (!cartsByUser[userId]) {
          cartsByUser[userId] = {
            user: item.profiles,
            items: [],
            total: 0,
            itemCount: 0,
            lastActivity: item.created_at,
          };
        }
        cartsByUser[userId].items.push(item);
        cartsByUser[userId].total += item.products.price * item.quantity;
        cartsByUser[userId].itemCount += item.quantity;
      });

      const activeCartsArray = Object.values(cartsByUser).filter(cart => {
        const hoursSinceActivity = (Date.now() - new Date(cart.lastActivity)) / (1000 * 60 * 60);
        return hoursSinceActivity < 24;
      });

      const abandonedCartsArray = Object.values(cartsByUser).filter(cart => {
        const hoursSinceActivity = (Date.now() - new Date(cart.lastActivity)) / (1000 * 60 * 60);
        return hoursSinceActivity >= 24;
      });

      setActiveCarts(activeCartsArray);
      setAbandonedCarts(abandonedCartsArray);
      setStats({
        total: Object.values(cartsByUser).length,
        active: activeCartsArray.length,
        abandoned: abandonedCartsArray.length,
        converted: Math.floor(activeCartsArray.length * 0.3),
      });
    } catch (error) {
      console.error('Erreur chargement paniers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = async (userId) => {
    try {
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);
      
      loadCartsData();
    } catch (error) {
      console.error('Erreur suppression panier:', error);
    }
  };

  const handleViewDetails = (cart) => {
    setSelectedCart(cart);
    setDetailsOpen(true);
  };

  const popularProductsData = {
    labels: ['T-Shirt Premium', 'Jean Slim', 'Sneakers Sport', 'Montre Classic', 'Sac à Dos'],
    datasets: [{
      data: [45, 32, 28, 21, 18],
      backgroundColor: [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#30cfd0',
        '#ffd93d',
      ],
    }],
  };

  const conversionData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Paniers créés',
        data: [65, 78, 90, 81, 56, 95, 88],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Paniers convertis',
        data: [28, 35, 41, 38, 24, 42, 40],
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const avgCartValueData = {
    labels: ['0-50€', '50-100€', '100-200€', '200-500€', '500€+'],
    datasets: [{
      label: 'Nombre de paniers',
      data: [15, 35, 42, 25, 8],
      backgroundColor: 'rgba(118, 75, 162, 0.8)',
    }],
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Monitoring Paniers
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Surveillance et gestion des paniers clients en temps réel
          </Typography>
        </motion.div>

        <Button
          variant="contained"
          startIcon={<Timeline />}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 3,
          }}
        >
          Exporter Rapport
        </Button>
      </Box>

      {/* Statistiques principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Paniers"
            value={stats.total}
            subtitle="Tous les paniers"
            icon={<ShoppingBasket />}
            color="#667eea"
            trend="+12% ce mois"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Paniers Actifs"
            value={stats.active}
            subtitle="Dernières 24h"
            icon={<AddShoppingCart />}
            color="#48bb78"
            trend="+8% aujourd'hui"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Paniers Abandonnés"
            value={stats.abandoned}
            subtitle="Plus de 24h"
            icon={<RemoveShoppingCart />}
            color="#f56565"
            trend="-5% ce mois"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Taux Conversion"
            value="32%"
            subtitle="Ce mois"
            icon={<TrendingUp />}
            color="#764ba2"
            trend="+3% vs mois dernier"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Paniers Actifs" icon={<ShoppingBasket />} iconPosition="start" />
          <Tab label="Paniers Abandonnés" icon={<Warning />} iconPosition="start" />
          <Tab label="Statistiques" icon={<DonutSmall />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Contenu des tabs */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          {activeCarts.map((cart, index) => (
            <Grid item xs={12} md={6} key={index}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box display="flex" gap={2}>
                        <Avatar sx={{ bgcolor: '#667eea' }}>
                          {cart.user?.full_name?.[0] || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{cart.user?.full_name || 'Utilisateur'}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {cart.user?.email}
                          </Typography>
                          <Box display="flex" gap={2} mt={1}>
                            <Chip
                              size="small"
                              label={`${cart.itemCount} articles`}
                              color="primary"
                            />
                            <Chip
                              size="small"
                              label={`${cart.total.toFixed(2)}€`}
                              color="success"
                            />
                          </Box>
                        </Box>
                      </Box>
                      <Box>
                        <IconButton
                          color="primary"
                          onClick={() => handleViewDetails(cart)}
                        >
                          <Visibility />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleClearCart(cart.user?.id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box display="flex" gap={1} alignItems="center">
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          Dernière activité: il y a 2h
                        </Typography>
                      </Box>
                      <Button size="small" variant="outlined">
                        Envoyer rappel
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Client</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center">Articles</TableCell>
                <TableCell align="right">Valeur</TableCell>
                <TableCell>Abandonné depuis</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {abandonedCarts.map((cart, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {cart.user?.full_name?.[0] || 'U'}
                      </Avatar>
                      {cart.user?.full_name || 'Utilisateur'}
                    </Box>
                  </TableCell>
                  <TableCell>{cart.user?.email}</TableCell>
                  <TableCell align="center">
                    <Chip label={cart.itemCount} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold">{cart.total.toFixed(2)}€</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label="3 jours" color="warning" size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Button size="small" variant="contained" sx={{ mr: 1 }}>
                      Relancer
                    </Button>
                    <IconButton size="small" color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Produits Populaires</Typography>
              <Box height={300}>
                <Doughnut 
                  data={popularProductsData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Taux de Conversion</Typography>
              <Box height={300}>
                <Line 
                  data={conversionData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Valeur Moyenne des Paniers</Typography>
              <Box height={300}>
                <Bar 
                  data={avgCartValueData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Dialog détails panier */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Détails du Panier
        </DialogTitle>
        <DialogContent>
          {selectedCart && (
            <Box>
              <Box display="flex" gap={2} mb={3}>
                <Avatar sx={{ bgcolor: '#667eea', width: 56, height: 56 }}>
                  {selectedCart.user?.full_name?.[0] || 'U'}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedCart.user?.full_name}</Typography>
                  <Typography color="text.secondary">{selectedCart.user?.email}</Typography>
                </Box>
              </Box>
              <List>
                {selectedCart.items.map((item, index) => (
                  <ListItem key={index}>
                    <ListItemAvatar>
                      <Avatar src={item.products?.main_image} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.products?.name}
                      secondary={`${item.quantity} x ${item.products?.price}€`}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="h6">
                        {(item.quantity * item.products?.price).toFixed(2)}€
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
              <Divider />
              <Box display="flex" justifyContent="space-between" mt={2}>
                <Typography variant="h6">Total</Typography>
                <Typography variant="h6" color="primary">
                  {selectedCart.total.toFixed(2)}€
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MonitoringCarts;
