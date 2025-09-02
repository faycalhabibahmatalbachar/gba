import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Switch,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Chip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CategoryIcon from '@mui/icons-material/Category';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import { supabase } from '../config/supabase';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    icon: '',
    is_active: true,
    display_order: 0,
  });

  // Charger les catégories
  const loadCategories = async () => {
    console.log('🔄 Chargement des catégories...');
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order');

      if (error) {
        console.error('❌ Erreur chargement catégories:', error);
        throw error;
      }
      
      console.log('✅ Catégories chargées:', data?.length || 0);
      
      // Filtrer les catégories de test
      const realCategories = data?.filter(cat => 
        !cat.name.toLowerCase().includes('test') && 
        !cat.name.toLowerCase().includes('demo')
      ) || [];
      
      setCategories(realCategories);
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Upload d'image
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    console.log('📤 Upload image:', file.name);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `categories/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('products')
        .upload(fileName, file);

      if (error) {
        console.error('❌ Erreur upload:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      console.log('✅ Image uploadée:', publicUrl);
      setFormData({ ...formData, image_url: publicUrl });
    } catch (err) {
      console.error('❌ Erreur upload:', err);
      setError(`Erreur upload: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Ouvrir le dialog pour édition
  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      image_url: category.image_url || '',
      icon: category.icon || '',
      is_active: category.is_active !== false,
      display_order: category.display_order || 0,
    });
    setOpenDialog(true);
  };

  // Ouvrir le dialog pour création
  const handleAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      image_url: '',
      icon: '',
      is_active: true,
      display_order: categories.length,
    });
    setOpenDialog(true);
  };

  // Sauvegarder catégorie
  const handleSave = async () => {
    const action = editingCategory ? 'Mise à jour' : 'Création';
    console.log(`🔄 ${action} catégorie:`, formData);
    
    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Le nom de la catégorie est obligatoire');
      }
      
      // Générer le slug
      const slug = formData.name.toLowerCase()
        .replace(/[éèê]/g, 'e')
        .replace(/[àâ]/g, 'a')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      const dataToSave = {
        ...formData,
        slug,
        updated_at: new Date().toISOString()
      };
      
      if (editingCategory) {
        // Mise à jour
        const { error } = await supabase
          .from('categories')
          .update(dataToSave)
          .eq('id', editingCategory.id);

        if (error) {
          console.error(`❌ Erreur ${action}:`, error);
          throw error;
        }
        console.log('✅ Catégorie mise à jour avec succès');
      } else {
        // Création
        const { error } = await supabase
          .from('categories')
          .insert([dataToSave]);

        if (error) {
          console.error(`❌ Erreur ${action}:`, error);
          throw error;
        }
        console.log('✅ Catégorie créée avec succès');
      }

      setOpenDialog(false);
      loadCategories();
      setError(null);
    } catch (err) {
      console.error('❌ Erreur sauvegarde:', err);
      setError(err.message);
    }
  };

  // Supprimer catégorie
  const handleDelete = async (id) => {
    const category = categories.find(c => c.id === id);
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${category?.name}"?`)) return;

    console.log('🗑️ Suppression catégorie:', category?.name);
    
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Erreur suppression:', error);
        throw error;
      }
      
      console.log('✅ Catégorie supprimée avec succès');
      loadCategories();
      setError(null);
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError(err.message);
    }
  };
  
  // Supprimer toutes les catégories de test
  const handleDeleteTestCategories = async () => {
    if (!window.confirm('Supprimer toutes les catégories de test?')) return;
    
    console.log('🗑️ Suppression des catégories de test...');
    
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .or('name.ilike.%test%,name.ilike.%demo%,name.ilike.%category%');

      if (error) {
        console.error('❌ Erreur suppression catégories test:', error);
        throw error;
      }
      
      console.log('✅ Catégories de test supprimées');
      loadCategories();
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError(err.message);
    }
  };

  // Colonnes pour DataGrid
  const columns = [
    {
      field: 'image_url',
      headerName: 'Image',
      width: 100,
      renderCell: (params) => (
        params.value ? (
          <img
            src={params.value}
            alt="Category"
            style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <ImageIcon color="disabled" />
        )
      ),
    },
    { field: 'name', headerName: 'Nom', flex: 1, minWidth: 150 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 200 },
    {
      field: 'is_active',
      headerName: 'Statut',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Actif' : 'Inactif'}
          color={params.value ? 'success' : 'default'}
          size="small"
          icon={params.value ? <VisibilityIcon /> : <VisibilityOffIcon />}
        />
      ),
    },
    { field: 'display_order', headerName: 'Ordre', width: 80, type: 'number' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Modifier">
            <IconButton
              color="primary"
              onClick={() => handleEdit(params.row)}
              size="small"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton
              color="error"
              onClick={() => handleDelete(params.row.id)}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  // Filtrer les catégories
  const filteredCategories = categories.filter(cat =>
    cat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" display="flex" alignItems="center" gap={1}>
          <CategoryIcon color="primary" fontSize="large" />
          Gestion des Catégories
        </Typography>
        <Box>
          <Tooltip title="Rafraîchir">
            <IconButton onClick={loadCategories} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {categories.some(cat => 
            cat.name.toLowerCase().includes('test') || 
            cat.name.toLowerCase().includes('demo')
          ) && (
            <Button
              variant="outlined"
              color="warning"
              onClick={handleDeleteTestCategories}
              startIcon={<DeleteIcon />}
              sx={{ ml: 1 }}
            >
              Supprimer les tests
            </Button>
          )}
        </Box>
      </Box>

      {/* Barre d'outils */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder="Rechercher..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ flexGrow: 1, maxWidth: 400 }}
        />
        
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
        >
          <ToggleButton value="grid">
            <ViewModuleIcon />
          </ToggleButton>
          <ToggleButton value="table">
            <ViewListIcon />
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ 
            background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
            boxShadow: '0 3px 5px 2px rgba(102, 126, 234, .3)',
          }}
        >
          Nouvelle Catégorie
        </Button>
      </Box>

      {/* Vue Grille */}
      {viewMode === 'grid' ? (
        <Grid container spacing={3}>
          {filteredCategories.map((category) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={category.id}>
              <Card sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s'
                }
              }}>
                <CardMedia
                  component="div"
                  sx={{
                    height: 140,
                    backgroundColor: 'grey.200',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt={category.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <CategoryIcon sx={{ fontSize: 60, color: 'grey.400' }} />
                  )}
                </CardMedia>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" noWrap>
                    {category.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {category.description || 'Aucune description'}
                  </Typography>
                  <Box mt={1}>
                    <Chip
                      label={category.is_active ? 'Actif' : 'Inactif'}
                      color={category.is_active ? 'success' : 'default'}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                  </Box>
                  <Box mt={2} display="flex" gap={1}>
                    <Tooltip title="Modifier">
                      <IconButton
                        color="primary"
                        onClick={() => handleEdit(category)}
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Supprimer">
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(category.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        /* Vue Table */
        <Paper sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={filteredCategories}
            columns={columns}
            pageSize={10}
            rowsPerPageOptions={[5, 10, 25]}
            checkboxSelection
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              }
            }}
          />
        </Paper>
      )}

      {/* Dialog de formulaire */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              {editingCategory ? <EditIcon /> : <AddIcon />}
              {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </Box>
            <IconButton onClick={() => setOpenDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Nom"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            
            {/* Image upload */}
            <Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCameraIcon />}
                disabled={uploadingImage}
                fullWidth
              >
                {uploadingImage ? 'Upload en cours...' : 'Choisir une image'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </Button>
              {formData.image_url && (
                <Box mt={2}>
                  <img
                    src={formData.image_url}
                    alt="Preview"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }}
                  />
                </Box>
              )}
            </Box>

            <TextField
              label="Icône (FontAwesome)"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              fullWidth
              placeholder="Ex: fas fa-shopping-cart"
            />
            
            <TextField
              label="Ordre d'affichage"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              fullWidth
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Catégorie active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenDialog(false)} 
            color="secondary"
            startIcon={<CloseIcon />}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            color="primary"
            startIcon={<SaveIcon />}
          >
            {editingCategory ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Categories;
