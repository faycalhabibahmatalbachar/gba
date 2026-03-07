import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import 'bottom_nav_bar.dart';
import '../localization/app_localizations.dart';

class AdaptiveScaffold extends StatelessWidget {
  final int currentIndex;
  final PreferredSizeWidget? appBar;
  final Widget body;
  final bool extendBodyBehindAppBar;
  final bool extendBody;
  final Color? backgroundColor;
  final Widget? drawer;
  final Widget? floatingActionButton;
  final FloatingActionButtonLocation? floatingActionButtonLocation;

  const AdaptiveScaffold({
    super.key,
    required this.currentIndex,
    required this.body,
    this.appBar,
    this.extendBodyBehindAppBar = false,
    this.extendBody = false,
    this.backgroundColor,
    this.drawer,
    this.floatingActionButton,
    this.floatingActionButtonLocation,
  });

  void _go(BuildContext context, int index) {
    HapticFeedback.lightImpact();

    switch (index) {
      case 0:
        context.go('/home');
        break;
      case 1:
        context.go('/categories');
        break;
      case 2:
        context.go('/cart');
        break;
      case 3:
        context.go('/favorites');
        break;
      case 4:
        context.go('/profile');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 900;
        final localizations = AppLocalizations.of(context);

        if (!isWide) {
          final scaffold = Scaffold(
            backgroundColor: backgroundColor,
            extendBodyBehindAppBar: extendBodyBehindAppBar,
            extendBody: extendBody,
            appBar: appBar,
            drawer: drawer,
            body: body,
            floatingActionButton: floatingActionButton,
            floatingActionButtonLocation: floatingActionButtonLocation,
            bottomNavigationBar: BottomNavBar(currentIndex: currentIndex),
          );

          // On non-home tabs, intercept back button → go to home
          if (currentIndex != 0) {
            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, _) {
                if (didPop) return;
                if (GoRouter.of(context).canPop()) {
                  GoRouter.of(context).pop();
                } else {
                  context.go('/home');
                }
              },
              child: scaffold,
            );
          }

          return scaffold;
        }

        return Scaffold(
          backgroundColor: backgroundColor,
          extendBodyBehindAppBar: extendBodyBehindAppBar,
          extendBody: extendBody,
          appBar: appBar,
          drawer: drawer,
          floatingActionButton: floatingActionButton,
          floatingActionButtonLocation: floatingActionButtonLocation,
          body: Row(
            children: [
              NavigationRail(
                selectedIndex: currentIndex,
                onDestinationSelected: (index) => _go(context, index),
                labelType: NavigationRailLabelType.all,
                backgroundColor: Colors.white.withOpacity(0.95),
                selectedIconTheme: const IconThemeData(
                  color: Color(0xFF667eea),
                ),
                selectedLabelTextStyle: const TextStyle(
                  color: Color(0xFF667eea),
                  fontWeight: FontWeight.w700,
                ),
                unselectedIconTheme: IconThemeData(
                  color: Colors.grey.shade600,
                ),
                unselectedLabelTextStyle: TextStyle(
                  color: Colors.grey.shade600,
                  fontWeight: FontWeight.w600,
                ),
                destinations: [
                  NavigationRailDestination(
                    icon: const Icon(Icons.home_outlined, size: 22),
                    selectedIcon: const Icon(Icons.home_rounded, size: 22),
                    label: Text(
                      localizations.translate('home'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  NavigationRailDestination(
                    icon: const Icon(Icons.grid_view_outlined, size: 22),
                    selectedIcon: const Icon(Icons.grid_view_rounded, size: 22),
                    label: Text(
                      localizations.translate('categories'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  NavigationRailDestination(
                    icon: const Icon(Icons.shopping_bag_outlined, size: 22),
                    selectedIcon: const Icon(Icons.shopping_bag_rounded, size: 22),
                    label: Text(
                      localizations.translate('cart'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  NavigationRailDestination(
                    icon: const Icon(Icons.favorite_border_rounded, size: 22),
                    selectedIcon: const Icon(Icons.favorite_rounded, size: 22),
                    label: Text(
                      localizations.translate('favorites'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  NavigationRailDestination(
                    icon: const Icon(Icons.person_outline_rounded, size: 22),
                    selectedIcon: const Icon(Icons.person_rounded, size: 22),
                    label: Text(
                      localizations.translate('profile'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const VerticalDivider(width: 1),
              Expanded(child: body),
            ],
          ),
        );
      },
    );
  }
}
