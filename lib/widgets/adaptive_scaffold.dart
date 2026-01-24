import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';

import 'bottom_nav_bar.dart';

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

        if (!isWide) {
          return Scaffold(
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
                destinations: const [
                  NavigationRailDestination(
                    icon: FaIcon(FontAwesomeIcons.house, size: 18),
                    selectedIcon: FaIcon(FontAwesomeIcons.house, size: 18),
                    label: Text('Accueil'),
                  ),
                  NavigationRailDestination(
                    icon: FaIcon(FontAwesomeIcons.grip, size: 18),
                    selectedIcon: FaIcon(FontAwesomeIcons.grip, size: 18),
                    label: Text('Catégories'),
                  ),
                  NavigationRailDestination(
                    icon: FaIcon(FontAwesomeIcons.cartShopping, size: 18),
                    selectedIcon: FaIcon(FontAwesomeIcons.bagShopping, size: 18),
                    label: Text('Panier'),
                  ),
                  NavigationRailDestination(
                    icon: FaIcon(FontAwesomeIcons.heart, size: 18),
                    selectedIcon: FaIcon(FontAwesomeIcons.solidHeart, size: 18),
                    label: Text('Favoris'),
                  ),
                  NavigationRailDestination(
                    icon: FaIcon(FontAwesomeIcons.user, size: 18),
                    selectedIcon: FaIcon(FontAwesomeIcons.solidUser, size: 18),
                    label: Text('Profil'),
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
