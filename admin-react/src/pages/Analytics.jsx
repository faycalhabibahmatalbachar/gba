import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  AttachMoney,
  People,
  Visibility,
  AccessTime,
  LocationOn,
  Devices,
  MoreVert,
  Download,
  ArrowUpward,
  ArrowDownward,
  Star,
} from '@mui/icons-material';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MetricCard = ({ title, value, change, icon, color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.02 }}
    transition={{ duration: 0.3 }}
  >
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
            <Box display="flex" alignItems="center" gap={0.5} mt={1}>
              {change > 0 ? (
                <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
              )}
              <Typography
                variant="body2"
                color={change > 0 ? 'success.main' : 'error.main'}
              >
                {Math.abs(change)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                vs période précédente
              </Typography>
            </Box>
          </Box>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

function Analytics() {
  const [timeRange, setTimeRange] = useState('month');

  const metrics = [
    {
      title: 'Chiffre d\'affaires',
      value: '124 563 FCFA',
      change: 12.5,
      icon: <AttachMoney />,
      color: '#667eea',
    },
    {
      title: 'Total Commandes',
      value: '8 543',
      change: -3.2,
      icon: <ShoppingCart />,
      color: '#f093fb',
    },
    {
      title: 'Taux de Conversion',
      value: '3,45%',
      change: 8.1,
      icon: <TrendingUp />,
      color: '#30cfd0',
    },
    {
      title: 'Panier Moyen',
      value: '85 500 FCFA',
      change: 15.3,
      icon: <Star />,
      color: '#f5576c',
    },
  ];

  const revenueData = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    datasets: [
      {
        label: 'Chiffre d\'affaires',
        data: [45000, 52000, 48000, 61000, 58000, 67000, 71000, 69000, 73000, 78000, 82000, 91000],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Bénéfice',
        data: [12000, 15000, 13000, 18000, 17000, 21000, 24000, 22000, 25000, 28000, 31000, 35000],
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const salesByCategoryData = {
    labels: ['Électronique', 'Vêtements', 'Maison & Jardin', 'Sports', 'Livres', 'Jouets'],
    datasets: [
      {
        label: 'Ventes',
        data: [35, 25, 20, 10, 7, 3],
        backgroundColor: [
          '#667eea',
          '#764ba2',
          '#f093fb',
          '#f5576c',
          '#30cfd0',
          '#330867',
        ],
      },
    ],
  };

  const trafficSourcesData = {
    labels: ['Recherche Organique', 'Direct', 'Réseaux Sociaux', 'Référencement', 'Email'],
    datasets: [
      {
        label: 'Trafic',
        data: [40, 25, 20, 10, 5],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(118, 75, 162, 0.8)',
          'rgba(240, 147, 251, 0.8)',
          'rgba(245, 87, 108, 0.8)',
          'rgba(48, 207, 208, 0.8)',
        ],
      },
    ],
  };

  const customerSatisfactionData = {
    labels: ['Qualité Produit', 'Livraison', 'Service Client', 'Prix', 'Site Web', 'Global'],
    datasets: [
      {
        label: 'Mois en cours',
        data: [85, 75, 90, 70, 88, 82],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
      },
      {
        label: 'Mois précédent',
        data: [80, 70, 85, 72, 82, 78],
        borderColor: '#f093fb',
        backgroundColor: 'rgba(240, 147, 251, 0.2)',
      },
    ],
  };

  const topProducts = [
    { name: 'Casque Sans Fil Pro', sales: 1234, revenue: '45 234 FCFA', growth: 23 },
    { name: 'Montre Connectée Ultra', sales: 987, revenue: '38 123 FCFA', growth: 15 },
    { name: 'Support Laptop Premium', sales: 756, revenue: '28 456 FCFA', growth: -5 },
    { name: 'Hub USB-C Multi', sales: 623, revenue: '21 789 FCFA', growth: 12 },
    { name: 'Souris Sans Fil Avancée', sales: 512, revenue: '18 234 FCFA', growth: 8 },
  ];

  const topCountries = [
    { name: 'Tchad', visitors: 45234, percentage: 35 },
    { name: 'Cameroun', visitors: 23456, percentage: 18 },
    { name: 'Sénégal', visitors: 18234, percentage: 14 },
    { name: 'Côte d\'Ivoire', visitors: 15678, percentage: 12 },
    { name: 'Mali', visitors: 12345, percentage: 10 },
  ];

  const deviceData = {
    labels: ['Ordinateur', 'Mobile', 'Tablette'],
    datasets: [
      {
        data: [55, 35, 10],
        backgroundColor: ['#667eea', '#f093fb', '#30cfd0'],
      },
    ],
  };

  const hourlyTrafficData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        label: 'Visiteurs',
        data: [120, 98, 87, 76, 65, 78, 145, 234, 345, 456, 512, 534, 498, 476, 512, 534, 567, 543, 487, 398, 312, 234, 187, 145],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
      },
    ],
  };

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Tableau de Bord Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Suivez les performances de votre boutique et les comportements clients
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <FormControl size="small">
              <InputLabel>Période</InputLabel>
              <Select
                value={timeRange}
                label="Période"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="week">7 derniers jours</MenuItem>
                <MenuItem value="month">30 derniers jours</MenuItem>
                <MenuItem value="quarter">Ce trimestre</MenuItem>
                <MenuItem value="year">Cette année</MenuItem>
              </Select>
            </FormControl>
            <IconButton>
              <Download />
            </IconButton>
          </Box>
        </Box>
      </motion.div>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {metrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <MetricCard {...metric} />
          </Grid>
        ))}
      </Grid>

      {/* Revenue Chart */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold">
                Évolution Chiffre d'Affaires & Bénéfice
              </Typography>
              <IconButton size="small">
                <MoreVert />
              </IconButton>
            </Box>
            <Box sx={{ height: 320 }}>
              <Line
                data={revenueData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `${(value / 1000).toFixed(0)}k FCFA`,
                      },
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Ventes par Catégorie
            </Typography>
            <Box sx={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut
                data={salesByCategoryData}
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

      {/* Traffic & Products */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Meilleurs Produits
            </Typography>
            <List>
              {topProducts.map((product, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#667eea' }}>
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={product.name}
                    secondary={`${product.sales} ventes`}
                  />
                  <ListItemSecondaryAction>
                    <Box textAlign="right">
                      <Typography variant="body2" fontWeight="bold">
                        {product.revenue}
                      </Typography>
                      <Box display="flex" alignItems="center" justifyContent="flex-end">
                        {product.growth > 0 ? (
                          <ArrowUpward sx={{ fontSize: 14, color: 'success.main' }} />
                        ) : (
                          <ArrowDownward sx={{ fontSize: 14, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="caption"
                          color={product.growth > 0 ? 'success.main' : 'error.main'}
                        >
                          {Math.abs(product.growth)}%
                        </Typography>
                      </Box>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Sources de Trafic
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar
                data={trafficSourcesData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `${value} %`,
                      },
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Geographic & Device Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Principaux Pays
            </Typography>
            <List>
              {topCountries.map((country, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <LocationOn />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={country.name}
                    secondary={`${country.visitors.toLocaleString('fr-FR')} visiteurs`}
                  />
                  <Box sx={{ width: 100 }}>
                    <LinearProgress
                      variant="determinate"
                      value={country.percentage}
                      sx={{ mb: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {country.percentage}%
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Appareils Utilisés
            </Typography>
            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut
                data={deviceData}
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

      {/* Customer Satisfaction & Hourly Traffic */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Satisfaction Client
            </Typography>
            <Box sx={{ height: 300 }}>
              <Radar
                data={customerSatisfactionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    r: {
                      beginAtZero: true,
                      max: 100,
                    },
                  },
                }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Trafic Horaire
            </Typography>
            <Box sx={{ height: 300 }}>
              <Line
                data={hourlyTrafficData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false,
                    },
                  },
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
    </Box>
  );
}

export default Analytics;
