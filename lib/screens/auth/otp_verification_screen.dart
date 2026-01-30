import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';
import '../../animations/app_animations.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/app_animation.dart';

class OtpVerificationScreen extends ConsumerStatefulWidget {
  const OtpVerificationScreen({super.key, required this.phone, required this.mode});

  final String phone;
  final String mode;

  @override
  ConsumerState<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen> {
  final _pinController = TextEditingController();

  bool get _isLogin => widget.mode == 'login';

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final token = _pinController.text.trim();
    if (token.length < 4) return;

    await ref.read(authProvider.notifier).verifyPhoneOtp(
          phone: widget.phone,
          token: token,
        );

    if (!mounted) return;

    final authState = ref.read(authProvider);
    if (authState.user != null) {
      context.go('/home');
    }
  }

  Future<void> _resend() async {
    await ref.read(authProvider.notifier).requestPhoneOtp(
          phone: widget.phone,
          shouldCreateUser: !_isLogin,
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    final defaultPinTheme = PinTheme(
      width: 52,
      height: 56,
      textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vérification'),
        backgroundColor: const Color(0xFF1976D2),
        foregroundColor: Colors.white,
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1976D2),
              Color(0xFF2196F3),
              Color(0xFF42A5F5),
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.14),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(0.20)),
                        ),
                        child: const AppAnimation(
                          id: AppAnimations.successCheck,
                          width: 92,
                          height: 92,
                        ),
                      ),
                    ).animate().fadeIn(duration: 450.ms).scale(delay: 120.ms),
                    const SizedBox(height: 16),
                    Text(
                      'Entre le code reçu',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                    ).animate().fadeIn(delay: 160.ms),
                    const SizedBox(height: 8),
                    Text(
                      'Envoyé à ${widget.phone}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withOpacity(0.90),
                          ),
                    ).animate().fadeIn(delay: 220.ms),
                    const SizedBox(height: 18),
                    if (authState.error != null)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.red.withOpacity(0.25)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                authState.error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ),
                            IconButton(
                              onPressed: () => ref.read(authProvider.notifier).clearError(),
                              icon: const Icon(Icons.close, color: Colors.red),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(delay: 260.ms),
                    if (authState.error != null) const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.10),
                            blurRadius: 18,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Pinput(
                              controller: _pinController,
                              length: 6,
                              defaultPinTheme: defaultPinTheme,
                              separatorBuilder: (index) => const SizedBox(width: 10),
                              keyboardType: TextInputType.number,
                              onCompleted: (_) => _verify(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _verify,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2196F3),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: authState.isLoading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text('Vérifier'),
                          ),
                          const SizedBox(height: 10),
                          TextButton(
                            onPressed: authState.isLoading ? null : _resend,
                            child: const Text('Renvoyer le code'),
                          ),
                          const SizedBox(height: 6),
                          TextButton(
                            onPressed: () => context.go('/phone-auth?mode=${widget.mode}'),
                            child: const Text('Modifier le numéro'),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(delay: 320.ms).slideY(begin: 0.08, end: 0),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
