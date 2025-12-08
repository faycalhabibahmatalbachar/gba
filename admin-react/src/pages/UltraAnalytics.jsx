import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Avatar,
  IconButton,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  CircularProgress,
  Fade,
  Zoom,
  Grow,
  Badge
} from '@mui/material';
import {
  ShoppingCart,
  Favorite,
  Visibility,
  Person,
  Lock,
  Inventory,
  Message,
  Search,
  TrendingUp,
  TrendingDown,
  Timer,
  People,
  AttachMoney,
  Assessment,
  Speed,
  Timeline,
  Refresh,
  FilterList,
  Download,
  CalendarToday,
  MouseOutlined,
  TouchApp,
  Category,
  CreditCard,
  Cancel,
  CheckCircle,
  Star,
  Share,
  PhoneAndroid,
  Computer
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
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
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { supabase } from '../config/supabase';
import { useSnackbar } from 'notistack';

// Register ChartJS components
try {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    RadialLinearScale,
    Title,
    ChartTooltip,
    Legend,
    Filler
  );
} catch (error) {
  console.error('ChartJS registration error:', error);
}

// Action type mapping with icons and colors
const actionTypeConfig = {
  cart_add: { icon: <ShoppingCart />, label: 'Ajout panier', color: '#4CAF50' },
  cart_remove: { icon: <ShoppingCart />, label: 'Retrait panier', color: '#F44336' },
  favorite_add: { icon: <Favorite />, label: 'Ajout favoris', color: '#E91E63' },
  favorite_remove: { icon: <Favorite />, label: 'Retrait favoris', color: '#9E9E9E' },
  product_view: { icon: <Visibility />, label: 'Produit consulté', color: '#2196F3' },
  profile_update: { icon: <Person />, label: 'Profil mis à jour', color: '#9C27B0' },
  login: { icon: <Lock />, label: 'Connexion', color: '#00BCD4' },
  logout: { icon: <Lock />, label: 'Déconnexion', color: '#607D8B' },
  order_placed: { icon: <Inventory />, label: 'Commande passée', color: '#FF9800' },
  message_sent: { icon: <Message />, label: 'Message envoyé', color: '#3F51B5' },
  search: { icon: <Search />, label: 'Recherche', color: '#795548' },
  category_view: { icon: <Category />, label: 'Catégorie vue', color: '#009688' },
  checkout_started: { icon: <CreditCard />, label: 'Checkout commencé', color: '#FFC107' },
  checkout_abandoned: { icon: <Cancel />, label: 'Checkout abandonné', color: '#F44336' },
  payment_completed: { icon: <CheckCircle />, label: 'Paiement effectué', color: '#4CAF50' },
  review_posted: { icon: <Star />, label: 'Avis posté', color: '#FFD700' },
  share_product: { icon: <Share />, label: 'Produit partagé', color: '#673AB7' },
  app_opened: { icon: <PhoneAndroid />, label: 'App ouverte', color: '#00E676' },
  app_closed: { icon: <PhoneAndroid />, label: 'App fermée', color: '#FF5252' }
};

