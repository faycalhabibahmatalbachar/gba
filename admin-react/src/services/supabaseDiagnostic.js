import { supabase } from './supabaseService';

/**
 * Service de diagnostic pour Supabase
 * Vérifie la connexion, les tables, et les permissions
 */
export const SupabaseDiagnostic = {
  /**
   * Test complet de la connexion et configuration
   */
  async runFullDiagnostic() {
    const results = {
      timestamp: new Date().toISOString(),
      connection: false,
      auth: false,
      tables: {},
      storage: {},
      realtime: false,
      errors: []
    };

    console.log('🔍 Démarrage du diagnostic Supabase...');

    // 1. Test de connexion basique
    try {
      const { data, error } = await supabase.from('categories').select('count').single();
      if (!error) {
        results.connection = true;
        console.log('✅ Connexion Supabase établie');
      } else if (error.code === 'PGRST116') {
        // Table existe mais vide
        results.connection = true;
        console.log('✅ Connexion OK (table vide)');
      } else {
        throw error;
      }
    } catch (error) {
      results.errors.push(`Connexion: ${error.message}`);
      console.error('❌ Erreur de connexion:', error);
    }

    // 2. Test d'authentification
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user) {
        results.auth = true;
        results.authUser = user.email;
        console.log('✅ Utilisateur authentifié:', user.email);
      } else {
        console.log('⚠️ Aucun utilisateur authentifié');
      }
    } catch (error) {
      results.errors.push(`Auth: ${error.message}`);
      console.error('❌ Erreur auth:', error);
    }

    // 3. Test des tables
    const tables = ['categories', 'products', 'product_variants'];
    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          results.tables[table] = {
            exists: true,
            accessible: true,
            count: count || 0
          };
          console.log(`✅ Table ${table}: ${count || 0} enregistrements`);
        } else {
          throw error;
        }
      } catch (error) {
        results.tables[table] = {
          exists: false,
          accessible: false,
          error: error.message
        };
        results.errors.push(`Table ${table}: ${error.message}`);
        console.error(`❌ Table ${table}:`, error.message);
      }
    }

    // 4. Test du storage
    try {
      const { data, error } = await supabase.storage.getBucket('products');
      if (data) {
        results.storage.products = {
          exists: true,
          public: data.public,
          size: data.file_size_limit
        };
        console.log('✅ Storage bucket "products" disponible');
      } else if (error?.message?.includes('not found')) {
        results.storage.products = { exists: false };
        console.warn('⚠️ Storage bucket "products" non trouvé');
      }
    } catch (error) {
      results.errors.push(`Storage: ${error.message}`);
      console.error('❌ Erreur storage:', error);
    }

    // 5. Test temps réel
    try {
      const channel = supabase
        .channel('diagnostic-test')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'products' },
          () => {}
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            results.realtime = true;
            console.log('✅ Temps réel fonctionnel');
          }
        });
      
      // Attendre un peu puis nettoyer
      await new Promise(resolve => setTimeout(resolve, 2000));
      supabase.removeChannel(channel);
    } catch (error) {
      results.errors.push(`Realtime: ${error.message}`);
      console.error('❌ Erreur temps réel:', error);
    }

    // 6. Résumé
    console.log('📊 Résumé du diagnostic:');
    console.log('- Connexion:', results.connection ? '✅' : '❌');
    console.log('- Auth:', results.auth ? '✅' : '❌');
    console.log('- Tables:', Object.keys(results.tables).filter(t => results.tables[t].accessible).length + '/' + tables.length);
    console.log('- Storage:', results.storage.products?.exists ? '✅' : '❌');
    console.log('- Temps réel:', results.realtime ? '✅' : '⚠️');
    
    if (results.errors.length > 0) {
      console.error('🔴 Erreurs détectées:', results.errors);
    }

    return results;
  },

  /**
   * Test rapide de connexion
   */
  async quickCheck() {
    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      return !error || error.code === 'PGRST116'; // OK si pas d'erreur ou table vide
    } catch {
      return false;
    }
  },

  /**
   * Créer des données de test
   */
  async createTestData() {
    console.log('🧪 Création de données de test...');
    
    try {
      // Vérifier si des catégories existent
      const { data: existingCats } = await supabase
        .from('categories')
        .select('id')
        .limit(1);

      if (!existingCats || existingCats.length === 0) {
        // Créer des catégories de test
        const { data: categories, error: catError } = await supabase
          .from('categories')
          .insert([
            { name: 'Électronique', slug: 'electronique', icon: '📱', display_order: 1 },
            { name: 'Vêtements', slug: 'vetements', icon: '👕', display_order: 2 },
            { name: 'Alimentation', slug: 'alimentation', icon: '🍔', display_order: 3 },
            { name: 'Livres', slug: 'livres', icon: '📚', display_order: 4 }
          ])
          .select();

        if (catError) throw catError;
        console.log('✅ Catégories créées:', categories.length);

        // Créer un produit de test
        if (categories && categories.length > 0) {
          const { data: product, error: prodError } = await supabase
            .from('products')
            .insert({
              name: 'Produit Test',
              description: 'Ceci est un produit de test créé automatiquement',
              price: 99.99,
              quantity: 50,
              category_id: categories[0].id,
              is_active: true,
              main_image: 'https://via.placeholder.com/300'
            })
            .select()
            .single();

          if (prodError) throw prodError;
          console.log('✅ Produit test créé:', product.name);
          return { success: true, product, categories };
        }
      } else {
        console.log('ℹ️ Des catégories existent déjà');
        return { success: true, message: 'Données existantes' };
      }
    } catch (error) {
      console.error('❌ Erreur création données test:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Afficher la configuration actuelle
   */
  getConfig() {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log('⚙️ Configuration Supabase:');
    console.log('- URL:', url ? `${url.substring(0, 30)}...` : '❌ NON DÉFINIE');
    console.log('- Anon Key:', key ? `${key.substring(0, 20)}...` : '❌ NON DÉFINIE');
    console.log('- Env Mode:', import.meta.env.MODE);
    
    return {
      hasUrl: !!url,
      hasKey: !!key,
      urlPrefix: url ? url.substring(0, 30) : null,
      keyPrefix: key ? key.substring(0, 20) : null
    };
  }
};

// Export pour utilisation globale (debug)
if (typeof window !== 'undefined') {
  window.SupabaseDiagnostic = SupabaseDiagnostic;
  console.log('💡 SupabaseDiagnostic disponible dans window.SupabaseDiagnostic');
}
