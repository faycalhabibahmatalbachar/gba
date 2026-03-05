import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/banner_provider.dart';
import '../models/app_banner.dart';

// Reduced multiplier — same infinite illusion, less virtual index overhead
const int _kLoopFactor = 200;

/// Self-contained banner carousel.
/// Height is determined by [aspectRatio] (default 16:7 ≈ 2.29).
/// Parent only needs to give it a bounded width.
class BannerCarousel extends StatefulWidget {
  const BannerCarousel({
    super.key,
    this.aspectRatio = 16 / 7,
    this.autoPlayInterval = const Duration(seconds: 4),
  });

  final double aspectRatio;
  final Duration autoPlayInterval;

  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel> {
  PageController? _pageController;
  int _currentReal = 0;
  Timer? _autoScrollTimer;
  int _bannerCount = 0;
  List<AppBanner> _cachedBanners = [];

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _precacheBannerImages();
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _pageController?.dispose();
    super.dispose();
  }

  // ── Image preloading ────────────────────────────────────────────────────────

  void _precacheBannerImages() {
    final provider = Provider.of<BannerProvider>(context, listen: false);
    for (final banner in provider.activeBanners) {
      final url = banner.imageUrl?.trim();
      if (url != null && url.isNotEmpty) {
        precacheImage(CachedNetworkImageProvider(url), context);
      }
    }
  }

  // ── Controller management ───────────────────────────────────────────────────

  void _initController(int count) {
    if (_bannerCount == count && _pageController != null) return;
    _bannerCount = count;
    _autoScrollTimer?.cancel();
    _pageController?.dispose();
    final midPoint = count * (_kLoopFactor ~/ 2);
    _pageController = PageController(initialPage: midPoint);
    _currentReal = 0;
    if (count > 1) _startAutoScroll();
  }

  void _startAutoScroll() {
    _autoScrollTimer?.cancel();
    _autoScrollTimer = Timer.periodic(widget.autoPlayInterval, (_) {
      if (!mounted || _pageController == null) return;
      final ctrl = _pageController!;
      if (!ctrl.hasClients) return;
      ctrl.animateToPage(
        (ctrl.page?.round() ?? 0) + 1,
        duration: const Duration(milliseconds: 650),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  void _onPageChanged(int virtualIndex) {
    final real = virtualIndex % _bannerCount;
    if (real != _currentReal) {
      setState(() => _currentReal = real);
    }
  }

  void _handleTap(AppBanner banner) {
    HapticFeedback.selectionClick();
    final route = banner.targetRoute?.trim();
    if (route != null && route.isNotEmpty) {
      context.push(route);
    }
  }

  void _onManualDragStart() {
    _autoScrollTimer?.cancel();
  }

  void _onManualDragEnd() {
    if (_bannerCount > 1) _startAutoScroll();
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Consumer<BannerProvider>(
      builder: (context, provider, _) {
        final banners = provider.activeBanners;

        if (provider.isLoading && banners.isEmpty) {
          return _BannerSkeleton(aspectRatio: widget.aspectRatio);
        }

        if (banners.isEmpty) return const SizedBox.shrink();

        // Precache newly arrived banners
        if (banners.length != _cachedBanners.length) {
          _cachedBanners = banners;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _precacheBannerImages();
          });
        }

        _initController(banners.length);

        return AspectRatio(
          aspectRatio: widget.aspectRatio,
          child: RepaintBoundary(
            child: Stack(
              fit: StackFit.expand,
              children: [
                // ── PageView ─────────────────────────────────────────────────
                NotificationListener<ScrollStartNotification>(
                  onNotification: (_) {
                    _onManualDragStart();
                    return false;
                  },
                  child: NotificationListener<ScrollEndNotification>(
                    onNotification: (_) {
                      _onManualDragEnd();
                      return false;
                    },
                    child: PageView.builder(
                      controller: _pageController,
                      itemCount:
                          banners.length > 1 ? banners.length * _kLoopFactor : 1,
                      onPageChanged: _onPageChanged,
                      itemBuilder: (context, virtualIndex) {
                        final real = virtualIndex % banners.length;
                        return _BannerSlide(
                          banner: banners[real],
                          onTap: () => _handleTap(banners[real]),
                        );
                      },
                    ),
                  ),
                ),

                // ── Dots indicator ────────────────────────────────────────────
                if (banners.length > 1)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 12,
                    child: _DotsIndicator(
                      count: banners.length,
                      current: _currentReal,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

class _BannerSkeleton extends StatelessWidget {
  const _BannerSkeleton({required this.aspectRatio});
  final double aspectRatio;

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: aspectRatio,
      child: const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF667eea), Color(0xFF764ba2)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
      ),
    );
  }
}

// ── Dots indicator ─────────────────────────────────────────────────────────────

class _DotsIndicator extends StatelessWidget {
  const _DotsIndicator({required this.count, required this.current});
  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final active = i == current;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 280),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: active ? Colors.white : Colors.white.withValues(alpha: 0.45),
            boxShadow: const [
              BoxShadow(color: Color(0x40000000), blurRadius: 4),
            ],
          ),
        );
      }),
    );
  }
}

// ── Banner slide ──────────────────────────────────────────────────────────────

class _BannerSlide extends StatelessWidget {
  const _BannerSlide({required this.banner, required this.onTap});
  final AppBanner banner;
  final VoidCallback onTap;

  static const _kGradient = LinearGradient(
    colors: [Color(0xFF667eea), Color(0xFF764ba2)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  @override
  Widget build(BuildContext context) {
    final hasImage = (banner.imageUrl?.trim().isNotEmpty ?? false);
    final title = banner.title.trim();
    final subtitle = (banner.subtitle ?? '').trim();

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background ─────────────────────────────────────────────────────
          if (hasImage)
            CachedNetworkImage(
              imageUrl: banner.imageUrl!,
              fit: BoxFit.cover,
              alignment: Alignment.center,
              placeholder: (_, __) => const DecoratedBox(
                decoration: BoxDecoration(gradient: _kGradient),
              ),
              errorWidget: (_, __, ___) => const DecoratedBox(
                decoration: BoxDecoration(gradient: _kGradient),
              ),
            )
          else
            const DecoratedBox(decoration: BoxDecoration(gradient: _kGradient)),

          // ── Bottom scrim ────────────────────────────────────────────────────
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0x8C000000)],
                  stops: [0.45, 1.0],
                ),
              ),
            ),
          ),

          // ── Text overlay ────────────────────────────────────────────────────
          if (title.isNotEmpty || subtitle.isNotEmpty)
            Positioned(
              left: 18,
              right: 18,
              bottom: 34,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (title.isNotEmpty)
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        shadows: [Shadow(blurRadius: 8, color: Colors.black38)],
                      ),
                    ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xE6FFFFFF),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),

          // ── Arrow hint ──────────────────────────────────────────────────────
          Positioned(
            right: 14,
            top: 14,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Padding(
                padding: EdgeInsets.all(6),
                child: Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
