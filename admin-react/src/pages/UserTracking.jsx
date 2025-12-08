import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  LinearProgress,
  IconButton,
  Button,
  Alert,
  Badge,
  Tabs,
  Tab
} from '@mui/material';
import {
  ArrowBack,
  ShoppingCart,
  Favorite,
  Visibility,
  Person,
  Lock,
  Inventory,
  Message,
  Search,
  TrendingUp,
  AccessTime,
  TouchApp,
  Category,
  CreditCard,
  Cancel,
  CheckCircle,
  Star,
  Share,
  PhoneAndroid,
  Timeline as TimelineIcon,
  Psychology,
  DataUsage,
  DeviceHub,
  Map,
  Fingerprint,
  Refresh,
  Download,
  WifiTethering,
  AttachMoney,
  MouseOutlined
} from '@mui/icons-material';
import { Line, Doughnut, Radar } from 'react-chartjs-2';
import { supabase } from '../config/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// Action configurations
const actionConfig = {
  cart_add: { icon: <ShoppingCart />, label: 'Ajout panier', color: '#4CAF50', weight: 5 },
  cart_remove: { icon: <ShoppingCart />, label: 'Retrait panier', color: '#F44336', weight: 2 },
  favorite_add: { icon: <Favorite />, label: 'Ajout favoris', color: '#E91E63', weight: 3 },
  favorite_remove: { icon: <Favorite />, label: 'Retrait favoris', color: '#9E9E9E', weight: 1 },
  product_view: { icon: <Visibility />, label: 'Produit consulté', color: '#2196F3', weight: 2 },
  profile_update: { icon: <Person />, label: 'Profil mis à jour', color: '#9C27B0', weight: 3 },
  login: { icon: <Lock />, label: 'Connexion', color: '#00BCD4', weight: 2 },
  logout: { icon: <Lock />, label: 'Déconnexion', color: '#607D8B', weight: 1 },
  order_placed: { icon: <Inventory />, label: 'Commande passée', color: '#FF9800', weight: 10 },
  message_sent: { icon: <Message />, label: 'Message envoyé', color: '#3F51B5', weight: 3 },
  search: { icon: <Search />, label: 'Recherche', color: '#795548', weight: 1 },
  category_view: { icon: <Category />, label: 'Catégorie vue', color: '#009688', weight: 1 },
  checkout_started: { icon: <CreditCard />, label: 'Checkout commencé', color: '#FFC107', weight: 4 },
  checkout_abandoned: { icon: <Cancel />, label: 'Checkout abandonné', color: '#F44336', weight: -5 },
  payment_completed: { icon: <CheckCircle />, label: 'Paiement effectué', color: '#4CAF50', weight: 8 },
  review_posted: { icon: <Star />, label: 'Avis posté', color: '#FFD700', weight: 6 },
  share_product: { icon: <Share />, label: 'Produit partagé', color: '#673AB7', weight: 4 },
  app_opened: { icon: <PhoneAndroid />, label: 'App ouverte', color: '#00E676', weight: 1 },
  app_closed: { icon: <PhoneAndroid />, label: 'App fermée', color: '#FF5252', weight: 0 }
};

