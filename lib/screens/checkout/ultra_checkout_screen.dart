import 'dart:convert';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart' as provider;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart' as app_auth;
import '../../services/order_service.dart';
import '../../services/background_location_tracking_service.dart';
import '../../services/mandatory_location_service.dart';
import '../../utils/error_handler.dart';
import '../../localization/app_localizations.dart';

class UltraCheckoutScreen extends ConsumerStatefulWidget {
  const UltraCheckoutScreen({super.key});

  @override
  ConsumerState<UltraCheckoutScreen> createState() => _UltraCheckoutScreenState();
}

class _UltraCheckoutScreenState extends ConsumerState<UltraCheckoutScreen>
    with TickerProviderStateMixin {
  static const double _shippingFee = 1000.0;
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  ProviderSubscription<app_auth.AuthState>? _authSub;
  
  bool _isGettingLocation = false;
  double? _deliveryLat;
  double? _deliveryLng;
  double? _deliveryAccuracy;

  late AnimationController _animController;
  late Animation<double> _fadeAnim;
  
  bool _isProcessing = false;
  /// After a successful API order, block duplicate submissions even if the cart UI lags.
  bool _checkoutSuccess = false;
  String _paymentMethod = 'cash_on_delivery';

  void _applyProfilePrefill(app_auth.AuthState authState) {
    final profile = authState.profile;
    if (profile == null) return;

    if (_nameController.text.trim().isEmpty) {
      final parts = <String>[];
      final first = profile.firstName?.trim();
      final last = profile.lastName?.trim();
      if (first != null && first.isNotEmpty) parts.add(first);
      if (last != null && last.isNotEmpty) parts.add(last);
      final fullName = parts.join(' ');
      if (fullName.isNotEmpty) _nameController.text = fullName;
    }
    if (_phoneController.text.trim().isEmpty) {
      final phone = profile.phone?.trim();
      if (phone != null && phone.isNotEmpty) _phoneController.text = phone;
    }
    if (_addressController.text.trim().isEmpty) {
      final address = profile.address?.trim();
      if (address != null && address.isNotEmpty) _addressController.text = address;
    }
    if (_cityController.text.trim().isEmpty) {
      final city = profile.city?.trim();
      if (city != null && city.isNotEmpty) _cityController.text = city;
    }
  }

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

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _applyProfilePrefill(ref.read(app_auth.authProvider));
      _autoCaptureGPS();
    });

    _authSub = ref.listenManual<app_auth.AuthState>(
      app_auth.authProvider,
      (previous, next) {
        _applyProfilePrefill(next);
      },
    );
  }

  @override
  void dispose() {
    _authSub?.close();
    _animController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  void _handleCheckoutBack() {
    if (!mounted) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/cart');
    }
  }

  Future<void> _autoCaptureGPS() async {
    if (!mounted) return;
    setState(() => _isGettingLocation = true);

    try {
      final service = BackgroundLocationTrackingService();
      final position = service.lastPosition ?? await service.getCurrentPosition();
      
      if (position != null && mounted) {
        setState(() {
          _deliveryLat = position.latitude;
          _deliveryLng = position.longitude;
          _deliveryAccuracy = position.accuracy;
        });
      }
    } catch (e) {
      debugPrint('Auto GPS capture error: $e');
    } finally {
      if (mounted) {
        setState(() => _isGettingLocation = false);
      }
    }
  }

  Future<void> _captureDeliveryLocation() async {
    if (kIsWeb) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Géolocalisation disponible sur mobile.')),
      );
      return;
    }

    if (_isGettingLocation) return;
    setState(() => _isGettingLocation = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return;
        final shouldOpen = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Services de localisation désactivés'),
            content: const Text('Activez les services de localisation pour continuer'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Annuler'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Ouvrir les paramètres'),
              ),
            ],
          ),
        );
        if (shouldOpen == true) {
          await Geolocator.openLocationSettings();
        }
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        final shouldOpen = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Permission de localisation refusée'),
            content: const Text('Permission de localisation refusée définitivement. Veuillez l\'activer dans les paramètres.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Annuler'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Ouvrir les paramètres'),
              ),
            ],
          ),
        );
        if (shouldOpen == true) {
          await Geolocator.openAppSettings();
        }
        return;
      }

      if (permission == LocationPermission.denied) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission de localisation requise.')),
        );
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );

      if (!mounted) return;
      setState(() {
        _deliveryLat = position.latitude;
        _deliveryLng = position.longitude;
        _deliveryAccuracy = position.accuracy;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Position enregistrée (±${position.accuracy.toStringAsFixed(0)}m)',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Impossible de récupérer la position: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isGettingLocation = false);
      }
    }
  }

  Future<void> _submitOrder() async {
    if (_checkoutSuccess || _isProcessing) return;
    if (!_formKey.currentState!.validate()) return;

    final cartEarly = provider.Provider.of<CartProvider>(context, listen: false);
    if (cartEarly.items.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Panier vide')),
        );
      }
      return;
    }

    // VALIDATION GPS OBLIGATOIRE
    final gpsValid = await MandatoryLocationService().validateForCheckout(context);
    if (!gpsValid) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('GPS requis pour passer commande. Activez votre localisation.'),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 5),
          ),
        );
      }
      return;
    }
    
    setState(() => _isProcessing = true);
    HapticFeedback.heavyImpact();
    
    try {
      final cart = provider.Provider.of<CartProvider>(context, listen: false);
      final cartItems = cart.items;
      final subtotalFcfa = cart.totalAmount;

      final authState = ref.read(app_auth.authProvider);
      final user = authState.user;
      final profile = authState.profile;

       print('[Checkout] submit order: userId=${user?.id}, email=${user?.email}');
       print('[Checkout] profile.id=${profile?.id}');

      final orderData = {
        'user_id': user?.id,
        'status': 'pending',
        'payment_method': _paymentMethod,
        'payment_provider': _paymentMethod == 'stripe_card'
            ? 'stripe'
            : _paymentMethod == 'flutterwave_card'
                ? 'flutterwave'
                : 'manual',
        'payment_status': 'pending',
        'currency': 'XAF',
        'total_amount': subtotalFcfa + _shippingFee,
        'shipping_fee': _shippingFee,
        'tax_amount': 0.0,
        'discount_amount': 0.0,
        'customer_name': _nameController.text,
        'customer_phone': _phoneController.text,
        'customer_email': user?.email,
        'shipping_country': profile?.country ?? 'Tchad',
        'shipping_city': _cityController.text,
        'shipping_district': profile?.address ?? _addressController.text,
        'shipping_address': _addressController.text,
        'delivery_lat': _deliveryLat,
        'delivery_lng': _deliveryLng,
        'delivery_accuracy': _deliveryAccuracy,
        'delivery_captured_at': (_deliveryLat != null && _deliveryLng != null)
            ? DateTime.now().toUtc().toIso8601String()
            : null,
        'items': cartItems.map((item) => {
          'product_id': item.product?.id,
          'product_name': item.product?.name,
          'product_image': item.product?.mainImage,
          'quantity': item.quantity,
          'unit_price': (item.product?.price ?? 0),
          'total_price': (item.product?.price ?? 0) * item.quantity,
        }).toList(),
      };

       print('[Checkout] orderData.user_id runtimeType=${orderData['user_id']?.runtimeType}');
       print('[Checkout] orderData payload: ${jsonEncode(orderData)}');
      
      final result = await OrderService().createOrder(orderData);
      
      if (result['success'] != true) {
        throw Exception(result['error']?.toString() ?? 'Erreur lors de la création de commande');
      }

      // Payment is cash on delivery - no payment processing needed

      if (!mounted) return;
      setState(() => _checkoutSuccess = true);

      await cart.clearCart();

      if (!mounted) return;
      setState(() {});

      if (cart.items.isNotEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Commande enregistrée. Le panier n\'a pas pu être vidé (réseau) — vérifiez Mes commandes.',
            ),
            duration: Duration(seconds: 5),
          ),
        );
      }

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => _buildSuccessDialog(result['order_number']),
        );
      }
    } catch (e) {
      if (!mounted) return;
      final localizations = AppLocalizations.of(context);
      final sanitizedError = ErrorHandler.getLocalizedError(e, localizations.locale.languageCode);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(sanitizedError),
          backgroundColor: Colors.red,
          behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
          margin: kIsWeb ? null : const EdgeInsets.fromLTRB(16, 0, 16, 90),
        ),
      );
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cart = provider.Provider.of<CartProvider>(context);
    final cartItems = cart.items;
    final subtotalFcfa = cart.totalAmount;

    if (cartItems.isEmpty && !_checkoutSuccess) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          _handleCheckoutBack();
        },
        child: Scaffold(
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(FontAwesomeIcons.cartShopping, size: 48),
                    const SizedBox(height: 16),
                    Text(
                      'Panier vide',
                      style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => context.go('/cart'),
                      child: const Text('Retour au panier'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleCheckoutBack();
      },
      child: Scaffold(
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
                                _buildPriceRow('Sous-total', subtotalFcfa, theme),
                                _buildPriceRow('Livraison', _shippingFee, theme),
                                _buildPriceRow('Total', subtotalFcfa + _shippingFee, theme, isTotal: true),
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
                                  subtitle: const Text('Payez en espèces lors de la réception'),
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
      bottomNavigationBar: _checkoutSuccess
          ? null
          : _buildBottomBar(theme, subtotalFcfa, cartItems.isEmpty),
    ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          IconButton(
            onPressed: _handleCheckoutBack,
            icon: const Icon(FontAwesomeIcons.arrowLeft),
            style: IconButton.styleFrom(
              backgroundColor: theme.colorScheme.surface,
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
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: Theme.of(context).brightness == Brightness.dark
            ? []
            : [
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
        fillColor: Theme.of(context).brightness == Brightness.dark
            ? Theme.of(context).colorScheme.surfaceContainerHighest
            : Colors.grey.shade50,
      ),
    );
  }

  Widget _buildOrderItem(item, ThemeData theme) {
    final unitFcfa = (item.product?.price ?? 0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Theme.of(context).brightness == Brightness.dark
                  ? Theme.of(context).colorScheme.surfaceContainerHighest
                  : Colors.grey.shade200,
              image: item.product?.mainImage != null && item.product!.mainImage!.isNotEmpty
                  ? DecorationImage(
                      image: NetworkImage(item.product!.mainImage!),
                      fit: BoxFit.cover,
                      onError: (_, __) {},
                    )
                  : null,
            ),
            child: item.product?.mainImage == null || item.product!.mainImage!.isEmpty
                ? Icon(FontAwesomeIcons.boxOpen, color: Theme.of(context).colorScheme.onSurfaceVariant, size: 20)
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
                  '${item.quantity} x ${unitFcfa.toStringAsFixed(0)} FCFA',
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12),
                ),
              ],
            ),
          ),
          Text(
            '${(unitFcfa * item.quantity).toStringAsFixed(0)} FCFA',
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

  Widget _buildBottomBar(ThemeData theme, double subtotalFcfa, bool cartEmpty) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        boxShadow: theme.brightness == Brightness.dark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
      ),
      child: ElevatedButton(
        onPressed: (_isProcessing || _checkoutSuccess || cartEmpty) ? null : _submitOrder,
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
                'Confirmer (${(subtotalFcfa + _shippingFee).toStringAsFixed(0)} FCFA)',
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
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      backgroundColor: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF667eea), Color(0xFF764ba2)],
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF667eea).withOpacity(0.4),
              blurRadius: 30,
              offset: const Offset(0, 15),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: const Icon(
                  FontAwesomeIcons.circleCheck,
                  color: Color(0xFF667eea),
                  size: 40,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Commande confirmée !',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'N° $orderNumber',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Votre commande est en cours de traitement.\nUn livreur sera automatiquement assigné.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.white.withOpacity(0.95),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        context.go('/home');
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white, width: 2),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Accueil',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        context.go('/orders');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF667eea),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        elevation: 8,
                        shadowColor: Colors.black.withOpacity(0.3),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'Mes commandes',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
