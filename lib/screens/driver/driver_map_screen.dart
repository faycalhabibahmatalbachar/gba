import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_mbtiles/flutter_map_mbtiles.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../services/driver_location_service.dart';

class DriverMapScreen extends StatefulWidget {
  final Map<String, dynamic> order;
  const DriverMapScreen({super.key, required this.order});

  @override
  State<DriverMapScreen> createState() => _DriverMapScreenState();
}

class _DriverMapScreenState extends State<DriverMapScreen>
    with TickerProviderStateMixin {
  final _supabase = Supabase.instance.client;
  final _mapController = MapController();

  MbTilesTileProvider? _mbTilesProvider;
  bool _mapReady = false;
  bool _useOnlineTiles = false;

  // Driver state
  LatLng? _driverPos;
  double _driverSpeedMs = 0;
  double _driverHeading = 0;
  StreamSubscription<Position>? _driverSub;

  // Client state
  LatLng? _clientPos;
  double _clientSpeed = 0;
  StreamSubscription? _clientSub;
  String _clientName = 'Client';

  // Live straight-line distance driver↔client
  double _directDistanceM = 0;

  // Route
  List<LatLng> _routePoints = [];
  double _routeDistanceKm = 0;
  int _routeEtaSeconds = 0;
  bool _loadingRoute = false;
  DateTime? _lastRouteTime;

  // UI
  bool _autoFollow = true;
  bool _isUpdatingStatus = false;
  String _currentStatus = 'confirmed';
  bool _arrivedAtClient = false;
  bool _isFullScreen = false;
  static const double _arrivalRadiusMeters = 80.0;

  // Animations
  late AnimationController _pulseCtrl;
  late AnimationController _arrowCtrl;

  static const _purple = Color(0xFF667eea);
  static const _violet = Color(0xFF764ba2);
  static const _green = Color(0xFF00C851);
  static const _orange = Color(0xFFFF6B35);
  static const _defaultCenter = LatLng(36.737232, 3.086472); // Algiers

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.order['status'] ?? 'confirmed';
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();
    _arrowCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..repeat(reverse: true);
    _initOfflineTiles();
    _startDriverTracking();
    _subscribeClientLocation();
    _loadClientName();
    // Auto-set shipped as soon as driver opens map
    _autoSetShipped();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _arrowCtrl.dispose();
    _driverSub?.cancel();
    _clientSub?.cancel();
    _mbTilesProvider?.dispose();
    super.dispose();
  }

  Future<void> _initOfflineTiles() async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      final mbtilesPath = '${dir.path}/map.mbtiles';
      final prov = MbTilesTileProvider.fromPath(path: mbtilesPath);
      if (!mounted) return;
      setState(() {
        _mbTilesProvider = prov;
        _mapReady = true;
        _useOnlineTiles = false;
      });
    } catch (e) {
      if (!mounted) return;
      debugPrint('[DriverMap] offline tiles unavailable, using online: $e');
      setState(() {
        _mbTilesProvider = null;
        _mapReady = true;
        _useOnlineTiles = true;
      });
    }
  }

  // ── Driver GPS ───────────────────────────────────────────────────────────────

  Future<void> _startDriverTracking() async {
    // Reuse already-tracking service stream if active
    if (DriverLocationService.instance.isTracking) {
      final last = DriverLocationService.instance.lastPosition;
      if (last != null) _onDriverPos(last);
      _driverSub = DriverLocationService.instance.positionStream.listen(_onDriverPos);
      return;
    }

    final perm = kIsWeb
        ? await Geolocator.requestPermission()
        : (await Permission.location.request()).isGranted
            ? LocationPermission.always
            : LocationPermission.denied;

    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;

    try {
      final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.bestForNavigation);
      _onDriverPos(pos);
    } catch (_) {}

    _driverSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 3,
      ),
    ).listen(_onDriverPos);
  }

  Future<void> _autoSetShipped() async {
    if (_currentStatus != 'pending' && _currentStatus != 'confirmed') return;
    await _updateStatus('shipped');
  }

  void _onDriverPos(Position pos) {
    if (!mounted) return;
    final newPos = LatLng(pos.latitude, pos.longitude);
    setState(() {
      _driverPos = newPos;
      _driverSpeedMs = pos.speed < 0 ? 0 : pos.speed;
      if (pos.heading >= 0) _driverHeading = pos.heading;
    });
    if (_autoFollow) {
      try { _mapController.move(newPos, _mapController.camera.zoom); } catch (_) {}
    }
    // Offline mode: no external routing
    _checkArrival(newPos);
    _updateDirectDistance();
  }

  void _checkArrival(LatLng driverPos) {
    if (_arrivedAtClient || _currentStatus == 'delivered') return;
    final client = _clientPos;
    if (client == null) return;
    const calc = Distance();
    final meters = calc.as(LengthUnit.Meter, driverPos, client);
    if (meters <= _arrivalRadiusMeters && !_arrivedAtClient) {
      setState(() => _arrivedAtClient = true);
      HapticFeedback.heavyImpact();
    } else if (meters > _arrivalRadiusMeters + 20 && _arrivedAtClient) {
      setState(() => _arrivedAtClient = false);
    }
  }

  // ── Client profile name ──────────────────────────────────────────────────────

  Future<void> _loadClientName() async {
    final userId = widget.order['user_id']?.toString();
    if (userId == null) return;
    try {
      final data = await _supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
      if (data != null && mounted) {
        final first = (data['first_name'] ?? '').toString().trim();
        final last = (data['last_name'] ?? '').toString().trim();
        final full = '$first $last'.trim();
        if (full.isNotEmpty) setState(() => _clientName = full);
      }
    } catch (_) {}
  }

  void _updateDirectDistance() {
    if (_driverPos == null || _clientPos == null) return;
    const calc = Distance();
    final m = calc.as(LengthUnit.Meter, _driverPos!, _clientPos!);
    if (mounted) setState(() => _directDistanceM = m);
  }

  // ── Client GPS ───────────────────────────────────────────────────────────────

  void _subscribeClientLocation() {
    final userId = widget.order['user_id']?.toString();
    if (userId == null) { _fallbackToShipping(); return; }

    _clientSub = _supabase
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
            _clientSpeed = (r['speed'] as num?)?.toDouble() ?? 0;
          });
          // Offline mode: no external routing
          _updateDirectDistance();
          return;
        }
      }
      _fallbackToShipping();
    }, onError: (_) => _fallbackToShipping());
  }

  void _fallbackToShipping() {
    // Try order-level delivery coordinates first
    final dlat = double.tryParse(widget.order['delivery_lat']?.toString() ?? '');
    final dlng = double.tryParse(widget.order['delivery_lng']?.toString() ?? '');
    if (dlat != null && dlng != null && mounted) {
      setState(() => _clientPos = LatLng(dlat, dlng));
      // Offline mode: no external routing
      _updateDirectDistance();
      return;
    }
    // Fallback: try parsing address as a map with lat/lng keys
    final addr = widget.order['shipping_address'];
    if (addr is Map<String, dynamic>) {
      final lat = double.tryParse(addr['latitude']?.toString() ?? '');
      final lng = double.tryParse(addr['longitude']?.toString() ?? '');
      if (lat != null && lng != null && mounted) {
        setState(() => _clientPos = LatLng(lat, lng));
        _updateDirectDistance();
      }
    }
  }

  // ── Status update ─────────────────────────────────────────────────────────

  Future<void> _updateStatus(String newStatus) async {
    HapticFeedback.mediumImpact();
    setState(() => _isUpdatingStatus = true);
    try {
      await _supabase
          .from('orders')
          .update({'status': newStatus, 'updated_at': DateTime.now().toIso8601String()})
          .eq('id', widget.order['id']);
      setState(() => _currentStatus = newStatus);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(newStatus == 'delivered' ? '✅ Commande livrée !' : '🚗 Livraison démarrée !'),
        backgroundColor: _green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final orderId = (widget.order['id'] ?? '').toString();
    final shortId = orderId.length > 8 ? '#${orderId.substring(0, 8).toUpperCase()}' : '#$orderId';
    final speedKmh = (_driverSpeedMs * 3.6).round();
    final center = _driverPos ?? _clientPos ?? _defaultCenter;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: Stack(children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: center,
              initialZoom: 15,
              minZoom: 3,
              maxZoom: 19,
              onTap: (_, __) => setState(() => _autoFollow = false),
            ),
            children: [
              if (_mapReady && _mbTilesProvider != null)
                TileLayer(
                  tileProvider: _mbTilesProvider,
                  maxZoom: 19,
                  minZoom: 3,
                )
              else if (_mapReady && _useOnlineTiles)
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.gba.ecommerce_client.driver',
                  maxZoom: 19,
                  minZoom: 3,
                )
              else
                const SizedBox.shrink(),
              // Route shadow
              if (_routePoints.isNotEmpty)
                PolylineLayer(polylines: [
                  Polyline(points: _routePoints, color: Colors.black.withValues(alpha: 0.18), strokeWidth: 9),
                  Polyline(points: _routePoints, color: Colors.white, strokeWidth: 7),
                  Polyline(points: _routePoints, color: _purple, strokeWidth: 5,
                    isDotted: false),
                ]),
              // Dashed straight-line driver↔client
              if (_driverPos != null && _clientPos != null)
                PolylineLayer(polylines: [
                  Polyline(
                    points: [_driverPos!, _clientPos!],
                    color: _orange.withValues(alpha: 0.55),
                    strokeWidth: 3,
                    isDotted: true,
                  ),
                ]),
              MarkerLayer(markers: [
                if (_clientPos != null)
                  Marker(
                    point: _clientPos!,
                    width: 52, height: 72,
                    child: _ClientMarker(speed: _clientSpeed, name: _clientName, pulse: _pulseCtrl),
                  ),
                if (_driverPos != null)
                  Marker(
                    point: _driverPos!,
                    width: 64, height: 64,
                    child: _DriverMarker(heading: _driverHeading, pulse: _pulseCtrl, speed: speedKmh),
                  ),
                // Distance label at midpoint
                if (_driverPos != null && _clientPos != null && _directDistanceM > 0)
                  Marker(
                    point: LatLng(
                      (_driverPos!.latitude + _clientPos!.latitude) / 2,
                      (_driverPos!.longitude + _clientPos!.longitude) / 2,
                    ),
                    width: 90, height: 32,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [BoxShadow(color: _orange.withValues(alpha: 0.4), blurRadius: 8)],
                        border: Border.all(color: _orange.withValues(alpha: 0.5)),
                      ),
                      child: Center(
                        child: Text(
                          _directDistanceM < 1000
                              ? '${_directDistanceM.round()} m'
                              : '${(_directDistanceM / 1000).toStringAsFixed(1)} km',
                          style: const TextStyle(
                            color: Color(0xFFFF6B35),
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                  ),
              ]),
            ],
          ),

          // ── Top bar ──────────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Row(children: [
                _GlassButton(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [_purple, _violet]),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [BoxShadow(color: _purple.withValues(alpha: 0.45), blurRadius: 12, offset: const Offset(0, 4))],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        AnimatedBuilder(
                          animation: _arrowCtrl,
                          builder: (_, __) => Transform.translate(
                            offset: Offset(_arrowCtrl.value * 3, 0),
                            child: const Icon(Icons.navigation_rounded, color: Colors.white, size: 16),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text('Navigation $shortId',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
                        if (_loadingRoute) ...[
                          const SizedBox(width: 8),
                          const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(color: Colors.white70, strokeWidth: 1.5)),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                _GlassButton(
                  onTap: () {
                    setState(() => _autoFollow = true);
                    if (_driverPos != null) {
                      try { _mapController.move(_driverPos!, _mapController.camera.zoom); } catch (_) {}
                    }
                  },
                  child: Icon(
                    _autoFollow ? Icons.my_location_rounded : Icons.location_searching_rounded,
                    color: _autoFollow ? _green : Colors.white, size: 22,
                  ),
                ),
                const SizedBox(width: 8),
                _GlassButton(
                  onTap: () => setState(() => _isFullScreen = !_isFullScreen),
                  child: Icon(
                    _isFullScreen ? Icons.fullscreen_exit_rounded : Icons.fullscreen_rounded,
                    color: Colors.white, size: 22,
                  ),
                ),
              ]),
            ),
          ),

          // ── Speed + ETA HUD (top-right) ───────────────────────────
          if (!_isFullScreen)
          Positioned(
            top: 100,
            right: 14,
            child: IgnorePointer(
              ignoring: true,
              child: Column(
                children: [
                  _HudCard(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$speedKmh',
                          style: TextStyle(
                            color: speedKmh > 80
                                ? _orange
                                : speedKmh > 50
                                    ? Colors.yellow
                                    : Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                            height: 1,
                          ),
                        ),
                        const Text(
                          'km/h',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_routeEtaSeconds > 0) ...[
                    const SizedBox(height: 8),
                    _HudCard(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _fmtEta(_routeEtaSeconds),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              height: 1,
                            ),
                          ),
                          const Text(
                            'ETA',
                            style: TextStyle(color: Colors.white70, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (_routeDistanceKm > 0) ...[
                    const SizedBox(height: 8),
                    _HudCard(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _fmtDist(_routeDistanceKm),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              height: 1,
                            ),
                          ),
                          const Text(
                            'route',
                            style: TextStyle(color: Colors.white70, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── Direct distance HUD (top-left) ─────────────────────────
          if (_directDistanceM > 0 && !_isFullScreen)
            Positioned(
              top: 100,
              left: 14,
              child: IgnorePointer(
                ignoring: true,
                child: _HudCard(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.straighten_rounded, color: Colors.white70, size: 16),
                  const SizedBox(height: 2),
                  Text(
                    _directDistanceM < 1000
                        ? '${_directDistanceM.round()}'
                        : (_directDistanceM / 1000).toStringAsFixed(1),
                    style: TextStyle(
                      color: _directDistanceM <= _arrivalRadiusMeters ? _green : Colors.white,
                      fontSize: 20, fontWeight: FontWeight.w900, height: 1,
                    ),
                  ),
                  Text(
                    _directDistanceM < 1000 ? 'm' : 'km',
                    style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'du client',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 8, fontWeight: FontWeight.w600),
                  ),
                ])),
              ),
            ),

          // ── Bottom order panel ────────────────────────────────────
          if (!_isFullScreen)
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: _buildBottomPanel(),
            ),
        ]),
      ),
    );
  }

  Widget _buildBottomPanel() {
    final addr = widget.order['shipping_address'];
    String addrText = '';
    if (addr is Map) {
      addrText = [addr['street'], addr['neighborhood'], addr['city']]
          .where((e) => e != null && e.toString().isNotEmpty)
          .join(', ');
    }
    final total = ((widget.order['total_amount'] as num?)?.toDouble() ?? 0).toStringAsFixed(0);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.13), blurRadius: 24, offset: const Offset(0, -4))],
      ),
      padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.of(context).padding.bottom + 16),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(4))),
        const SizedBox(height: 14),
        Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(gradient: const LinearGradient(colors: [_purple, _violet]), borderRadius: BorderRadius.circular(14)),
            child: const Icon(Icons.person_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_clientName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            if (addrText.isNotEmpty)
              Text(addrText, style: TextStyle(color: Colors.grey.shade600, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (_directDistanceM > 0)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(children: [
                  Icon(Icons.straighten_rounded, size: 12, color: _directDistanceM <= _arrivalRadiusMeters ? _green : _orange),
                  const SizedBox(width: 4),
                  Text(
                    _directDistanceM < 1000
                        ? '${_directDistanceM.round()} m'
                        : '${(_directDistanceM / 1000).toStringAsFixed(1)} km',
                    style: TextStyle(
                      color: _directDistanceM <= _arrivalRadiusMeters ? _green : _orange,
                      fontSize: 12, fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(' du livreur', style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                ]),
              ),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: _green.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
            child: Text('$total FCFA', style: const TextStyle(color: _green, fontWeight: FontWeight.w800, fontSize: 13)),
          ),
        ]),
        if (_routeDistanceKm > 0 && _routeEtaSeconds > 0) ...[
          const SizedBox(height: 10),
          Row(children: [
            _InfoChip(icon: Icons.route_rounded, label: _fmtDist(_routeDistanceKm), color: _purple),
            const SizedBox(width: 8),
            _InfoChip(icon: Icons.access_time_rounded, label: _fmtEta(_routeEtaSeconds), color: _orange),
            const SizedBox(width: 8),
            _InfoChip(icon: Icons.speed_rounded, label: '${(_driverSpeedMs * 3.6).round()} km/h', color: Colors.teal),
          ]),
        ],
        if (_currentStatus != 'delivered') ...[
          const SizedBox(height: 14),
          if (_arrivedAtClient)
            _ActionBtn(
              label: '✅  Confirmer la livraison',
              colors: [_green, Colors.green.shade600],
              loading: _isUpdatingStatus,
              onTap: () => _updateStatus('delivered'),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.location_searching_rounded, size: 16, color: Colors.grey.shade500),
                const SizedBox(width: 8),
                Text(
                  _currentStatus == 'shipped'
                      ? 'Approchez-vous du client pour confirmer'
                      : 'Navigation démarrée…',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ]),
            ),
        ],
        if (_currentStatus == 'delivered')
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(color: _green.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _green.withValues(alpha: 0.3))),
            child: const Center(child: Text('🎉 Livraison terminée', style: TextStyle(color: _green, fontWeight: FontWeight.w800))),
          ),
      ]),
    );
  }

  String _fmtEta(int s) {
    if (s < 60) return '< 1 min';
    final m = s ~/ 60;
    return m < 60 ? '$m min' : '${m ~/ 60}h ${m % 60}m';
  }

  String _fmtDist(double km) => km < 1 ? '${(km * 1000).round()} m' : '${km.toStringAsFixed(1)} km';
}

