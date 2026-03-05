import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../localization/app_localizations.dart';
import '../models/product.dart';
import '../services/recommendation_service.dart';
import 'product_card_premium.dart';

/// Horizontal recommendations carousel powered by [RecommendationService].
/// Designed to be placed inside a [CustomScrollView] as a [SliverToBoxAdapter].
class RecommendationsSection extends StatefulWidget {
  const RecommendationsSection({super.key});

  @override
  State<RecommendationsSection> createState() => _RecommendationsSectionState();
}

class _RecommendationsSectionState extends State<RecommendationsSection> {
  final _service = RecommendationService();
  late final Future<List<Product>> _future;
  final ScrollController _scrollController = ScrollController();
  Timer? _autoScrollTimer;
  Timer? _resumeTimer;
  bool _scrollingForward = true;
  bool _userScrolling = false;

  @override
  void initState() {
    super.initState();
    _future = _service.getRecommendations(limit: 10);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startAutoScroll());
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = Timer.periodic(const Duration(milliseconds: 30), (_) {
      if (!mounted || !_scrollController.hasClients) return;
      final maxScroll = _scrollController.position.maxScrollExtent;
      if (maxScroll <= 0) return;
      const step = 1.2;
      final current = _scrollController.offset;
      if (_scrollingForward) {
        if (current >= maxScroll - 1) {
          _scrollingForward = false;
        } else {
          _scrollController.jumpTo((current + step).clamp(0, maxScroll));
        }
      } else {
        if (current <= 1) {
          _scrollingForward = true;
        } else {
          _scrollController.jumpTo((current - step).clamp(0, maxScroll));
        }
      }
    });
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _resumeTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loc = AppLocalizations.of(context);
    return FutureBuilder<List<Product>>(
      future: _future,
      builder: (context, snap) {
        // Do not render anything if not logged in / no data yet
        if (snap.connectionState == ConnectionState.waiting) {
          return _shell(
            loc,
            child: _LoadingRow(),
          );
        }

        final products = snap.data ?? [];
        // Don't show section at all when empty (user not logged in / no recs)
        if (products.isEmpty) return const SizedBox.shrink();

        return _shell(
          loc,
          child: SizedBox(
            height: 250,
            child: NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is UserScrollNotification) {
                  _userScrolling = notification.direction != ScrollDirection.idle;
                  if (_userScrolling) {
                    _autoScrollTimer?.cancel();
                    _resumeTimer?.cancel();
                  } else {
                    _resumeTimer?.cancel();
                    _resumeTimer = Timer(const Duration(milliseconds: 1500), () {
                      if (mounted && !_userScrolling) _startAutoScroll();
                    });
                  }
                }
                return false;
              },
              child: ListView.separated(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: products.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  return SizedBox(
                    width: 158,
                    child: PremiumProductCard(product: products[index]),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _shell(AppLocalizations loc, {required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
          child: Row(
            children: [
              // Gradient icon badge
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              Text(
                loc.translate('recommended_for_you'),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF2D3436),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: () {
                  HapticFeedback.selectionClick();
                  context.push('/search');
                },
                child: Text(
                  loc.translate('see_all'),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF667eea),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        child,
        const SizedBox(height: 8),
      ],
    );
  }
}

class _LoadingRow extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 250,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: 4,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, __) => Container(
          width: 158,
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}
