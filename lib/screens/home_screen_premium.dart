import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart' as classic_provider;
import 'dart:ui';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:badges/badges.dart' as badges;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/product_provider.dart';
import '../providers/banner_provider.dart';
import '../providers/favorites_provider.dart';
import '../localization/app_localizations.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/banner_carousel.dart';
import '../widgets/product_card_premium.dart';
import '../services/activity_tracking_service.dart';
import '../services/messaging_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/notification_service.dart' as ns;
import '../services/recommendation_service.dart';
import '../utils/auth_guard.dart';

class HomeScreenPremium extends StatefulWidget {
  const HomeScreenPremium({super.key});

  @override
  State<HomeScreenPremium> createState() => _HomeScreenPremiumState();
}

class _HomeScreenPremiumState extends State<HomeScreenPremium> with TickerProviderStateMixin {
  static const bool _debugImageLogs = false;
  String? selectedCategoryId;
  int _currentIndex = 0;
  late AnimationController _fabAnimationController;
  late AnimationController _searchAnimationController;
  late AnimationController _messageButtonController;
  final ScrollController _scrollController = ScrollController();
  bool _showBackToTop = false;
  bool _bannerCollapsed = false;
  int _unreadMessages = 0;
  DateTime? _lastBackPressTime;
  MessagingService? _messagingService;

  final RecommendationService _recommendationService = RecommendationService();
  List<Product> _recommendedProducts = [];
  bool _isLoadingRecommendations = false;
  String? _recommendationsError;

  Future<void> _loadRecommendations({bool forceRefresh = false}) async {
    if (_isLoadingRecommendations) return;

    // 1. Cache-first: show cached data immediately
    if (!forceRefresh && _recommendedProducts.isEmpty) {
      final cached = await _recommendationService.getCachedRecommendations();
      if (cached != null && cached.isNotEmpty && mounted) {
        setState(() => _recommendedProducts = cached);
      }
    }

    setState(() {
      _isLoadingRecommendations = true;
      _recommendationsError = null;
    });

    // 2. Fetch fresh data in background
    try {
      final items = await _recommendationService.getRecommendations(limit: 10);
      if (!mounted) return;
      setState(() {
        _recommendedProducts = items;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (_recommendedProducts.isEmpty) _recommendationsError = e.toString();
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _isLoadingRecommendations = false;
      });
    }
  }

  IconData _categoryIcon(String name) {
    final n = name.toLowerCase();
    if (n.contains('électron') || n.contains('electron') || n.contains('tech')) return Icons.devices_rounded;
    if (n.contains('mode') || n.contains('vêt') || n.contains('habit') || n.contains('cloth')) return Icons.checkroom_rounded;
    if (n.contains('aliment') || n.contains('food') || n.contains('nourrit') || n.contains('épicerie')) return Icons.restaurant_rounded;
    if (n.contains('sport') || n.contains('fitness')) return Icons.sports_soccer_rounded;
    if (n.contains('maison') || n.contains('meuble') || n.contains('déco') || n.contains('home')) return Icons.chair_rounded;
    if (n.contains('beauté') || n.contains('cosmé') || n.contains('soin') || n.contains('beauty')) return Icons.spa_rounded;
    if (n.contains('auto') || n.contains('véhicule') || n.contains('moto') || n.contains('voiture')) return Icons.directions_car_rounded;
    if (n.contains('enfant') || n.contains('jouet') || n.contains('bébé') || n.contains('kid')) return Icons.toys_rounded;
    if (n.contains('livre') || n.contains('book') || n.contains('éducat')) return Icons.menu_book_rounded;
    if (n.contains('téléphone') || n.contains('phone') || n.contains('mobile') || n.contains('gsm')) return Icons.smartphone_rounded;
    if (n.contains('jardin') || n.contains('plante') || n.contains('garden')) return Icons.yard_rounded;
    if (n.contains('san') || n.contains('pharma') || n.contains('médic') || n.contains('health')) return Icons.health_and_safety_rounded;
    if (n.contains('jeu') || n.contains('game') || n.contains('gaming')) return Icons.videogame_asset_rounded;
    if (n.contains('musique') || n.contains('music') || n.contains('audio') || n.contains('son')) return Icons.headphones_rounded;
    if (n.contains('photo') || n.contains('camera') || n.contains('appareil')) return Icons.camera_alt_rounded;
    if (n.contains('bureau') || n.contains('papeter') || n.contains('office')) return Icons.business_center_rounded;
    if (n.contains('voyage') || n.contains('bagag') || n.contains('travel')) return Icons.luggage_rounded;
    if (n.contains('bijou') || n.contains('montre') || n.contains('accessoire')) return Icons.watch_rounded;
    return Icons.category_rounded;
  }

