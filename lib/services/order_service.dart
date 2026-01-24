import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class OrderService {
  final _supabase = Supabase.instance.client;
  static const String _cacheKeyPrefix = 'cache_orders_v1_';
  static const String _cacheAtKeyPrefix = 'cache_orders_v1_at_';

  Future<void> _persistOrdersCache(String userId, List<Map<String, dynamic>> orders) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('$_cacheKeyPrefix$userId', jsonEncode(orders));
      await prefs.setInt(
        '$_cacheAtKeyPrefix$userId',
        DateTime.now().millisecondsSinceEpoch,
      );
    } catch (e) {
      print('Erreur cache commandes (persist): $e');
    }
  }

  Future<List<Map<String, dynamic>>> getCachedUserOrders() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_cacheKeyPrefix$userId');
      if (raw == null || raw.trim().isEmpty) return [];
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (e) {
      print('Erreur cache commandes (hydrate): $e');
      return [];
    }
  }

  // Créer une nouvelle commande
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> orderData) async {
    try {
      final currentUserId = _supabase.auth.currentUser?.id;
      print('[OrderService] createOrder start: auth.userId=$currentUserId');

      final now = DateTime.now().toUtc();
      final yyyymmdd = '${now.year.toString().padLeft(4, '0')}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}';
      final suffix = (now.millisecondsSinceEpoch % 10000).toString().padLeft(4, '0');
      final generatedOrderNumber = 'ORD-$yyyymmdd-$suffix';

      final insertData = <String, dynamic>{
        'order_number': generatedOrderNumber,
        'user_id': orderData['user_id'],
        'status': orderData['status'] ?? 'pending',
        'total_amount': orderData['total_amount'],
        'currency': orderData['currency'],
        'shipping_fee': orderData['shipping_fee'],
        'tax_amount': orderData['tax_amount'],
        'discount_amount': orderData['discount_amount'],
        'payment_method': orderData['payment_method'],
        'payment_status': orderData['payment_status'] ?? 'pending',
        'payment_provider': orderData['payment_provider'],
        'customer_name': orderData['customer_name'],
        'customer_phone': orderData['customer_phone'],
        'customer_email': orderData['customer_email'],
        'shipping_country': orderData['shipping_country'],
        'shipping_city': orderData['shipping_city'],
        'shipping_district': orderData['shipping_district'],
        'shipping_address': orderData['shipping_address'],
        'delivery_lat': orderData['delivery_lat'],
        'delivery_lng': orderData['delivery_lng'],
        'delivery_accuracy': orderData['delivery_accuracy'],
        'delivery_captured_at': orderData['delivery_captured_at'],
        'notes': orderData['notes'],
      };

      insertData.removeWhere((key, value) => value == null);

      print('[OrderService] orders.insert payload: ${jsonEncode(insertData)}');
      final userIdValue = insertData['user_id'];
      print('[OrderService] orders.insert user_id value=$userIdValue runtimeType=${userIdValue.runtimeType}');

      // Créer la commande principale
      Map<String, dynamic> orderResponse;
      var attemptsLeft = 6;
      while (true) {
        try {
          orderResponse = await _supabase
              .from('orders')
              .insert(insertData)
              .select()
              .single();
          break;
        } catch (e) {
          if (e is PostgrestException) {
            print(
              '[OrderService] orders.insert PostgrestException: code=${e.code}, message=${e.message}, details=${e.details}, hint=${e.hint}',
            );
          } else {
            print('[OrderService] orders.insert exception: $e');
          }

          // Si le schéma côté Supabase n'a pas certaines colonnes, on réessaie en les retirant.
          final message = e.toString();
          final isMissingColumn = message.contains("code: PGRST204") &&
              message.contains("Could not find the '") &&
              message.contains("' column");

          if (!isMissingColumn || attemptsLeft <= 0) {
            rethrow;
          }

          final match = RegExp(r"Could not find the '([^']+)' column")
              .firstMatch(message);
          final missingColumn = match?.group(1);
          if (missingColumn == null || !insertData.containsKey(missingColumn)) {
            rethrow;
          }

          insertData.remove(missingColumn);
          attemptsLeft--;
        }
      }

      final orderId = orderResponse['id'];
      final orderNumber = orderResponse['order_number'] ?? generatedOrderNumber;

      // Créer les items de la commande
      final items = orderData['items'] as List;
      for (var item in items) {
        await _supabase.from('order_items').insert({
          'order_id': orderId,
          'product_id': item['product_id'],
          'product_name': item['product_name'],
          'product_image': item['product_image'],
          'quantity': item['quantity'],
          'unit_price': item['unit_price'],
          'total_price': item['total_price'],
        });
      }

      return {
        'success': true,
        'order_id': orderId,
        'order_number': orderNumber,
      };
    } catch (e) {
      if (e is PostgrestException) {
        print(
          '[OrderService] Erreur création commande (PostgrestException): code=${e.code}, message=${e.message}, details=${e.details}, hint=${e.hint}',
        );
      } else {
        print('[OrderService] Erreur création commande: $e');
      }
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  // Obtenir les commandes de l'utilisateur
  Future<List<Map<String, dynamic>>> getUserOrders() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    try {
      final response = await _supabase
          .from('order_details_view')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false);

      final orders = List<Map<String, dynamic>>.from(response);
      await _persistOrdersCache(userId, orders);
      return orders;
    } catch (e) {
      print('Erreur récupération commandes: $e');
      return [];
    }
  }

  // Obtenir une commande par ID
  Future<Map<String, dynamic>?> getOrderById(String orderId) async {
    try {
      final response = await _supabase
          .from('order_details_view')
          .select()
          .eq('id', orderId)
          .single();

      return response;
    } catch (e) {
      print('Erreur récupération commande: $e');
      return null;
    }
  }

  // Mettre à jour le statut d'une commande (Admin)
  Future<bool> updateOrderStatus(String orderId, String newStatus) async {
    try {
      await _supabase
          .from('orders')
          .update({'status': newStatus})
          .eq('id', orderId);

      return true;
    } catch (e) {
      print('Erreur mise à jour statut: $e');
      return false;
    }
  }

  // Obtenir toutes les commandes (Admin)
  Future<List<Map<String, dynamic>>> getAllOrders() async {
    try {
      final response = await _supabase
          .from('order_details_view')
          .select()
          .order('created_at', ascending: false);

      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      print('Erreur récupération toutes les commandes: $e');
      return [];
    }
  }

  // Obtenir les statistiques des commandes
  Future<Map<String, dynamic>> getOrderStatistics(String period) async {
    try {
      final response = await _supabase
          .rpc('get_order_statistics', params: {'p_period': period});

      if (response != null && response.isNotEmpty) {
        return response[0];
      }
      return {};
    } catch (e) {
      print('Erreur récupération statistiques: $e');
      return {};
    }
  }

  // Stream pour écouter les changements de commandes en temps réel
  Stream<List<Map<String, dynamic>>> ordersStream() {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return Stream.value(const []);

    return _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false);
  }

  // Stream pour une commande spécifique
  Stream<Map<String, dynamic>> orderStream(String orderId) {
    return _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('id', orderId)
        .map((data) => data.isNotEmpty ? data.first : {});
  }
}