function UltraAnalytics() {
  const [realtimeData, setRealtimeData] = useState({
    activeUsers: 0,
    activeSessions: 0,
    actionsLastHour: 0,
    actionsToday: 0,
    topAction: '',
    topPage: ''
  });
  
  const [activities, setActivities] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [conversionData, setConversionData] = useState([]);
  const [userMetrics, setUserMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchAllData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, 30000);
    
    // Realtime subscription with error handling
    let subscription;
    try {
      subscription = supabase
        .channel('activities_channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities'
        }, (payload) => {
          if (payload.new) {
            setActivities(prev => [payload.new, ...prev].slice(0, 50));
            fetchRealtimeData();
          }
        })
        .subscribe();
    } catch (error) {
      console.error('Subscription error:', error);
    }
    
    return () => {
      clearInterval(interval);
      if (subscription) subscription.unsubscribe();
    };
  }, [timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchRealtimeData(),
      fetchActivities(),
      fetchTopProducts(),
      fetchConversionData(),
      fetchUserMetrics()
    ]);
    setLoading(false);
  };

  const fetchRealtimeData = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_realtime_analytics');
      
      if (error) {
        console.error('RPC error:', error);
        // Set default values if function doesn't exist yet
        setRealtimeData({
          activeUsers: 0,
          activeSessions: 0,
          actionsLastHour: 0,
          actionsToday: 0,
          topAction: 'N/A',
          topPage: 'N/A'
        });
        return;
      }
      if (data && data[0]) {
        setRealtimeData({
          activeUsers: data[0].active_users_now || 0,
          activeSessions: data[0].active_sessions || 0,
          actionsLastHour: data[0].actions_last_hour || 0,
          actionsToday: data[0].actions_today || 0,
          topAction: data[0].top_action_type || 'N/A',
          topPage: data[0].top_page || 'N/A'
        });
      }
    } catch (error) {
      console.error('Error fetching realtime data:', error);
      setRealtimeData({
        activeUsers: 0,
        activeSessions: 0,
        actionsLastHour: 0,
        actionsToday: 0,
        topAction: 'N/A',
        topPage: 'N/A'
      });
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Activities fetch error:', error);
        setActivities([]);
        return;
      }
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('top_viewed_products')
        .select('*')
        .limit(10);
      
      if (error) {
        console.error('Top products error:', error);
        setTopProducts([]);
        return;
      }
      setTopProducts(data || []);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setTopProducts([]);
    }
  };

  const fetchConversionData = async () => {
    try {
      const { data, error } = await supabase
        .from('conversion_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);
      
      if (error) {
        console.error('Conversion data error:', error);
        setConversionData([]);
        return;
      }
      setConversionData(data || []);
    } catch (error) {
      console.error('Error fetching conversion data:', error);
      setConversionData([]);
    }
  };

  const fetchUserMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_metrics')
        .select(`
          *,
          profiles:user_id (
            email,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('period_type', 'all_time')
        .order('total_actions', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('User metrics error:', error);
        setUserMetrics([]);
        return;
      }
      setUserMetrics(data || []);
    } catch (error) {
      console.error('Error fetching user metrics:', error);
      setUserMetrics([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
    enqueueSnackbar('Données actualisées', { variant: 'success' });
  };

  // Chart data preparation
  const conversionChartData = {
    labels: conversionData.slice(0, 7).reverse().map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' })
    ),
    datasets: [
      {
        label: 'Taux de conversion',
        data: conversionData.slice(0, 7).reverse().map(d => d.overall_conversion_rate),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Panier → Checkout',
        data: conversionData.slice(0, 7).reverse().map(d => d.cart_to_checkout_rate),
        borderColor: '#48bb78',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const activityDistributionData = {
    labels: Object.values(actionTypeConfig).slice(0, 6).map(c => c.label),
    datasets: [{
      data: [45, 30, 25, 20, 15, 10],
      backgroundColor: Object.values(actionTypeConfig).slice(0, 6).map(c => c.color),
      borderWidth: 0
    }]
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              📊 Analytics Dashboard
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Surveillance en temps réel des activités utilisateurs
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="today">Aujourd'hui</MenuItem>
                <MenuItem value="week">Cette semaine</MenuItem>
                <MenuItem value="month">Ce mois</MenuItem>
                <MenuItem value="year">Cette année</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={refreshing ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              Actualiser
            </Button>
            <Button variant="contained" startIcon={<Download />}>
              Exporter
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Realtime Metrics */}
      <Grid container spacing={3} mb={3}>
        {[
          { label: 'Utilisateurs actifs', value: realtimeData.activeUsers, icon: <People />, color: '#667eea', trend: '+12%' },
          { label: 'Sessions actives', value: realtimeData.activeSessions, icon: <TouchApp />, color: '#48bb78', trend: '+8%' },
          { label: 'Actions (1h)', value: realtimeData.actionsLastHour, icon: <Speed />, color: '#f6ad55', trend: '+25%' },
          { label: "Actions aujourd'hui", value: realtimeData.actionsToday, icon: <Timeline />, color: '#fc8181', trend: '+15%' }
        ].map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Zoom in={true} style={{ transitionDelay: `${index * 100}ms` }}>
              <Card sx={{
                background: `linear-gradient(135deg, ${metric.color}15 0%, ${metric.color}30 100%)`,
                border: `1px solid ${metric.color}40`,
                position: 'relative',
                overflow: 'visible'
              }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        {metric.label}
                      </Typography>
                      <Typography variant="h3" fontWeight="bold" color={metric.color}>
                        {metric.value.toLocaleString()}
                      </Typography>
                      <Chip
                        label={metric.trend}
                        size="small"
                        icon={<TrendingUp />}
                        sx={{ mt: 1, bgcolor: `${metric.color}20`, color: metric.color }}
                      />
                    </Box>
                    <Avatar sx={{ bgcolor: metric.color, width: 56, height: 56 }}>
                      {metric.icon}
                    </Avatar>
                  </Box>
                </CardContent>
                <LinearProgress
                  variant="determinate"
                  value={75}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    bgcolor: `${metric.color}20`,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: metric.color
                    }
                  }}
                />
              </Card>
            </Zoom>
          </Grid>
        ))}
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              📈 Taux de Conversion
            </Typography>
            <Box height={300}>
              <Line
                data={conversionChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top'
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        callback: (value) => `${value}%`
                      }
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              🎯 Distribution des Actions
            </Typography>
            <Box height={300}>
              <Doughnut
                data={activityDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Activity Feed & Top Products */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3, maxHeight: 500, overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              ⚡ Activités en Temps Réel
            </Typography>
            <List>
              <AnimatePresence>
                {activities.map((activity, index) => {
                  const config = actionTypeConfig[activity.action_type] || {};
                  const user = activity.profiles;
                  
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ListItem>
                        <ListItemAvatar>
                          <Badge
                            badgeContent={
                              <Avatar sx={{ width: 20, height: 20, bgcolor: config.color }}>
                                {React.cloneElement(config.icon || <MouseOutlined />, { sx: { fontSize: 12 } })}
                              </Avatar>
                            }
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          >
                            <Avatar src={user?.avatar_url}>
                              {user?.first_name?.[0] || user?.email?.[0]}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" fontWeight="medium">
                                {user?.first_name} {user?.last_name}
                              </Typography>
                              <Chip
                                label={config.label}
                                size="small"
                                sx={{
                                  bgcolor: `${config.color}20`,
                                  color: config.color,
                                  fontWeight: 'bold'
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              {activity.entity_name && (
                                <Typography variant="caption" color="textSecondary">
                                  {activity.entity_name}
                                </Typography>
                              )}
                              <Typography variant="caption" color="textSecondary" display="block">
                                {new Date(activity.created_at).toLocaleString('fr-FR')}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < activities.length - 1 && <Divider />}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom>
              🏆 Top Produits Consultés
            </Typography>
            <List>
              {topProducts.map((product, index) => (
                <ListItem key={product.product_id}>
                  <ListItemAvatar>
                    <Avatar sx={{
                      bgcolor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : '#667eea',
                      width: 36,
                      height: 36
                    }}>
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={product.product_name}
                    secondary={
                      <Box display="flex" gap={2}>
                        <Chip
                          icon={<Visibility />}
                          label={`${product.view_count} vues`}
                          size="small"
                        />
                        <Chip
                          icon={<People />}
                          label={`${product.unique_viewers} visiteurs`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                  <Box textAlign="right">
                    <LinearProgress
                      variant="determinate"
                      value={(product.view_count / topProducts[0]?.view_count) * 100}
                      sx={{ width: 60, mb: 0.5 }}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {((product.view_count / topProducts[0]?.view_count) * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              👥 Utilisateurs les Plus Actifs
            </Typography>
            <List>
              {userMetrics.slice(0, 5).map((user, index) => (
                <ListItem key={user.user_id}>
                  <ListItemAvatar>
                    <Avatar src={user.profiles?.avatar_url}>
                      {user.profiles?.first_name?.[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${user.profiles?.first_name} ${user.profiles?.last_name}`}
                    secondary={
                      <Box>
                        <Typography variant="caption">
                          {user.total_actions} actions • Score: {Math.min(100, user.total_actions * 2)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, user.total_actions * 2)}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default UltraAnalytics;
