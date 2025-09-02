import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:badges/badges.dart' as badges;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../providers/cart_provider.dart';

class BottomNavBar extends ConsumerStatefulWidget {
  final int currentIndex;
  
  const BottomNavBar({
    super.key,
    required this.currentIndex,
  });

  @override
  ConsumerState<BottomNavBar> createState() => _BottomNavBarState();
}

class _BottomNavBarState extends ConsumerState<BottomNavBar> {
  void _onItemTapped(int index) {
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
    final cartItemCount = ref.watch(cartItemCountProvider);
    
    return Container(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: BottomNavigationBar(
        currentIndex: widget.currentIndex,
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Theme.of(context).primaryColor,
        unselectedItemColor: Colors.grey,
        selectedFontSize: 12,
        unselectedFontSize: 12,
        items: [
          const BottomNavigationBarItem(
            icon: FaIcon(FontAwesomeIcons.house, size: 20),
            activeIcon: FaIcon(FontAwesomeIcons.house, size: 20),
            label: 'Accueil',
          ),
          const BottomNavigationBarItem(
            icon: FaIcon(FontAwesomeIcons.grip, size: 20),
            activeIcon: FaIcon(FontAwesomeIcons.grip, size: 20),
            label: 'Catégories',
          ),
          BottomNavigationBarItem(
            icon: badges.Badge(
              showBadge: cartItemCount > 0,
              badgeContent: Text(
                cartItemCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                ),
              ),
              badgeStyle: const badges.BadgeStyle(
                badgeColor: Colors.red,
                padding: EdgeInsets.all(4),
              ),
              child: const FaIcon(FontAwesomeIcons.cartShopping, size: 20),
            ),
            activeIcon: badges.Badge(
              showBadge: cartItemCount > 0,
              badgeContent: Text(
                cartItemCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                ),
              ),
              badgeStyle: const badges.BadgeStyle(
                badgeColor: Colors.red,
                padding: EdgeInsets.all(4),
              ),
              child: const FaIcon(FontAwesomeIcons.cartShopping, size: 20),
            ),
            label: 'Panier',
          ),
          const BottomNavigationBarItem(
            icon: FaIcon(FontAwesomeIcons.heart, size: 20),
            activeIcon: FaIcon(FontAwesomeIcons.solidHeart, size: 20),
            label: 'Favoris',
          ),
          const BottomNavigationBarItem(
            icon: FaIcon(FontAwesomeIcons.user, size: 20),
            activeIcon: FaIcon(FontAwesomeIcons.solidUser, size: 20),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}

// Provider pour gérer l'index de navigation actuel
final currentNavIndexProvider = StateProvider<int>((ref) => 0);
