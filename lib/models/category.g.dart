// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'category.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CategoryImpl _$$CategoryImplFromJson(Map<String, dynamic> json) =>
    _$CategoryImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      imageUrl: json['image_url'] as String? ?? json['imageUrl'] as String?,
      icon: json['icon'] as String?,
      parentId: json['parent_id'] as String? ?? json['parentId'] as String?,
      displayOrder: (json['display_order'] as num?)?.toInt() ?? (json['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: json['is_active'] as bool? ?? json['isActive'] as bool? ?? true,
      createdAt: json['created_at'] == null && json['createdAt'] == null
          ? null
          : DateTime.parse((json['created_at'] ?? json['createdAt']) as String),
      updatedAt: json['updated_at'] == null && json['updatedAt'] == null
          ? null
          : DateTime.parse((json['updated_at'] ?? json['updatedAt']) as String),
    );

Map<String, dynamic> _$$CategoryImplToJson(_$CategoryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'description': instance.description,
      'imageUrl': instance.imageUrl,
      'icon': instance.icon,
      'parentId': instance.parentId,
      'displayOrder': instance.displayOrder,
      'isActive': instance.isActive,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
