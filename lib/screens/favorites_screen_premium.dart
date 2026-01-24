import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../providers/favorites_provider.dart';
import '../providers/product_provider.dart';
import '../models/product.dart';
import '../localization/app_localizations.dart';
import '../widgets/adaptive_scaffold.dart';
import 'product/product_detail_screen.dart';

class FavoritesScreenPremium extends StatefulWidget {
  const FavoritesScreenPremium({super.key});

  @override
  State<FavoritesScreenPremium> createState() => _FavoritesScreenPremiumState();
}

class _FavoritesScreenPremiumState extends State<FavoritesScreenPremium>
    with TickerProviderStateMixin {
  
  String _getCorrectImageUrl(String url) {
    // Correction des URLs avec double /products/
    if (url.contains('/products/products/')) {
      url = url.replaceAll('/products/products/', '/products/');
    }
    // L'URL est déjà complète, pas besoin de modifier
    return url;
  }
  late AnimationController _fadeController;
  late AnimationController _scaleController;
  late AnimationController _heartBeatController;
  late AnimationController _rotationController;
  late AnimationController _slideController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _heartBeatAnimation;
  late Animation<Offset> _slideAnimation;
  
  String _selectedSort = 'recent';
  String _selectedView = 'grid';
  final Map<String, AnimationController> _removeAnimations = {};
  final Map<String, bool> _pressedItems = {};

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _heartBeatController = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    )..repeat(reverse: true);
    _rotationController = AnimationController(
      duration: const Duration(seconds: 15),
      vsync: this,
    )..repeat();
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.elasticOut,
    );
    _heartBeatAnimation = Tween<double>(
      begin: 0.95,
      end: 1.1,
    ).animate(CurvedAnimation(
      parent: _heartBeatController,
      curve: Curves.easeInOut,
    ));
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.2, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutQuart,
    ));

    _fadeController.forward();
    _scaleController.forward();
    _slideController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _scaleController.dispose();
    _heartBeatController.dispose();
    _rotationController.dispose();
    _slideController.dispose();
    for (var controller in _removeAnimations.values) {
      controller.dispose();
    }
    super.dispose();
  }

  AnimationController _getRemoveAnimation(String productId) {
    if (!_removeAnimations.containsKey(productId)) {
      _removeAnimations[productId] = AnimationController(
        duration: const Duration(milliseconds: 400),
        vsync: this,
      );
    }
    return _removeAnimations[productId]!;
  }

  List<Product> _sortFavorites(List<Product> favorites) {
    switch (_selectedSort) {
      case 'name':
        favorites.sort((a, b) => a.name.compareTo(b.name));
        break;
      case 'price_low':
        favorites.sort((a, b) => a.price.compareTo(b.price));
        break;
      case 'price_high':
        favorites.sort((a, b) => b.price.compareTo(a.price));
        break;
      case 'recent':
      default:
        // Keep original order (most recent first)
        break;
    }
    return favorites;
  }

  @override
  Widget build(BuildContext context) {
    final favoritesProvider = Provider.of<FavoritesProvider>(context);
    final productsProvider = Provider.of<ProductProvider>(context);
    final favoriteIds = favoritesProvider.favoriteIds;

    final productsById = <String, Product>{
      for (final p in productsProvider.products) p.id: p,
    };

    final favorites = <Product>[
      for (final id in favoriteIds.reversed)
        if (productsById[id] != null) productsById[id]!,
    ];
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context);

    return AdaptiveScaffold(
      currentIndex: 3,
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(context, localizations),
      body: Stack(
        children: [
          // Animated gradient background
          _buildAnimatedBackground(),
          // Main content
          SafeArea(
            child: Builder(
              builder: (context) {
                if (productsProvider.isLoading && productsProvider.products.isEmpty) {
                  return const Center(
                    child: CircularProgressIndicator(),
                  );
                }

                if (productsProvider.error != null && productsProvider.products.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.wifi_off, size: 56, color: Colors.grey),
                          const SizedBox(height: 16),
                          const Text('Erreur de chargement'),
                          const SizedBox(height: 8),
                          Text(
                            productsProvider.error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              productsProvider.loadProducts(force: true);
                            },
                            child: const Text('Réessayer'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                if (favoriteIds.isEmpty) {
                  return _buildEmptyFavorites(localizations);
                }

                if (favorites.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.search_off, size: 56, color: Colors.grey),
                          const SizedBox(height: 16),
                          const Text('Produits favoris introuvables'),
                          const SizedBox(height: 8),
                          const Text(
                            'Recharge la liste des produits.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              productsProvider.loadProducts(force: true);
                            },
                            child: const Text('Rafraîchir'),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                final sortedFavorites = _sortFavorites(List<Product>.from(favorites));

                return Column(
                  children: [
                    _buildHeaderSection(sortedFavorites.length),
                    _buildControlsSection(),
                    Expanded(
                      child: _selectedView == 'grid'
                          ? _buildGridView(sortedFavorites, favoritesProvider, theme)
                          : _buildListView(sortedFavorites, favoritesProvider, theme),
                    ),
                  ],
                );
              },
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
          AnimatedBuilder(
            animation: _heartBeatAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _heartBeatAnimation.value,
                child: const Icon(
                  FontAwesomeIcons.solidHeart,
                  size: 20,
                  color: Colors.red,
                ),
              );
            },
          ),
          const SizedBox(width: 12),
          Text(
            localizations.translate('favorites'),
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
      actions: [
        IconButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            _showCollectionsDialog();
          },
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.purple.withOpacity(0.2),
                  Colors.pink.withOpacity(0.2),
                ],
              ),
            ),
            child: const Icon(FontAwesomeIcons.folderPlus, size: 16),
          ),
        ),
        const SizedBox(width: 8),
      ],
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
                Colors.pink.shade50,
                Colors.red.shade50,
                Colors.purple.shade50,
              ],
              transform: GradientRotation(_rotationController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            painter: HeartMeshGradientPainter(_rotationController.value),
            child: Container(),
          ),
        );
      },
    );
  }

  Widget _buildEmptyFavorites(AppLocalizations localizations) {
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
                    Colors.pink.shade300,
                    Colors.red.shade400,
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.pink.withOpacity(0.3),
                    blurRadius: 30,
                    spreadRadius: 5,
                  ),
                ],
              ),
              child: const Icon(
                FontAwesomeIcons.heartCrack,
                size: 48,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Aucun favori',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Ajoutez vos produits préférés ici',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 32),
            _buildGlassmorphicButton(
              onPressed: () => Navigator.pop(context),
              icon: FontAwesomeIcons.magnifyingGlass,
              label: 'Explorer les produits',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderSection(int count) {
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
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStatCard(
                icon: FontAwesomeIcons.heart,
                value: count.toString(),
                label: 'Favoris',
                color: Colors.red,
              ),
              _buildStatCard(
                icon: FontAwesomeIcons.layerGroup,
                value: '3',
                label: 'Collections',
                color: Colors.purple,
              ),
              _buildStatCard(
                icon: FontAwesomeIcons.share,
                value: '12',
                label: 'Partagés',
                color: Colors.blue,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String value,
    required String label,
    required Color color,
  }) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withOpacity(0.2),
                color.withOpacity(0.1),
              ],
            ),
          ),
          child: Icon(icon, size: 20, color: color),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }

  Widget _buildControlsSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // View toggle
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  blurRadius: 10,
                ),
              ],
            ),
            child: Row(
              children: [
                _buildViewToggle(FontAwesomeIcons.grip, 'grid'),
                _buildViewToggle(FontAwesomeIcons.list, 'list'),
              ],
            ),
          ),
          // Sort dropdown
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  blurRadius: 10,
                ),
              ],
            ),
            child: DropdownButton<String>(
              value: _selectedSort,
              underline: Container(),
              isDense: true,
              icon: const Icon(FontAwesomeIcons.sort, size: 14),
              items: const [
                DropdownMenuItem(value: 'recent', child: Text('Récents')),
                DropdownMenuItem(value: 'name', child: Text('Nom')),
                DropdownMenuItem(value: 'price_low', child: Text('Prix ↑')),
                DropdownMenuItem(value: 'price_high', child: Text('Prix ↓')),
              ],
              onChanged: (value) {
                setState(() => _selectedSort = value!);
                HapticFeedback.selectionClick();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewToggle(IconData icon, String view) {
    final isSelected = _selectedView == view;
    return InkWell(
      onTap: () {
        setState(() => _selectedView = view);
        HapticFeedback.selectionClick();
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: isSelected ? Theme.of(context).primaryColor.withOpacity(0.1) : Colors.transparent,
        ),
        child: Icon(
          icon,
          size: 16,
          color: isSelected ? Theme.of(context).primaryColor : Colors.grey,
        ),
      ),
    );
  }

  Widget _buildGridView(List<Product> favorites, FavoritesProvider notifier, ThemeData theme) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.75,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
      ),
      itemCount: favorites.length,
      itemBuilder: (context, index) {
        final product = favorites[index];
        return SlideTransition(
          position: _slideAnimation,
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: _buildFavoriteCard(product, notifier, theme),
          ),
        );
      },
    );
  }

  Widget _buildListView(List<Product> favorites, FavoritesProvider notifier, ThemeData theme) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: favorites.length,
      itemBuilder: (context, index) {
        final product = favorites[index];
        return SlideTransition(
          position: _slideAnimation,
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: _buildFavoriteListItem(product, notifier, theme),
          ),
        );
      },
    );
  }

  Widget _buildFavoriteCard(Product product, FavoritesProvider notifier, ThemeData theme) {
    final productKey = 'favorite_${product.id}';
    final isPressed = _pressedItems[productKey] ?? false;
    
    return GestureDetector(
      onTapDown: (_) {
        setState(() => _pressedItems[productKey] = true);
        HapticFeedback.lightImpact();
      },
      onTapUp: (_) {
        setState(() => _pressedItems[productKey] = false);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductDetailScreen(productId: product.id),
          ),
        );
      },
      onTapCancel: () {
        setState(() => _pressedItems[productKey] = false);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        transform: Matrix4.identity()..scale(isPressed ? 0.95 : 1.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(isPressed ? 0.15 : 0.1),
              blurRadius: isPressed ? 10 : 15,
              offset: Offset(0, isPressed ? 3 : 5),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Image
                Container(
                  width: double.infinity,
                  height: 140,
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    child: Builder(
                      builder: (context) {
                        // Debug logging
                        print('🔍 Checking image for product: ${product.name}');
                        print('   mainImage value: ${product.mainImage}');
                        print('   mainImage is null: ${product.mainImage == null}');
                        print('   mainImage is empty: ${product.mainImage?.isEmpty ?? true}');
                        
                        if (product.mainImage != null && product.mainImage!.isNotEmpty) {
                          final imageUrl = _getCorrectImageUrl(product.mainImage!);
                          print('   ✅ Using image URL: $imageUrl');
                          
                          return CachedNetworkImage(
                            imageUrl: imageUrl,
                            width: double.infinity,
                            height: 140,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Center(
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.grey[400]!),
                              ),
                            ),
                            errorWidget: (context, url, error) => Container(
                              height: 140,
                              color: Colors.grey.shade200,
                              child: Center(
                                child: Icon(
                                  FontAwesomeIcons.boxOpen,
                                  color: Colors.grey[400],
                                  size: 40,
                                ),
                              ),
                            ),
                          );
                        } else {
                          print('⚠️ Pas d\'image pour le produit: ${product.name}');
                          print('   mainImage raw value: "${product.mainImage}"');
                          return Container(
                            height: 140,
                            color: Colors.grey.shade200,
                            child: Center(
                              child: Icon(
                                FontAwesomeIcons.boxOpen,
                                color: Colors.grey[400],
                                size: 40,
                              ),
                            ),
                          );
                        }
                      },
                    ),
                  ),
                ),
                // Product details
                Flexible(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          product.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        if (product.brand != null && product.brand!.isNotEmpty)
                          Text(
                            product.brand!,
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 11,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        const SizedBox(height: 4),
                        Text(
                          '${(product.price * 655.957).toStringAsFixed(0)} FCFA',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: theme.primaryColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            // Remove favorite button
            Positioned(
              top: 8,
              right: 8,
              child: _buildRemoveFavoriteButton(product, notifier),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFavoriteListItem(Product product, FavoritesProvider notifier, ThemeData theme) {
    return Container(
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
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ProductDetailScreen(productId: product.id),
            ),
          );
        },
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Product image
              Container(
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
                  child: product.mainImage != null
                      ? CachedNetworkImage(
                          imageUrl: _getCorrectImageUrl(product.mainImage!),
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Center(
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.grey[400]!),
                            ),
                          ),
                          errorWidget: (context, url, error) => Center(
                            child: Icon(
                              FontAwesomeIcons.boxOpen,
                              color: Colors.grey[400],
                            ),
                          ),
                        )
                      : Center(
                          child: Icon(
                            FontAwesomeIcons.boxOpen,
                            color: Colors.grey[400],
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
                      product.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      product.brand ?? 'No brand',
                      style: TextStyle(
                        color: Colors.grey[600],
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${(product.price * 655.957).toStringAsFixed(0)} FCFA',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: theme.primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              // Remove button
              _buildRemoveFavoriteButton(product, notifier),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRemoveFavoriteButton(Product product, FavoritesProvider notifier) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.mediumImpact();
        notifier.toggleFavorite(product.id, productName: product.name);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(FontAwesomeIcons.heartCrack, color: Colors.white, size: 16),
                const SizedBox(width: 12),
                Text('${product.name} retiré des favoris'),
              ],
            ),
            backgroundColor: Colors.red.shade600,
            behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.red.withOpacity(0.2),
              blurRadius: 10,
            ),
          ],
        ),
        child: AnimatedBuilder(
          animation: _heartBeatAnimation,
          builder: (context, child) {
            return Transform.scale(
              scale: _heartBeatAnimation.value,
              child: const Icon(
                FontAwesomeIcons.solidHeart,
                size: 16,
                color: Colors.red,
              ),
            );
          },
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

  void _showCollectionsDialog() {
    showDialog(
      context: context,
      builder: (context) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Dialog(
          backgroundColor: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withOpacity(0.9),
                  Colors.white.withOpacity(0.8),
                ],
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Mes Collections',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                _buildCollectionItem('Été 2024', 8, Colors.orange),
                _buildCollectionItem('Essentiels', 15, Colors.blue),
                _buildCollectionItem('Cadeaux', 5, Colors.purple),
                const SizedBox(height: 20),
                _buildGlassmorphicButton(
                  onPressed: () => Navigator.pop(context),
                  icon: FontAwesomeIcons.plus,
                  label: 'Créer une collection',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCollectionItem(String name, int count, Color color) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withOpacity(0.1),
        border: Border.all(
          color: color.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withOpacity(0.2),
            ),
            child: Icon(
              FontAwesomeIcons.folderOpen,
              size: 16,
              color: color,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  '$count articles',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            FontAwesomeIcons.chevronRight,
            size: 14,
            color: Colors.grey[400],
          ),
        ],
      ),
    );
  }
}

