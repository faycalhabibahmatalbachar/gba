// Helper pour mapper les données de Supabase vers le modèle Product
class ProductMapper {
  static Map<String, dynamic> fromSupabase(Map<String, dynamic> data) {
    // Log pour debug
    print('📦 Mapping product from Supabase: ${data['name']}');
    print('   Original main_image: ${data['main_image']}');
    
    // Convertir snake_case vers camelCase
    final mapped = {
      'id': data['id'],
      'name': data['name'],
      'slug': data['slug'],
      'description': data['description'],
      'price': data['price'],
      'compareAtPrice': data['compare_at_price'],
      'sku': data['sku'],
      'quantity': data['quantity'] ?? 0,
      'trackQuantity': data['track_quantity'] ?? true,
      'categoryId': data['category_id'],
      'categoryName': data['category_name'],
      'brand': data['brand'],
      // IMPORTANT: mapper main_image vers mainImage
      'mainImage': data['main_image'],
      'images': data['images'] ?? [],
      'specifications': data['specifications'] ?? {},
      'tags': data['tags'] ?? [],
      'rating': data['rating'] ?? 0.0,
      'reviewsCount': data['reviews_count'] ?? 0,
      'isFeatured': data['is_featured'] ?? false,
      'isActive': data['is_active'] ?? true,
      'createdAt': data['created_at'],
      'updatedAt': data['updated_at'],
    };
    
    print('   Mapped mainImage: ${mapped['mainImage']}');
    return mapped;
  }
  
  static Map<String, dynamic> toSupabase(Map<String, dynamic> data) {
    // Convertir camelCase vers snake_case pour l'envoi vers Supabase
    return {
      'id': data['id'],
      'name': data['name'],
      'slug': data['slug'],
      'description': data['description'],
      'price': data['price'],
      'compare_at_price': data['compareAtPrice'],
      'sku': data['sku'],
      'quantity': data['quantity'],
      'track_quantity': data['trackQuantity'],
      'category_id': data['categoryId'],
      'category_name': data['categoryName'],
      'brand': data['brand'],
      'main_image': data['mainImage'],
      'images': data['images'],
      'specifications': data['specifications'],
      'tags': data['tags'],
      'rating': data['rating'],
      'reviews_count': data['reviewsCount'],
      'is_featured': data['isFeatured'],
      'is_active': data['isActive'],
      'created_at': data['createdAt'],
      'updated_at': data['updatedAt'],
    };
  }
}
