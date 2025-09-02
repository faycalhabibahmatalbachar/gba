import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/category.dart';
import '../models/product.dart';
import '../services/supabase_service.dart';

// Provider for categories list
final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return await SupabaseService.getCategories();
});

// Provider for products by category
final productsByCategoryProvider = FutureProvider.family<List<Product>, String>((ref, categoryId) async {
  return await SupabaseService.getProducts(categoryId: categoryId);
});

// Legacy provider for compatibility (will be removed later)
final categoriesStateProvider = StateNotifierProvider<CategoriesNotifier, CategoriesState>((ref) {
  return CategoriesNotifier();
});

class CategoriesState {
  final List<Category> categories;
  final bool isLoading;
  final String? error;

  CategoriesState({
    this.categories = const [],
    this.isLoading = false,
    this.error,
  });

  CategoriesState copyWith({
    List<Category>? categories,
    bool? isLoading,
    String? error,
  }) {
    return CategoriesState(
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class CategoriesNotifier extends StateNotifier<CategoriesState> {
  CategoriesNotifier() : super(CategoriesState()) {
    loadCategories();
  }

  Future<void> loadCategories() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final categories = await SupabaseService.getCategories();
      state = state.copyWith(categories: categories, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> refresh() async {
    await loadCategories();
  }
}
