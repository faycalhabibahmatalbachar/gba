import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/order_service.dart';

/// State class for orders
class OrderState {
  final List<Map<String, dynamic>> orders;
  final bool isLoading;
  final String? error;

  const OrderState({
    this.orders = const [],
    this.isLoading = false,
    this.error,
  });

  OrderState copyWith({
    List<Map<String, dynamic>>? orders,
    bool? isLoading,
    String? error,
  }) {
    return OrderState(
      orders: orders ?? this.orders,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Robust ChangeNotifier provider that wraps [OrderService] to manage
/// order state including loading, error, real-time streaming, and caching.
class OrderProvider extends ChangeNotifier {
  final OrderService _orderService = OrderService();

  OrderState _state = const OrderState();
  StreamSubscription<List<Map<String, dynamic>>>? _streamSub;

  OrderState get state => _state;
  List<Map<String, dynamic>> get orders => _state.orders;
  bool get isLoading => _state.isLoading;
  String? get error => _state.error;

  OrderProvider() {
    _init();
  }

  Future<void> _init() async {
    // Show cached orders immediately while fetching fresh data
    await _loadCached();
    await refresh();
    _subscribeToStream();
  }

  Future<void> _loadCached() async {
    try {
      final cached = await _orderService.getCachedUserOrders();
      if (cached.isNotEmpty) {
        _state = _state.copyWith(orders: cached);
        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[OrderProvider] cache load error: $e');
    }
  }

  /// Refresh orders from the remote source
  Future<void> refresh() async {
    _state = _state.copyWith(isLoading: true, error: null);
    notifyListeners();

    try {
      final orders = await _orderService.getUserOrders();
      _state = OrderState(orders: orders, isLoading: false);
    } catch (e) {
      _state = _state.copyWith(isLoading: false, error: e.toString());
    }
    notifyListeners();
  }

  void _subscribeToStream() {
    _streamSub?.cancel();
    _streamSub = _orderService.ordersStream().listen((incoming) {
      // Merge: update status/updated_at for existing orders; fetch full if new
      final byId = <String, Map<String, dynamic>>{};
      for (final o in incoming) {
        final id = o['id'];
        if (id is String) byId[id] = o;
      }

      final incomingIds = byId.keys.toSet();
      final existingIds = _state.orders.map((o) => o['id'] as String?).whereType<String>().toSet();

      final merged = _state.orders.map((existing) {
        final id = existing['id'];
        if (id is! String) return existing;
        final updated = byId[id];
        if (updated == null) return existing;
        return {...existing, 'status': updated['status'], 'updated_at': updated['updated_at']};
      }).toList();

      _state = _state.copyWith(orders: merged);
      notifyListeners();

      // If order set changed (new or removed), fetch full data
      if (incomingIds.difference(existingIds).isNotEmpty ||
          existingIds.difference(incomingIds).isNotEmpty) {
        refresh();
      }
    }, onError: (e) {
      if (kDebugMode) debugPrint('[OrderProvider] stream error: $e');
    });
  }

  /// Add an order to the local list without a full refresh (optimistic update).
  void addOrder(Map<String, dynamic> order) {
    final updated = [order, ..._state.orders];
    _state = _state.copyWith(orders: updated);
    notifyListeners();
  }

  @override
  void dispose() {
    _streamSub?.cancel();
    super.dispose();
  }
}
