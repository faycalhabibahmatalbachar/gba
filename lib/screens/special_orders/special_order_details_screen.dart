import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../../services/special_order_service.dart';

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
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
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
      _showSnack('Devis accepté', backgroundColor: Colors.green);
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
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Refuser le devis'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Message (optionnel)',
              border: OutlineInputBorder(),
            ),
            maxLines: 3,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Refuser'),
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
      _showSnack('Devis refusé', backgroundColor: Colors.orange);
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
    final unitCtrl = TextEditingController();
    final shipCtrl = TextEditingController(text: '0');
    final msgCtrl = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Proposer une contre-offre'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: unitCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Prix unitaire proposé',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: shipCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Frais de livraison proposés',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: msgCtrl,
                decoration: const InputDecoration(
                  labelText: 'Message (optionnel)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Envoyer'),
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
      _showSnack('Prix unitaire invalide');
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
      _showSnack('Contre-offre envoyée', backgroundColor: Colors.green);
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
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final order = _order;
    if (order == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Commande spéciale'),
        ),
        body: const Center(child: Text('Commande introuvable')),
      );
    }

    final title = order['product_name']?.toString() ?? 'Commande spéciale';
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
        title: const Text('Détails commande spéciale'),
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
          Text('Statut: ${quoteStatus ?? status}', style: TextStyle(color: Colors.grey.shade700)),
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
            const _InfoCard(text: 'En attente de devis'),
          if (etaMin != null || etaMax != null) ...[
            const SizedBox(height: 12),
            _InfoCard(
              text:
                  'Arrivée estimée: ${_formatDate(etaMin)}${etaMax != null ? ' - ${_formatDate(etaMax)}' : ''}',
            ),
          ],
          const SizedBox(height: 16),
          if (quoteTotal != null && canRespondToQuote)
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _actionLoading ? null : _accept,
                    child: const Text('Accepter'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _actionLoading ? null : _reject,
                    child: const Text('Refuser'),
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
                child: const Text('Négocier (contre-offre)'),
              ),
            ),
          ],
          const SizedBox(height: 18),
          const Text('Historique', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          if (_offers.isEmpty && _events.isEmpty)
            const _InfoCard(text: 'Aucun événement pour le moment')
          else ...[
            if (_events.isNotEmpty) ...[
              const Text('Timeline', style: TextStyle(fontWeight: FontWeight.w700)),
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
              const Text('Offres / messages', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              ..._offers.map((o) {
                final role = o['from_role']?.toString() ?? '';
                final type = o['type']?.toString() ?? '';
                final msg = o['message']?.toString();
                final at = _formatDateTime(o['created_at']);
                final total = o['total'];
                final currencyOffer = o['currency']?.toString() ?? currency;

                final header = '${role.toUpperCase()} • ${type.toUpperCase()}';
                final priceLine = total != null ? 'Total: ${_formatMoney(total, currencyOffer)}' : null;

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
          const Text('Devis', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          _line('Sous-total', subtotal, currency),
          _line('Livraison', shipping, currency),
          _line('Tax', tax, currency),
          _line('Service', serviceFee, currency),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total', style: TextStyle(fontWeight: FontWeight.w900)),
              Text(
                formatMoney(total, currency),
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ],
          ),
          if (validUntil != null) ...[
            const SizedBox(height: 10),
            Text(
              'Valable jusqu\'au: ${formatDateTime(validUntil)}',
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
