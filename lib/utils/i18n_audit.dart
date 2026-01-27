import 'dart:collection';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

class I18nAudit extends ChangeNotifier {
  static final I18nAudit instance = I18nAudit._();
  I18nAudit._();

  bool get enabled => kDebugMode;

  Locale? _locale;
  String _location = '';

  final Map<String, Set<String>> _missingKeysByLocale = <String, Set<String>>{};
  final Map<String, Set<String>> _suspiciousTextsByLocation = <String, Set<String>>{};

  bool _scanScheduled = false;

  Locale? get locale => _locale;
  String get location => _location;

  UnmodifiableMapView<String, Set<String>> get missingKeysByLocale =>
      UnmodifiableMapView(_missingKeysByLocale);

  UnmodifiableMapView<String, Set<String>> get suspiciousTextsByLocation =>
      UnmodifiableMapView(_suspiciousTextsByLocation);

  Set<String> missingKeysForLocale(String languageCode) {
    return _missingKeysByLocale[languageCode] ?? const <String>{};
  }

  Set<String> suspiciousTextsForLocation(String location) {
    return _suspiciousTextsByLocation[location] ?? const <String>{};
  }

  void updateLocale(Locale locale) {
    if (_locale == locale) return;
    _locale = locale;
    notifyListeners();
  }

  void updateLocation(String location) {
    final next = location.trim();
    if (_location == next) return;
    _location = next;
    notifyListeners();
  }

  void reportMissingKey({required String key, required Locale locale}) {
    if (!enabled) return;

    final lang = locale.languageCode;
    final set = _missingKeysByLocale.putIfAbsent(lang, () => <String>{});
    final added = set.add(key);
    if (added) {
      debugPrint('[I18nAudit] missing key for $lang: $key');
      notifyListeners();
    }
  }

  void clear() {
    if (!enabled) return;

    _missingKeysByLocale.clear();
    _suspiciousTextsByLocation.clear();
    notifyListeners();
  }

  void scheduleScan({
    required GlobalKey<NavigatorState> navigatorKey,
    required GoRouter router,
  }) {
    if (!enabled) return;
    if (_scanScheduled) return;

    _scanScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scanScheduled = false;

      final ctx = navigatorKey.currentContext;
      if (ctx == null) return;

      final detectedLocale = Localizations.maybeLocaleOf(ctx);
      if (detectedLocale != null) {
        updateLocale(detectedLocale);
      }
      updateLocation(router.routeInformationProvider.value.location ?? '');

      _scan(ctx);
    });
  }

  static final RegExp _arabicChars = RegExp(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]');
  static final RegExp _latinChars = RegExp(r'[A-Za-zÀ-ÿ]');
  static final RegExp _mostlyNonLetters = RegExp(r'^[0-9\s\W]+$');

  bool _isSuspiciousText(String raw, Locale locale) {
    if (locale.languageCode != 'ar') return false;

    final text = raw.trim();
    if (text.isEmpty) return false;
    if (text.length <= 1) return false;

    final lower = text.toLowerCase();
    if (lower.contains('http://') || lower.contains('https://') || lower.contains('www.')) {
      return false;
    }

    if (_mostlyNonLetters.hasMatch(text)) return false;

    final hasArabic = _arabicChars.hasMatch(text);
    if (hasArabic) return false;

    final hasLatin = _latinChars.hasMatch(text);
    if (!hasLatin) return false;

    return true;
  }

  String _flattenSpan(InlineSpan span) {
    final buffer = StringBuffer();

    void visit(InlineSpan s) {
      if (s is TextSpan) {
        final t = s.text;
        if (t != null) buffer.write(t);
        final children = s.children;
        if (children != null) {
          for (final c in children) {
            visit(c);
          }
        }
      }
    }

    visit(span);
    return buffer.toString();
  }

  void _scan(BuildContext context) {
    final locale = Localizations.maybeLocaleOf(context) ?? _locale ?? const Locale('en');
    final location = _location;

    final rootElement = context is Element ? context : null;
    if (rootElement == null) return;

    final next = <String>{};

    void walk(Element element) {
      final widget = element.widget;

      String? text;
      if (widget is Text) {
        text = widget.data;
        if (text == null && widget.textSpan != null) {
          text = _flattenSpan(widget.textSpan!);
        }
      } else if (widget is SelectableText) {
        text = widget.data;
        if (text == null && widget.textSpan != null) {
          text = _flattenSpan(widget.textSpan!);
        }
      } else if (widget is RichText) {
        text = _flattenSpan(widget.text);
      }

      if (text != null && _isSuspiciousText(text, locale)) {
        next.add(text.trim());
      }

      element.visitChildElements(walk);
    }

    walk(rootElement);

    final prev = _suspiciousTextsByLocation[location] ?? const <String>{};
    if (!setEquals(prev, next)) {
      _suspiciousTextsByLocation[location] = next;

      final added = next.difference(prev);
      for (final t in added) {
        debugPrint('[I18nAudit] suspicious text ($location): $t');
      }

      notifyListeners();
    }
  }
}

