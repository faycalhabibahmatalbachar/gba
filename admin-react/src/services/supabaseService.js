import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uvlrgwdbjegoavjfdrzb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2bHJnd2RiamVnb2F2amZkcnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzI3ODYsImV4cCI6MjA3MTgwODc4Nn0.ZuMcEKbCKo5CtQGdn2KAHqHfBdROpvtLp7nJpJSHOUQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ========================================
// SERVICES ADMIN POUR GESTION PRODUITS
// ========================================

export const AdminProductService = {
  // Créer un nouveau produit
  async create(productData) {
    try {
      // Préparer les données du produit
      const product = {
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        short_description: productData.short_description,
        category_id: productData.category_id,
        brand: productData.brand,
        model: productData.model,
        price: parseFloat(productData.price),
        compare_at_price: productData.compare_at_price ? parseFloat(productData.compare_at_price) : null,
        cost_price: productData.cost_price ? parseFloat(productData.cost_price) : null,
        quantity: parseInt(productData.quantity) || 0,
        low_stock_threshold: parseInt(productData.low_stock_threshold) || 10,
        unit: productData.unit || 'pièce',
        weight: productData.weight ? parseFloat(productData.weight) : null,
        dimensions: productData.dimensions || {},
        images: productData.images || [],
        main_image: productData.main_image || productData.images?.[0] || null,
        specifications: productData.specifications || {},
        tags: productData.tags || [],
        barcode: productData.barcode,
        is_featured: productData.is_featured || false,
        is_active: productData.is_active !== false,
        status: productData.quantity > 0 ? 'available' : 'out_of_stock',
        meta_title: productData.meta_title,
        meta_description: productData.meta_description,
        meta_keywords: productData.meta_keywords || [],
        // created_by: (await supabase.auth.getUser()).data.user?.id, // Désactivé pour le mode dev
      };

      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      
      // Créer les variantes si fournies
      if (productData.variants && productData.variants.length > 0) {
        const variants = productData.variants.map(v => ({
          product_id: data.id,
          name: v.name,
          sku: v.sku,
          price: v.price ? parseFloat(v.price) : null,
          quantity: parseInt(v.quantity) || 0,
          attributes: v.attributes || {},
          image_url: v.image_url,
          is_active: v.is_active !== false
        }));

        const { error: variantError } = await supabase
          .from('product_variants')
          .insert(variants);

        if (variantError) throw variantError;
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error creating product:', error);
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour un produit
  async update(productId, productData) {
    try {
      // Préparer les données de mise à jour
      const updates = {
        ...productData,
        price: productData.price ? parseFloat(productData.price) : undefined,
        compare_at_price: productData.compare_at_price ? parseFloat(productData.compare_at_price) : null,
        cost_price: productData.cost_price ? parseFloat(productData.cost_price) : null,
        quantity: productData.quantity !== undefined ? parseInt(productData.quantity) : undefined,
        low_stock_threshold: productData.low_stock_threshold ? parseInt(productData.low_stock_threshold) : undefined,
        weight: productData.weight ? parseFloat(productData.weight) : null,
        status: productData.quantity > 0 ? 'available' : 'out_of_stock',
        // updated_by: (await supabase.auth.getUser()).data.user?.id, // Désactivé pour le mode dev
        updated_at: new Date().toISOString()
      };

      // Nettoyer les champs undefined
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) delete updates[key];
      });

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      // Gérer les variantes si modifiées
      if (productData.variants) {
        // Supprimer les variantes existantes
        await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', productId);

        // Ajouter les nouvelles variantes
        if (productData.variants.length > 0) {
          const variants = productData.variants.map(v => ({
            product_id: productId,
            name: v.name,
            sku: v.sku,
            price: v.price ? parseFloat(v.price) : null,
            quantity: parseInt(v.quantity) || 0,
            attributes: v.attributes || {},
            image_url: v.image_url,
            is_active: v.is_active !== false
          }));

          await supabase
            .from('product_variants')
            .insert(variants);
        }
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }
  },

  // Supprimer un produit
  async delete(productId) {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
    }
  },

  // Désactiver un produit (soft delete)
  async deactivate(productId) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deactivating product:', error);
      return { success: false, error: error.message };
    }
  },

  // Activer un produit
  async activate(productId) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error activating product:', error);
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour le stock
  async updateStock(productId, quantity, operation = 'set') {
    try {
      let newQuantity = parseInt(quantity);

      if (operation === 'add' || operation === 'subtract') {
        // Récupérer la quantité actuelle
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', productId)
          .single();

        if (fetchError) throw fetchError;

        if (operation === 'add') {
          newQuantity = product.quantity + parseInt(quantity);
        } else {
          newQuantity = Math.max(0, product.quantity - parseInt(quantity));
        }
      }

      const { error } = await supabase
        .from('products')
        .update({ 
          quantity: newQuantity,
          status: newQuantity > 0 ? 'available' : 'out_of_stock',
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      return { success: true, newQuantity };
    } catch (error) {
      console.error('Error updating stock:', error);
      return { success: false, error: error.message };
    }
  },

  // Mettre à jour le prix
  async updatePrice(productId, newPrice, comparePrice = null) {
    try {
      const updates = {
        price: parseFloat(newPrice),
        updated_at: new Date().toISOString()
      };

      if (comparePrice !== null) {
        updates.compare_at_price = parseFloat(comparePrice);
      }

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating price:', error);
      return { success: false, error: error.message };
    }
  },

  // Marquer comme vedette
  async toggleFeatured(productId, isFeatured) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          is_featured: isFeatured,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error toggling featured:', error);
      return { success: false, error: error.message };
    }
  },

  // Upload d'images
  async uploadImage(file, productId) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Math.random()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      return { success: true, url: publicUrl };
    } catch (error) {
      console.error('Error uploading image:', error);
      return { success: false, error: error.message };
    }
  },

  // Importer des produits en masse
  async bulkImport(products) {
    try {
      // const { data: userData } = await supabase.auth.getUser(); // Désactivé pour le mode dev
      const processedProducts = products.map(p => ({
        ...p,
        price: parseFloat(p.price),
        compare_at_price: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
        quantity: parseInt(p.quantity) || 0,
        status: p.quantity > 0 ? 'available' : 'out_of_stock',
        is_active: true,
        // created_by: userData?.user?.id, // Désactivé pour le mode dev
      }));

      const { data, error } = await supabase
        .from('products')
        .insert(processedProducts)
        .select();

      if (error) throw error;
      return { success: true, data, count: data.length };
    } catch (error) {
      console.error('Error bulk importing:', error);
      return { success: false, error: error.message };
    }
  },

  // Exporter des produits
  async export(filters = {}) {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(name),
          variants:product_variants(*)
        `);

      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      if (filters.is_featured !== undefined) {
        query = query.eq('is_featured', filters.is_featured);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error exporting products:', error);
      return { success: false, error: error.message };
    }
  }
};

// ========================================
// SERVICES ADMIN POUR GESTION CATÉGORIES
// ========================================

export const AdminCategoryService = {
  async create(categoryData) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          name: categoryData.name,
          description: categoryData.description,
          icon: categoryData.icon,
          image_url: categoryData.image_url,
          parent_id: categoryData.parent_id,
          display_order: categoryData.display_order || 0,
          is_active: categoryData.is_active !== false
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creating category:', error);
      return { success: false, error: error.message };
    }
  },

  async update(categoryId, categoryData) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error updating category:', error);
      return { success: false, error: error.message };
    }
  },

  async delete(categoryId) {
    try {
      // Vérifier si des produits utilisent cette catégorie
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('category_id', categoryId)
        .limit(1);

      if (products && products.length > 0) {
        return { 
          success: false, 
          error: 'Cette catégorie contient des produits. Veuillez les déplacer avant de supprimer.' 
        };
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting category:', error);
      return { success: false, error: error.message };
    }
  }
};

export default supabase;
