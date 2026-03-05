import 'package:freezed_annotation/freezed_annotation.dart';

part 'product.freezed.dart';
part 'product.g.dart';

@freezed
class Product with _$Product {
  const factory Product({
    required String id,
    required String name,
    String? slug,
    String? description,
    required double price,
    double? compareAtPrice,
    String? sku,
    @Default(0) int quantity,
    @Default(true) bool trackQuantity,
    String? categoryId,
    String? categoryName,
    String? brand,
    String? mainImage,
    @Default([]) List<String> images,
    @Default({}) Map<String, dynamic> specifications,
    @Default([]) List<String> tags,
    @Default(0.0) double rating,
    @Default(0) int reviewsCount,
    @Default(false) bool isFeatured,
    @Default(true) bool isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);

  /// Parse from Supabase row (snake_case keys) into Product (camelCase).
  factory Product.fromSupabase(Map<String, dynamic> row) {
    final mapped = <String, dynamic>{
      'id': (row['id'] ?? '').toString(),
      'name': (row['name'] ?? '').toString(),
      'slug': row['slug'],
      'description': row['description'],
      'price': _toDouble(row['price']),
      'compareAtPrice': _toDouble(row['compare_at_price'] ?? row['compareAtPrice']),
      'sku': row['sku'],
      'quantity': _toInt(row['quantity'] ?? row['stock'] ?? 0),
      'trackQuantity': row['track_quantity'] ?? row['trackQuantity'] ?? true,
      'categoryId': (row['category_id'] ?? row['categoryId'])?.toString(),
      'categoryName': (row['category_name'] ?? row['categoryName'] ?? (row['categories'] is Map ? row['categories']['name'] : null))?.toString(),
      'brand': row['brand'],
      'mainImage': (row['main_image'] ?? row['mainImage'] ?? row['image_url'] ?? row['imageUrl'])?.toString(),
      'images': _toStringList(row['images']),
      'specifications': row['specifications'] is Map ? Map<String, dynamic>.from(row['specifications']) : const <String, dynamic>{},
      'tags': _toStringList(row['tags']),
      'rating': _toDouble(row['rating'] ?? 0),
      'reviewsCount': _toInt(row['reviews_count'] ?? row['reviewsCount'] ?? 0),
      'isFeatured': row['is_featured'] ?? row['isFeatured'] ?? false,
      'isActive': row['is_active'] ?? row['isActive'] ?? true,
      'createdAt': row['created_at']?.toString() ?? row['createdAt']?.toString(),
      'updatedAt': row['updated_at']?.toString() ?? row['updatedAt']?.toString(),
    };
    return Product.fromJson(mapped);
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is double) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  static List<String> _toStringList(dynamic v) {
    if (v == null) return [];
    if (v is List) return v.map((e) => e.toString()).toList();
    return [];
  }
}
