import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../localization/app_localizations.dart';
import '../../models/product.dart';
import '../../providers/cart_provider.dart';
import '../../providers/categories_provider.dart';
import '../../services/activity_tracking_service.dart';
import '../../widgets/product_card_premium.dart';

class ProductSearchScreen extends ConsumerStatefulWidget {
  final String? initialQuery;
  const ProductSearchScreen({super.key, this.initialQuery});

  @override
  ConsumerState<ProductSearchScreen> createState() => _ProductSearchScreenState();
}

class _ProductSearchScreenState extends ConsumerState<ProductSearchScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final _supabase = Supabase.instance.client;

  Timer? _debounce;
  List<Product> _results = [];
  bool _isLoading = false;
  bool _hasSearched = false;

  // Filters
  String? _selectedCategoryId;
  String? _selectedCategoryName;
  double _minPrice = 0;
  double _maxPrice = 1000000;
  double _minRating = 0;
  bool _showFilters = false;

  // Search history
  static const _historyKey = 'search_history_v1';
  List<String> _history = [];

  late AnimationController _filterAnimController;
  late Animation<double> _filterHeightAnim;

  @override
  void initState() {
    super.initState();
    _filterAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _filterHeightAnim = CurvedAnimation(
      parent: _filterAnimController,
      curve: Curves.easeInOutCubic,
    );

    if (widget.initialQuery != null && widget.initialQuery!.isNotEmpty) {
      _searchController.text = widget.initialQuery!;
      _doSearch(widget.initialQuery!);
    }
    _loadHistory();

    // Auto-focus
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    _filterAnimController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      setState(() {
        _history = prefs.getStringList(_historyKey) ?? [];
      });
    } catch (_) {}
  }

  Future<void> _saveToHistory(String query) async {
    if (query.trim().isEmpty) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final history = prefs.getStringList(_historyKey) ?? [];
      history.remove(query);
      history.insert(0, query);
      final limited = history.take(8).toList();
      await prefs.setStringList(_historyKey, limited);
      setState(() => _history = limited);
    } catch (_) {}
  }

  Future<void> _clearHistory() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_historyKey);
      setState(() => _history = []);
    } catch (_) {}
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    if (value.trim().isEmpty) {
      setState(() {
        _results = [];
        _hasSearched = false;
        _isLoading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _doSearch(value.trim());
    });
  }

  Future<void> _doSearch(String query, {bool saveHistory = false}) async {
    if (query.trim().isEmpty && !_hasActiveFilters) return;
    setState(() {
      _isLoading = true;
      _hasSearched = true;
    });

    try {
      var q = _supabase
          .from('products')
          .select('*, categories(name)')
          .eq('is_active', true);

      if (query.trim().isNotEmpty) {
        q = q.or('name.ilike.%$query%,description.ilike.%$query%');
      }

      if (_selectedCategoryId != null) {
        q = q.eq('category_id', _selectedCategoryId!);
      }
      if (_minRating > 0) {
        q = q.gte('rating', _minRating);
      }

      final response = await q
          .gte('price', _minPrice)
          .lte('price', _maxPrice)
          .order('rating', ascending: false)
          .limit(40);

      final products = (response as List).map((json) {
        if (json['categories'] is Map) {
          json['categoryName'] = json['categories']['name'];
        }
        final mapped = {
          'id': json['id'],
          'name': json['name'],
          'slug': json['slug'],
          'description': json['description'],
          'price': (json['price'] as num?)?.toDouble() ?? 0.0,
          'compareAtPrice': (json['compare_at_price'] as num?)?.toDouble(),
          'sku': json['sku'],
          'quantity': json['quantity'] ?? 0,
          'trackQuantity': json['track_quantity'] ?? true,
          'categoryId': json['category_id'],
          'categoryName': json['categoryName'],
          'brand': json['brand'],
          'mainImage': json['main_image'],
          'images': json['images'] ?? [],
          'specifications': json['specifications'] ?? {},
          'tags': json['tags'] ?? [],
          'rating': (json['rating'] as num?)?.toDouble() ?? 0.0,
          'reviewsCount': json['reviews_count'] ?? 0,
          'isFeatured': json['is_featured'] ?? false,
          'isActive': json['is_active'] ?? true,
          'createdAt': json['created_at'],
          'updatedAt': json['updated_at'],
        };
        return Product.fromJson(mapped);
      }).toList();

      if (mounted) {
        setState(() {
          _results = products;
          _isLoading = false;
        });
      }

      if (saveHistory) await _saveToHistory(query);
      await ActivityTrackingService().trackSearch(query, products.length);
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _submitSearch() {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;
    _debounce?.cancel();
    _focusNode.unfocus();
    _doSearch(query, saveHistory: true);
  }

  void _selectHistoryItem(String query) {
    _searchController.text = query;
    _doSearch(query, saveHistory: true);
    _focusNode.unfocus();
  }

  void _toggleFilters() {
    setState(() => _showFilters = !_showFilters);
    if (_showFilters) {
      _filterAnimController.forward();
    } else {
      _filterAnimController.reverse();
    }
  }

  void _applyFilters() {
    final query = _searchController.text.trim();
    // Run search even with empty query when filters are active
    if (query.isNotEmpty || _hasActiveFilters) {
      _doSearch(query.isEmpty ? '' : query);
    }
    setState(() => _showFilters = false);
    _filterAnimController.reverse();
  }

  void _resetFilters() {
    setState(() {
      _selectedCategoryId = null;
      _selectedCategoryName = null;
      _minPrice = 0;
      _maxPrice = 1000000;
      _minRating = 0;
    });
  }

  bool get _hasActiveFilters =>
      _selectedCategoryId != null || _minPrice > 0 || _maxPrice < 1000000 || _minRating > 0;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Column(
          children: [
            // ── Search Header ──────────────────────────────────
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF667eea).withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: [
                  Row(
                    children: [
                      Material(
                        color: Colors.white.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => context.pop(),
                          child: const Padding(
                            padding: EdgeInsets.all(10),
                            child: Icon(Icons.arrow_back, color: Colors.white, size: 20),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Container(
                          height: 46,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: TextField(
                            controller: _searchController,
                            focusNode: _focusNode,
                            textInputAction: TextInputAction.search,
                            onChanged: _onQueryChanged,
                            onSubmitted: (_) => _submitSearch(),
                            decoration: InputDecoration(
                              hintText: localizations.translate('search_product_hint'),
                              hintStyle: TextStyle(
                                color: Colors.grey.shade400,
                                fontSize: 14,
                              ),
                              prefixIcon: const Icon(
                                Icons.search,
                                color: Color(0xFF667eea),
                                size: 20,
                              ),
                              suffixIcon: _searchController.text.isNotEmpty
                                  ? IconButton(
                                      icon: Icon(Icons.close, color: Colors.grey.shade400, size: 18),
                                      onPressed: () {
                                        _searchController.clear();
                                        setState(() {
                                          _results = [];
                                          _hasSearched = false;
                                        });
                                        _focusNode.requestFocus();
                                      },
                                    )
                                  : null,
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Filter button with active indicator
                      Stack(
                        children: [
                          Material(
                            color: _showFilters
                                ? Colors.white
                                : Colors.white.withOpacity(0.18),
                            borderRadius: BorderRadius.circular(12),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: _toggleFilters,
                              child: Padding(
                                padding: const EdgeInsets.all(10),
                                child: FaIcon(
                                  FontAwesomeIcons.sliders,
                                  color: _showFilters
                                      ? const Color(0xFF667eea)
                                      : Colors.white,
                                  size: 18,
                                ),
                              ),
                            ),
                          ),
                          if (_hasActiveFilters)
                            Positioned(
                              top: 4,
                              right: 4,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFF6B6B),
                                  shape: BoxShape.circle,
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

            // ── Filter Panel ───────────────────────────────────
            SizeTransition(
              sizeFactor: _filterHeightAnim,
              child: _buildFilterPanel(localizations, theme),
            ),

            // ── Results Body ───────────────────────────────────
            Expanded(
              child: _buildBody(localizations, theme, isDark),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterPanel(AppLocalizations localizations, ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    return Container(
          color: isDark ? const Color(0xFF1E1E2E) : Colors.white,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category filter
              Text(
                localizations.translate('category'),
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 8),
              _CategoryFilterRow(
                selectedId: _selectedCategoryId,
                selectedName: _selectedCategoryName,
                onSelected: (id, name) {
                  setState(() {
                    _selectedCategoryId = id;
                    _selectedCategoryName = name;
                  });
                },
              ),
              const SizedBox(height: 14),
              // Price range
              Row(
                children: [
                  Text(
                    localizations.translate('price'),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const Spacer(),
                  Text(
                    '${_minPrice.toInt()} – ${_maxPrice >= 1000000 ? "∞" : _maxPrice.toInt()} FCFA',
                    style: TextStyle(
                      fontSize: 12,
                      color: theme.primaryColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              RangeSlider(
                values: RangeValues(_minPrice, _maxPrice.clamp(0, 1000000)),
                min: 0,
                max: 1000000,
                divisions: 100,
                activeColor: const Color(0xFF667eea),
                onChanged: (range) {
                  setState(() {
                    _minPrice = range.start;
                    _maxPrice = range.end;
                  });
                },
              ),
              const SizedBox(height: 8),
              // Rating filter
              Text(
                '${localizations.translate('filter_min_rating')} : ${_minRating == 0 ? localizations.translate('all') : "${_minRating.toInt()}★+"}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              const SizedBox(height: 8),
              Row(
                children: List.generate(5, (index) {
                  final rating = (index + 1).toDouble();
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() {
                        _minRating = _minRating == rating ? 0 : rating;
                      }),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: _minRating == rating
                              ? const Color(0xFF667eea)
                              : Colors.grey.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.star_rounded,
                              size: 14,
                              color: _minRating == rating ? Colors.white : Colors.amber,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${rating.toInt()}+',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: _minRating == rating ? Colors.white : null,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  if (_hasActiveFilters)
                    TextButton.icon(
                      onPressed: _resetFilters,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(localizations.translate('reset')),
                    ),
                  const Spacer(),
                  FilledButton.icon(
                    onPressed: _applyFilters,
                    icon: const Icon(Icons.check, size: 16),
                    label: Text(localizations.translate('apply')),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF667eea),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
  }

  Widget _buildBody(AppLocalizations localizations, ThemeData theme, bool isDark) {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF667eea)),
            SizedBox(height: 16),
          ],
        ),
      );
    }

    // Show search history before first search
    if (!_hasSearched) {
      return _buildInitialView(localizations, isDark);
    }

    if (_results.isEmpty) {
      return _buildEmptyResults(localizations, theme);
    }

    return Column(
      children: [
        // Results count header
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF667eea).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  localizations.translateParams(
                    'products_count',
                    {'count': _results.length.toString()},
                  ),
                  style: const TextStyle(
                    color: Color(0xFF667eea),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '"${_searchController.text.trim()}"',
                style: TextStyle(
                  color: Colors.grey.shade500,
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.55,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: _results.length,
            itemBuilder: (context, index) {
              return PremiumProductCard(product: _results[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildInitialView(AppLocalizations localizations, bool isDark) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_history.isNotEmpty) ...[
          Row(
            children: [
              const Icon(Icons.history, size: 18, color: Color(0xFF667eea)),
              const SizedBox(width: 8),
              Text(
                localizations.translate('search_history'),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: _clearHistory,
                child: Text(
                  localizations.translate('search_clear_history'),
                  style: const TextStyle(color: Color(0xFF667eea), fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _history
                .map((h) => ActionChip(
                      label: Text(h, style: const TextStyle(fontSize: 13)),
                      avatar: const Icon(Icons.history, size: 14),
                      onPressed: () => _selectHistoryItem(h),
                      backgroundColor: isDark
                          ? const Color(0xFF667eea).withOpacity(0.15)
                          : const Color(0xFF667eea).withOpacity(0.08),
                      side: BorderSide(
                        color: const Color(0xFF667eea).withOpacity(0.2),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 24),
        ],
        // Hero illustration
        Center(
          child: Column(
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  ),
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF667eea).withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(Icons.search, color: Colors.white, size: 48),
              ),
              const SizedBox(height: 20),
              Text(
                localizations.translate('search_products_hint'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                localizations.translate('try_another_keyword'),
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyResults(AppLocalizations localizations, ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(
                FontAwesomeIcons.boxOpen,
                size: 40,
                color: Colors.grey.shade400,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              localizations.translate('no_results'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              localizations.translate('try_another_keyword'),
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
            ),
            if (_hasActiveFilters) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () {
                  _resetFilters();
                  _doSearch(_searchController.text.trim());
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: Text(localizations.translate('clear_filter')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Category filter chips ──────────────────────────────────────────────────

class _CategoryFilterRow extends ConsumerWidget {
  final String? selectedId;
  final String? selectedName;
  final void Function(String? id, String? name) onSelected;

  const _CategoryFilterRow({
    required this.selectedId,
    required this.selectedName,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: Supabase.instance.client
          .from('categories')
          .select('id, name')
          .eq('is_active', true)
          .order('display_order'),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const SizedBox(height: 36, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
        }
        final cats = (snapshot.data as List).cast<Map>();
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ChoiceChip(
              label: Text(AppLocalizations.of(context).translate('all')),
              selected: selectedId == null,
              onSelected: (_) => onSelected(null, null),
              selectedColor: const Color(0xFF667eea),
              labelStyle: TextStyle(
                color: selectedId == null ? Colors.white : null,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
            ...cats.map((c) {
              final id = c['id']?.toString() ?? '';
              final name = c['name']?.toString() ?? '';
              final isSelected = selectedId == id;
              return ChoiceChip(
                label: Text(name),
                selected: isSelected,
                onSelected: (_) => onSelected(id, name),
                selectedColor: const Color(0xFF667eea),
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : null,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              );
            }),
          ],
        );
      },
    );
  }
}
