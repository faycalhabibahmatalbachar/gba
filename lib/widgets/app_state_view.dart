import 'package:flutter/material.dart';

import '../animations/app_animations.dart';
import 'app_animation.dart';

enum AppViewState {
  loading,
  empty,
  error,
}

class AppStateView extends StatelessWidget {
  final AppViewState state;
  final String? title;
  final String? subtitle;

  final String? primaryActionLabel;
  final VoidCallback? onPrimaryAction;

  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;

  final String? animationId;
  final double? animationSize;
  final EdgeInsetsGeometry padding;

  const AppStateView({
    super.key,
    required this.state,
    this.title,
    this.subtitle,
    this.primaryActionLabel,
    this.onPrimaryAction,
    this.secondaryActionLabel,
    this.onSecondaryAction,
    this.animationId,
    this.animationSize,
    this.padding = const EdgeInsets.all(24),
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;

    final effectiveAnimationId = animationId ?? _defaultAnimationId(state);
    final effectiveSize = animationSize ?? (state == AppViewState.loading ? 96 : 160);

    final fallback = _fallbackForState(state, scheme);

    final titleText = title?.trim();
    final subtitleText = subtitle?.trim();

    final showPrimary = onPrimaryAction != null && (primaryActionLabel?.trim().isNotEmpty ?? false);
    final showSecondary =
        onSecondaryAction != null && (secondaryActionLabel?.trim().isNotEmpty ?? false);

    return Center(
      child: SingleChildScrollView(
        padding: padding,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppAnimation(
                id: effectiveAnimationId,
                width: effectiveSize,
                height: effectiveSize,
                fallback: fallback,
              ),
              if (titleText != null && titleText.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  titleText,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: scheme.onSurface,
                  ),
                ),
              ],
              if (subtitleText != null && subtitleText.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  subtitleText,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: scheme.onSurface.withOpacity(0.70),
                    height: 1.35,
                  ),
                ),
              ],
              if (showPrimary || showSecondary) ...[
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (showSecondary)
                      TextButton(
                        onPressed: onSecondaryAction,
                        child: Text(secondaryActionLabel!.trim()),
                      ),
                    if (showSecondary && showPrimary) const SizedBox(width: 12),
                    if (showPrimary)
                      ElevatedButton(
                        onPressed: onPrimaryAction,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: scheme.primary,
                          foregroundColor: scheme.onPrimary,
                        ),
                        child: Text(primaryActionLabel!.trim()),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _defaultAnimationId(AppViewState state) {
    switch (state) {
      case AppViewState.loading:
        return AppAnimations.loadingSpinner;
      case AppViewState.empty:
        return AppAnimations.emptyBox;
      case AppViewState.error:
        return AppAnimations.errorNoInternet;
    }
  }

  static Widget _fallbackForState(AppViewState state, ColorScheme scheme) {
    switch (state) {
      case AppViewState.loading:
        return SizedBox(
          width: 36,
          height: 36,
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: scheme.primary,
          ),
        );
      case AppViewState.empty:
        return Icon(Icons.inventory_2_outlined, size: 56, color: scheme.primary.withOpacity(0.55));
      case AppViewState.error:
        return Icon(Icons.wifi_off_rounded, size: 56, color: scheme.error.withOpacity(0.75));
    }
  }
}
