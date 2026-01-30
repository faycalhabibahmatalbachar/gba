import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'app_animation_spec.dart';
import 'app_animations.dart';

class AppAnimationRegistry {
  static const String manifestAssetPath = 'assets/animations/manifest.json';

  AppAnimationRegistry._();

  static final AppAnimationRegistry instance = AppAnimationRegistry._();

  Map<String, AppAnimationSpec>? _specs;
  Future<void>? _loadFuture;

  Future<void> _ensureLoaded() {
    return _loadFuture ??= _loadManifest();
  }

  Future<void> _loadManifest() async {
    final jsonString = await rootBundle.loadString(manifestAssetPath);
    final decoded = json.decode(jsonString);

    if (decoded is! Map<String, dynamic>) {
      _specs = <String, AppAnimationSpec>{};
      return;
    }

    final basePathRaw = decoded['basePath'];
    final basePath = (basePathRaw is String && basePathRaw.trim().isNotEmpty)
        ? basePathRaw.trim()
        : 'assets/animations';

    final animationsRaw = decoded['animations'];
    if (animationsRaw is! Map) {
      _specs = <String, AppAnimationSpec>{};
      return;
    }

    final specs = <String, AppAnimationSpec>{};

    for (final entry in animationsRaw.entries) {
      final id = entry.key;
      if (id is! String) continue;

      final rawSpec = entry.value;
      if (rawSpec is! Map) continue;

      final specMap = Map<String, dynamic>.from(rawSpec);

      final format = _parseFormat(specMap['format']);
      final path = specMap['path'];
      if (path is! String || path.trim().isEmpty) continue;

      final loop = specMap['loop'] is bool ? specMap['loop'] as bool : false;
      final autoplay =
          specMap['autoplay'] is bool ? specMap['autoplay'] as bool : true;

      final assetPath = _join(basePath, path.trim());

      try {
        await rootBundle.load(assetPath);
      } catch (_) {
        continue;
      }

      specs[id] = AppAnimationSpec(
        id: id,
        format: format,
        assetPath: assetPath,
        loop: loop,
        autoplay: autoplay,
      );
    }

    _specs = specs;
  }

  Future<AppAnimationSpec?> getSpec(String id) async {
    await _ensureLoaded();
    return _specs?[id];
  }

  static AppAnimationFormat _parseFormat(Object? raw) {
    final value = raw is String ? raw.trim().toLowerCase() : '';

    switch (value) {
      case 'lottie':
        return AppAnimationFormat.lottie;
      case 'dotlottie':
        return AppAnimationFormat.dotlottie;
      case 'rive':
        return AppAnimationFormat.rive;
      default:
        return AppAnimationFormat.unknown;
    }
  }

  static String _join(String base, String relative) {
    final normalizedBase = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    final normalizedRel = relative.startsWith('/') ? relative.substring(1) : relative;
    return '$normalizedBase/$normalizedRel';
  }
}
