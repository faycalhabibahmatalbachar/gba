// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ProductImpl _$$ProductImplFromJson(Map<String, dynamic> json) =>
    _$ProductImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String?,
      description: json['description'] as String?,
      price: (json['price'] as num).toDouble(),
      compareAtPrice: (json['compare_at_price'] as num?)?.toDouble() ?? (json['compareAtPrice'] as num?)?.toDouble(),
      sku: json['sku'] as String?,
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      trackQuantity: json['track_quantity'] as bool? ?? json['trackQuantity'] as bool? ?? true,
      categoryId: json['category_id'] as String? ?? json['categoryId'] as String?,
      categoryName: json['category_name'] as String? ?? json['categoryName'] as String?,
      brand: json['brand'] as String?,
      mainImage: json['main_image'] as String? ?? json['mainImage'] as String?,
      images: (json['images'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      specifications:
          json['specifications'] as Map<String, dynamic>? ?? const {},
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
              const [],
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
      reviewsCount: (json['reviews_count'] as num?)?.toInt() ?? (json['reviewsCount'] as num?)?.toInt() ?? 0,
      isFeatured: json['is_featured'] as bool? ?? json['isFeatured'] as bool? ?? false,
      isActive: json['is_active'] as bool? ?? json['isActive'] as bool? ?? true,
      createdAt: json['created_at'] == null && json['createdAt'] == null
          ? null
          : DateTime.parse((json['created_at'] ?? json['createdAt']) as String),
      updatedAt: json['updated_at'] == null && json['updatedAt'] == null
          ? null
          : DateTime.parse((json['updated_at'] ?? json['updatedAt']) as String),
    );

Map<String, dynamic> _$$ProductImplToJson(_$ProductImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'description': instance.description,
      'price': instance.price,
      'compareAtPrice': instance.compareAtPrice,
      'sku': instance.sku,
      'quantity': instance.quantity,
      'trackQuantity': instance.trackQuantity,
      'categoryId': instance.categoryId,
      'categoryName': instance.categoryName,
      'brand': instance.brand,
      'mainImage': instance.mainImage,
      'images': instance.images,
      'specifications': instance.specifications,
      'tags': instance.tags,
      'rating': instance.rating,
      'reviewsCount': instance.reviewsCount,
      'isFeatured': instance.isFeatured,
      'isActive': instance.isActive,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
