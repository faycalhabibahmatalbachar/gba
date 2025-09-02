import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Collapse,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Science as ScienceIcon,
  Storage as StorageIcon,
  Wifi as WifiIcon,
  Lock as LockIcon,
  TableChart as TableIcon,
} from '@mui/icons-material';
import { SupabaseDiagnostic } from '../services/supabaseDiagnostic';

function DiagnosticPanel() {
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [testDataCreated, setTestDataCreated] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const results = await SupabaseDiagnostic.runFullDiagnostic();
      setDiagnosticResults(results);
    } catch (error) {
      console.error('Erreur diagnostic:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTestData = async () => {
    setLoading(true);
    try {
      const result = await SupabaseDiagnostic.createTestData();
      if (result.success) {
        setTestDataCreated(true);
        // Relancer le diagnostic pour voir les nouvelles données
        await runDiagnostic();
      }
    } catch (error) {
      console.error('Erreur création données test:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === true) return <CheckIcon color="success" />;
    if (status === false) return <ErrorIcon color="error" />;
    return <WarningIcon color="warning" />;
  };

  const getOverallStatus = () => {
    if (!diagnosticResults) return 'unknown';
    const critical = diagnosticResults.connection && 
                    Object.keys(diagnosticResults.tables).some(t => diagnosticResults.tables[t].accessible);
    if (critical && diagnosticResults.errors.length === 0) return 'success';
    if (critical) return 'warning';
    return 'error';
  };

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <ScienceIcon color="primary" />
          <Typography variant="h6">Diagnostic Supabase</Typography>
        </Box>
        <Box display="flex" gap={1}>
          {!testDataCreated && diagnosticResults && (
            <Button
              size="small"
              variant="outlined"
              onClick={createTestData}
              disabled={loading}
            >
              Créer données test
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={runDiagnostic}
            disabled={loading}
          >
            {loading ? 'Analyse...' : 'Analyser'}
          </Button>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      <Collapse in={expanded}>
        {loading && !diagnosticResults && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        )}

        {diagnosticResults && (
          <>
            {/* Résumé global */}
            <Alert 
              severity={getOverallStatus()}
              sx={{ mb: 2 }}
              action={
                <Chip 
                  label={new Date(diagnosticResults.timestamp).toLocaleTimeString()}
                  size="small"
                />
              }
            >
              <AlertTitle>
                {getOverallStatus() === 'success' && '✅ Système opérationnel'}
                {getOverallStatus() === 'warning' && '⚠️ Problèmes mineurs détectés'}
                {getOverallStatus() === 'error' && '❌ Problèmes critiques détectés'}
              </AlertTitle>
              {diagnosticResults.errors.length > 0 && (
                <Typography variant="body2">
                  {diagnosticResults.errors.length} erreur(s) détectée(s)
                </Typography>
              )}
            </Alert>

            {/* Détails des tests */}
            <List dense>
              {/* Connexion */}
              <ListItem>
                <ListItemIcon>
                  {getStatusIcon(diagnosticResults.connection)}
                </ListItemIcon>
                <ListItemText 
                  primary="Connexion Supabase"
                  secondary={diagnosticResults.connection ? 'Connecté' : 'Échec de connexion'}
                />
              </ListItem>

              {/* Authentification */}
              <ListItem>
                <ListItemIcon>
                  {getStatusIcon(diagnosticResults.auth)}
                </ListItemIcon>
                <ListItemText 
                  primary="Authentification"
                  secondary={
                    diagnosticResults.auth 
                      ? `Connecté: ${diagnosticResults.authUser}`
                      : 'Non authentifié'
                  }
                />
                <LockIcon fontSize="small" color="action" />
              </ListItem>

              {/* Tables */}
              {Object.entries(diagnosticResults.tables).map(([table, info]) => (
                <ListItem key={table}>
                  <ListItemIcon>
                    {getStatusIcon(info.accessible)}
                  </ListItemIcon>
                  <ListItemText 
                    primary={`Table: ${table}`}
                    secondary={
                      info.accessible 
                        ? `${info.count} enregistrement(s)`
                        : info.error || 'Non accessible'
                    }
                  />
                  <TableIcon fontSize="small" color="action" />
                </ListItem>
              ))}

              {/* Storage */}
              {diagnosticResults.storage.products && (
                <ListItem>
                  <ListItemIcon>
                    {getStatusIcon(diagnosticResults.storage.products.exists)}
                  </ListItemIcon>
                  <ListItemText 
                    primary="Storage: products"
                    secondary={
                      diagnosticResults.storage.products.exists 
                        ? `Public: ${diagnosticResults.storage.products.public ? 'Oui' : 'Non'}`
                        : 'Bucket non configuré'
                    }
                  />
                  <StorageIcon fontSize="small" color="action" />
                </ListItem>
              )}

              {/* Temps réel */}
              <ListItem>
                <ListItemIcon>
                  {getStatusIcon(diagnosticResults.realtime)}
                </ListItemIcon>
                <ListItemText 
                  primary="Temps réel"
                  secondary={
                    diagnosticResults.realtime 
                      ? 'Subscriptions actives'
                      : 'Non configuré ou en attente'
                  }
                />
                <WifiIcon fontSize="small" color="action" />
              </ListItem>
            </List>

            {/* Erreurs détaillées */}
            {diagnosticResults.errors.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Erreurs détaillées:
                </Typography>
                <List dense>
                  {diagnosticResults.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={error}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {/* Actions suggérées */}
            {!diagnosticResults.connection && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Action requise</AlertTitle>
                Vérifiez vos variables d'environnement VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
              </Alert>
            )}

            {diagnosticResults.connection && Object.values(diagnosticResults.tables).some(t => !t.accessible) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>Tables manquantes</AlertTitle>
                Exécutez le script SQL de création des tables dans Supabase
              </Alert>
            )}

            {diagnosticResults.connection && !diagnosticResults.storage.products?.exists && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <AlertTitle>Storage non configuré</AlertTitle>
                Créez le bucket "products" dans Supabase Storage pour les images
              </Alert>
            )}
          </>
        )}

        {!diagnosticResults && !loading && (
          <Typography variant="body2" color="text.secondary" align="center" py={2}>
            Cliquez sur "Analyser" pour vérifier la connexion Supabase
          </Typography>
        )}
      </Collapse>
    </Paper>
  );
}

export default DiagnosticPanel;
