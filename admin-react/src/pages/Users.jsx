import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as ActiveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  CalendarToday as DateIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  ShoppingCart as CustomerIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const UserDialog = ({ open, onClose, user, onSave }) => {
  const [formData, setFormData] = useState(
    user || {
      name: '',
      email: '',
      phone: '',
      role: 'customer',
      status: 'active',
      address: '',
    }
  );
  const [tabValue, setTabValue] = useState(0);

  const handleSubmit = () => {
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {user ? 'Edit User' : 'Add New User'}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="Basic Info" />
          <Tab label="Contact" />
          <Tab label="Settings" />
        </Tabs>

        {tabValue === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  label="Role"
                >
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="moderator">Moderator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="blocked">Blocked</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )}

        {tabValue === 1 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                margin="normal"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                margin="normal"
                multiline
                rows={3}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        )}

        {tabValue === 2 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.emailNotifications !== false}
                    onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                  />
                }
                label="Email Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.smsNotifications !== false}
                    onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
                  />
                }
                label="SMS Notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.twoFactorAuth !== false}
                    onChange={(e) => setFormData({ ...formData, twoFactorAuth: e.target.checked })}
                  />
                }
                label="Two-Factor Authentication"
              />
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained">
          {user ? 'Update' : 'Add'} User
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function Users() {
  const [users, setUsers] = useState([
    { 
      id: 1, 
      name: 'John Doe', 
      email: 'john@example.com', 
      phone: '+1 234 567 8900',
      role: 'customer', 
      status: 'active',
      joinDate: '2024-01-01',
      orders: 15,
      spent: 1234.50
    },
    { 
      id: 2, 
      name: 'Jane Smith', 
      email: 'jane@example.com', 
      phone: '+1 234 567 8901',
      role: 'admin', 
      status: 'active',
      joinDate: '2023-12-15',
      orders: 0,
      spent: 0
    },
    { 
      id: 3, 
      name: 'Bob Johnson', 
      email: 'bob@example.com', 
      phone: '+1 234 567 8902',
      role: 'customer', 
      status: 'inactive',
      joinDate: '2023-11-20',
      orders: 8,
      spent: 567.89
    },
    { 
      id: 4, 
      name: 'Alice Brown', 
      email: 'alice@example.com', 
      phone: '+1 234 567 8903',
      role: 'customer', 
      status: 'active',
      joinDate: '2024-01-10',
      orders: 3,
      spent: 234.56
    },
    { 
      id: 5, 
      name: 'Charlie Wilson', 
      email: 'charlie@example.com', 
      phone: '+1 234 567 8904',
      role: 'moderator', 
      status: 'blocked',
      joinDate: '2023-10-05',
      orders: 0,
      spent: 0
    },
  ]);
  
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleAddUser = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleDeleteUser = (id) => {
    setUsers(users.filter((u) => u.id !== id));
    enqueueSnackbar('User deleted successfully', { variant: 'success' });
  };

  const handleBlockUser = (id) => {
    setUsers(users.map((u) => 
      u.id === id ? { ...u, status: u.status === 'blocked' ? 'active' : 'blocked' } : u
    ));
    enqueueSnackbar('User status updated', { variant: 'success' });
  };

  const handleSaveUser = (userData) => {
    if (selectedUser) {
      setUsers(users.map((u) => 
        u.id === selectedUser.id ? { ...u, ...userData } : u
      ));
      enqueueSnackbar('User updated successfully', { variant: 'success' });
    } else {
      const newUser = {
        ...userData,
        id: users.length + 1,
        joinDate: new Date().toISOString().split('T')[0],
        orders: 0,
        spent: 0,
      };
      setUsers([...users, newUser]);
      enqueueSnackbar('User added successfully', { variant: 'success' });
    }
  };

  const columns = [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 60 
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main' }}>
            {params.value[0]}
          </Avatar>
          <Box>
            <Typography variant="body2">{params.value}</Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.email}
            </Typography>
          </Box>
        </Box>
      ),
    },
    { 
      field: 'phone', 
      headerName: 'Phone', 
      width: 150 
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 120,
      renderCell: (params) => {
        const roleConfig = {
          customer: { color: 'default', icon: <CustomerIcon fontSize="small" /> },
          admin: { color: 'error', icon: <AdminIcon fontSize="small" /> },
          moderator: { color: 'warning', icon: <GroupIcon fontSize="small" /> },
        };
        const config = roleConfig[params.value];
        return (
          <Chip
            label={params.value}
            size="small"
            color={config.color}
            icon={config.icon}
            variant="outlined"
          />
        );
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const statusConfig = {
          active: { color: 'success', icon: <ActiveIcon fontSize="small" /> },
          inactive: { color: 'default' },
          blocked: { color: 'error', icon: <BlockIcon fontSize="small" /> },
        };
        const config = statusConfig[params.value];
        return (
          <Chip
            label={params.value}
            size="small"
            color={config.color}
            icon={config.icon}
          />
        );
      },
    },
    { 
      field: 'orders', 
      headerName: 'Orders', 
      width: 100,
      align: 'center'
    },
    { 
      field: 'spent', 
      headerName: 'Total Spent', 
      width: 120,
      renderCell: (params) => `$${params.value.toFixed(2)}`
    },
    {
      field: 'joinDate',
      headerName: 'Join Date',
      width: 120,
      valueGetter: (params) => new Date(params.row.joinDate).toLocaleDateString()
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => handleEditUser(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => handleBlockUser(params.row.id)}
            color={params.row.status === 'blocked' ? 'error' : 'default'}
          >
            <BlockIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDeleteUser(params.row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchText.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    customers: users.filter(u => u.role === 'customer').length,
    admins: users.filter(u => u.role === 'admin').length,
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
              Users Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage user accounts and permissions
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
            >
              Import
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
            >
              Export
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddUser}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              Add User
            </Button>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Users</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <GroupIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.active}</Typography>
                  <Typography variant="body2" color="text.secondary">Active Users</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <ActiveIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.customers}</Typography>
                  <Typography variant="body2" color="text.secondary">Customers</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'info.main' }}>
                  <CustomerIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.admins}</Typography>
                  <Typography variant="body2" color="text.secondary">Admins</Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <AdminIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2}>
          <TextField
            placeholder="Search users..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            sx={{ width: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Box display="flex" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={filterRole}
                label="Role"
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <MenuItem value="all">All Roles</MenuItem>
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="moderator">Moderator</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="blocked">Blocked</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <DataGrid
          rows={filteredUsers}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[5, 10, 25]}
          checkboxSelection
          disableRowSelectionOnClick
          sx={{ height: 500 }}
        />
      </Paper>

      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        user={selectedUser}
        onSave={handleSaveUser}
      />
    </Box>
  );
}

export default Users;
