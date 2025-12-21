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
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Tooltip,
  Fab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
  MoreVert as MoreVertIcon,
  Image as ImageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase, AdminProductService, AdminCategoryService } from '../services/supabaseService';
import DiagnosticPanel from '../components/DiagnosticPanel';
import ProductForm from '../components/ProductForm';

function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  // Charger les données depuis Supabase
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 Loading products from Supabase...');
      
      // Charger les produits
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name)
        `)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('❌ Products error:', productsError);
        throw productsError;
      }

      // Charger les catégories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

      if (categoriesError) {
        console.error('❌ Categories error:', categoriesError);
        throw categoriesError;
      }

      console.log('✅ Products loaded:', productsData?.length || 0);
      console.log('✅ Categories loaded:', categoriesData?.length || 0);
      
      // Transformer les données pour l'affichage
      const transformedProducts = productsData?.map(p => ({
        ...p,
        stock: p.quantity,
        status: p.quantity > 10 ? 'active' : p.quantity > 0 ? 'low-stock' : 'out-of-stock',
        category: p.category?.name || 'Uncategorized',
        image: p.main_image || p.images?.[0] || 'https://via.placeholder.com/150'
      })) || [];
      
      setProducts(transformedProducts);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError(error.message);
      enqueueSnackbar(`Erreur de connexion: ${error.message}`, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Configurer la synchronisation temps réel
  useEffect(() => {
    loadData();

    // Subscription temps réel
    const channel = supabase
      .channel('products-page-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Real-time update:', payload);
          loadData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up subscription...');
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setDialogOpen(true);
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleViewProduct = (product) => {
    setViewProduct(product);
    setViewDialogOpen(true);
  };

  const handleDeleteProduct = async (id) => {
    try {
      const result = await AdminProductService.delete(id);
      if (result.success) {
        setProducts(products.filter((p) => p.id !== id));
        enqueueSnackbar('Produit supprimé avec succès', { variant: 'success' });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Delete error:', error);
      enqueueSnackbar(`Erreur: ${error.message}`, { variant: 'error' });
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      console.log('💾 Saving product data:', productData);
      
      // Préparer les données pour Supabase avec les bons champs
      const supabaseData = {
        sku: productData.sku || `SKU-${Date.now()}`,
        name: productData.name,
        description: productData.description,
        short_description: productData.short_description,
        category_id: productData.category_id,
        brand: productData.brand,
        model: productData.model,
        price: parseFloat(productData.price) || 0,
        compare_at_price: productData.compare_at_price ? parseFloat(productData.compare_at_price) : null,
        cost_price: productData.cost_price ? parseFloat(productData.cost_price) : null,
        quantity: parseInt(productData.quantity) || 0,
        low_stock_threshold: parseInt(productData.low_stock_threshold) || 10,
        unit: productData.unit || 'pièce',
        weight: productData.weight ? parseFloat(productData.weight) : null,
        dimensions: productData.dimensions || {},
        images: productData.images || [],
        main_image: productData.main_image || productData.images?.[0],
        specifications: productData.specifications || {},
        tags: productData.tags 
          ? (typeof productData.tags === 'string' 
              ? productData.tags.split(',').map(t => t.trim()).filter(t => t)
              : productData.tags)
          : [],
        barcode: productData.barcode,
        is_featured: productData.is_featured || false,
        is_active: productData.is_active !== false,
        meta_title: productData.meta_title,
        meta_description: productData.meta_description,
        meta_keywords: productData.meta_keywords 
          ? (typeof productData.meta_keywords === 'string' 
              ? productData.meta_keywords.split(',').map(k => k.trim()).filter(k => k)
              : productData.meta_keywords)
          : []
      };

      console.log('📤 Sending to Supabase:', supabaseData);

      if (selectedProduct) {
        // Mise à jour
        const result = await AdminProductService.update(selectedProduct.id, supabaseData);
        console.log('🔄 Update result:', result);
        if (result.success) {
          enqueueSnackbar('Produit mis à jour avec succès', { variant: 'success' });
          await loadData();
        } else {
          throw new Error(result.error);
        }
      } else {
        // Création
        const result = await AdminProductService.create(supabaseData);
        console.log('✨ Create result:', result);
        if (result.success) {
          enqueueSnackbar('Produit créé avec succès', { variant: 'success' });
          await loadData();
        } else {
          throw new Error(result.error);
        }
      }
      
      // Fermer le dialog
      setDialogOpen(false);
      setSelectedProduct(null);
      
    } catch (error) {
      console.error('❌ Save error:', error);
      enqueueSnackbar(`Erreur: ${error.message}`, { variant: 'error' });
    }
  };

  const columns = [
    { 
      field: 'id', 
      headerName: 'ID', 
      width: 70 
    },
    {
      field: 'name',
      headerName: 'Nom du produit',
      width: 200,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          <img src={params.row.image} alt={params.value} style={{ width: 30, height: 30, borderRadius: 4 }} />
          {params.value}
        </Box>
      ),
    },
    { 
      field: 'price', 
      headerName: 'Prix', 
      width: 120,
      renderCell: (params) => `$${params.value}`
    },
    { 
      field: 'category', 
      headerName: 'Catégorie', 
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      )
    },
    { 
      field: 'stock', 
      headerName: 'Stock', 
      width: 100,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          size="small" 
          color={params.value > 10 ? 'success' : 'warning'}
        />
      )
    },
    {
      field: 'status',
      headerName: 'Statut',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'active' ? 'success' : 'warning'}
          variant="filled"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => handleEditProduct(params.row)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleDeleteProduct(params.row.id)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => handleViewProduct(params.row)}>
            <ViewIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <Box>
      {/* Diagnostic Supabase */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Erreur de connexion Supabase:</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Gestion des produits
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Gérez votre inventaire de produits
            </Typography>
          </Box>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              disabled={loading}
            >
              Rafraîchir
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
            >
              Importer
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
            >
              Exporter
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProduct}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              Ajouter un produit
            </Button>
          </Box>
        </Box>
      </motion.div>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <TextField
            placeholder="Rechercher des produits..."
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
          <Box display="flex" gap={1}>
            <Button
              variant={viewMode === 'grid' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('grid')}
            >
              Vue grille
            </Button>
            <Button
              variant={viewMode === 'table' ? 'contained' : 'outlined'}
              onClick={() => setViewMode('table')}
            >
              Vue tableau
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
        ) : products.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucun produit trouvé
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Commencez par créer votre premier produit
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProduct}
              sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              Créer un produit
            </Button>
          </Box>
        ) : viewMode === 'table' ? (
          <DataGrid
            rows={filteredProducts}
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
        ) : (
          <Grid container spacing={3}>
            {filteredProducts.map((product) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardMedia
                      component="img"
                      image={product.image}
                      alt={product.name}
                      sx={{ 
                        height: 200,
                        objectFit: 'contain',
                        bgcolor: 'grey.100',
                        p: 1
                      }}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography gutterBottom variant="h6" component="div">
                        {product.name}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="h5" color="primary" fontWeight="bold">
                          ${product.price}
                        </Typography>
                        <Chip
                          label={product.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip
                          label={`Stock: ${product.stock}`}
                          size="small"
                          color={product.stock > 10 ? 'success' : 'warning'}
                        />
                        <Chip
                          label={product.status}
                          size="small"
                          color={product.status === 'active' ? 'success' : 'warning'}
                          variant="filled"
                        />
                      </Box>
                    </CardContent>
                    <CardActions>
                      <IconButton size="small" onClick={() => handleEditProduct(product)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteProduct(product.id)}>
                        <DeleteIcon />
                      </IconButton>
                      <Box flexGrow={1} />
                      <IconButton size="small" onClick={() => handleViewProduct(product)}>
                        <ViewIcon />
                      </IconButton>
                    </CardActions>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <ProductForm
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
        categories={categories}
        onSave={handleSaveProduct}
      />

      <Dialog
        open={viewDialogOpen && !!viewProduct}
        onClose={() => {
          setViewDialogOpen(false);
          setViewProduct(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Détails du produit</DialogTitle>
        <DialogContent dividers>
          {viewProduct && (
            <Box>
              <Box mb={2} display="flex" justifyContent="center">
                <CardMedia
                  component="img"
                  image={viewProduct.image}
                  alt={viewProduct.name}
                  sx={{ maxHeight: 260, objectFit: 'contain', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}
                />
              </Box>
              <Typography variant="h6" gutterBottom>
                {viewProduct.name}
              </Typography>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                Prix: {viewProduct.price}
              </Typography>
              <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                <Chip label={viewProduct.category} size="small" color="primary" variant="outlined" />
                <Chip label={`Stock: ${viewProduct.stock}`} size="small" color={viewProduct.stock > 10 ? 'success' : 'warning'} />
                <Chip label={viewProduct.status} size="small" color={viewProduct.status === 'active' ? 'success' : 'warning'} />
              </Box>
              {viewProduct.brand && (
                <Typography variant="body2" gutterBottom>
                  Marque: {viewProduct.brand}
                </Typography>
              )}
              {viewProduct.sku && (
                <Typography variant="body2" gutterBottom>
                  SKU: {viewProduct.sku}
                </Typography>
              )}
              {viewProduct.description && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  {viewProduct.description}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setViewDialogOpen(false);
              setViewProduct(null);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      <Fab
        color="primary"
        aria-label="add"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
        onClick={handleAddProduct}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
}

export default Products;
