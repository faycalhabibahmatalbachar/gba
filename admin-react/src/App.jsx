import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import UltraOrders from './pages/UltraOrders';
import Users from './pages/Users';
import UltraAnalytics from './pages/UltraAnalytics';
import UserTracking from './pages/UserTracking';
import Settings from './pages/Settings';
import Monitoring from './pages/Monitoring';
import MonitoringCarts from './pages/MonitoringCarts';
import MonitoringFavorites from './pages/MonitoringFavorites';
import MonitoringProducts from './pages/MonitoringProducts';
import Layout from './components/Layout';
import SimpleAdminChat from './components/messaging/SimpleAdminChat';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/categories" element={<Categories />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<UltraOrders />} />
        <Route path="users" element={<Users />} />
        <Route path="user-tracking/:userId" element={<UserTracking />} />
        <Route path="analytics" element={<UltraAnalytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/monitoring" element={<Monitoring />} />
        <Route path="settings/security" element={<Settings />} />
        <Route path="settings/notifications" element={<Settings />} />
        <Route path="monitoring/carts" element={<MonitoringCarts />} />
        <Route path="monitoring/favorites" element={<MonitoringFavorites />} />
        <Route path="monitoring/products" element={<MonitoringProducts />} />
        <Route path="messages" element={<SimpleAdminChat />} />
      </Route>
    </Routes>
  );
}

export default App;
