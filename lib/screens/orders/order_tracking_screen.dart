import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../localization/app_localizations.dart';
import '../../services/order_service.dart';
import '../../services/user_location_service.dart';

class OrderTrackingScreen extends StatefulWidget {
  final String orderId;

  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  State<OrderTrackingScreen> createState() => _OrderTrackingScreenState();
}

class _OrderTrackingScreenState extends State<OrderTrackingScreen> {
  final OrderService _orderService = OrderService();
  Map<String, dynamic>? _order;
  bool _isLoading = true;
  String? _error;
  StreamSubscription? _orderSubscription;

  // Status pipeline
  static const List<String> _statusPipeline = [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
  ];

  @override
  void initState() {
    super.initState();
    _checkLocationPermission();
    _loadOrder();
    _subscribeToStream();
  }

  /// Check location permission on screen entry.
  /// Shows a rationale dialog if denied before triggering the OS prompt.
  Future<void> _checkLocationPermission() async {
    final status = await Permission.location.status;
    if (status.isGranted) return;
    if (!mounted) return;
    if (status.isPermanentlyDenied) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text(
            'La localisation est désactivée. Activez-la dans les paramètres.',
          ),
          action: SnackBarAction(
            label: 'Paramètres',
            onPressed: openAppSettings,
          ),
          duration: const Duration(seconds: 6),
        ),
      );
      return;
    }
    // Rationale dialog before OS prompt
    final agreed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Localisation requise'),
        content: const Text(
          'Pour suivre votre commande en temps réel, '  
          'l\'application a besoin d\'accéder à votre position.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Ignorer'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Autoriser'),
          ),
        ],
      ),
    );
    if (agreed == true) await Permission.location.request();
  }

  @override
  void dispose() {
    _orderSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadOrder() async {
    try {
      final order = await _orderService.getOrderById(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _isLoading = false;
      });
      // Start GPS immediately if order is active
      final status = (order?['status'] ?? '').toString();
      final activeStatuses = {'pending', 'confirmed', 'processing', 'shipped'};
      if (activeStatuses.contains(status)) {
        UserLocationService.instance.startTracking();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _subscribeToStream() {
    _orderSubscription = _orderService.ordersStream().listen((orders) {
      if (!mounted) return;
      final updated = orders.where((o) => o['id'] == widget.orderId).firstOrNull;
      if (updated != null && mounted) {
        setState(() {
          _order = {...?_order, ...updated};
        });
        // Publish GPS from the moment order is active (driver needs our position)
        final status = updated['status']?.toString() ?? '';
        if (status == 'pending' ||
            status == 'confirmed' ||
            status == 'processing' ||
            status == 'shipped') {
          UserLocationService.instance.startTracking();
        } else if (status == 'delivered' || status == 'cancelled') {
          UserLocationService.instance.stopTracking();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App Bar ─────────────────────────────────────────
            SliverAppBar(
              pinned: true,
              floating: false,
              backgroundColor: Colors.transparent,
              elevation: 0,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                    ),
                  ),
                ),
              ),
              expandedHeight: 100,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => context.pop(),
              ),
              title: Text(
                localizations.translate('track_order'),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),

            if (_isLoading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: Color(0xFF667eea)),
                ),
              )
            else if (_error != null || _order == null)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 60, color: Colors.red.shade300),
                      const SizedBox(height: 16),
                      Text(
                        localizations.translate('error_loading'),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade500),
                        ),
                      ],
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _loadOrder,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF667eea),
                        ),
                        child: Text(localizations.translate('retry')),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildListDelegate([
                  _buildOrderSummary(theme, localizations),
                  _buildStatusTimeline(theme, localizations),
                  _buildOrderItems(theme, localizations),
                  _buildShippingInfo(theme, localizations),
                  const SizedBox(height: 40),
                ]),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderSummary(ThemeData theme, AppLocalizations localizations) {
    final order = _order!;
    final status = order['status']?.toString() ?? 'pending';
    final orderNumber = order['order_number']?.toString() ?? '—';
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0.0;
    final createdAt = order['created_at']?.toString();

    String dateStr = '—';
    if (createdAt != null) {
      try {
        dateStr = DateFormat('dd/MM/yyyy – HH:mm').format(DateTime.parse(createdAt));
      } catch (_) {}
    }

    final isCancelled = status == 'cancelled';

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF667eea).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.receipt_long_outlined, color: Colors.white70, size: 18),
              const SizedBox(width: 8),
              Text(
                localizations.translate('order_number_label'),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isCancelled
                      ? Colors.red.withOpacity(0.25)
                      : Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _statusLabel(status, localizations),
                  style: TextStyle(
                    color: isCancelled ? Colors.red.shade200 : Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            orderNumber,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 20,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.calendar_today_outlined, color: Colors.white70, size: 14),
              const SizedBox(width: 6),
              Text(dateStr, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              const Spacer(),
              Text(
                '${total.toStringAsFixed(0)} FCFA',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.2);
  }

  Widget _buildStatusTimeline(ThemeData theme, AppLocalizations localizations) {
    final status = _order!['status']?.toString() ?? 'pending';
    final isCancelled = status == 'cancelled';
    final currentIndex = _statusPipeline.indexOf(status);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.translate('order_tracking_title'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 20),
          if (isCancelled)
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(FontAwesomeIcons.xmark, color: Colors.red, size: 20),
                ),
                const SizedBox(width: 14),
                Text(
                  localizations.translate('order_cancelled'),
                  style: const TextStyle(
                    color: Colors.red,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ],
            )
          else
            Column(
              children: _statusPipeline.asMap().entries.map((entry) {
                final i = entry.key;
                final step = entry.value;
                final isDone = i <= currentIndex;
                final isCurrent = i == currentIndex;
                final isLast = i == _statusPipeline.length - 1;

                final Color stepColor = isDone ? const Color(0xFF667eea) : Colors.grey.shade300;

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isDone
                                ? const Color(0xFF667eea)
                                : Colors.grey.shade200,
                            shape: BoxShape.circle,
                            boxShadow: isCurrent
                                ? [
                                    BoxShadow(
                                      color: const Color(0xFF667eea).withOpacity(0.4),
                                      blurRadius: 12,
                                      spreadRadius: 2,
                                    )
                                  ]
                                : null,
                          ),
                          child: Icon(
                            _stepIcon(step),
                            color: isDone ? Colors.white : Colors.grey.shade400,
                            size: 20,
                          ),
                        ),
                        if (!isLast)
                          Container(
                            width: 2,
                            height: 30,
                            color: stepColor,
                          ),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          top: 10,
                          bottom: isLast ? 0 : 30,
                        ),
                        child: Text(
                          _stepLabel(step, localizations),
                          style: TextStyle(
                            fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
                            color: isDone
                                ? const Color(0xFF667eea)
                                : Colors.grey.shade500,
                            fontSize: isCurrent ? 15 : 14,
                          ),
                        ),
                      ),
                    ),
                    if (isCurrent) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF667eea).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          localizations.translate('current'),
                          style: const TextStyle(
                            color: Color(0xFF667eea),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                );
              }).toList(),
            ),
        ],
      ),
    ).animate(delay: 100.ms).fadeIn(duration: 400.ms).slideY(begin: 0.15);
  }

  Widget _buildOrderItems(ThemeData theme, AppLocalizations localizations) {
    final items = (_order!['items'] as List?) ?? [];
    if (items.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.translate('items'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 12),
          ...items.map((item) {
            final m = item is Map ? item : {};
            final name = m['product_name']?.toString() ?? '—';
            final qty = (m['quantity'] as num?)?.toInt() ?? 1;
            final unitPrice = (m['unit_price'] as num?)?.toDouble() ?? 0.0;
            final totalPrice = (m['total_price'] as num?)?.toDouble() ?? (qty * unitPrice);
            final image = m['product_image']?.toString();

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.grey.shade200,
                    ),
                    child: image != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              image,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  Icon(Icons.shopping_bag_outlined, color: Colors.grey.shade400),
                            ),
                          )
                        : Icon(Icons.shopping_bag_outlined, color: Colors.grey.shade400),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        const SizedBox(height: 2),
                        Text(
                          '$qty × ${unitPrice.toStringAsFixed(0)} FCFA',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    '${totalPrice.toStringAsFixed(0)} FCFA',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    ).animate(delay: 200.ms).fadeIn(duration: 400.ms).slideY(begin: 0.15);
  }

  Widget _buildShippingInfo(ThemeData theme, AppLocalizations localizations) {
    final order = _order!;
    final address = order['shipping_address']?.toString();
    final city = order['shipping_city']?.toString();
    final country = order['shipping_country']?.toString();
    final phone = order['customer_phone']?.toString();

    final parts = [address, city, country].where((e) => e != null && e.trim().isNotEmpty).join(', ');
    if (parts.isEmpty && phone == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.translate('shipping_address_title'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 12),
          if (parts.isNotEmpty)
            Row(
              children: [
                Icon(Icons.location_on_outlined, color: const Color(0xFF667eea), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(parts, style: const TextStyle(fontSize: 13, height: 1.4)),
                ),
              ],
            ),
          if (phone != null && phone.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.phone_outlined, color: const Color(0xFF667eea), size: 20),
                const SizedBox(width: 10),
                Text(phone, style: const TextStyle(fontSize: 13)),
              ],
            ),
          ],
        ],
      ),
    ).animate(delay: 300.ms).fadeIn(duration: 400.ms).slideY(begin: 0.15);
  }

  IconData _stepIcon(String step) {
    switch (step) {
      case 'pending': return FontAwesomeIcons.clock;
      case 'confirmed': return FontAwesomeIcons.checkDouble;
      case 'processing': return FontAwesomeIcons.gears;
      case 'shipped': return FontAwesomeIcons.truck;
      case 'delivered': return FontAwesomeIcons.houseChimneyUser;
      default: return Icons.circle_outlined;
    }
  }

  String _stepLabel(String step, AppLocalizations localizations) {
    switch (step) {
      case 'pending': return localizations.translate('order_status_pending');
      case 'confirmed': return localizations.translate('order_status_confirmed');
      case 'processing': return localizations.translate('order_status_processing');
      case 'shipped': return localizations.translate('order_status_shipped');
      case 'delivered': return localizations.translate('order_status_delivered');
      default: return step;
    }
  }

  String _statusLabel(String status, AppLocalizations localizations) {
    switch (status) {
      case 'pending': return localizations.translate('order_status_pending');
      case 'confirmed': return localizations.translate('order_status_confirmed');
      case 'processing': return localizations.translate('order_status_processing');
      case 'shipped': return localizations.translate('order_status_shipped');
      case 'delivered': return localizations.translate('order_status_delivered');
      case 'cancelled': return localizations.translate('order_status_cancelled');
      default: return status;
    }
  }
}
