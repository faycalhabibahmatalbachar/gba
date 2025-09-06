import 'package:supabase_flutter/supabase_flutter.dart';
import '../helpers/product_mapper.dart';

class CartService {
  final _supabase = Supabase.instance.client;

  // Ajouter au panier
  Future<void> addToCart(String productId, int quantity, double price) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      print('❌ [CartService] Utilisateur non connecté');
      throw Exception('Utilisateur non connecté');
    }

    print('📦 [CartService] Ajout au panier - ProductId: $productId, Qty: $quantity, Price: $price');

    try {
      // Vérifier si le produit est déjà dans le panier
      print('🔍 [CartService] Recherche produit existant...');
      final existing = await _supabase
          .from('cart_items')
          .select()
          .eq('user_id', userId)
          .eq('product_id', productId)
          .maybeSingle();

      if (existing != null) {
        print('✏️ [CartService] Produit existant trouvé, mise à jour quantité: ${existing['quantity']} + $quantity');
        // Mettre à jour la quantité SANS toucher last_updated
        final updateData = {
          'quantity': existing['quantity'] + quantity,
          'price': price,
          'created_at': existing['created_at'], // Préserver created_at
        };
        
        print('📤 [CartService] Données UPDATE: $updateData');
        
        await _supabase
            .from('cart_items')
            .update(updateData)
            .eq('id', existing['id']);
            
        print('✅ [CartService] Quantité mise à jour avec succès');
      } else {
        print('➕ [CartService] Nouveau produit, insertion...');
        // Ajouter nouveau produit avec timestamp explicite
        final insertData = {
          'user_id': userId,
          'product_id': productId,
          'quantity': quantity,
          'price': price,
          'created_at': DateTime.now().toIso8601String(),
        };
        
        print('📤 [CartService] Données INSERT: $insertData');
        
        await _supabase.from('cart_items').insert(insertData);
        print('✅ [CartService] Produit ajouté au panier avec succès');
      }
    } catch (e, stackTrace) {
      print('❌ [CartService] Erreur ajout panier:');
      print('   Message: $e');
      print('   Type: ${e.runtimeType}');
      print('   StackTrace: $stackTrace');
      
      // Si l'erreur contient last_updated, essayer sans timestamps
      if (e.toString().contains('last_updated')) {
        print('⚠️ [CartService] Problème last_updated détecté, tentative sans timestamps...');
        try {
          final existing = await _supabase
              .from('cart_items')
              .select()
              .eq('user_id', userId)
              .eq('product_id', productId)
              .maybeSingle();
              
          if (existing != null) {
            // Update minimal
            await _supabase
                .from('cart_items')
                .update({'quantity': existing['quantity'] + quantity})
                .eq('id', existing['id']);
          } else {
            // Insert minimal
            await _supabase.from('cart_items').insert({
              'user_id': userId,
              'product_id': productId,
              'quantity': quantity,
              'price': price
            });
          }
          print('✅ [CartService] Opération réussie avec approche minimale');
          return;
        } catch (e2) {
          print('❌ [CartService] Échec approche minimale: $e2');
        }
      }
      
      throw Exception('Erreur ajout panier: $e');
    }
  }

  // Obtenir les articles du panier
  Future<List<Map<String, dynamic>>> getCartItems() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      print('⚠️ [CartService] getCartItems - Utilisateur non connecté');
      return [];
    }

    try {
      print('🔍 [CartService] Récupération articles du panier pour user: $userId');
      final response = await _supabase
          .from('cart_items')
          .select('*, products(*)')
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      print('✅ [CartService] ${response.length} articles récupérés');
      
      // Mapper les produits de snake_case vers camelCase
      final mappedResponse = response.map((item) {
        final mappedItem = Map<String, dynamic>.from(item);
        if (mappedItem['products'] != null) {
          mappedItem['products'] = ProductMapper.fromSupabase(mappedItem['products']);
        }
        return mappedItem;
      }).toList();
      
      return List<Map<String, dynamic>>.from(mappedResponse);
    } catch (e, stackTrace) {
      print('❌ [CartService] Erreur récupération panier:');
      print('   Message: $e');
      print('   StackTrace: $stackTrace');
      return [];
    }
  }

  // Mettre à jour la quantité
  Future<void> updateQuantity(String cartItemId, int quantity) async {
    print('🔄 [CartService] Mise à jour quantité - ID: $cartItemId, Nouvelle Qty: $quantity');
    
    try {
      if (quantity <= 0) {
        print('🗑️ [CartService] Quantité <= 0, suppression de l\'article');
        await removeFromCart(cartItemId);
      } else {
        print('📝 [CartService] Mise à jour quantité...');
        await _supabase
            .from('cart_items')
            .update({'quantity': quantity})
            .eq('id', cartItemId);
        print('✅ [CartService] Quantité mise à jour avec succès');
      }
    } catch (e, stackTrace) {
      print('❌ [CartService] Erreur mise à jour quantité:');
      print('   Message: $e');
      print('   StackTrace: $stackTrace');
      throw Exception('Erreur mise à jour quantité: $e');
    }
  }

  // Supprimer du panier
  Future<void> removeFromCart(String cartItemId) async {
    try {
      await _supabase
          .from('cart_items')
          .delete()
          .eq('id', cartItemId);
    } catch (e) {
      throw Exception('Erreur suppression panier: $e');
    }
  }

  // Vider le panier
  Future<void> clearCart() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return;

    try {
      await _supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId);
    } catch (e) {
      throw Exception('Erreur vidage panier: $e');
    }
  }

  // Obtenir le nombre d'articles
  Future<int> getCartItemCount() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return 0;

    try {
      final response = await _supabase
          .from('cart_items')
          .select('quantity')
          .eq('user_id', userId);

      int total = 0;
      for (var item in response) {
        total += (item['quantity'] as int);
      }
      return total;
    } catch (e) {
      print('Erreur comptage panier: $e');
      return 0;
    }
  }

  // Calculer le total
  Future<double> getCartTotal() async {
    final items = await getCartItems();
    double total = 0;
    
    for (var item in items) {
      if (item['products'] != null) {
        final price = item['products']['price'] ?? 0;
        final quantity = item['quantity'] ?? 0;
        total += price * quantity;
      }
    }
    
    return total;
  }
}
