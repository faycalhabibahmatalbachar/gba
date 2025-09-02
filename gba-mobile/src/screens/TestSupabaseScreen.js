import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../services/supabaseService';
import { storageService } from '../services/storageService';
import { runImageMigration } from '../utils/migrateImages';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REACT_APP_SUPABASE_URL } from '@env';

const TestSupabaseScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [migrationReport, setMigrationReport] = useState(null);

  useEffect(() => {
    loadMigrationReport();
  }, []);

  const loadMigrationReport = async () => {
    try {
      const report = await AsyncStorage.getItem('@migration_report');
      if (report) {
        setMigrationReport(JSON.parse(report));
      }
    } catch (error) {
      console.error('Error loading migration report:', error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('id')
        .limit(1);
      
      setTestResults(prev => ({
        ...prev,
        connection: error ? '❌ Échec' : '✅ Connecté'
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        connection: '❌ Erreur: ' + error.message
      }));
    }
    setLoading(false);
  };

  const testAuth = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      setTestResults(prev => ({
        ...prev,
        auth: user ? `✅ Connecté: ${user.email}` : '❌ Non connecté'
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        auth: '❌ Erreur: ' + error.message
      }));
    }
    setLoading(false);
  };

  const testDatabase = async () => {
    setLoading(true);
    try {
      // Test lecture produits
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .limit(5);
      
      // Test lecture catégories
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .limit(5);
      
      setTestResults(prev => ({
        ...prev,
        products: productsError ? '❌ Erreur produits' : `✅ ${products?.length || 0} produits`,
        categories: categoriesError ? '❌ Erreur catégories' : `✅ ${categories?.length || 0} catégories`
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        database: '❌ Erreur: ' + error.message
      }));
    }
    setLoading(false);
  };

  const testStorage = async () => {
    setLoading(true);
    try {
      await storageService.initializeBuckets();
      
      setTestResults(prev => ({
        ...prev,
        storage: '✅ Buckets initialisés'
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        storage: '❌ Erreur: ' + error.message
      }));
    }
    setLoading(false);
  };

  const runMigration = async () => {
    Alert.alert(
      'Migration des images',
      'Cette opération va migrer toutes les images vers Supabase Storage. Continuer?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: async () => {
            setLoading(true);
            try {
              const report = await runImageMigration();
              setMigrationReport(report);
              Alert.alert('Succès', `Migration terminée!\n✅ ${report.summary.success} images migrées\n❌ ${report.summary.failed} échecs`);
            } catch (error) {
              Alert.alert('Erreur', 'Erreur lors de la migration: ' + error.message);
            }
            setLoading(false);
          }
        }
      ]
    );
  };

  const runAllTests = async () => {
    setTestResults({});
    await testConnection();
    await testAuth();
    await testDatabase();
    await testStorage();
  };

  const clearLocalData = async () => {
    Alert.alert(
      'Effacer les données locales',
      'Cette action va supprimer toutes les données locales. Continuer?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              setMigrationReport(null);
              setTestResults({});
              Alert.alert('Succès', 'Données locales effacées');
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Test Supabase</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔬 Tests de connexion</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={runAllTests}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="play-arrow" size={20} color="#fff" />
                <Text style={styles.buttonText}>Lancer tous les tests</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.testButtons}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testConnection}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Test connexion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testAuth}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Test auth</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testDatabase}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Test DB</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={testStorage}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Test Storage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {Object.keys(testResults).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Résultats des tests</Text>
            {Object.entries(testResults).map(([key, value]) => (
              <View key={key} style={styles.resultItem}>
                <Text style={styles.resultKey}>{key}:</Text>
                <Text style={styles.resultValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🖼️ Migration des images</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.warningButton]}
            onPress={runMigration}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.buttonText}>Migrer les images</Text>
              </>
            )}
          </TouchableOpacity>

          {migrationReport && (
            <View style={styles.migrationReport}>
              <Text style={styles.reportTitle}>Rapport de migration:</Text>
              <Text style={styles.reportText}>
                ✅ Images migrées: {migrationReport.summary.success}
              </Text>
              <Text style={styles.reportText}>
                ❌ Échecs: {migrationReport.summary.failed}
              </Text>
              <Text style={styles.reportText}>
                📅 Date: {new Date(migrationReport.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗑️ Maintenance</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={clearLocalData}
            disabled={loading}
          >
            <Icon name="delete-forever" size={20} color="#fff" />
            <Text style={styles.buttonText}>Effacer données locales</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.info}>
          <Text style={styles.infoTitle}>ℹ️ Informations</Text>
          <Text style={styles.infoText}>
            URL: {REACT_APP_SUPABASE_URL || 'Non configuré'}
          </Text>
          <Text style={styles.infoText}>
            Utilisateur: {user?.email || 'Non connecté'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  content: {
    padding: 20
  },
  section: {
    marginBottom: 30
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 15
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10
  },
  primaryButton: {
    backgroundColor: '#667eea'
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flex: 1,
    marginHorizontal: 5
  },
  warningButton: {
    backgroundColor: '#f6ad55'
  },
  dangerButton: {
    backgroundColor: '#fc8181'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8
  },
  secondaryButtonText: {
    color: '#4a5568',
    fontWeight: '500',
    fontSize: 13
  },
  testButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10
  },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea'
  },
  resultKey: {
    fontWeight: '600',
    color: '#4a5568',
    marginRight: 10,
    textTransform: 'capitalize'
  },
  resultValue: {
    color: '#2d3748',
    flex: 1
  },
  migrationReport: {
    backgroundColor: '#f0fff4',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#9ae6b4'
  },
  reportTitle: {
    fontWeight: '600',
    color: '#22543d',
    marginBottom: 8
  },
  reportText: {
    color: '#276749',
    marginBottom: 4
  },
  info: {
    backgroundColor: '#ebf8ff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90cdf4'
  },
  infoTitle: {
    fontWeight: '600',
    color: '#2c5282',
    marginBottom: 8
  },
  infoText: {
    color: '#2a4e7c',
    marginBottom: 4,
    fontSize: 13
  }
});

export default TestSupabaseScreen;
