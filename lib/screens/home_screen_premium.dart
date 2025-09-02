import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:badges/badges.dart' as badges;
import '../providers/cart_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/products_provider.dart';
import '../widgets/bottom_nav_bar.dart';

class HomeScreenPremium extends ConsumerStatefulWidget {
  const HomeScreenPremium({super.key});

  @override
  ConsumerState<HomeScreenPremium> createState() => _HomeScreenPremiumState();
}

class _HomeScreenPremiumState extends ConsumerState<HomeScreenPremium> {
  String? selectedCategoryId;
  int _currentIndex = 0;
  
  @override
  Widget build(BuildContext context) {
    final categoriesAsync = ref.watch(categoriesProvider);
    final productsAsync = ref.watch(productsProvider);
    final cartItems = ref.watch(cartProvider);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: CustomScrollView(
        slivers: [
          // App Bar Premium
          SliverAppBar(
            expandedHeight: 120,
            floating: true,
            pinned: true,
            elevation: 0,
            backgroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'GBA Store',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'Découvrez nos produits premium',
                                  style: TextStyle(
                                    color: Colors.white70,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                            // Cart Icon with Badge
                            badges.Badge(
                              position: badges.BadgePosition.topEnd(top: -5, end: -5),
                              showBadge: cartItems.isNotEmpty,
                              badgeContent: Text(
                                '${cartItems.length}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                ),
                              ),
                              badgeStyle: const badges.BadgeStyle(
                                badgeColor: Color(0xFFFF6B6B),
                              ),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: IconButton(
                                  icon: const FaIcon(
                                    FontAwesomeIcons.cartShopping,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                  onPressed: () => context.go('/cart'),
                                ),
                              ),
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
          
          // Barre de recherche
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: TextField(
                decoration: InputDecoration(
                  hintText: 'Rechercher un produit...',
                  hintStyle: TextStyle(color: Colors.grey.shade400),
                  prefixIcon: Icon(
                    FontAwesomeIcons.magnifyingGlass,
                    color: Colors.grey.shade400,
                    size: 18,
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
          
          // Catégories
          categoriesAsync.when(
            data: (categories) => categories.isNotEmpty
                ? SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Catégories',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF2D3436),
                                ),
                              ),
                              TextButton(
                                onPressed: () => context.go('/categories'),
                                child: const Text(
                                  'Voir tout',
                                  style: TextStyle(
                                    color: Color(0xFF667eea),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          height: 120,
                          padding: const EdgeInsets.only(left: 16),
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: categories.length,
                            itemBuilder: (context, index) {
                              final category = categories[index];
                              final isSelected = selectedCategoryId == category.id;
                              
                              return GestureDetector(
                                onTap: () {
                                  setState(() {
                                    selectedCategoryId = isSelected ? null : category.id;
                                  });
                                },
                                child: Container(
                                  width: 90,
                                  margin: const EdgeInsets.only(right: 12),
                                  child: Column(
                                    children: [
                                      Container(
                                        width: 70,
                                        height: 70,
                                        decoration: BoxDecoration(
                                          gradient: isSelected
                                              ? const LinearGradient(
                                                  colors: [
                                                    Color(0xFF667eea),
                                                    Color(0xFF764ba2)
                                                  ],
                                                )
                                              : null,
                                          color: isSelected ? null : Colors.white,
                                          borderRadius: BorderRadius.circular(20),
                                          boxShadow: [
                                            BoxShadow(
                                              color: isSelected
                                                  ? const Color(0xFF667eea).withOpacity(0.3)
                                                  : Colors.black.withOpacity(0.08),
                                              blurRadius: 12,
                                              offset: const Offset(0, 4),
                                            ),
                                          ],
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(20),
                                          child: category.imageUrl != null
                                              ? CachedNetworkImage(
                                                  imageUrl: category.imageUrl!,
                                                  fit: BoxFit.cover,
                                                  placeholder: (context, url) => Center(
                                                    child: CircularProgressIndicator(
                                                      strokeWidth: 2,
                                                      valueColor: AlwaysStoppedAnimation(
                                                        Colors.grey.shade300,
                                                      ),
                                                    ),
                                                  ),
                                                  errorWidget: (context, url, error) =>
                                                      _getCategoryIcon(category.name),
                                                )
                                              : _getCategoryIcon(category.name),
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        category.name,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: isSelected
                                              ? FontWeight.bold
                                              : FontWeight.w500,
                                          color: isSelected
                                              ? const Color(0xFF667eea)
                                              : const Color(0xFF2D3436),
                                        ),
                                        textAlign: TextAlign.center,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  )
                : const SliverToBoxAdapter(child: SizedBox.shrink()),
            loading: () => const SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator(),
                ),
              ),
            ),
            error: (error, stack) => SliverToBoxAdapter(
              child: Center(
                child: Text('Erreur: $error'),
              ),
            ),
          ),
          
          // Titre Produits
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Nos Produits',
                    style: TextStyle(
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
                      child: const Text(
                        'Effacer filtre',
                        style: TextStyle(
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
          Consumer(
            builder: (context, ref, _) {
              final productsState = ref.watch(productsProvider);
              final products = productsState.products;
              
              if (productsState.isLoading && products.isEmpty) {
                return const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              
              if (productsState.error != null && products.isEmpty) {
                return SliverFillRemaining(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const FaIcon(
                          FontAwesomeIcons.triangleExclamation,
                          size: 48,
                          color: Colors.red,
                        ),
                        const SizedBox(height: 16),
                        Text('Erreur: ${productsState.error}'),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () {
                            ref.read(productsProvider.notifier).loadProducts(refresh: true);
                          },
                          icon: const FaIcon(FontAwesomeIcons.arrowRotateRight, size: 16),
                          label: const Text('Réessayer'),
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
                              ? 'Aucun produit dans cette catégorie'
                              : 'Aucun produit disponible',
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
                    childAspectRatio: 0.68,
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
      bottomNavigationBar: const BottomNavBar(
        currentIndex: 0,
      ),
    );
  }
  
  Widget _buildProductCard(product) {
    return GestureDetector(
      onTap: () => context.go('/product/${product.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: Stack(
                children: [
                  // Image produit avec debug
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(12),
                      ),
                    ),
                    child: Builder(
                      builder: (context) {
                        if (product.mainImage != null && product.mainImage!.isNotEmpty) {
                          // Log de l'URL de l'image
                          print('🖼️ Loading image: ${product.mainImage}');
                          
                          return ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12),
                            ),
                            child: Image.network(
                              product.mainImage!,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              errorBuilder: (context, error, stackTrace) {
                                print('❌ Error loading image for ${product.name}');
                                print('   URL: ${product.mainImage}');
                                print('   Error: $error');
                                return Center(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        FontAwesomeIcons.image,
                                        size: 30,
                                        color: Colors.grey.shade400,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Image error',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Colors.grey.shade500,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                              loadingBuilder: (context, child, loadingProgress) {
                                if (loadingProgress == null) return child;
                                return Center(
                                  child: CircularProgressIndicator(
                                    value: loadingProgress.expectedTotalBytes != null
                                        ? loadingProgress.cumulativeBytesLoaded /
                                            loadingProgress.expectedTotalBytes!
                                        : null,
                                    strokeWidth: 2,
                                    color: const Color(0xFF667eea),
                                  ),
                                );
                              },
                            ),
                          );
                        } else {
                          print('⚠️ No image for product: ${product.name}');
                          return Center(
                            child: Icon(
                              FontAwesomeIcons.boxOpen,
                              size: 40,
                              color: Colors.grey.shade400,
                            ),
                          );
                        }
                      },
                    ),
                  ),
                // Bouton favori
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: const Icon(
                        FontAwesomeIcons.heart,
                        size: 16,
                        color: Color(0xFF667eea),
                      ),
                      onPressed: () {
                        // TODO: Toggle favorite
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
            // Infos produit avec contrainte de hauteur
            Container(
              height: 70, // Hauteur fixe pour éviter overflow
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Nom et marque
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          product.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 11,
                            color: Color(0xFF2D3436),
                            height: 1.2,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (product.brand != null)
                          Text(
                            product.brand!,
                            style: TextStyle(
                              fontSize: 9,
                              color: Colors.grey.shade500,
                              height: 1.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  // Prix et bouton panier
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          '${product.price.toStringAsFixed(0)} FCFA',
                          style: const TextStyle(
                            color: Color(0xFF667eea),
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            height: 1,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                          ),
                          shape: BoxShape.circle,
                        ),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          icon: const Icon(
                            FontAwesomeIcons.cartPlus,
                            size: 14,
                            color: Colors.white,
                          ),
                          onPressed: () {
                            ref.read(cartProvider.notifier).addItem(product.id, 1);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('${product.name} ajouté au panier'),
                                duration: const Duration(seconds: 2),
                                backgroundColor: Colors.green,
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                            );
                          },
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
    );
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
