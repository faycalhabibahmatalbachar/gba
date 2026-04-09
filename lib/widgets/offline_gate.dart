import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

import '../localization/app_localizations.dart';
import 'no_internet_state.dart';

/// Shows [NoInternetState] when there is no network; otherwise shows [child].
class OfflineGate extends StatefulWidget {
  const OfflineGate({super.key, required this.child});

  final Widget child;

  @override
  State<OfflineGate> createState() => _OfflineGateState();
}

class _OfflineGateState extends State<OfflineGate> {
  List<ConnectivityResult> _results = [];
  StreamSubscription<List<ConnectivityResult>>? _sub;

  @override
  void initState() {
    super.initState();
    Connectivity().checkConnectivity().then((v) {
      if (mounted) setState(() => _results = v);
    });
    _sub = Connectivity().onConnectivityChanged.listen((v) {
      if (mounted) setState(() => _results = v);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  bool get _offline =>
      _results.isNotEmpty && _results.every((r) => r == ConnectivityResult.none);

  Future<void> _recheck() async {
    final v = await Connectivity().checkConnectivity();
    if (mounted) setState(() => _results = v);
  }

  @override
  Widget build(BuildContext context) {
    if (!_offline) return widget.child;

    final loc = AppLocalizations.of(context);
    return ColoredBox(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: NoInternetState(
        title: loc.translate('no_internet_connection_title'),
        message: loc.translate('no_internet_connection_message'),
        retryLabel: loc.translate('retry'),
        onRetry: _recheck,
      ),
    );
  }
}