function UserTracking() {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activities, setActivities] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [digitalFootprint, setDigitalFootprint] = useState(null);
  const [liveActivity, setLiveActivity] = useState(null);
  
  useEffect(() => {
    if (userId) {
      fetchAllData();
      
      const subscription = supabase
        .channel(`user_tracking_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'user_activities',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          setLiveActivity(payload.new);
          setActivities(prev => [payload.new, ...prev].slice(0, 100));
        })
        .subscribe();
      
      const interval = setInterval(() => {
        fetchMetrics();
      }, 10000);
      
      return () => {
        subscription.unsubscribe();
        clearInterval(interval);
      };
    }
  }, [userId]);
  
  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUser(),
        fetchActivities(),
        fetchSessions(),
        fetchMetrics(),
        buildDigitalFootprint()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };
  
  const fetchUser = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setUser(data);
  };
  
  const fetchActivities = async () => {
    const { data } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    setActivities(data || []);
  };
  
  const fetchSessions = async () => {
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(30);
    setSessions(data || []);
  };
  
  const fetchMetrics = async () => {
    const { data } = await supabase
      .from('user_activity_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'all_time')
      .single();
    setMetrics(data);
  };
  
  const buildDigitalFootprint = async () => {
    const { data: activities } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', userId);
    
    const footprint = {
      totalInteractions: activities?.length || 0,
      uniqueProducts: new Set(),
      uniqueCategories: new Set(),
      searchQueries: [],
      favoriteProducts: [],
      messagingActivity: 0,
      socialShares: 0,
      reviewsPosted: 0
    };
    
    activities?.forEach(activity => {
      if (activity.entity_type === 'product' && activity.entity_id) {
        footprint.uniqueProducts.add(activity.entity_id);
      }
      if (activity.entity_type === 'category' && activity.entity_id) {
        footprint.uniqueCategories.add(activity.entity_id);
      }
      if (activity.action_type === 'search') {
        footprint.searchQueries.push(activity.action_details?.query);
      }
      if (activity.action_type === 'message_sent') {
        footprint.messagingActivity++;
      }
      if (activity.action_type === 'share_product') {
        footprint.socialShares++;
      }
      if (activity.action_type === 'review_posted') {
        footprint.reviewsPosted++;
      }
    });
    
    footprint.uniqueProducts = footprint.uniqueProducts.size;
    footprint.uniqueCategories = footprint.uniqueCategories.size;
    
    setDigitalFootprint(footprint);
  };
  
  const calculateEngagementScore = () => {
    if (!metrics) return 0;
    
    const weights = {
      actions: 0.3,
      orders: 0.25,
      products: 0.15,
      messages: 0.1,
      favorites: 0.1,
      sessions: 0.1
    };
    
    const score = 
      Math.min(100, metrics.total_actions * 0.1) * weights.actions +
      Math.min(100, metrics.orders_placed * 10) * weights.orders +
      Math.min(100, metrics.products_viewed * 0.5) * weights.products +
      Math.min(100, metrics.messages_sent * 2) * weights.messages +
      Math.min(100, metrics.favorites_added * 1) * weights.favorites +
      Math.min(100, metrics.total_sessions * 0.5) * weights.sessions;
    
    return Math.round(score);
  };
  
  const engagementScore = calculateEngagementScore();
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
      </Box>
    );
  }
  
  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Utilisateur non trouvé</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)', minHeight: '100vh' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <IconButton onClick={() => navigate('/users')}>
            <ArrowBack />
          </IconButton>
          <Avatar src={user.avatar_url} sx={{ width: 64, height: 64, bgcolor: '#667eea' }}>
            {user.first_name?.[0] || user.email?.[0]}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h4" fontWeight="bold">
              {user.first_name} {user.last_name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {user.email} • ID: {user.id.slice(0, 8)}...
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => fetchAllData()}>
            Actualiser
          </Button>
          <Button variant="contained" startIcon={<Download />}>
            Exporter
          </Button>
        </Box>
      </motion.div>
      
      {/* Live Activity */}
      <AnimatePresence>
        {liveActivity && (
          <motion.div initial={{ opacity: 0, x: 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -100 }}>
            <Alert severity="info" sx={{ mb: 2 }} icon={<WifiTethering />}>
              <strong>Activité en temps réel:</strong> {actionConfig[liveActivity.action_type]?.label}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Metrics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} lg={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Score d'Engagement</Typography>
              <Typography variant="h2" fontWeight="bold">{engagementScore}</Typography>
              <Typography>/100</Typography>
              <Chip
                label={engagementScore >= 80 ? 'Très actif' : engagementScore >= 60 ? 'Actif' : engagementScore >= 40 ? 'Modéré' : engagementScore >= 20 ? 'Peu actif' : 'Inactif'}
                sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} lg={9}>
          <Grid container spacing={2}>
            {[
              { label: 'Empreinte Digitale', value: digitalFootprint?.totalInteractions || 0, icon: <Fingerprint />, color: '#2196F3' },
              { label: 'Produits Explorés', value: digitalFootprint?.uniqueProducts || 0, icon: <Visibility />, color: '#4CAF50' },
              { label: 'Temps Total', value: `${Math.round((metrics?.total_time_spent_seconds || 0) / 60)} min`, icon: <AccessTime />, color: '#FF9800' },
              { label: 'Taux de Conversion', value: `${Math.round((metrics?.orders_placed || 0) / Math.max(1, metrics?.total_sessions || 1) * 100)}%`, icon: <TrendingUp />, color: '#9C27B0' },
              { label: 'Valeur Lifetime', value: `${(metrics?.orders_placed || 0) * 50000} FCFA`, icon: <AttachMoney />, color: '#E91E63' },
              { label: 'Dernière Activité', value: metrics?.last_activity_at ? formatDistanceToNow(new Date(metrics.last_activity_at), { locale: fr, addSuffix: true }) : 'Jamais', icon: <TouchApp />, color: '#00BCD4' }
            ].map((metric, index) => (
              <Grid item xs={6} md={4} key={index}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Avatar sx={{ bgcolor: metric.color, width: 32, height: 32 }}>
                        {React.cloneElement(metric.icon, { sx: { fontSize: 18 } })}
                      </Avatar>
                      <Typography variant="body2" color="textSecondary">{metric.label}</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold">{metric.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
      
      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Timeline" icon={<TimelineIcon />} iconPosition="start" />
          <Tab label="Comportement" icon={<Psychology />} iconPosition="start" />
          <Tab label="Sessions" icon={<DeviceHub />} iconPosition="start" />
        </Tabs>
      </Paper>
      
      {/* Content */}
      {tabValue === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Chronologie des Activités</Typography>
          <List>
            {activities.length === 0 ? (
              <Alert severity="info">Aucune activité enregistrée</Alert>
            ) : (
              activities.slice(0, 50).map((activity, index) => {
                const config = actionConfig[activity.action_type] || {};
                return (
                  <ListItem key={activity.id} sx={{ mb: 2, bgcolor: 'background.default', borderRadius: 2 }}>
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
                        <Avatar sx={{ bgcolor: 'grey.200' }}>{index + 1}</Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography fontWeight="medium">{config.label || activity.action_type}</Typography>
                          {activity.entity_name && <Chip label={activity.entity_name} size="small" variant="outlined" />}
                        </Box>
                      }
                      secondary={format(new Date(activity.created_at), 'dd MMMM yyyy à HH:mm:ss', { locale: fr })}
                    />
                    <Typography variant="caption" color="textSecondary">
                      {formatDistanceToNow(new Date(activity.created_at), { locale: fr, addSuffix: true })}
                    </Typography>
                  </ListItem>
                );
              })
            )}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default UserTracking;
