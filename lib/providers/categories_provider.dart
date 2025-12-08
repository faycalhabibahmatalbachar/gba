import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class CategoriesProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  List<dynamic> _categories = [];
  bool _isLoading = false;
  
  List<dynamic> get categories => _categories;
  bool get isLoading => _isLoading;
  
  CategoriesProvider() {
    loadCategories();
  }
  
  Future<void> loadCategories() async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final response = await _supabase
          .from('categories')
          .select('*')
          .order('name');
      
      _categories = List<Map<String, dynamic>>.from(response);
    } catch (e) {
      print('Erreur chargement catégories: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
