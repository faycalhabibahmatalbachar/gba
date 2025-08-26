import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Card,
  CardContent,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
} from '@mui/material';
import {
  Person,
  Security,
  Notifications,
  Palette,
  Language,
  Store,
  Email,
  Phone,
  Lock,
  Edit,
  Save,
  Cancel,
  CloudUpload,
  Brightness4,
  Brightness7,
  NotificationsActive,
  NotificationsOff,
  VpnKey,
  Payment,
  LocalShipping,
  Receipt,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../contexts/AuthContext';

function TabPanel({ children, value, index }) {
  return (
    <Box hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

function Settings() {
  const [tabValue, setTabValue] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [profile, setProfile] = useState({
    name: 'Faycal Habib',
    email: 'faycalhabibahmat@gmail.com',
    phone: '+1 234 567 8900',
    bio: 'Admin at GBA Store',
    avatar: null,
  });

  const [notifications, setNotifications] = useState({
    emailOrders: true,
    emailProducts: true,
    emailUsers: false,
    pushOrders: true,
    pushProducts: false,
    pushUsers: false,
    smsOrders: false,
    smsProducts: false,
  });

  const [storeSettings, setStoreSettings] = useState({
    storeName: 'GBA Store',
    storeEmail: 'support@gbastore.com',
    storePhone: '+1 234 567 8900',
    storeAddress: '123 Main St, City, State 12345',
    currency: 'USD',
    language: 'en',
    timezone: 'UTC-5',
    taxRate: '10',
  });

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30',
    passwordExpiry: '90',
    ipRestriction: false,
  });

  const handleSaveProfile = () => {
    setEditMode(false);
    enqueueSnackbar('Profile updated successfully', { variant: 'success' });
  };

  const handleSaveNotifications = () => {
    enqueueSnackbar('Notification settings saved', { variant: 'success' });
  };

  const handleSaveStoreSettings = () => {
    enqueueSnackbar('Store settings updated successfully', { variant: 'success' });
  };

  const handleSaveSecurity = () => {
    enqueueSnackbar('Security settings updated successfully', { variant: 'success' });
  };

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Manage your account and application preferences
        </Typography>
      </motion.div>

      <Paper sx={{ mt: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Profile" icon={<Person />} iconPosition="start" />
          <Tab label="Notifications" icon={<Notifications />} iconPosition="start" />
          <Tab label="Security" icon={<Security />} iconPosition="start" />
          <Tab label="Store Settings" icon={<Store />} iconPosition="start" />
          <Tab label="Appearance" icon={<Palette />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Avatar
                      sx={{
                        width: 120,
                        height: 120,
                        margin: '0 auto',
                        mb: 2,
                        bgcolor: 'primary.main',
                        fontSize: '3rem',
                      }}
                    >
                      {profile.name[0]}
                    </Avatar>
                    <Button
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      fullWidth
                    >
                      Change Avatar
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Allowed JPG, PNG or GIF. Max size of 2MB
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                      <Typography variant="h6">Profile Information</Typography>
                      {!editMode ? (
                        <Button
                          startIcon={<Edit />}
                          onClick={() => setEditMode(true)}
                        >
                          Edit
                        </Button>
                      ) : (
                        <Box display="flex" gap={1}>
                          <Button
                            startIcon={<Cancel />}
                            onClick={() => setEditMode(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<Save />}
                            onClick={handleSaveProfile}
                          >
                            Save
                          </Button>
                        </Box>
                      )}
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Full Name"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          disabled={!editMode}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Email"
                          value={profile.email}
                          onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                          disabled={!editMode}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Phone"
                          value={profile.phone}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          disabled={!editMode}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Role"
                          value="Administrator"
                          disabled
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Bio"
                          multiline
                          rows={3}
                          value={profile.bio}
                          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                          disabled={!editMode}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Email Notifications
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <Email />
                        </ListItemIcon>
                        <ListItemText
                          primary="Order Updates"
                          secondary="Receive emails for new orders"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.emailOrders}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              emailOrders: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Email />
                        </ListItemIcon>
                        <ListItemText
                          primary="Product Updates"
                          secondary="Receive emails for product changes"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.emailProducts}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              emailProducts: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Email />
                        </ListItemIcon>
                        <ListItemText
                          primary="User Activities"
                          secondary="Receive emails for user registrations"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.emailUsers}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              emailUsers: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Push Notifications
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <NotificationsActive />
                        </ListItemIcon>
                        <ListItemText
                          primary="Order Updates"
                          secondary="Receive push notifications for orders"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.pushOrders}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              pushOrders: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <NotificationsActive />
                        </ListItemIcon>
                        <ListItemText
                          primary="Product Updates"
                          secondary="Receive push notifications for products"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.pushProducts}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              pushProducts: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <NotificationsActive />
                        </ListItemIcon>
                        <ListItemText
                          primary="User Activities"
                          secondary="Receive push notifications for users"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={notifications.pushUsers}
                            onChange={(e) => setNotifications({
                              ...notifications,
                              pushUsers: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handleSaveNotifications}
                    startIcon={<Save />}
                  >
                    Save Notification Settings
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Enhance your account security by enabling additional security features
                </Alert>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Security Options
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <VpnKey />
                        </ListItemIcon>
                        <ListItemText
                          primary="Two-Factor Authentication"
                          secondary="Add an extra layer of security"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={security.twoFactor}
                            onChange={(e) => setSecurity({
                              ...security,
                              twoFactor: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <Lock />
                        </ListItemIcon>
                        <ListItemText
                          primary="IP Restriction"
                          secondary="Restrict access to specific IPs"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={security.ipRestriction}
                            onChange={(e) => setSecurity({
                              ...security,
                              ipRestriction: e.target.checked
                            })}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Password & Session
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<Lock />}
                        >
                          Change Password
                        </Button>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Session Timeout (minutes)"
                          type="number"
                          value={security.sessionTimeout}
                          onChange={(e) => setSecurity({
                            ...security,
                            sessionTimeout: e.target.value
                          })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Password Expiry (days)"
                          type="number"
                          value={security.passwordExpiry}
                          onChange={(e) => setSecurity({
                            ...security,
                            passwordExpiry: e.target.value
                          })}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handleSaveSecurity}
                    startIcon={<Save />}
                  >
                    Save Security Settings
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Store Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Store Name"
                          value={storeSettings.storeName}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings,
                            storeName: e.target.value
                          })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Store Email"
                          value={storeSettings.storeEmail}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings,
                            storeEmail: e.target.value
                          })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Store Phone"
                          value={storeSettings.storePhone}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings,
                            storePhone: e.target.value
                          })}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Store Address"
                          multiline
                          rows={2}
                          value={storeSettings.storeAddress}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings,
                            storeAddress: e.target.value
                          })}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Regional Settings
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Currency</InputLabel>
                          <Select
                            value={storeSettings.currency}
                            onChange={(e) => setStoreSettings({
                              ...storeSettings,
                              currency: e.target.value
                            })}
                            label="Currency"
                          >
                            <MenuItem value="USD">USD - US Dollar</MenuItem>
                            <MenuItem value="EUR">EUR - Euro</MenuItem>
                            <MenuItem value="GBP">GBP - British Pound</MenuItem>
                            <MenuItem value="JPY">JPY - Japanese Yen</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Language</InputLabel>
                          <Select
                            value={storeSettings.language}
                            onChange={(e) => setStoreSettings({
                              ...storeSettings,
                              language: e.target.value
                            })}
                            label="Language"
                          >
                            <MenuItem value="en">English</MenuItem>
                            <MenuItem value="es">Spanish</MenuItem>
                            <MenuItem value="fr">French</MenuItem>
                            <MenuItem value="de">German</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>Timezone</InputLabel>
                          <Select
                            value={storeSettings.timezone}
                            onChange={(e) => setStoreSettings({
                              ...storeSettings,
                              timezone: e.target.value
                            })}
                            label="Timezone"
                          >
                            <MenuItem value="UTC-5">Eastern Time (UTC-5)</MenuItem>
                            <MenuItem value="UTC-6">Central Time (UTC-6)</MenuItem>
                            <MenuItem value="UTC-7">Mountain Time (UTC-7)</MenuItem>
                            <MenuItem value="UTC-8">Pacific Time (UTC-8)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Tax Rate (%)"
                          type="number"
                          value={storeSettings.taxRate}
                          onChange={(e) => setStoreSettings({
                            ...storeSettings,
                            taxRate: e.target.value
                          })}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handleSaveStoreSettings}
                    startIcon={<Save />}
                  >
                    Save Store Settings
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Theme Settings
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          {darkMode ? <Brightness7 /> : <Brightness4 />}
                        </ListItemIcon>
                        <ListItemText
                          primary="Dark Mode"
                          secondary="Toggle between light and dark theme"
                        />
                        <ListItemSecondaryAction>
                          <Switch
                            checked={darkMode}
                            onChange={(e) => setDarkMode(e.target.checked)}
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    </List>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Primary Color
                    </Typography>
                    <Box display="flex" gap={1} mb={2}>
                      {['#667eea', '#f093fb', '#30cfd0', '#f5576c', '#764ba2'].map((color) => (
                        <Box
                          key={color}
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: color,
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: 2,
                            borderColor: 'transparent',
                            '&:hover': {
                              borderColor: 'primary.main',
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

export default Settings;
