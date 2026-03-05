import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../localization/app_localizations.dart';
import '../../services/review_service.dart';

class ProductReviewsScreen extends StatefulWidget {
  final String productId;
  final String productName;

  const ProductReviewsScreen({
    super.key,
    required this.productId,
    required this.productName,
  });

  @override
  State<ProductReviewsScreen> createState() => _ProductReviewsScreenState();
}

class _ProductReviewsScreenState extends State<ProductReviewsScreen> {
  final ReviewService _reviewService = ReviewService();

  List<Map<String, dynamic>> _reviews = [];
  Map<String, dynamic>? _myReview;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _offset = 0;
  static const int _pageSize = 20;

  // Stats
  double _avgRating = 0;
  Map<int, int> _ratingCounts = {};

  // Sort
  String _sort = 'date'; // 'date' | 'rating_high' | 'rating_low'

  @override
  void initState() {
    super.initState();
    _loadReviews();
    _loadMyReview();
  }

  Future<void> _loadReviews({bool refresh = false}) async {
    if (refresh) {
      setState(() {
        _offset = 0;
        _reviews = [];
        _hasMore = true;
        _isLoading = true;
      });
    }

    try {
      final items = await _reviewService.getProductReviews(
        productId: widget.productId,
        limit: _pageSize,
        offset: _offset,
      );

      // Sort client-side based on selection
      switch (_sort) {
        case 'rating_high':
          items.sort((a, b) {
            final ra = (a['rating'] as num?)?.toInt() ?? 0;
            final rb = (b['rating'] as num?)?.toInt() ?? 0;
            return rb.compareTo(ra);
          });
          break;
        case 'rating_low':
          items.sort((a, b) {
            final ra = (a['rating'] as num?)?.toInt() ?? 0;
            final rb = (b['rating'] as num?)?.toInt() ?? 0;
            return ra.compareTo(rb);
          });
          break;
        default:
          // Already sorted by date from service
          break;
      }

      if (!mounted) return;
      setState(() {
        _reviews = refresh ? items : [..._reviews, ...items];
        _hasMore = items.length >= _pageSize;
        _offset = _reviews.length;
        _isLoading = false;
        _isLoadingMore = false;
        _computeStats();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _loadMyReview() async {
    final mine = await _reviewService.getMyReview(productId: widget.productId);
    if (!mounted) return;
    setState(() => _myReview = mine);
  }

  void _computeStats() {
    if (_reviews.isEmpty) {
      _avgRating = 0;
      _ratingCounts = {};
      return;
    }
    double total = 0;
    final counts = <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    for (final r in _reviews) {
      final rating = (r['rating'] as num?)?.toInt() ?? 0;
      total += rating;
      counts[rating] = (counts[rating] ?? 0) + 1;
    }
    _avgRating = total / _reviews.length;
    _ratingCounts = counts;
  }

  Future<void> _openReviewComposer() async {
    final localizations = AppLocalizations.of(context);
    final initialRating = (_myReview?['rating'] is num)
        ? (_myReview!['rating'] as num).toDouble()
        : 5.0;
    double selectedRating = initialRating;
    final controller = TextEditingController(
      text: _myReview?['comment']?.toString() ?? '',
    );

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 8,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _myReview == null
                    ? localizations.translate('leave_review')
                    : localizations.translate('edit_my_review'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: RatingBar.builder(
                  initialRating: initialRating,
                  minRating: 1,
                  allowHalfRating: false,
                  itemSize: 36,
                  itemPadding: const EdgeInsets.symmetric(horizontal: 4),
                  itemBuilder: (_, __) =>
                      const Icon(Icons.star_rounded, color: Colors.amber),
                  onRatingUpdate: (v) => selectedRating = v,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: controller,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: localizations.translate('review_comment_optional'),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton.icon(
                  onPressed: () => Navigator.pop(ctx, true),
                  icon: const Icon(Icons.send),
                  label: Text(localizations.translate('send')),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF667eea),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (submitted != true) return;
    try {
      await _reviewService.upsertMyReview(
        productId: widget.productId,
        rating: selectedRating.toInt(),
        comment: controller.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).translate('review_submitted_bonus')),
            backgroundColor: Colors.green,
          ),
        );
      }
      await Future.wait([_loadMyReview(), _loadReviews(refresh: true)]);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App Bar ──────────────────────────────────────────
            SliverAppBar(
              pinned: true,
              expandedHeight: _reviews.isEmpty ? 80 : 220,
              backgroundColor: theme.scaffoldBackgroundColor,
              elevation: 0,
              leading: IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.9),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.arrow_back, color: Colors.black, size: 18),
                ),
                onPressed: () => Navigator.pop(context),
              ),
              flexibleSpace: FlexibleSpaceBar(
                title: Text(
                  localizations.translate('reviews'),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                background: _reviews.isEmpty
                    ? null
                    : Container(
                        padding: const EdgeInsets.fromLTRB(16, 80, 16, 16),
                        child: _buildStatsSection(localizations, theme),
                      ),
              ),
              actions: [
                // Sort menu
                PopupMenuButton<String>(
                  icon: const Icon(Icons.sort),
                  onSelected: (value) {
                    setState(() => _sort = value);
                    _loadReviews(refresh: true);
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'date',
                      child: Text(localizations.translate('sort_by_date')),
                    ),
                    PopupMenuItem(
                      value: 'rating_high',
                      child: Text(localizations.translate('sort_by_rating_high')),
                    ),
                    PopupMenuItem(
                      value: 'rating_low',
                      child: Text(localizations.translate('sort_by_rating_low')),
                    ),
                  ],
                ),
              ],
            ),

