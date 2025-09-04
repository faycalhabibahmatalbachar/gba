import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider/provider.dart' as provider;
import 'dart:ui';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:badges/badges.dart' as badges;
import '../providers/cart_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/products_provider.dart';
import '../providers/favorites_provider.dart';
import '../widgets/bottom_nav_bar.dart';
import '../services/messaging_service.dart';

class HomeScreenPremium extends ConsumerStatefulWidget {
  const HomeScreenPremium({super.key});

  @override
  ConsumerState<HomeScreenPremium> createState() => _HomeScreenPremiumState();
}

class _HomeScreenPremiumState extends ConsumerState<HomeScreenPremium> 
    with TickerProviderStateMixin {
  String? selectedCategoryId;
  int _currentIndex = 0;
  late AnimationController _fabAnimationController;
  late AnimationController _searchAnimationController;
  late AnimationController _messageButtonController;
  final ScrollController _scrollController = ScrollController();
  bool _showBackToTop = false;
  int _unreadMessages = 0;
  
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
      final messagingService = context.read<MessagingService>();
      await messagingService.loadConversations();
      
      setState(() {
        _unreadMessages = messagingService.conversations
            .where((c) => c.unreadCount > 0)
            .fold(0, (sum, c) => sum + c.unreadCount);
      });
      
      // Écouter les changements
      messagingService.addListener(() {
        if (mounted) {
          setState(() {
            _unreadMessages = messagingService.conversations
                .where((c) => c.unreadCount > 0)
                .fold(0, (sum, c) => sum + c.unreadCount);
          });
        }
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
    final categoriesAsync = ref.watch(categoriesProvider);
    final productsAsync = ref.watch(productsProvider);
    final cartItems = ref.watch(cartProvider);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      extendBody: true,
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
          CustomScrollView(
            controller: _scrollController,
        slivers: [
          // Premium App Bar avec animation mesh gradient
          SliverAppBar(
            expandedHeight: 140,
            floating: true,
            pinned: true,
            elevation: 0,
            backgroundColor: Colors.transparent,
            flexibleSpace: Container(
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
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(30),
                  bottomRight: Radius.circular(30),
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF667eea).withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: FlexibleSpaceBar(
                background: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ShaderMask(
                                  blendMode: BlendMode.srcIn,
                                  shaderCallback: (bounds) => const LinearGradient(
                                    colors: [Colors.white, Colors.white70],
                                  ).createShader(bounds),
                                  child: const Text(
                                    '✨ GBA Store',
                                    style: TextStyle(
                                      fontSize: 32,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Découvrez l\'excellence',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.9),
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                // Profile Avatar
                                Container(
                                  padding: const EdgeInsets.all(2),
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.white.withOpacity(0.8),
                                        Colors.white.withOpacity(0.3),
                                      ],
                                    ),
                                    shape: BoxShape.circle,
                                  ),
                                  child: CircleAvatar(
                                    radius: 20,
                                    backgroundColor: Colors.white.withOpacity(0.3),
                                    child: const Icon(
                                      FontAwesomeIcons.userLarge,
                                      color: Colors.white,
                                      size: 16,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                // Cart avec badge animé
                                badges.Badge(
                                  position: badges.BadgePosition.topEnd(top: -8, end: -8),
                                  showBadge: cartItems.isNotEmpty,
                                  badgeAnimation: const badges.BadgeAnimation.scale(
                                    animationDuration: Duration(milliseconds: 300),
                                  ),
                                  badgeContent: Text(
                                    '${cartItems.length}',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
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
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(15),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(15),
                                      onTap: () {
                                        HapticFeedback.lightImpact();
                                        context.go('/cart');
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.all(10),
                                        child: const Icon(
                                          FontAwesomeIcons.bagShopping,
                                          color: Colors.white,
                                          size: 20,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
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
                      border: Border.all(
                        color: Colors.white.withOpacity(0.5),
                        width: 1.5,
                      ),
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
                        hintText: '🔍 Que recherchez-vous?',
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
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 300),
                                  curve: Curves.easeOutBack,
                                  width: 90,
                                  margin: const EdgeInsets.only(right: 12),
                                  transform: isSelected 
                                      ? (Matrix4.identity()..scale(1.05))
                                      : Matrix4.identity(),
                                  child: Column(
                                    children: [
                                      Container(
                                        width: 70,
                                        height: 70,
                                        decoration: BoxDecoration(
                                          gradient: isSelected
                                              ? const LinearGradient(
                                                  begin: Alignment.topLeft,
                                                  end: Alignment.bottomRight,
                                                  colors: [
                                                    Color(0xFF667eea),
                                                    Color(0xFF764ba2),
                                                    Color(0xFFf093fb),
                                                  ],
                                                )
                                              : null,
                                          color: isSelected ? null : Colors.white,
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(
                                            color: isSelected 
                                                ? Colors.white.withOpacity(0.3)
                                                : Colors.transparent,
                                            width: 2,
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: isSelected
                                                  ? const Color(0xFF667eea).withOpacity(0.4)
                                                  : Colors.black.withOpacity(0.1),
                                              blurRadius: isSelected ? 20 : 10,
                                              offset: const Offset(0, 5),
                                              spreadRadius: isSelected ? 2 : 0,
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
        ],
      ),
      bottomNavigationBar: const BottomNavBar(
        currentIndex: 0,
      ),
    );
  }
  
  
  Widget _buildProductCard(product) {
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 300),
      tween: Tween(begin: 0, end: 1),
      builder: (context, value, child) {
        return Transform.scale(
          scale: 0.9 + (0.1 * value),
          child: Opacity(
            opacity: value,
            child: child,
          ),
        );
      },
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          context.go('/product/${product.id}');
        },
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: const Color(0xFF667eea).withOpacity(0.1),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF667eea).withOpacity(0.08),
                blurRadius: 20,
                offset: const Offset(0, 10),
                spreadRadius: -5,
              ),
              BoxShadow(
                color: Colors.white,
                blurRadius: 20,
                offset: const Offset(-5, -5),
                spreadRadius: -5,
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
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.grey.shade50,
                          Colors.grey.shade100,
                        ],
                      ),
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                    ),
                    child: Builder(
                      builder: (context) {
                        if (product.mainImage != null && product.mainImage!.isNotEmpty) {
                          // Corriger le double "products/products" dans l'URL
                          String imageUrl = product.mainImage!;
                          if (imageUrl.contains('/products/products/')) {
                            imageUrl = imageUrl.replaceAll('/products/products/', '/products/');
                            print('🔧 URL corrigée de double products');
                          }
                          
                          // Log de l'URL finale
                          print('🗼️ Tentative de chargement image pour ${product.name}');
                          print('🔗 URL finale: $imageUrl');
                          
                          return ClipRRect(
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12),
                            ),
                            child: Image.network(
                              imageUrl,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              errorBuilder: (context, error, stackTrace) {
                                print('❌ ERREUR chargement image pour ${product.name}');
                                print('   🔗 URL tentée: $imageUrl');
                                print('   ⚠️ Type erreur: ${error.runtimeType}');
                                print('   📝 Message: $error');
                                print('   🔍 Stack trace: ${stackTrace.toString().split('\n').take(3).join('\n')}');
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
                // Badges et bouton favori
                Positioned(
                  top: 12,
                  left: 12,
                  child: product.compareAtPrice != null && product.compareAtPrice! > product.price
                      ? Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
                            ),
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFFF6B6B).withOpacity(0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            '-${((1 - product.price / product.compareAtPrice!) * 100).toInt()}%',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
                Positioned(
                  top: 12,
                  right: 12,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(50),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withOpacity(0.9),
                              Colors.white.withOpacity(0.7),
                            ],
                          ),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withOpacity(0.5),
                            width: 1.5,
                          ),
                        ),
                        child: Consumer(
                          builder: (context, ref, child) {
                            final favorites = ref.watch(favoritesProvider);
                            final isFavorite = favorites.any((p) => p.id == product.id);
                            
                            return IconButton(
                              padding: EdgeInsets.zero,
                              icon: Icon(
                                isFavorite ? FontAwesomeIcons.solidHeart : FontAwesomeIcons.heart,
                                size: 16,
                                color: isFavorite 
                                  ? const Color(0xFFFF6B6B)
                                  : const Color(0xFFFF6B6B).withOpacity(0.8),
                              ),
                              onPressed: () async {
                                HapticFeedback.lightImpact();
                                // Toggle favorite avec le product_id (String)
                                await ref.read(favoritesProvider.notifier).toggleFavorite(product.id);
                              },
                            );
                          },
                        ),
                      ),
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
                  Flexible(
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
                          Flexible(
                            child: Text(
                              product.brand!,
                              style: TextStyle(
                                fontSize: 9,
                                color: Colors.grey.shade500,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
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
                      Material(
                        borderRadius: BorderRadius.circular(50),
                        color: Colors.transparent,
                        child: InkWell(
                          borderRadius: BorderRadius.circular(50),
                          onTap: () {
                            HapticFeedback.mediumImpact();
                            ref.read(cartProvider.notifier).addItem(product, 1);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Row(
                                  children: [
                                    const Icon(FontAwesomeIcons.checkCircle, color: Colors.white, size: 20),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        '${product.name} ajouté au panier',
                                        style: const TextStyle(fontWeight: FontWeight.w600),
                                      ),
                                    ),
                                  ],
                                ),
                                duration: const Duration(seconds: 2),
                                backgroundColor: const Color(0xFF4ECDC4),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.all(20),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                elevation: 0,
                              ),
                            );
                          },
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  Color(0xFF667eea),
                                  Color(0xFF764ba2),
                                ],
                              ),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF667eea).withOpacity(0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(
                              FontAwesomeIcons.plus,
                              size: 14,
                              color: Colors.white,
                            ),
                          ),
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
