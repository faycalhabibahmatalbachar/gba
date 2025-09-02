import { supabase } from './supabaseService';
import { REACT_APP_SUPABASE_URL } from '@env';

const BUCKET_NAMES = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  PROFILES: 'profiles',
  ASSETS: 'assets'
};

class StorageService {
  // Créer les buckets s'ils n'existent pas
  async initializeBuckets() {
    const buckets = Object.values(BUCKET_NAMES);
    
    for (const bucketName of buckets) {
      try {
        const { data, error } = await supabase.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 5242880 // 5MB
        });
        
        if (error && !error.message.includes('already exists')) {
          console.error(`Error creating bucket ${bucketName}:`, error);
        }
      } catch (err) {
        console.log(`Bucket ${bucketName} might already exist`);
      }
    }
  }

  // Upload une image vers un bucket
  async uploadImage(bucket, path, file, options = {}) {
    try {
      const fileName = `${Date.now()}_${path}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          ...options
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  // Upload multiple images
  async uploadMultipleImages(bucket, files) {
    const uploadPromises = files.map((file, index) => 
      this.uploadImage(bucket, `image_${index}.jpg`, file)
    );
    
    try {
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      console.error('Multiple upload error:', error);
      throw error;
    }
  }

  // Supprimer une image
  async deleteImage(bucket, path) {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  // Obtenir l'URL publique d'une image
  getPublicUrl(bucket, path) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  // Upload image de profil
  async uploadProfileImage(userId, file) {
    const path = `${userId}/avatar.jpg`;
    
    try {
      // Supprimer l'ancienne image si elle existe
      await this.deleteImage(BUCKET_NAMES.PROFILES, path);
    } catch (err) {
      // L'image n'existe peut-être pas
    }
    
    return this.uploadImage(BUCKET_NAMES.PROFILES, path, file, {
      upsert: true
    });
  }

  // Upload image de produit
  async uploadProductImage(productId, file, index = 0) {
    const path = `${productId}/image_${index}.jpg`;
    return this.uploadImage(BUCKET_NAMES.PRODUCTS, path, file);
  }

  // Upload images de produit multiples
  async uploadProductImages(productId, files) {
    const uploadPromises = files.map((file, index) => 
      this.uploadProductImage(productId, file, index)
    );
    
    return Promise.all(uploadPromises);
  }

  // Upload image de catégorie
  async uploadCategoryImage(categoryId, file) {
    const path = `${categoryId}/image.jpg`;
    return this.uploadImage(BUCKET_NAMES.CATEGORIES, path, file, {
      upsert: true
    });
  }

  // Migrer une image depuis une URL externe
  async migrateImageFromUrl(url, bucket, path) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      return this.uploadImage(bucket, path, blob);
    } catch (error) {
      console.error('Migration error:', error);
      return url; // Retourner l'URL originale en cas d'erreur
    }
  }

  // Migrer toutes les images d'un produit
  async migrateProductImages(product) {
    const migratedImages = [];
    
    // Migrer l'image principale
    if (product.main_image) {
      const mainImageUrl = await this.migrateImageFromUrl(
        product.main_image,
        BUCKET_NAMES.PRODUCTS,
        `${product.id}/main.jpg`
      );
      migratedImages.push(mainImageUrl);
    }
    
    // Migrer les autres images
    if (product.images && Array.isArray(product.images)) {
      for (let i = 0; i < product.images.length; i++) {
        const imageUrl = await this.migrateImageFromUrl(
          product.images[i],
          BUCKET_NAMES.PRODUCTS,
          `${product.id}/image_${i}.jpg`
        );
        migratedImages.push(imageUrl);
      }
    }
    
    return migratedImages;
  }
}

export const storageService = new StorageService();
export { BUCKET_NAMES };
