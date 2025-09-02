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
}
