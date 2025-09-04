import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment,
  Avatar,
  CardActions,
  Tooltip,
  Zoom,
  Fab
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Refresh,
  Star,
  StarBorder,
  Inventory,
  Close,
  CheckCircle,
  Error,
  Warning,
  Image as ImageIcon
} from '@mui/icons-material';
import { supabase, AdminProductService, AdminCategoryService } from '../services/supabaseService';
import DiagnosticPanel from './DiagnosticPanel';
import ProductForm from './ProductForm';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [alert, setAlert] = useState({ show: false, message: '', severity: 'success' });

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    short_description: '',
    category_id: '',
    brand: '',
    model: '',
    price: '',
    compare_at_price: '',
    cost_price: '',
    quantity: 0,
    low_stock_threshold: 10,
    unit: 'pièce',
    weight: '',
    dimensions: { length: '', width: '', height: '' },
    images: [],
    main_image: '',
    specifications: {},
    tags: [],
    barcode: '',
    is_featured: false,
    is_active: true,
    variants: []
  });

  // Charger les produits et catégories depuis Supabase
  useEffect(() => {
    loadData();
    const subscription = subscribeToChanges();
    return () => {
      subscription();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading data from Supabase...');
      
      // Charger les produits depuis Supabase
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          variants:product_variants(*)
        `)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Products error:', productsError);
        throw productsError;
      }

      // Charger les catégories depuis Supabase
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

      if (categoriesError) {
        console.error('Categories error:', categoriesError);
        throw categoriesError;
      }

      console.log('Products loaded:', productsData?.length || 0);
      console.log('Categories loaded:', categoriesData?.length || 0);
      
      setProducts(productsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert(`Erreur de connexion Supabase: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Souscription aux changements en temps réel
  const subscribeToChanges = () => {
    console.log('Setting up real-time subscription...');
    
    const channel = supabase
      .channel('admin-products-channel')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'products' },
        (payload) => {
          console.log('New product inserted:', payload);
          loadData();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Product updated:', payload);
          loadData();
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Product deleted:', payload);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up subscription...');
      supabase.removeChannel(channel);
    };
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => setAlert({ show: false, message: '', severity: 'success' }), 5000);
  };

  const handleOpenDialog = (product = null) => {
    setEditingProduct(product);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (productData) => {
    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        showAlert('Produit mis à jour avec succès!');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);

        if (error) throw error;
        showAlert('Produit créé avec succès!');
      }

      handleCloseDialog();
      loadData();
    } catch (error) {
      showAlert(`Erreur: ${error.message}`, 'error');
      throw error;
    }
  };

  const handleDelete = async (productId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      const result = await AdminProductService.delete(productId);
      if (result.success) {
        showAlert('Produit supprimé');
        loadData();
      } else {
        showAlert(result.error, 'error');
      }
    }
  };

  const handleToggleActive = async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
      showAlert(`Produit ${!currentStatus ? 'activé' : 'désactivé'}`);
      loadData();
    } catch (error) {
      showAlert(`Erreur: ${error.message}`, 'error');
    }
  };

  const handleToggleFeatured = async (productId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_featured: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
      showAlert(`Produit ${!currentStatus ? 'mis en vedette' : 'retiré de la vedette'}`);
      loadData();
    } catch (error) {
      showAlert(`Erreur: ${error.message}`, 'error');
    }
  };

  const handleUpdateStock = async (productId, quantityToAdd, operation) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const newQuantity = operation === 'add' 
        ? product.quantity + parseInt(quantityToAdd)
        : parseInt(quantityToAdd);

      const { error } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', productId);

      if (error) throw error;
      showAlert('Stock mis à jour');
      loadData();
    } catch (error) {
      showAlert(`Erreur: ${error.message}`, 'error');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 600 }}>
        Product Management
      </Typography>
      
      {/* Panneau de diagnostic */}
      <DiagnosticPanel />

      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

      {/* Barre d'outils */}
      <Card sx={{ mb: 3, borderRadius: 2, boxShadow: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                sx={{ bgcolor: 'white' }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth sx={{ bgcolor: 'white' }}>
                <InputLabel>Catégorie</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Catégorie"
                >
                  <MenuItem value="">Toutes les catégories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.icon && <span style={{ marginRight: 8 }}>{cat.icon}</span>}
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button 
                  variant="outlined" 
                  startIcon={<Refresh />} 
                  onClick={loadData}
                  sx={{ borderRadius: 2 }}
                >
                  Actualiser
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => handleOpenDialog()}
                  sx={{ 
                    borderRadius: 2,
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                  }}
                >
                  Nouveau Produit
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs pour différentes vues */}
      <Card>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Liste" />
          <Tab label="Grille" />
          <Tab label="Stock faible" />
        </Tabs>

        {/* Vue Liste */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>SKU</TableCell>
                    <TableCell>Nom</TableCell>
                    <TableCell>Catégorie</TableCell>
                    <TableCell align="right">Prix</TableCell>
                    <TableCell align="center">Stock</TableCell>
                    <TableCell align="center">Statut</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {product.name}
                          {product.is_featured && <Star sx={{ color: 'gold', fontSize: 16 }} />}
                        </Box>
                      </TableCell>
                      <TableCell>{product.category?.name}</TableCell>
                      <TableCell align="right">
                        {product.price.toLocaleString()} FCFA
                        {product.compare_at_price && (
                          <Typography variant="caption" sx={{ display: 'block', textDecoration: 'line-through' }}>
                            {product.compare_at_price.toLocaleString()} FCFA
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={product.quantity}
                          color={product.quantity === 0 ? 'error' : product.quantity < 10 ? 'warning' : 'success'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={product.is_active}
                          onChange={() => handleToggleActive(product.id, product.is_active)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => handleToggleFeatured(product.id, product.is_featured)}>
                          {product.is_featured ? <Star /> : <StarBorder />}
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenDialog(product)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(product.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Vue Grille */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            {filteredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                >
                  <Box 
                    sx={{ 
                      position: 'relative', 
                      width: '100%',
                      height: 200,
                      overflow: 'hidden',
                      bgcolor: 'grey.100'
                    }}
                  >
                    {product.main_image ? (
                      <img 
                        src={product.main_image} 
                        alt={product.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          padding: '10px'
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Box 
                        sx={{ 
                          width: '100%', 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}
                      >
                        <ImageIcon sx={{ fontSize: 60, color: 'grey.400' }} />
                      </Box>
                    )}
                    {product.is_featured && (
                      <Chip 
                        label="Vedette" 
                        color="warning" 
                        size="small"
                        sx={{ position: 'absolute', top: 8, left: 8 }}
                      />
                    )}
                    {product.quantity === 0 && (
                      <Chip 
                        label="Rupture" 
                        color="error" 
                        size="small"
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    )}
                  </Box>
                  <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 600,
                        mb: 1,
                        minHeight: 40,
                        lineHeight: 1.2
                      }}
                    >
                      {product.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      {product.category?.name || 'Sans catégorie'}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                      <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                        {product.price.toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        FCFA
                      </Typography>
                    </Box>
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          textDecoration: 'line-through',
                          color: 'text.disabled'
                        }}
                      >
                        {product.compare_at_price.toLocaleString()} FCFA
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Stock:
                      </Typography>
                      <Chip 
                        label={product.quantity}
                        color={product.quantity === 0 ? 'error' : product.quantity < 10 ? 'warning' : 'success'}
                        size="small"
                      />
                    </Box>
                  </CardContent>
                  <CardActions sx={{ pt: 0 }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleToggleFeatured(product.id, product.is_featured)}
                      color={product.is_featured ? "warning" : "default"}
                    >
                      {product.is_featured ? <Star /> : <StarBorder />}
                    </IconButton>
                    <IconButton size="small" onClick={() => handleOpenDialog(product)} color="primary">
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(product.id)}>
                      <Delete />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }} />
                    <Switch
                      checked={product.is_active}
                      onChange={() => handleToggleActive(product.id, product.is_active)}
                      size="small"
                    />
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Stock faible */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Produit</TableCell>
                  <TableCell align="center">Stock actuel</TableCell>
                  <TableCell align="center">Seuil d'alerte</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProducts
                  .filter(p => p.quantity <= p.low_stock_threshold)
                  .map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell align="center">
                        <Chip label={product.quantity} color="error" />
                      </TableCell>
                      <TableCell align="center">{product.low_stock_threshold}</TableCell>
                      <TableCell align="center">
                        <Button 
                          size="small" 
                          onClick={() => {
                            const qty = prompt('Quantité à ajouter:');
                            if (qty) handleUpdateStock(product.id, qty, 'add');
                          }}
                        >
                          Réapprovisionner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Card>

      {/* Dialog de formulaire produit */}
      <ProductForm
        open={openDialog}
        onClose={handleCloseDialog}
        product={editingProduct}
        categories={categories}
        onSave={handleSaveProduct}
      />
    </Box>
  );
}
