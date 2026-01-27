import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../models/product.dart';

class RecommendationService {
  RecommendationService({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;

  Future<List<Product>> getRecommendations({int limit = 10}) async {
    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) {
      return [];
    }

    final url = '${AppConfig.backendUrl}/v1/recommendations';

    final res = await _dio.get(
      url,
      queryParameters: {'limit': limit},
      options: Options(
        headers: {
          'Authorization': 'Bearer ${session.accessToken}',
        },
        responseType: ResponseType.json,
      ),
    );

    final body = res.data;
    if (body is! Map) {
      return [];
    }

    final items = body['items'];
    if (items is! List) {
      return [];
    }

    return items
        .whereType<Map>()
        .map((e) => Product.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }
}
