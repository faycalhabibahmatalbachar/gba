import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../localization/app_localizations.dart';
import '../models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/favorites_provider.dart';
import '../services/activity_tracking_service.dart';

class PremiumProductCard extends StatelessWidget {
  final Product product;
  final double? width;
  final bool showQuickActions;

  const PremiumProductCard({
    Key? key,
    required this.product,
    this.width,
    this.showQuickActions = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context);
    final hasDiscount = product.compareAtPrice != null && 
                        product.compareAtPrice! > product.price;
    final discountPercentage = hasDiscount
        ? ((1 - product.price / product.compareAtPrice!) * 100).round()
        : 0;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          ActivityTrackingService().trackProductView(product.id, product.name);
          context.push('/product/${product.id}');
        },
        borderRadius: BorderRadius.circular(24),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Ink(
            width: width,
            decoration: BoxDecoration(
              color: scheme.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: scheme.primary.withOpacity(isDark ? 0.20 : 0.12),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: (isDark ? Colors.black : scheme.primary)
                      .withOpacity(isDark ? 0.35 : 0.08),
                  blurRadius: 22,
                  offset: const Offset(0, 12),
                  spreadRadius: -5,
                ),
              ],
            ),
            child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image Container avec badges
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                      gradient: LinearGradient(
                        colors: [
                          if (isDark) ...[
                            scheme.surfaceVariant.withOpacity(0.55),
                            scheme.surfaceVariant.withOpacity(0.35),
                          ] else ...[
                            Colors.grey.shade100,
                            Colors.grey.shade200,
                          ],
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                      child: product.mainImage != null
                          ? CachedNetworkImage(
                              imageUrl: product.mainImage!.contains('/products/products/')
                                  ? product.mainImage!.replaceAll('/products/products/', '/products/')
                                  : product.mainImage!,
                              fit: BoxFit.cover,
                              width: double.infinity,
                            placeholder: (context, url) => Container(
                              color: isDark
                                  ? scheme.surfaceVariant.withOpacity(0.35)
                                  : Colors.grey.shade100,
                              child: Center(
                                child: CircularProgressIndicator(
                                  color: theme.primaryColor,
                                  strokeWidth: 2,
                                ),
                              ),
                            ),
                            errorWidget: (context, url, error) => Container(
                              color: isDark
                                  ? scheme.surfaceVariant.withOpacity(0.35)
                                  : Colors.grey.shade100,
                              child: Icon(
                                Icons.image_not_supported_outlined,
                                size: 50,
                                color: Colors.grey.shade400,
                              ),
                            ),
                            )
                          : Container(
                              color: isDark
                                  ? scheme.surfaceVariant.withOpacity(0.35)
                                  : Colors.grey.shade100,
                              child: Icon(
                                Icons.shopping_bag_outlined,
                                size: 50,
                                color: Colors.grey.shade400,
                              ),
                            ),
                    ),
                  ),
                ),
                
                // Badges en haut
                Positioned(
                  top: 12,
                  left: 12,
                  right: 12,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Badge Featured
                      if (product.isFeatured)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFFD700), Color(0xFFFFA500)],
                            ),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.orange.withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.star, size: 14, color: Colors.white),
                              SizedBox(width: 4),
                              Text(
                                'Vedette',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ).animate().fadeIn(duration: 400.ms).scale(delay: 200.ms),
                      
                      // Badge Discount
                      if (hasDiscount)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFF4757), Color(0xFFFF6348)],
                            ),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.red.withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            '-$discountPercentage%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ).animate().fadeIn(duration: 400.ms).scale(delay: 250.ms),
                    ],
                  ),
                ),
                
                // Favorite Button
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    decoration: BoxDecoration(
                      color: scheme.surface.withOpacity(isDark ? 0.85 : 0.95),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(isDark ? 0.35 : 0.10),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(24),
                        onTap: () {
                          Provider.of<FavoritesProvider>(context, listen: false)
                              .toggleFavorite(product.id, productName: product.name);
                        },
                        child: Consumer<FavoritesProvider>(
                          builder: (context, favoritesProvider, child) {
                            final isFavorite = favoritesProvider.isFavorite(product.id);
                            return Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: FaIcon(
                                isFavorite
                                    ? FontAwesomeIcons.solidHeart
                                    : FontAwesomeIcons.heart,
                                color: isFavorite
                                    ? Colors.red
                                    : scheme.onSurface.withOpacity(0.6),
                                size: 18,
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ).animate()
                    .fadeIn(duration: 300.ms)
                    .scale(delay: 150.ms),
                ),
                
                // Stock Status Badge
                if (product.quantity == 0)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.9),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Text(
                        localizations.translate('out_of_stock'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            
            // Product Info
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxHeight < 110;

                    if (isCompact) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            product.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: scheme.onSurface,
                              height: 1.1,
                            ),
                          ),
                          const SizedBox(height: 6),
                          if (product.rating > 0) ...[
                            Row(
                              children: [
                                RatingBarIndicator(
                                  rating: product.rating.clamp(0.0, 5.0).toDouble(),
                                  itemBuilder: (context, _) => const Icon(
                                    Icons.star_rounded,
                                    color: Colors.amber,
                                  ),
                                  itemCount: 5,
                                  itemSize: 12,
                                  unratedColor: Colors.amber.withOpacity(0.25),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '(${product.reviewsCount})',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: scheme.onSurface.withOpacity(0.65),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                          ],
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (hasDiscount)
                                      Text(
                                        '${product.compareAtPrice!.toStringAsFixed(0)} FCFA',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Colors.grey.shade500,
                                          decoration: TextDecoration.lineThrough,
                                        ),
                                      ),
                                    FittedBox(
                                      fit: BoxFit.scaleDown,
                                      alignment: Alignment.centerLeft,
                                      child: Text(
                                        '${product.price.toStringAsFixed(0)} FCFA',
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: theme.primaryColor,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (showQuickActions && product.quantity > 0)
                                Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        theme.primaryColor,
                                        theme.primaryColor.withOpacity(0.8),
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: theme.primaryColor.withOpacity(0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: () {
                                        Provider.of<CartProvider>(context, listen: false).addItem(product, 1);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text('${product.name} ajouté au panier'),
                                            duration: const Duration(seconds: 2),
                                            backgroundColor: Colors.green,
                                            behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                          ),
                                        );
                                      },
                                      child: const Padding(
                                        padding: EdgeInsets.all(8.0),
                                        child: FaIcon(
                                          FontAwesomeIcons.cartPlus,
                                          color: Colors.white,
                                          size: 18,
                                        ),
                                      ),
                                    ),
                                  ),
                                ).animate().fadeIn(duration: 300.ms).scale(delay: 100.ms),
                            ],
                          ),
                        ],
                      );
                    }

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Category & Brand
                        if (product.brand != null)
                          Text(
                            product.brand!.toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: theme.primaryColor,
                              letterSpacing: 1,
                            ),
                          ),
                        
                        const SizedBox(height: 4),
                        
                        // Product Name
                        Text(
                          product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: scheme.onSurface,
                            height: 1.2,
                          ),
                        ),
                        
                        const SizedBox(height: 8),
                        
                        // Rating (if available)
                        if (product.rating > 0)
                          Row(
                            children: [
                              RatingBarIndicator(
                                rating: product.rating.clamp(0.0, 5.0).toDouble(),
                                itemBuilder: (context, _) => const Icon(
                                  Icons.star_rounded,
                                  color: Colors.amber,
                                ),
                                itemCount: 5,
                                itemSize: 14,
                                unratedColor: Colors.amber.withOpacity(0.25),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                product.rating.toStringAsFixed(1),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: scheme.onSurface.withOpacity(0.85),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '(${product.reviewsCount})',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: scheme.onSurface.withOpacity(0.65),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                          ],
                        ),
                        
                        const Spacer(),
                        
                        // Price Section
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (hasDiscount)
                                    Text(
                                      '${product.compareAtPrice!.toStringAsFixed(0)} FCFA',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade500,
                                        decoration: TextDecoration.lineThrough,
                                      ),
                                    ),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      '${product.price.toStringAsFixed(0)} FCFA',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: theme.primaryColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(width: 10),

                            // Quick Add to Cart Button
                            if (showQuickActions && product.quantity > 0)
                              Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      theme.primaryColor,
                                      theme.primaryColor.withOpacity(0.8),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  boxShadow: [
                                    BoxShadow(
                                      color: theme.primaryColor.withOpacity(0.3),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(12),
                                    onTap: () {
                                      Provider.of<CartProvider>(context, listen: false).addItem(product, 1);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          content: Text('${product.name} ajouté au panier'),
                                          duration: const Duration(seconds: 2),
                                          backgroundColor: Colors.green,
                                          behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
                                          margin: kIsWeb ? null : const EdgeInsets.fromLTRB(16, 0, 16, 90),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                        ),
                                      );
                                    },
                                    child: const Padding(
                                      padding: EdgeInsets.all(8.0),
                                      child: FaIcon(
                                        FontAwesomeIcons.cartPlus,
                                        color: Colors.white,
                                        size: 18,
                                      ),
                                    ),
                                  ),
                                ),
                              ).animate()
                                .fadeIn(duration: 300.ms)
                                .scale(delay: 100.ms),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ).animate()
          .fadeIn(duration: 500.ms)
          .slideY(begin: 0.1, end: 0, duration: 500.ms),
      ),
    ));
  }
}

// Grid View for Products
class PremiumProductGrid extends StatelessWidget {
  final List<Product> products;
  final bool showQuickActions;
  final ScrollPhysics? physics;

  const PremiumProductGrid({
    Key? key,
    required this.products,
    this.showQuickActions = true,
    this.physics,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: physics ?? const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.55,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      padding: const EdgeInsets.all(16),
      itemCount: products.length,
      itemBuilder: (context, index) {
        return PremiumProductCard(
          product: products[index],
          showQuickActions: showQuickActions,
        );
      },
    );
  }
}

// Horizontal List View for Products
class PremiumProductList extends StatelessWidget {
  final List<Product> products;
  final double height;
  final bool showQuickActions;

  const PremiumProductList({
    Key? key,
    required this.products,
    this.height = 320,
    this.showQuickActions = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: products.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(
              right: index < products.length - 1 ? 16 : 0,
            ),
            child: PremiumProductCard(
              product: products[index],
              width: 200,
              showQuickActions: showQuickActions,
            ),
          );
        },
      ),
    );
  }
}
