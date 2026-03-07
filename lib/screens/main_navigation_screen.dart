import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/cart_provider.dart';
import '../localization/app_localizations.dart';
import 'home_screen_premium.dart';
import 'categories_screen_premium.dart';
import 'cart_screen_premium.dart';
import 'favorites_screen_premium.dart';
import 'profile_screen_ultra.dart';

/// Main navigation screen with swipe support between pages
class MainNavigationScreen extends StatefulWidget {
  final int initialIndex;
  
  const MainNavigationScreen({
    super.key,
    this.initialIndex = 0,
  });

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen>
    with SingleTickerProviderStateMixin {
  late PageController _pageController;
  late int _currentIndex;
  DateTime? _lastBackPressTime;

  final List<Widget> _pages = const [
    HomeScreenPremium(),
    CategoriesScreenPremium(),
    CartScreenPremium(),
    FavoritesScreenPremium(),
    ProfileScreenUltra(),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex.clamp(0, _pages.length - 1);
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    if (_currentIndex != index) {
      setState(() => _currentIndex = index);
      HapticFeedback.selectionClick();
    }
  }

  void _onNavBarTap(int index) {
    if (_currentIndex == index) return;
    
    HapticFeedback.lightImpact();
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        
        // If not on home page, go to home
        if (_currentIndex != 0) {
          _onNavBarTap(0);
          return;
        }
        
        // Double-tap to exit on home page
        final now = DateTime.now();
        if (_lastBackPressTime != null && 
            now.difference(_lastBackPressTime!) < const Duration(seconds: 2)) {
          SystemNavigator.pop();
          return;
        }
        
        _lastBackPressTime = now;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(localizations.translate('press_back_again_to_exit')),
            duration: const Duration(seconds: 2),
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 80),
          ),
        );
      },
      child: Scaffold(
        body: PageView(
          controller: _pageController,
          onPageChanged: _onPageChanged,
          physics: const BouncingScrollPhysics(),
          children: _pages,
        ),
        bottomNavigationBar: _buildBottomNavBar(context),
      ),
    );
  }

  Widget _buildBottomNavBar(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);
    final l = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    const kAccent = Color(0xFF667eea);
    const kAccent2 = Color(0xFF764ba2);

    final items = [
      _NavItem(Icons.home_rounded, Icons.home_outlined, l.translate('home'), 0),
      _NavItem(Icons.apps_rounded, Icons.apps_outlined, l.translate('categories'), 0),
      _NavItem(Icons.shopping_cart_rounded, Icons.shopping_cart_outlined, l.translate('cart'), cart.itemCount),
      _NavItem(Icons.favorite_rounded, Icons.favorite_outline_rounded, l.translate('favorites'), 0),
      _NavItem(Icons.account_circle_rounded, Icons.account_circle_outlined, l.translate('profile'), 0),
    ];

    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF141420) : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white.withOpacity(0.06) : Colors.grey.withOpacity(0.12),
            width: 0.5,
          ),
        ),
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
          height: 68,
          child: Row(
            children: List.generate(items.length, (i) {
              final item = items[i];
              final isActive = _currentIndex == i;
              return Expanded(
                child: _buildNavItem(
                  item: item,
                  isActive: isActive,
                  onTap: () => _onNavBarTap(i),
                  theme: theme,
                  isDark: isDark,
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required _NavItem item,
    required bool isActive,
    required VoidCallback onTap,
    required ThemeData theme,
    required bool isDark,
  }) {
    const kAccent = Color(0xFF667eea);
    final iconColor = isActive ? kAccent : (isDark ? Colors.grey.shade500 : Colors.grey.shade500);
    final labelColor = isActive ? kAccent : (isDark ? Colors.grey.shade500 : Colors.grey.shade500);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
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
                  isActive ? item.activeIcon : item.inactiveIcon,
                  key: ValueKey(isActive),
                  size: isActive ? 24 : 22,
                  color: iconColor,
                ),
              ),
              if (item.badge > 0)
                Positioned(
                  right: -8,
                  top: -6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    constraints: const BoxConstraints(minWidth: 18, minHeight: 16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
                      ),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFFF6B6B).withOpacity(0.4),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      item.badge > 99 ? '99+' : '${item.badge}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
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
              fontSize: isActive ? 11 : 10,
              fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              color: labelColor,
              letterSpacing: isActive ? 0.3 : 0,
            ),
            child: Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem {
  final IconData activeIcon;
  final IconData inactiveIcon;
  final String label;
  final int badge;

  const _NavItem(this.activeIcon, this.inactiveIcon, this.label, this.badge);
}
