import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Stack,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';
import { StorageService } from '../services/storageService';

function Banners() {
  const { enqueueSnackbar } = useSnackbar();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    target_route: '',
    display_order: 0,
    is_active: true,
    starts_at: null,
    ends_at: null,
    image_url: '',
    image_path: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBanners(data || []);
    } catch (e) {
      setError(e.message || e.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingBanner(null);
    setImageFile(null);
    setFormData({
      title: '',
      subtitle: '',
      target_route: '',
      display_order: banners.length,
      is_active: true,
      starts_at: null,
      ends_at: null,
      image_url: '',
      image_path: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (banner) => {
    setEditingBanner(banner);
    setImageFile(null);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      target_route: banner.target_route || '',
      display_order: banner.display_order ?? 0,
      is_active: banner.is_active !== false,
      starts_at: banner.starts_at ? new Date(banner.starts_at) : null,
      ends_at: banner.ends_at ? new Date(banner.ends_at) : null,
      image_url: banner.image_url || '',
      image_path: banner.image_path || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBanner(null);
    setImageFile(null);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      enqueueSnackbar('Le titre est obligatoire', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle?.trim() || null,
        target_route: formData.target_route?.trim() || null,
        display_order: Number(formData.display_order) || 0,
        is_active: !!formData.is_active,
        starts_at: formData.starts_at ? formData.starts_at.toISOString() : null,
        ends_at: formData.ends_at ? formData.ends_at.toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let bannerId = editingBanner?.id;

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from('banners')
          .update(payload)
          .eq('id', editingBanner.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('banners')
          .insert([{ ...payload }])
          .select()
          .single();
        if (insertError) throw insertError;
        bannerId = data.id;
      }

      if (imageFile && bannerId) {
        const uploadResult = await StorageService.uploadBannerImage(imageFile, bannerId);
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Erreur upload image');
        }

        const { error: updateImageError } = await supabase
          .from('banners')
          .update({
            image_url: uploadResult.url,
            image_path: uploadResult.path,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bannerId);

        if (updateImageError) throw updateImageError;
      }

      enqueueSnackbar('Bannière sauvegardée', { variant: 'success' });
      closeDialog();
      await loadData();
    } catch (e) {
      enqueueSnackbar(e.message || e.toString(), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (banner) => {
    const ok = window.confirm('Supprimer cette bannière ?');
    if (!ok) return;

    try {
      const { error: deleteError } = await supabase
        .from('banners')
        .delete()
        .eq('id', banner.id);

      if (deleteError) throw deleteError;

      if (banner.image_path) {
        await StorageService.deleteBannerImage(banner.image_path);
      }

      enqueueSnackbar('Bannière supprimée', { variant: 'success' });
      await loadData();
    } catch (e) {
      enqueueSnackbar(e.message || e.toString(), { variant: 'error' });
    }
  };

  const columns = useMemo(
    () => [
      {
        field: 'image_url',
        headerName: 'Image',
        width: 120,
        sortable: false,
        renderCell: (params) => {
          const url = params.value;
          if (!url) return null;
          return (
            <Box
              component="img"
              src={url}
              alt="banner"
              sx={{ width: 96, height: 48, objectFit: 'cover', borderRadius: 1 }}
            />
          );
        },
      },
      { field: 'title', headerName: 'Titre', flex: 1, minWidth: 220 },
      { field: 'subtitle', headerName: 'Sous-titre', flex: 1, minWidth: 220 },
      {
        field: 'display_order',
        headerName: 'Ordre',
        width: 90,
      },
      {
        field: 'is_active',
        headerName: 'Actif',
        width: 90,
        renderCell: (params) => (params.value ? 'Oui' : 'Non'),
      },
      {
        field: 'starts_at',
        headerName: 'Début',
        width: 180,
        valueGetter: (params) => (params.value ? new Date(params.value).toLocaleString() : ''),
      },
      {
        field: 'ends_at',
        headerName: 'Fin',
        width: 180,
        valueGetter: (params) => (params.value ? new Date(params.value).toLocaleString() : ''),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => openEdit(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [banners]
  );

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" fontWeight="bold">
          Bannières
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadData}>
            Actualiser
          </Button>
          <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
            Ajouter
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 560, width: '100%' }}>
        {loading ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={banners}
            columns={columns}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 20, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10, page: 0 } },
            }}
          />
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingBanner ? 'Modifier la bannière' : 'Nouvelle bannière'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Titre"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Sous-titre"
              value={formData.subtitle}
              onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Route cible (ex: /promotions)"
              value={formData.target_route}
              onChange={(e) => setFormData((p) => ({ ...p, target_route: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Ordre d'affichage"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData((p) => ({ ...p, display_order: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
                />
              }
              label="Actif"
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <DateTimePicker
                label="Début"
                value={formData.starts_at}
                onChange={(v) => setFormData((p) => ({ ...p, starts_at: v }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
              <DateTimePicker
                label="Fin"
                value={formData.ends_at}
                onChange={(v) => setFormData((p) => ({ ...p, ends_at: v }))}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </Stack>

            <Stack spacing={1}>
              <Button variant="outlined" component="label">
                Choisir une image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImageFile(f);
                  }}
                />
              </Button>

              {(imageFile || formData.image_url) && (
                <Box
                  component="img"
                  src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url}
                  alt="preview"
                  sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 2 }}
                />
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Banners;
