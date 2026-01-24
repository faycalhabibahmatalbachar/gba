import 'package:supabase_flutter/supabase_flutter.dart';

class ReviewService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Map<String, dynamic>>> getProductReviews({
    required String productId,
    int limit = 20,
    int offset = 0,
  }) async {
    final response = await _supabase
        .from('reviews')
        .select('id, product_id, user_id, rating, comment, created_at, profiles(first_name,last_name)')
        .eq('product_id', productId)
        .order('created_at', ascending: false)
        .range(offset, offset + limit - 1);

    return (response as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>?> getMyReview({required String productId}) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) return null;

    final response = await _supabase
        .from('reviews')
        .select('id, product_id, user_id, rating, comment, created_at, profiles(first_name,last_name)')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .maybeSingle();

    if (response is Map<String, dynamic>) return response;
    return null;
  }

  Future<void> upsertMyReview({
    required String productId,
    required int rating,
    String? comment,
  }) async {
    final userId = _supabase.auth.currentUser?.id;
    if (userId == null) throw Exception('Non connecté');

    final payload = <String, dynamic>{
      'product_id': productId,
      'user_id': userId,
      'rating': rating,
      'comment': (comment ?? '').trim().isEmpty ? null : comment!.trim(),
    };

    await _supabase.from('reviews').upsert(
          payload,
          onConflict: 'product_id,user_id',
        );
  }
}
