import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../localization/app_localizations.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _backgroundController;
  String _displayedText = '';
  int _charIndex = 0;

  @override
  void initState() {
    super.initState();
    _backgroundController = AnimationController(
      duration: const Duration(seconds: 18),
      vsync: this,
    )..repeat();
    // Start typewriter after logo fades in
    Future.delayed(const Duration(milliseconds: 600), _startTypewriter);
    // Navigate to home screen after 4.5 seconds (enough for typewriter)
    Future.delayed(const Duration(milliseconds: 4500), () {
      if (mounted) {
        context.go('/home');
      }
    });
  }

  void _startTypewriter() {
    if (!mounted) return;
    final localizations = AppLocalizations.of(context);
    final fullText = localizations.translate('splash_welcome_full');
    _typeNextChar(fullText);
  }

  void _typeNextChar(String fullText) {
    if (!mounted || _charIndex >= fullText.length) return;
    setState(() {
      _charIndex++;
      _displayedText = fullText.substring(0, _charIndex);
    });
    Future.delayed(const Duration(milliseconds: 55), () => _typeNextChar(fullText));
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Stack(
        children: [
          _AnimatedSplashBackground(animation: _backgroundController),
          SafeArea(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.12),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withOpacity(0.18)),
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/GBA_sans_arriere.png',
                        width: 110,
                        height: 110,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.medium,
                      ),
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 450.ms)
                      .scale(
                        begin: const Offset(0.92, 0.92),
                        end: const Offset(1.0, 1.0),
                        duration: 450.ms,
                      ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Text(
                      _displayedText.isEmpty
                          ? ' '
                          : _displayedText,
                      textAlign: TextAlign.center,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: 0.3,
                        height: 1.3,
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  const SizedBox(
                    width: 36,
                    height: 36,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnimatedSplashBackground extends StatelessWidget {
  const _AnimatedSplashBackground({required this.animation});

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                theme.colorScheme.primary,
                theme.colorScheme.primary.withOpacity(0.9),
                theme.colorScheme.secondary.withOpacity(0.85),
              ],
              stops: const [0.0, 0.55, 1.0],
              transform: GradientRotation(animation.value * 2 * math.pi),
            ),
          ),
          child: CustomPaint(
            painter: _SplashMeshPainter(animation.value),
            child: const SizedBox.expand(),
          ),
        );
      },
    );
  }
}

class _SplashMeshPainter extends CustomPainter {
  const _SplashMeshPainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final a = t * 2 * math.pi;

    canvas.drawCircle(
      Offset(
        size.width * (0.22 + 0.05 * math.sin(a)),
        size.height * (0.28 + 0.06 * math.cos(a)),
      ),
      size.width * (0.40 + 0.03 * math.sin(a * 1.2)),
      Paint()..color = Colors.white.withOpacity(0.10),
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.84 + 0.05 * math.cos(a * 0.9)),
        size.height * (0.22 + 0.06 * math.sin(a * 0.7)),
      ),
      size.width * (0.34 + 0.03 * math.cos(a * 1.3)),
      Paint()..color = const Color(0xFFFFD54F).withOpacity(0.10),
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.62 + 0.06 * math.sin(a * 0.8)),
        size.height * (0.82 + 0.05 * math.cos(a * 1.1)),
      ),
      size.width * (0.42 + 0.03 * math.sin(a * 1.1)),
      Paint()..color = const Color(0xFF69F0AE).withOpacity(0.08),
    );
  }

  @override
  bool shouldRepaint(_SplashMeshPainter oldDelegate) => oldDelegate.t != t;
}
