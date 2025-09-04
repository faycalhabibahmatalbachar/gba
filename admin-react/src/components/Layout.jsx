import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Tooltip,
  Collapse,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  ExpandLess,
  ExpandMore,
  Category as CategoryIcon,
  LocalOffer as LocalOfferIcon,
  MonitorHeart as MonitorIcon,
  Favorite as FavoriteIcon,
  ShoppingBasket as BasketIcon,
  TrendingUp as TrendingIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 280;

const menuItems = [
  { title: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { title: 'Messages', path: '/messages', icon: <MessageIcon />, badge: 'new' },
  { 
    title: 'Products', 
    path: '/products', 
    icon: <InventoryIcon />,
    subItems: [
      { title: 'All Products', path: '/products' },
      { title: 'Categories', path: '/products/categories', icon: <CategoryIcon /> },
      { title: 'Tags', path: '/products/tags', icon: <LocalOfferIcon /> },
    ]
  },
  { title: 'Orders', path: '/orders', icon: <ShoppingCartIcon />, badge: 5 },
  { 
    title: 'Monitoring', 
    path: '/monitoring', 
    icon: <MonitorIcon />,
    subItems: [
      { title: 'Monitoring Paniers', path: '/monitoring/carts', icon: <BasketIcon /> },
      { title: 'Monitoring Favoris', path: '/monitoring/favorites', icon: <FavoriteIcon /> },
      { title: 'Monitoring Produits', path: '/monitoring/products', icon: <TrendingIcon /> },
    ]
  },
  { title: 'Users', path: '/users', icon: <PeopleIcon /> },
  { title: 'Analytics', path: '/analytics', icon: <AnalyticsIcon /> },
  { 
    title: 'Settings', 
    path: '/settings', 
    icon: <SettingsIcon />,
    subItems: [
      { title: 'General', path: '/settings' },
      { title: 'Monitoring', path: '/settings/monitoring' },
      { title: 'Security', path: '/settings/security' },
      { title: 'Notifications', path: '/settings/notifications' },
    ]
  },
];

function Layout() {
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await signOut();
  };

  const handleExpandClick = (title) => {
    setExpandedItems(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const isActive = (path) => location.pathname === path;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${open ? drawerWidth : 0}px)`,
          ml: `${open ? drawerWidth : 0}px`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{ mr: 2, ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => isActive(item.path))?.title || 'Admin Dashboard'}
          </Typography>

          <Tooltip title="Notifications">
            <IconButton color="inherit">
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Account settings">
            <IconButton onClick={handleMenuClick} sx={{ ml: 2 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'secondary.main',
                }}
              >
                {user?.email?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <ListItemIcon>
                <Avatar sx={{ width: 24, height: 24 }} />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
            color: 'white',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: [1],
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'white' }}>
            GBA Admin
          </Typography>
          <IconButton onClick={handleDrawerToggle} sx={{ color: 'white' }}>
            <ChevronLeftIcon />
          </IconButton>
        </Toolbar>
        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
        
        <List sx={{ px: 1 }}>
          {menuItems.map((item) => (
            <React.Fragment key={item.title}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      if (item.subItems) {
                        handleExpandClick(item.title);
                      } else {
                        navigate(item.path);
                      }
                    }}
                    sx={{
                      borderRadius: 2,
                      background: isActive(item.path) 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : 'transparent',
                      '&:hover': {
                        background: isActive(item.path)
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'white' }}>
                      {item.badge ? (
                        <Badge badgeContent={item.badge} color="error">
                          {item.icon}
                        </Badge>
                      ) : (
                        item.icon
                      )}
                    </ListItemIcon>
                    <ListItemText primary={item.title} />
                    {item.subItems && (
                      expandedItems[item.title] ? <ExpandLess /> : <ExpandMore />
                    )}
                  </ListItemButton>
                </ListItem>
              </motion.div>
              
              {item.subItems && (
                <Collapse in={expandedItems[item.title]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {item.subItems.map((subItem) => (
                      <ListItemButton
                        key={subItem.title}
                        onClick={() => navigate(subItem.path)}
                        sx={{
                          pl: 4,
                          borderRadius: 2,
                          mb: 0.5,
                          '&:hover': {
                            background: 'rgba(255,255,255,0.1)',
                          },
                        }}
                      >
                        <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                          {subItem.icon}
                        </ListItemIcon>
                        <ListItemText primary={subItem.title} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </React.Fragment>
          ))}
        </List>

        <Box sx={{ flexGrow: 1 }} />
        
        <Box sx={{ p: 2 }}>
          <Chip
            label="Pro Version"
            color="warning"
            size="small"
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            © 2024 GBA Admin
          </Typography>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: `calc(100% - ${open ? drawerWidth : 0}px)`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          mt: 8,
          minHeight: '100vh',
          background: '#f8fafc',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Outlet />
        </motion.div>
      </Box>
    </Box>
  );
}

export default Layout;