// ── Custom Widgets ────────────────────────────────────────────────────────────

class _DriverMarker extends StatefulWidget {
  final double heading;
  final AnimationController pulse;
  final int speed;
  const _DriverMarker({required this.heading, required this.pulse, required this.speed});

  @override
  State<_DriverMarker> createState() => _DriverMarkerState();
}

class _DriverMarkerState extends State<_DriverMarker>
    with SingleTickerProviderStateMixin {
  late AnimationController _moveCtrl;
  late Animation<double> _bounceAnim;

  @override
  void initState() {
    super.initState();
    _moveCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _bounceAnim = Tween<double>(begin: 0, end: -3).animate(
      CurvedAnimation(parent: _moveCtrl, curve: Curves.easeInOut),
    );
    _updateAnimation();
  }

  @override
  void didUpdateWidget(_DriverMarker old) {
    super.didUpdateWidget(old);
    if (old.speed != widget.speed) _updateAnimation();
  }

  void _updateAnimation() {
    if (widget.speed > 2) {
      _moveCtrl.repeat(reverse: true);
    } else {
      _moveCtrl.animateTo(0);
    }
  }

  @override
  void dispose() {
    _moveCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isMoving = widget.speed > 2;
    final markerColor = isMoving
        ? (widget.speed > 60 ? const Color(0xFFFF6B35) : const Color(0xFF667eea))
        : const Color(0xFF00C851);

    return AnimatedBuilder(
      animation: Listenable.merge([widget.pulse, _moveCtrl]),
      builder: (_, __) {
        final t = widget.pulse.value;
        final bounce = isMoving ? _bounceAnim.value : 0.0;
        return Transform.translate(
          offset: Offset(0, bounce),
          child: Stack(alignment: Alignment.center, children: [
          // Pulse ring (stationary only)
          if (!isMoving)
            Container(
              width: 64 * (1 + 0.2 * math.sin(t * math.pi)),
              height: 64 * (1 + 0.2 * math.sin(t * math.pi)),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: markerColor.withValues(alpha: 0.12 * (1 - t)),
              ),
            ),
          // Motion blur lines behind moto when moving
          if (isMoving)
            Transform.rotate(
              angle: widget.heading * math.pi / 180,
              child: CustomPaint(
                size: const Size(70, 70),
                painter: _MotionTrailPainter(speed: widget.speed, color: markerColor),
              ),
            ),
          // White backing circle
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: markerColor.withValues(alpha: 0.35),
                  blurRadius: isMoving ? 14 : 8,
                  spreadRadius: isMoving ? 2 : 0,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
          ),
          // Motorcycle icon rotated by heading
          Transform.rotate(
            angle: widget.heading * math.pi / 180,
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [markerColor, markerColor.withValues(alpha: 0.75)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isMoving ? Icons.two_wheeler : Icons.two_wheeler,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          // Speed badge
          if (isMoving && widget.speed > 5)
            Positioned(
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: markerColor,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [BoxShadow(color: markerColor.withValues(alpha: 0.4), blurRadius: 4)],
                ),
                child: Text(
                  '${widget.speed}',
                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                ),
              ),
            ),
        ]));
      },
    );
  }
}

