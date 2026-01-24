import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { supabase } from '../config/supabase';

function buildOsmEmbedUrl(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  const d = 0.01;
  const left = lngNum - d;
  const right = lngNum + d;
  const top = latNum + d;
  const bottom = latNum - d;

  const params = new URLSearchParams({
    bbox: `${left},${bottom},${right},${top}`,
    layer: 'mapnik',
    marker: `${latNum},${lngNum}`,
  });

  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

export default function DeliveryTracking() {
  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [lastLocation, setLastLocation] = useState(null);

  const channelRef = useRef(null);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('id,name,is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);

      if (!selectedDriverId && data && data.length > 0) {
        setSelectedDriverId(data[0].id);
      }
    } catch (e) {
      enqueueSnackbar('Erreur chargement livreurs', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchLastLocation = async (driverId) => {
    if (!driverId) return;
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('driver_id', driverId)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLastLocation(data || null);
    } catch (e) {
      // silencieux
    }
  };

  useEffect(() => {
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDriverId) return;

    fetchLastLocation(selectedDriverId);

    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`driver_locations_${selectedDriverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${selectedDriverId}`,
        },
        (payload) => {
          setLastLocation(payload.new);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDriverId]);

  const selectedDriver = useMemo(() => {
    return (drivers || []).find((d) => d.id === selectedDriverId) || null;
  }, [drivers, selectedDriverId]);

  const embedUrl = useMemo(() => {
    if (!lastLocation) return null;
    return buildOsmEmbedUrl(lastLocation.lat, lastLocation.lng);
  }, [lastLocation]);

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Tracking GPS Live
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Carte OpenStreetMap (gratuite) + Realtime Supabase.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={fetchDrivers} variant="outlined">
          Actualiser
        </Button>
      </Box>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <FormControl fullWidth>
              <InputLabel>Livreur</InputLabel>
              <Select
                value={selectedDriverId}
                label="Livreur"
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                {(drivers || []).map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={7}>
            <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
              <Chip
                label={selectedDriver ? `Livreur: ${selectedDriver.name}` : '—'}
                color="primary"
                variant="outlined"
              />
              <Chip
                label={lastLocation?.captured_at ? `Dernière position: ${new Date(lastLocation.captured_at).toLocaleString()}` : 'Dernière position: —'}
                variant="outlined"
              />
              <Chip
                label={lastLocation?.accuracy != null ? `Accuracy: ${Number(lastLocation.accuracy).toFixed(0)}m` : 'Accuracy: —'}
                variant="outlined"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden', height: 640 }}>
        {embedUrl ? (
          <iframe
            title="OpenStreetMap"
            width="100%"
            height="640"
            frameBorder="0"
            scrolling="no"
            src={embedUrl}
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              Aucune position reçue. Le mobile livreur doit envoyer des positions vers `driver_locations`.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
