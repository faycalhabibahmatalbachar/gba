import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/product.dart';
import '../services/supabase_service.dart';

// Products Provider with filters
final productsProvider = StateNotifierProvider<ProductsNotifier, ProductsState>((ref) {
  return ProductsNotifier();
});

// Single Product Provider
final productDetailProvider = FutureProvider.family<Product?, String>((ref, id) async {
  return await SupabaseService.getProductById(id);
});

// Featured Products Provider
final featuredProductsProvider = FutureProvider<List<Product>>((ref) async {
  return await SupabaseService.getProducts(featuredOnly: true, limit: 10);
});

class ProductsState {
  final List<Product> products;
  final bool isLoading;
  final bool hasMore;
  final String? error;
  final String? selectedCategoryId;
  final String? searchQuery;

  ProductsState({
    this.products = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.error,
    this.selectedCategoryId,
    this.searchQuery,
  });

  ProductsState copyWith({
    List<Product>? products,
    bool? isLoading,
    bool? hasMore,
    String? error,
    String? selectedCategoryId,
    String? searchQuery,
  }) {
    return ProductsState(
      products: products ?? this.products,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      error: error,
      selectedCategoryId: selectedCategoryId ?? this.selectedCategoryId,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class ProductsNotifier extends StateNotifier<ProductsState> {
  ProductsNotifier() : super(ProductsState()) {
    loadProducts();
  }

  Future<void> loadProducts({bool refresh = false}) async {
    if (state.isLoading) return;
    
    state = state.copyWith(isLoading: true, error: null);
    
    try {
      final products = await SupabaseService.getProducts(
        offset: refresh ? 0 : state.products.length,
        categoryId: state.selectedCategoryId,
        searchQuery: state.searchQuery,
      );
      
      if (refresh) {
        state = state.copyWith(
          products: products,
          isLoading: false,
          hasMore: products.length >= 20,
        );
      } else {
        state = state.copyWith(
          products: [...state.products, ...products],
          isLoading: false,
          hasMore: products.length >= 20,
        );
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setCategory(String? categoryId) {
    state = state.copyWith(selectedCategoryId: categoryId, products: []);
    loadProducts(refresh: true);
  }

  void setSearchQuery(String? query) {
    state = state.copyWith(searchQuery: query, products: []);
    loadProducts(refresh: true);
  }

  void clearFilters() {
    state = ProductsState();
    loadProducts(refresh: true);
  }
}