class _MotionTrailPainter extends CustomPainter {
  final int speed;
  final Color color;
  const _MotionTrailPainter({required this.speed, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final intensity = speed.clamp(5, 120) / 120.0;
    const trailCount = 4;
    final maxLen = size.width * 0.4 * intensity;

    for (int i = 0; i < trailCount; i++) {
      final alpha = (0.3 * (1 - i / trailCount) * intensity);
      final paint = Paint()
        ..color = color.withValues(alpha: alpha)
        ..strokeWidth = (3.5 - i * 0.7)
        ..strokeCap = StrokeCap.round;
      // Draw lines pointing "behind" (down in local coords = opposite heading)
      final yOffset = (i * 7.0 + 6.0);
      canvas.drawLine(
        Offset(cx - (i * 1.5), cy + yOffset),
        Offset(cx - (i * 1.5), cy + yOffset + maxLen),
        paint,
      );
      canvas.drawLine(
        Offset(cx + (i * 1.5), cy + yOffset),
        Offset(cx + (i * 1.5), cy + yOffset + maxLen),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_MotionTrailPainter old) =>
      old.speed != speed || old.color != color;
}

class _ClientMarker extends StatelessWidget {
  final double speed;
  final String name;
  final AnimationController pulse;
  const _ClientMarker({required this.speed, required this.name, required this.pulse});

  @override
  Widget build(BuildContext context) {
    final isMoving = speed > 1.0;
    final color = isMoving ? const Color(0xFFFF6B35) : const Color(0xFF00C851);
    final icon = isMoving ? Icons.directions_walk_rounded : Icons.person_pin_circle_rounded;

    return AnimatedBuilder(
      animation: pulse,
      builder: (_, __) {
        final t = pulse.value;
        return Column(mainAxisSize: MainAxisSize.min, children: [
          // Name label
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
              boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 6)],
            ),
            child: Text(
              name.split(' ').first,
              style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w800),
              maxLines: 1, overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 2),
          Stack(alignment: Alignment.center, children: [
            // Blinking pulse ring
            Container(
              width: 44 + 16 * math.sin(t * math.pi),
              height: 44 + 16 * math.sin(t * math.pi),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: 0.15 * (1 - t)),
              ),
            ),
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: color, shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: color.withValues(alpha: 0.5), blurRadius: 10, offset: const Offset(0, 3))],
              ),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
          ]),
          CustomPaint(size: const Size(12, 8), painter: _TrianglePainter(color)),
        ]);
      },
    );
  }
}

