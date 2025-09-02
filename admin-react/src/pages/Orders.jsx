import React, { useState, useEffect } from 'react';
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
  Grid,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Pending as PendingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ShoppingCart as CartIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  CreditCard as PaymentIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

const OrderDetailDialog = ({ open, onClose, order }) => {
  const [tabValue, setTabValue] = useState(0);
  
  if (!order) return null;

  const steps = ['Order Placed', 'Processing', 'Shipped', 'Delivered'];
  const activeStep = order.status === 'delivered' ? 3 : order.status === 'shipped' ? 2 : order.status === 'processing' ? 1 : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>Order Details - {order.id}</span>
          <Chip
            label={order.status}
            color={
              order.status === 'delivered' ? 'success' :
              order.status === 'shipped' ? 'info' :
              order.status === 'processing' ? 'warning' : 'default'
            }
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab label="Order Info" />
          <Tab label="Customer" />
          <Tab label="Timeline" />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Stepper activeStep={activeStep} alternativeLabel>
                  {steps.map((label) => (
                    <Step key={label}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Grid>
              
              <Grid item xs={12}>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {order.items?.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">${item.price}</TableCell>
                          <TableCell align="right">${item.total}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right"><strong>Subtotal</strong></TableCell>
                        <TableCell align="right"><strong>${order.subtotal}</strong></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} align="right">Shipping</TableCell>
                        <TableCell align="right">${order.shipping}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} align="right"><strong>Total</strong></TableCell>
                        <TableCell align="right"><strong>${order.total}</strong></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </Box>
        )}

        {tabValue === 1 && (
          <Box>
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Customer Name" secondary={order.customer} />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <EmailIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Email" secondary={order.email || 'customer@example.com'} />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <PhoneIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Phone" secondary={order.phone || '+1 234 567 8900'} />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <LocationIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary="Shipping Address" 
                  secondary={order.address || '123 Main St, City, State 12345'} 
                />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <PaymentIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Payment Method" secondary={order.payment || 'Credit Card'} />
              </ListItem>
            </List>
          </Box>
        )}

        {tabValue === 2 && (
          <Box>
            <List>
              <ListItem>
                <ListItemText 
                  primary="Order Placed"
                  secondary={new Date(order.date).toLocaleString()}
                />
                <CheckIcon color="success" />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Payment Confirmed"
                  secondary={new Date(order.date).toLocaleString()}
                />
                <CheckIcon color="success" />
              </ListItem>
              {order.status !== 'pending' && (
                <ListItem>
                  <ListItemText 
                    primary="Order Processing"
                    secondary="In warehouse"
                  />
                  <CheckIcon color="success" />
                </ListItem>
              )}
              {(order.status === 'shipped' || order.status === 'delivered') && (
                <ListItem>
                  <ListItemText 
                    primary="Order Shipped"
                    secondary="On the way"
                  />
                  <CheckIcon color="success" />
                </ListItem>
              )}
              {order.status === 'delivered' && (
                <ListItem>
                  <ListItemText 
                    primary="Order Delivered"
                    secondary="Completed"
                  />
                  <CheckIcon color="success" />
                </ListItem>
              )}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />}>
          Print Invoice
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load orders from Supabase
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user_profiles!orders_user_id_fkey(full_name, email, phone),
          order_items(
            id,
            quantity,
            price,
            products(id, name, images)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Format orders for DataGrid
      const formattedOrders = data?.map(order => ({
        id: order.order_number || order.id,
        customer: order.user_profiles?.full_name || 'Unknown Customer',
        email: order.user_profiles?.email || '',
        phone: order.user_profiles?.phone || '',
        total: order.total_amount,
        status: order.status,
        date: order.created_at,
        payment: order.payment_method || 'Card',
        address: order.shipping_address ? 
          `${order.shipping_address.street}, ${order.shipping_address.city}, ${order.shipping_address.state} ${order.shipping_address.zip}` : '',
        items: order.order_items?.map(item => ({
          name: item.products?.name || 'Product',
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price
        })) || [],
        subtotal: order.subtotal || order.total_amount,
        shipping: order.shipping_cost || 0,
      })) || [];

      setOrders(formattedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
      enqueueSnackbar('Failed to load orders', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const [mockOrders] = useState([
    { 
      id: '#ORD001', 
      customer: 'John Doe', 
      email: 'john@example.com',
      total: 129.99, 
      status: 'pending', 
      date: '2024-01-15T10:30:00',
      payment: 'Credit Card',
      items: [
        { name: 'Wireless Headphones', quantity: 1, price: 99.99, total: 99.99 },
        { name: 'USB Cable', quantity: 2, price: 15.00, total: 30.00 },
      ],
      subtotal: 129.99,
      shipping: 10.00,
    },
    { 
      id: '#ORD002', 
      customer: 'Jane Smith', 
      email: 'jane@example.com',
      total: 89.50, 
      status: 'processing', 
      date: '2024-01-15T11:45:00',
      payment: 'PayPal',
      items: [
        { name: 'Smart Watch', quantity: 1, price: 89.50, total: 89.50 },
      ],
      subtotal: 89.50,
      shipping: 0.00,
    },
    { 
      id: '#ORD003', 
      customer: 'Bob Johnson', 
      email: 'bob@example.com',
      total: 245.00, 
      status: 'shipped', 
      date: '2024-01-14T14:20:00',
      payment: 'Credit Card',
      items: [
        { name: 'Laptop Stand', quantity: 1, price: 75.00, total: 75.00 },
        { name: 'Wireless Mouse', quantity: 2, price: 85.00, total: 170.00 },
      ],
      subtotal: 245.00,
      shipping: 15.00,
    },
    { 
      id: '#ORD004', 
      customer: 'Alice Brown', 
      email: 'alice@example.com',
      total: 67.30, 
      status: 'delivered', 
      date: '2024-01-13T09:15:00',
      payment: 'Debit Card',
      items: [
        { name: 'Book', quantity: 3, price: 22.43, total: 67.30 },
      ],
      subtotal: 67.30,
      shipping: 5.00,
    },
    { 
      id: '#ORD005', 
      customer: 'Charlie Wilson', 
      email: 'charlie@example.com',
      total: 199.99, 
      status: 'cancelled', 
      date: '2024-01-12T16:00:00',
      payment: 'Credit Card',
      items: [
        { name: 'Gaming Keyboard', quantity: 1, price: 199.99, total: 199.99 },
      ],
      subtotal: 199.99,
      shipping: 20.00,
    },
  ]);
  
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState([null, null]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const { enqueueSnackbar } = useSnackbar();

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      // Find the actual order ID (not order_number)
      const order = orders.find(o => o.id === orderId);
      const actualId = order?.id;
      
      // Update in Supabase
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('order_number', orderId);

      if (error) throw error;

      // Update local state
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      
      enqueueSnackbar(`Order ${orderId} status updated to ${newStatus}`, { variant: 'success' });
    } catch (err) {
      console.error('Error updating order status:', err);
      enqueueSnackbar('Failed to update order status', { variant: 'error' });
    }
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const columns = [
    { 
      field: 'id', 
      headerName: 'Order ID', 
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold">
          {params.value}
        </Typography>
      )
    },
    {
      field: 'customer',
      headerName: 'Customer',
      width: 180,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main' }}>
            {params.value[0]}
          </Avatar>
          {params.value}
        </Box>
      ),
    },
    { 
      field: 'date', 
      headerName: 'Date', 
      width: 180,
      valueGetter: (params) => new Date(params.row.date).toLocaleString()
    },
    { 
      field: 'total', 
      headerName: 'Total', 
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="bold" color="primary">
          ${params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => {
        const statusConfig = {
          pending: { color: 'default', icon: <PendingIcon /> },
          processing: { color: 'warning', icon: <CartIcon /> },
          shipped: { color: 'info', icon: <ShippingIcon /> },
          delivered: { color: 'success', icon: <CheckIcon /> },
          cancelled: { color: 'error', icon: <CancelIcon /> },
        };
        const config = statusConfig[params.value];
        return (
          <Chip
            label={params.value}
            size="small"
            color={config.color}
            icon={config.icon}
            variant="filled"
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      renderCell: (params) => (
        <Box display="flex" gap={1}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={params.row.status}
              onChange={(e) => handleStatusUpdate(params.row.id, e.target.value)}
              displayEmpty
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="shipped">Shipped</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleViewDetails(params.row)}
          >
            View
          </Button>
        </Box>
      ),
    },
  ];

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.customer.toLowerCase().includes(searchText.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Error loading orders: {error}
        </Alert>
        <Button onClick={fetchOrders} sx={{ mt: 2 }}>Retry</Button>
      </Box>
    );
  }

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
              Orders Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Track and manage customer orders
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
            >
              Print All
            </Button>
          </Box>
        </Box>
      </motion.div>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={2.4}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.100' }}>
            <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
            <Typography variant="body2" color="text.secondary">Total Orders</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={2.4}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
            <Typography variant="h4" fontWeight="bold">{stats.pending}</Typography>
            <Typography variant="body2">Pending</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={2.4}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
            <Typography variant="h4" fontWeight="bold">{stats.processing}</Typography>
            <Typography variant="body2">Processing</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={2.4}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
            <Typography variant="h4" fontWeight="bold">{stats.shipped}</Typography>
            <Typography variant="body2">Shipped</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={2.4}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
            <Typography variant="h4" fontWeight="bold">{stats.delivered}</Typography>
            <Typography variant="body2">Delivered</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2}>
          <TextField
            placeholder="Search orders..."
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
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="shipped">Shipped</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        <DataGrid
          rows={filteredOrders}
          columns={columns}
          getRowId={(row) => row.id}
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

      <OrderDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        order={selectedOrder}
      />
    </Box>
  );
}

export default Orders;
