import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:ui';
import 'dart:math' as math;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/category.dart';
import '../animations/app_animations.dart';
import '../providers/categories_provider.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/app_state_view.dart';
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
  final Map<String, bool> _hoveredCategories = {};
  final Map<String, int> _productCounts = {};
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
                ? _buildLoadingState(localizations)
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
                                  _buildSearchBar(theme, localizations),
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

  Widget _buildSearchBar(ThemeData theme, AppLocalizations localizations) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? theme.colorScheme.surface.withOpacity(0.7)
                  : Colors.white.withOpacity(0.55),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: Theme.of(context).brightness == Brightness.dark
                    ? theme.dividerColor
                    : Colors.white.withOpacity(0.35),
              ),
            ),
            child: Row(
              children: [
                const Icon(FontAwesomeIcons.magnifyingGlass, size: 16),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: localizations.translate('search_category_hint'),
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
    return AppStateView(
      state: AppViewState.empty,
      animationId: AppAnimations.searchNoResult,
      title: localizations.translate('no_results'),
      subtitle: localizations.translate('try_another_keyword'),
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
                colors: Theme.of(context).brightness == Brightness.dark
                    ? [
                        Theme.of(context).colorScheme.surface.withOpacity(0.1),
                        Theme.of(context).colorScheme.surface.withOpacity(0.05),
                      ]
                    : [
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

  Future<int> _getProductCount(String categoryId) async {
    if (_productCounts.containsKey(categoryId)) {
      return _productCounts[categoryId]!;
    }
    try {
      final response = await Supabase.instance.client
          .from('products')
          .select('id')
          .eq('category_id', categoryId)
          .eq('is_active', true);
      final count = (response as List).length;
      _productCounts[categoryId] = count;
      return count;
    } catch (e) {
      return 0;
    }
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
              colors: Theme.of(context).brightness == Brightness.dark
                ? [
                    Colors.purple.shade900.withOpacity(0.3),
                    Colors.blue.shade900.withOpacity(0.3),
                    Colors.pink.shade900.withOpacity(0.3),
                  ]
                : [
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
        _buildStatsHeader(categories.length, localizations),
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
                    localizations,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatsHeader(int totalCategories, AppLocalizations localizations) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: Theme.of(context).brightness == Brightness.dark
              ? [
                  Theme.of(context).colorScheme.surface.withOpacity(0.9),
                  Theme.of(context).colorScheme.surface.withOpacity(0.7),
                ]
              : [
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
                label: localizations.translate('categories'),
                color: Colors.blue,
              ),
              _buildStatItem(
                icon: FontAwesomeIcons.fire,
                value: '12',
                label: localizations.translate('popular'),
                color: Colors.orange,
              ),
              _buildStatItem(
                icon: FontAwesomeIcons.star,
                value: '5',
                label: localizations.translate('new'),
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
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
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
    AppLocalizations localizations,
  ) {
    final color = _getCategoryColor(index);
    
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
              categoryName: category['name'] ?? localizations.translate('category'),
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
              theme.colorScheme.surface,
              theme.colorScheme.surface.withOpacity(0.95),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(isHovered ? 0.3 : 0.15),
              blurRadius: isHovered ? 25 : 20,
              offset: Offset(0, isHovered ? 8 : 10),
            ),
            if (theme.brightness != Brightness.dark)
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
                      category['name'] ?? localizations.translate('category'),
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
                    FutureBuilder<int>(
                      future: _getProductCount(category['id'].toString()),
                      builder: (context, snapshot) {
                        final count = snapshot.data ?? 0;
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: snapshot.connectionState == ConnectionState.waiting
                              ? SizedBox(
                                  width: 40,
                                  height: 14,
                                  child: LinearProgressIndicator(
                                    minHeight: 2,
                                    color: color,
                                    backgroundColor: color.withOpacity(0.2),
                                  ),
                                )
                              : Text(
                                  localizations.translateParams('products_count', {'count': count.toString()}),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: color,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        );
                      },
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

  Widget _buildLoadingState(AppLocalizations localizations) {
    return AppStateView(
      state: AppViewState.loading,
      title: localizations.translate('loading_categories'),
    );
  }

  Widget _buildEmptyState(AppLocalizations localizations) {
    return AppStateView(
      state: AppViewState.empty,
      title: localizations.translate('no_categories'),
      subtitle: localizations.translate('no_categories_hint'),
    );
  }

  Widget _buildErrorState(String error, AppLocalizations localizations, CategoriesProvider provider) {
    return AppStateView(
      state: AppViewState.error,
      title: localizations.translate('error_loading'),
      subtitle: error,
      primaryActionLabel: localizations.translate('retry'),
      onPrimaryAction: () => provider.loadCategories(),
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