// Custom painter for heart mesh gradient background
class HeartMeshGradientPainter extends CustomPainter {
  final double animation;

  HeartMeshGradientPainter(this.animation);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.pink.withOpacity(0.05),
          Colors.red.withOpacity(0.05),
          Colors.purple.withOpacity(0.05),
        ],
        transform: GradientRotation(animation * 2 * math.pi),
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Draw animated hearts pattern
    for (int i = 0; i < 5; i++) {
      final offset = Offset(
        size.width * (0.1 + i * 0.2) * (1 + 0.1 * math.sin(animation * 2 * math.pi + i)),
        size.height * (0.2 + i * 0.15) * (1 + 0.1 * math.cos(animation * 2 * math.pi + i)),
      );
      
      // Draw heart shape
      final path = Path();
      final x = offset.dx;
      final y = offset.dy;
      final radius = size.width * 0.08 * (1 + 0.05 * math.sin(animation * 2 * math.pi + i));
      
      path.moveTo(x, y + radius);
      path.cubicTo(x - radius, y - radius/2, x - radius, y - radius, x - radius/2, y - radius);
      path.arcToPoint(Offset(x, y - radius/2), radius: Radius.circular(radius/2), clockwise: false);
      path.arcToPoint(Offset(x + radius/2, y - radius), radius: Radius.circular(radius/2), clockwise: false);
      path.cubicTo(x + radius, y - radius, x + radius, y - radius/2, x, y + radius);
      
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(HeartMeshGradientPainter oldDelegate) => true;
}
