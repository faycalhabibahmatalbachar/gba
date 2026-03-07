import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'driver_chat_screen.dart';
import 'driver_map_screen.dart';

class DriverOrderDetailScreen extends StatefulWidget {
  final Map<String, dynamic> order;
  const DriverOrderDetailScreen({super.key, required this.order});

  @override
  State<DriverOrderDetailScreen> createState() =>
      _DriverOrderDetailScreenState();
}

class _DriverOrderDetailScreenState extends State<DriverOrderDetailScreen>
    with SingleTickerProviderStateMixin {
  final _supabase = Supabase.instance.client;
  late Map<String, dynamic> _order;
  late AnimationController _slideController;
  late Animation<Offset> _slideAnim;

  // Client profile
  Map<String, dynamic>? _clientProfile;
  bool _loadingProfile = true;

  // Special order
  Map<String, dynamic>? _specialOrder;
  bool _isSpecialOrder = false;

  // Client live location
  LatLng? _clientPos;
  StreamSubscription? _clientLocSub;
  DateTime? _clientLocUpdatedAt;

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);
  static const _green = Color(0xFF00C851);
  static const _orange = Color(0xFFFF6B35);

  final _steps = ['pending', 'confirmed', 'shipped', 'delivered'];

  @override
  void initState() {
    super.initState();
    _order = Map<String, dynamic>.from(widget.order);
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.15),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));
    _slideController.forward();
    _loadClientProfile();
    _subscribeClientLocation();
    _checkSpecialOrder();
  }

  @override
  void dispose() {
    _slideController.dispose();
    _clientLocSub?.cancel();
    super.dispose();
  }

  // ── Load client profile ───────────────────────────────────────────────────

  Future<void> _loadClientProfile() async {
    final userId = _order['user_id']?.toString();
    if (userId == null) { setState(() => _loadingProfile = false); return; }
    try {
      final data = await _supabase
          .from('profiles')
          .select('first_name, last_name, phone, avatar_url, email')
          .eq('id', userId)
          .maybeSingle();
      if (mounted) setState(() { _clientProfile = data; _loadingProfile = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingProfile = false);
    }
  }

  // ── Subscribe to client real-time GPS ─────────────────────────────────────

  void _subscribeClientLocation() {
    final userId = _order['user_id']?.toString();
    if (userId == null) return;
    _clientLocSub = _supabase
        .from('user_locations')
        .stream(primaryKey: ['user_id'])
        .eq('user_id', userId)
        .listen((rows) {
      if (!mounted) return;
      if (rows.isNotEmpty) {
        final r = rows.first;
        final lat = (r['lat'] as num?)?.toDouble();
        final lng = (r['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) {
          setState(() {
            _clientPos = LatLng(lat, lng);
            _clientLocUpdatedAt = DateTime.tryParse(r['captured_at']?.toString() ?? '');
          });
        }
      }
    });
  }

  // ── Special order check ─────────────────────────────────────────────────

  Future<void> _checkSpecialOrder() async {
    final isSpecial = _order['is_special'] == true || _order['order_type'] == 'special';
    final specialOrderId = _order['special_order_id']?.toString();
    if (!isSpecial && specialOrderId == null) return;
    setState(() => _isSpecialOrder = true);
    if (specialOrderId != null) {
      try {
        final data = await _supabase
            .from('special_orders')
            .select('*')
            .eq('id', specialOrderId)
            .maybeSingle();
        if (data != null && mounted) setState(() => _specialOrder = data);
      } catch (_) {}
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String get _clientName {
    final p = _clientProfile;
    if (p == null) return 'Client';
    final first = (p['first_name'] ?? '').toString().trim();
    final last = (p['last_name'] ?? '').toString().trim();
    final full = '$first $last'.trim();
    return full.isNotEmpty ? full : (p['email']?.toString() ?? 'Client');
  }

  String? get _clientPhone {
    final ph = _clientProfile?['phone']?.toString().trim();
    return (ph != null && ph.isNotEmpty) ? ph : null;
  }

  String? get _clientAvatar => _clientProfile?['avatar_url']?.toString();

  Future<void> _callClient() async {
    final phone = _clientPhone;
    if (phone == null) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  void _showFullScreenImage(BuildContext ctx, String imageUrl, String title) {
    Navigator.of(ctx).push(
      MaterialPageRoute(
        builder: (_) => _FullScreenImagePage(
          imageUrl: imageUrl,
          title: title,
        ),
      ),
    );
  }

  int _currentStepIndex() {
    final idx = _steps.indexOf(_order['status'] ?? 'pending');
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final status = _order['status'] ?? 'pending';
    final orderId = (_order['id'] ?? '').toString();
    final shortId = orderId.length > 8
        ? '#${orderId.substring(0, 8).toUpperCase()}'
        : '#$orderId';

    final address = _order['shipping_address'];
    final total = ((_order['total_amount'] as num?)?.toDouble() ?? 0);
    final items = List<Map<String, dynamic>>.from(
        (_order['order_items'] ?? []) as List);

    final (statusColor, statusLabel, statusIcon) = _statusInfo(status);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SlideTransition(
        position: _slideAnim,
        child: CustomScrollView(
          slivers: [
            // ── Gradient Header ─────────────────────────────────
            SliverAppBar(
              expandedHeight: 140,
              pinned: true,
              backgroundColor: _purple,
              foregroundColor: Colors.white,
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
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Commande $shortId',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                  color: statusColor.withValues(alpha: 0.4)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(statusIcon,
                                    color: Colors.white, size: 14),
                                const SizedBox(width: 6),
                                Text(
                                  statusLabel,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).padding.bottom + 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Status timeline (read-only) ────────────
                    _buildTimeline(),
                    const SizedBox(height: 20),

                    // ── Client card ───────────────────────────
                    const _SectionTitle(
                        icon: Icons.person_pin_rounded,
                        label: 'Fiche client'),
                    _buildClientCard(),
                    const SizedBox(height: 12),

                    // ── 3 Quick actions ───────────────────────
                    _buildQuickActions(address),
                    const SizedBox(height: 20),

                    // ── Live client location mini-map ─────────
                    const _SectionTitle(
                        icon: Icons.my_location_rounded,
                        label: 'Position du client en temps réel'),
                    _buildClientMiniMap(address),
                    const SizedBox(height: 20),

                    // ── Delivery address text ──────────────────
                    const _SectionTitle(
                        icon: Icons.location_on_outlined,
                        label: 'Adresse de livraison'),
                    _InfoCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF6B6B).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(Icons.home_outlined,
                                  color: Color(0xFFFF6B6B), size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _formatAddress(address),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  color: Color(0xFF2D3436),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ── Special order info ────────────────────
                    if (_isSpecialOrder) ...[                      
                      const _SectionTitle(
                          icon: Icons.star_rounded,
                          label: 'Commande spéciale'),
                      _InfoCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(colors: [_orange, Color(0xFFFF8F00)]),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                                    Icon(Icons.star_rounded, color: Colors.white, size: 14),
                                    SizedBox(width: 4),
                                    Text('Spéciale', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                                  ]),
                                ),
                              ]),
                              if (_specialOrder != null) ...[
                                const SizedBox(height: 12),
                                if (_specialOrder!['description'] != null)
                                  Text(
                                    _specialOrder!['description'].toString(),
                                    style: TextStyle(fontSize: 13, color: Colors.grey.shade700, height: 1.5),
                                  ),
                                if (_specialOrder!['notes'] != null) ...[
                                  const SizedBox(height: 8),
                                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Icon(Icons.note_outlined, size: 14, color: Colors.grey.shade500),
                                    const SizedBox(width: 6),
                                    Expanded(child: Text(
                                      _specialOrder!['notes'].toString(),
                                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
                                    )),
                                  ]),
                                ],
                                if (_specialOrder!['status'] != null) ...[
                                  const SizedBox(height: 8),
                                  Row(children: [
                                    Text('Statut: ', style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                                    Text(_specialOrder!['status'].toString(), style: const TextStyle(fontSize: 12, color: _purple, fontWeight: FontWeight.w700)),
                                  ]),
                                ],
                              ] else
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text('Commande avec demande spéciale du client', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // ── Order items ───────────────────────────
                    _SectionTitle(
                        icon: Icons.shopping_bag_outlined,
                        label: 'Articles (${items.length})'),
                    _InfoCard(
                      child: Column(
                        children: [
                          ...items.asMap().entries.map((e) {
                            final i = e.value;
                            final isLast = e.key == items.length - 1;
                            final imgUrl = (i['product_image'] ?? i['image_url'] ?? '').toString();
                            final qty = (i['quantity'] as num?)?.toInt() ?? 1;
                            final unitPrice = (i['unit_price'] as num?)?.toDouble() ?? (i['price'] as num?)?.toDouble() ?? 0;
                            final lineTotal = (i['total_price'] as num?)?.toDouble() ?? (unitPrice * qty);
                            return Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Row(
                                    children: [
                                      // Product image or quantity badge
                                      GestureDetector(
                                        onTap: imgUrl.isNotEmpty && imgUrl.startsWith('http')
                                            ? () => _showFullScreenImage(context, imgUrl, i['product_name'] ?? i['name'] ?? 'Article')
                                            : null,
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(12),
                                          child: imgUrl.isNotEmpty && imgUrl.startsWith('http')
                                              ? CachedNetworkImage(
                                                  imageUrl: imgUrl,
                                                  width: 48,
                                                  height: 48,
                                                  fit: BoxFit.cover,
                                                  errorWidget: (_, __, ___) => Container(
                                                    width: 48, height: 48,
                                                    decoration: BoxDecoration(
                                                      color: _purple.withValues(alpha: 0.1),
                                                      borderRadius: BorderRadius.circular(12),
                                                    ),
                                                    child: Center(child: Text('×$qty', style: const TextStyle(fontWeight: FontWeight.w800, color: _purple))),
                                                  ),
                                                )
                                              : Container(
                                                  width: 48, height: 48,
                                                  decoration: BoxDecoration(
                                                    color: _purple.withValues(alpha: 0.1),
                                                    borderRadius: BorderRadius.circular(12),
                                                  ),
                                                  child: Center(child: Text('×$qty', style: const TextStyle(fontWeight: FontWeight.w800, color: _purple))),
                                                ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              i['product_name'] ?? i['name'] ?? 'Article',
                                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                              maxLines: 2, overflow: TextOverflow.ellipsis,
                                            ),
                                            const SizedBox(height: 3),
                                            Text(
                                              '${unitPrice.toStringAsFixed(0)} FCFA × $qty',
                                              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        '${lineTotal.toStringAsFixed(0)} FCFA',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: _purple,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (!isLast)
                                  Divider(
                                      height: 1,
                                      color: Colors.grey.shade100),
                              ],
                            );
                          }),
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  _purple.withValues(alpha: 0.06),
                                  _violet.withValues(alpha: 0.06),
                                ],
                              ),
                              borderRadius: const BorderRadius.only(
                                bottomLeft: Radius.circular(20),
                                bottomRight: Radius.circular(20),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Total',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                    color: Color(0xFF2D3436),
                                  ),
                                ),
                                Text(
                                  '${total.toStringAsFixed(0)} FCFA',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                    color: _purple,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),

    );
  }

  // ── Client card ───────────────────────────────────────────────────────────

  Widget _buildClientCard() {
    final avatar = _clientAvatar;
    final phone = _clientPhone;
    final hasLivePos = _clientPos != null;
    final locAt = _clientLocUpdatedAt;

    return _InfoCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 56, height: 56,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(colors: [_purple, _violet]),
              ),
              child: ClipOval(
                child: avatar != null && avatar.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: avatar, fit: BoxFit.cover,
                        errorWidget: (_, __, ___) =>
                            const Icon(Icons.person_rounded, color: Colors.white, size: 28),
                      )
                    : const Icon(Icons.person_rounded, color: Colors.white, size: 28),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _loadingProfile
                      ? Container(
                          width: 120, height: 14,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(7),
                          ),
                        )
                      : Text(_clientName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: Color(0xFF2D3436),
                          )),
                  if (phone != null) ...[
                    const SizedBox(height: 4),
                    Row(children: [
                      Icon(Icons.phone_outlined, size: 13, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(phone, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    ]),
                  ],
                  const SizedBox(height: 5),
                  Row(children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 400),
                      width: 8, height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: hasLivePos ? _green : Colors.grey.shade300,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      hasLivePos
                          ? (locAt != null ? 'En direct · ${_fmtAgo(locAt)}' : 'GPS en direct')
                          : 'En attente de position…',
                      style: TextStyle(
                        fontSize: 11,
                        color: hasLivePos ? _green : Colors.grey.shade400,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Quick action buttons ──────────────────────────────────────────────────

  Widget _buildQuickActions(dynamic _) {
    return Row(children: [
      Expanded(child: _QuickActionBtn(
        icon: Icons.phone_rounded,
        label: 'Appeler',
        color: _green,
        onTap: _clientPhone != null
            ? () { HapticFeedback.mediumImpact(); _callClient(); }
            : null,
      )),
      const SizedBox(width: 10),
      Expanded(child: _QuickActionBtn(
        icon: Icons.chat_bubble_rounded,
        label: 'Chat',
        color: _purple,
        onTap: _order['user_id'] != null
            ? () {
                HapticFeedback.lightImpact();
                Navigator.push(context, MaterialPageRoute(
                  builder: (_) => DriverChatScreen(
                    customerId: _order['user_id'].toString(),
                    customerName: _clientName,
                    orderId: _order['id']?.toString(),
                  ),
                ));
              }
            : null,
      )),
      const SizedBox(width: 10),
      Expanded(child: _QuickActionBtn(
        icon: Icons.navigation_rounded,
        label: 'Naviguer',
        color: _orange,
        onTap: () {
          HapticFeedback.mediumImpact();
          Navigator.push(context, MaterialPageRoute(
            builder: (_) => DriverMapScreen(order: _order),
          ));
        },
      )),
    ]);
  }

  // ── Client mini-map (real-time) ───────────────────────────────────────────

  Widget _buildClientMiniMap(dynamic address) {
    // Fallback to order-level delivery coordinates
    LatLng? fallback;
    final dlat = double.tryParse(_order['delivery_lat']?.toString() ?? '');
    final dlng = double.tryParse(_order['delivery_lng']?.toString() ?? '');
    if (dlat != null && dlng != null) {
      fallback = LatLng(dlat, dlng);
    } else if (address is Map) {
      final lat = double.tryParse(address['latitude']?.toString() ?? '');
      final lng = double.tryParse(address['longitude']?.toString() ?? '');
      if (lat != null && lng != null) fallback = LatLng(lat, lng);
    }
    final center = _clientPos ?? fallback;

    if (center == null) {
      return Container(
        height: 150,
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.location_searching_rounded,
                color: Colors.grey.shade400, size: 32),
            const SizedBox(height: 8),
            Text('En attente de la position client…',
                style: TextStyle(
                    color: Colors.grey.shade500,
                    fontSize: 12,
                    fontWeight: FontWeight.w600)),
          ]),
        ),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        height: 190,
        child: Stack(children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: center,
              initialZoom: 15,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.none,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.gba.app',
              ),
              MarkerLayer(markers: [
                Marker(
                  point: center,
                  width: 48, height: 48,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      boxShadow: [
                        BoxShadow(
                            color: _purple.withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 3)),
                      ],
                    ),
                    child: const Icon(Icons.person_pin_circle_rounded,
                        color: _purple, size: 30),
                  ),
                ),
              ]),
            ],
          ),
          // Live badge overlay
          if (_clientPos != null)
            Positioned(
              top: 10, right: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: _green,
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [BoxShadow(color: _green.withValues(alpha: 0.4), blurRadius: 6)],
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.circle, color: Colors.white, size: 6),
                  SizedBox(width: 4),
                  Text('En direct',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800)),
                ]),
              ),
            ),
        ]),
      ),
    );
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  String _fmtAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return '${diff.inSeconds}s';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min';
    return '${diff.inHours}h';
  }

  Widget _buildTimeline() {
    final currentIdx = _currentStepIndex();
    const labels = ['En attente', 'Confirmée', 'En livraison', 'Livrée'];
    const icons = [
      Icons.hourglass_empty,
      Icons.thumb_up_outlined,
      Icons.delivery_dining,
      Icons.check_circle_outline,
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: List.generate(_steps.length * 2 - 1, (i) {
          if (i.isOdd) {
            // Connector
            final stepDone = (i ~/ 2) < currentIdx;
            return Expanded(
              child: Container(
                height: 3,
                color: stepDone ? _purple : Colors.grey.shade200,
              ),
            );
          }
          final stepIdx = i ~/ 2;
          final isDone = stepIdx < currentIdx;
          final isCurrent = stepIdx == currentIdx;
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 400),
                width: isCurrent ? 40 : 32,
                height: isCurrent ? 40 : 32,
                decoration: BoxDecoration(
                  gradient: isDone || isCurrent
                      ? const LinearGradient(colors: [_purple, _violet])
                      : null,
                  color: isDone || isCurrent ? null : Colors.grey.shade200,
                  shape: BoxShape.circle,
                  boxShadow: isCurrent
                      ? [
                          BoxShadow(
                            color: _purple.withValues(alpha: 0.4),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          )
                        ]
                      : null,
                ),
                child: Icon(
                  icons[stepIdx],
                  color: isDone || isCurrent
                      ? Colors.white
                      : Colors.grey.shade400,
                  size: isCurrent ? 20 : 15,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                labels[stepIdx],
                style: TextStyle(
                  fontSize: 9,
                  fontWeight:
                      isCurrent ? FontWeight.w800 : FontWeight.w500,
                  color: isCurrent ? _purple : Colors.grey.shade500,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }

  String _formatAddress(dynamic addr) {
    if (addr == null) return 'Adresse non précisée';
    if (addr is String && addr.isNotEmpty) return addr;
    if (addr is Map) {
      final parts = <String>[];
      // Try every possible key the client app might store
      for (final key in ['street', 'address', 'district', 'wilaya', 'city', 'postal_code', 'state']) {
        final v = addr[key];
        if (v != null && v.toString().isNotEmpty) parts.add(v.toString());
      }
      if (parts.isNotEmpty) return parts.join(', ');
      // Fallback: use any non-null string value
      final anyVal = addr.values.whereType<String>().where((s) => s.isNotEmpty).firstOrNull;
      if (anyVal != null) return anyVal;
    }
    return 'Adresse non précisée';
  }

  (Color, String, IconData) _statusInfo(String status) {
    switch (status) {
      case 'pending':
        return (Colors.orange, 'En attente', Icons.hourglass_empty);
      case 'confirmed':
        return (Colors.blue, 'Confirmée', Icons.thumb_up_outlined);
      case 'shipped':
        return (_purple, 'En livraison', Icons.delivery_dining);
      case 'delivered':
        return (_green, 'Livrée ✓', Icons.check_circle_outline);
      case 'cancelled':
        return (Colors.red, 'Annulée', Icons.cancel_outlined);
      default:
        return (Colors.grey, status, Icons.info_outline);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  final IconData icon;
  final String label;
  const _SectionTitle({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF667eea)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF2D3436),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final Widget child;
  const _InfoCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _QuickActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  const _QuickActionBtn({
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final active = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: active ? 1.0 : 0.4,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 5),
            Text(label,
                style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ]),
        ),
      ),
    );
  }
}

/// Fullscreen image viewer with zoom and download for driver order images.
class _FullScreenImagePage extends StatelessWidget {
  final String imageUrl;
  final String title;
  const _FullScreenImagePage({required this.imageUrl, required this.title});

  static const _purple = Color(0xFF667eea);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(title, style: const TextStyle(fontSize: 14)),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded),
            tooltip: 'Télécharger',
            onPressed: () async {
              final uri = Uri.tryParse(imageUrl);
              if (uri != null) {
                try {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Impossible d\'ouvrir: $e'), backgroundColor: Colors.red),
                    );
                  }
                }
              }
            },
          ),
        ],
      ),
      body: Center(
        child: InteractiveViewer(
          minScale: 0.5,
          maxScale: 4.0,
          child: CachedNetworkImage(
            imageUrl: imageUrl,
            fit: BoxFit.contain,
            placeholder: (_, __) => const Center(
              child: CircularProgressIndicator(color: _purple),
            ),
            errorWidget: (_, __, ___) => const Center(
              child: Icon(Icons.broken_image, color: Colors.white54, size: 64),
            ),
          ),
        ),
      ),
    );
  }
}
