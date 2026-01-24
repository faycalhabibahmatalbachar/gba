import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class FlutterwaveReturnScreen extends StatefulWidget {
  const FlutterwaveReturnScreen({super.key});

  @override
  State<FlutterwaveReturnScreen> createState() => _FlutterwaveReturnScreenState();
}

class _FlutterwaveReturnScreenState extends State<FlutterwaveReturnScreen> {
  bool _redirected = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_redirected) return;

    final uri = GoRouterState.of(context).uri;
    final status = uri.queryParameters['status']?.toLowerCase();
    final orderId = uri.queryParameters['order_id'];

    final isSuccess = status == 'successful' || status == 'success';

    _redirected = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (isSuccess) {
        context.go('/checkout/success?order_id=${orderId ?? ''}');
      } else {
        context.go('/checkout/cancel?order_id=${orderId ?? ''}');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(),
          ),
        ),
      ),
    );
  }
}
