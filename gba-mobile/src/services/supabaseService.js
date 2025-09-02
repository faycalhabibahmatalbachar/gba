import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY } from '@env';

// Use dummy values if environment variables are not set
const supabaseUrl = REACT_APP_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU3MzY0MDAsImV4cCI6MTk2MTMxMjQwMH0.dummy_key_for_development';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Service local de fallback
class LocalService {
  constructor() {
    this.products = [];
    this.categories = [];
    this.loadFromStorage();
  }

  async loadFromStorage() {
    try {
      const storedProducts = await AsyncStorage.getItem('@products');
      const storedCategories = await AsyncStorage.getItem('@categories');
      
      if (storedProducts) this.products = JSON.parse(storedProducts);
      if (storedCategories) this.categories = JSON.parse(storedCategories);
    } catch (error) {
      console.error('Load from storage error:', error);
    }
  }

  async saveToStorage() {
    try {
      await AsyncStorage.setItem('@products', JSON.stringify(this.products));
      await AsyncStorage.setItem('@categories', JSON.stringify(this.categories));
    } catch (error) {
      console.error('Save to storage error:', error);
    }
  }

  async getProducts() {
    return this.products;
  }

  async getCategories() {
    return this.categories;
  }

  async getProductById(id) {
    return this.products.find(p => p.id === id);
  }

  async searchProducts(query) {
    const searchTerm = query.toLowerCase();
    return this.products.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm)
    );
  }
}

class SupabaseService {
  constructor() {
    this.localService = new LocalService();
    this.isOnline = true;
    this.subscriptions = [];
    this.checkConnection();
  }

  async checkConnection() {
    try {
      const { error } = await supabase.from('products').select('id').limit(1);
      this.isOnline = !error;
      if (this.isOnline) {
        this.syncWithSupabase();
      }
    } catch (error) {
      this.isOnline = false;
    }
  }

  async syncWithSupabase() {
    if (!this.isOnline) return;
    
    try {
      // Synchroniser le panier local avec Supabase
      const localCart = await AsyncStorage.getItem('@cart');
      if (localCart && supabase.auth.getUser()) {
        const cartItems = JSON.parse(localCart);
        for (const item of cartItems) {
          await this.addToCart(item.product_id, item.quantity);
        }
        await AsyncStorage.removeItem('@cart');
      }

      // Synchroniser les commandes en attente
      const pendingOrders = await AsyncStorage.getItem('@pending_orders');
      if (pendingOrders) {
        const orders = JSON.parse(pendingOrders);
        for (const order of orders) {
          await this.createOrder(order);
        }
        await AsyncStorage.removeItem('@pending_orders');
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  // Gestion du panier
  async addToCart(productId, quantity = 1) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('cart_items')
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Add to cart error:', error);
      throw error;
    }
  }

  async getCartItems() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get cart error:', error);
      return [];
    }
  }

  async removeFromCart(productId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .match({ user_id: user.id, product_id: productId });

      if (error) throw error;
    } catch (error) {
      console.error('Remove from cart error:', error);
      throw error;
    }
  }

  async clearCart() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Clear cart error:', error);
      throw error;
    }
  }

  // Gestion des commandes
  async createOrder(orderData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          ...orderData
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create order error:', error);
      // Sauvegarder localement si offline
      if (!this.isOnline) {
        const pendingOrders = await AsyncStorage.getItem('@pending_orders');
        const orders = pendingOrders ? JSON.parse(pendingOrders) : [];
        orders.push(orderData);
        await AsyncStorage.setItem('@pending_orders', JSON.stringify(orders));
      }
      throw error;
    }
  }

  async getOrders() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get orders error:', error);
      return [];
    }
  }

  // Wishlist
  async addToWishlist(productId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          product_id: productId
        });

      if (error && !error.message.includes('duplicate')) throw error;
      return data;
    } catch (error) {
      console.error('Add to wishlist error:', error);
      throw error;
    }
  }

  async getWishlist() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          product:products(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get wishlist error:', error);
      return [];
    }
  }

  async removeFromWishlist(productId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('wishlist')
        .delete()
        .match({ user_id: user.id, product_id: productId });

      if (error) throw error;
    } catch (error) {
      console.error('Remove from wishlist error:', error);
      throw error;
    }
  }

  // Temps réel
  subscribeToProducts(callback) {
    const subscription = supabase
      .channel('products-channel')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Product change:', payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscriptions.push(subscription);
    return subscription;
  }

  subscribeToCart(userId, callback) {
    const subscription = supabase
      .channel(`cart-${userId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'cart_items',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Cart change:', payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscriptions.push(subscription);
    return subscription;
  }

  subscribeToOrders(userId, callback) {
    const subscription = supabase
      .channel(`orders-${userId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Order change:', payload);
          callback(payload);
        }
      )
      .subscribe();

    this.subscriptions.push(subscription);
    return subscription;
  }

  // Nettoyer les subscriptions
  unsubscribeAll() {
    this.subscriptions.forEach(sub => {
      supabase.removeChannel(sub);
    });
    this.subscriptions = [];
  }
}

// ========================================
// SERVICES PRODUITS
// ========================================

