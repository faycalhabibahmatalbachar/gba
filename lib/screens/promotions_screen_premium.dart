import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:badges/badges.dart' as badges;
import '../models/product.dart';
import '../providers/cart_provider.dart';
import '../providers/product_provider.dart';
import '../widgets/product_card_premium.dart';

class PromotionsScreenPremium extends StatefulWidget {
  const PromotionsScreenPremium({super.key});

  @override
  State<PromotionsScreenPremium> createState() => _PromotionsScreenPremiumState();
}

class _PromotionsScreenPremiumState extends State<PromotionsScreenPremium> {
  String _selectedTab = 'promos';

  int _discountPercent(Product p) {
    final cap = p.compareAtPrice;
    if (cap == null || cap <= 0 || cap <= p.price) return 0;
    return ((1 - (p.price / cap)) * 100).round();
  }

  List<Product> _filtered(List<Product> all) {
    final active = all.where((p) => p.isActive).toList();

    final discounted = active
        .where((p) => p.compareAtPrice != null && p.compareAtPrice! > p.price)
        .toList()
      ..sort((a, b) => _discountPercent(b).compareTo(_discountPercent(a)));

    final promoTagged = active
        .where((p) => p.tags.any((t) {
              final s = t.toLowerCase().trim();
              return s == 'promo' || s == 'promotion' || s.contains('promo');
            }))
        .toList();

    final promos = <String, Product>{
      for (final p in discounted) p.id: p,
      for (final p in promoTagged) p.id: p,
    }.values.toList();

    final featured = active.where((p) => p.isFeatured).toList();

    if (_selectedTab == 'featured') return featured;
    if (_selectedTab == 'all') return active;
    return promos;
  }

  @override
  Widget build(BuildContext context) {
    final productProvider = Provider.of<ProductProvider>(context);
    final cartProvider = Provider.of<CartProvider>(context);

    final products = productProvider.products;
    final filtered = _filtered(products);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: RefreshIndicator(
        onRefresh: () async {
          await productProvider.loadProducts(force: true);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: 120,
              backgroundColor: Colors.transparent,
              elevation: 0,
              automaticallyImplyLeading: false,
              flexibleSpace: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF667eea),
                      Color(0xFF764ba2),
                      Color(0xFFf093fb),
                    ],
                    stops: [0.0, 0.5, 1.0],
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Material(
                              color: Colors.white.withOpacity(0.18),
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () {
                                  HapticFeedback.lightImpact();
                                  final nav = Navigator.of(context);
                                  if (nav.canPop()) {
                                    context.pop();
                                  } else {
                                    context.go('/home');
                                  }
                                },
                                child: const SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Icon(
                                    Icons.arrow_back,
                                    color: Colors.white,
                                    size: 22,
                                  ),
                                ),
                              ),
                            ),
                            badges.Badge(
                              position: badges.BadgePosition.topEnd(top: -8, end: -8),
                              showBadge: cartProvider.itemCount > 0,
                              badgeContent: Text(
                                cartProvider.itemCount.toString(),
                                style: const TextStyle(color: Colors.white, fontSize: 10),
                              ),
                              badgeStyle: const badges.BadgeStyle(
                                badgeColor: Color(0xFFFF6B6B),
                                elevation: 0,
                              ),
                              child: Material(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(14),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(14),
                                  onTap: () {
                                    HapticFeedback.lightImpact();
                                    context.go('/cart');
                                  },
                                  child: const SizedBox(
                                    width: 44,
                                    height: 44,
                                    child: Icon(
                                      Icons.shopping_cart_outlined,
                                      color: Colors.white,
                                      size: 22,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Promotions',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                          ),
                        ),
                        Text(
                          'Offres limitées et réductions',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.9),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
                child: Row(
                  children: [
                    _TabChip(
                      label: 'Promos',
                      isSelected: _selectedTab == 'promos',
                      onTap: () => setState(() => _selectedTab = 'promos'),
                    ),
                    const SizedBox(width: 10),
                    _TabChip(
                      label: 'Vedettes',
                      isSelected: _selectedTab == 'featured',
                      onTap: () => setState(() => _selectedTab = 'featured'),
                    ),
                    const SizedBox(width: 10),
                    _TabChip(
                      label: 'Tout',
                      isSelected: _selectedTab == 'all',
                      onTap: () => setState(() => _selectedTab = 'all'),
                    ),
                  ],
                ),
              ),
            ),
            if (productProvider.isLoading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(
                    color: Color(0xFF667eea),
                  ),
                ),
              )
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.local_offer_outlined,
                          size: 56,
                          color: Colors.grey.shade400,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _selectedTab == 'featured'
                              ? 'Aucune vedette pour le moment'
                              : _selectedTab == 'all'
                                  ? 'Aucun produit disponible'
                                  : 'Aucune promotion en cours',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.grey.shade600,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Tire vers le bas pour rafraîchir',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 90),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.55,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      return PremiumProductCard(product: filtered[index]);
                    },
                    childCount: filtered.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _TabChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected ? const Color(0xFF667eea) : Colors.white,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : const Color(0xFF2D3748),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
