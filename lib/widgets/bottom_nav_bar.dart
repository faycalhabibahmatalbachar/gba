import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:ui';
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

class _BottomNavBarState extends ConsumerState<BottomNavBar> 
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  
  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.95,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));
  }
  
  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }
  
  void _onItemTapped(int index) {
    HapticFeedback.lightImpact();
    _animationController.forward().then((_) {
      _animationController.reverse();
    });
    
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
        color: Colors.white.withOpacity(0.95),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF667eea).withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.white.withOpacity(0.9),
                  Colors.white.withOpacity(0.95),
                ],
              ),
              border: Border(
                top: BorderSide(
                  color: const Color(0xFF667eea).withOpacity(0.1),
                  width: 0.5,
                ),
              ),
            ),
            child: SafeArea(
              top: false,
              child: SizedBox(
                height: 65,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildNavItem(
                      index: 0,
                      icon: FontAwesomeIcons.house,
                      activeIcon: FontAwesomeIcons.house,
                      label: 'Accueil',
                      isActive: widget.currentIndex == 0,
                    ),
                    _buildNavItem(
                      index: 1,
                      icon: FontAwesomeIcons.grip,
                      activeIcon: FontAwesomeIcons.grip,
                      label: 'Catégories',
                      isActive: widget.currentIndex == 1,
                    ),
                    _buildNavItem(
                      index: 2,
                      icon: FontAwesomeIcons.cartShopping,
                      activeIcon: FontAwesomeIcons.bagShopping,
                      label: 'Panier',
                      isActive: widget.currentIndex == 2,
                      hasBadge: true,
                      badgeCount: cartItemCount,
                    ),
                    _buildNavItem(
                      index: 3,
                      icon: FontAwesomeIcons.heart,
                      activeIcon: FontAwesomeIcons.solidHeart,
                      label: 'Favoris',
                      isActive: widget.currentIndex == 3,
                    ),
                    _buildNavItem(
                      index: 4,
                      icon: FontAwesomeIcons.user,
                      activeIcon: FontAwesomeIcons.solidUser,
                      label: 'Profil',
                      isActive: widget.currentIndex == 4,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
  
  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    required bool isActive,
    bool hasBadge = false,
    int badgeCount = 0,
  }) {
    return Expanded(
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: InkWell(
          onTap: () => _onItemTapped(index),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutBack,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  padding: EdgeInsets.symmetric(
                    horizontal: isActive ? 16 : 12,
                    vertical: isActive ? 8 : 6,
                  ),
                  decoration: BoxDecoration(
                    gradient: isActive
                        ? const LinearGradient(
                            colors: [
                              Color(0xFF667eea),
                              Color(0xFF764ba2),
                            ],
                          )
                        : null,
                    borderRadius: BorderRadius.circular(isActive ? 20 : 15),
                    boxShadow: isActive
                        ? [
                            BoxShadow(
                              color: const Color(0xFF667eea).withOpacity(0.3),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : [],
                  ),
                  child: hasBadge
                      ? badges.Badge(
                          position: badges.BadgePosition.topEnd(top: -8, end: -8),
                          showBadge: badgeCount > 0,
                          badgeAnimation: const badges.BadgeAnimation.scale(
                            animationDuration: Duration(milliseconds: 300),
                          ),
                          badgeContent: Text(
                            badgeCount.toString(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          badgeStyle: badges.BadgeStyle(
                            badgeColor: const Color(0xFFFF6B6B),
                            elevation: 0,
                            badgeGradient: const badges.BadgeGradient.linear(
                              colors: [Color(0xFFFF6B6B), Color(0xFFFF8E53)],
                            ),
                          ),
                          child: FaIcon(
                            isActive ? activeIcon : icon,
                            size: isActive ? 22 : 20,
                            color: isActive
                                ? Colors.white
                                : Colors.grey.shade600,
                          ),
                        )
                      : FaIcon(
                          isActive ? activeIcon : icon,
                          size: isActive ? 22 : 20,
                          color: isActive
                              ? Colors.white
                              : Colors.grey.shade600,
                        ),
                ),
                const SizedBox(height: 4),
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 300),
                  style: TextStyle(
                    fontSize: isActive ? 11 : 10,
                    fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                    color: isActive
                        ? const Color(0xFF667eea)
                        : Colors.grey.shade600,
                  ),
                  child: Text(label),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Provider pour gérer l'index de navigation actuel
final currentNavIndexProvider = StateProvider<int>((ref) => 0);