export const ProductService = {
  // Récupérer tous les produits actifs
  async getAll(filters = {}) {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Appliquer les filtres
      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      if (filters.is_featured) {
        query = query.eq('is_featured', true);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.min_price) {
        query = query.gte('price', filters.min_price);
      }
      if (filters.max_price) {
        query = query.lte('price', filters.max_price);
      }
      if (filters.in_stock) {
        query = query.gt('quantity', 0);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching products:', error);
      return { success: false, error: error.message };
    }
  },

  // Récupérer un produit par ID
  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name),
          reviews:product_reviews(
            *,
            user:profiles(full_name, avatar_url)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Incrémenter le compteur de vues
      await supabase
        .from('products')
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq('id', id);

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching product:', error);
      return { success: false, error: error.message };
    }
  },

  // Récupérer les produits vedettes
  async getFeatured(limit = 10) {
    return this.getAll({ is_featured: true, limit });
  },

  // Rechercher des produits
  async search(query) {
    return this.getAll({ search: query });
  },

  // Récupérer les produits par catégorie
  async getByCategory(categoryId) {
    return this.getAll({ category_id: categoryId });
  },

  // S'abonner aux changements de produits en temps réel
  subscribeToProducts(callback) {
    const subscription = supabase
      .channel('products-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Product change received:', payload);
          callback(payload);
        }
      )
      .subscribe();

    return subscription;
  },

  // Se désabonner des changements
  unsubscribe(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
};

// ========================================
// SERVICES CATÉGORIES
// ========================================

export const CategoryService = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { success: false, error: error.message };
    }
  },

  async getById(id) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching category:', error);
      return { success: false, error: error.message };
    }
  },

  subscribeToCategories(callback) {
    const subscription = supabase
      .channel('categories-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        callback
      )
      .subscribe();

    return subscription;
  }
};

// ========================================
// SERVICES PANIER
// ========================================

export const CartService = {
  async getCart(userId) {
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(
            id, name, price, main_image, quantity as stock
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching cart:', error);
      return { success: false, error: error.message };
    }
  },

  async addToCart(userId, productId, quantity = 1, variantId = null) {
    try {
      // Vérifier si l'article existe déjà
      const { data: existing } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('variant_id', variantId)
        .single();

      if (existing) {
        // Mettre à jour la quantité
        const { error } = await supabase
          .from('cart_items')
          .update({ 
            quantity: existing.quantity + quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Ajouter un nouvel article
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: userId,
            product_id: productId,
            variant_id: variantId,
            quantity
          });

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding to cart:', error);
      return { success: false, error: error.message };
    }
  },

  async updateQuantity(cartItemId, quantity) {
    try {
      if (quantity <= 0) {
        return this.removeFromCart(cartItemId);
      }

      const { error } = await supabase
        .from('cart_items')
        .update({ 
          quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', cartItemId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error updating cart quantity:', error);
      return { success: false, error: error.message };
    }
  },

  async removeFromCart(cartItemId) {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', cartItemId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing from cart:', error);
      return { success: false, error: error.message };
    }
  },

  async clearCart(userId) {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error clearing cart:', error);
      return { success: false, error: error.message };
    }
  },

  async syncLocalCart(userId, localCart) {
    try {
      // Récupérer le panier existant
      const { data: existingCart } = await this.getCart(userId);

      // Fusionner avec le panier local
      for (const item of localCart) {
        await this.addToCart(
          userId, 
          item.product_id, 
          item.quantity, 
          item.variant_id
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error syncing cart:', error);
      return { success: false, error: error.message };
    }
  }
};

// ========================================
// SERVICES COMMANDES
// ========================================

export const OrderService = {
  async create(orderData) {
    try {
      // Générer un numéro de commande unique
      const orderNumber = `GBA${Date.now()}`;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          ...orderData
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Ajouter les articles de la commande
      if (orderData.items && orderData.items.length > 0) {
        const orderItems = orderData.items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_image: item.product_image,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      return { success: true, data: order };
    } catch (error) {
      console.error('Error creating order:', error);
      return { success: false, error: error.message };
    }
  },

  async getOrders(userId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return { success: false, error: error.message };
    }
  },

  async getOrderById(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(*)
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: error.message };
    }
  },

  subscribeToOrderUpdates(userId, callback) {
    const subscription = supabase
      .channel('user-orders')
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return subscription;
  }
};

// ========================================
// SERVICES FAVORIS
// ========================================

export const WishlistService = {
  async getWishlist(userId) {
    try {
      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          product:products(*)
        `)
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  async addToWishlist(userId, productId) {
    try {
      const { error } = await supabase
        .from('wishlist')
        .insert({
          user_id: userId,
          product_id: productId
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      return { success: false, error: error.message };
    }
  },

  async removeFromWishlist(userId, productId) {
    try {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return { success: false, error: error.message };
    }
  }
};

// ========================================
// SERVICES CHAT/MESSAGES
// ========================================

export const MessageService = {
  async getConversations(userId) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          messages(*)
        `)
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, error: error.message };
    }
  },

  async getMessages(conversationId) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { success: false, error: error.message };
    }
  },

  async sendMessage(conversationId, message, senderId) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          message,
          sender_type: 'user'
        })
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour la conversation
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      return { success: true, data };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  },

  subscribeToMessages(conversationId, callback) {
    const subscription = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        callback
      )
      .subscribe();

    return subscription;
  }
};

export default supabase;
