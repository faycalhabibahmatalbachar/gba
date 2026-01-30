import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../animations/app_animations.dart';
import '../../localization/app_localizations.dart';
import '../../services/order_service.dart';
import '../../widgets/adaptive_scaffold.dart';
import '../../widgets/app_state_view.dart';

class MyOrdersScreen extends ConsumerStatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  ConsumerState<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends ConsumerState<MyOrdersScreen>
    with TickerProviderStateMixin {
  final OrderService _orderService = OrderService();
  List<Map<String, dynamic>> _orders = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _filter = 'all';
  StreamSubscription<List<Map<String, dynamic>>>? _ordersSubscription;
  
  late AnimationController _animController;
  late Animation<double> _fadeAnim;

  final Map<String, Color> statusColors = {
    'pending': Colors.orange,
    'confirmed': Colors.blue,
    'processing': Colors.purple,
    'shipped': Colors.indigo,
    'delivered': Colors.green,
    'cancelled': Colors.red,
  };

  final Map<String, IconData> statusIcons = {
    'pending': FontAwesomeIcons.clock,
    'confirmed': FontAwesomeIcons.checkCircle,
    'processing': FontAwesomeIcons.gears,
    'shipped': FontAwesomeIcons.truck,
    'delivered': FontAwesomeIcons.circleCheck,
    'cancelled': FontAwesomeIcons.xmark,
  };

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    )..forward();
    
    _fadeAnim = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeInOut,
    ));
    
    _loadOrders();
    
    // Écouter les changements en temps réel
    _ordersSubscription = _orderService.ordersStream().listen((orders) {
      if (!mounted) return;

      final incomingIds = orders.map((o) => o['id']).whereType<String>().toSet();
      final existingIds = _orders.map((o) => o['id']).whereType<String>().toSet();
      final hasNewOrMissing = incomingIds.difference(existingIds).isNotEmpty ||
          existingIds.difference(incomingIds).isNotEmpty;

      // Ne pas écraser la liste détaillée (order_details_view) par les lignes brutes (orders).
      // On merge uniquement les champs qui changent souvent (status/updated_at).
      setState(() {
        final byId = <String, Map<String, dynamic>>{};
        for (final o in orders) {
          final id = o['id'];
          if (id is String) {
            byId[id] = o;
          }
        }

        _orders = _orders.map((existing) {
          final id = existing['id'];
          if (id is! String) return existing;
          final updated = byId[id];
          if (updated == null) return existing;

          return {
            ...existing,
            'status': updated['status'],
            'updated_at': updated['updated_at'],
          };
        }).toList();
      });

      // Si une commande a été ajoutée/supprimée, on refetch pour récupérer items/images.
      if (hasNewOrMissing) {
        _loadOrders();
      }
    });
  }

  @override
  void dispose() {
    _ordersSubscription?.cancel();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final cached = await _orderService.getCachedUserOrders();
      if (mounted && cached.isNotEmpty) {
        setState(() {
          _orders = cached;
          _isLoading = false;
        });
      }

      final orders = await _orderService.getUserOrders();
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _isLoading = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  List<Map<String, dynamic>> get filteredOrders {
    if (_filter == 'all') return _orders;
    return _orders.where((order) => order['status'] == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return AdaptiveScaffold(
      currentIndex: 4,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.primary.withOpacity(0.05),
              theme.colorScheme.secondary.withOpacity(0.03),
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: Column(
              children: [
                _buildHeader(theme),
                _buildFilterChips(theme),
                Expanded(
                  child: _isLoading
                      ? _buildLoadingState()
                      : (_orders.isEmpty && _errorMessage != null)
                          ? _buildErrorState()
                          : filteredOrders.isEmpty
                              ? _orders.isEmpty
                                  ? _buildEmptyState(theme)
                                  : _buildNoResultsState()
                              : _buildOrdersList(theme),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
            icon: const Icon(FontAwesomeIcons.arrowLeft),
            style: IconButton.styleFrom(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  localizations.translate('my_orders_title'),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  localizations.translateParams(
                    'orders_total_count',
                    {'count': _orders.length.toString()},
                  ),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: _loadOrders,
            icon: const Icon(FontAwesomeIcons.arrowsRotate),
            style: IconButton.styleFrom(
              backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    final filters = [
      {'value': 'all', 'label': localizations.translate('all')},
      {'value': 'pending', 'label': localizations.translate('order_status_pending')},
      {'value': 'confirmed', 'label': localizations.translate('order_status_confirmed')},
      {'value': 'shipped', 'label': localizations.translate('order_status_shipped')},
      {'value': 'delivered', 'label': localizations.translate('order_status_delivered')},
      {'value': 'cancelled', 'label': localizations.translate('order_status_cancelled')},
    ];
    
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        itemBuilder: (context, index) {
          final filter = filters[index];
          final isSelected = _filter == filter['value'];
          
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: ChoiceChip(
              label: Text(filter['label']!),
              selected: isSelected,
              onSelected: (selected) {
                setState(() {
                  _filter = filter['value']!;
                });
              },
              selectedColor: theme.colorScheme.primary,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : null,
                fontWeight: isSelected ? FontWeight.bold : null,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildOrdersList(ThemeData theme) {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: filteredOrders.length,
      itemBuilder: (context, index) {
        final order = filteredOrders[index];
        return TweenAnimationBuilder<double>(
          duration: Duration(milliseconds: 300 + (index * 100)),
          tween: Tween(begin: 0, end: 1),
          builder: (context, value, child) {
            return Transform.translate(
              offset: Offset(0, 20 * (1 - value)),
              child: Opacity(
                opacity: value,
                child: _buildOrderCard(order, theme),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order, ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    final status = order['status'] ?? 'pending';
    final statusColor = statusColors[status] ?? Colors.grey;
    final statusIcon = statusIcons[status] ?? FontAwesomeIcons.question;
    final items = order['items'] as List? ?? [];
    
    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: statusColor.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => _showOrderDetails(order, theme),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            order['order_number'] ?? '',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            _formatDate(order['created_at']),
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: statusColor.withOpacity(0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              statusIcon,
                              size: 14,
                              color: statusColor,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _getStatusLabel(status),
                              style: TextStyle(
                                color: statusColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  
                  const SizedBox(height: 15),
                  
                  // Items preview
                  if (items.isNotEmpty) ...[
                    Text(
                      localizations.translateParams(
                        'items_count',
                        {'count': items.length.toString()},
                      ),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey,
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 60,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: items.length > 3 ? 3 : items.length,
                        itemBuilder: (context, index) {
                          if (index == 2 && items.length > 3) {
                            return Container(
                              width: 60,
                              height: 60,
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Center(
                                child: Text(
                                  '+${items.length - 2}',
                                  style: TextStyle(
                                    color: theme.colorScheme.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            );
                          }
                          
                          final item = items[index];
                          return Container(
                            width: 60,
                            height: 60,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              color: Colors.grey.shade200,
                            ),
                            child: item['product_image'] != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(10),
                                    child: Image.network(
                                      item['product_image'],
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Icon(
                                        FontAwesomeIcons.boxOpen,
                                        color: Colors.grey.shade400,
                                      ),
                                    ),
                                  )
                                : Icon(
                                    FontAwesomeIcons.boxOpen,
                                    color: Colors.grey.shade400,
                                  ),
                          );
                        },
                      ),
                    ),
                  ],
                  
                  const Divider(height: 20),
                  
                  // Total
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        localizations.translate('total'),
                        style: theme.textTheme.bodyMedium,
                      ),
                      Text(
                        '${(((order['total_amount'] as num?) ?? 0)).toStringAsFixed(0)} FCFA',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingState() {
    return const AppStateView(
      state: AppViewState.loading,
      animationId: AppAnimations.loadingSpinner,
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    return AppStateView(
      state: AppViewState.empty,
      animationId: AppAnimations.emptyBox,
      title: localizations.translate('no_orders'),
      subtitle: localizations.translate('no_orders_hint'),
      primaryActionLabel: localizations.translate('continue_shopping'),
      onPrimaryAction: () => context.go('/home'),
    );
  }

  Widget _buildNoResultsState() {
    final localizations = AppLocalizations.of(context);
    return AppStateView(
      state: AppViewState.empty,
      animationId: AppAnimations.searchNoResult,
      title: localizations.translate('no_results'),
      subtitle: localizations.translate('try_another_keyword'),
      primaryActionLabel: localizations.translate('clear_filter'),
      onPrimaryAction: () {
        setState(() {
          _filter = 'all';
        });
      },
    );
  }

  Widget _buildErrorState() {
    final localizations = AppLocalizations.of(context);
    return AppStateView(
      state: AppViewState.error,
      animationId: AppAnimations.errorNoInternet,
      title: localizations.translate('error_loading'),
      subtitle: _errorMessage,
      primaryActionLabel: localizations.translate('retry'),
      onPrimaryAction: _loadOrders,
    );
  }

  void _showOrderDetails(Map<String, dynamic> order, ThemeData theme) {
    final localizations = AppLocalizations.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.8,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              width: 50,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              localizations.translate('order_details_title'),
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Builder(
                      builder: (context) {
                        final clientRows = <Widget>[
                          _buildDetailRow(localizations.translate('name'), order['customer_name']?.toString()),
                          _buildDetailRow(localizations.translate('phone'), order['customer_phone']?.toString()),
                          _buildDetailRow(localizations.translate('email'), order['customer_email']?.toString()),
                        ].where((w) => w is! SizedBox).toList();

                        final shippingRows = <Widget>[
                          _buildDetailRow(localizations.translate('country'), order['shipping_country']?.toString()),
                          _buildDetailRow(localizations.translate('city'), order['shipping_city']?.toString()),
                          _buildDetailRow(localizations.translate('district'), order['shipping_district']?.toString()),
                          _buildDetailRow(localizations.translate('address'), order['shipping_address']?.toString()),
                        ].where((w) => w is! SizedBox).toList();

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                    // Order info
                    _buildDetailSection(
                      localizations.translate('order_information'),
                      [
                        _buildDetailRow(localizations.translate('number'), order['order_number']),
                        _buildDetailRow(localizations.translate('date'), _formatDate(order['created_at'])),
                        _buildDetailRow(localizations.translate('label_status'), _getStatusLabel(order['status'])),
                        _buildDetailRow(
                          localizations.translate('payment'),
                          (order['payment_method'] ?? localizations.translate('not_available'))?.toString(),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Shipping address
                    if (clientRows.isNotEmpty) ...[
                      _buildDetailSection(localizations.translate('customer'), clientRows),
                      const SizedBox(height: 20),
                    ],

                    if (shippingRows.isNotEmpty) ...[
                      _buildDetailSection(localizations.translate('shipping_address_title'), shippingRows),
                      const SizedBox(height: 20),
                    ],
                    
                    // Items
                    Text(
                      localizations.translate('items'),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if ((order['items'] as List? ?? []).isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(
                          localizations.translate('no_items'),
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ),
                    const SizedBox(height: 10),
                    ...(order['items'] as List? ?? []).map((item) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              color: Colors.white,
                            ),
                            child: (item is Map && item['product_image'] != null)
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.network(
                                      item['product_image'].toString(),
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Icon(
                                        FontAwesomeIcons.boxOpen,
                                        color: Colors.grey.shade400,
                                        size: 20,
                                      ),
                                    ),
                                  )
                                : Icon(
                                    FontAwesomeIcons.boxOpen,
                                    color: Colors.grey.shade400,
                                    size: 20,
                                  ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  (item is Map ? item['product_name'] : null)?.toString() ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  (() {
                                    final qty = (item is Map ? item['quantity'] : null) as num?;
                                    final unit = (item is Map ? item['unit_price'] : null) as num?;
                                    final qtyLabel = qty?.toStringAsFixed(0) ?? '0';
                                    final unitLabel = unit?.toStringAsFixed(0) ?? '0';
                                    return '$qtyLabel x $unitLabel FCFA';
                                  })(),
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${(((item is Map ? item['total_price'] : null) as num?) ?? 0).toStringAsFixed(0)} FCFA',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )),
                    
                    const Divider(height: 30),
                    
                    // Totals
                    Builder(
                      builder: (context) {
                        final totalAmount = (order['total_amount'] as num?) ?? 0;
                        final shippingFee = (order['shipping_fee'] as num?) ?? 0;
                        final computedSubtotal = (totalAmount - shippingFee) < 0 ? 0 : (totalAmount - shippingFee);
                        return Column(
                          children: [
                            _buildDetailRow(
                              localizations.translate('subtotal'),
                              '${computedSubtotal.toStringAsFixed(0)} FCFA',
                            ),
                            _buildDetailRow(
                              localizations.translate('delivery'),
                              '${shippingFee.toStringAsFixed(0)} FCFA',
                            ),
                            const SizedBox(height: 10),
                            _buildDetailRow(
                              localizations.translate('total'),
                              '${totalAmount.toStringAsFixed(0)} FCFA',
                              isTotal: true,
                            ),
                          ],
                        );
                      },
                    ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 10),
        ...children,
      ],
    );
  }

  Widget _buildDetailRow(String label, String? value, {bool isTotal = false}) {
    final localizations = AppLocalizations.of(context);
    final notAvailable = localizations.translate('not_available');
    final normalized = value?.toString().trim();
    if (!isTotal &&
        (normalized == null ||
            normalized.isEmpty ||
            normalized.toLowerCase() == 'n/a' ||
            normalized == notAvailable)) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.grey.shade600,
              fontWeight: isTotal ? FontWeight.bold : null,
              fontSize: isTotal ? 16 : 14,
            ),
          ),
          Text(
            normalized ?? notAvailable,
            style: TextStyle(
              fontWeight: isTotal ? FontWeight.bold : FontWeight.w600,
              fontSize: isTotal ? 16 : 14,
              color: isTotal ? Theme.of(context).colorScheme.primary : null,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String? dateStr) {
    final localizations = AppLocalizations.of(context);
    if (dateStr == null) return localizations.translate('not_available');
    try {
      final date = DateTime.parse(dateStr);
      final localeTag = Localizations.localeOf(context).toLanguageTag();
      return DateFormat.yMd(localeTag).add_Hm().format(date);
    } catch (e) {
      return dateStr;
    }
  }

  String _getStatusLabel(String? status) {
    final localizations = AppLocalizations.of(context);
    switch (status) {
      case 'pending':
        return localizations.translate('order_status_pending');
      case 'confirmed':
        return localizations.translate('order_status_confirmed');
      case 'processing':
        return localizations.translate('order_status_processing');
      case 'shipped':
        return localizations.translate('order_status_shipped');
      case 'delivered':
        return localizations.translate('order_status_delivered');
      case 'cancelled':
        return localizations.translate('order_status_cancelled');
      case 'refunded':
        return localizations.translate('order_status_refunded');
      default:
        return localizations.translate('unknown');
    }
  }
}
