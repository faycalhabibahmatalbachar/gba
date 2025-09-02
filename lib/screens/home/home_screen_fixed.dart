import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:shimmer/shimmer.dart';

import '../../models/product.dart';
import '../../models/category.dart';
import '../../providers/products_provider.dart';
import '../../providers/categories_provider.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_card_premium.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _selectedCategory = ValueNotifier<Category?>(null);
  int _currentIndex = 0;
  
  final List<Map<String, dynamic>> _adBanners = [
    {
      'title': '🎯 MEGA SOLDES -50%',
      'subtitle': 'Sur tous les smartphones',
      'color': const Color(0xFF1976D2),
    },
    {
      'title': '🚚 Livraison Gratuite',
      'subtitle': 'Pour toute commande +100€',
      'color': const Color(0xFF0D47A1),
    },
    {
      'title': '⚡ Flash Deal',
      'subtitle': 'Nouvelles offres chaque jour',
      'color': const Color(0xFF01579B),
    },
    {
      'title': '🎁 Code Promo: SAVE20',
      'subtitle': '20% de réduction immédiate',
      'color': const Color(0xFF006064),
    },
  ];
  
  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _selectedCategory.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200) {
      final productsState = ref.read(productsProvider);
      if (!productsState.isLoading && productsState.hasMore) {
        ref.read(productsProvider.notifier).loadProducts();
      }
    }
  }

  void _onSearchSubmitted(String value) {
    ref.read(productsProvider.notifier).setSearchQuery(value);
  }

  void _onBottomNavTap(int index) {
    setState(() {
      _currentIndex = index;
    });
    
    switch (index) {
      case 0:
        // Already on home
        break;
      case 1:
        context.push('/categories');
        break;
      case 2:
        context.push('/cart');
        break;
      case 3:
        context.push('/profile');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // App Bar
          SliverAppBar(
            expandedHeight: 140,
            floating: false,
            pinned: true,
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
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: _buildAdvertisingBanner(),
                    ),
                  ],
                ),
              ),
              title: Text(
                'GBA Store',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          
          // Search Bar
          SliverToBoxAdapter(
            child: Container(
              margin: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.white,
                    Colors.grey.shade50,
                  ],
                ),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchController,
                onSubmitted: _onSearchSubmitted,
                decoration: InputDecoration(
                  hintText: 'Rechercher des produits...',
                  hintStyle: GoogleFonts.inter(
                    color: Colors.grey[400],
                    fontSize: 14,
                  ),
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF667eea)),
                  suffixIcon: Container(
                    margin: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Icon(Icons.tune, color: Colors.white, size: 20),
                  ),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                ),
              ),
            ).animate()
              .fadeIn(duration: 600.ms)
              .slideY(begin: -0.2, end: 0),
          ),
          
          // Categories Section
          SliverToBoxAdapter(
            child: _buildCategoriesSection(),
          ),
          
          // Featured Products
          SliverToBoxAdapter(
            child: _buildFeaturedProducts(),
          ),
          
          // Products Grid
          _buildProductsGrid(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 20,
              offset: const Offset(0, -10),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _onBottomNavTap,
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF667eea),
          unselectedItemColor: Colors.grey,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_rounded),
              label: 'Accueil',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.category_rounded),
              label: 'Catégories',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.shopping_cart_rounded),
              label: 'Panier',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              label: 'Compte',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdvertisingBanner() {
    return SizedBox(
      height: 40,
      child: CarouselSlider.builder(
        itemCount: _adBanners.length,
        options: CarouselOptions(
          height: 40,
          autoPlay: true,
          autoPlayInterval: const Duration(seconds: 3),
          autoPlayAnimationDuration: const Duration(milliseconds: 800),
          viewportFraction: 1.0,
          scrollDirection: Axis.horizontal,
        ),
        itemBuilder: (context, index, realIndex) {
          final ad = _adBanners[index];
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  ad['color'],
                  ad['color'].withOpacity(0.8),
                ],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  ad['title'],
                  style: GoogleFonts.poppins(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  ad['subtitle'],
                  style: GoogleFonts.inter(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCategoriesSection() {
    final categoriesState = ref.watch(categoriesProvider);
    
    if (categoriesState.isLoading) {
      return SizedBox(
        height: 120,
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: 5,
          itemBuilder: (context, index) {
            return Shimmer.fromColors(
              baseColor: Colors.grey[300]!,
              highlightColor: Colors.grey[100]!,
              child: Container(
                width: 100,
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            );
          },
        ),
      );
    }
    
    if (categoriesState.error != null) {
      return const SizedBox.shrink();
    }
    
    final categories = categoriesState.categories;
    if (categories.isEmpty) {
      return const SizedBox.shrink();
    }
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Catégories',
            style: GoogleFonts.poppins(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        SizedBox(
          height: 100,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: categories.length,
            itemBuilder: (context, index) {
              return _buildCategoryCard(categories[index]);
            },
          ),
        ),
      ],
    );
  }
  
  Widget _buildCategoryCard(Category category) {
    final isSelected = _selectedCategory.value?.id == category.id;
    
    return GestureDetector(
      onTap: () {
        _selectedCategory.value = isSelected ? null : category;
        ref.read(productsProvider.notifier).setCategory(
          isSelected ? null : category.id,
        );
      },
      child: Container(
        width: 100,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          gradient: isSelected
              ? const LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                )
              : LinearGradient(
                  colors: [Colors.white, Colors.grey.shade50],
                ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: isSelected 
                  ? const Color(0xFF667eea).withOpacity(0.3)
                  : Colors.black.withOpacity(0.08),
              blurRadius: isSelected ? 20 : 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              _getCategoryIcon(category.icon),
              size: 32,
              color: isSelected ? Colors.white : const Color(0xFF667eea),
            ),
            const SizedBox(height: 8),
            Text(
              category.name,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : Colors.grey[700],
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
  
  IconData _getCategoryIcon(String? icon) {
    switch (icon) {
      case 'phone':
        return Icons.phone_android_rounded;
      case 'laptop':
        return Icons.laptop_rounded;
      case 'headphones':
        return Icons.headphones_rounded;
      case 'watch':
        return Icons.watch_rounded;
      case 'tv':
        return Icons.tv_rounded;
      case 'game':
        return Icons.sports_esports_rounded;
      default:
        return Icons.category_rounded;
    }
  }

  Widget _buildFeaturedProducts() {
    return Consumer(
      builder: (context, ref, child) {
        final productsState = ref.watch(productsProvider);
        final featuredProducts = productsState.products
            .where((p) => p.isFeatured)
            .take(6)
            .toList();
        
        if (featuredProducts.isEmpty) {
          return const SizedBox.shrink();
        }
        
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Produits en vedette',
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            SizedBox(
              height: 280,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: featuredProducts.length,
                itemBuilder: (context, index) {
                  return Container(
                    width: 200,
                    margin: const EdgeInsets.only(right: 16),
                    child: PremiumProductCard(
                      product: featuredProducts[index],
                      height: 260,
                      showQuickActions: false,
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildProductsGrid() {
    return Consumer(
      builder: (context, ref, child) {
        final productsState = ref.watch(productsProvider);
        
        if (productsState.error != null) {
          return SliverToBoxAdapter(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 16),
                    Text(productsState.error!),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        ref.read(productsProvider.notifier).loadProducts(refresh: true);
                      },
                      child: const Text('Réessayer'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        
        return SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverMasonryGrid.count(
            crossAxisCount: 2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            childCount: productsState.products.length + (productsState.hasMore ? 2 : 0),
            itemBuilder: (context, index) {
              if (index >= productsState.products.length) {
                // Loading indicator
                return Shimmer.fromColors(
                  baseColor: Colors.grey[300]!,
                  highlightColor: Colors.grey[100]!,
                  child: Container(
                    height: 220,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                );
              }
              
              final product = productsState.products[index];
              return ProductCard(product: product);
            },
          ),
        );
      },
    );
  }
}
