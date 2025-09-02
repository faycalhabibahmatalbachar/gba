import 'package:freezed_annotation/freezed_annotation.dart';
import 'product.dart';

part 'cart_item.freezed.dart';
part 'cart_item.g.dart';

@freezed
class CartItem with _$CartItem {
  const factory CartItem({
    required String id,
    required String userId,
    required String productId,
    required int quantity,
    Product? product,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _CartItem;

  factory CartItem.fromJson(Map<String, dynamic> json) => _$CartItemFromJson(json);
}

@freezed
class CartSummary with _$CartSummary {
  const factory CartSummary({
    @Default([]) List<CartItem> items,
    @Default(0.0) double subtotal,
    @Default(0.0) double tax,
    @Default(0.0) double shipping,
    @Default(0.0) double total,
    @Default(0) int itemCount,
  }) = _CartSummary;

  factory CartSummary.fromJson(Map<String, dynamic> json) => _$CartSummaryFromJson(json);
}
