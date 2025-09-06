import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../providers/cart_provider.dart';
import '../models/cart_item.dart';
import '../localization/app_localizations.dart';
import '../widgets/bottom_nav_bar.dart';

class CartScreenPremium extends ConsumerStatefulWidget {
  const CartScreenPremium({super.key});

  @override
  ConsumerState<CartScreenPremium> createState() => _CartScreenPremiumState();
}

class _CartScreenPremiumState extends ConsumerState<CartScreenPremium>
    with TickerProviderStateMixin {
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
    final cartItems = ref.watch(cartProvider);
    final cartNotifier = ref.read(cartProvider.notifier);
    final localizations = AppLocalizations.of(context);
    final total = cartItems.fold(0.0, (sum, item) => sum + ((item.product?.price ?? 0) * item.quantity));
    final theme = Theme.of(context);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(context, localizations),
      bottomNavigationBar: const BottomNavBar(currentIndex: 2),
      body: Stack(
        children: [
          // Animated gradient background
          _buildAnimatedBackground(),
          // Main content
          SafeArea(
            child: cartItems.isEmpty
                ? _buildEmptyCart(localizations)
                : Column(
                    children: [
                      // Cart summary card
                      _buildCartSummary(cartItems.length, total, theme),
                      // Cart items list
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          itemCount: cartItems.length,
                          itemBuilder: (context, index) {
                            final item = cartItems[index];
                            return SlideTransition(
                              position: _slideAnimation,
                              child: FadeTransition(
                                opacity: _fadeAnimation,
                                child: _buildCartItem(item, cartNotifier, theme),
                              ),
                            );
                          },
                        ),
                      ),
                      // Checkout section
                      _buildCheckoutSection(total, localizations, theme),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, AppLocalizations localizations) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: Row(
        children: [
          const Icon(FontAwesomeIcons.cartShopping, size: 20),
          const SizedBox(width: 12),
          Text(
            localizations.translate('cart'),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
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
                  Colors.white.withOpacity(0.1),
                  Colors.white.withOpacity(0.05),
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
              'Découvrez nos produits',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 32),
            _buildGlassmorphicButton(
              onPressed: () => Navigator.pushReplacementNamed(context, '/home'),
              icon: FontAwesomeIcons.arrowLeft,
              label: 'Continuer vos achats',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartSummary(int itemCount, double total, ThemeData theme) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.9),
            Colors.white.withOpacity(0.7),
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
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
                      '$itemCount articles',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          '${(total * 655.957).toStringAsFixed(0)} FCFA',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
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
                          child: const Text(
                            'Livraison',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
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

  Widget _buildCartItem(CartItem item, CartNotifier notifier, ThemeData theme) {
    final deleteController = _getDeleteAnimation(item.product?.id ?? 'unknown');
    
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
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.grey.withOpacity(0.1),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
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
                    await notifier.removeItem(item.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Row(
                            children: [
                              const Icon(FontAwesomeIcons.check, color: Colors.white, size: 16),
                              const SizedBox(width: 12),
                              Text('${item.product?.name ?? 'Produit'} retiré du panier'),
                            ],
                          ),
                          backgroundColor: Colors.red.shade600,
                          behavior: SnackBarBehavior.floating,
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
                child: Container(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      // Product image
                      Hero(
                        tag: 'product_${item.product?.id ?? 'unknown'}',
                        child: Container(
                          width: 80,
                          height: 80,
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
                                print('🔍 Cart - Checking image for: ${item.product?.name}');
                                print('   mainImage: ${item.product?.mainImage}');
                                print('   is null: ${item.product?.mainImage == null}');
                                print('   is empty: ${item.product?.mainImage?.isEmpty ?? true}');
                                
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
                                  print('⚠️ No image for cart item: ${item.product?.name}');
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
                      const SizedBox(width: 16),
                      // Product details
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.product?.name ?? 'Produit sans nom',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.product?.brand ?? 'No brand',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Wrap(
                              children: [
                                Text(
                                  '${((item.product?.price ?? 0) * 655.957).toStringAsFixed(0)} FCFA',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                    color: theme.primaryColor,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                  if (false) // TODO: Add discount field to Product model
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        colors: [Colors.orange.shade400, Colors.orange.shade600],
                                      ),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '-0%', // TODO: Add discount field
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      // Quantity controls
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildQuantityButton(
                              icon: FontAwesomeIcons.minus,
                              onPressed: () {
                                HapticFeedback.selectionClick();
                                if (item.quantity > 1) {
                                  notifier.updateQuantity(item.id, item.quantity - 1);
                                } else {
                                  deleteController.forward().then((_) {
                                    notifier.removeItem(item.id);
                                  });
                                }
                              },
                              enabled: true,
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                '${item.quantity}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                            _buildQuantityButton(
                              icon: FontAwesomeIcons.plus,
                              onPressed: () {
                                HapticFeedback.selectionClick();
                                notifier.updateQuantity(item.id, item.quantity + 1);
                              },
                              enabled: item.quantity < 99,
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
        );
      },
    );
  }

  Widget _buildQuantityButton({
    required IconData icon,
    required VoidCallback onPressed,
    required bool enabled,
  }) {
    return InkWell(
      onTap: enabled ? onPressed : null,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(8),
        child: Icon(
          icon,
          size: 12,
          color: enabled ? Colors.black87 : Colors.grey.shade400,
        ),
      ),
    );
  }

  Widget _buildCheckoutSection(double total, AppLocalizations localizations, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
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
            // Total row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total',
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${(total * 655.957).toStringAsFixed(0)} FCFA',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                // Checkout button
                _buildCheckoutButton(theme),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckoutButton(ThemeData theme) {
    return GestureDetector(
      onTapDown: (_) {
        setState(() => _isProcessingCheckout = true);
        HapticFeedback.lightImpact();
      },
      onTapUp: (_) {
        setState(() => _isProcessingCheckout = false);
        // Navigate to checkout
      },
      onTapCancel: () {
        setState(() => _isProcessingCheckout = false);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        transform: Matrix4.identity()..scale(_isProcessingCheckout ? 0.95 : 1.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: _isProcessingCheckout
                ? [theme.primaryColor.withOpacity(0.8), Colors.purple.shade600]
                : [theme.primaryColor, Colors.purple.shade500],
          ),
          boxShadow: [
            BoxShadow(
              color: theme.primaryColor.withOpacity(0.3),
              blurRadius: _isProcessingCheckout ? 10 : 20,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              FontAwesomeIcons.creditCard,
              color: Colors.white,
              size: 16,
            ),
            const SizedBox(width: 8),
            const Flexible(
              child: Text(
                'Commander',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
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
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
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
