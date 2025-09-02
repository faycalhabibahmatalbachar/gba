import { useState, useEffect } from 'react';
import { ProductService, CategoryService } from '../services/supabaseService';

// Hook pour récupérer et synchroniser les produits en temps réel
export function useProducts(filters = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Charger les produits
  const fetchProducts = async () => {
    try {
      setError(null);
      const result = await ProductService.getAll(filters);
      
      if (result.success) {
        setProducts(result.data || []);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Rafraîchir les produits
  const refresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  // Gérer les changements en temps réel
  useEffect(() => {
    // Charger les produits initiaux
    fetchProducts();

    // S'abonner aux changements en temps réel
    const subscription = ProductService.subscribeToProducts(async (payload) => {
      console.log('Product change detected:', payload.eventType);

      if (payload.eventType === 'INSERT') {
        // Nouveau produit ajouté
        const newProduct = payload.new;
        setProducts(prev => [newProduct, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        // Produit modifié
        const updatedProduct = payload.new;
        setProducts(prev => prev.map(p => 
          p.id === updatedProduct.id ? updatedProduct : p
        ));
      } else if (payload.eventType === 'DELETE') {
        // Produit supprimé
        const deletedId = payload.old.id;
        setProducts(prev => prev.filter(p => p.id !== deletedId));
      }
    });

    // Cleanup
    return () => {
      ProductService.unsubscribe(subscription);
    };
  }, [JSON.stringify(filters)]);

  return {
    products,
    loading,
    error,
    refreshing,
    refresh,
  };
}

// Hook pour récupérer un seul produit
export function useProduct(productId) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setError(null);
        const result = await ProductService.getById(productId);
        
        if (result.success) {
          setProduct(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();

    // S'abonner aux changements du produit spécifique
    const subscription = ProductService.subscribeToProducts((payload) => {
      if (payload.new && payload.new.id === productId) {
        if (payload.eventType === 'UPDATE') {
          setProduct(payload.new);
        } else if (payload.eventType === 'DELETE') {
          setProduct(null);
        }
      }
    });

    return () => {
      ProductService.unsubscribe(subscription);
    };
  }, [productId]);

  return {
    product,
    loading,
    error,
  };
}

// Hook pour les produits vedettes
export function useFeaturedProducts() {
  return useProducts({ is_featured: true, limit: 10 });
}

// Hook pour les nouveaux produits
export function useNewProducts(limit = 10) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNewProducts = async () => {
      try {
        const result = await ProductService.getAll({ limit });
        
        if (result.success) {
          // Les produits sont déjà triés par date de création (desc)
          setProducts(result.data || []);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNewProducts();
  }, [limit]);

  return {
    products,
    loading,
    error,
  };
}

// Hook pour les catégories
export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await CategoryService.getAll();
        
        if (result.success) {
          setCategories(result.data || []);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();

    // S'abonner aux changements de catégories
    const subscription = CategoryService.subscribeToCategories((payload) => {
      if (payload.eventType === 'INSERT') {
        setCategories(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setCategories(prev => prev.map(c => 
          c.id === payload.new.id ? payload.new : c
        ));
      } else if (payload.eventType === 'DELETE') {
        setCategories(prev => prev.filter(c => c.id !== payload.old.id));
      }
    });

    return () => {
      CategoryService.unsubscribe(subscription);
    };
  }, []);

  return {
    categories,
    loading,
    error,
  };
}

// Hook pour rechercher des produits
export function useProductSearch(query) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await ProductService.search(query);
        
        if (result.success) {
          setResults(result.data || []);
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSearching(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(searchTimeout);
  }, [query]);

  return {
    results,
    searching,
    error,
  };
}
