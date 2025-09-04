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
  TextField,
  InputAdornment,
  LinearProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
} from '@mui/material';
import {
  Inventory,
  TrendingUp,
  TrendingDown,
  Warning,
  Search,
  FilterList,
  MoreVert,
  ShoppingCart,
  Favorite,
  Visibility,
  Star,
  Edit,
  Delete,
  LocalOffer,
  Category,
  Assessment,
  CloudUpload,
} from '@mui/icons-material';
import { supabase } from '../config/supabase';
import { Line, Bar, Scatter, PolarArea } from 'react-chartjs-2';

const StatCard = ({ title, value, subtitle, icon, color, trend, alert }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -8, scale: 1.02 }}
    transition={{ duration: 0.3 }}
  >
    <Card 
      sx={{ 
        height: '100%', 
        position: 'relative',
        border: alert ? '2px solid' : 'none',
        borderColor: alert ? 'warning.main' : 'transparent',
        background: alert ? 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' : 'inherit',
      }}
    >
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
              <Box display="flex" gap={1} mt={1}>
                {trend > 0 ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : (
                  <TrendingDown color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={trend > 0 ? 'success.main' : 'error.main'}
                  fontWeight="bold"
                >
                  {Math.abs(trend)}%
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {alert ? <Badge badgeContent="!" color="error">{icon}</Badge> : icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

const ProductRow = ({ product, index, onAction }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  
  const stockStatus = product.quantity <= 5 ? 'error' : 
                      product.quantity <= 20 ? 'warning' : 'success';
  
  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <TableRow hover>
        <TableCell>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar 
              src={product.main_image} 
              variant="rounded"
              sx={{ width: 48, height: 48 }}
            />
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {product.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                SKU: {product.id?.substring(0, 8)}
              </Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Chip label={product.category_name || 'Non catégorisé'} size="small" />
        </TableCell>
        <TableCell align="right">
          <Typography variant="body1" fontWeight="bold" color="primary">
            {product.price}€
          </Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={product.quantity}
            size="small"
            color={stockStatus}
            icon={stockStatus === 'error' ? <Warning /> : null}
          />
        </TableCell>
        <TableCell align="center">
          <Box display="flex" alignItems="center" gap={0.5}>
            <ShoppingCart fontSize="small" color="action" />
            <Typography variant="body2">{product.cart_count || 0}</Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Favorite fontSize="small" color="error" />
            <Typography variant="body2">{product.favorite_count || 0}</Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Visibility fontSize="small" color="action" />
            <Typography variant="body2">{product.views || 0}</Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Rating value={product.rating || 0} size="small" readOnly />
            <Typography variant="caption">({product.reviews || 0})</Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <MoreVert />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => { onAction('edit', product); setAnchorEl(null); }}>
              <Edit fontSize="small" sx={{ mr: 1 }} /> Modifier
            </MenuItem>
            <MenuItem onClick={() => { onAction('stock', product); setAnchorEl(null); }}>
              <Inventory fontSize="small" sx={{ mr: 1 }} /> Gérer Stock
            </MenuItem>
            <MenuItem onClick={() => { onAction('promo', product); setAnchorEl(null); }}>
              <LocalOffer fontSize="small" sx={{ mr: 1 }} /> Promotion
            </MenuItem>
            <MenuItem 
              onClick={() => { onAction('delete', product); setAnchorEl(null); }}
              sx={{ color: 'error.main' }}
            >
              <Delete fontSize="small" sx={{ mr: 1 }} /> Supprimer
            </MenuItem>
          </Menu>
        </TableCell>
      </TableRow>
    </motion.tr>
  );
};

function MonitoringProducts() {
  const [tabValue, setTabValue] = useState(0);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStock: 0,
    avgPrice: 0,
    totalValue: 0,
    outOfStock: 0,
    topCategory: '',
  });

  useEffect(() => {
    loadProductsData();
  }, []);

  const loadProductsData = async () => {
    setLoading(true);
    try {
      // Charger tous les produits avec relations
      const { data: products } = await supabase
        .from('products')
        .select(`
          *,
          categories (name),
          cart_items (quantity),
          favorites (id)
        `)
        .order('created_at', { ascending: false });

      // Calculer statistiques
      const processedProducts = products?.map(p => ({
        ...p,
        category_name: p.categories?.name,
        cart_count: p.cart_items?.reduce((acc, item) => acc + item.quantity, 0) || 0,
        favorite_count: p.favorites?.length || 0,
        views: Math.floor(Math.random() * 1000), // Simulé
        rating: 3 + Math.random() * 2, // Simulé
        reviews: Math.floor(Math.random() * 100), // Simulé
      })) || [];

      const lowStockCount = processedProducts.filter(p => p.quantity <= 20).length;
      const outOfStockCount = processedProducts.filter(p => p.quantity === 0).length;
      const avgPrice = processedProducts.reduce((acc, p) => acc + parseFloat(p.price), 0) / Math.max(processedProducts.length, 1);
      const totalValue = processedProducts.reduce((acc, p) => acc + (parseFloat(p.price) * p.quantity), 0);

      setProducts(processedProducts);
      setStats({
        totalProducts: processedProducts.length,
        lowStock: lowStockCount,
        avgPrice: Math.round(avgPrice),
        totalValue: Math.round(totalValue),
        outOfStock: outOfStockCount,
        topCategory: 'Mode',
      });
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductAction = (action, product) => {
    setSelectedProduct(product);
    setActionDialog({ open: true, type: action });
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const performanceData = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
    datasets: [
      {
        label: 'Ventes',
        data: [420, 480, 510, 490, 550, 580],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Stock moyen',
        data: [80, 75, 78, 72, 68, 65],
        borderColor: '#ffd93d',
        backgroundColor: 'rgba(255, 217, 61, 0.1)',
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const categoryPerformance = {
    labels: ['Mode', 'Électronique', 'Maison', 'Sport', 'Beauté'],
    datasets: [{
      label: 'Performance',
      data: [88, 75, 62, 71, 55],
      backgroundColor: [
        'rgba(102, 126, 234, 0.8)',
        'rgba(118, 75, 162, 0.8)',
        'rgba(240, 147, 251, 0.8)',
        'rgba(48, 207, 208, 0.8)',
        'rgba(255, 217, 61, 0.8)',
      ],
    }],
  };

  const stockDistribution = {
    datasets: [{
      label: 'Stock vs Prix',
      data: products.map(p => ({
        x: parseFloat(p.price),
        y: p.quantity,
        r: Math.sqrt(p.favorite_count) * 3,
      })),
      backgroundColor: 'rgba(233, 30, 99, 0.6)',
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
            Monitoring Produits
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Analyse complète et gestion de votre catalogue produits
          </Typography>
        </motion.div>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            sx={{ borderRadius: 3 }}
          >
            Import CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<Assessment />}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 3,
            }}
          >
            Rapport Détaillé
          </Button>
        </Box>
      </Box>

      {/* Alertes */}
      {stats.outOfStock > 0 && (
        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small">
              Voir produits
            </Button>
          }
        >
          <strong>{stats.outOfStock} produits en rupture de stock!</strong> Action immédiate requise.
        </Alert>
      )}

      {/* Statistiques principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Total Produits"
            value={stats.totalProducts}
            subtitle="En catalogue"
            icon={<Inventory />}
            color="#667eea"
            trend={12}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Stock Faible"
            value={stats.lowStock}
            subtitle="< 20 unités"
            icon={<Warning />}
            color="#ff9800"
            alert={stats.lowStock > 10}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Rupture Stock"
            value={stats.outOfStock}
            subtitle="À réapprovisionner"
            icon={<Warning />}
            color="#f44336"
            alert={stats.outOfStock > 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Prix Moyen"
            value={`${stats.avgPrice}€`}
            subtitle="Tous produits"
            icon={<LocalOffer />}
            color="#4caf50"
            trend={-3}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Valeur Stock"
            value={`${stats.totalValue}€`}
            subtitle="Total inventaire"
            icon={<TrendingUp />}
            color="#764ba2"
            trend={18}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <StatCard
            title="Top Catégorie"
            value={stats.topCategory}
            subtitle="Plus vendue"
            icon={<Category />}
            color="#30cfd0"
            trend={25}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Inventaire" icon={<Inventory />} iconPosition="start" />
          <Tab label="Performance" icon={<TrendingUp />} iconPosition="start" />
          <Tab label="Analyse" icon={<Assessment />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Contenu des tabs */}
      {tabValue === 0 && (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box display="flex" gap={2} alignItems="center">
              <TextField
                placeholder="Rechercher un produit..."
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              <Button startIcon={<FilterList />} variant="outlined">
                Filtres
              </Button>
            </Box>
          </Paper>

          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Produit</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Prix</TableCell>
                    <TableCell align="center">Stock</TableCell>
                    <TableCell align="center">Paniers</TableCell>
                    <TableCell align="center">Favoris</TableCell>
                    <TableCell align="center">Vues</TableCell>
                    <TableCell align="center">Note</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.slice(0, 10).map((product, index) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      index={index}
                      onAction={handleProductAction}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance des Ventes et Stock
              </Typography>
              <Box height={400}>
                <Line
                  data={performanceData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                      mode: 'index',
                      intersect: false,
                    },
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Ventes (unités)',
                        },
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Stock moyen',
                        },
                        grid: {
                          drawOnChartArea: false,
                        },
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance par Catégorie
              </Typography>
              <Box height={400}>
                <PolarArea
                  data={categoryPerformance}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Analyse Stock vs Prix (taille = popularité)
              </Typography>
              <Box height={500}>
                <Scatter
                  data={stockDistribution}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Prix (€)',
                        },
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'Quantité en stock',
                        },
                      },
                    },
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const product = products[context.dataIndex];
                            return [
                              `${product.name}`,
                              `Prix: ${product.price}€`,
                              `Stock: ${product.quantity}`,
                              `Favoris: ${product.favorite_count}`,
                            ];
                          },
                        },
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Dialog d'action */}
      <Dialog 
        open={actionDialog.open} 
        onClose={() => setActionDialog({ open: false, type: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === 'edit' && 'Modifier le produit'}
          {actionDialog.type === 'stock' && 'Gérer le stock'}
          {actionDialog.type === 'promo' && 'Créer une promotion'}
          {actionDialog.type === 'delete' && 'Supprimer le produit'}
        </DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Avatar
                  src={selectedProduct.main_image}
                  variant="rounded"
                  sx={{ width: 60, height: 60 }}
                />
                <Box>
                  <Typography variant="h6">{selectedProduct.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedProduct.category_name} - {selectedProduct.price}€
                  </Typography>
                </Box>
              </Box>

              {actionDialog.type === 'stock' && (
                <TextField
                  fullWidth
                  label="Nouvelle quantité"
                  type="number"
                  defaultValue={selectedProduct.quantity}
                  variant="outlined"
                />
              )}

              {actionDialog.type === 'promo' && (
                <Box display="flex" gap={2}>
                  <TextField
                    label="Réduction (%)"
                    type="number"
                    variant="outlined"
                  />
                  <TextField
                    label="Date fin"
                    type="date"
                    variant="outlined"
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              )}

              {actionDialog.type === 'delete' && (
                <Alert severity="error">
                  Cette action est irréversible. Le produit sera définitivement supprimé.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, type: null })}>
            Annuler
          </Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'delete' ? 'error' : 'primary'}
          >
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MonitoringProducts;
