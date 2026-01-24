import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:ui';
import 'dart:math' as math;
import '../models/category.dart';
import '../models/product.dart';
import '../providers/categories_provider.dart';
import '../providers/products_provider.dart' as prod_provider;
import '../widgets/adaptive_scaffold.dart';
import '../services/supabase_service.dart';
import '../localization/app_localizations.dart';
import 'products_by_category_screen.dart';

class CategoriesScreenPremium extends StatefulWidget {
  const CategoriesScreenPremium({super.key});

  @override
  State<CategoriesScreenPremium> createState() => _CategoriesScreenPremiumState();
}

class _CategoriesScreenPremiumState extends State<CategoriesScreenPremium>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _scaleController;
  late AnimationController _rotationController;
  late AnimationController _pulseController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _pulseAnimation;
  String _selectedFilter = 'all';
  final Map<String, bool> _hoveredCategories = {};
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

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
    _rotationController = AnimationController(
      duration: const Duration(seconds: 20),
      vsync: this,
    )..repeat();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeIn,
    );
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.elasticOut,
    );
    _pulseAnimation = Tween<double>(
      begin: 0.95,
      end: 1.05,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));

    _fadeController.forward();
    _scaleController.forward();

    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.trim().toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _scaleController.dispose();
    _rotationController.dispose();
    _pulseController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  IconData _getCategoryIcon(String categoryName) {
    final Map<String, IconData> categoryIcons = {
      'électronique': FontAwesomeIcons.microchip,
      'electronics': FontAwesomeIcons.microchip,
      'mode': FontAwesomeIcons.shirt,
      'fashion': FontAwesomeIcons.shirt,
      'vêtements': FontAwesomeIcons.shirt,
      'clothes': FontAwesomeIcons.shirt,
      'maison': FontAwesomeIcons.house,
      'home': FontAwesomeIcons.house,
      'jardin': FontAwesomeIcons.leaf,
      'garden': FontAwesomeIcons.leaf,
      'sport': FontAwesomeIcons.dumbbell,
      'sports': FontAwesomeIcons.dumbbell,
      'fitness': FontAwesomeIcons.dumbbell,
      'jouets': FontAwesomeIcons.gamepad,
      'toys': FontAwesomeIcons.gamepad,
      'jeux': FontAwesomeIcons.gamepad,
      'games': FontAwesomeIcons.gamepad,
      'beauté': FontAwesomeIcons.spa,
      'beauty': FontAwesomeIcons.spa,
      'cosmétiques': FontAwesomeIcons.spa,
      'cosmetics': FontAwesomeIcons.spa,
      'livres': FontAwesomeIcons.book,
      'books': FontAwesomeIcons.book,
      'nourriture': FontAwesomeIcons.utensils,
      'food': FontAwesomeIcons.utensils,
      'alimentation': FontAwesomeIcons.utensils,
      'musique': FontAwesomeIcons.music,
      'music': FontAwesomeIcons.music,
      'auto': FontAwesomeIcons.car,
      'car': FontAwesomeIcons.car,
      'automobile': FontAwesomeIcons.car,
      'bébé': FontAwesomeIcons.baby,
      'baby': FontAwesomeIcons.baby,
      'enfants': FontAwesomeIcons.child,
      'kids': FontAwesomeIcons.child,
      'santé': FontAwesomeIcons.heartPulse,
      'health': FontAwesomeIcons.heartPulse,
      'bijoux': FontAwesomeIcons.gem,
      'jewelry': FontAwesomeIcons.gem,
      'chaussures': FontAwesomeIcons.shoePrints,
      'shoes': FontAwesomeIcons.shoePrints,
      'sacs': FontAwesomeIcons.bagShopping,
      'bags': FontAwesomeIcons.bagShopping,
      'montres': FontAwesomeIcons.clock,
      'watches': FontAwesomeIcons.clock,
      'bureau': FontAwesomeIcons.briefcase,
      'office': FontAwesomeIcons.briefcase,
      'outils': FontAwesomeIcons.wrench,
      'tools': FontAwesomeIcons.wrench,
      'animaux': FontAwesomeIcons.paw,
      'pets': FontAwesomeIcons.paw,
      'voyage': FontAwesomeIcons.plane,
      'travel': FontAwesomeIcons.plane,
    };

    final lowerName = categoryName.toLowerCase();
    for (var entry in categoryIcons.entries) {
      if (lowerName.contains(entry.key)) {
        return entry.value;
      }
    }
    return FontAwesomeIcons.boxOpen;
  }

  Color _getCategoryColor(int index) {
    final colors = [
      Colors.blue,
      Colors.purple,
      Colors.pink,
      Colors.orange,
      Colors.green,
      Colors.teal,
      Colors.indigo,
      Colors.red,
      Colors.amber,
      Colors.cyan,
    ];
    return colors[index % colors.length];
  }

  String _fixImageUrl(String url) {
    // Correction des URLs avec double "/categories/categories/"
    if (url.contains('/categories/categories/')) {
      url = url.replaceAll('/categories/categories/', '/categories/');
    }
    
    // Si l'URL est relative, ajouter le domaine Supabase
    if (!url.startsWith('http')) {
      final supabaseUrl = 'https://uvlrgwdbjegoavjfdrzb.supabase.co';
      if (url.startsWith('/')) {
        url = '$supabaseUrl$url';
      } else {
        url = '$supabaseUrl/$url';
      }
    }
    
    return url;
  }

  @override
  Widget build(BuildContext context) {
    final categoriesProvider = Provider.of<CategoriesProvider>(context);
    final categories = categoriesProvider.categories;
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);

    final filteredCategories = _searchQuery.isEmpty
        ? categories
        : categories.where((c) {
            final name = (c['name'] ?? '').toString().toLowerCase();
            final desc = (c['description'] ?? '').toString().toLowerCase();
            return name.contains(_searchQuery) || desc.contains(_searchQuery);
          }).toList();

    return AdaptiveScaffold(
      currentIndex: 1,
      extendBodyBehindAppBar: true,
      appBar: _buildAppBar(context, localizations),
      body: Stack(
        children: [
          // Animated gradient background
          _buildAnimatedBackground(),
          // Main content
          SafeArea(
            child: categoriesProvider.isLoading
                ? _buildLoadingState()
                : (categoriesProvider.error != null)
                    ? _buildErrorState(categoriesProvider.error!, localizations, categoriesProvider)
                    : RefreshIndicator(
                        onRefresh: () => categoriesProvider.loadCategories(),
                        child: categories.isEmpty
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  const SizedBox(height: 80),
                                  _buildEmptyState(localizations),
                                ],
                              )
                            : Column(
                                children: [
                                  _buildSearchBar(theme),
                                  Expanded(
                                    child: filteredCategories.isEmpty
                                        ? ListView(
                                            physics: const AlwaysScrollableScrollPhysics(),
                                            padding: const EdgeInsets.all(24),
                                            children: [
                                              const SizedBox(height: 40),
                                              _buildNoResultsState(localizations),
                                            ],
                                          )
                                        : _buildCategoriesGrid(filteredCategories, localizations, theme),
                                  ),
                                ],
                              ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.55),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withOpacity(0.35)),
            ),
            child: Row(
              children: [
                const Icon(FontAwesomeIcons.magnifyingGlass, size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      hintText: 'Rechercher une catégorie…',
                      border: InputBorder.none,
                      isDense: true,
                    ),
                  ),
                ),
                if (_searchQuery.isNotEmpty)
                  IconButton(
                    onPressed: () {
                      _searchController.clear();
                    },
                    icon: const Icon(Icons.close),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNoResultsState(AppLocalizations localizations) {
    return Center(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.grey.shade50,
            ),
            child: Icon(FontAwesomeIcons.magnifyingGlass, size: 34, color: Colors.grey.shade500),
          ),
          const SizedBox(height: 14),
          const Text(
            'Aucun résultat',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            'Essaie un autre mot-clé.',
            style: TextStyle(color: Colors.grey.shade700, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
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
          const Icon(FontAwesomeIcons.grip, size: 20),
          const SizedBox(width: 12),
          Text(
            localizations.translate('categories'),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
      actions: [
        _buildFilterButton(),
        const SizedBox(width: 16),
      ],
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

  Widget _buildFilterButton() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            HapticFeedback.lightImpact();
            _showFilterDialog();
          },
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                const Icon(FontAwesomeIcons.filter, size: 14),
                const SizedBox(width: 6),
                Text(
                  'Filtrer',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showFilterDialog() {
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
                  'Filtrer les catégories',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                _buildFilterOption('Toutes', 'all'),
                _buildFilterOption('Populaires', 'popular'),
                _buildFilterOption('Nouveautés', 'new'),
                _buildFilterOption('Promotions', 'sale'),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Annuler'),
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).primaryColor,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Appliquer'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterOption(String label, String value) {
    return RadioListTile<String>(
      title: Text(label),
      value: value,
      groupValue: _selectedFilter,
      onChanged: (newValue) {
        setState(() {
          _selectedFilter = newValue!;
        });
      },
      activeColor: Theme.of(context).primaryColor,
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
                Colors.purple.shade50,
                Colors.blue.shade50,
                Colors.pink.shade50,
              ],
              transform: GradientRotation(_rotationController.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            painter: CategoryMeshGradientPainter(_rotationController.value),
            child: Container(),
          ),
        );
      },
    );
  }

  Widget _buildCategoriesGrid(List<dynamic> categories, AppLocalizations localizations, ThemeData theme) {
    return Column(
      children: [
        // Header with stats
        _buildStatsHeader(categories.length),
        // Categories grid
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 1.0,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final category = categories[index];
              final categoryKey = 'category_${category['id']}';
              final isHovered = _hoveredCategories[categoryKey] ?? false;
              
              return FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: _buildCategoryCard(
                    category,
                    index,
                    isHovered,
                    categoryKey,
                    theme,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatsHeader(int totalCategories) {
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
              _buildStatItem(
                icon: FontAwesomeIcons.boxOpen,
                value: '$totalCategories',
                label: 'Catégories',
                color: Colors.blue,
              ),
              _buildStatItem(
                icon: FontAwesomeIcons.fire,
                value: '12',
                label: 'Populaires',
                color: Colors.orange,
              ),
              _buildStatItem(
                icon: FontAwesomeIcons.star,
                value: '5',
                label: 'Nouveautés',
                color: Colors.purple,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String value,
    required String label,
    required Color color,
  }) {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Transform.scale(
          scale: _pulseAnimation.value,
          child: Column(
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
          ),
        );
      },
    );
  }

  Widget _buildCategoryCard(
    dynamic category,
    int index,
    bool isHovered,
    String categoryKey,
    ThemeData theme,
  ) {
    final color = _getCategoryColor(index);
    // TODO: Load products by category
    final products = <Product>[];
    
    return GestureDetector(
      onTapDown: (_) {
        setState(() => _hoveredCategories[categoryKey] = true);
        HapticFeedback.lightImpact();
      },
      onTapUp: (_) {
        setState(() => _hoveredCategories[categoryKey] = false);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ProductsByCategoryScreen(
              categoryId: category['id'].toString(),
              categoryName: category['name'] ?? 'Catégorie',
            ),
          ),
        );
      },
      onTapCancel: () {
        setState(() => _hoveredCategories[categoryKey] = false);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        transform: Matrix4.identity()
          ..scale(isHovered ? 0.95 : 1.0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.white,
              Colors.white.withOpacity(0.95),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(isHovered ? 0.3 : 0.15),
              blurRadius: isHovered ? 25 : 20,
              offset: Offset(0, isHovered ? 8 : 10),
            ),
            BoxShadow(
              color: Colors.white,
              blurRadius: 20,
              offset: const Offset(-5, -5),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Stack(
            children: [
              // Gradient overlay
              Positioned(
                top: -30,
                right: -30,
                child: Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        color.withOpacity(0.3),
                        color.withOpacity(0.0),
                      ],
                    ),
                  ),
                ),
              ),
              // Content
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Category image or icon
                    Flexible(
                      child: Container(
                        width: 80,
                        height: 80,
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
                        boxShadow: [
                          BoxShadow(
                            color: color.withOpacity(0.2),
                            blurRadius: 15,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: FaIcon(
                          _getCategoryIcon(category['icon'] ?? category['name'] ?? 'default'),
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    ),
                    const SizedBox(height: 8),
                    // Category name
                    Text(
                      category['name'] ?? 'Catégorie',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: theme.textTheme.bodyLarge?.color,
                      ),
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '0 produits',  // TODO: Load actual count
                        style: TextStyle(
                          fontSize: 12,
                          color: color,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Shine effect
              if (isHovered)
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.white.withOpacity(0.0),
                          Colors.white.withOpacity(0.1),
                          Colors.white.withOpacity(0.0),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
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
          const SizedBox(height: 24),
          const Text(
            'Chargement des catégories...',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(AppLocalizations localizations) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.grey.shade50,
              ),
              child: Icon(
                FontAwesomeIcons.folderOpen,
                size: 48,
                color: Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Aucune catégorie',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Vous n\'avez aucune catégorie pour le moment.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String error, AppLocalizations localizations, CategoriesProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.red.shade50,
              ),
              child: Icon(
                FontAwesomeIcons.triangleExclamation,
                size: 48,
                color: Colors.red.shade400,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Erreur de chargement',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                provider.loadCategories();
              },
              icon: const Icon(FontAwesomeIcons.arrowRotateRight, size: 16),
              label: const Text('Réessayer'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).primaryColor,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Custom painter for mesh gradient background
class CategoryMeshGradientPainter extends CustomPainter {
  final double animation;

  CategoryMeshGradientPainter(this.animation);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.purple.withOpacity(0.05),
          Colors.blue.withOpacity(0.05),
          Colors.pink.withOpacity(0.05),
        ],
        transform: GradientRotation(animation * 2 * math.pi),
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    // Draw animated mesh circles
    for (int i = 0; i < 3; i++) {
      final offset = Offset(
        size.width * (0.2 + i * 0.3) * (1 + 0.1 * math.sin(animation * 2 * math.pi + i)),
        size.height * (0.3 + i * 0.2) * (1 + 0.1 * math.cos(animation * 2 * math.pi + i)),
      );
      canvas.drawCircle(
        offset,
        size.width * 0.2 * (1 + 0.1 * math.sin(animation * 2 * math.pi + i)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(CategoryMeshGradientPainter oldDelegate) => true;
}
