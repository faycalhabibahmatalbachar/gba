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
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Rating,
  Tooltip,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  Person,
  TrendingUp,
  Delete,
  Visibility,
  Star,
  Timeline,
  DonutSmall,
  BarChart,
  PieChart,
  AutoGraph,
} from '@mui/icons-material';
import { supabase } from '../config/supabase';
import { Line, Doughnut, Bar, Radar } from 'react-chartjs-2';

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

const ProductCard = ({ product, onRemove }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    transition={{ duration: 0.2 }}
  >
    <Card>
      <CardContent>
        <Box display="flex" gap={2}>
          <Avatar
            src={product.image}
            variant="rounded"
            sx={{ width: 80, height: 80 }}
          />
          <Box flex={1}>
            <Typography variant="h6" gutterBottom>{product.name}</Typography>
            <Box display="flex" gap={1} alignItems="center" mb={1}>
              <Rating value={product.rating} readOnly size="small" />
              <Typography variant="body2" color="text.secondary">
                ({product.reviews})
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Chip
                icon={<Favorite />}
                label={`${product.favorites} favoris`}
                size="small"
                color="error"
                variant="outlined"
              />
              <Chip
                label={product.category}
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" gap={1}>
            <Typography variant="h6" color="primary">
              {product.price}€
            </Typography>
            <IconButton
              size="small"
              color="error"
              onClick={() => onRemove(product.id)}
            >
              <Delete />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

function MonitoringFavorites() {
  const [tabValue, setTabValue] = useState(0);
  const [favoritesByUser, setFavoritesByUser] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFavorites: 0,
    activeUsers: 0,
    avgPerUser: 0,
    topCategory: '',
  });

  useEffect(() => {
    loadFavoritesData();
  }, []);

  const loadFavoritesData = async () => {
    setLoading(true);
    try {
      // Charger tous les favoris
      const { data: favorites } = await supabase
        .from('favorites')
        .select(`
          *,
          products (*),
          profiles (*)
        `)
        .order('created_at', { ascending: false });

      // Grouper par utilisateur
      const userGroups = {};
      const productCounts = {};
      
      favorites?.forEach(fav => {
        // Grouper par utilisateur
        const userId = fav.user_id;
        if (!userGroups[userId]) {
          userGroups[userId] = {
            user: fav.profiles,
            favorites: [],
            count: 0,
          };
        }
        userGroups[userId].favorites.push(fav);
        userGroups[userId].count++;

        // Compter les produits
        const productId = fav.product_id;
        if (!productCounts[productId]) {
          productCounts[productId] = {
            product: fav.products,
            count: 0,
          };
        }
        productCounts[productId].count++;
      });

      // Top produits
      const sortedProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setFavoritesByUser(Object.values(userGroups));
      setTopProducts(sortedProducts);
      
      setStats({
        totalFavorites: favorites?.length || 0,
        activeUsers: Object.keys(userGroups).length,
        avgPerUser: Math.round((favorites?.length || 0) / Math.max(Object.keys(userGroups).length, 1)),
        topCategory: 'Mode',
      });
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (userId, productId) => {
    try {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
      
      loadFavoritesData();
    } catch (error) {
      console.error('Erreur suppression favori:', error);
    }
  };

  const handleViewUserDetails = (user) => {
    setSelectedUser(user);
    setDetailsOpen(true);
  };

  const categoriesData = {
    labels: ['Mode', 'Électronique', 'Maison', 'Sport', 'Beauté', 'Livres'],
    datasets: [{
      data: [35, 25, 18, 12, 8, 2],
      backgroundColor: [
        '#667eea',
        '#764ba2',
        '#f093fb',
        '#30cfd0',
        '#ffd93d',
        '#6dd5ed',
      ],
    }],
  };

  const trendData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Nouveaux favoris',
        data: [45, 52, 48, 65, 71, 89, 95],
        borderColor: '#e91e63',
        backgroundColor: 'rgba(233, 30, 99, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Favoris retirés',
        data: [12, 15, 10, 18, 14, 20, 16],
        borderColor: '#9e9e9e',
        backgroundColor: 'rgba(158, 158, 158, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const userEngagementData = {
    labels: ['0-5', '6-10', '11-20', '21-50', '50+'],
    datasets: [{
      label: 'Nombre d\'utilisateurs',
      data: [120, 85, 45, 22, 8],
      backgroundColor: 'rgba(102, 126, 234, 0.8)',
      borderColor: '#667eea',
      borderWidth: 2,
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
            Monitoring Favoris
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Analyse et gestion des produits favoris des utilisateurs
          </Typography>
        </motion.div>

        <Button
          variant="contained"
          startIcon={<Timeline />}
          sx={{
            background: 'linear-gradient(135deg, #e91e63 0%, #f06292 100%)',
            borderRadius: 3,
          }}
        >
          Exporter Analyse
        </Button>
      </Box>

      {/* Statistiques principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Favoris"
            value={stats.totalFavorites}
            subtitle="Tous produits confondus"
            icon={<Favorite />}
            color="#e91e63"
            trend="+18% ce mois"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Utilisateurs Actifs"
            value={stats.activeUsers}
            subtitle="Avec des favoris"
            icon={<Person />}
            color="#667eea"
            trend="+12% cette semaine"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Moyenne/Utilisateur"
            value={stats.avgPerUser}
            subtitle="Favoris par personne"
            icon={<AutoGraph />}
            color="#764ba2"
            trend="+3 vs mois dernier"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Catégorie Top"
            value={stats.topCategory}
            subtitle="La plus aimée"
            icon={<Star />}
            color="#ffd93d"
            trend="35% des favoris"
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Top Produits" icon={<Star />} iconPosition="start" />
          <Tab label="Par Utilisateur" icon={<Person />} iconPosition="start" />
          <Tab label="Statistiques" icon={<BarChart />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Contenu des tabs */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              Produits les Plus Aimés
            </Typography>
            <Grid container spacing={2}>
              {topProducts.map((item, index) => (
                <Grid item xs={12} key={index}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <ProductCard
                      product={{
                        id: item.product.id,
                        name: item.product.name,
                        image: item.product.main_image,
                        price: item.product.price,
                        rating: 4.5,
                        reviews: 128,
                        favorites: item.count,
                        category: 'Mode',
                      }}
                      onRemove={() => {}}
                    />
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Répartition par Catégorie
              </Typography>
              <Box height={300}>
                <Doughnut
                  data={categoriesData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center">Nombre Favoris</TableCell>
                <TableCell>Date Inscription</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {favoritesByUser.map((userGroup, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {userGroup.user?.full_name?.[0] || 'U'}
                      </Avatar>
                      {userGroup.user?.full_name || 'Utilisateur'}
                    </Box>
                  </TableCell>
                  <TableCell>{userGroup.user?.email}</TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={<Favorite />}
                      label={userGroup.count}
                      color="error"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(userGroup.user?.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Voir détails">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleViewUserDetails(userGroup)}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer tous">
                      <IconButton size="small" color="error">
                        <Delete />
                      </IconButton>
                    </Tooltip>
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
              <Typography variant="h6" gutterBottom>
                Évolution des Favoris
              </Typography>
              <Box height={300}>
                <Line
                  data={trendData}
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
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Distribution par Utilisateur
              </Typography>
              <Box height={300}>
                <Bar
                  data={userEngagementData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Nombre d\'utilisateurs',
                        },
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Nombre de favoris',
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

      {/* Dialog détails utilisateur */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: '#e91e63' }}>
              {selectedUser?.user?.full_name?.[0] || 'U'}
            </Avatar>
            <Box>
              <Typography variant="h6">{selectedUser?.user?.full_name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUser?.user?.email}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {selectedUser?.count} produits en favoris
          </Typography>
          <List>
            {selectedUser?.favorites.map((fav, index) => (
              <ListItem key={index}>
                <ListItemAvatar>
                  <Avatar src={fav.products?.main_image} variant="rounded" />
                </ListItemAvatar>
                <ListItemText
                  primary={fav.products?.name}
                  secondary={`${fav.products?.price}€ - Ajouté le ${new Date(fav.created_at).toLocaleDateString()}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    color="error"
                    onClick={() => handleRemoveFavorite(fav.user_id, fav.product_id)}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Fermer</Button>
          <Button color="error" startIcon={<Delete />}>
            Supprimer Tous
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MonitoringFavorites;
