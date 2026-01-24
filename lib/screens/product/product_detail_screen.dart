import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:provider/provider.dart' as classic_provider;
import '../../providers/cart_provider.dart';
import '../../models/product.dart';
import '../../services/favorites_service.dart';
import '../../services/review_service.dart';
import '../../services/activity_tracking_service.dart';

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;
  
  const ProductDetailScreen({
    super.key,
    required this.productId,
  });

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final supabase = Supabase.instance.client;
  final PageController _pageController = PageController();
  final FavoritesService _favoritesService = FavoritesService();
  final ReviewService _reviewService = ReviewService();
  final ActivityTrackingService _tracking = ActivityTrackingService();
  
  Map<String, dynamic>? product;
  List<String> images = [];
  bool isLoading = true;
  bool isFavorite = false;
  int quantity = 1;
  List<Map<String, dynamic>> similarProducts = [];

  bool _isLoadingReviews = true;
  List<Map<String, dynamic>> _reviews = [];
  Map<String, dynamic>? _myReview;

  @override
  void initState() {
    super.initState();
    _loadProduct();
    _checkFavoriteStatus();
    _loadReviews();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _loadProduct() async {
    try {
      setState(() => isLoading = true);
      
      // Charger le produit
      final response = await supabase
          .from('products')
          .select('*, categories(name)')
          .eq('id', widget.productId)
          .single();
      
      setState(() {
        product = response;
        
        // Récupérer les images
        images = [];
        if (response['main_image'] != null) {
          images.add(response['main_image']);
        }
        if (response['images'] != null && response['images'] is List) {
          images.addAll(List<String>.from(response['images']));
        }
        if (images.isEmpty) {
          images = [''];  // Image placeholder
        }
      });
      
      // Charger les produits similaires
      if (product?['category_id'] != null) {
        _loadSimilarProducts();
      }
      
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  Future<void> _loadSimilarProducts() async {
    try {
      final response = await supabase
          .from('products')
          .select('*')
          .eq('category_id', product!['category_id'])
          .neq('id', widget.productId)
          .eq('is_active', true)
          .limit(6);
      
      setState(() {
        similarProducts = List<Map<String, dynamic>>.from(response);
      });
    } catch (e) {
      print('Erreur chargement produits similaires: $e');
    }
  }

  Future<void> _checkFavoriteStatus() async {
    final status = await _favoritesService.isFavorite(widget.productId);
    if (mounted) {
      setState(() => isFavorite = status);
    }
  }

  Future<void> _toggleFavorite() async {
    try {
      if (isFavorite) {
        await _favoritesService.removeFromFavorites(widget.productId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Retiré des favoris'),
              backgroundColor: Colors.orange,
              duration: Duration(seconds: 1),
            ),
          );
        }
      } else {
        await _favoritesService.addToFavorites(widget.productId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Ajouté aux favoris'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 1),
            ),
          );
        }
      }
      setState(() => isFavorite = !isFavorite);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _loadReviews() async {
    try {
      setState(() => _isLoadingReviews = true);
      final items = await _reviewService.getProductReviews(productId: widget.productId);
      final mine = await _reviewService.getMyReview(productId: widget.productId);
      if (!mounted) return;
      setState(() {
        _reviews = items;
        _myReview = mine;
        _isLoadingReviews = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingReviews = false);
    }
  }

  Future<void> _refreshProductReviewCounters() async {
    try {
      final res = await supabase
          .from('products')
          .select('rating, reviews_count')
          .eq('id', widget.productId)
          .single();
      if (!mounted || product == null) return;
      setState(() {
        product = {
          ...product!,
          'rating': res['rating'],
          'reviews_count': res['reviews_count'],
        };
      });
    } catch (_) {}
  }

  Future<void> _openReviewComposer() async {
    final initialRating = (_myReview?['rating'] is num)
        ? (_myReview!['rating'] as num).toDouble()
        : 5.0;
    final controller = TextEditingController(
      text: (_myReview?['comment']?.toString() ?? ''),
    );

    double selectedRating = initialRating;

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 12,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _myReview == null ? 'Laisser un avis' : 'Modifier mon avis',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              RatingBar.builder(
                initialRating: initialRating,
                minRating: 1,
                allowHalfRating: false,
                itemSize: 30,
                itemPadding: const EdgeInsets.symmetric(horizontal: 2),
                itemBuilder: (context, _) => const Icon(Icons.star, color: Colors.amber),
                onRatingUpdate: (value) => selectedRating = value,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Commentaire (optionnel)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Envoyer'),
                ),
              ),
            ],
          ),
        );
      },
    );

    if (submitted != true) return;

    try {
      await _reviewService.upsertMyReview(
        productId: widget.productId,
        rating: selectedRating.toInt(),
        comment: controller.text,
      );

      final productName = product?['name']?.toString() ?? '';
      if (productName.trim().isNotEmpty) {
        await _tracking.trackReviewPosted(widget.productId, productName, selectedRating.toInt());
      }

      await Future.wait([
        _loadReviews(),
        _refreshProductReviewCounters(),
      ]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Avis envoyé. +5 points ajoutés')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur avis: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _addToCart() async {
    try {
      if (product == null) {
        throw Exception('Produit non trouvé');
      }

      final mapped = <String, dynamic>{
        'id': product!['id']?.toString() ?? widget.productId,
        'name': product!['name'] ?? '',
        'slug': product!['slug'],
        'description': product!['description'],
        'price': (product!['price'] as num?)?.toDouble() ?? 0.0,
        'compareAtPrice': (product!['compare_at_price'] as num?)?.toDouble(),
        'sku': product!['sku'],
        'quantity': product!['quantity'] ?? 0,
        'trackQuantity': product!['track_quantity'] ?? true,
        'categoryId': product!['category_id'],
        'categoryName': (product!['categories'] is Map)
            ? (product!['categories']['name']?.toString())
            : null,
        'brand': product!['brand'],
        'mainImage': product!['main_image']?.toString(),
        'images': (product!['images'] is List)
            ? (product!['images'] as List).map((e) => e.toString()).toList()
            : <String>[],
        'specifications': product!['specifications'] ?? {},
        'tags': (product!['tags'] is List)
            ? (product!['tags'] as List).map((e) => e.toString()).toList()
            : <String>[],
        'rating': (product!['rating'] as num?)?.toDouble() ?? 0.0,
        'reviewsCount': product!['reviews_count'] ?? 0,
        'isFeatured': product!['is_featured'] ?? false,
        'isActive': product!['is_active'] ?? true,
        'createdAt': product!['created_at'],
        'updatedAt': product!['updated_at'],
      };

      final p = Product.fromJson(mapped);
      await classic_provider.Provider.of<CartProvider>(context, listen: false).addItem(p, quantity);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${product!['name']} ajouté au panier'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
            action: SnackBarAction(
              label: 'Voir le panier',
              textColor: Colors.white,
              onPressed: () => context.go('/cart'),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Scaffold(
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (product == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(
          child: Text('Produit non trouvé'),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // Image Gallery avec AppBar intégré
            SliverAppBar(
              expandedHeight: 350,
              pinned: true,
              backgroundColor: Theme.of(context).appBarTheme.backgroundColor,
              leading: IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_back, color: Colors.black),
                ),
                onPressed: () => Navigator.pop(context),
              ),
              actions: [
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isFavorite ? Icons.favorite : Icons.favorite_outline,
                      color: isFavorite ? Colors.red : Colors.black,
                    ),
                  ),
                  onPressed: _toggleFavorite,
                ),
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.share, color: Colors.black),
                  ),
                  onPressed: () {
                    // TODO: Implémenter le partage
                  },
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  children: [
                    PageView.builder(
                      controller: _pageController,
                      itemCount: images.length,
                      itemBuilder: (context, index) {
                        return _buildImageWidget(images[index]);
                      },
                    ),
                    if (images.length > 1)
                      Positioned(
                        bottom: 16,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withOpacity(0.6),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: SmoothPageIndicator(
                              controller: _pageController,
                              count: images.length,
                              effect: const WormEffect(
                                dotHeight: 8,
                                dotWidth: 8,
                                activeDotColor: Colors.white,
                                dotColor: Colors.white54,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            
            // Contenu du produit
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Catégorie
                    if (product!['categories'] != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          product!['categories']['name'],
                          style: TextStyle(
                            color: Colors.blue.shade700,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    
                    const SizedBox(height: 12),
                    
                    // Nom du produit
                    Text(
                      product!['name'] ?? '',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    const SizedBox(height: 8),

                    Row(
                      children: [
                        RatingBarIndicator(
                          rating: (product!['rating'] as num?)?.toDouble() ?? 0.0,
                          itemBuilder: (context, _) => const Icon(Icons.star, color: Colors.amber),
                          itemCount: 5,
                          itemSize: 18,
                          unratedColor: Colors.amber.withOpacity(0.25),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '(${(product!['reviews_count'] as num?)?.toInt() ?? 0})',
                          style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.w600),
                        ),
                        const Spacer(),
                        TextButton.icon(
                          onPressed: _openReviewComposer,
                          icon: const Icon(Icons.rate_review_outlined, size: 18),
                          label: Text(_myReview == null ? 'Laisser un avis' : 'Modifier'),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 8),
                    
                    // Prix et stock
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${product!['price']} FCFA',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).primaryColor,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: (product!['stock_quantity'] ?? 0) > 0
                                ? Colors.green.shade50
                                : Colors.red.shade50,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            (product!['stock_quantity'] ?? 0) > 0
                                ? 'En stock (${product!['stock_quantity']})'
                                : 'Rupture de stock',
                            style: TextStyle(
                              color: (product!['stock_quantity'] ?? 0) > 0
                                  ? Colors.green.shade700
                                  : Colors.red.shade700,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Description
                    const Text(
                      'Description',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      product!['description'] ?? 'Aucune description disponible',
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: Colors.black87,
                      ),
                    ),

                    const SizedBox(height: 24),

                    const Text(
                      'Avis',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (_isLoadingReviews)
                      const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                    else if (_reviews.isEmpty)
                      Text(
                        'Aucun avis pour le moment',
                        style: TextStyle(color: Colors.grey.shade600),
                      )
                    else
                      Column(
                        children: _reviews.take(5).map((r) {
                          final rating = (r['rating'] as num?)?.toDouble() ?? 0.0;
                          final comment = r['comment']?.toString();
                          final profiles = (r['profiles'] is Map)
                              ? Map<String, dynamic>.from(r['profiles'])
                              : null;
                          final firstName = profiles?['first_name']?.toString();
                          final lastName = profiles?['last_name']?.toString();
                          final who = ((firstName ?? '').trim().isNotEmpty || (lastName ?? '').trim().isNotEmpty)
                              ? '${(firstName ?? '').trim()} ${(lastName ?? '').trim()}'.trim()
                              : 'Client';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.grey.withOpacity(0.15)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        who,
                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                    RatingBarIndicator(
                                      rating: rating,
                                      itemBuilder: (context, _) => const Icon(Icons.star, color: Colors.amber),
                                      itemCount: 5,
                                      itemSize: 16,
                                      unratedColor: Colors.amber.withOpacity(0.25),
                                    ),
                                  ],
                                ),
                                if (comment != null && comment.trim().isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    comment.trim(),
                                    style: const TextStyle(height: 1.35),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    
                    const SizedBox(height: 24),
                    
                    // Sélecteur de quantité
                    Row(
                      children: [
                        const Text(
                          'Quantité:',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Container(
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.grey.shade300),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              IconButton(
                                icon: const Icon(Icons.remove),
                                onPressed: quantity > 1
                                    ? () => setState(() => quantity--)
                                    : null,
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                ),
                                child: Text(
                                  quantity.toString(),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.add),
                                onPressed: quantity < (product!['stock_quantity'] ?? 1)
                                    ? () => setState(() => quantity++)
                                    : null,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 32),
                    
                    // Produits similaires
                    if (similarProducts.isNotEmpty) ...[
                      const Text(
                        'Produits similaires',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 220,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: similarProducts.length,
                          itemBuilder: (context, index) {
                            final similar = similarProducts[index];
                            return GestureDetector(
                              onTap: () {
                                context.push('/product/${similar['id']}');
                              },
                              child: Container(
                                width: 140,
                                margin: const EdgeInsets.only(right: 12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      height: 140,
                                      decoration: BoxDecoration(
                                        color: Colors.grey.shade200,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: _buildImageWidget(
                                          similar['main_image'] ?? '',
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      similar['name'] ?? '',
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${similar['price']} FCFA',
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: Theme.of(context).primaryColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    
                    const SizedBox(height: 100), // Espace pour le bouton fixe
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      
      // Bouton Ajouter au panier fixe en bas
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: ElevatedButton(
            onPressed: (product!['stock_quantity'] ?? 0) > 0 ? _addToCart : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).primaryColor,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.shopping_cart, color: Colors.white),
                const SizedBox(width: 8),
                Text(
                  (product!['stock_quantity'] ?? 0) > 0
                      ? 'Ajouter au panier'
                      : 'Rupture de stock',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildImageWidget(String? imageUrl, {BoxFit fit = BoxFit.contain}) {
    if (imageUrl == null || imageUrl.isEmpty) {
      return Container(
        color: Colors.grey.shade200,
        child: Icon(
          Icons.image_not_supported,
          size: 80,
          color: Colors.grey.shade400,
        ),
      );
    }

    return Image.network(
      imageUrl,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: Colors.grey.shade200,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.shopping_bag,
                size: 60,
                color: Colors.grey.shade400,
              ),
              const SizedBox(height: 8),
              Text(
                product?['name'] ?? 'Produit',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 12,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
    );
  }
}
