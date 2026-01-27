import 'app_animations.dart';

class AppAnimationSpec {
  final String id;
  final AppAnimationFormat format;
  final String assetPath;
  final bool loop;
  final bool autoplay;

  const AppAnimationSpec({
    required this.id,
    required this.format,
    required this.assetPath,
    required this.loop,
    required this.autoplay,
  });
}
