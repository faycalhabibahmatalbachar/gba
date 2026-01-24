import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

export default function Drivers() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    is_active: true,
  });

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (e) {
      enqueueSnackbar('Erreur chargement livreurs', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();

    const subscription = supabase
      .channel('drivers_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    return (drivers || []).map((d) => ({ id: d.id, ...d }));
  }, [drivers]);

  const onCreate = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name) {
      enqueueSnackbar('Nom requis', { variant: 'warning' });
      return;
    }

    try {
      const { error } = await supabase.from('drivers').insert({
        name,
        phone: phone || null,
        is_active: Boolean(form.is_active),
      });

      if (error) throw error;

      enqueueSnackbar('Livreur créé', { variant: 'success' });
      setOpenCreate(false);
      setForm({ name: '', phone: '', is_active: true });
      fetchDrivers();
    } catch (e) {
      enqueueSnackbar('Erreur création livreur', { variant: 'error' });
    }
  };

  const onToggleActive = async (driverId, nextValue) => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .update({ is_active: Boolean(nextValue) })
        .eq('id', driverId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Mise à jour refusée (RLS)');
      }

      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, is_active: nextValue } : d)));
      enqueueSnackbar('Statut livreur mis à jour', { variant: 'success' });
    } catch (e) {
      enqueueSnackbar('Erreur mise à jour livreur', { variant: 'error' });
    }
  };

  const onDelete = async (driverId) => {
    try {
      const { error } = await supabase.from('drivers').delete().eq('id', driverId);
      if (error) throw error;
      enqueueSnackbar('Livreur supprimé', { variant: 'success' });
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    } catch (e) {
      enqueueSnackbar('Erreur suppression livreur', { variant: 'error' });
    }
  };

  const columns = useMemo(
    () => [
      { field: 'name', headerName: 'Nom', flex: 1, minWidth: 180 },
      { field: 'phone', headerName: 'Téléphone', flex: 1, minWidth: 140, valueGetter: (p) => p.row.phone || '—' },
      {
        field: 'is_active',
        headerName: 'Actif',
        minWidth: 120,
        renderCell: (params) => (
          <Switch
            checked={Boolean(params.value)}
            onChange={(e) => onToggleActive(params.row.id, e.target.checked)}
          />
        ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 120,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Tooltip title="Supprimer">
            <IconButton size="small" onClick={() => onDelete(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Livreurs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestion des livreurs (assignation, tracking live)
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button startIcon={<RefreshIcon />} onClick={fetchDrivers} variant="outlined">
            Actualiser
          </Button>
          <Button startIcon={<AddIcon />} onClick={() => setOpenCreate(true)} variant="contained">
            Ajouter
          </Button>
        </Box>
      </Box>

      <Paper sx={{ height: 640, borderRadius: 3 }}>
        <DataGrid
          loading={loading}
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
          }}
        />
      </Paper>

      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ajouter un livreur</DialogTitle>
        <DialogContent dividers>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            <TextField
              label="Nom"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Téléphone"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.is_active)}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
              }
              label="Actif"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Annuler</Button>
          <Button variant="contained" onClick={onCreate}>
            Créer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
