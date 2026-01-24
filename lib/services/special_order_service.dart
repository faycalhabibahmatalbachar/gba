import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

class SpecialOrderService {
  final SupabaseClient _supabase;

  SpecialOrderService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  Future<Map<String, dynamic>> createSpecialOrder({
    required String productName,
    required int quantity,
    required String description,
    required String shippingMethod,
    String? notes,
    double? deliveryLat,
    double? deliveryLng,
    double? deliveryAccuracy,
    String? deliveryCapturedAt,
    required List<SpecialOrderUploadImage> images,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) {
      return {
        'success': false,
        'error': 'Utilisateur non connecté',
      };
    }

    try {
      final insertData = <String, dynamic>{
        'user_id': userId,
        'product_name': productName,
        'quantity': quantity,
        'description': description,
        'shipping_method': shippingMethod,
        'notes': notes,
        'status': 'pending',
        'delivery_lat': deliveryLat,
        'delivery_lng': deliveryLng,
        'delivery_accuracy': deliveryAccuracy,
        'delivery_captured_at': deliveryCapturedAt,
      };

      insertData.removeWhere((key, value) => value == null);

      Map<String, dynamic> order;
      var attemptsLeft = 6;
      while (true) {
        try {
          order = await _supabase
              .from('special_orders')
              .insert(insertData)
              .select()
              .single();
          break;
        } catch (e) {
          final message = e.toString();
          final isMissingColumn = message.contains("code: PGRST204") &&
              message.contains("Could not find the '") &&
              message.contains("' column");

          if (!isMissingColumn || attemptsLeft <= 0) {
            rethrow;
          }

          final match = RegExp(r"Could not find the '([^']+)' column").firstMatch(message);
          final missingColumn = match?.group(1);
          if (missingColumn == null || !insertData.containsKey(missingColumn)) {
            rethrow;
          }

          insertData.remove(missingColumn);
          attemptsLeft--;
        }
      }

      final orderId = order['id'].toString();

      final uploaded = <Map<String, dynamic>>[];
      for (final image in images) {
        final ext = _guessExtension(image.mimeType, image.fileName);
        final objectPath = '$userId/$orderId/${DateTime.now().millisecondsSinceEpoch}_${image.randomSuffix}.$ext';

        final contentType = (image.mimeType != null && image.mimeType!.trim().isNotEmpty)
            ? image.mimeType!.trim()
            : _contentTypeForExtension(ext);

        await _supabase.storage.from('special_orders').uploadBinary(
              objectPath,
              image.bytes,
              fileOptions: FileOptions(
                cacheControl: '3600',
                upsert: false,
                contentType: contentType,
              ),
            );

        final publicUrl = _supabase.storage.from('special_orders').getPublicUrl(objectPath);

        final row = await _supabase
            .from('special_order_images')
            .insert({
              'special_order_id': orderId,
              'user_id': userId,
              'image_path': objectPath,
              'image_url': publicUrl,
            })
            .select()
            .single();

        uploaded.add(row);
      }

      return {
        'success': true,
        'order': order,
        'images': uploaded,
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  Future<List<Map<String, dynamic>>> getUserSpecialOrders() async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return [];

    final response = await _supabase
        .from('special_order_details_view')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    return (response as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>?> getSpecialOrderById(String specialOrderId) async {
    final response = await _supabase
        .from('special_order_details_view')
        .select()
        .eq('id', specialOrderId)
        .maybeSingle();
    return response;
  }

  Future<List<Map<String, dynamic>>> getOffers(String specialOrderId) async {
    final response = await _supabase
        .from('special_order_offers')
        .select()
        .eq('special_order_id', specialOrderId)
        .order('created_at', ascending: true);
    return (response as List).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getEvents(String specialOrderId) async {
    final response = await _supabase
        .from('special_order_events')
        .select()
        .eq('special_order_id', specialOrderId)
        .order('created_at', ascending: true);
    return (response as List).cast<Map<String, dynamic>>();
  }

  Future<void> acceptQuote(String specialOrderId) async {
    await _supabase.rpc(
      'customer_accept_special_order_quote',
      params: {'p_special_order_id': specialOrderId},
    );
  }

  Future<void> rejectQuote(String specialOrderId, {String? message}) async {
    await _supabase.rpc(
      'customer_reject_special_order_quote',
      params: {
        'p_special_order_id': specialOrderId,
        'p_message': message,
      },
    );
  }

  Future<void> counterQuote(
    String specialOrderId, {
    required double unitPrice,
    required double shippingFee,
    String? message,
  }) async {
    await _supabase.rpc(
      'customer_counter_special_order_quote',
      params: {
        'p_special_order_id': specialOrderId,
        'p_unit_price': unitPrice,
        'p_shipping_fee': shippingFee,
        'p_message': message,
      },
    );
  }

  String _guessExtension(String? mimeType, String fileName) {
    final nameExt = fileName.split('.').last.toLowerCase();
    if (nameExt.length <= 5 && nameExt != fileName.toLowerCase()) {
      return nameExt;
    }

    switch (mimeType) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      case 'image/jpeg':
      case 'image/jpg':
      default:
        return 'jpg';
    }
  }

  String _contentTypeForExtension(String ext) {
    switch (ext.toLowerCase()) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpeg':
      case 'jpg':
      default:
        return 'image/jpeg';
    }
  }
}

class SpecialOrderUploadImage {
  final Uint8List bytes;
  final String fileName;
  final String? mimeType;
  final String randomSuffix;

  const SpecialOrderUploadImage({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.randomSuffix,
  });
}
