import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/product.dart';
import '../models/category.dart';
import '../models/cart_item.dart';
import '../models/user.dart';

class SupabaseService {
  static final SupabaseClient client = Supabase.instance.client;
  static const bool _debugLogs = false;
  
  // Auth
  static User? get currentUser => client.auth.currentUser;
  static bool get isAuthenticated => currentUser != null;
  
  // Products
  static Future<List<Product>> getProducts({
    int limit = 20,
    int offset = 0,
    String? categoryId,
    String? searchQuery,
    bool featuredOnly = false,
  }) async {
    try {
      var query = client
          .from('products')
          .select('*, categories(name)')
          .eq('is_active', true);
      
      if (categoryId != null) {
        query = query.eq('category_id', categoryId);
      }
      
      if (featuredOnly) {
        query = query.eq('is_featured', true);
      }
      
      if (searchQuery != null && searchQuery.isNotEmpty) {
        query = query.ilike('name', '%$searchQuery%');
      }
      
      final response = await query
          .order('created_at', ascending: false)
          .range(offset, offset + limit - 1);
      
      return (response as List).map((json) {
        try {
          // Debug: print raw image URLs
          if (json['main_image'] != null) {
            print('📸 Raw image URL from DB: ${json['main_image']}');
          }
          if (json['images'] != null) {
            print('📸 Images array from DB: ${json['images']}');
          }
          
          // Validate required fields
          if (json['id'] == null || json['name'] == null || json['price'] == null) {
            print('Missing required fields: id=${json['id']}, name=${json['name']}, price=${json['price']}');
            return null;
          }
          
          // Convertir snake_case en camelCase pour le modèle Product
          final productJson = {
            'id': json['id'],
            'name': json['name'],
            'slug': json['slug'] ?? json['name'].toString().toLowerCase().replaceAll(' ', '-'),
            'description': json['description'],
            'price': json['price'],
            'compareAtPrice': json['compare_at_price'],
            'sku': json['sku'],
            'quantity': json['quantity'],
            'trackQuantity': json['track_quantity'] ?? true,
            'categoryId': json['category_id'],
            'categoryName': json['categoryName'],
            'brand': json['brand'],
            'mainImage': json['main_image'],
            'images': json['images'] ?? [],
            'specifications': json['specifications'] ?? {},
            'tags': json['tags'] ?? [],
            'rating': json['rating'] ?? 0.0,
            'reviewsCount': json['reviews_count'] ?? 0,
            'isFeatured': json['is_featured'] ?? false,
            'isActive': json['is_active'] ?? true,
            'createdAt': json['created_at'],
            'updatedAt': json['updated_at'],
          };
          
          print('📦 Product JSON ready: ${productJson['name']}, mainImage=${productJson['mainImage']}');
          
          return Product.fromJson(productJson);
        } catch (e) {
          print('Error parsing product: $e, json: $json');
          return null;
        }
      }).where((product) => product != null).cast<Product>().toList();
    } catch (e) {
      print('Error fetching products: $e');
      return [];
    }
  }
  
  static Future<Product?> getProductById(String id) async {
    try {
      final response = await client
          .from('products')
          .select('*, categories(name)')
          .eq('id', id)
          .single();
      
      if (response['categories'] != null) {
        response['categoryName'] = response['categories']['name'];
      }
      
      return Product.fromJson(response);
    } catch (e) {
      print('Error fetching product: $e');
      return null;
    }
  }
  
  // Categories
  static Future<List<Category>> getCategories() async {
    try {
      final response = await client
          .from('categories')
          .select()
          .eq('is_active', true)
          .order('display_order');
      
      return (response as List)
          .map((json) {
            // Ensure image URL is complete
            if (json['image_url'] != null && 
                json['image_url'].toString().isNotEmpty &&
                !json['image_url'].toString().startsWith('http')) {
              final storagePath = json['image_url'].toString();
              final publicUrl = client.storage
                  .from('categories')
                  .getPublicUrl(storagePath);
              json['image_url'] = publicUrl;
            }
            return Category.fromJson(json);
          })
          .toList();
    } catch (e) {
      print('Error fetching categories: $e');
      return [];
    }
  }
  
