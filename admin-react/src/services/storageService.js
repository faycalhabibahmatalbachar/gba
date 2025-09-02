import { supabase } from './supabaseService';

/**
 * Service pour gérer l'upload et la suppression d'images dans Supabase Storage
 */
export const StorageService = {
  /**
   * Upload une image dans le bucket products
   */
  async uploadProductImage(file, productId) {
    try {
      // Validation du fichier
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Format d\'image non supporté. Utilisez JPG, PNG, WEBP ou GIF.');
      }

      // Taille max 5MB
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('L\'image ne doit pas dépasser 5MB');
      }

      // Générer un nom unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      return {
        success: true,
        url: publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Erreur upload image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(files, productId) {
    try {
      const uploadPromises = files.map(file => 
        this.uploadProductImage(file, productId)
      );
      
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(r => r.success);
      const failedUploads = results.filter(r => !r.success);

      return {
        success: failedUploads.length === 0,
        uploaded: successfulUploads.map(u => u.url),
        failed: failedUploads.map(f => f.error),
        totalUploaded: successfulUploads.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Supprimer une image du storage
   */
  async deleteImage(imagePath) {
    try {
      // Extraire le chemin depuis l'URL si nécessaire
      let path = imagePath;
      if (imagePath.includes('supabase.co/storage')) {
        path = imagePath.split('/storage/v1/object/public/products/')[1];
        if (!path) {
          throw new Error('Chemin d\'image invalide');
        }
        path = `products/${path}`;
      }

      const { error } = await supabase.storage
        .from('products')
        .remove([path]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Erreur suppression image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Upload image de catégorie
   */
  async uploadCategoryImage(file, categoryId) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${categoryId}.${fileExt}`;
      const filePath = `categories/${fileName}`;

      const { data, error } = await supabase.storage
        .from('categories')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('categories')
        .getPublicUrl(filePath);

      return {
        success: true,
        url: publicUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Obtenir l'URL d'une image
   */
  getImageUrl(bucket, path) {
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return publicUrl;
  }
};

export default StorageService;
