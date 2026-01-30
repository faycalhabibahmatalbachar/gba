import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../../localization/app_localizations.dart';
import '../../services/special_order_service.dart';
import '../../widgets/app_state_view.dart';

class SpecialOrderDetailsScreen extends StatefulWidget {
  final String specialOrderId;

  const SpecialOrderDetailsScreen({super.key, required this.specialOrderId});

  @override
  State<SpecialOrderDetailsScreen> createState() => _SpecialOrderDetailsScreenState();
}

class _SpecialOrderDetailsScreenState extends State<SpecialOrderDetailsScreen> {
  final SpecialOrderService _service = SpecialOrderService();

  bool _loading = true;
  bool _actionLoading = false;

  String? _errorMessage;

  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _offers = [];
  List<Map<String, dynamic>> _events = [];

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
      final order = await _service.getSpecialOrderById(widget.specialOrderId);
      final offers = await _service.getOffers(widget.specialOrderId);
      final events = await _service.getEvents(widget.specialOrderId);

      if (!mounted) return;
      setState(() {
        _order = order;
        _offers = offers;
        _events = events;
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
    }
  }

  String _formatMoney(dynamic value, String currency) {
    final numVal = (value is num) ? value : num.tryParse(value?.toString() ?? '') ?? 0;
    if (currency.toUpperCase() == 'XOF') {
      return '${numVal.toStringAsFixed(0)} FCFA';
    }
    return '${numVal.toStringAsFixed(2)} ${currency.toUpperCase()}';
  }