  Widget _promoBanner({
    required String title,
    required String subtitle,
    required List<Color> colors,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          onTap();
        },
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          width: 320,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: colors,
            ),
            boxShadow: [
              BoxShadow(
                color: colors.first.withOpacity(0.25),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.22),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.92),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
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
    );
  }

  String _timeGreeting(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return l10n.translate('greeting_morning');
    if (hour >= 12 && hour < 18) return l10n.translate('greeting_afternoon');
    return l10n.translate('greeting_evening');
  }

  String _userHandle() {
    final email = Supabase.instance.client.auth.currentUser?.email;
    if (email == null || email.trim().isEmpty) return '';
    final at = email.indexOf('@');
    if (at <= 0) return email;
    return email.substring(0, at);
  }

  Widget _quickActionChip({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white.withOpacity(0.18),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: Colors.white),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateFromDrawer(BuildContext context, String route) {
    Navigator.of(context).pop();
    context.go(route);
  }

  void _navigateFromDrawerProtected(BuildContext context, String route) {
    Navigator.of(context).pop();
    if (!requireAuth(context)) return;
    context.go(route);
  }

  void _showComingSoon(BuildContext context, String label, {bool closeDrawer = false}) {
    if (closeDrawer && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
    Future.microtask(() {
      if (!mounted) return;
      final localizations = AppLocalizations.of(this.context);
      ScaffoldMessenger.of(this.context).showSnackBar(
        SnackBar(
          content: Text(
            localizations.translateParams(
              'coming_soon',
              {'label': label},
            ),
          ),
          behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        ),
      );
    });
  }

  Widget _buildSideDrawer(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final brand = localizations.translate('brand_full_name');
    final parts = brand.split(' ');
    final line1 = parts.take(2).join(' ');
    final line2 = parts.skip(2).join(' ');

    return Drawer(
      child: Column(
        children: [
          // ── Brand header ────────────────────────────────────────────────
          GestureDetector(
            onTap: () => _navigateFromDrawerProtected(context, '/profile'),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Row(
                children: [
                  Image.asset(
                    'assets/images/GBA_sans_arriere.png',
                    width: 72,
                    height: 72,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          line1.isEmpty ? brand : line1,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.3,
                          ),
                        ),
                        Text(
                          line2,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54, size: 20),
                ],
              ),
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                ListTile(
                  leading: const Icon(Icons.home_outlined),
                  title: Text(localizations.translate('home')),
                  onTap: () => _navigateFromDrawer(context, '/home'),
                ),
                ListTile(
                  leading: const Icon(Icons.grid_view_outlined),
                  title: Text(localizations.translate('categories')),
                  onTap: () => _navigateFromDrawer(context, '/categories'),
                ),
                ListTile(
                  leading: const Icon(Icons.local_offer_outlined),
                  title: Text(localizations.translate('promotions')),
                  onTap: () => _navigateFromDrawer(context, '/promotions'),
                ),
                ListTile(
                  leading: const Icon(Icons.favorite_border),
                  title: Text(localizations.translate('favorites')),
                  onTap: () => _navigateFromDrawerProtected(context, '/favorites'),
                ),
                ListTile(
                  leading: const Icon(Icons.shopping_cart_outlined),
                  title: Text(localizations.translate('cart')),
                  onTap: () => _navigateFromDrawerProtected(context, '/cart'),
                ),
                ListTile(
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(localizations.translate('orders')),
                  onTap: () => _navigateFromDrawerProtected(context, '/orders'),
                ),
                ExpansionTile(
                  leading: const Icon(Icons.auto_awesome),
                  title: Text(localizations.translate('special_orders')),
                  children: [
                    ListTile(
                      title: Text(localizations.translate('new_special_order')),
                      onTap: () => _navigateFromDrawerProtected(context, '/special-order'),
                    ),
                    ListTile(
                      title: Text(localizations.translate('my_special_orders')),
                      onTap: () => _navigateFromDrawerProtected(context, '/special-orders'),
                    ),
                  ],
                ),
                ListTile(
                  leading: const Icon(Icons.message_outlined),
                  title: Text(localizations.translate('messages')),
                  trailing: _unreadMessages > 0
                      ? Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _unreadMessages > 99 ? '99+' : '$_unreadMessages',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        )
                      : null,
                  onTap: () {
                    _navigateFromDrawerProtected(context, '/chat');
                    // Refresh badge after 1 second delay
                    Future.delayed(const Duration(seconds: 1), () {
                      if (mounted && _messagingService != null) {
                        _messagingService!.loadConversations();
                      }
                    });
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.settings_outlined),
                  title: Text(localizations.translate('settings')),
                  onTap: () => _navigateFromDrawerProtected(context, '/settings'),
                ),
                ListTile(
                  leading: const Icon(Icons.contact_support_outlined),
                  title: Text(localizations.translate('contact_title')),
                  onTap: () => _navigateFromDrawer(context, '/contact'),
                ),
              ],
            ),
          ),
          FutureBuilder<PackageInfo>(
            future: PackageInfo.fromPlatform(),
            builder: (context, snap) {
              final version = snap.data?.version;
              final build = snap.data?.buildNumber;
              final text = (version == null || build == null) ? '' : 'v$version+$build';
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    text,
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
  
  @override
  void initState() {
    super.initState();
    _fabAnimationController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _searchAnimationController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _messageButtonController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    )..repeat(reverse: true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final isGuest = Supabase.instance.client.auth.currentSession == null;
      if (!isGuest) {
        _initMessagingListener();
        _maybeRequestNotificationPermission();
      }
      _loadRecommendations();
    });
    _scrollController.addListener(() {
      final offset = _scrollController.offset;
      // Back-to-top FAB
      if (offset > 200 && !_showBackToTop) {
        setState(() => _showBackToTop = true);
        _fabAnimationController.forward();
      } else if (offset <= 200 && _showBackToTop) {
        setState(() => _showBackToTop = false);
        _fabAnimationController.reverse();
      }
      // Banner collapse detection — threshold = expandedHeight - kToolbarHeight
      final expandedH = (MediaQuery.of(context).size.width * 6 / 16).clamp(140.0, 200.0);
      final collapsed = offset >= expandedH - kToolbarHeight;
      if (collapsed != _bannerCollapsed) {
        setState(() => _bannerCollapsed = collapsed);
      }
    });
  }
  
  Future<void> _maybeRequestNotificationPermission() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final asked = prefs.getBool('notif_permission_asked_v1') ?? false;
      if (asked || !mounted) return;
      await prefs.setBool('notif_permission_asked_v1', true);

      // Short delay so the home screen finishes rendering first
      await Future.delayed(const Duration(seconds: 2));
      if (!mounted) return;

      final loc = AppLocalizations.of(context);
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.notifications_active, color: Color(0xFF667eea)),
              const SizedBox(width: 8),
              Text(loc.translate('notifications'), style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(
            loc.translate('notification_permission_rationale'),
            style: const TextStyle(fontSize: 14),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(loc.translate('cancel')),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF667eea),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                Navigator.of(ctx).pop();
                ns.NotificationService().requestPermissionExplicit();
              },
              child: Text(loc.translate('authorize'), style: const TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    } catch (e) {
      debugPrint('[Notif] Permission dialog error: $e');
    }
  }

  void _onMessagingChanged() {
    if (!mounted) return;
    final count = _messagingService?.unreadCount ?? 0;
    if (count != _unreadMessages) {
      setState(() => _unreadMessages = count);
    }
  }

  void _initMessagingListener() {
    if (!mounted) return;
    try {
      _messagingService = classic_provider.Provider.of<MessagingService>(context, listen: false);
      _messagingService!.addListener(_onMessagingChanged);
      // Read initial value
      setState(() => _unreadMessages = _messagingService!.unreadCount);
    } catch (e) {
      debugPrint('Erreur init messaging listener: $e');
    }
  }
  
  @override
  void dispose() {
    _messagingService?.removeListener(_onMessagingChanged);
    _fabAnimationController.dispose();
    _searchAnimationController.dispose();
    _messageButtonController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final categoriesProvider = classic_provider.Provider.of<CategoriesProvider>(context);
    final productsProvider = classic_provider.Provider.of<ProductProvider>(context);
    final bannerProvider = classic_provider.Provider.of<BannerProvider>(context);
    final localizations = AppLocalizations.of(context);
    final activeBanner = bannerProvider.activeBanner;
    final bannerImageUrl = activeBanner?.imageUrl?.trim();
    final hasBannerImage = bannerImageUrl != null && bannerImageUrl.isNotEmpty;
    final bannerTitle = (activeBanner?.title ?? '').trim();
    final bannerSubtitle = (activeBanner?.subtitle ?? '').trim();
    final bannerTargetRoute = activeBanner?.targetRoute?.trim();
    final cartCount = classic_provider.Provider.of<CartProvider>(context).itemCount;
    
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // If scrolled down, scroll to top first
        if (_scrollController.hasClients && _scrollController.offset > 0) {
          _scrollController.animateTo(0, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
          return;
        }
        // Double-tap-to-exit
        final now = DateTime.now();
        if (_lastBackPressTime != null && now.difference(_lastBackPressTime!) < const Duration(seconds: 2)) {
          SystemNavigator.pop();
          return;
        }
        _lastBackPressTime = now;
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(localizations.translate('press_back_again_to_exit')),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
          ),
        );
      },
      child: AdaptiveScaffold(
      currentIndex: 0,
      backgroundColor: isDark ? const Color(0xFF1a1a2e) : const Color(0xFFF5F7FA),
      extendBody: true,
      drawer: _buildSideDrawer(context),
      floatingActionButton: Stack(
        children: [
          if (_showBackToTop)
            Positioned(
              bottom: 80,
              right: 16,
              child: ScaleTransition(
                scale: _fabAnimationController,
                child: FloatingActionButton(
                  mini: true,
                  heroTag: 'backToTop',
                  backgroundColor: const Color(0xFF667eea),
                  onPressed: () {
                    _scrollController.animateTo(
                      0,
                      duration: const Duration(milliseconds: 500),
                      curve: Curves.easeOutCubic,
                    );
                  },
                  child: const Icon(Icons.arrow_upward, color: Colors.white),
                ),
              ),
            ),
          Positioned(
            bottom: 16,
            right: 16,
            child: AnimatedBuilder(
              animation: _messageButtonController,
              builder: (context, child) {
                return Transform.scale(
                  scale: _unreadMessages > 0 
                      ? 1.0 + (_messageButtonController.value * 0.1)
                      : 1.0,
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          Color(0xFF667eea),
                          Color(0xFF764ba2),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Color(0xFF667eea).withOpacity(0.4),
                          blurRadius: _unreadMessages > 0 ? 20 : 12,
                          spreadRadius: _unreadMessages > 0 ? 2 : 0,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: FloatingActionButton(
                      heroTag: 'messages',
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        if (!requireAuth(context)) return;
                        context.push('/chat');
                      },
                      child: Stack(
                        children: [
                          Icon(
                            Icons.message,
                            color: Colors.white,
                            size: 26,
                          ),
                          if (_unreadMessages > 0)
                            Positioned(
                              right: 0,
                              top: 0,
                              child: Container(
                                padding: EdgeInsets.all(4),
                                decoration: BoxDecoration(
                                  color: Colors.red,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 2,
                                  ),
                                ),
                                constraints: BoxConstraints(
                                  minWidth: 18,
                                  minHeight: 18,
                                ),
                                child: Text(
                                  _unreadMessages > 99 
                                      ? '99+' 
                                      : '$_unreadMessages',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Background gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? [
                        const Color(0xFF1a1a2e),
                        const Color(0xFF16213e),
                      ]
                    : [
                        const Color(0xFF667eea).withOpacity(0.05),
                        const Color(0xFF764ba2).withOpacity(0.05),
                      ],
              ),
            ),
          ),
          RefreshIndicator(
            onRefresh: () async {
              await Future.wait(
                <Future<void>>[
                  productsProvider.loadProducts(force: true),
                  categoriesProvider.loadCategories(),
                  bannerProvider.loadBanners(force: true),
                  _loadRecommendations(),
                ],
              );
            },
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
          // Premium App Bar — gradient header with embedded BannerCarousel
          SliverAppBar(
            expandedHeight: (MediaQuery.of(context).size.width * 6 / 16).clamp(140.0, 200.0),
            floating: false,
            pinned: true,
            elevation: 0,
            automaticallyImplyLeading: false,
            backgroundColor: const Color(0xFF667eea),
            title: AnimatedOpacity(
              opacity: _bannerCollapsed ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 220),
              child: _CollapsedBannerTitle(active: _bannerCollapsed),
            ),
            centerTitle: true,
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.pin,
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // Banner carousel fills the entire flexible space
                  const Positioned.fill(
                    child: BannerCarousel(),
                  ),
                  // Top gradient scrim so nav buttons stay readable over any banner image
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 100,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.black.withOpacity(0.45),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),
                  // Action buttons row (menu + cart) at top
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(8, 6, 16, 0),
                        child: Row(
                          children: [
                            Builder(
                              builder: (drawerContext) {
                                return Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(14),
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      Scaffold.of(drawerContext).openDrawer();
                                    },
                                    child: const SizedBox(
                                      width: 44,
                                      height: 44,
                                      child: Icon(
                                        Icons.menu,
                                        color: Colors.white,
                                        size: 22,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                            const Spacer(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Barre de recherche avec Glassmorphism
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: Theme.of(context).brightness == Brightness.dark
                            ? [
                                Colors.white.withOpacity(0.08),
                                Colors.white.withOpacity(0.05),
                              ]
                            : [
                                Colors.white.withOpacity(0.9),
                                Colors.white.withOpacity(0.8),
                              ],
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF667eea).withOpacity(0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: TextField(
                      readOnly: true,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        context.push('/search');
                      },
                      decoration: InputDecoration(
                        hintText: localizations.translate('search_products_hint'),
                        hintStyle: TextStyle(
                          color: Colors.grey.shade500,
                          fontSize: 15,
                        ),
                        prefixIcon: Container(
                          padding: const EdgeInsets.all(12),
                          child: Icon(
                            FontAwesomeIcons.magnifyingGlass,
                            color: const Color(0xFF667eea),
                            size: 20,
                          ),
                        ),
                        suffixIcon: GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            context.push('/search');
                          },
                          child: Container(
                            margin: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              FontAwesomeIcons.sliders,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 16,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Catégories
          // Categories section
          Builder(
            builder: (context) {
              final categories = categoriesProvider.categories;
              if (categories.isEmpty) {
                return const SliverToBoxAdapter(
                  child: SizedBox.shrink(),
                );
              }
              return SliverToBoxAdapter(
                child: Container(
                  height: 80,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: categories.length,
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      final isSelected = selectedCategoryId == category['id'].toString();
                      final icon = category['icon']?.toString() ?? '';
                      final isDark = Theme.of(context).brightness == Brightness.dark;
                      return GestureDetector(
                        onTap: () {
                          try {
                            HapticFeedback.selectionClick();
                            final catId = category['id']?.toString() ?? '';
                            final catName = (category['name'] ?? '').toString();
                            
                            // Validation: ensure valid data before navigation
                            if (catId.isEmpty || catName.isEmpty) {
                              debugPrint('⚠️ Invalid category data: id=$catId, name=$catName');
                              return;
                            }
                            
                            context.push('/category/$catId?name=${Uri.encodeComponent(catName)}');
                          } catch (e, stackTrace) {
                            debugPrint('❌ Error navigating to category: $e');
                            debugPrint('Stack trace: $stackTrace');
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Erreur lors de l\'ouverture de la catégorie'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 14),
                          child: Tooltip(
                            message: category['name'] ?? '',
                            child: Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  gradient: isSelected
                                      ? const LinearGradient(
                                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                        )
                                      : null,
                                  color: isSelected
                                      ? null
                                      : isDark
                                          ? const Color(0xFF2C3036)
                                          : const Color(0xFFF5F6FA),
                                  borderRadius: BorderRadius.circular(18),
                                  boxShadow: [
                                    if (isSelected)
                                      BoxShadow(
                                        color: const Color(0xFF667eea).withOpacity(0.35),
                                        blurRadius: 12,
                                        offset: const Offset(0, 4),
                                      ),
                                  ],
                                ),
                                child: Center(
                                  child: Icon(
                                    _categoryIcon(category['name']?.toString() ?? ''),
                                    color: isSelected ? Colors.white : const Color(0xFF667eea),
                                    size: 26,
                                  ),
                                ),
                              ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              );
            },
          ),

          // Recommandations personnalisees
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      localizations.translate('recommended_for_you'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : const Color(0xFF2D3748),
                      ),
                    ),
                  ),
                  if (_recommendedProducts.isNotEmpty)
                    GestureDetector(
                      onTap: _isLoadingRecommendations ? null : _loadRecommendations,
                      child: Text(
                        localizations.translate('refresh'),
                        style: const TextStyle(
                          color: Color(0xFF667eea),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Builder(
              builder: (context) {
                if (_isLoadingRecommendations && _recommendedProducts.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 18),
                    child: Center(
                      child: CircularProgressIndicator(color: Color(0xFF667eea)),
                    ),
                  );
                }

                if (_recommendationsError != null && _recommendedProducts.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _recommendationsError!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.red,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        TextButton(
                          onPressed: _isLoadingRecommendations ? null : _loadRecommendations,
                          child: Text(localizations.translate('retry')),
                        ),
                      ],
                    ),
                  );
                }

                if (_recommendedProducts.isEmpty) {
                  return const SizedBox.shrink();
                }

                return PremiumProductList(
                  products: _recommendedProducts,
                  height: 340,
                );
              },
            ),
          ),
          
          // Titre Produits
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFf093fb), Color(0xFFf5576c)],
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.local_fire_department, color: Colors.white, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      localizations.translate('our_products'),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white
                            : const Color(0xFF2D3748),
                      ),
                    ),
                  ),
                  if (selectedCategoryId != null)
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          selectedCategoryId = null;
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF6B6B).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          localizations.translate('clear_filter'),
                          style: const TextStyle(
                            color: Color(0xFFFF6B6B),
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          
          // Grille de produits
          Builder(
            builder: (context) {
              final productsProvider = classic_provider.Provider.of<ProductProvider>(context);
              final products = productsProvider.products;

              if (productsProvider.isLoading && products.isEmpty) {
                return const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(
                      color: Color(0xFF667eea),
                    ),
                  ),
                );
              }

              if (productsProvider.error != null && products.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.wifi_off, size: 56, color: Colors.grey),
                        const SizedBox(height: 16),
                        Text(localizations.translate('error_loading')),
                        const SizedBox(height: 6),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Text(
                            productsProvider.error!,
                            textAlign: TextAlign.center,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                          ),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () {
                            productsProvider.loadProducts(force: true);
                          },
                          icon: const FaIcon(FontAwesomeIcons.arrowRotateRight, size: 16),
                          label: Text(localizations.translate('retry')),
                        ),
                      ],
                    ),
                  ),
                );
              }

              if (products.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        FaIcon(
                          FontAwesomeIcons.boxOpen,
                          size: 64,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          localizations.translate('no_products_available'),
                          style: TextStyle(
                            fontSize: 18,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: () {
                            productsProvider.loadProducts(force: true);
                          },
                          icon: const FaIcon(FontAwesomeIcons.arrowRotateRight, size: 16),
                          label: Text(localizations.translate('refresh')),
                        ),
                      ],
                    ),
                  ),
                );
              }
              final filteredProducts = selectedCategoryId != null
                  ? products.where((p) => p.categoryId == selectedCategoryId).toList()
                  : products;
              
              if (filteredProducts.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        FaIcon(
                          FontAwesomeIcons.boxOpen,
                          size: 64,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          selectedCategoryId != null
                              ? localizations.translate('no_products_in_category')
                              : localizations.translate('no_products_available'),
                          style: TextStyle(
                            fontSize: 18,
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }
              
              return SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.55,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildProductCard(filteredProducts[index]),
                    childCount: filteredProducts.length,
                  ),
                ),
              );
            },
          ),
          
          // Espace en bas
          const SliverToBoxAdapter(
            child: SizedBox(height: 80),
          ),
        ],
            ),
          ),
        ],
      ),
    ),
    );
  }
  
  
  Widget _buildProductCard(product) {
    return PremiumProductCard(product: product);
  }
  
  Widget _getCategoryIcon(String categoryName) {
    IconData icon;
    final name = categoryName.toLowerCase();
    
    if (name.contains('électronique') || name.contains('tech')) {
      icon = FontAwesomeIcons.laptop;
    } else if (name.contains('mode') || name.contains('vêtement')) {
      icon = FontAwesomeIcons.shirt;
    } else if (name.contains('alimentation') || name.contains('food')) {
      icon = FontAwesomeIcons.utensils;
    } else if (name.contains('beauté')) {
      icon = FontAwesomeIcons.spa;
    } else if (name.contains('sport')) {
      icon = FontAwesomeIcons.dumbbell;
    } else if (name.contains('maison')) {
      icon = FontAwesomeIcons.house;
    } else if (name.contains('livre')) {
      icon = FontAwesomeIcons.book;
    } else {
      icon = FontAwesomeIcons.boxOpen;
    }
    
    return Center(
      child: FaIcon(
        icon,
        color: const Color(0xFF667eea),
        size: 28,
      ),
    );
  }
}

