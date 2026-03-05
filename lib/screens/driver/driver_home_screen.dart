import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/driver_location_service.dart';
import '../../services/driver_notification_service.dart';
import 'driver_order_detail_screen.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen>
    with SingleTickerProviderStateMixin {
  final _supabase = Supabase.instance.client;
  StreamSubscription? _ordersSubscription;

  List<Map<String, dynamic>> _orders = [];
  bool _isLoading = true;
  bool _isAvailable = true;
  String _selectedTab = 'active'; // 'active' | 'done'
  late AnimationController _statusAnimController;

  // Stats
  int _todayDeliveries = 0;
  double _todayEarnings = 0;
  final double _rating = 4.8;

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);
  static const _green = Color(0xFF00C851);

  @override
  void initState() {
    super.initState();
    _statusAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _loadOrders();
    _subscribeToOrders();
    // Start GPS tracking
    DriverLocationService.instance.startTracking();
    // Notifications are now initialized in main_driver.dart (before runApp).
    // This call is kept as a safety net — initialize() is idempotent.
    DriverNotificationService.instance.initialize();
  }

  @override
  void dispose() {
    _ordersSubscription?.cancel();
    _statusAnimController.dispose();
    DriverLocationService.instance.dispose();
    DriverNotificationService.instance.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    try {
      final driver = _supabase.auth.currentUser;
      if (driver == null) {
        setState(() => _isLoading = false);
        return;
      }

      final response = await _supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('driver_id', driver.id)
          .order('created_at', ascending: false)
          .limit(50);

      final all = List<Map<String, dynamic>>.from(response);

      // Compute today stats
      final today = DateTime.now();
      final todayOrders = all.where((o) {
        final created = DateTime.tryParse(o['created_at'] ?? '');
        return created != null &&
            created.year == today.year &&
            created.month == today.month &&
            created.day == today.day &&
            o['status'] == 'delivered';
      }).toList();

      setState(() {
        _orders = all;
        _isLoading = false;
        _todayDeliveries = todayOrders.length;
        _todayEarnings = todayOrders.fold(
            0.0, (sum, o) => sum + ((o['total_amount'] as num?)?.toDouble() ?? 0));
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  void _subscribeToOrders() {
    final driver = _supabase.auth.currentUser;
    if (driver == null) return;
    _ordersSubscription = _supabase
        .from('orders')
        .stream(primaryKey: ['id'])
        .eq('driver_id', driver.id)
        .listen((_) {
      // Realtime stream doesn't include order_items joins,
      // so reload full data on any change.
      if (mounted) _loadOrders();
    });
  }

  List<Map<String, dynamic>> get _filteredOrders {
    if (_selectedTab == 'active') {
      return _orders.where((o) {
        final s = o['status'] ?? '';
        return s != 'delivered' && s != 'cancelled';
      }).toList();
    }
    return _orders.where((o) {
      final s = o['status'] ?? '';
      return s == 'delivered' || s == 'cancelled';
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = _supabase.auth.currentUser;
    final email = user?.email ?? '';
    final handle = email.contains('@') ? email.split('@').first : 'Livreur';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: RefreshIndicator(
        color: _purple,
        onRefresh: _loadOrders,
        child: CustomScrollView(
          slivers: [
            // ── Gradient AppBar Header ──────────────────────────
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              backgroundColor: _purple,
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [_purple, _violet],
                    ),
                  ),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              // Avatar
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.25),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.5),
                                      width: 2),
                                ),
                                child: const Icon(Icons.delivery_dining,
                                    color: Colors.white, size: 26),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _greeting(),
                                      style: TextStyle(
                                        color: Colors.white.withValues(alpha: 0.85),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    Text(
                                      handle,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              // Available toggle
                              GestureDetector(
                                onTap: () {
                                  HapticFeedback.mediumImpact();
                                  setState(() => _isAvailable = !_isAvailable);
                                  // Toggle GPS tracking
                                  if (_isAvailable) {
                                    DriverLocationService.instance.startTracking();
                                  } else {
                                    DriverLocationService.instance.stopTracking();
                                  }
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 7),
                                  decoration: BoxDecoration(
                                    color: _isAvailable
                                        ? _green
                                        : Colors.white.withValues(alpha: 0.2),
                                    borderRadius: BorderRadius.circular(30),
                                    border: Border.all(
                                        color: Colors.white.withValues(alpha: 0.4)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      AnimatedContainer(
                                        duration:
                                            const Duration(milliseconds: 300),
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: _isAvailable
                                              ? Colors.white
                                              : Colors.white.withValues(alpha: 0.5),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        _isAvailable
                                            ? 'Disponible'
                                            : 'Pause',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          // Stats row
                          Row(
                            children: [
                              _StatChip(
                                icon: Icons.check_circle_outline,
                                value: _todayDeliveries.toString(),
                                label: 'Livraisons',
                              ),
                              const SizedBox(width: 12),
                              _StatChip(
                                icon: Icons.payments_outlined,
                                value:
                                    '${_todayEarnings.toStringAsFixed(0)} FCFA',
                                label: 'Gains',
                              ),
                              const SizedBox(width: 12),
                              _StatChip(
                                icon: Icons.star_outline,
                                value: _rating.toStringAsFixed(1),
                                label: 'Note',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // ── Tab selector ────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      _TabButton(
                        label: 'En cours',
                        count: _orders
                            .where((o) =>
                                o['status'] != 'delivered' &&
                                o['status'] != 'cancelled')
                            .length,
                        isSelected: _selectedTab == 'active',
                        onTap: () =>
                            setState(() => _selectedTab = 'active'),
                      ),
                      _TabButton(
                        label: 'Terminées',
                        count: _orders
                            .where((o) =>
                                o['status'] == 'delivered' ||
                                o['status'] == 'cancelled')
                            .length,
                        isSelected: _selectedTab == 'done',
                        onTap: () => setState(() => _selectedTab = 'done'),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Orders list ─────────────────────────────────────
            if (_isLoading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: _purple),
                ),
              )
            else if (_filteredOrders.isEmpty)
              SliverFillRemaining(
                child: _EmptyState(tab: _selectedTab),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final order = _filteredOrders[index];
                      return _OrderCard(
                        order: order,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) =>
                                DriverOrderDetailScreen(order: order),
                          ),
                        ),
                        onStatusUpdate: _loadOrders,
                      );
                    },
                    childCount: _filteredOrders.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h >= 5 && h < 12) return 'Bonjour 👋';
    if (h >= 12 && h < 18) return 'Bon après-midi 👋';
    return 'Bonsoir 👋';
  }
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatChip({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.75),
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Tab button ───────────────────────────────────────────────────────────────

class _TabButton extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  const _TabButton({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF667eea) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey.shade600,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected
                      ? Colors.white.withValues(alpha: 0.3)
                      : Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: TextStyle(
                    color: isSelected ? Colors.white : Colors.grey.shade600,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Order card ───────────────────────────────────────────────────────────────

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onTap;
  final VoidCallback onStatusUpdate;

  const _OrderCard({
    required this.order,
    required this.onTap,
    required this.onStatusUpdate,
  });

  @override
  Widget build(BuildContext context) {
    final status = order['status'] ?? 'pending';
    final orderId = (order['id'] ?? '').toString();
    final shortId = orderId.length > 8 ? '#${orderId.substring(0, 8).toUpperCase()}' : '#$orderId';
    final total = (order['total_amount'] as num?)?.toDouble() ?? 0;
    final rawAddr = order['shipping_address'];
    final addrMap = rawAddr is Map<String, dynamic>
        ? rawAddr
        : rawAddr is String
            ? _tryParseJson(rawAddr)
            : null;
    final address = addrMap?['street'] ??
        addrMap?['address'] ??
        addrMap?['district'] ??
        addrMap?['city'] ??
        addrMap?['wilaya'] ??
        (addrMap != null && addrMap.isNotEmpty
            ? addrMap.values.whereType<String>().firstOrNull ?? 'Adresse non précisée'
            : 'Adresse non précisée');
    final createdAt = DateTime.tryParse(order['created_at'] ?? '');
    final timeStr = createdAt != null
        ? '${createdAt.hour.toString().padLeft(2, '0')}:${createdAt.minute.toString().padLeft(2, '0')}'
        : '';

    final (statusColor, statusLabel, statusIcon) = _statusInfo(status);

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            // ── Header ──
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(statusIcon, color: statusColor, size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              shortId,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: Color(0xFF2D3436),
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                statusLabel,
                                style: TextStyle(
                                  color: statusColor,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.location_on_outlined,
                                size: 13, color: Colors.grey.shade500),
                            const SizedBox(width: 3),
                            Expanded(
                              child: Text(
                                address.toString(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // ── Footer ──
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  Icon(Icons.access_time, size: 13, color: Colors.grey.shade500),
                  const SizedBox(width: 4),
                  Text(
                    timeStr,
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const Spacer(),
                  Text(
                    '${total.toStringAsFixed(0)} FCFA',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF667eea),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // GPS navigation shortcut icon
                  if (status != 'delivered' && status != 'cancelled')
                    Container(
                      padding: const EdgeInsets.all(5),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.navigation_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                    )
                  else
                    const Icon(Icons.arrow_forward_ios,
                        size: 12, color: Color(0xFF667eea)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Map<String, dynamic>? _tryParseJson(String s) {
    try {
      final decoded = Map<String, dynamic>.from(
          (const JsonDecoder().convert(s)) as Map);
      return decoded;
    } catch (_) {
      return null;
    }
  }

  (Color, String, IconData) _statusInfo(String status) {
    switch (status) {
      case 'pending':
        return (Colors.orange, 'En attente', Icons.hourglass_empty);
      case 'confirmed':
        return (Colors.blue, 'Confirmée', Icons.thumb_up_outlined);
      case 'shipping':
      case 'shipped':
        return (const Color(0xFF667eea), 'En livraison', Icons.delivery_dining);
      case 'delivered':
        return (const Color(0xFF00C851), 'Livrée ✓', Icons.check_circle_outline);
      case 'cancelled':
        return (Colors.red, 'Annulée', Icons.cancel_outlined);
      default:
        return (Colors.grey, status, Icons.info_outline);
    }
  }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final String tab;
  const _EmptyState({required this.tab});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color(0xFF667eea).withValues(alpha: 0.15),
                    const Color(0xFF764ba2).withValues(alpha: 0.15),
                  ],
                ),
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(
                tab == 'active'
                    ? Icons.delivery_dining_outlined
                    : Icons.history,
                size: 44,
                color: const Color(0xFF667eea),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              tab == 'active'
                  ? 'Aucune livraison en cours'
                  : 'Aucune livraison terminée',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              tab == 'active'
                  ? 'Les nouvelles commandes apparaîtront ici automatiquement.'
                  : 'Vos livraisons terminées apparaîtront ici.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }
}
