import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Avatar,
  Chip,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  People,
  Inventory,
  AttachMoney,
  MoreVert,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  Title,
  Tooltip,
  Legend,
  Filler
);

const StatCard = ({ title, value, icon, change, color, gradient }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.02 }}
    transition={{ duration: 0.3 }}
  >
    <Card
      sx={{
        background: gradient,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
              {value}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {change > 0 ? (
                <TrendingUp sx={{ fontSize: 20 }} />
              ) : (
                <TrendingDown sx={{ fontSize: 20 }} />
              )}
              <Typography variant="body2">
                {Math.abs(change)}% from last month
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 2,
              p: 1.5,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'rgba(255, 255, 255, 0.3)',
        }}
      >
        <LinearProgress
          variant="determinate"
          value={75}
          sx={{
            height: '100%',
            backgroundColor: 'transparent',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            },
          }}
        />
      </Box>
    </Card>
  </motion.div>
);

function Dashboard() {
  const stats = [
    {
      title: 'Total Revenue',
      value: '$24,568',
      icon: <AttachMoney sx={{ fontSize: 30 }} />,
      change: 12,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Total Orders',
      value: '1,456',
      icon: <ShoppingCart sx={{ fontSize: 30 }} />,
      change: 8,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Total Products',
      value: '324',
      icon: <Inventory sx={{ fontSize: 30 }} />,
      change: -3,
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
      title: 'Total Users',
      value: '8,945',
      icon: <People sx={{ fontSize: 30 }} />,
      change: 15,
      gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    },
  ];

  const salesData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Sales',
        data: [12000, 19000, 15000, 25000, 22000, 30000],
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const categoryData = {
    labels: ['Electronics', 'Clothing', 'Food', 'Books', 'Others'],
    datasets: [
      {
        data: [30, 25, 20, 15, 10],
        backgroundColor: [
          '#667eea',
          '#764ba2',
          '#f093fb',
          '#f5576c',
          '#30cfd0',
        ],
      },
    ],
  };

  const recentOrders = [
    { id: '#1234', customer: 'John Doe', amount: '$129.99', status: 'completed' },
    { id: '#1235', customer: 'Jane Smith', amount: '$89.50', status: 'processing' },
    { id: '#1236', customer: 'Bob Johnson', amount: '$245.00', status: 'pending' },
    { id: '#1237', customer: 'Alice Brown', amount: '$67.30', status: 'completed' },
    { id: '#1238', customer: 'Charlie Wilson', amount: '$199.99', status: 'shipped' },
  ];

  const topProducts = [
    { name: 'Wireless Headphones', sales: 234, revenue: '$12,543' },
    { name: 'Smart Watch', sales: 189, revenue: '$9,876' },
    { name: 'Laptop Stand', sales: 156, revenue: '$7,234' },
    { name: 'USB-C Hub', sales: 134, revenue: '$5,678' },
    { name: 'Wireless Mouse', sales: 98, revenue: '$3,456' },
  ];

  return (
    <Box>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Dashboard Overview
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Welcome back! Here's what's happening with your store today.
        </Typography>
      </motion.div>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Sales Overview
              </Typography>
              <Box sx={{ height: 320 }}>
                <Line
                  data={salesData}
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
                        ticks: {
                          callback: (value) => `$${value / 1000}k`,
                        },
                      },
                    },
                  }}
                />
              </Box>
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Paper sx={{ p: 3, height: 400 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Sales by Category
              </Typography>
              <Box sx={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut
                  data={categoryData}
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
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Recent Orders
                </Typography>
                <IconButton size="small">
                  <MoreVert />
                </IconButton>
              </Box>
              <List>
                {recentOrders.map((order, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#667eea' }}>
                        <ShoppingCart />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={order.customer}
                      secondary={order.id}
                    />
                    <ListItemSecondaryAction>
                      <Box textAlign="right">
                        <Typography variant="body2" fontWeight="bold">
                          {order.amount}
                        </Typography>
                        <Chip
                          label={order.status}
                          size="small"
                          color={
                            order.status === 'completed'
                              ? 'success'
                              : order.status === 'processing'
                              ? 'warning'
                              : 'default'
                          }
                        />
                      </Box>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Paper sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Top Products
                </Typography>
                <IconButton size="small">
                  <MoreVert />
                </IconButton>
              </Box>
              <List>
                {topProducts.map((product, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#f093fb' }}>
                        {index + 1}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={product.name}
                      secondary={`${product.sales} sales`}
                    />
                    <ListItemSecondaryAction>
                      <Typography variant="body2" fontWeight="bold">
                        {product.revenue}
                      </Typography>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