  // Cart
  static Future<List<CartItem>> getCartItems() async {
    if (!isAuthenticated) return [];
    
    try {
      final response = await client
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', currentUser!.id)
          .order('created_at');
      
      return (response as List).map((json) {
        if (json['products'] != null) {
          json['product'] = json['products'];
        }
        return CartItem.fromJson(json);
      }).toList();
    } catch (e) {
      print('Error fetching cart items: $e');
      return [];
    }
  }
  
  static Future<void> addToCart(String productId, int quantity, double price) async {
    if (!isAuthenticated) throw Exception('User not authenticated');
    
    try {
      // Check if item already exists
      final existing = await client
          .from('cart_items')
          .select()
          .eq('user_id', currentUser!.id)
          .eq('product_id', productId)
          .maybeSingle();
      
      if (existing != null) {
        // Update quantity
        await client
            .from('cart_items')
            .update({'quantity': existing['quantity'] + quantity})
            .eq('id', existing['id']);
      } else {
        // Insert new item with price
        await client.from('cart_items').insert({
          'user_id': currentUser!.id,
          'product_id': productId,
          'quantity': quantity,
          'price': price,
        });
      }
    } catch (e) {
      print('Error adding to cart: $e');
      throw e;
    }
  }
  
  static Future<void> updateCartItemQuantity(String itemId, int quantity) async {
    if (!isAuthenticated) throw Exception('User not authenticated');
    
    try {
      if (quantity <= 0) {
        await client.from('cart_items').delete().eq('id', itemId);
      } else {
        await client
            .from('cart_items')
            .update({'quantity': quantity})
            .eq('id', itemId);
      }
    } catch (e) {
      print('Error updating cart item: $e');
      throw e;
    }
  }
  
  static Future<void> removeFromCart(String itemId) async {
    if (!isAuthenticated) throw Exception('User not authenticated');
    
    try {
      await client.from('cart_items').delete().eq('id', itemId);
    } catch (e) {
      print('Error removing from cart: $e');
      throw e;
    }
  }
  
  static Future<void> clearCart() async {
    if (!isAuthenticated) throw Exception('User not authenticated');
    
    try {
      await client
          .from('cart_items')
          .delete()
          .eq('user_id', currentUser!.id);
    } catch (e) {
      print('Error clearing cart: $e');
      throw e;
    }
  }
  
  // User Profile
  static Future<UserProfile?> getUserProfile() async {
    if (!isAuthenticated) return null;
    
    try {
      final response = await client
          .from('profiles')
          .select()
          .eq('id', currentUser!.id)
          .maybeSingle();
      
      // Debug log
      if (_debugLogs) {
        print('Profile response type: ${response.runtimeType}');
        print('Profile response: $response');
      }
      
      if (response == null) {
        if (_debugLogs) {
          print('No profile found for user ${currentUser!.id}');
        }
        return null;
      }
      
      // Ensure response is a Map
      if (response is! Map<String, dynamic>) {
        if (_debugLogs) {
          print('Unexpected response type: ${response.runtimeType}');
        }
        return null;
      }
      
      return UserProfile.fromJson(response);
    } catch (e) {
      if (_debugLogs) {
        print('Error fetching user profile: $e');
        print('Stack trace: ${StackTrace.current}');
      }
      return null;
    }
  }
  
  static Future<void> updateUserProfile(Map<String, dynamic> updates) async {
    if (!isAuthenticated) throw Exception('User not authenticated');
    
    try {
      final safeUpdates = <String, dynamic>{
        ...updates,
        'updated_at': DateTime.now().toIso8601String(),
      };

      safeUpdates.removeWhere((key, value) => key == 'id');

      await client
          .from('profiles')
          .update(safeUpdates)
          .eq('id', currentUser!.id);
    } catch (e) {
      print('Error updating profile: $e');
      throw e;
    }
  }
}
