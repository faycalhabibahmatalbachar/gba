import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../providers/cart_provider.dart';
import '../models/cart_item.dart';
import '../localization/app_localizations.dart';
import '../widgets/adaptive_scaffold.dart';

class CartScreenPremium extends StatefulWidget {
  const CartScreenPremium({super.key});

  @override
  State<CartScreenPremium> createState() => _CartScreenPremiumState();
}

class _CartScreenPremiumState extends State<CartScreenPremium>
    with TickerProviderStateMixin {
  static const bool _debugImageLogs = false;
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late AnimationController _rotationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  final Map<String, AnimationController> _deleteAnimations = {};
  bool _isProcessingCheckout = false;

  String _getCorrectImageUrl(String url) {
    // Correction des URLs avec double /products/
    if (url.contains('/products/products/')) {
      return url.replaceAll('/products/products/', '/products/');
    }
    // L'URL est déjà complète depuis la DB
    return url;
  }

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _rotationController = AnimationController(
      duration: const Duration(seconds: 10),
      vsync: this,
    )..repeat();

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.3, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutQuart,
    ));
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.elasticOut,
    );

    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _rotationController.dispose();
    for (var controller in _deleteAnimations.values) {
      controller.dispose();
    }
    super.dispose();
  }

  AnimationController _getDeleteAnimation(String itemId) {
    if (!_deleteAnimations.containsKey(itemId)) {
      _deleteAnimations[itemId] = AnimationController(
        duration: const Duration(milliseconds: 400),
        vsync: this,
      );
    }
    return _deleteAnimations[itemId]!;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);

    final appBar = _buildAppBar(context, localizations);
    final topPadding = math.max(0.0, appBar.preferredSize.height - 8);

    return AdaptiveScaffold(
      currentIndex: 2,
      extendBodyBehindAppBar: true,
      appBar: appBar,
      body: Stack(
        children: [
          // Animated gradient background
          _buildAnimatedBackground(),
          // Main content
          SafeArea(
            child: Consumer<CartProvider>(
              builder: (context, cartProvider, _) {
                final cartItems = cartProvider.items;
                final total = cartItems.fold(
                  0.0,
                  (sum, item) => sum + ((item.product?.price ?? 0) * item.quantity),
                );

                if (cartProvider.isLoading) {
                  return _buildLoadingState(localizations);
                }

                if (cartProvider.error != null) {
                  return _buildErrorState(cartProvider.error!, localizations, cartProvider);
                }

                if (cartItems.isEmpty) {
                  return Padding(
                    padding: EdgeInsets.only(top: topPadding),
                    child: RefreshIndicator(
                      onRefresh: () => cartProvider.loadCart(),
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.7,
                            child: _buildEmptyCart(localizations),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return Padding(
                  padding: EdgeInsets.only(top: topPadding),
                  child: Column(
                    children: [
                      _buildCartSummary(cartProvider.itemCount, total, localizations, theme),
                      Expanded(
                        child: RefreshIndicator(
                          onRefresh: () => cartProvider.loadCart(),
                          child: ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: cartItems.length,
                            itemBuilder: (context, index) {
                              final item = cartItems[index];
                              return KeyedSubtree(
                                key: ValueKey(item.id),
                                child: SlideTransition(
                                  position: _slideAnimation,
                                  child: FadeTransition(
                                    opacity: _fadeAnimation,
                                    child: _buildCartItem(item, cartProvider, localizations, theme),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),
                      _buildCheckoutSection(total, localizations, theme),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(AppLocalizations localizations) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.blue.shade300,
                  Colors.purple.shade300,
                ],
              ),
            ),
            child: const CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 3,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            localizations.translate('cart_loading'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(String error, AppLocalizations localizations, CartProvider cartProvider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              FontAwesomeIcons.triangleExclamation,
              size: 54,
              color: Colors.red.shade400,
            ),
            const SizedBox(height: 14),
            Text(
              localizations.translate('error_loading'),
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: TextStyle(color: Colors.grey.shade700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: () => cartProvider.loadCart(),
              icon: const Icon(FontAwesomeIcons.arrowsRotate, size: 16),
              label: Text(localizations.translate('retry')),
            ),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, AppLocalizations localizations) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      toolbarHeight: 72,
      titleSpacing: 0,
      title: Padding(
        padding: const EdgeInsets.only(left: 16),
        child: Consumer<CartProvider>(
          builder: (context, cartProvider, _) {
            final count = cartProvider.itemCount;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Icon(
                      FontAwesomeIcons.cartShopping,
                      size: 20,
                      color: theme.colorScheme.onSurface,
                    ),
                    const SizedBox(width: 12),
                    Text(
                      localizations.translate('cart'),
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                if (count > 0)
                  Padding(
                    padding: const EdgeInsets.only(left: 32, top: 2),
                    child: Text(
                      localizations.translateParams(
                        'items_count',
                        {'count': count.toString()},
                      ),
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  (isDark ? theme.colorScheme.surface : Colors.white).withOpacity(0.08),
                  (isDark ? theme.colorScheme.surface : Colors.white).withOpacity(0.02),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedBackground() {
    return AnimatedBuilder(
      animation: _rotationController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Colors.blue.shade50,
                Colors.purple.shade50,
                Colors.pink.shade50,
              ],
              transform: GradientRotation(_rotationController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            painter: MeshGradientPainter(_rotationController.value),
            child: Container(),
          ),
        );
      },
    );
  }

  Widget _buildEmptyCart(AppLocalizations localizations) {
    return Center(
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.purple.shade300,
                    Colors.blue.shade400,
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.purple.withOpacity(0.3),
                    blurRadius: 30,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: const Icon(
                FontAwesomeIcons.cartShopping,
                size: 48,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              localizations.translate('cart_empty'),
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              localizations.translate('discover_products'),
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 32),
            _buildGlassmorphicButton(
              onPressed: () => context.go('/'),
              icon: FontAwesomeIcons.arrowLeft,
              label: localizations.translate('continue_shopping'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartSummary(int itemCount, double total, AppLocalizations localizations, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            theme.colorScheme.surface.withOpacity(isDark ? 0.92 : 0.90),
            theme.colorScheme.surface.withOpacity(isDark ? 0.80 : 0.70),
          ],
        ),
        border: Border.all(
          color: theme.colorScheme.primary.withOpacity(isDark ? 0.18 : 0.10),
        ),
        boxShadow: [
          BoxShadow(
            color: (isDark ? Colors.black : theme.colorScheme.primary)
                .withOpacity(isDark ? 0.35 : 0.10),
            blurRadius: 20,
            offset: const Offset(0, 10),
            spreadRadius: -6,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localizations.translateParams('items_count', {'count': itemCount.toString()}),
                      style: TextStyle(
                        fontSize: 14,
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        alignment: WrapAlignment.end,
                        children: [
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              '${(total * 655.957).toStringAsFixed(0)} FCFA',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: theme.colorScheme.onSurface,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.green.shade400, Colors.green.shade600],
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              localizations.translate('delivery'),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      theme.primaryColor.withOpacity(0.2),
                      theme.primaryColor.withOpacity(0.1),
                    ],
                  ),
                ),
                child: Icon(
                  FontAwesomeIcons.truckFast,
                  size: 20,
                  color: theme.primaryColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCartItem(CartItem item, CartProvider cartProvider, AppLocalizations localizations, ThemeData theme) {
    final deleteController = _getDeleteAnimation(item.product?.id ?? 'unknown');
    final isDark = theme.brightness == Brightness.dark;

    return AnimatedBuilder(
      animation: deleteController,
      builder: (context, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: Offset.zero,
            end: const Offset(1.0, 0.0),
          ).animate(CurvedAnimation(
            parent: deleteController,
            curve: Curves.easeInBack,
          )),
          child: FadeTransition(
            opacity: Tween<double>(
              begin: 1.0,
              end: 0.0,
            ).animate(deleteController),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: theme.colorScheme.surface.withOpacity(isDark ? 0.92 : 0.96),
                border: Border.all(
                  color: theme.colorScheme.primary.withOpacity(isDark ? 0.18 : 0.10),
                ),
                boxShadow: [
                  BoxShadow(
                    color: (isDark ? Colors.black : theme.colorScheme.primary)
                        .withOpacity(isDark ? 0.35 : 0.08),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                    spreadRadius: -6,
                  ),
                ],
              ),
              child: Dismissible(
                key: Key('cart_item_${item.id}'),
                direction: DismissDirection.endToStart,
                background: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: LinearGradient(
                      colors: [Colors.red.shade400, Colors.red.shade600],
                    ),
                  ),
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 20),
                  child: const Icon(
                    FontAwesomeIcons.trash,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                confirmDismiss: (direction) async {
                  HapticFeedback.mediumImpact();
                  // Suppression avec confirmation
                  try {
                    await cartProvider.removeItem(item.id);
                    if (context.mounted) {
                      final productName = item.product?.name ?? localizations.translate('product');
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Row(
                            children: [
                              const Icon(FontAwesomeIcons.check, color: Colors.white, size: 16),
                              const SizedBox(width: 12),
                              Text(
                                localizations.translateParams(
                                  'removed_from_cart',
                                  {'name': productName},
                                ),
                              ),
                            ],
                          ),
                          backgroundColor: Colors.red.shade600,
                          behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      );
                    }
                    return true; // Confirme la suppression
                  } catch (e) {
                    print('Erreur suppression: $e');
                    return false; // Annule la suppression en cas d'erreur
                  }
                },
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () {
                      final id = item.product?.id;
                      if (id != null && id.isNotEmpty) {
                        context.push('/product/$id');
                      }
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Hero(
                            tag: 'product_${item.product?.id ?? 'unknown'}',
                            child: Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Colors.grey.shade200,
                                    Colors.grey.shade300,
                                  ],
                                ),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(16),
                                child: Builder(
                                  builder: (context) {
                                    if (_debugImageLogs) {
                                      print('🔍 Cart - Checking image for: ${item.product?.name}');
                                      print('   mainImage: ${item.product?.mainImage}');
                                      print('   is null: ${item.product?.mainImage == null}');
                                      print('   is empty: ${item.product?.mainImage?.isEmpty ?? true}');
                                    }
                                    
                                    if (item.product?.mainImage != null && item.product!.mainImage!.isNotEmpty) {
                                      return CachedNetworkImage(
                                        imageUrl: _getCorrectImageUrl(item.product!.mainImage!),
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Center(
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Colors.grey[400]!),
                                          ),
                                        ),
                                        errorWidget: (context, url, error) => Icon(
                                          FontAwesomeIcons.boxOpen,
                                          color: Colors.grey[400],
                                        ),
                                      );
                                    } else {
                                      if (_debugImageLogs) {
                                        print('⚠️ No image for cart item: ${item.product?.name}');
                                      }
                                      return Icon(
                                        FontAwesomeIcons.boxOpen,
                                        color: Colors.grey[400],
                                      );
                                    }
                                  },
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // Product details
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.product?.name ?? localizations.translate('unnamed_product'),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.product?.brand ?? localizations.translate('no_brand'),
                                  style: TextStyle(
                                    color: theme.colorScheme.onSurface.withOpacity(0.65),
                                    fontSize: 14,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        '${((item.product?.price ?? 0) * 655.957).toStringAsFixed(0)} FCFA',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                          color: theme.primaryColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          // Quantity controls
                          Flexible(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerRight,
                              child: Container(
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: theme.colorScheme.outline.withOpacity(0.35),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _buildQuantityButton(
                                      icon: FontAwesomeIcons.minus,
                                      onPressed: () {
                                        HapticFeedback.selectionClick();
                                        if (item.quantity > 1) {
                                          Future.microtask(() {
                                            cartProvider.updateQuantity(item.id, item.quantity - 1);
                                          });
                                        } else {
                                          deleteController.forward().then((_) {
                                            Future.microtask(() {
                                              cartProvider.removeItem(item.id);
                                            });
                                          });
                                        }
                                      },
                                      enabled: true,
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10),
                                      child: Text(
                                        '${item.quantity}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                    _buildQuantityButton(
                                      icon: FontAwesomeIcons.plus,
                                      onPressed: () {
                                        HapticFeedback.selectionClick();
                                        Future.microtask(() {
                                          cartProvider.updateQuantity(item.id, item.quantity + 1);
                                        });
                                      },
                                      enabled: item.quantity < 99,
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
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildQuantityButton({
    required IconData icon,
    required VoidCallback onPressed,
    required bool enabled,
  }) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: enabled ? onPressed : null,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(6),
        child: Icon(
          icon,
          size: 12,
          color: enabled
              ? theme.colorScheme.onSurface
              : theme.colorScheme.onSurface.withOpacity(0.35),
        ),
      ),
    );
  }

  Widget _buildCheckoutSection(double total, AppLocalizations localizations, ThemeData theme) {
    final totalFcfa = total * 655.957;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withOpacity(0.95),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(32),
          topRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth >= 520;

                final totalBlock = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      localizations.translate('total'),
                      style: TextStyle(
                        fontSize: 14,
                        color: theme.colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        '${totalFcfa.toStringAsFixed(0)} FCFA',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                  ],
                );

                final checkoutButton = SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      HapticFeedback.heavyImpact();
                      GoRouter.of(context).go('/checkout');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.colorScheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 18,
                        vertical: 15,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                      elevation: 5,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(FontAwesomeIcons.creditCard, size: 18, color: Colors.white),
                        const SizedBox(width: 10),
                        Flexible(
                          child: Text(
                            localizations.translate('checkout'),
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );

                if (isWide) {
                  return Row(
                    children: [
                      Expanded(child: totalBlock),
                      const SizedBox(width: 16),
                      Expanded(child: checkoutButton),
                    ],
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    totalBlock,
                    const SizedBox(height: 14),
                    checkoutButton,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGlassmorphicButton({
    required VoidCallback onPressed,
    required IconData icon,
    required String label,
  }) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white.withOpacity(0.2),
              Colors.white.withOpacity(0.1),
            ],
          ),
          border: Border.all(
            color: Colors.white.withOpacity(0.2),
            width: 1,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Custom painter for mesh gradient background
class MeshGradientPainter extends CustomPainter {
  final double animation;

  MeshGradientPainter(this.animation);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.blue.withOpacity(0.1),
          Colors.purple.withOpacity(0.1),
          Colors.pink.withOpacity(0.1),
        ],
        transform: GradientRotation(animation * 2 * math.pi),
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawCircle(
      Offset(size.width * 0.2, size.height * 0.3),
      size.width * 0.3 * (1 + 0.2 * math.sin(animation * 2 * math.pi)),
      paint,
    );

    canvas.drawCircle(
      Offset(size.width * 0.8, size.height * 0.7),
      size.width * 0.25 * (1 + 0.2 * math.cos(animation * 2 * math.pi)),
      paint,
    );
  }

  @override
  bool shouldRepaint(MeshGradientPainter oldDelegate) => true;
}
