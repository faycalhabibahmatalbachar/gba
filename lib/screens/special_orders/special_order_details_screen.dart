import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
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

  static const _brandGradient = [Color(0xFF667eea), Color(0xFF764ba2)];

  Color _statusColor(String status) {
    switch (status) {
      case 'quoted':
      case 'countered':
        return const Color(0xFFf59e0b);
      case 'accepted':
        return const Color(0xFF10b981);
      case 'rejected':
      case 'cancelled':
        return const Color(0xFFef4444);
      case 'completed':
        return const Color(0xFF667eea);
      default:
        return const Color(0xFF6b7280);
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'quoted':
      case 'countered':
        return FontAwesomeIcons.fileInvoiceDollar;
      case 'accepted':
        return FontAwesomeIcons.circleCheck;
      case 'rejected':
      case 'cancelled':
        return FontAwesomeIcons.circleXmark;
      case 'completed':
        return FontAwesomeIcons.trophy;
      default:
        return FontAwesomeIcons.clock;
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

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final displayStatus = (quoteStatus ?? status).toString();
    final sColor = _statusColor(displayStatus);
    final sIcon = _statusIcon(displayStatus);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // ── Gradient header ──
          SliverToBoxAdapter(
            child: Container(
              padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top + 8, left: 16, right: 16, bottom: 20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: _brandGradient,
                ),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
                boxShadow: isDark
                    ? []
                    : [
                        BoxShadow(
                          color: const Color(0xFF667eea).withOpacity(0.35),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.18),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: () {
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/special-orders');
                          }
                        },
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          localizations.translate('special_order_details_title'),
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh, color: Colors.white),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white.withOpacity(0.18),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                  const SizedBox(height: 10),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: sColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: sColor.withOpacity(0.5), width: 1.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(sIcon, size: 13, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(
                          displayStatus.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.1),
                ],
              ),
            ),
          ),

          // ── Body content ──
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Price card ──
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
                  ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.05)
                else
                  _InfoCard(text: localizations.translate('special_order_quote_pending'))
                      .animate().fadeIn(duration: 350.ms),

                // ── ETA ──
                if (etaMin != null || etaMax != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isDark ? theme.colorScheme.surfaceContainerHighest : Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        Icon(FontAwesomeIcons.truckFast, size: 16, color: theme.colorScheme.primary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            localizations.translateParams(
                              'special_order_eta_with_range',
                              {
                                'range':
                                    '${_formatDate(etaMin)}${etaMax != null ? ' - ${_formatDate(etaMax)}' : ''}',
                              },
                            ),
                            style: TextStyle(fontWeight: FontWeight.w600, color: theme.colorScheme.primary),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // ── Action buttons ──
                if (quoteTotal != null && canRespondToQuote) ...[
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            gradient: const LinearGradient(colors: [Color(0xFF10b981), Color(0xFF059669)]),
                            boxShadow: [
                              BoxShadow(color: const Color(0xFF10b981).withOpacity(0.3), blurRadius: 10, offset: const Offset(0, 4)),
                            ],
                          ),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: _actionLoading ? null : _accept,
                              borderRadius: BorderRadius.circular(14),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 13),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(FontAwesomeIcons.check, size: 13, color: Colors.white),
                                    const SizedBox(width: 6),
                                    Text(
                                      localizations.translate('special_order_accept_quote'),
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _actionLoading ? null : _reject,
                          icon: const Icon(FontAwesomeIcons.xmark, size: 13),
                          label: Text(localizations.translate('special_order_reject_quote'), style: const TextStyle(fontSize: 13)),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            side: BorderSide(color: const Color(0xFFef4444).withOpacity(0.5)),
                            foregroundColor: const Color(0xFFef4444),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _actionLoading ? null : _counter,
                      icon: const Icon(FontAwesomeIcons.scaleBalanced, size: 13),
                      label: Text(localizations.translate('special_order_negotiate_quote')),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],

                // ── History section ──
                const SizedBox(height: 22),
                Row(
                  children: [
                    Icon(FontAwesomeIcons.clockRotateLeft, size: 15, color: theme.colorScheme.primary),
                    const SizedBox(width: 8),
                    Text(
                      localizations.translate('special_order_history'),
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                if (_offers.isEmpty && _events.isEmpty)
                  _InfoCard(text: localizations.translate('no_events_yet'))
                else ...[
                  // ── Visual timeline ──
                  if (_events.isNotEmpty) ...[
                    Text(localizations.translate('special_order_timeline'),
                        style: TextStyle(fontWeight: FontWeight.w700, color: theme.colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 10),
                    ...List.generate(_events.length, (i) {
                      final e = _events[i];
                      final label = e['label']?.toString() ?? e['event_type']?.toString() ?? '';
                      final at = _formatDateTime(e['created_at']);
                      final isLast = i == _events.length - 1;
                      return _TimelineItem(
                        label: label,
                        time: at,
                        isLast: isLast,
                        dotColor: i == 0 ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant.withOpacity(0.4),
                      );
                    }),
                    const SizedBox(height: 14),
                  ],

                  // ── Offer cards ──
                  if (_offers.isNotEmpty) ...[
                    Text(
                      localizations.translate('special_order_offers_messages'),
                      style: TextStyle(fontWeight: FontWeight.w700, color: theme.colorScheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 10),
                    ..._offers.map((o) {
                      final role = o['from_role']?.toString() ?? '';
                      final type = o['type']?.toString() ?? '';
                      final msg = o['message']?.toString();
                      final at = _formatDateTime(o['created_at']);
                      final total = o['total'];
                      final currencyOffer = o['currency']?.toString() ?? currency;

                      return _OfferCard(
                        role: role,
                        type: type,
                        message: msg,
                        time: at,
                        total: total,
                        currency: currencyOffer,
                        formatMoney: _formatMoney,
                        localizations: localizations,
                      );
                    }),
                  ],
                ],
                const SizedBox(height: 24),
              ]),
            ),
          ),
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: theme.dividerColor),
        boxShadow: isDark
            ? []
            : [
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
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [theme.colorScheme.surfaceContainerHighest, theme.colorScheme.surface]
              : [Colors.white, const Color(0xFFF8F7FF)],
        ),
        border: Border.all(
          color: const Color(0xFF667eea).withOpacity(isDark ? 0.3 : 0.15),
          width: 1.5,
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: const Color(0xFF667eea).withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Icon(FontAwesomeIcons.fileInvoiceDollar, size: 15, color: const Color(0xFF667eea)),
                const SizedBox(width: 8),
                Text(
                  localizations.translate('special_order_quote'),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                _line(context, localizations.translate('special_order_subtotal'), subtotal, currency),
                _line(context, localizations.translate('special_order_shipping'), shipping, currency),
                _line(context, localizations.translate('special_order_tax'), tax, currency),
                _line(context, localizations.translate('special_order_service_fee'), serviceFee, currency),
              ],
            ),
          ),
          // Total row with gradient background
          Container(
            margin: const EdgeInsets.fromLTRB(8, 6, 8, 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(
                colors: [Color(0xFF667eea), Color(0xFF764ba2)],
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  localizations.translate('special_order_total'),
                  style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 15),
                ),
                Text(
                  formatMoney(total, currency),
                  style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 17),
                ),
              ],
            ),
          ),
          if (validUntil != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                localizations.translateParams(
                  'special_order_valid_until_with_date',
                  {'date': formatDateTime(validUntil)},
                ),
                style: TextStyle(color: theme.colorScheme.onSurfaceVariant, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }

  Widget _line(BuildContext context, String label, dynamic value, String currency) {
    if (value == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(formatMoney(value, currency), style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final String label;
  final String time;
  final bool isLast;
  final Color dotColor;

  const _TimelineItem({
    required this.label,
    required this.time,
    required this.isLast,
    required this.dotColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dotColor,
                    boxShadow: [
                      BoxShadow(color: dotColor.withOpacity(0.4), blurRadius: 6),
                    ],
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: theme.dividerColor,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(time, style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  final String role;
  final String type;
  final String? message;
  final String time;
  final dynamic total;
  final String currency;
  final String Function(dynamic, String) formatMoney;
  final AppLocalizations localizations;

  const _OfferCard({
    required this.role,
    required this.type,
    required this.message,
    required this.time,
    required this.total,
    required this.currency,
    required this.formatMoney,
    required this.localizations,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isAdmin = role.toLowerCase() == 'admin';
    final accent = isAdmin ? const Color(0xFF667eea) : const Color(0xFF10b981);

    final priceLine = total != null
        ? localizations.translateParams(
            'special_order_quote_with_amount',
            {'amount': formatMoney(total, currency)},
          )
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? theme.colorScheme.surfaceContainerHighest : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border(
          left: BorderSide(color: accent, width: 3.5),
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  role.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: accent, letterSpacing: 0.8),
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  type.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: theme.colorScheme.onSurfaceVariant),
                ),
              ),
              const Spacer(),
              Text(time, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurfaceVariant)),
            ],
          ),
          if (priceLine != null) ...[
            const SizedBox(height: 8),
            Text(priceLine, style: TextStyle(fontWeight: FontWeight.w800, color: accent, fontSize: 15)),
          ],
          if (message != null && message!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(message!.trim(), style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          ],
        ],
      ),
    );
  }
}
