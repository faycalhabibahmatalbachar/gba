import { supabase } from '../services/supabaseService';
import { storageService, BUCKET_NAMES } from '../services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URLs des images par défaut à migrer
const DEFAULT_IMAGES = {
  categories: {
    electronique: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400',
    mode: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400',
    maison: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    sport: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
    beaute: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400',
    jouets: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400',
    alimentation: 'https://images.unsplash.com/photo-1543168256-418811576931?w=400',
    livres: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
  },
  products: {
    smartphone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
    laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400',
    headphones: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    watch: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400',
    tablet: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=400',
    tshirt: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400',
    shoes: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    bag: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
    furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400'
  },
  assets: {
    logo: 'https://via.placeholder.com/200x60/667eea/ffffff?text=GBA+Store',
    banner1: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    banner2: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800',
    banner3: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800'
  }
};

class ImageMigration {
  constructor() {
    this.migratedImages = {};
    this.failedImages = [];
  }

  // Initialiser les buckets
  async initializeBuckets() {
    console.log('🪣 Initialisation des buckets Supabase...');
    await storageService.initializeBuckets();
    console.log('✅ Buckets initialisés');
  }

  // Migrer les images des catégories
  async migrateCategoryImages() {
    console.log('📁 Migration des images de catégories...');
    
    try {
      // Récupérer les catégories depuis Supabase
      const { data: categories, error } = await supabase
        .from('categories')
        .select('id, slug');
      
      if (error) throw error;

      for (const category of categories) {
        const imageUrl = DEFAULT_IMAGES.categories[category.slug];
        if (imageUrl) {
          try {
            const newUrl = await storageService.migrateImageFromUrl(
              imageUrl,
              BUCKET_NAMES.CATEGORIES,
              `${category.id}/image.jpg`
            );
            
            // Mettre à jour l'URL dans la base de données
            await supabase
              .from('categories')
              .update({ image_url: newUrl })
              .eq('id', category.id);
            
            this.migratedImages[`category_${category.id}`] = newUrl;
            console.log(`✅ Catégorie ${category.slug} migrée`);
          } catch (error) {
            console.error(`❌ Erreur migration catégorie ${category.slug}:`, error);
            this.failedImages.push({ type: 'category', id: category.id, error });
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la migration des catégories:', error);
    }
  }

  // Migrer les images des produits
  async migrateProductImages() {
    console.log('📦 Migration des images de produits...');
    
    try {
      // Récupérer les produits depuis Supabase
      const { data: products, error } = await supabase
        .from('products')
        .select('id, slug, main_image, images');
      
      if (error) throw error;

      for (const product of products) {
        try {
          // Migrer l'image principale
          if (product.main_image) {
            const newMainImage = await storageService.migrateImageFromUrl(
              product.main_image,
              BUCKET_NAMES.PRODUCTS,
              `${product.id}/main.jpg`
            );
            
            // Migrer les images additionnelles
            const newImages = [];
            if (product.images && Array.isArray(product.images)) {
              for (let i = 0; i < product.images.length; i++) {
                const newUrl = await storageService.migrateImageFromUrl(
                  product.images[i],
                  BUCKET_NAMES.PRODUCTS,
                  `${product.id}/image_${i}.jpg`
                );
                newImages.push(newUrl);
              }
            }
            
            // Mettre à jour les URLs dans la base de données
            await supabase
              .from('products')
              .update({ 
                main_image: newMainImage,
                images: newImages
              })
              .eq('id', product.id);
            
            this.migratedImages[`product_${product.id}`] = {
              main: newMainImage,
              images: newImages
            };
            console.log(`✅ Produit ${product.slug} migré`);
          }
        } catch (error) {
          console.error(`❌ Erreur migration produit ${product.slug}:`, error);
          this.failedImages.push({ type: 'product', id: product.id, error });
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la migration des produits:', error);
    }
  }

  // Migrer les assets généraux
  async migrateAssets() {
    console.log('🎨 Migration des assets généraux...');
    
    for (const [key, url] of Object.entries(DEFAULT_IMAGES.assets)) {
      try {
        const newUrl = await storageService.migrateImageFromUrl(
          url,
          BUCKET_NAMES.ASSETS,
          `${key}.jpg`
        );
        
        this.migratedImages[`asset_${key}`] = newUrl;
        
        // Sauvegarder l'URL dans AsyncStorage pour utilisation locale
        await AsyncStorage.setItem(`@asset_${key}_url`, newUrl);
        
        console.log(`✅ Asset ${key} migré`);
      } catch (error) {
        console.error(`❌ Erreur migration asset ${key}:`, error);
        this.failedImages.push({ type: 'asset', id: key, error });
      }
    }
  }

  // Créer des données d'exemple si nécessaire
  async createSampleData() {
    console.log('🎲 Création de données d\'exemple...');
    
    try {
      // Vérifier si des catégories existent
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id')
        .limit(1);
      
      if (!catError && (!categories || categories.length === 0)) {
        // Insérer des catégories d'exemple
        const sampleCategories = [
          { name: 'Électronique', slug: 'electronique', icon: 'devices', display_order: 1 },
          { name: 'Mode', slug: 'mode', icon: 'shopping-bag', display_order: 2 },
          { name: 'Maison', slug: 'maison', icon: 'home', display_order: 3 },
          { name: 'Sport', slug: 'sport', icon: 'fitness', display_order: 4 },
          { name: 'Beauté', slug: 'beaute', icon: 'sparkles', display_order: 5 },
          { name: 'Jouets', slug: 'jouets', icon: 'gamepad', display_order: 6 },
          { name: 'Alimentation', slug: 'alimentation', icon: 'restaurant', display_order: 7 },
          { name: 'Livres', slug: 'livres', icon: 'book', display_order: 8 }
        ];

        const { error: insertError } = await supabase
          .from('categories')
          .insert(sampleCategories);
        
        if (insertError) {
          console.error('❌ Erreur insertion catégories:', insertError);
        } else {
          console.log('✅ Catégories d\'exemple créées');
        }
      }

      // Vérifier si des produits existent
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id')
        .limit(1);
      
      if (!prodError && (!products || products.length === 0)) {
        // Récupérer les IDs des catégories
        const { data: cats } = await supabase
          .from('categories')
          .select('id, slug');
        
        const categoryMap = {};
        cats?.forEach(cat => {
          categoryMap[cat.slug] = cat.id;
        });

        // Insérer des produits d'exemple
        const sampleProducts = [
          {
            name: 'iPhone 15 Pro',
            slug: 'iphone-15-pro',
            description: 'Le dernier smartphone d\'Apple avec puce A17 Pro',
            price: 1299.99,
            quantity: 50,
            category_id: categoryMap['electronique'],
            is_featured: true,
            main_image: DEFAULT_IMAGES.products.smartphone
          },
          {
            name: 'MacBook Air M2',
            slug: 'macbook-air-m2',
            description: 'Ordinateur portable ultra-léger avec puce M2',
            price: 1499.99,
            quantity: 30,
            category_id: categoryMap['electronique'],
            is_featured: true,
            main_image: DEFAULT_IMAGES.products.laptop
          },
          {
            name: 'AirPods Pro',
            slug: 'airpods-pro',
            description: 'Écouteurs sans fil avec réduction de bruit active',
            price: 279.99,
            quantity: 100,
            category_id: categoryMap['electronique'],
            main_image: DEFAULT_IMAGES.products.headphones
          },
          {
            name: 'T-shirt Premium',
            slug: 't-shirt-premium',
            description: 'T-shirt en coton bio de haute qualité',
            price: 29.99,
            quantity: 200,
            category_id: categoryMap['mode'],
            main_image: DEFAULT_IMAGES.products.tshirt
          },
          {
            name: 'Sneakers Sport',
            slug: 'sneakers-sport',
            description: 'Chaussures de sport confortables et stylées',
            price: 89.99,
            quantity: 75,
            category_id: categoryMap['mode'],
            is_featured: true,
            main_image: DEFAULT_IMAGES.products.shoes
          }
        ];

        const { error: insertProdError } = await supabase
          .from('products')
          .insert(sampleProducts);
        
        if (insertProdError) {
          console.error('❌ Erreur insertion produits:', insertProdError);
        } else {
          console.log('✅ Produits d\'exemple créés');
        }
      }
    } catch (error) {
      console.error('❌ Erreur création données d\'exemple:', error);
    }
  }

  // Exécuter la migration complète
  async runMigration() {
    console.log('🚀 Début de la migration des images vers Supabase Storage...');
    
    try {
      // Initialiser les buckets
      await this.initializeBuckets();
      
      // Créer des données d'exemple si nécessaire
      await this.createSampleData();
      
      // Migrer les images
      await this.migrateCategoryImages();
      await this.migrateProductImages();
      await this.migrateAssets();
      
      // Sauvegarder le rapport de migration
      const report = {
        timestamp: new Date().toISOString(),
        migrated: this.migratedImages,
        failed: this.failedImages,
        summary: {
          total: Object.keys(this.migratedImages).length + this.failedImages.length,
          success: Object.keys(this.migratedImages).length,
          failed: this.failedImages.length
        }
      };
      
      await AsyncStorage.setItem('@migration_report', JSON.stringify(report));
      
      console.log('\n📊 Rapport de migration:');
      console.log(`✅ Images migrées: ${report.summary.success}`);
      console.log(`❌ Échecs: ${report.summary.failed}`);
      console.log('\n✨ Migration terminée!');
      
      return report;
    } catch (error) {
      console.error('❌ Erreur fatale lors de la migration:', error);
      throw error;
    }
  }
}

// Exporter l'instance et la fonction de migration
export const imageMigration = new ImageMigration();

export const runImageMigration = async () => {
  return await imageMigration.runMigration();
};
