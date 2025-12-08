import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:ui';
import '../../services/order_service.dart';
import '../../widgets/bottom_nav_bar.dart';

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
  String _filter = 'all';
  
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
    _orderService.ordersStream().listen((orders) {
      if (mounted) {
        setState(() {
          _orders = orders;
        });
      }
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoading = true);
    try {
      final orders = await _orderService.getUserOrders();
      setState(() {
        _orders = orders;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> get filteredOrders {
    if (_filter == 'all') return _orders;
    return _orders.where((order) => order['status'] == _filter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
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
                      : filteredOrders.isEmpty
                          ? _buildEmptyState(theme)
                          : _buildOrdersList(theme),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: const BottomNavBar(currentIndex: 3),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            onPressed: () => context.pop(),
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
                  'Mes Commandes',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${_orders.length} commande(s) au total',
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
    final filters = [
      {'value': 'all', 'label': 'Toutes'},
      {'value': 'pending', 'label': 'En attente'},
      {'value': 'confirmed', 'label': 'Confirmées'},
      {'value': 'shipped', 'label': 'Expédiées'},
      {'value': 'delivered', 'label': 'Livrées'},
      {'value': 'cancelled', 'label': 'Annulées'},
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
                      '${items.length} article(s)',
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
                        'Total',
                        style: theme.textTheme.bodyMedium,
                      ),
                      Text(
                        '${order['total_amount']?.toStringAsFixed(0) ?? '0'} FCFA',
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
    return const Center(
      child: CircularProgressIndicator(),
    );
  }

  Widget _buildEmptyState(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            FontAwesomeIcons.boxOpen,
            size: 80,
            color: Colors.grey.shade300,
          ),
          const SizedBox(height: 20),
          Text(
            'Aucune commande',
            style: theme.textTheme.titleLarge?.copyWith(
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Vos commandes apparaîtront ici',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 30),
          ElevatedButton.icon(
            onPressed: () => context.go('/home'),
            icon: const Icon(FontAwesomeIcons.arrowLeft),
            label: const Text('Continuer vos achats'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: 30,
                vertical: 15,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(30),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showOrderDetails(Map<String, dynamic> order, ThemeData theme) {
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
              'Détails de la commande',
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
                    // Order info
                    _buildDetailSection(
                      'Informations',
                      [
                        _buildDetailRow('Numéro', order['order_number']),
                        _buildDetailRow('Date', _formatDate(order['created_at'])),
                        _buildDetailRow('Statut', _getStatusLabel(order['status'])),
                        _buildDetailRow('Paiement', order['payment_method'] ?? 'N/A'),
                      ],
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Shipping address
                    if (order['shipping_address'] != null) ...[
                      _buildDetailSection(
                        'Adresse de livraison',
                        [
                          _buildDetailRow('Nom', order['shipping_address']['name']),
                          _buildDetailRow('Téléphone', order['shipping_address']['phone']),
                          _buildDetailRow('Adresse', order['shipping_address']['address']),
                          _buildDetailRow('Ville', order['shipping_address']['city']),
                        ],
                      ),
                      const SizedBox(height: 20),
                    ],
                    
                    // Items
                    Text(
                      'Articles',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
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
                            child: Icon(
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
                                  item['product_name'] ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  '${item['quantity']} x ${item['unit_price']?.toStringAsFixed(0)} FCFA',
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${item['total_price']?.toStringAsFixed(0)} FCFA',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                    )),
                    
                    const Divider(height: 30),
                    
                    // Totals
                    _buildDetailRow('Sous-total', '${order['subtotal']?.toStringAsFixed(0)} FCFA'),
                    _buildDetailRow('Livraison', '${order['shipping_cost']?.toStringAsFixed(0)} FCFA'),
                    const SizedBox(height: 10),
                    _buildDetailRow(
                      'Total',
                      '${order['total_amount']?.toStringAsFixed(0)} FCFA',
                      isTotal: true,
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
            value ?? 'N/A',
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
    if (dateStr == null) return 'N/A';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day}/${date.month}/${date.year} à ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateStr;
    }
  }

  String _getStatusLabel(String? status) {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'confirmed':
        return 'Confirmée';
      case 'processing':
        return 'En traitement';
      case 'shipped':
        return 'Expédiée';
      case 'delivered':
        return 'Livrée';
      case 'cancelled':
        return 'Annulée';
      default:
        return status ?? 'Inconnu';
    }
  }
}
