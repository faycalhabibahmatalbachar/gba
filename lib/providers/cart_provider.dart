import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/cart_item.dart';
import '../models/product.dart';
import '../services/activity_tracking_service.dart';

final cartProvider = ChangeNotifierProvider<CartProvider>((ref) {
  return CartProvider();
});

class CartProvider extends ChangeNotifier {
  final _supabase = Supabase.instance.client;
  List<CartItem> _items = [];
  bool _isLoading = false;
  String? _error;
  
  List<CartItem> get items => _items;
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);
  bool get isLoading => _isLoading;
  String? get error => _error;
  double get totalAmount => _items.fold(0, (sum, item) => sum + ((item.product?.price ?? 0) * item.quantity));
  
  CartProvider() {
    loadCart();
  }

  Future<void> loadCart({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }
    
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        _items = [];
        return;
      }
      
      final response = await _supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', user.id)
          .order('created_at', ascending: false);
      
      _items = (response as List).map((item) {
        final rawProduct = item['products'];

        Product? product;
        if (rawProduct is Map<String, dynamic>) {
          final rawImages = rawProduct['images'];
          final images = (rawImages is List)
              ? rawImages.map((e) => e.toString()).toList()
              : <String>[];

          final mainImage = (rawProduct['main_image'] ?? rawProduct['mainImage'])?.toString();
          final mappedProduct = <String, dynamic>{
            'id': rawProduct['id']?.toString(),
            'name': rawProduct['name'],
            'slug': rawProduct['slug'],
            'description': rawProduct['description'],
            'price': (rawProduct['price'] as num?)?.toDouble() ?? 0.0,
            'compareAtPrice': (rawProduct['compare_at_price'] as num?)?.toDouble(),
            'sku': rawProduct['sku'],
            'quantity': rawProduct['quantity'] ?? 0,
            'trackQuantity': rawProduct['track_quantity'] ?? true,
            'categoryId': rawProduct['category_id'],
            'categoryName': rawProduct['category_name'] ?? rawProduct['categoryName'],
            'brand': rawProduct['brand'],
            'mainImage': (mainImage != null && mainImage.isNotEmpty)
                ? mainImage
                : (images.isNotEmpty ? images.first : null),
            'images': images,
            'specifications': rawProduct['specifications'] ?? {},
            'tags': (rawProduct['tags'] is List)
                ? (rawProduct['tags'] as List).map((e) => e.toString()).toList()
                : <String>[],
            'rating': (rawProduct['rating'] as num?)?.toDouble() ?? 0.0,
            'reviewsCount': rawProduct['reviews_count'] ?? rawProduct['reviewsCount'] ?? 0,
            'isFeatured': rawProduct['is_featured'] ?? rawProduct['isFeatured'] ?? false,
            'isActive': rawProduct['is_active'] ?? rawProduct['isActive'] ?? true,
            'createdAt': rawProduct['created_at'],
            'updatedAt': rawProduct['updated_at'],
          };

          product = Product.fromJson(mappedProduct);
        }
        return CartItem(
          id: item['id'].toString(),
          userId: item['user_id'] as String,
          productId: item['product_id'] as String,
          quantity: item['quantity'] as int,
          product: product,
          createdAt: item['created_at'] != null 
              ? DateTime.parse(item['created_at']) 
              : null,
          updatedAt: item['updated_at'] != null 
              ? DateTime.parse(item['updated_at']) 
              : null,
        );
      }).toList();
      
    } catch (e) {
      _error = e.toString();
      print('Erreur chargement panier: $e');
    } finally {
      if (!silent) {
        _isLoading = false;
      }
      notifyListeners();
    }
  }

  Future<void> addItem(Product product, int quantity) async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) {
        throw Exception('User not authenticated');
      }

      _error = null;
      
      // Track activity
      await ActivityTrackingService().trackCartAdd(
        product.id,
        product.name,
        quantity,
      );
      
      final existingIndex = _items.indexWhere((item) => item.product?.id == product.id);

      if (existingIndex >= 0) {
        final existing = _items[existingIndex];

        _items[existingIndex] = CartItem(
          id: existing.id,
          userId: existing.userId,
          productId: existing.productId,
          quantity: existing.quantity + quantity,
          product: existing.product,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        );
        notifyListeners();

        await _supabase
            .from('cart_items')
            .update({'quantity': existing.quantity + quantity})
            .eq('id', existing.id);
      } else {
        final temp = CartItem(
          id: 'temp_${product.id}',
          userId: user.id,
          productId: product.id,
          quantity: quantity,
          product: product,
        );
        _items = [temp, ..._items];
        notifyListeners();

        final inserted = await _supabase
            .from('cart_items')
            .insert({
              'user_id': user.id,
              'product_id': product.id,
              'quantity': quantity,
              'price': product.price,
            })
            .select()
            .single();

        final tempIndex = _items.indexWhere((i) => i.id == temp.id);
        if (tempIndex >= 0) {
          _items[tempIndex] = CartItem(
            id: inserted['id'].toString(),
            userId: inserted['user_id'] as String,
            productId: inserted['product_id'] as String,
            quantity: inserted['quantity'] as int,
            product: product,
            createdAt: inserted['created_at'] != null
                ? DateTime.parse(inserted['created_at'])
                : null,
            updatedAt: inserted['updated_at'] != null
                ? DateTime.parse(inserted['updated_at'])
                : null,
          );
          notifyListeners();
        }
      }

      await loadCart(silent: true);
    } catch (e) {
      print('Erreur ajout au panier: $e');
      _error = e.toString();
      notifyListeners();
      throw e;
    }
  }

  Future<void> removeItem(String cartItemId) async {
    try {
      _error = null;

      final index = _items.indexWhere((i) => i.id == cartItemId);
      if (index >= 0) {
        _items = List<CartItem>.from(_items)..removeAt(index);
        notifyListeners();
      }

      await _supabase
          .from('cart_items')
          .delete()
          .eq('id', cartItemId);

      await loadCart(silent: true);
    } catch (e) {
      print('Erreur suppression: $e');
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> updateQuantity(String cartItemId, int quantity) async {
    if (quantity <= 0) {
      await removeItem(cartItemId);
      return;
    }
    
    try {
      _error = null;

      final index = _items.indexWhere((i) => i.id == cartItemId);
      if (index >= 0) {
        final existing = _items[index];
        _items[index] = CartItem(
          id: existing.id,
          userId: existing.userId,
          productId: existing.productId,
          quantity: quantity,
          product: existing.product,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        );
        notifyListeners();
      }

      await _supabase
          .from('cart_items')
          .update({'quantity': quantity})
          .eq('id', cartItemId);

      await loadCart(silent: true);
    } catch (e) {
      print('Erreur mise à jour quantité: $e');
      _error = e.toString();
      await loadCart(silent: true);
      notifyListeners();
    }
  }

  Future<void> clearCart() async {
    try {
      final user = _supabase.auth.currentUser;
      if (user == null) return;
      
      await _supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);
      
      _items = [];
      notifyListeners();
    } catch (e) {
      print('Erreur vidage panier: $e');
    }
  }
}
