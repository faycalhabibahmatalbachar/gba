import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Grid, FormControlLabel, Switch,
  Select, MenuItem, FormControl, InputLabel, Box,
  Typography, IconButton, Chip, LinearProgress,
  Alert, ImageList, ImageListItem, ImageListItemBar,
  InputAdornment, Tabs, Tab
} from '@mui/material';
import {
  Close, Upload, Delete, AddPhotoAlternate,
  Save, Cancel, Star, AttachMoney, Inventory,
  Description, Category, LocalOffer
} from '@mui/icons-material';
import StorageService from '../services/storageService';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

export default function ProductForm({ open, onClose, product, categories, onSave }) {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
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
    meta_title: '',
    meta_description: '',
    meta_keywords: ''
  });

  // Initialiser le formulaire
  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        dimensions: product.dimensions || { length: '', width: '', height: '' },
        specifications: product.specifications || {},
        tags: product.tags || [],
        images: product.images || [],
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
        meta_keywords: product.meta_keywords || ''
      });
      setImagePreviews(product.images || []);
    } else {
      resetForm();
    }
  }, [product]);

  const resetForm = () => {
    setFormData({
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
      meta_title: '',
      meta_description: '',
      meta_keywords: ''
    });
    setImageFiles([]);
    setImagePreviews([]);
    setError('');
    setTabValue(0);
  };

  // Gérer le changement de fichiers
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    
    // Validation
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        setError(`${file.name}: Format non supporté`);
        return false;
      }
      if (file.size > maxSize) {
        setError(`${file.name}: Taille maximale 5MB`);
        return false;
      }
      return true;
    });

    // Créer les previews
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    
    setImageFiles([...imageFiles, ...validFiles]);
    setImagePreviews([...imagePreviews, ...newPreviews]);
  };

  // Supprimer une image
  const handleRemoveImage = (index) => {
    const isNewImage = index >= formData.images.length;
    
    if (isNewImage) {
      // Nouvelle image uploadée
      const newImageIndex = index - formData.images.length;
      const newFiles = [...imageFiles];
      const newPreviews = [...imagePreviews];
      
      // Révoquer l'URL pour libérer la mémoire
      URL.revokeObjectURL(imagePreviews[index]);
      
      newFiles.splice(newImageIndex, 1);
      newPreviews.splice(index, 1);
      
      setImageFiles(newFiles);
      setImagePreviews(newPreviews);
    } else {
      // Image existante
      const newImages = [...formData.images];
      const newPreviews = [...imagePreviews];
      
      newImages.splice(index, 1);
      newPreviews.splice(index, 1);
      
      setFormData({ ...formData, images: newImages });
      setImagePreviews(newPreviews);
    }
  };

  // Définir l'image principale
  const handleSetMainImage = (index) => {
    const imageUrl = imagePreviews[index];
    setFormData({ ...formData, main_image: imageUrl });
  };

  // Gérer les changements de formulaire
  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({ ...formData, [field]: value });
    }
  };

  // Soumettre le formulaire
  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      setUploadProgress(10);

      // Validation
      if (!formData.name || !formData.price || !formData.category_id) {
        setError('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Upload des nouvelles images
      let uploadedUrls = [...formData.images];
      if (imageFiles.length > 0) {
        setUploadProgress(30);
        const productId = product?.id || `new_${Date.now()}`;
        const uploadResult = await StorageService.uploadMultipleImages(imageFiles, productId);
        
        if (!uploadResult.success) {
          setError(`Erreur upload: ${uploadResult.error || uploadResult.failed.join(', ')}`);
          return;
        }
        
        uploadedUrls = [...uploadedUrls, ...uploadResult.uploaded];
        setUploadProgress(70);
      }

      // Préparer les données
      const productData = {
        ...formData,
        images: uploadedUrls,
        main_image: uploadedUrls[0] || formData.main_image,
        price: parseFloat(formData.price) || 0,
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        quantity: parseInt(formData.quantity) || 0,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        weight: formData.weight ? parseFloat(formData.weight) : null
      };

      setUploadProgress(90);
      
      // Sauvegarder
      await onSave(productData);
      
      setUploadProgress(100);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 500);
      
    } catch (error) {
      console.error('Erreur:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'primary.main', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Typography variant="h6">
          {product ? '✏️ Modifier le produit' : '➕ Nouveau produit'}
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <LinearProgress 
            variant="determinate" 
            value={uploadProgress} 
            sx={{ mb: 2 }}
          />
        )}

        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
          <Tab icon={<Description />} label="Informations" />
          <Tab icon={<AttachMoney />} label="Prix & Stock" />
          <Tab icon={<AddPhotoAlternate />} label="Images" />
          <Tab icon={<LocalOffer />} label="SEO" />
        </Tabs>

        {/* Tab Informations */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SKU *"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                placeholder="PRD-001"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Inventory />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Code-barres"
                value={formData.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom du produit *"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: iPhone 15 Pro Max"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Catégorie *</InputLabel>
                <Select
                  value={formData.category_id}
                  onChange={(e) => handleChange('category_id', e.target.value)}
                  label="Catégorie *"
                  startAdornment={
                    <InputAdornment position="start">
                      <Category />
                    </InputAdornment>
                  }
                >
                  {categories.map(cat => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.icon && <span style={{ marginRight: 8 }}>{cat.icon}</span>}
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Marque"
                value={formData.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                placeholder="Ex: Apple"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description courte"
                value={formData.short_description}
                onChange={(e) => handleChange('short_description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Description complète"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab Prix & Stock */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Prix de vente *"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                  endAdornment: <InputAdornment position="end">FCFA</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Prix barré"
                value={formData.compare_at_price}
                onChange={(e) => handleChange('compare_at_price', e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">FCFA</InputAdornment>
                }}
                helperText="Prix avant réduction"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Prix d'achat"
                value={formData.cost_price}
                onChange={(e) => handleChange('cost_price', e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">FCFA</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Quantité en stock *"
                value={formData.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Inventory />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Seuil d'alerte stock"
                value={formData.low_stock_threshold}
                onChange={(e) => handleChange('low_stock_threshold', e.target.value)}
                helperText="Alerte quand le stock est bas"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Unité"
                value={formData.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                placeholder="pièce, kg, litre..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Poids (kg)"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle2" gutterBottom>
                Dimensions (cm)
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Longueur"
                    value={formData.dimensions.length}
                    onChange={(e) => handleChange('dimensions.length', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Largeur"
                    value={formData.dimensions.width}
                    onChange={(e) => handleChange('dimensions.width', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Hauteur"
                    value={formData.dimensions.height}
                    onChange={(e) => handleChange('dimensions.height', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => handleChange('is_active', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Produit actif"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_featured}
                      onChange={(e) => handleChange('is_featured', e.target.checked)}
                      color="warning"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Star sx={{ color: '#FFD700' }} />
                      Produit vedette
                    </Box>
                  }
                />
              </Box>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab Images */}
        <TabPanel value={tabValue} index={2}>
          <Box>
            <Button
              variant="contained"
              component="label"
              startIcon={<Upload />}
              sx={{ mb: 2 }}
            >
              Ajouter des images
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={handleFileChange}
              />
            </Button>
            
            <Typography variant="caption" display="block" sx={{ mb: 2 }}>
              Formats: JPG, PNG, WEBP, GIF • Taille max: 5MB • Première image = image principale
            </Typography>

            {imagePreviews.length > 0 && (
              <ImageList cols={4} gap={8}>
                {imagePreviews.map((preview, index) => (
                  <ImageListItem key={index}>
                    <img
                      src={preview}
                      alt={`Image ${index + 1}`}
                      loading="lazy"
                      style={{ 
                        height: 150, 
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: formData.main_image === preview ? '3px solid #2196F3' : 'none'
                      }}
                    />
                    <ImageListItemBar
                      sx={{ borderRadius: '0 0 8px 8px' }}
                      actionIcon={
                        <Box>
                          <IconButton
                            sx={{ color: 'white' }}
                            onClick={() => handleSetMainImage(index)}
                          >
                            <Star />
                          </IconButton>
                          <IconButton
                            sx={{ color: 'white' }}
                            onClick={() => handleRemoveImage(index)}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </Box>
        </TabPanel>

        {/* Tab SEO */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titre SEO"
                value={formData.meta_title}
                onChange={(e) => handleChange('meta_title', e.target.value)}
                helperText={`${formData.meta_title.length}/60 caractères`}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description SEO"
                value={formData.meta_description}
                onChange={(e) => handleChange('meta_description', e.target.value)}
                helperText={`${formData.meta_description.length}/160 caractères`}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Mots-clés SEO"
                value={formData.meta_keywords}
                onChange={(e) => handleChange('meta_keywords', e.target.value)}
                helperText="Séparez les mots-clés par des virgules"
              />
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Button 
          onClick={onClose} 
          startIcon={<Cancel />}
          disabled={loading}
        >
          Annuler
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          startIcon={<Save />}
          disabled={loading}
          sx={{
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
          }}
        >
          {loading ? 'Enregistrement...' : (product ? 'Mettre à jour' : 'Créer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
