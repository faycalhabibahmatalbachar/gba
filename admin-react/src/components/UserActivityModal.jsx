import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Grid,
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
  Divider,
  Badge,
  Tooltip,
  Alert
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent
} from '@mui/lab';
import {
  Close,
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
  BarChart,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { supabase } from '../config/supabase';
import { motion } from 'framer-motion';

// Action configurations
const actionConfig = {
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

function UserActivityModal({ open, onClose, user }) {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activityStats, setActivityStats] = useState({});

  useEffect(() => {
    if (open && user) {
      fetchUserData();
    }
  }, [open, user]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchActivities(),
        fetchMetrics(),
        fetchSessions(),
        fetchActivityStats()
      ]);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    setLoading(false);
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activity_metrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_type', 'all_time')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setMetrics(null);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    }
  };

  const fetchActivityStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_activities')
        .select('action_type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Group activities by type
      const stats = {};
      data?.forEach(activity => {
        stats[activity.action_type] = (stats[activity.action_type] || 0) + 1;
      });
      setActivityStats(stats);
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      setActivityStats({});
    }
  };

  const calculateEngagementScore = () => {
    if (!metrics) return 0;
    
    const score = Math.min(100, 
      (metrics.total_actions || 0) * 0.5 +
      (metrics.orders_placed || 0) * 20 +
      (metrics.products_viewed || 0) * 0.2 +
      (metrics.messages_sent || 0) * 2
    );
    
    return Math.round(score);
  };

  const getEngagementLevel = (score) => {
    if (score >= 80) return { label: 'Très actif', color: '#4CAF50' };
    if (score >= 60) return { label: 'Actif', color: '#2196F3' };
    if (score >= 40) return { label: 'Moyennement actif', color: '#FF9800' };
    if (score >= 20) return { label: 'Peu actif', color: '#FF5722' };
    return { label: 'Inactif', color: '#9E9E9E' };
  };

  const engagementScore = calculateEngagementScore();
  const engagementLevel = getEngagementLevel(engagementScore);

  // Chart data
  const activityChartData = {
    labels: Object.keys(activityStats).map(type => actionConfig[type]?.label || type),
    datasets: [{
      data: Object.values(activityStats),
      backgroundColor: Object.keys(activityStats).map(type => actionConfig[type]?.color || '#999'),
      borderWidth: 0
    }]
  };

  const sessionsChartData = {
    labels: sessions.slice(0, 7).reverse().map(s => 
      new Date(s.started_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: 'Durée (min)',
      data: sessions.slice(0, 7).reverse().map(s => Math.round((s.duration_seconds || 0) / 60)),
      borderColor: '#667eea',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  if (!user) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar 
              src={user.avatar_url}
              sx={{ width: 56, height: 56, bgcolor: '#667eea' }}
            >
              {user.first_name?.[0] || user.email?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {user.first_name} {user.last_name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {user.email}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={5}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Engagement Score Card */}
            <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <CardContent>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box position="relative" display="inline-flex">
                      <CircularProgress
                        variant="determinate"
                        value={engagementScore}
                        size={120}
                        thickness={4}
                        sx={{
                          color: 'white',
                          '& .MuiCircularProgress-circle': {
                            strokeLinecap: 'round'
                          }
                        }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box textAlign="center">
                          <Typography variant="h3" color="white" fontWeight="bold">
                            {engagementScore}
                          </Typography>
                          <Typography variant="caption" color="white">
                            /100
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Box mt={2}>
                      <Chip
                        label={engagementLevel.label}
                        sx={{
                          bgcolor: engagementLevel.color,
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2}>
                      {[
                        { label: 'Actions totales', value: metrics?.total_actions || 0, icon: <TouchApp /> },
                        { label: 'Commandes', value: metrics?.orders_placed || 0, icon: <Inventory /> },
                        { label: 'Produits vus', value: metrics?.products_viewed || 0, icon: <Visibility /> },
                        { label: 'Favoris', value: metrics?.favorites_added || 0, icon: <Favorite /> },
                        { label: 'Messages', value: metrics?.messages_sent || 0, icon: <Message /> },
                        { label: 'Sessions', value: metrics?.total_sessions || 0, icon: <PhoneAndroid /> }
                      ].map((stat, index) => (
                        <Grid item xs={6} sm={4} key={index}>
                          <Box sx={{ color: 'white' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              {stat.icon}
                              <Typography variant="caption">
                                {stat.label}
                              </Typography>
                            </Box>
                            <Typography variant="h5" fontWeight="bold">
                              {stat.value.toLocaleString()}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
              <Tab label="Activités récentes" icon={<TimelineIcon />} iconPosition="start" />
              <Tab label="Statistiques" icon={<BarChart />} iconPosition="start" />
              <Tab label="Sessions" icon={<AccessTime />} iconPosition="start" />
            </Tabs>

            {/* Tab Content */}
            {tabValue === 0 && (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {activities.length === 0 ? (
                  <Alert severity="info">Aucune activité récente</Alert>
                ) : (
                  <Timeline position="alternate">
                    {activities.slice(0, 20).map((activity, index) => {
                      const config = actionConfig[activity.action_type] || {};
                      return (
                        <TimelineItem key={activity.id}>
                          <TimelineSeparator>
                            <TimelineDot sx={{ bgcolor: config.color }}>
                              {React.cloneElement(config.icon || <MouseOutlined />, { sx: { fontSize: 16 } })}
                            </TimelineDot>
                            {index < activities.length - 1 && <TimelineConnector />}
                          </TimelineSeparator>
                          <TimelineContent>
                            <motion.div
                              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <Card sx={{ p: 2 }}>
                                <Typography variant="body2" fontWeight="bold">
                                  {config.label || activity.action_type}
                                </Typography>
                                {activity.entity_name && (
                                  <Typography variant="caption" color="textSecondary">
                                    {activity.entity_name}
                                  </Typography>
                                )}
                                <Typography variant="caption" display="block" color="textSecondary">
                                  {new Date(activity.created_at).toLocaleString('fr-FR')}
                                </Typography>
                              </Card>
                            </motion.div>
                          </TimelineContent>
                        </TimelineItem>
                      );
                    })}
                  </Timeline>
                )}
              </Box>
            )}

            {tabValue === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Distribution des activités
                      </Typography>
                      <Box height={250}>
                        {Object.keys(activityStats).length > 0 ? (
                          <Doughnut
                            data={activityChartData}
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
                        ) : (
                          <Alert severity="info">Pas de données disponibles</Alert>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Top actions
                      </Typography>
                      <List>
                        {Object.entries(activityStats)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 5)
                          .map(([type, count]) => {
                            const config = actionConfig[type] || {};
                            return (
                              <ListItem key={type}>
                                <ListItemAvatar>
                                  <Avatar sx={{ bgcolor: config.color }}>
                                    {config.icon}
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={config.label || type}
                                  secondary={`${count} fois`}
                                />
                                <LinearProgress
                                  variant="determinate"
                                  value={(count / Math.max(...Object.values(activityStats))) * 100}
                                  sx={{ width: 100 }}
                                />
                              </ListItem>
                            );
                          })}
                      </List>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {tabValue === 2 && (
              <Box>
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Durée des sessions (7 derniers jours)
                    </Typography>
                    <Box height={250}>
                      {sessions.length > 0 ? (
                        <Line
                          data={sessionsChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                beginAtZero: true,
                                ticks: {
                                  callback: (value) => `${value} min`
                                }
                              }
                            }
                          }}
                        />
                      ) : (
                        <Alert severity="info">Pas de sessions récentes</Alert>
                      )}
                    </Box>
                  </CardContent>
                </Card>
                <List>
                  {sessions.map((session) => (
                    <ListItem key={session.id}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#667eea' }}>
                          <AccessTime />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`Session ${new Date(session.started_at).toLocaleDateString('fr-FR')}`}
                        secondary={
                          <Box>
                            <Typography variant="caption">
                              Durée: {Math.round((session.duration_seconds || 0) / 60)} minutes
                            </Typography>
                            <br />
                            <Typography variant="caption">
                              Actions: {session.actions_count || 0} • Pages: {session.pages_visited || 0}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default UserActivityModal;