  String _formatDateTime(dynamic iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso.toString());
    if (dt == null) return '';
    final local = dt.toLocal();
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String _formatDate(dynamic iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso.toString());
    if (dt == null) return '';
    final local = dt.toLocal();
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
  }

  Future<void> _accept() async {
    setState(() => _actionLoading = true);
    try {
      await _service.acceptQuote(widget.specialOrderId);
      if (!mounted) return;
      final localizations = AppLocalizations.of(context);
      _showSnack(localizations.translate('special_order_quote_accepted'), backgroundColor: Colors.green);
      await _load();
    } catch (e) {
      if (!mounted) return;
      _showSnack(e.toString(), backgroundColor: Colors.red);
    } finally {
      if (!mounted) return;
      setState(() => _actionLoading = false);
    }
  }

  Future<void> _reject() async {
    final localizations = AppLocalizations.of(context);
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(localizations.translate('special_order_reject_dialog_title')),
          content: TextField(
            controller: controller,
            decoration: InputDecoration(
              labelText: localizations.translate('special_order_optional_message_label'),
              border: const OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(localizations.translate('cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(localizations.translate('special_order_reject_quote')),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() => _actionLoading = true);
    try {
      await _service.rejectQuote(widget.specialOrderId, message: controller.text.trim());
      if (!mounted) return;
      _showSnack(localizations.translate('special_order_quote_rejected'), backgroundColor: Colors.orange);
      await _load();
    } catch (e) {
      if (!mounted) return;
      _showSnack(e.toString(), backgroundColor: Colors.red);
    } finally {
      if (!mounted) return;
      setState(() => _actionLoading = false);
    }
  }

  Future<void> _counter() async {
    final localizations = AppLocalizations.of(context);
    final unitCtrl = TextEditingController();
    final shipCtrl = TextEditingController(text: '0');
    final msgCtrl = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(localizations.translate('special_order_counter_dialog_title')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: unitCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: localizations.translate('special_order_unit_price_label'),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: shipCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: localizations.translate('special_order_shipping_fee_label'),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: msgCtrl,
                decoration: InputDecoration(
                  labelText: localizations.translate('special_order_optional_message_label'),
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(localizations.translate('cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: Text(localizations.translate('send')),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    final unit = double.tryParse(unitCtrl.text.trim());
    final ship = double.tryParse(shipCtrl.text.trim()) ?? 0;
    if (unit == null || unit <= 0) {
      if (!mounted) return;
      _showSnack(localizations.translate('special_order_invalid_unit_price'));
      return;
    }

    setState(() => _actionLoading = true);
    try {
      await _service.counterQuote(
        widget.specialOrderId,
        unitPrice: unit,
        shippingFee: ship,
        message: msgCtrl.text.trim(),
      );
      if (!mounted) return;
      _showSnack(localizations.translate('special_order_counter_offer_sent'), backgroundColor: Colors.green);
      await _load();
    } catch (e) {
      if (!mounted) return;
      _showSnack(e.toString(), backgroundColor: Colors.red);
    } finally {
      if (!mounted) return;
      setState(() => _actionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: SafeArea(
          child: AppStateView(state: AppViewState.loading),
        ),
      );
    }

    final localizations = AppLocalizations.of(context);

    final order = _order;
    if (order == null && _errorMessage != null) {
      return Scaffold(
        appBar: AppBar(
          title: Text(localizations.translate('special_order_details_title')),
        ),
        body: SafeArea(
          child: AppStateView(
            state: AppViewState.error,
            title: localizations.translate('error_loading'),
            subtitle: _errorMessage,
            primaryActionLabel: localizations.translate('retry'),
            onPrimaryAction: _load,
            secondaryActionLabel: localizations.translate('back'),
            onSecondaryAction: () => context.go('/special-orders'),
          ),
        ),
      );
    }

    if (order == null) {
      return Scaffold(
        appBar: AppBar(
          title: Text(localizations.translate('special_order_details_title')),
        ),
        body: SafeArea(
          child: AppStateView(
            state: AppViewState.empty,
            title: localizations.translate('special_order_not_found'),
            primaryActionLabel: localizations.translate('retry'),
            onPrimaryAction: _load,
            secondaryActionLabel: localizations.translate('back'),
            onSecondaryAction: () => context.go('/special-orders'),
          ),
        ),
      );
    }

    final title = order['product_name']?.toString() ?? localizations.translate('special_order_generic_title');
    final status = order['status']?.toString() ?? 'pending';

    final currency = order['currency']?.toString() ?? 'XOF';
    final quoteTotal = order['quote_total'];
    final quoteSubtotal = order['subtotal'];
    final quoteShip = order['quote_shipping_fee'];
    final quoteTax = order['quote_tax'];
    final quoteService = order['quote_service_fee'];
    final quoteValidUntil = order['quote_valid_until'];

    final etaMin = order['eta_min_date'];
    final etaMax = order['eta_max_date'];

    final quoteStatus = order['quote_status']?.toString();
    final canRespondToQuote = quoteStatus == 'quoted' || quoteStatus == 'countered';

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('special_order_details_title')),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/special-orders');
            }
          },
        ),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(
            localizations.translateParams(
              'special_order_status_with_status',
              {'status': (quoteStatus ?? status).toString()},
            ),
            style: TextStyle(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 14),
          if (quoteTotal != null)
            _PriceCard(
              currency: currency,
              total: quoteTotal,
              subtotal: quoteSubtotal,
              shipping: quoteShip,
              tax: quoteTax,
              serviceFee: quoteService,
              validUntil: quoteValidUntil,
              formatMoney: _formatMoney,
              formatDateTime: _formatDateTime,
            )
          else
            _InfoCard(text: localizations.translate('special_order_quote_pending')),
          if (etaMin != null || etaMax != null) ...[
            const SizedBox(height: 12),
            _InfoCard(
              text: localizations.translateParams(
                'special_order_eta_with_range',
                {
                  'range':
                      '${_formatDate(etaMin)}${etaMax != null ? ' - ${_formatDate(etaMax)}' : ''}',
                },
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (quoteTotal != null && canRespondToQuote)
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _actionLoading ? null : _accept,
                    child: Text(localizations.translate('special_order_accept_quote')),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _actionLoading ? null : _reject,
                    child: Text(localizations.translate('special_order_reject_quote')),
                  ),
                ),
              ],
            ),
          if (quoteTotal != null && canRespondToQuote) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _actionLoading ? null : _counter,
                child: Text(localizations.translate('special_order_negotiate_quote')),
              ),
            ),
          ],
          const SizedBox(height: 18),
          Text(localizations.translate('special_order_history'), style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          if (_offers.isEmpty && _events.isEmpty)
            _InfoCard(text: localizations.translate('no_events_yet'))
          else ...[
            if (_events.isNotEmpty) ...[
              Text(localizations.translate('special_order_timeline'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ..._events.map((e) {
                final label = e['label']?.toString() ?? e['event_type']?.toString() ?? '';
                final at = _formatDateTime(e['created_at']);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _InfoCard(text: '$label\n$at'),
                );
              }),
              const SizedBox(height: 12),
            ],
            if (_offers.isNotEmpty) ...[
              Text(
                localizations.translate('special_order_offers_messages'),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              ..._offers.map((o) {
                final role = o['from_role']?.toString() ?? '';
                final type = o['type']?.toString() ?? '';
                final msg = o['message']?.toString();
                final at = _formatDateTime(o['created_at']);
                final total = o['total'];
                final currencyOffer = o['currency']?.toString() ?? currency;

                final header = '${role.toUpperCase()} • ${type.toUpperCase()}';
                final priceLine = total != null
                    ? localizations.translateParams(
                        'special_order_quote_with_amount',
                        {'amount': _formatMoney(total, currencyOffer)},
                      )
                    : null;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _InfoCard(
                    text: [
                      header,
                      if (priceLine != null) priceLine,
                      if (msg != null && msg.trim().isNotEmpty) msg.trim(),
                      at,
                    ].join('\n'),
                  ),
                );
              }),
            ],
          ],
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String text;

  const _InfoCard({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
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
      child: Text(text),
    );
  }
}

class _PriceCard extends StatelessWidget {
  final String currency;
  final dynamic total;
  final dynamic subtotal;
  final dynamic shipping;
  final dynamic tax;
  final dynamic serviceFee;
  final dynamic validUntil;

  final String Function(dynamic, String) formatMoney;
  final String Function(dynamic) formatDateTime;

  const _PriceCard({
    required this.currency,
    required this.total,
    required this.subtotal,
    required this.shipping,
    required this.tax,
    required this.serviceFee,
    required this.validUntil,
    required this.formatMoney,
    required this.formatDateTime,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    return Container(
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
          Text(localizations.translate('special_order_quote'), style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          _line(localizations.translate('special_order_subtotal'), subtotal, currency),
          _line(localizations.translate('special_order_shipping'), shipping, currency),
          _line(localizations.translate('special_order_tax'), tax, currency),
          _line(localizations.translate('special_order_service_fee'), serviceFee, currency),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(localizations.translate('special_order_total'), style: const TextStyle(fontWeight: FontWeight.w900)),
              Text(
                formatMoney(total, currency),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ],
          ),
          if (validUntil != null) ...[
            const SizedBox(height: 10),
            Text(
              localizations.translateParams(
                'special_order_valid_until_with_date',
                {'date': formatDateTime(validUntil)},
              ),
              style: TextStyle(color: Colors.grey.shade700),
            ),
          ],
        ],
      ),
    );
  }

  Widget _line(String label, dynamic value, String currency) {
    if (value == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(formatMoney(value, currency), style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
