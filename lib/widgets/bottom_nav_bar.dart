import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../utils/auth_guard.dart';
import '../providers/cart_provider.dart';
import '../localization/app_localizations.dart';

const _kAccent = Color(0xFF667eea);
const _kAccent2 = Color(0xFF764ba2);
const _kNavHeight = 68.0;
const _kIconSize = 24.0;
const _kIconSizeInactive = 22.0;

class BottomNavBar extends StatefulWidget {
  final int currentIndex;

  const BottomNavBar({super.key, required this.currentIndex});

  @override
  State<BottomNavBar> createState() => _BottomNavBarState();
}

class _BottomNavBarState extends State<BottomNavBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _indicatorCtrl;
  late Animation<double> _indicatorPos;
  int _prevIndex = 0;

  static const _routes = ['/home', '/categories', '/cart', '/favorites', '/profile'];
  static const _authRequired = {2, 3, 4};

  @override
  void initState() {
    super.initState();
    _prevIndex = widget.currentIndex;
    _indicatorCtrl = AnimationController(
      duration: const Duration(milliseconds: 320),
      vsync: this,
    );
    _indicatorPos = AlwaysStoppedAnimation(widget.currentIndex.toDouble());
  }

  @override
  void didUpdateWidget(covariant BottomNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentIndex != widget.currentIndex) {
      _animateTo(widget.currentIndex);
    }
  }

  void _animateTo(int target) {
    _indicatorPos = Tween<double>(
      begin: _prevIndex.toDouble(),
      end: target.toDouble(),
    ).animate(CurvedAnimation(parent: _indicatorCtrl, curve: Curves.easeOutCubic));
    _indicatorCtrl.forward(from: 0);
    _prevIndex = target;
  }

  @override
  void dispose() {
    _indicatorCtrl.dispose();
    super.dispose();
  }

  void _onTap(int index) {
    if (index == widget.currentIndex) return;
    HapticFeedback.lightImpact();
    if (_authRequired.contains(index) && !requireAuth(context)) return;
    context.go(_routes[index]);
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);
    final l = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final items = <_NavItemData>[
      _NavItemData(Icons.home_rounded, Icons.home_outlined, l.translate('home')),
      _NavItemData(Icons.grid_view_rounded, Icons.grid_view_outlined, l.translate('categories')),
      _NavItemData(Icons.shopping_bag_rounded, Icons.shopping_bag_outlined, l.translate('cart'), badge: cart.itemCount),
      _NavItemData(Icons.favorite_rounded, Icons.favorite_border_rounded, l.translate('favorites')),
      _NavItemData(Icons.person_rounded, Icons.person_outline_rounded, l.translate('profile')),
    ];

    final bg = isDark ? const Color(0xFF141420) : Colors.white;
    final border = isDark ? Colors.white.withOpacity(0.06) : Colors.grey.withOpacity(0.12);
    final inactiveColor = isDark ? Colors.grey.shade500 : Colors.grey.shade500;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        border: Border(top: BorderSide(color: border, width: 0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: _kNavHeight,
          child: AnimatedBuilder(
            animation: _indicatorCtrl,
            builder: (context, _) {
              return CustomPaint(
                painter: _IndicatorPainter(
                  position: _indicatorPos.value,
                  itemCount: items.length,
                  color: _kAccent,
                  isDark: isDark,
                ),
                child: Row(
                  children: List.generate(items.length, (i) {
                    final isActive = widget.currentIndex == i;
                    final item = items[i];
                    return Expanded(
                      child: RepaintBoundary(
                        child: _NavItem(
                          data: item,
                          isActive: isActive,
                          inactiveColor: inactiveColor,
                          onTap: () => _onTap(i),
                        ),
                      ),
                    );
                  }),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _NavItemData {
  final IconData activeIcon;
  final IconData inactiveIcon;
  final String label;
  final int badge;
  const _NavItemData(this.activeIcon, this.inactiveIcon, this.label, {this.badge = 0});
}

class _NavItem extends StatefulWidget {
  final _NavItemData data;
  final bool isActive;
  final Color inactiveColor;
  final VoidCallback onTap;

  const _NavItem({
    required this.data,
    required this.isActive,
    required this.inactiveColor,
    required this.onTap,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem> with SingleTickerProviderStateMixin {
  late final AnimationController _tapCtrl;

  @override
  void initState() {
    super.initState();
    _tapCtrl = AnimationController(
      duration: const Duration(milliseconds: 100),
      reverseDuration: const Duration(milliseconds: 200),
      vsync: this,
      lowerBound: 0.0,
      upperBound: 1.0,
    );
  }

  @override
  void dispose() {
    _tapCtrl.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails _) {
    _tapCtrl.forward();
  }

  void _handleTapUp(TapUpDetails _) {
    _tapCtrl.reverse();
    widget.onTap();
  }

  void _handleTapCancel() {
    _tapCtrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final active = widget.isActive;
    final iconColor = active ? _kAccent : widget.inactiveColor;
    final labelColor = active ? _kAccent : widget.inactiveColor;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      child: AnimatedBuilder(
        animation: _tapCtrl,
        builder: (context, child) {
          final scale = 1.0 - (_tapCtrl.value * 0.08);
          return Transform.scale(scale: scale, child: child);
        },
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  switchInCurve: Curves.easeOutBack,
                  switchOutCurve: Curves.easeIn,
                  transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                  child: Icon(
                    active ? widget.data.activeIcon : widget.data.inactiveIcon,
                    key: ValueKey(active),
                    size: active ? _kIconSize : _kIconSizeInactive,
                    color: iconColor,
                  ),
                ),
                if (widget.data.badge > 0)
                  Positioned(
                    right: -8,
                    top: -6,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                      child: Container(
                        key: ValueKey(widget.data.badge),
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        constraints: const BoxConstraints(minWidth: 18, minHeight: 16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)]),
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: [
                            BoxShadow(color: const Color(0xFFFF6B6B).withOpacity(0.4), blurRadius: 6, offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Text(
                          widget.data.badge > 99 ? '99+' : '${widget.data.badge}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700, height: 1.2),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 250),
              style: TextStyle(
                fontSize: active ? 11 : 10,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: labelColor,
                letterSpacing: active ? 0.3 : 0,
              ),
              child: Text(widget.data.label, maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }
}

class _IndicatorPainter extends CustomPainter {
  final double position;
  final int itemCount;
  final Color color;
  final bool isDark;

  _IndicatorPainter({
    required this.position,
    required this.itemCount,
    required this.color,
    required this.isDark,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (itemCount == 0) return;
    final itemWidth = size.width / itemCount;
    final cx = itemWidth * position + itemWidth / 2;

    // Top indicator line
    final paint = Paint()
      ..shader = const LinearGradient(
        colors: [_kAccent, _kAccent2],
      ).createShader(Rect.fromCenter(center: Offset(cx, 0), width: 32, height: 3));
    final rrect = RRect.fromRectAndRadius(
      Rect.fromCenter(center: Offset(cx, 1.5), width: 32, height: 3),
      const Radius.circular(2),
    );
    canvas.drawRRect(rrect, paint);

    // Subtle glow below indicator
    final glowPaint = Paint()
      ..color = color.withOpacity(isDark ? 0.08 : 0.05)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
    canvas.drawCircle(Offset(cx, 16), 20, glowPaint);
  }

  @override
  bool shouldRepaint(_IndicatorPainter old) =>
      old.position != position || old.itemCount != itemCount || old.isDark != isDark;
}
