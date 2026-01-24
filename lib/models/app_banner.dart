class AppBanner {
  final String id;
  final String title;
  final String? subtitle;
  final String? imagePath;
  final String? imageUrl;
  final String? targetRoute;
  final int displayOrder;
  final bool isActive;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const AppBanner({
    required this.id,
    required this.title,
    this.subtitle,
    this.imagePath,
    this.imageUrl,
    this.targetRoute,
    this.displayOrder = 0,
    this.isActive = true,
    this.startsAt,
    this.endsAt,
    this.createdAt,
    this.updatedAt,
  });

  static DateTime? _parseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  factory AppBanner.fromMap(Map<String, dynamic> map) {
    return AppBanner(
      id: map['id'].toString(),
      title: (map['title'] ?? '').toString(),
      subtitle: map['subtitle']?.toString(),
      imagePath: map['image_path']?.toString(),
      imageUrl: map['image_url']?.toString(),
      targetRoute: map['target_route']?.toString(),
      displayOrder: (map['display_order'] is num)
          ? (map['display_order'] as num).toInt()
          : 0,
      isActive: (map['is_active'] is bool) ? (map['is_active'] as bool) : true,
      startsAt: _parseDate(map['starts_at']),
      endsAt: _parseDate(map['ends_at']),
      createdAt: _parseDate(map['created_at']),
      updatedAt: _parseDate(map['updated_at']),
    );
  }

  bool isCurrentlyActive(DateTime now) {
    if (!isActive) return false;
    if (startsAt != null && startsAt!.isAfter(now)) return false;
    if (endsAt != null && endsAt!.isBefore(now)) return false;
    return true;
  }
}
