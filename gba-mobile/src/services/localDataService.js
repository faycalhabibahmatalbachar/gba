// Service de données local pour fonctionner sans Supabase
import AsyncStorage from '@react-native-async-storage/async-storage';

// Données de démonstration
const mockProducts = [
  {
    id: '1',
    sku: 'IPH14PRO',
    name: 'iPhone 14 Pro',
    description: 'Le dernier iPhone avec Dynamic Island et appareil photo 48MP',
    short_description: 'iPhone haut de gamme',
    category_id: '1',
    brand: 'Apple',
    model: '14 Pro',
    price: 699000,
    compare_at_price: 799000,
    quantity: 15,
    main_image: 'https://via.placeholder.com/300x300/667eea/ffffff?text=iPhone+14',
    images: ['https://via.placeholder.com/300x300/667eea/ffffff?text=iPhone+14'],
    specifications: {
      'Écran': '6.1 pouces',
      'Processeur': 'A16 Bionic',
      'Stockage': '128GB',
      'RAM': '6GB'
    },
    is_featured: true,
    is_active: true,
    rating: 4.5,
    reviews_count: 23
  },
  {
    id: '2',
    sku: 'SAM-S23',
    name: 'Samsung Galaxy S23',
    description: 'Smartphone Android premium avec appareil photo révolutionnaire',
    short_description: 'Galaxy flagship',
    category_id: '1',
    brand: 'Samsung',
    model: 'S23',
    price: 599000,
    compare_at_price: null,
    quantity: 8,
    main_image: 'https://via.placeholder.com/300x300/764ba2/ffffff?text=Galaxy+S23',
    images: ['https://via.placeholder.com/300x300/764ba2/ffffff?text=Galaxy+S23'],
    specifications: {
      'Écran': '6.1 pouces',
      'Processeur': 'Snapdragon 8 Gen 2',
      'Stockage': '256GB',
      'RAM': '8GB'
    },
    is_featured: true,
    is_active: true,
    rating: 4.3,
    reviews_count: 18
  },
  {
    id: '3',
    sku: 'MAC-PRO',
    name: 'MacBook Pro M3',
    description: 'Ordinateur portable professionnel avec puce M3',
    short_description: 'MacBook Pro 14"',
    category_id: '1',
    brand: 'Apple',
    model: 'MacBook Pro',
    price: 1200000,
    compare_at_price: 1400000,
    quantity: 5,
    main_image: 'https://via.placeholder.com/300x300/667eea/ffffff?text=MacBook',
    images: ['https://via.placeholder.com/300x300/667eea/ffffff?text=MacBook'],
    specifications: {
      'Écran': '14 pouces',
      'Processeur': 'M3 Pro',
      'Stockage': '512GB SSD',
      'RAM': '16GB'
    },
    is_featured: true,
    is_active: true,
    rating: 4.8,
    reviews_count: 42
  },
  {
    id: '4',
    sku: 'NIKE-TSH',
    name: 'T-shirt Nike Dri-FIT',
    description: 'T-shirt de sport respirant avec technologie Dri-FIT',
    short_description: 'T-shirt sport',
    category_id: '2',
    brand: 'Nike',
    model: 'Dri-FIT',
    price: 25000,
    compare_at_price: 35000,
    quantity: 30,
    main_image: 'https://via.placeholder.com/300x300/667eea/ffffff?text=Nike+Shirt',
    images: ['https://via.placeholder.com/300x300/667eea/ffffff?text=Nike+Shirt'],
    specifications: {
      'Matière': '100% Polyester',
      'Tailles': 'S, M, L, XL',
      'Couleurs': 'Noir, Blanc, Bleu'
    },
    is_featured: false,
    is_active: true,
    rating: 4.2,
    reviews_count: 15
  },
  {
    id: '5',
    sku: 'ADIDAS-SHOE',
    name: 'Adidas Ultra Boost',
    description: 'Chaussures de running avec amorti Boost',
    short_description: 'Chaussures running',
    category_id: '4',
    brand: 'Adidas',
    model: 'Ultra Boost',
    price: 65000,
    compare_at_price: 85000,
    quantity: 12,
    main_image: 'https://via.placeholder.com/300x300/764ba2/ffffff?text=Adidas',
    images: ['https://via.placeholder.com/300x300/764ba2/ffffff?text=Adidas'],
    specifications: {
      'Type': 'Running',
      'Pointures': '38-45',
      'Couleurs': 'Noir, Blanc'
    },
    is_featured: true,
    is_active: true,
    rating: 4.6,
    reviews_count: 28
  }
];

const mockCategories = [
  { id: '1', name: 'Électronique', icon: 'devices', description: 'Smartphones, ordinateurs et gadgets', is_active: true },
  { id: '2', name: 'Mode', icon: 'checkroom', description: 'Vêtements et accessoires', is_active: true },
  { id: '3', name: 'Maison', icon: 'home', description: 'Décoration et meubles', is_active: true },
  { id: '4', name: 'Sports', icon: 'sports-soccer', description: 'Équipements sportifs', is_active: true },
  { id: '5', name: 'Beauté', icon: 'face', description: 'Cosmétiques et soins', is_active: true },
  { id: '6', name: 'Jouets', icon: 'toys', description: 'Jeux et jouets pour enfants', is_active: true }
];

class LocalDataService {
  constructor() {
    this.initializeData();
  }