// ── Collapsed banner typewriter title ─────────────────────────────────────────

class _CollapsedBannerTitle extends StatefulWidget {
  const _CollapsedBannerTitle({required this.active});

  final bool active;

  @override
  State<_CollapsedBannerTitle> createState() => _CollapsedBannerTitleState();
}

class _CollapsedBannerTitleState extends State<_CollapsedBannerTitle> {
  static const _charDelay = Duration(milliseconds: 42);
  static const _pauseAfter = Duration(seconds: 2);

  String _displayed = '';
  int _index = 0;
  bool _pausing = false;
  Timer? _timer;

  @override
  void didUpdateWidget(_CollapsedBannerTitle old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) {
      _startTyping();
    } else if (!widget.active && old.active) {
      _stopTyping();
    }
  }

  void _startTyping() {
    _stopTyping();
    final fullText = AppLocalizations.of(context).translate('brand_full_name');
    _timer = Timer.periodic(_charDelay, (_) {
      if (!mounted) return;
      if (_pausing) return;
      if (_index < fullText.length) {
        setState(() {
          _index++;
          _displayed = fullText.substring(0, _index);
        });
      } else {
        _pausing = true;
        Future.delayed(_pauseAfter, () {
          if (!mounted) return;
          setState(() {
            _displayed = '';
            _index = 0;
            _pausing = false;
          });
        });
      }
    });
  }

  void _stopTyping() {
    _timer?.cancel();
    _timer = null;
    _displayed = '';
    _index = 0;
    _pausing = false;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(
      _displayed,
      style: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.w700,
        fontSize: 16,
        letterSpacing: 0.3,
        shadows: [
          Shadow(color: Color(0x66000000), blurRadius: 8),
        ],
      ),
    );
  }
}
