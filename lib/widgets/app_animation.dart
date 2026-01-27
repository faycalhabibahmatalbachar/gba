import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

import '../animations/app_animation_registry.dart';
import '../animations/app_animation_spec.dart';
import '../animations/app_animations.dart';

class AppAnimation extends StatelessWidget {
  final String id;
  final double? width;
  final double? height;
  final BoxFit fit;
  final bool? loop;
  final bool? autoplay;
  final Widget? fallback;

  const AppAnimation({
    super.key,
    required this.id,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.loop,
    this.autoplay,
    this.fallback,
  });

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) {
      return fallback ?? const SizedBox.shrink();
    }

    return FutureBuilder<AppAnimationSpec?>(
      future: AppAnimationRegistry.instance.getSpec(id),
      builder: (context, snapshot) {
        final spec = snapshot.data;
        if (spec == null) {
          return fallback ?? const SizedBox.shrink();
        }

        final effectiveLoop = loop ?? spec.loop;
        final effectiveAutoplay = autoplay ?? spec.autoplay;

        switch (spec.format) {
          case AppAnimationFormat.lottie:
            return Lottie.asset(
              spec.assetPath,
              width: width,
              height: height,
              fit: fit,
              repeat: effectiveLoop,
              animate: effectiveAutoplay,
            );
          case AppAnimationFormat.dotlottie:
          case AppAnimationFormat.rive:
          case AppAnimationFormat.unknown:
            return fallback ?? const SizedBox.shrink();
        }
      },
    );
  }
}
