import 'package:flutter/material.dart';

/// An adaptive back button that respects RTL/LTR layout direction
class AdaptiveBackButton extends StatelessWidget {
  final Color? color;
  final VoidCallback? onPressed;

  const AdaptiveBackButton({
    Key? key,
    this.color,
    this.onPressed,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isRTL = Directionality.of(context) == TextDirection.rtl;
    
    return IconButton(
      icon: Icon(
        isRTL ? Icons.arrow_forward : Icons.arrow_back,
        color: color ?? Theme.of(context).iconTheme.color,
      ),
      onPressed: onPressed ?? () => Navigator.of(context).maybePop(),
      tooltip: MaterialLocalizations.of(context).backButtonTooltip,
    );
  }
}
