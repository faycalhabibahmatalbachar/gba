import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../animations/app_animations.dart';
import '../../localization/app_localizations.dart';
import '../../widgets/animated_widgets.dart';
import '../../widgets/app_animation.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _backgroundController;

  @override
  void initState() {
    super.initState();
    _backgroundController = AnimationController(
      duration: const Duration(seconds: 20),
      vsync: this,
    )..repeat();
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
    final scheme = theme.colorScheme;

    final welcomeTitle = localizations.translateParams(
      'welcome_to_store',
      {'store': localizations.translate('appName')},
    );

    return Scaffold(
      body: Stack(
        children: [
          _AnimatedWelcomeBackground(animation: _backgroundController),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 540),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 8),
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.14),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(0.20)),
                          ),
                          child: SizedBox(
                            width: 130,
                            height: 130,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                const AppAnimation(
                                  id: AppAnimations.navActivePulse,
                                  width: 130,
                                  height: 130,
                                ),
                                Icon(
                                  Icons.shopping_bag_rounded,
                                  size: 52,
                                  color: Colors.white.withOpacity(0.95),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                          .animate()
                          .fadeIn(duration: 520.ms)
                          .scale(
                            begin: const Offset(0.92, 0.92),
                            end: const Offset(1.0, 1.0),
                            duration: 520.ms,
                            curve: Curves.easeOutCubic,
                          ),
                      const SizedBox(height: 18),
                      _StaggeredText(
                        welcomeTitle,
                        startDelay: 160.ms,
                        stagger: 18.ms,
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: 0.1,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Choisis une option pour continuer',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withOpacity(0.88),
                          height: 1.35,
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 380.ms, duration: 420.ms)
                          .slideY(begin: 0.15, end: 0, curve: Curves.easeOutCubic),
                      const SizedBox(height: 22),
                      _GlassCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            AnimatedButton(
                              onPressed: () => context.go('/login'),
                              backgroundColor: Colors.white,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.lock_open_rounded, color: scheme.primary),
                                  const SizedBox(width: 10),
                                  Text(
                                    localizations.translate('login'),
                                    style: theme.textTheme.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                      color: scheme.primary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            AnimatedButton(
                              onPressed: () => context.go('/auth-method?mode=register'),
                              backgroundColor: scheme.primary.withOpacity(0.95),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.person_add_alt_1_rounded, color: Colors.white),
                                  const SizedBox(width: 10),
                                  Text(
                                    localizations.translate('register'),
                                    style: theme.textTheme.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextButton.icon(
                              onPressed: () => context.go('/phone-auth?mode=login'),
                              icon: const Icon(Icons.phone_rounded),
                              label: const Text('Continuer avec un numéro'),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                              ),
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(delay: 420.ms, duration: 520.ms)
                          .slideY(begin: 0.12, end: 0, curve: Curves.easeOutCubic),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          TextButton(
                            onPressed: () => context.go('/legal/terms'),
                            style: TextButton.styleFrom(foregroundColor: Colors.white),
                            child: const Text('CGU'),
                          ),
                          const SizedBox(width: 12),
                          TextButton(
                            onPressed: () => context.go('/legal/privacy'),
                            style: TextButton.styleFrom(foregroundColor: Colors.white),
                            child: const Text('Confidentialité'),
                          ),
                        ],
                      ).animate().fadeIn(delay: 540.ms, duration: 420.ms),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassCard extends StatelessWidget {
  const _GlassCard({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.12),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Colors.white.withOpacity(0.16)),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _StaggeredText extends StatelessWidget {
  const _StaggeredText(
    this.text, {
    required this.style,
    this.stagger = const Duration(milliseconds: 18),
    this.startDelay = Duration.zero,
  });

  final String text;
  final TextStyle? style;
  final Duration stagger;
  final Duration startDelay;

  @override
  Widget build(BuildContext context) {
    final chars = text.runes.map((r) => String.fromCharCode(r)).toList();

    return Wrap(
      alignment: WrapAlignment.center,
      children: [
        for (var i = 0; i < chars.length; i++)
          Text(chars[i], style: style)
              .animate()
              .fadeIn(
                delay: startDelay + Duration(milliseconds: stagger.inMilliseconds * i),
                duration: 320.ms,
                curve: Curves.easeOut,
              )
              .slideY(
                begin: 0.20,
                end: 0,
                delay: startDelay + Duration(milliseconds: stagger.inMilliseconds * i),
                duration: 320.ms,
                curve: Curves.easeOutCubic,
              ),
      ],
    );
  }
}

class _AnimatedWelcomeBackground extends StatelessWidget {
  const _AnimatedWelcomeBackground({required this.animation});

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
            painter: _WelcomeMeshPainter(animation.value),
            child: const SizedBox.expand(),
          ),
        );
      },
    );
  }
}

class _WelcomeMeshPainter extends CustomPainter {
  const _WelcomeMeshPainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final p1 = Paint()
      ..color = Colors.white.withOpacity(0.14)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.09);

    final p2 = Paint()
      ..color = const Color(0xFFFFD54F).withOpacity(0.14)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.11);

    final p3 = Paint()
      ..color = const Color(0xFF69F0AE).withOpacity(0.10)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, size.shortestSide * 0.13);

    final a = t * 2 * math.pi;

    canvas.drawCircle(
      Offset(
        size.width * (0.18 + 0.06 * math.sin(a * 0.9)),
        size.height * (0.24 + 0.06 * math.cos(a * 1.1)),
      ),
      size.width * (0.44 + 0.03 * math.sin(a * 1.2)),
      p1,
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.88 + 0.05 * math.cos(a * 0.8)),
        size.height * (0.22 + 0.06 * math.sin(a * 0.7)),
      ),
      size.width * (0.34 + 0.03 * math.cos(a * 1.3)),
      p2,
    );

    canvas.drawCircle(
      Offset(
        size.width * (0.62 + 0.06 * math.sin(a * 0.8)),
        size.height * (0.84 + 0.05 * math.cos(a * 1.0)),
      ),
      size.width * (0.46 + 0.03 * math.sin(a * 1.1)),
      p3,
    );
  }

  @override
  bool shouldRepaint(_WelcomeMeshPainter oldDelegate) => oldDelegate.t != t;
}