class _TrianglePainter extends CustomPainter {
  final Color color;
  const _TrianglePainter(this.color);
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()..color = color;
    final path = ui.Path()
      ..moveTo(s.width / 2, s.height)
      ..lineTo(0, 0)
      ..lineTo(s.width, 0)
      ..close();
    c.drawPath(path, p);
  }
  @override
  bool shouldRepaint(_) => false;
}

class _GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _GlassButton({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46, height: 46,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 8, offset: const Offset(0, 2))],
        ),
        child: Center(child: child),
      ),
    );
  }
}

class _HudCard extends StatelessWidget {
  final Widget child;
  const _HudCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 64),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 3))],
      ),
      child: child,
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _InfoChip({required this.icon, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: color, size: 13),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final List<Color> colors;
  final bool loading;
  final VoidCallback onTap;
  const _ActionBtn({required this.label, required this.colors, required this.loading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          gradient: loading ? null : LinearGradient(colors: colors),
          color: loading ? Colors.grey.shade300 : null,
          borderRadius: BorderRadius.circular(16),
          boxShadow: loading ? [] : [BoxShadow(color: colors.first.withValues(alpha: 0.4), blurRadius: 14, offset: const Offset(0, 5))],
        ),
        child: Center(
          child: loading
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
              : Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
        ),
      ),
    );
  }
}