            // ── Loading ───────────────────────────────────────────
            if (_isLoading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator(color: Color(0xFF667eea))),
              )
            else if (_reviews.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.rate_review_outlined,
                          size: 60, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        localizations.translate('no_reviews_yet'),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        localizations.translate('be_first_reviewer'),
                        style: TextStyle(color: Colors.grey.shade500),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    if (index < _reviews.length) {
                      return _buildReviewCard(_reviews[index], theme, localizations);
                    }
                    // Load more
                    return _buildLoadMore(localizations);
                  },
                  childCount: _reviews.length + (_hasMore ? 1 : 0),
                ),
              ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openReviewComposer,
        backgroundColor: const Color(0xFF667eea),
        icon: Icon(
          _myReview == null ? Icons.rate_review : Icons.edit,
          color: Colors.white,
        ),
        label: Text(
          _myReview == null
              ? localizations.translate('leave_review')
              : localizations.translate('edit_my_review'),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  Widget _buildStatsSection(AppLocalizations localizations, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Average score
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _avgRating.toStringAsFixed(1),
                style: const TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF667eea),
                ),
              ),
              RatingBarIndicator(
                rating: _avgRating,
                itemBuilder: (_, __) => const Icon(Icons.star_rounded, color: Colors.amber),
                itemCount: 5,
                itemSize: 16,
                unratedColor: Colors.amber.withOpacity(0.2),
              ),
              const SizedBox(height: 4),
              Text(
                '${_reviews.length} avis',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(width: 16),
          // Rating distribution
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (i) {
                final star = 5 - i;
                final count = _ratingCounts[star] ?? 0;
                final pct = _reviews.isEmpty ? 0.0 : count / _reviews.length;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Text('$star', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 4),
                      const Icon(Icons.star_rounded, size: 12, color: Colors.amber),
                      const SizedBox(width: 6),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: pct,
                            backgroundColor: Colors.grey.shade200,
                            valueColor: const AlwaysStoppedAnimation(Color(0xFF667eea)),
                            minHeight: 6,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      SizedBox(
                        width: 20,
                        child: Text(
                          '$count',
                          style: const TextStyle(fontSize: 11),
                          textAlign: TextAlign.end,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewCard(
    Map<String, dynamic> r,
    ThemeData theme,
    AppLocalizations localizations,
  ) {
    final rating = (r['rating'] as num?)?.toDouble() ?? 0.0;
    final comment = r['comment']?.toString();
    final profiles = (r['profiles'] is Map) ? Map<String, dynamic>.from(r['profiles']) : null;
    final firstName = profiles?['first_name']?.toString();
    final lastName = profiles?['last_name']?.toString();
    final who = ((firstName ?? '').trim().isNotEmpty || (lastName ?? '').trim().isNotEmpty)
        ? '${(firstName ?? '').trim()} ${(lastName ?? '').trim()}'.trim()
        : localizations.translate('customer');

    final rawDate = r['created_at']?.toString();
    String dateStr = '';
    if (rawDate != null) {
      try {
        final dt = DateTime.parse(rawDate);
        dateStr =
            '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
      } catch (_) {}
    }

    final isMyReview =
        Supabase.instance.client.auth.currentUser?.id == r['user_id']?.toString();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
        border: isMyReview
            ? Border.all(color: const Color(0xFF667eea).withOpacity(0.4), width: 1.5)
            : Border.all(color: Colors.grey.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFF667eea).withOpacity(0.1),
                child: Text(
                  who.isNotEmpty ? who[0].toUpperCase() : '?',
                  style: const TextStyle(
                    color: Color(0xFF667eea),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(who, style: const TextStyle(fontWeight: FontWeight.w700)),
                        if (isMyReview) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF667eea),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'Moi',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (dateStr.isNotEmpty)
                      Text(
                        dateStr,
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                      ),
                  ],
                ),
              ),
              RatingBarIndicator(
                rating: rating,
                itemBuilder: (_, __) => const Icon(Icons.star_rounded, color: Colors.amber),
                itemCount: 5,
                itemSize: 16,
                unratedColor: Colors.amber.withOpacity(0.25),
              ),
            ],
          ),
          if (comment != null && comment.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              comment.trim(),
              style: const TextStyle(height: 1.4, fontSize: 14),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLoadMore(AppLocalizations localizations) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: _isLoadingMore
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF667eea)))
          : Center(
              child: OutlinedButton.icon(
                onPressed: () {
                  setState(() => _isLoadingMore = true);
                  _loadReviews();
                },
                icon: const Icon(Icons.expand_more),
                label: Text(localizations.translate('load_more')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF667eea),
                  side: const BorderSide(color: Color(0xFF667eea)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
    );
  }
}
