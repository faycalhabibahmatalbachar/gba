import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/categories_provider.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/app_state_view.dart';
import '../localization/app_localizations.dart';
import 'products_by_category_screen.dart';

const _kAccent = Color(0xFF667eea);

class CategoriesScreenPremium extends StatefulWidget {
  const CategoriesScreenPremium({super.key});

  @override
  State<CategoriesScreenPremium> createState() => _CategoriesScreenPremiumState();
}

class _CategoriesScreenPremiumState extends State<CategoriesScreenPremium> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _fixImageUrl(String url) {
    if (url.contains('/categories/categories/')) {
      url = url.replaceAll('/categories/categories/', '/categories/');
    }
    if (!url.startsWith('http')) {
      const base = 'https://uvlrgwdbjegoavjfdrzb.supabase.co';
      url = url.startsWith('/') ? '$base$url' : '$base/$url';
    }
    return url;
  }

  IconData _getCategoryIcon(String name) {
    final m = <String, IconData>{
      'électronique': Icons.memory_rounded, 'electronics': Icons.memory_rounded,
      'mode': Icons.checkroom_rounded, 'fashion': Icons.checkroom_rounded,
      'vêtements': Icons.checkroom_rounded, 'clothes': Icons.checkroom_rounded,
      'maison': Icons.home_rounded, 'home': Icons.home_rounded,
      'jardin': Icons.park_rounded, 'garden': Icons.park_rounded,
      'sport': Icons.fitness_center_rounded, 'sports': Icons.fitness_center_rounded,
      'jouets': Icons.toys_rounded, 'toys': Icons.toys_rounded,
      'jeux': Icons.sports_esports_rounded, 'games': Icons.sports_esports_rounded,
      'beauté': Icons.spa_rounded, 'beauty': Icons.spa_rounded,
      'cosmétiques': Icons.spa_rounded, 'cosmetics': Icons.spa_rounded,
      'livres': Icons.menu_book_rounded, 'books': Icons.menu_book_rounded,
      'nourriture': Icons.restaurant_rounded, 'food': Icons.restaurant_rounded,
      'alimentation': Icons.restaurant_rounded,
      'musique': Icons.music_note_rounded, 'music': Icons.music_note_rounded,
      'auto': Icons.directions_car_rounded, 'automobile': Icons.directions_car_rounded,
      'bébé': Icons.child_friendly_rounded, 'baby': Icons.child_friendly_rounded,
      'enfants': Icons.child_care_rounded, 'kids': Icons.child_care_rounded,
      'santé': Icons.health_and_safety_rounded, 'health': Icons.health_and_safety_rounded,
      'bijoux': Icons.diamond_rounded, 'jewelry': Icons.diamond_rounded,
      'chaussures': Icons.ice_skating_rounded, 'shoes': Icons.ice_skating_rounded,
      'sacs': Icons.shopping_bag_rounded, 'bags': Icons.shopping_bag_rounded,
      'montres': Icons.watch_rounded, 'watches': Icons.watch_rounded,
      'bureau': Icons.business_center_rounded, 'office': Icons.business_center_rounded,
      'outils': Icons.build_rounded, 'tools': Icons.build_rounded,
      'animaux': Icons.pets_rounded, 'pets': Icons.pets_rounded,
      'voyage': Icons.flight_rounded, 'travel': Icons.flight_rounded,
    };
    final lower = name.toLowerCase();
    for (final e in m.entries) {
      if (lower.contains(e.key)) return e.value;
    }
    return Icons.category_rounded;
  }

  static const _cardGradients = <List<Color>>[
    [Color(0xFF667eea), Color(0xFF764ba2)],
    [Color(0xFFf093fb), Color(0xFFf5576c)],
    [Color(0xFF4facfe), Color(0xFF00f2fe)],
    [Color(0xFF43e97b), Color(0xFF38f9d7)],
    [Color(0xFFfa709a), Color(0xFFfee140)],
    [Color(0xFF7f00ff), Color(0xFFe100ff)],
    [Color(0xFFfc5c7d), Color(0xFF6a82fb)],
    [Color(0xFFffecd2), Color(0xFFfcb69f)],
    [Color(0xFFa18cd1), Color(0xFFfbc2eb)],
    [Color(0xFF89f7fe), Color(0xFF66a6ff)],
  ];

  @override
  Widget build(BuildContext context) {
    final prov = Provider.of<CategoriesProvider>(context);
    final categories = prov.categories;
    final l = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final filtered = _searchQuery.isEmpty
        ? categories
        : categories.where((c) {
            final n = (c['name'] ?? '').toString().toLowerCase();
            final d = (c['description'] ?? '').toString().toLowerCase();
            return n.contains(_searchQuery) || d.contains(_searchQuery);
          }).toList();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0f0f1a) : const Color(0xFFF5F6FA),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: Text(
          l.translate('categories'),
          style: GoogleFonts.poppins(fontSize: 22, fontWeight: FontWeight.w700),
        ),
      ),
      body: prov.isLoading && categories.isEmpty
          ? _buildShimmerGrid(isDark)
          : (prov.error != null && categories.isEmpty)
              ? _buildErrorState(prov.error!, l, prov)
              : RefreshIndicator(
                  color: _kAccent,
                  onRefresh: () async {
                    await prov.loadCategories(force: true);
                  },
                  child: categories.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [const SizedBox(height: 80), _buildEmptyState(l)],
                        )
                      : CustomScrollView(
                          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                          slivers: [
                            SliverToBoxAdapter(child: _buildSearchBar(l, isDark)),
                            if (filtered.isEmpty)
                              SliverFillRemaining(
                                hasScrollBody: false,
                                child: AppStateView(
                                  state: AppViewState.empty,
                                  title: l.translate('no_results'),
                                  subtitle: l.translate('try_another_keyword'),
                                ),
                              )
                            else
                              SliverPadding(
                                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                                sliver: SliverGrid(
                                  delegate: SliverChildBuilderDelegate(
                                    (ctx, i) => _buildCategoryCard(filtered[i], i, l, isDark, prov),
                                    childCount: filtered.length,
                                  ),
                                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 2,
                                    childAspectRatio: 0.82,
                                    crossAxisSpacing: 14,
                                    mainAxisSpacing: 14,
                                  ),
                                ),
                              ),
                          ],
                        ),
                ),
    );
  }

  Widget _buildSearchBar(AppLocalizations l, bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: isDark
              ? []
              : [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: TextField(
          controller: _searchController,
          style: TextStyle(color: isDark ? Colors.white : Colors.black87, fontSize: 14),
          decoration: InputDecoration(
            hintText: l.translate('search_category_hint'),
            hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.grey.shade400, fontSize: 14),
            prefixIcon: Icon(Icons.search_rounded, color: isDark ? Colors.white38 : Colors.grey.shade400, size: 20),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: Icon(Icons.close_rounded, size: 18, color: isDark ? Colors.white38 : Colors.grey.shade400),
                    onPressed: () => _searchController.clear(),
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ),
    ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.1, end: 0, curve: Curves.easeOut);
  }

  Widget _buildCategoryCard(dynamic category, int index, AppLocalizations l, bool isDark, CategoriesProvider prov) {
    final name = (category['name'] ?? l.translate('category')).toString();
    final imageUrl = category['image_url']?.toString();
    final catId = category['id']?.toString() ?? '';
    final gradient = _cardGradients[index % _cardGradients.length];
    final hasImage = imageUrl != null && imageUrl.isNotEmpty;

    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductsByCategoryScreen(
              categoryId: catId,
              categoryName: name,
            ),
          ),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          boxShadow: [
            BoxShadow(
              color: gradient[0].withOpacity(isDark ? 0.2 : 0.25),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background: image or gradient
              if (hasImage)
                CachedNetworkImage(
                  imageUrl: _fixImageUrl(imageUrl),
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: gradient,
                      ),
                    ),
                  ),
                  errorWidget: (_, __, ___) => Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: gradient,
                      ),
                    ),
                    child: Center(
                      child: Icon(_getCategoryIcon(name), size: 48, color: Colors.white.withOpacity(0.7)),
                    ),
                  ),
                )
              else
                Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: gradient,
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      _getCategoryIcon(name),
                      size: 52,
                      color: Colors.white.withOpacity(0.35),
                    ),
                  ),
                ),
              // Dark overlay for text readability
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.15),
                      Colors.black.withOpacity(0.65),
                    ],
                    stops: const [0.0, 0.4, 1.0],
                  ),
                ),
              ),
              // Top-right icon badge
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _getCategoryIcon(name),
                    size: 18,
                    color: Colors.white,
                  ),
                ),
              ),
              // Bottom text content
              Positioned(
                left: 14,
                right: 14,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.poppins(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1.2,
                        shadows: [Shadow(color: Colors.black.withOpacity(0.3), blurRadius: 4)],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(duration: 400.ms, delay: (60 * index).ms).slideY(begin: 0.08, end: 0, curve: Curves.easeOutCubic);
  }

  Widget _buildShimmerGrid(bool isDark) {
    final baseColor = isDark ? Colors.white.withOpacity(0.06) : Colors.grey.shade200;
    final highlightColor = isDark ? Colors.white.withOpacity(0.12) : Colors.grey.shade100;
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, childAspectRatio: 0.82, crossAxisSpacing: 14, mainAxisSpacing: 14,
      ),
      itemCount: 6,
      itemBuilder: (_, i) => Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          color: baseColor,
        ),
      ).animate(onPlay: (c) => c.repeat(reverse: true)).shimmer(
        duration: 1200.ms,
        color: highlightColor,
      ),
    );
  }

  Widget _buildEmptyState(AppLocalizations l) {
    return AppStateView(
      state: AppViewState.empty,
      title: l.translate('no_categories'),
      subtitle: l.translate('no_categories_hint'),
    );
  }

  Widget _buildErrorState(String error, AppLocalizations l, CategoriesProvider prov) {
    return AppStateView(
      state: AppViewState.error,
      title: l.translate('error_loading'),
      subtitle: error,
      primaryActionLabel: l.translate('retry'),
      onPrimaryAction: () => prov.loadCategories(),
    );
  }
}
