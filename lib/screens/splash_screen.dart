import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../animations/app_animations.dart';
import '../localization/app_localizations.dart';
import '../widgets/app_animation.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _backgroundController;

  @override
  void initState() {
    super.initState();
    _backgroundController = AnimationController(
      duration: const Duration(seconds: 18),
      vsync: this,
    )..repeat();
    // Navigate to home screen after 3 seconds
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        final session = Supabase.instance.client.auth.currentSession;
        context.go(session == null ? '/welcome' : '/home');
      }
      });
  }

  @override
  void dispose() {
    _backgroundController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
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
                    child: SizedBox(
                      width: 110,
                      height: 110,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const AppAnimation(
                            id: AppAnimations.navActivePulse,
                            width: 110,
                            height: 110,
                          ),
                          Icon(
                            Icons.shopping_bag_rounded,
                            size: 46,
                            color: Colors.white.withOpacity(0.95),
                          ),
                        ],
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
                  Text(
                    localizations.translate('appName'),
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      letterSpacing: 0.2,
                    ),
                  ).animate().fadeIn(delay: 120.ms, duration: 420.ms).slideY(begin: 0.15, end: 0),
                  const SizedBox(height: 22),
                  const AppAnimation(
                    id: AppAnimations.loadingSpinner,
                    width: 64,
                    height: 64,
                  ).animate().fadeIn(delay: 220.ms, duration: 420.ms),
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
    final p1 = Paint()
      ..color = Colors.white.withOpacity(0.14)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.08);

    final p2 = Paint()
      ..color = const Color(0xFFFFD54F).withOpacity(0.14)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.10);

    final p3 = Paint()
      ..color = const Color(0xFF69F0AE).withOpacity(0.10)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.12);

    final a = t * 2 * math.pi;

    canvas.drawCircle(
      Offset(
        size.width * (0.22 + 0.05 * math.sin(a)),
        size.height * (0.28 + 0.06 * math.cos(a)),
      ),
      size.width * (0.40 + 0.03 * math.sin(a * 1.2)),
      p1,
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.84 + 0.05 * math.cos(a * 0.9)),
        size.height * (0.22 + 0.06 * math.sin(a * 0.7)),
      ),
      size.width * (0.34 + 0.03 * math.cos(a * 1.3)),
      p2,
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.62 + 0.06 * math.sin(a * 0.8)),
        size.height * (0.82 + 0.05 * math.cos(a * 1.1)),
      ),
      size.width * (0.42 + 0.03 * math.sin(a * 1.1)),
      p3,
    );
  }

  @override
  bool shouldRepaint(_SplashMeshPainter oldDelegate) => oldDelegate.t != t;
}
