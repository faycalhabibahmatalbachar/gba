import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import '../models/product.dart';
import '../services/supabase_service.dart';
import '../services/review_service.dart';
import '../services/activity_tracking_service.dart';
import '../providers/cart_provider.dart';
import '../providers/favorites_provider.dart';
import 'dart:ui';

class ProductDetailScreen extends ConsumerStatefulWidget {
  final String productId;
  
  const ProductDetailScreen({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> with TickerProviderStateMixin {
  int quantity = 1;
  Product? product;
  bool isLoading = true;
  late AnimationController _scaleController;
  late AnimationController _fadeController;

  final ReviewService _reviewService = ReviewService();
  final ActivityTrackingService _tracking = ActivityTrackingService();
  bool _isLoadingReviews = true;
  List<Map<String, dynamic>> _reviews = [];
  Map<String, dynamic>? _myReview;

  @override
  void initState() {
    super.initState();
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _loadProduct();
  }

  @override
  void dispose() {
    _scaleController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  Future<void> _loadProduct() async {
    try {
      final result = await SupabaseService.client
          .from('products')
          .select('*, categories(name)')
          .eq('id', widget.productId)
          .single();

      final categoryName = (result['categories'] is Map)
          ? (result['categories']['name']?.toString())
          : null;

      final productJson = {
        'id': result['id'],
        'name': result['name'],
        'slug': result['slug'] ?? result['name'].toString().toLowerCase().replaceAll(' ', '-'),
        'description': result['description'],
        'price': result['price'],
        'compareAtPrice': result['compare_at_price'],
        'sku': result['sku'],
        'quantity': result['quantity'] ?? 0,
        'trackQuantity': result['track_quantity'] ?? true,
        'categoryId': result['category_id'],
        'categoryName': categoryName,
        'brand': result['brand'],
        'mainImage': result['main_image'],
        'images': result['images'] ?? [],
        'specifications': result['specifications'] ?? {},
        'tags': result['tags'] ?? [],
        'rating': (result['rating'] ?? 0.0),
        'reviewsCount': (result['reviews_count'] ?? 0),
        'isFeatured': result['is_featured'] ?? false,
        'isActive': result['is_active'] ?? true,
        'createdAt': result['created_at'],
        'updatedAt': result['updated_at'],
      };
      
      setState(() {
        product = Product.fromJson(productJson);
        isLoading = false;
      });
      _fadeController.forward();

      await _loadReviews();
    } catch (e) {
      print('Error loading product: $e');
      setState(() {
        isLoading = false;
      });
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
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoadingReviews = false);
    }
  }

  Future<void> _refreshProductRatingCounters() async {
    try {
      final res = await SupabaseService.client
          .from('products')
          .select('rating, reviews_count')
          .eq('id', widget.productId)
          .single();
      final rating = (res['rating'] as num?)?.toDouble() ?? 0.0;
      final count = (res['reviews_count'] as num?)?.toInt() ?? 0;
      if (!mounted || product == null) return;
      setState(() {
        product = product!.copyWith(rating: rating, reviewsCount: count);
      });
    } catch (_) {}
  }

  Future<void> _openReviewComposer() async {
    if (product == null) return;

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

      await _tracking.trackReviewPosted(widget.productId, product!.name, selectedRating.toInt());

      await Future.wait([
        _loadReviews(),
        _refreshProductRatingCounters(),
      ]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Avis envoyé. +5 points ajoutés'),
            behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur avis: $e'),
            backgroundColor: Colors.red,
            behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final favorites = ref.watch(favoritesProvider);
    final isFavorite = product != null && favorites.isFavorite(product!.id);
    final theme = Theme.of(context);
    
    if (isLoading) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
              ),
              const SizedBox(height: 16),
              Text(
                'Chargement du produit...',
                style: TextStyle(color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      );
    }

    if (product == null) {
      return Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                FontAwesomeIcons.triangleExclamation,
                size: 64,
                color: Colors.red[400],
              ),
              const SizedBox(height: 16),
              const Text(
                'Produit non trouvé',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Le produit demandé n\'existe pas',
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(FontAwesomeIcons.arrowLeft, size: 16),
                label: const Text('Retour'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(25),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 400,
            pinned: true,
            backgroundColor: theme.scaffoldBackgroundColor,
            elevation: 0,
            leading: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.9),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: const Icon(FontAwesomeIcons.arrowLeft, size: 20),
                onPressed: () => Navigator.pop(context),
                color: Colors.black87,
              ),
            ),
            actions: [
              Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.9),
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  icon: Icon(
                    isFavorite ? FontAwesomeIcons.solidHeart : FontAwesomeIcons.heart,
                    size: 20,
                    color: isFavorite ? Colors.red : Colors.black87,
                  ),
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    ref.read(favoritesProvider).toggleFavorite(product!.id);
                    _scaleController.forward().then((_) {
                      _scaleController.reverse();
                    });
                  },
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Hero(
                tag: 'product-${product!.id}',
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Colors.grey.shade200,
                        Colors.grey.shade300,
                      ],
                    ),
                  ),
                  child: product!.mainImage != null
                      ? Image.network(
                          product!.mainImage!,
                          fit: BoxFit.cover,
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Center(
                              child: CircularProgressIndicator(
                                value: loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded /
                                        loadingProgress.expectedTotalBytes!
                                    : null,
                                valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
                              ),
                            );
                          },
                          errorBuilder: (context, error, stackTrace) {
                            print('Error loading image: $error');
                            return Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    FontAwesomeIcons.imagePortrait,
                                    size: 80,
                                    color: Colors.grey[400],
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    'Image non disponible',
                                    style: TextStyle(color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                            );
                          },
                        )
                      : Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                FontAwesomeIcons.boxOpen,
                                size: 80,
                                color: Colors.grey[400],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'Pas d\'image',
                                style: TextStyle(color: Colors.grey[600]),
                              ),
                            ],
                          ),
                        ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: FadeTransition(
              opacity: _fadeController,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, -5),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Product Name & Brand
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  product!.name,
                                  style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    height: 1.2,
                                  ),
                                ),
                                if (product!.brand != null && product!.brand!.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    product!.brand!,
                                    style: TextStyle(
                                      fontSize: 16,
                                      color: Colors.grey[600],
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                      
                      const SizedBox(height: 20),

                      Row(
                        children: [
                          RatingBarIndicator(
                            rating: product!.rating,
                            itemBuilder: (context, _) => const Icon(Icons.star, color: Colors.amber),
                            itemCount: 5,
                            itemSize: 18,
                            unratedColor: Colors.amber.withOpacity(0.25),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${product!.rating.toStringAsFixed(1)} (${product!.reviewsCount})',
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
                      
                      // Price Section
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              theme.primaryColor.withOpacity(0.1),
                              theme.primaryColor.withOpacity(0.05),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Prix',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      '€${product!.price.toStringAsFixed(2)}',
                                      style: TextStyle(
                                        fontSize: 28,
                                        fontWeight: FontWeight.bold,
                                        color: theme.primaryColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (product!.quantity > 0)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: product!.quantity > 0 ? Colors.green : Colors.red,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      product!.quantity > 0 
                                        ? FontAwesomeIcons.circleCheck 
                                        : FontAwesomeIcons.circleXmark,
                                      size: 10,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(width: 3),
                                    Flexible(
                                      child: FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Text(
                                          product!.quantity > 0 ? 'En stock' : 'Rupture',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 10,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                      
                      // Description
                      if (product!.description != null && product!.description!.isNotEmpty) ...[
                        const SizedBox(height: 24),
                        Text(
                          'Description',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[800],
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          product!.description!,
                          style: TextStyle(
                            fontSize: 15,
                            height: 1.6,
                            color: Colors.grey[700],
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 32),

                      Text(
                        'Avis',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[800],
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (_isLoadingReviews)
                        const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()))
                      else if (_reviews.isEmpty)
                        Text(
                          'Aucun avis pour le moment',
                          style: TextStyle(color: Colors.grey[600]),
                        )
                      else
                        Column(
                          children: _reviews.take(5).map((r) {
                            final rating = (r['rating'] as num?)?.toDouble() ?? 0.0;
                            final comment = r['comment']?.toString();
                            final profiles = (r['profiles'] is Map) ? Map<String, dynamic>.from(r['profiles']) : null;
                            final firstName = profiles?['first_name']?.toString();
                            final lastName = profiles?['last_name']?.toString();
                            final who = ((firstName ?? '').trim().isNotEmpty || (lastName ?? '').trim().isNotEmpty)
                                ? '${(firstName ?? '').trim()} ${(lastName ?? '').trim()}'.trim()
                                : 'Client';

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.grey[50],
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
                                      style: TextStyle(color: Colors.grey[800], height: 1.35),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }).toList(),
                        ),

                      // Quantity Selector
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.grey[100],
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: Row(
                          children: [
                            Text(
                              'Quantité',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey[800],
                              ),
                            ),
                            const Spacer(),
                            Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(25),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.grey.withOpacity(0.2),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Row(
                                children: [
                                  IconButton(
                                    onPressed: quantity > 1
                                        ? () {
                                            HapticFeedback.lightImpact();
                                            setState(() => quantity--);
                                          }
                                        : null,
                                    icon: Icon(
                                      FontAwesomeIcons.minus,
                                      size: 16,
                                      color: quantity > 1 ? theme.primaryColor : Colors.grey[400],
                                    ),
                                  ),
                                  Container(
                                    constraints: const BoxConstraints(minWidth: 40),
                                    child: Text(
                                      quantity.toString(),
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    onPressed: () {
                                      HapticFeedback.lightImpact();
                                      setState(() => quantity++);
                                    },
                                    icon: Icon(
                                      FontAwesomeIcons.plus,
                                      size: 16,
                                      color: theme.primaryColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // Add to Cart Button
                      ScaleTransition(
                        scale: Tween<double>(begin: 1.0, end: 0.95).animate(_scaleController),
                        child: SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: product!.quantity > 0
                                ? () async {
                                    HapticFeedback.mediumImpact();
                                    _scaleController.forward().then((_) {
                                      _scaleController.reverse();
                                    });
                                    
                                    await ref.read(cartProvider).addItem(product!, quantity);
                                    
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Row(
                                          children: [
                                            const Icon(
                                              FontAwesomeIcons.cartShopping, 
                                              color: Colors.white, 
                                              size: 16,
                                            ),
                                            const SizedBox(width: 12),
                                            Text('$quantity x ${product!.name} ajouté au panier'),
                                          ],
                                        ),
                                        backgroundColor: Colors.green,
                                        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  }
                                : null,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: theme.primaryColor,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(15),
                              ),
                              elevation: 3,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(FontAwesomeIcons.cartPlus, size: 20),
                                const SizedBox(width: 12),
                                const Text(
                                  'Ajouter au panier',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '€${(product!.price * quantity).toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
