import 'dart:convert';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart' as provider;
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/order_service.dart';

class UltraCheckoutScreen extends ConsumerStatefulWidget {
  const UltraCheckoutScreen({super.key});

  @override
  ConsumerState<UltraCheckoutScreen> createState() => _UltraCheckoutScreenState();
}

class _UltraCheckoutScreenState extends ConsumerState<UltraCheckoutScreen>
    with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  
  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  
  bool _isProcessing = false;
  String _paymentMethod = 'cash_on_delivery';

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
  }

  @override
  void dispose() {
    _animController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _submitOrder() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _isProcessing = true);
    HapticFeedback.heavyImpact();
    
    try {
      final cart = provider.Provider.of<CartProvider>(context, listen: false);
      final cartItems = cart.items;
      final total = cart.totalAmount;

      final authState = ref.read(authProvider);
      final user = authState.user;
      final profile = authState.profile;

       print('[Checkout] submit order: userId=${user?.id}, email=${user?.email}');
       print('[Checkout] profile.id=${profile?.id}');

      const shippingFee = 2000.0;

      final orderData = {
        'user_id': user?.id,
        'status': 'pending',
        'payment_method': _paymentMethod,
        'payment_status': 'pending',
        'total_amount': total + shippingFee,
        'shipping_fee': shippingFee,
        'tax_amount': 0.0,
        'discount_amount': 0.0,
        'customer_name': _nameController.text,
        'customer_phone': _phoneController.text,
        'customer_email': user?.email,
        'shipping_country': profile?.country ?? 'Tchad',
        'shipping_city': _cityController.text,
        'shipping_district': profile?.address ?? _addressController.text,
        'shipping_address': _addressController.text,
        'items': cartItems.map((item) => {
          'product_id': item.product?.id,
          'product_name': item.product?.name,
          'product_image': item.product?.mainImage,
          'quantity': item.quantity,
          'unit_price': item.product?.price,
          'total_price': (item.product?.price ?? 0) * item.quantity,
        }).toList(),
      };

       print('[Checkout] orderData.user_id runtimeType=${orderData['user_id']?.runtimeType}');
       print('[Checkout] orderData payload: ${jsonEncode(orderData)}');
      
      final result = await OrderService().createOrder(orderData);
      
      if (result['success']) {
        await cart.clearCart();
        
        if (mounted) {
          // Show success dialog
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (context) => _buildSuccessDialog(result['order_number']),
          );
        }
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cart = provider.Provider.of<CartProvider>(context);
    final cartItems = cart.items;
    final total = cart.totalAmount;
    
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              theme.colorScheme.primary.withOpacity(0.05),
              theme.colorScheme.secondary.withOpacity(0.03),
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnim,
            child: CustomScrollView(
              slivers: [
                // Header
                SliverToBoxAdapter(
                  child: _buildHeader(theme),
                ),
                
                // Form
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        children: [
                          _buildSectionCard(
                            title: '📍 Adresse de livraison',
                            child: Column(
                              children: [
                                _buildTextField(
                                  controller: _nameController,
                                  label: 'Nom complet',
                                  icon: FontAwesomeIcons.user,
                                ),
                                const SizedBox(height: 15),
                                _buildTextField(
                                  controller: _phoneController,
                                  label: 'Téléphone',
                                  icon: FontAwesomeIcons.phone,
                                  keyboardType: TextInputType.phone,
                                ),
                                const SizedBox(height: 15),
                                _buildTextField(
                                  controller: _addressController,
                                  label: 'Adresse',
                                  icon: FontAwesomeIcons.locationDot,
                                  maxLines: 2,
                                ),
                                const SizedBox(height: 15),
                                _buildTextField(
                                  controller: _cityController,
                                  label: 'Ville',
                                  icon: FontAwesomeIcons.city,
                                ),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 20),
                          
                          _buildSectionCard(
                            title: '🛒 Récapitulatif',
                            child: Column(
                              children: [
                                ...cartItems.map((item) => _buildOrderItem(item, theme)),
                                const Divider(height: 30),
                                _buildPriceRow('Sous-total', total, theme),
                                _buildPriceRow('Livraison', 1000, theme),
                                _buildPriceRow('Total', total + 1000, theme, isTotal: true),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 20),
                          
                          _buildSectionCard(
                            title: '💳 Paiement',
                            child: Column(
                              children: [
                                RadioListTile<String>(
                                  value: 'cash_on_delivery',
                                  groupValue: _paymentMethod,
                                  onChanged: (value) => setState(() => _paymentMethod = value!),
                                  title: const Text('Paiement à la livraison'),
                                  subtitle: const Text('Payez en espèces'),
                                  secondary: const Icon(FontAwesomeIcons.moneyBill),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _buildBottomBar(theme, total),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/cart');
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
          Text(
            'Finaliser la commande',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Ce champ est requis';
        }
        return null;
      },
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        filled: true,
        fillColor: Colors.grey.shade50,
      ),
    );
  }

  Widget _buildOrderItem(item, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey.shade200,
              image: item.product?.mainImage != null && item.product!.mainImage!.isNotEmpty
                  ? DecorationImage(
                      image: NetworkImage(item.product!.mainImage!),
                      fit: BoxFit.cover,
                      onError: (_, __) {},
                    )
                  : null,
            ),
            child: item.product?.mainImage == null || item.product!.mainImage!.isEmpty
                ? Icon(FontAwesomeIcons.boxOpen, color: Colors.grey.shade400, size: 20)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.product?.name ?? '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${item.quantity} x ${item.product?.price.toStringAsFixed(0)} FCFA',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                ),
              ],
            ),
          ),
          Text(
            '${((item.product?.price ?? 0) * item.quantity).toStringAsFixed(0)} FCFA',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceRow(String label, double amount, ThemeData theme, {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              fontSize: isTotal ? 18 : 14,
            ),
          ),
          Text(
            '${amount.toStringAsFixed(0)} FCFA',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: isTotal ? 18 : 14,
              color: isTotal ? theme.colorScheme.primary : null,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(ThemeData theme, double total) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: ElevatedButton(
        onPressed: _isProcessing ? null : _submitOrder,
        style: ElevatedButton.styleFrom(
          backgroundColor: theme.colorScheme.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
        ),
        child: _isProcessing
            ? const CircularProgressIndicator(color: Colors.white)
            : Text(
                'Confirmer (${(total + 1000).toStringAsFixed(0)} FCFA)',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }

  Widget _buildSuccessDialog(String orderNumber) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              FontAwesomeIcons.circleCheck,
              color: Colors.green,
              size: 60,
            ),
            const SizedBox(height: 20),
            const Text(
              'Commande confirmée!',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'N° $orderNumber',
              style: const TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 30),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.go('/home');
                    },
                    child: const Text('Continuer'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      context.go('/orders');
                    },
                    child: const Text('Mes commandes'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