class I18nAuditOverlay extends StatefulWidget {
  const I18nAuditOverlay({
    super.key,
    required this.child,
    required this.navigatorKey,
    required this.router,
  });

  final Widget child;
  final GlobalKey<NavigatorState> navigatorKey;
  final GoRouter router;

  @override
  State<I18nAuditOverlay> createState() => _I18nAuditOverlayState();
}

class _I18nAuditOverlayState extends State<I18nAuditOverlay> {
  VoidCallback? _routerListener;

  @override
  void initState() {
    super.initState();

    if (I18nAudit.instance.enabled) {
      _routerListener = () {
        I18nAudit.instance.scheduleScan(
          navigatorKey: widget.navigatorKey,
          router: widget.router,
        );
      };
      widget.router.routeInformationProvider.addListener(_routerListener!);

      WidgetsBinding.instance.addPostFrameCallback((_) {
        I18nAudit.instance.scheduleScan(
          navigatorKey: widget.navigatorKey,
          router: widget.router,
        );
      });
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (I18nAudit.instance.enabled) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        I18nAudit.instance.scheduleScan(
          navigatorKey: widget.navigatorKey,
          router: widget.router,
        );
      });
    }
  }

  @override
  void dispose() {
    final l = _routerListener;
    if (l != null) {
      widget.router.routeInformationProvider.removeListener(l);
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!I18nAudit.instance.enabled) return widget.child;

    return AnimatedBuilder(
      animation: I18nAudit.instance,
      builder: (context, _) {
        final navCtx = widget.navigatorKey.currentContext;
        final locale =
            I18nAudit.instance.locale ?? Localizations.maybeLocaleOf(navCtx ?? context) ?? const Locale('en');
        final lang = locale.languageCode;
        final location = I18nAudit.instance.location;

        final missing = I18nAudit.instance.missingKeysForLocale(lang).length;
        final suspicious = I18nAudit.instance.suspiciousTextsForLocation(location).length;

        return Stack(
          alignment: Alignment.topLeft,
          children: [
            widget.child,
            Positioned(
              right: 12,
              bottom: 12,
              child: SafeArea(
                child: FloatingActionButton.small(
                  heroTag: 'i18n-audit',
                  onPressed: () => _openPanel(context),
                  child: Text(
                    '${missing + suspicious}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _openPanel(BuildContext context) async {
    final navCtx = widget.navigatorKey.currentContext;
    if (navCtx == null) return;

    final locale = I18nAudit.instance.locale ?? Localizations.maybeLocaleOf(navCtx) ?? const Locale('en');
    final lang = locale.languageCode;
    final location = I18nAudit.instance.location;

    final missingKeys = I18nAudit.instance.missingKeysForLocale(lang).toList()..sort();
    final suspicious = I18nAudit.instance.suspiciousTextsForLocation(location).toList()..sort();

    await showModalBottomSheet<void>(
      context: navCtx,
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'I18n Audit',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text('locale: $lang'),
                Text('route: $location'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    ElevatedButton(
                      onPressed: () {
                        final report = _buildReport(lang: lang, location: location);
                        Clipboard.setData(ClipboardData(text: report));
                        Navigator.of(context).pop();
                      },
                      child: const Text('Copy'),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      onPressed: () {
                        I18nAudit.instance.clear();
                        Navigator.of(context).pop();
                      },
                      child: const Text('Clear'),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      onPressed: () {
                        I18nAudit.instance.scheduleScan(
                          navigatorKey: widget.navigatorKey,
                          router: widget.router,
                        );
                        Navigator.of(context).pop();
                      },
                      child: const Text('Rescan'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Flexible(
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      Text(
                        'Missing keys ($missingKeys.length)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      if (missingKeys.isEmpty) const Text('None'),
                      for (final k in missingKeys) Text(k),
                      const SizedBox(height: 16),
                      Text(
                        'Suspicious texts ($suspicious.length)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      if (suspicious.isEmpty) const Text('None'),
                      for (final t in suspicious) Text(t),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _buildReport({required String lang, required String location}) {
    final missingKeys = I18nAudit.instance.missingKeysForLocale(lang).toList()..sort();
    final suspicious = I18nAudit.instance.suspiciousTextsForLocation(location).toList()..sort();

    final b = StringBuffer();
    b.writeln('I18n Audit');
    b.writeln('locale: $lang');
    b.writeln('route: $location');
    b.writeln('');
    b.writeln('Missing keys:');
    for (final k in missingKeys) {
      b.writeln('- $k');
    }
    b.writeln('');
    b.writeln('Suspicious texts:');
    for (final t in suspicious) {
      b.writeln('- $t');
    }
    return b.toString();
  }
}
