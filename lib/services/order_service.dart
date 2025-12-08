import 'package:supabase_flutter/supabase_flutter.dart';

class OrderService {
  final _supabase = Supabase.instance.client;

  // Créer une nouvelle commande
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> orderData) async {
    try {
      // Créer la commande principale
      final orderResponse = await _supabase
          .from('orders')
          .insert({
            'user_id': orderData['user_id'],
            'shipping_address': orderData['shipping_address'],
            'payment_method': orderData['payment_method'],
            'subtotal': orderData['subtotal'],
            'shipping_cost': orderData['shipping_cost'],
            'total_amount': orderData['total_amount'],
            'notes': orderData['notes'],
            'status': 'pending',
            'payment_status': 'pending',
          })
          .select()
          .single();

      final orderId = orderResponse['id'];
      final orderNumber = orderResponse['order_number'];

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
      print('Erreur création commande: $e');
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

      return List<Map<String, dynamic>>.from(response);
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
    return _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
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
