import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'dart:ui';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
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
import '../widgets/product_card_premium.dart';
import '../services/activity_tracking_service.dart';
import '../services/messaging_service.dart';
import '../services/recommendation_service.dart';

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
  int _unreadMessages = 0;

  final RecommendationService _recommendationService = RecommendationService();
  List<Product> _recommendedProducts = [];
  bool _isLoadingRecommendations = false;
  String? _recommendationsError;

  Future<void> _loadRecommendations() async {
    if (_isLoadingRecommendations) return;

    setState(() {
      _isLoadingRecommendations = true;
      _recommendationsError = null;
    });

    try {
      final items = await _recommendationService.getRecommendations(limit: 10);
      if (!mounted) return;
      setState(() {
        _recommendedProducts = items;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _recommendationsError = e.toString();
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _isLoadingRecommendations = false;
      });
    }
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
                const SizedBox(width: 10),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.22),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.arrow_forward, color: Colors.white, size: 18),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _timeGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Bonjour';
    if (hour >= 12 && hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
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
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.person, color: Color(0xFF667eea)),
              title: Text(localizations.translate('my_account')),
              subtitle: Text(localizations.translate('navigation')),
              onTap: () => _navigateFromDrawer(context, '/profile'),
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
                    onTap: () => _navigateFromDrawer(context, '/favorites'),
                  ),
                  ListTile(
                    leading: const Icon(Icons.shopping_cart_outlined),
                    title: Text(localizations.translate('cart')),
                    onTap: () => _navigateFromDrawer(context, '/cart'),
                  ),
                  ListTile(
                    leading: const Icon(Icons.receipt_long_outlined),
                    title: Text(localizations.translate('orders')),
                    onTap: () => _navigateFromDrawer(context, '/orders'),
                  ),
                  ExpansionTile(
                    leading: const Icon(Icons.auto_awesome),
                    title: Text(localizations.translate('special_orders')),
                    children: [
                      ListTile(
                        title: Text(localizations.translate('new_special_order')),
                        onTap: () => _navigateFromDrawer(context, '/special-order'),
                      ),
                      ListTile(
                        title: Text(localizations.translate('my_special_orders')),
                        onTap: () => _navigateFromDrawer(context, '/special-orders'),
                      ),
                      ListTile(
                        title: Text(localizations.translate('personalization_gift')),
                        onTap: () => _showComingSoon(
                          context,
                          localizations.translate('personalization_gift'),
                          closeDrawer: true,
                        ),
                      ),
                    ],
                  ),
                  ListTile(
                    leading: const Icon(Icons.message_outlined),
                    title: Text(localizations.translate('messages')),
                    onTap: () => _navigateFromDrawer(context, '/messages'),
                  ),
                  ListTile(
                    leading: const Icon(Icons.settings_outlined),
                    title: Text(localizations.translate('settings')),
                    onTap: () => _navigateFromDrawer(context, '/settings'),
                  ),
                ],
              ),
            ),
          ],
        ),
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
    _loadUnreadMessages();
    _loadRecommendations();
    _scrollController.addListener(() {
      if (_scrollController.offset > 200 && !_showBackToTop) {
        setState(() => _showBackToTop = true);
        _fabAnimationController.forward();
      } else if (_scrollController.offset <= 200 && _showBackToTop) {
        setState(() => _showBackToTop = false);
        _fabAnimationController.reverse();
      }
    });
  }
  
  void _loadUnreadMessages() async {
    try {
      final messagingService = Provider.of<MessagingService>(context, listen: false);
      setState(() {
        _unreadMessages = messagingService.unreadCount;
      });
    } catch (e) {
      print('Erreur chargement messages: $e');
    }
  }
  
  @override
  void dispose() {
    _fabAnimationController.dispose();
    _searchAnimationController.dispose();
    _messageButtonController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final categoriesProvider = Provider.of<CategoriesProvider>(context);
    final productsProvider = Provider.of<ProductProvider>(context);
    final bannerProvider = Provider.of<BannerProvider>(context);
    final localizations = AppLocalizations.of(context);
    final activeBanner = bannerProvider.activeBanner;
    final bannerImageUrl = activeBanner?.imageUrl?.trim();
    final hasBannerImage = bannerImageUrl != null && bannerImageUrl.isNotEmpty;
    final bannerTitle = (activeBanner?.title ?? '').trim();
    final bannerSubtitle = (activeBanner?.subtitle ?? '').trim();
    final bannerTargetRoute = activeBanner?.targetRoute?.trim();
    final cartProvider = Provider.of<CartProvider>(context);
    final cartCount = cartProvider.itemCount;
    
    return AdaptiveScaffold(
      currentIndex: 0,
      backgroundColor: const Color(0xFFF5F7FA),
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
                        context.push('/messages');
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
                colors: [
                  const Color(0xFF667eea).withOpacity(0.05),
                  const Color(0xFF764ba2).withOpacity(0.05),
                ],
              ),
            ),
          ),
          RefreshIndicator(
            onRefresh: () async {
              await Future.wait([
                productsProvider.loadProducts(force: true),
                categoriesProvider.loadCategories(),
                bannerProvider.loadBanners(force: true),
                _loadRecommendations(),
              ]);
            },
            child: CustomScrollView(
              controller: _scrollController,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
          // Premium App Bar avec animation mesh gradient
          SliverAppBar(
            expandedHeight: hasBannerImage ? 280 : 140,
            floating: true,
            pinned: true,
            elevation: 0,
            automaticallyImplyLeading: false,
            backgroundColor: Colors.transparent,
            flexibleSpace: Container(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF667eea).withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            const Color(0xFF667eea),
                            const Color(0xFF764ba2),
                            const Color(0xFFf093fb),
                          ],
                          stops: const [0.0, 0.5, 1.0],
                        ),
                      ),
                    ),
                    if (hasBannerImage)
                      Positioned.fill(
                        child: CachedNetworkImage(
                          imageUrl: bannerImageUrl!,
                          fit: BoxFit.cover,
                          alignment: Alignment.center,
                          placeholder: (context, url) => Container(
                            color: Colors.white.withOpacity(0.10),
                            child: const Center(
                              child: SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              ),
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: Colors.white.withOpacity(0.10),
                            child: const Icon(Icons.image_not_supported_outlined, color: Colors.white),
                          ),
                        ),
                      ),
                    if (hasBannerImage)
                      IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.bottomCenter,
                              end: Alignment.topCenter,
                              colors: [
                                Colors.black.withOpacity(0.55),
                                Colors.black.withOpacity(0.15),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                    if (hasBannerImage && (bannerTitle.isNotEmpty || bannerSubtitle.isNotEmpty))
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 18,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (bannerTitle.isNotEmpty)
                              Text(
                                bannerTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            if (bannerSubtitle.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                bannerSubtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.92),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                            if (bannerTargetRoute != null && bannerTargetRoute.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(16),
                                    onTap: () {
                                      HapticFeedback.selectionClick();
                                      context.go(bannerTargetRoute);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(16),
                                        color: Colors.white.withOpacity(0.18),
                                      ),
                                      child: Text(
                                        localizations.translate('discover'),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 110,
                      child: IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black.withOpacity(0.35),
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(8, 0, 16, 0),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 10),
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
                              badges.Badge(
                                position: badges.BadgePosition.topEnd(top: -8, end: -8),
                                showBadge: Provider.of<CartProvider>(context).itemCount > 0,
                                badgeAnimation: const badges.BadgeAnimation.scale(
                                  animationDuration: Duration(milliseconds: 300),
                                ),
                                badgeContent: Text(
                                  Provider.of<CartProvider>(context).itemCount.toString(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                  ),
                                ),
                                badgeStyle: badges.BadgeStyle(
                                  badgeColor: const Color(0xFFFF6B6B),
                                  elevation: 0,
                                  badgeGradient: const badges.BadgeGradient.linear(
                                    colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
                                  ),
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(15),
                                    onTap: () {
                                      HapticFeedback.lightImpact();
                                      context.go('/cart');
                                    },
                                    child: const SizedBox(
                                      width: 44,
                                      height: 44,
                                      child: Icon(
                                        Icons.shopping_cart,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          
          // Barre de recherche avec Glassmorphism
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.white.withOpacity(0.9),
                          Colors.white.withOpacity(0.8),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF667eea).withOpacity(0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: TextField(
                      onTap: () => HapticFeedback.selectionClick(),
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
                        suffixIcon: Container(
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
                  height: 120,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: categories.length,
                    itemBuilder: (context, index) {
                      final category = categories[index];
                      final isSelected = selectedCategoryId == category['id'].toString();
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            selectedCategoryId = isSelected ? null : category['id'].toString();
                          });
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF667eea) : Colors.white,
                            borderRadius: BorderRadius.circular(25),
                            boxShadow: [
                              BoxShadow(
                                color: isSelected 
                                  ? const Color(0xFF667eea).withOpacity(0.3)
                                  : Colors.black.withOpacity(0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              category['name'] ?? '',
                              style: TextStyle(
                                color: isSelected ? Colors.white : const Color(0xFF2D3748),
                                fontWeight: FontWeight.w600,
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
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      localizations.translate('recommended_for_you'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  ),
                  if (_recommendedProducts.isNotEmpty)
                    TextButton(
                      onPressed: _isLoadingRecommendations ? null : _loadRecommendations,
                      child: Text(
                        localizations.translate('refresh'),
                        style: const TextStyle(
                          color: Color(0xFF667eea),
                          fontWeight: FontWeight.w600,
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
              padding: const EdgeInsets.all(20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    localizations.translate('our_products'),
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  if (selectedCategoryId != null)
                    TextButton(
                      onPressed: () {
                        setState(() {
                          selectedCategoryId = null;
                        });
                      },
                      child: Text(
                        localizations.translate('clear_filter'),
                        style: const TextStyle(
                          color: Color(0xFFFF6B6B),
                          fontWeight: FontWeight.w600,
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
              final productsProvider = Provider.of<ProductProvider>(context);
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
