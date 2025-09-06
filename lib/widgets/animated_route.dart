import 'package:flutter/material.dart';
import '../utils/page_transitions.dart';

class AnimatedRoute {
  static Route fadeScale(Widget page) {
    return FadeScaleTransition(page: page);
  }
  
  static Route slideLeft(Widget page) {
    return SlideFadeTransition(page: page, direction: AxisDirection.left);
  }
  
  static Route slideRight(Widget page) {
    return SlideFadeTransition(page: page, direction: AxisDirection.right);
  }
  
  static Route slideUp(Widget page) {
    return SlideFadeTransition(page: page, direction: AxisDirection.up);
  }
  
  static Route slideDown(Widget page) {
    return SlideFadeTransition(page: page, direction: AxisDirection.down);
  }
  
  static Route flip(Widget page) {
    return FlipTransition(page: page);
  }
  
  static Route parallax(Widget page) {
    return ParallaxTransition(page: page);
  }
  
  static Route heroDiagonal(Widget page) {
    return HeroDiagonalTransition(page: page);
  }
  
  static Route elastic(Widget page) {
    return ElasticTransition(page: page);
  }
}