  async initializeData() {
    try {
      // Initialiser les produits dans AsyncStorage si nécessaire
      const existingProducts = await AsyncStorage.getItem('products');
      if (!existingProducts) {
        await AsyncStorage.setItem('products', JSON.stringify(mockProducts));
      }
      
      const existingCategories = await AsyncStorage.getItem('categories');
      if (!existingCategories) {
        await AsyncStorage.setItem('categories', JSON.stringify(mockCategories));
      }
    } catch (error) {
      console.error('Error initializing local data:', error);
    }
  }

  // Products
  async getProducts(filters = {}) {
    try {
      const data = await AsyncStorage.getItem('products');
      let products = data ? JSON.parse(data) : mockProducts;
      
      // Appliquer les filtres
      if (filters.category_id) {
        products = products.filter(p => p.category_id === filters.category_id);
      }
      if (filters.is_featured !== undefined) {
        products = products.filter(p => p.is_featured === filters.is_featured);
      }
      if (filters.is_active !== undefined) {
        products = products.filter(p => p.is_active === filters.is_active);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
        );
      }
      
      return { data: products, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async getProduct(id) {
    try {
      const data = await AsyncStorage.getItem('products');
      const products = data ? JSON.parse(data) : mockProducts;
      const product = products.find(p => p.id === id);
      
      if (!product) {
        return { data: null, error: 'Product not found' };
      }
      
      return { data: product, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async createProduct(productData) {
    try {
      const data = await AsyncStorage.getItem('products');
      const products = data ? JSON.parse(data) : mockProducts;
      
      const newProduct = {
        ...productData,
        id: Date.now().toString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      products.push(newProduct);
      await AsyncStorage.setItem('products', JSON.stringify(products));
      
      return { data: newProduct, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async updateProduct(id, updates) {
    try {
      const data = await AsyncStorage.getItem('products');
      let products = data ? JSON.parse(data) : mockProducts;
      
      const index = products.findIndex(p => p.id === id);
      if (index === -1) {
        return { data: null, error: 'Product not found' };
      }
      
      products[index] = {
        ...products[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      await AsyncStorage.setItem('products', JSON.stringify(products));
      
      return { data: products[index], error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async deleteProduct(id) {
    try {
      const data = await AsyncStorage.getItem('products');
      let products = data ? JSON.parse(data) : mockProducts;
      
      products = products.filter(p => p.id !== id);
      await AsyncStorage.setItem('products', JSON.stringify(products));
      
      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Categories
  async getCategories() {
    try {
      const data = await AsyncStorage.getItem('categories');
      const categories = data ? JSON.parse(data) : mockCategories;
      
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  // Cart
  async getCart(userId) {
    try {
      const data = await AsyncStorage.getItem(`cart_${userId || 'guest'}`);
      const cart = data ? JSON.parse(data) : [];
      
      return { data: cart, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async addToCart(userId, item) {
    try {
      const cartKey = `cart_${userId || 'guest'}`;
      const data = await AsyncStorage.getItem(cartKey);
      let cart = data ? JSON.parse(data) : [];
      
      const existingIndex = cart.findIndex(i => i.product_id === item.product_id);
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += item.quantity || 1;
      } else {
        cart.push({
          ...item,
          id: Date.now().toString(),
          created_at: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(cartKey, JSON.stringify(cart));
      
      return { data: cart, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async updateCartItem(userId, itemId, updates) {
    try {
      const cartKey = `cart_${userId || 'guest'}`;
      const data = await AsyncStorage.getItem(cartKey);
      let cart = data ? JSON.parse(data) : [];
      
      const index = cart.findIndex(i => i.id === itemId);
      if (index === -1) {
        return { data: null, error: 'Item not found' };
      }
      
      cart[index] = { ...cart[index], ...updates };
      await AsyncStorage.setItem(cartKey, JSON.stringify(cart));
      
      return { data: cart, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async removeFromCart(userId, itemId) {
    try {
      const cartKey = `cart_${userId || 'guest'}`;
      const data = await AsyncStorage.getItem(cartKey);
      let cart = data ? JSON.parse(data) : [];
      
      cart = cart.filter(i => i.id !== itemId);
      await AsyncStorage.setItem(cartKey, JSON.stringify(cart));
      
      return { data: cart, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async clearCart(userId) {
    try {
      const cartKey = `cart_${userId || 'guest'}`;
      await AsyncStorage.setItem(cartKey, JSON.stringify([]));
      
      return { error: null };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Orders
  async createOrder(orderData) {
    try {
      const data = await AsyncStorage.getItem('orders');
      let orders = data ? JSON.parse(data) : [];
      
      const newOrder = {
        ...orderData,
        id: Date.now().toString(),
        order_number: `ORD-${Date.now()}`,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      orders.push(newOrder);
      await AsyncStorage.setItem('orders', JSON.stringify(orders));
      
      return { data: newOrder, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  async getOrders(userId) {
    try {
      const data = await AsyncStorage.getItem('orders');
      let orders = data ? JSON.parse(data) : [];
      
      if (userId) {
        orders = orders.filter(o => o.user_id === userId);
      }
      
      return { data: orders, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }

  // Méthode de souscription factice
  subscribe(callback) {
    // Simuler des mises à jour
    const interval = setInterval(() => {
      callback({ event: 'UPDATE', new: mockProducts[0] });
    }, 30000);
    
    return () => clearInterval(interval);
  }
}

export const localDataService = new LocalDataService();
export default localDataService;
