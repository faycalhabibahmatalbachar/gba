import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/product.dart';

class ProductProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  List<Product> _products = [];
  bool _isLoading = false;
  
  List<Product> get products => _products;
  bool get isLoading => _isLoading;
  
  ProductProvider() {
    loadProducts();
  }
  
  Future<void> loadProducts() async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final response = await _supabase
          .from('products')
          .select('*')
          .order('created_at', ascending: false);
      
      _products = (response as List).map((item) {
        return Product(
          id: item['id'].toString(),
          name: item['name'] ?? '',
          description: item['description'] ?? '',
          price: (item['price'] ?? 0).toDouble(),
          mainImage: item['main_image'],
          categoryId: item['category_id']?.toString() ?? '',
          createdAt: DateTime.parse(item['created_at'] ?? DateTime.now().toIso8601String()),
        );
      }).toList();
    } catch (e) {
      print('Erreur chargement produits: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
