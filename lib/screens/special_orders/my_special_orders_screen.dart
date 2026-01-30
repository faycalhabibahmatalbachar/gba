import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../../localization/app_localizations.dart';
import '../../services/special_order_service.dart';
import '../../widgets/adaptive_scaffold.dart';
import '../../widgets/app_state_view.dart';

class MySpecialOrdersScreen extends StatefulWidget {
  const MySpecialOrdersScreen({super.key});

  @override
  State<MySpecialOrdersScreen> createState() => _MySpecialOrdersScreenState();
}

class _MySpecialOrdersScreenState extends State<MySpecialOrdersScreen> {
  final SpecialOrderService _service = SpecialOrderService();

  bool _loading = true;
  List<Map<String, dynamic>> _orders = [];
  String? _errorMessage;

  void _showSnack(String message, {Color? backgroundColor}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        margin: kIsWeb ? null : const EdgeInsets.fromLTRB(16, 0, 16, 90),
        backgroundColor: backgroundColor,
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final orders = await _service.getUserSpecialOrders();
      if (!mounted) return;
      setState(() {
        _orders = orders;
        _loading = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;
      final localizations = AppLocalizations.of(context);
      final message = localizations.translateParams(
        'special_order_loading_error_with_details',
        {'error': e.toString()},
      );
      setState(() {
        _loading = false;
        _errorMessage = message;
      });
      _showSnack(
        message,
        backgroundColor: Colors.red,
      );
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'quoted':
        return Colors.blue;
      case 'countered':
        return Colors.purple;
      case 'accepted':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    final localizations = AppLocalizations.of(context);
    switch (status) {
      case 'pending':
        return localizations.translate('special_order_status_pending');
      case 'quoted':
        return localizations.translate('special_order_status_quoted');
      case 'countered':
        return localizations.translate('special_order_status_countered');
      case 'accepted':
        return localizations.translate('special_order_status_accepted');
      case 'rejected':
        return localizations.translate('special_order_status_rejected');
      default:
        return status;
    }
  }

  String _shippingLabel(String method) {
    final localizations = AppLocalizations.of(context);
    return method == 'air'
        ? localizations.translate('special_order_shipping_air')
        : localizations.translate('special_order_shipping_standard');
  }

  String _formatMoney(dynamic value, String currency) {
    final numVal = (value is num) ? value : num.tryParse(value?.toString() ?? '') ?? 0;
    if (currency.toUpperCase() == 'XOF') {
      return '${numVal.toStringAsFixed(0)} FCFA';
    }
    return '${numVal.toStringAsFixed(2)} ${currency.toUpperCase()}';
  }

  String _formatDate(dynamic iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso.toString());
    if (dt == null) return '';
    final local = dt.toLocal();
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return AdaptiveScaffold(
      currentIndex: 4,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
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
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      localizations.translate('my_special_orders'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                  ),
                  IconButton(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const AppStateView(state: AppViewState.loading)
                  : (_orders.isEmpty && _errorMessage != null)
                      ? AppStateView(
                          state: AppViewState.error,
                          title: localizations.translate('error_loading'),
                          subtitle: _errorMessage,
                          primaryActionLabel: localizations.translate('retry'),
                          onPrimaryAction: _load,
                        )
                      : _orders.isEmpty
                          ? AppStateView(
                              state: AppViewState.empty,
                              title: localizations.translate('special_order_empty_title'),
                              primaryActionLabel: localizations.translate('special_order_create_button'),
                              onPrimaryAction: () => context.go('/special-order'),
                              secondaryActionLabel: localizations.translate('refresh'),
                              onSecondaryAction: _load,
                            )
                          : RefreshIndicator(
                              onRefresh: _load,
                              child: ListView.separated(
                                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                                itemCount: _orders.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final o = _orders[index];
                                  final id = o['id']?.toString() ?? '';
                                  final status = o['status']?.toString() ?? 'pending';
                                  final quoteStatus = o['quote_status']?.toString();
                                  final displayStatus = quoteStatus ?? status;
                                  final currency = (o['currency']?.toString() ?? 'XOF');
                                  final quoteTotal = o['quote_total'];
                                  final etaMin = o['eta_min_date'];
                                  final etaMax = o['eta_max_date'];

                                  final title = o['product_name']?.toString() ??
                                      localizations.translate('special_order_generic_title');
                                  final qty = o['quantity']?.toString() ?? '';
                                  final shipping = _shippingLabel(o['shipping_method']?.toString() ?? 'other');

                                  return InkWell(
                                    onTap: () {
                                      if (id.isEmpty) return;
                                      context.push('/special-order/$id');
                                    },
                                    borderRadius: BorderRadius.circular(14),
                                    child: Container(
                                      padding: const EdgeInsets.all(14),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(color: Colors.grey.withOpacity(0.15)),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.black.withOpacity(0.05),
                                            blurRadius: 12,
                                            offset: const Offset(0, 6),
                                          ),
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  title,
                                                  style: const TextStyle(fontWeight: FontWeight.w800),
                                                ),
                                              ),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                decoration: BoxDecoration(
                                                  color: _statusColor(displayStatus).withOpacity(0.12),
                                                  borderRadius: BorderRadius.circular(999),
                                                  border: Border.all(
                                                    color: _statusColor(displayStatus).withOpacity(0.35),
                                                  ),
                                                ),
                                                child: Text(
                                                  _statusLabel(displayStatus),
                                                  style: TextStyle(
                                                    color: _statusColor(displayStatus),
                                                    fontWeight: FontWeight.w800,
                                                    fontSize: 12,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            localizations.translateParams(
                                              'special_order_quantity_delivery',
                                              {'qty': qty, 'shipping': shipping},
                                            ),
                                            style: TextStyle(color: Colors.grey.shade700),
                                          ),
                                          const SizedBox(height: 8),
                                          if (quoteTotal != null)
                                            Text(
                                              localizations.translateParams(
                                                'special_order_quote_with_amount',
                                                {'amount': _formatMoney(quoteTotal, currency)},
                                              ),
                                              style: const TextStyle(fontWeight: FontWeight.w800),
                                            )
                                          else
                                            Text(
                                              localizations.translate('special_order_quote_pending'),
                                              style: const TextStyle(fontWeight: FontWeight.w700),
                                            ),
                                          if (etaMin != null || etaMax != null) ...[
                                            const SizedBox(height: 6),
                                            Text(
                                              localizations.translateParams(
                                                'special_order_eta_with_range',
                                                {
                                                  'range':
                                                      '${_formatDate(etaMin)}${etaMax != null ? ' - ${_formatDate(etaMax)}' : ''}',
                                                },
                                              ),
                                              style: TextStyle(color: Colors.grey.shade700),
                                            ),
                                          ],
                                          if (quoteStatus != null && quoteStatus != status) ...[
                                            const SizedBox(height: 6),
                                            Text(
                                              localizations.translateParams(
                                                'special_order_quote_status_with_status',
                                                {'status': _statusLabel(quoteStatus)},
                                              ),
                                              style: TextStyle(color: Colors.grey.shade700),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
