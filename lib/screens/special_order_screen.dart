import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import '../localization/app_localizations.dart';
import '../services/special_order_service.dart';

class SpecialOrderScreen extends StatefulWidget {
  const SpecialOrderScreen({super.key});

  @override
  State<SpecialOrderScreen> createState() => _SpecialOrderScreenState();
}

class _SpecialOrderScreenState extends State<SpecialOrderScreen> {
  static const String _draftKey = 'special_order_draft_v1';
  static const int _maxImages = 6;
  static const int _maxImageBytes = 6 * 1024 * 1024;

  final _detailsFormKey = GlobalKey<FormState>();
  final _deliveryFormKey = GlobalKey<FormState>();
  final TextEditingController _productNameController = TextEditingController();
  final TextEditingController _quantityController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _notesController = TextEditingController();

  static const int _totalSteps = 4;
  late final PageController _pageController;
  int _currentStep = 0;
  bool _isSubmitting = false;

  String _shippingMethod = 'air';
  final List<_SelectedImage> _selectedImages = [];
  final ImagePicker _picker = ImagePicker();

  bool _isGettingLocation = false;
  double? _deliveryLat;
  double? _deliveryLng;
  double? _deliveryAccuracy;

  Timer? _draftSaveTimer;
  bool _draftLoaded = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();

    _loadDraft();

    _productNameController.addListener(_scheduleDraftSave);
    _quantityController.addListener(_scheduleDraftSave);
    _descriptionController.addListener(_scheduleDraftSave);
    _notesController.addListener(_scheduleDraftSave);
  }

  void _showSnack(String message, {Color? backgroundColor}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        margin: kIsWeb ? null : const EdgeInsets.fromLTRB(16, 0, 16, 90),
        backgroundColor: backgroundColor,
      ),
    );
  }

  void _scheduleDraftSave() {
    if (!_draftLoaded) return;
    _draftSaveTimer?.cancel();
    _draftSaveTimer = Timer(const Duration(milliseconds: 350), () {
      _saveDraft();
    });
  }

  Future<void> _captureDeliveryLocation() async {
    if (kIsWeb) {
      final localizations = AppLocalizations.of(context);
      _showSnack(localizations.translate('special_order_geolocation_mobile_only'));
      return;
    }

    if (_isGettingLocation) return;
    setState(() => _isGettingLocation = true);

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        final localizations = AppLocalizations.of(context);
        _showSnack(localizations.translate('special_order_enable_location_services'));
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        final localizations = AppLocalizations.of(context);
        _showSnack(localizations.translate('special_order_location_permission_denied'));
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 12),
      );

      if (!mounted) return;
      setState(() {
        _deliveryLat = position.latitude;
        _deliveryLng = position.longitude;
        _deliveryAccuracy = position.accuracy;
      });

      _showSnack(
        AppLocalizations.of(context).translateParams(
          'special_order_location_saved_with_accuracy',
          {'meters': position.accuracy.toStringAsFixed(0)},
        ),
        backgroundColor: Colors.green,
      );
    } catch (e) {
      final localizations = AppLocalizations.of(context);
      _showSnack(
        localizations.translateParams(
          'special_order_location_failed_with_details',
          {'error': e.toString()},
        ),
        backgroundColor: Colors.red,
      );
    } finally {
      if (mounted) {
        setState(() => _isGettingLocation = false);
      }
    }
  }

  Future<void> _loadDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_draftKey);
    if (raw == null || raw.trim().isEmpty) {
      _draftLoaded = true;
      return;
    }

    final parts = raw.split('||');
    if (parts.length < 6) {
      _draftLoaded = true;
      return;
    }

    final productName = parts[0];
    final quantity = parts[1];
    final description = parts[2];
    final notes = parts[3];
    final shippingMethod = parts[4];
    final step = int.tryParse(parts[5]) ?? 0;

    _productNameController.text = productName;
    _quantityController.text = quantity;
    _descriptionController.text = description;
    _notesController.text = notes;
    _shippingMethod = (shippingMethod == 'air' || shippingMethod == 'other') ? shippingMethod : 'air';
    _currentStep = step.clamp(0, _totalSteps - 1);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _pageController.jumpToPage(_currentStep);
      setState(() {});
      _showSnack(AppLocalizations.of(context).translate('special_order_draft_restored'));
    });

    _draftLoaded = true;
  }

  Future<void> _saveDraft() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = [
      _productNameController.text,
      _quantityController.text,
      _descriptionController.text,
      _notesController.text,
      _shippingMethod,
      _currentStep.toString(),
    ].join('||');
    await prefs.setString(_draftKey, raw);
  }

  Future<void> _clearDraft() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey);
  }

  Future<void> _pickImages() async {
    try {
      final List<XFile> images = await _picker.pickMultiImage();
      if (images.isNotEmpty) {
        final remaining = _maxImages - _selectedImages.length;
        if (remaining <= 0) {
          final localizations = AppLocalizations.of(context);
          _showSnack(
            localizations.translateParams(
              'special_order_max_images',
              {'count': _maxImages.toString()},
            ),
          );
          return;
        }

        final picked = images.take(remaining).toList();
        if (images.length > picked.length) {
          final localizations = AppLocalizations.of(context);
          _showSnack(
            localizations.translateParams(
              'special_order_max_images_ignored',
              {'count': _maxImages.toString()},
            ),
          );
        }

        final toAdd = <_SelectedImage>[];
        for (final img in picked) {
          final bytes = await img.readAsBytes();
          if (bytes.lengthInBytes > _maxImageBytes) {
            final localizations = AppLocalizations.of(context);
            _showSnack(
              localizations.translateParams(
                'special_order_image_too_large_with_size',
                {
                  'size': (bytes.lengthInBytes / (1024 * 1024)).toStringAsFixed(1),
                },
              ),
            );
            continue;
          }
          toAdd.add(
            _SelectedImage(
              bytes: bytes,
              fileName: img.name,
              mimeType: img.mimeType,
              randomSuffix: _randomSuffix(),
            ),
          );
        }
        if (!mounted) return;
        setState(() {
          _selectedImages.addAll(toAdd);
        });
      }
    } catch (e) {
      if (!mounted) return;
      final localizations = AppLocalizations.of(context);
      _showSnack(
        localizations.translateParams(
          'special_order_pick_images_error_with_details',
          {'error': e.toString()},
        ),
      );
    }
  }

  Future<void> _goNext() async {
    if (_isSubmitting) return;

    if (_currentStep == 0) {
      final ok = _detailsFormKey.currentState?.validate() ?? false;
      if (!ok) {
        _showSnack(AppLocalizations.of(context).translate('special_order_check_required_fields'));
        return;
      }
    }

    if (_currentStep == 2) {
      final ok = _deliveryFormKey.currentState?.validate() ?? false;
      if (!ok) {
        _showSnack(AppLocalizations.of(context).translate('special_order_check_required_fields'));
        return;
      }
    }

    if (_currentStep >= _totalSteps - 1) {
      await _submitSpecialOrder();
      return;
    }

    final next = _currentStep + 1;
    setState(() {
      _currentStep = next;
    });
    _scheduleDraftSave();
    await _pageController.animateToPage(
      next,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
    );
  }

  Future<void> _goBack() async {
    if (_isSubmitting) return;

    if (_currentStep == 0) {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/home');
      }
      return;
    }

    final prev = _currentStep - 1;
    setState(() {
      _currentStep = prev;
    });
    _scheduleDraftSave();
    await _pageController.animateToPage(
      prev,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOut,
    );
  }

  Widget _card({required Widget child}) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: theme.dividerColor),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
      ),
      child: child,
    );
  }

  InputDecoration _fieldDecoration(String label, {String? hint, IconData? icon}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: icon != null
          ? Padding(
              padding: const EdgeInsets.only(left: 14, right: 10),
              child: Icon(icon, size: 16),
            )
          : null,
      prefixIconConstraints: icon != null
          ? const BoxConstraints(minWidth: 0, minHeight: 0)
          : null,
      filled: true,
      fillColor: Theme.of(context).brightness == Brightness.dark
          ? Theme.of(context).colorScheme.surfaceContainerHighest
          : Colors.grey.withOpacity(0.06),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    );
  }

  static const List<IconData> _stepIcons = [
    FontAwesomeIcons.penToSquare,
    FontAwesomeIcons.camera,
    FontAwesomeIcons.truckFast,
    FontAwesomeIcons.clipboardCheck,
  ];

  static const List<String> _stepKeys = [
    'special_order_step_details',
    'special_order_step_images',
    'special_order_step_delivery',
    'special_order_step_summary',
  ];

  Widget _buildHeader(ThemeData theme, AppLocalizations localizations) {
    final isDark = theme.brightness == Brightness.dark;
    const brandGradient = [Color(0xFF667eea), Color(0xFF764ba2)];

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: brandGradient,
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: const Color(0xFF667eea).withOpacity(0.35),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: _isSubmitting ? null : _goBack,
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white.withOpacity(0.18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  localizations.translate('specialOrder'),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: List.generate(_totalSteps * 2 - 1, (i) {
              if (i.isOdd) {
                final beforeIndex = i ~/ 2;
                final done = beforeIndex < _currentStep;
                return Expanded(
                  child: Container(
                    height: 3,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      color: done
                          ? Colors.white
                          : Colors.white.withOpacity(0.25),
                    ),
                  ),
                );
              }
              final stepIndex = i ~/ 2;
              final isDone = stepIndex < _currentStep;
              final isCurrent = stepIndex == _currentStep;
              return _buildStepDot(
                stepIndex: stepIndex,
                isDone: isDone,
                isCurrent: isCurrent,
                localizations: localizations,
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _buildStepDot({
    required int stepIndex,
    required bool isDone,
    required bool isCurrent,
    required AppLocalizations localizations,
  }) {
    final icon = _stepIcons[stepIndex];
    final label = localizations.translate(_stepKeys[stepIndex]);

    return Column(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          width: isCurrent ? 46 : 38,
          height: isCurrent ? 46 : 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isDone
                ? Colors.white
                : isCurrent
                    ? Colors.white.withOpacity(0.25)
                    : Colors.white.withOpacity(0.10),
            border: isCurrent
                ? Border.all(color: Colors.white, width: 2.5)
                : null,
            boxShadow: isCurrent
                ? [
                    BoxShadow(
                      color: Colors.white.withOpacity(0.35),
                      blurRadius: 12,
                      spreadRadius: 1,
                    )
                  ]
                : null,
          ),
          child: Icon(
            icon,
            size: isCurrent ? 18 : 15,
            color: isDone
                ? const Color(0xFF667eea)
                : Colors.white.withOpacity(isCurrent ? 1.0 : 0.5),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 9,
            fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
            color: Colors.white.withOpacity(isCurrent ? 1.0 : 0.55),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomControls(AppLocalizations localizations) {
    final isLast = _currentStep >= _totalSteps - 1;
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 16,
                  offset: const Offset(0, -4),
                ),
              ],
      ),
      child: Row(
        children: [
          if (_currentStep > 0)
            IconButton(
              onPressed: _isSubmitting ? null : _goBack,
              icon: const Icon(Icons.arrow_back_rounded),
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                minimumSize: const Size(48, 48),
              ),
            )
          else
            OutlinedButton(
              onPressed: _isSubmitting ? null : _goBack,
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: Text(localizations.translate('cancel')),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                ),
                boxShadow: _isSubmitting
                    ? []
                    : [
                        BoxShadow(
                          color: const Color(0xFF667eea).withOpacity(0.4),
                          blurRadius: 14,
                          offset: const Offset(0, 6),
                        ),
                      ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _isSubmitting
                      ? null
                      : () {
                          HapticFeedback.mediumImpact();
                          _goNext();
                        },
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    child: Center(
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  isLast
                                      ? localizations.translate('confirmOrder')
                                      : localizations.translate('save_and_continue'),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                                if (!isLast) ...[
                                  const SizedBox(width: 8),
                                  const Icon(Icons.arrow_forward_rounded,
                                      color: Colors.white, size: 18),
                                ],
                                if (isLast) ...[
                                  const SizedBox(width: 8),
                                  const Icon(FontAwesomeIcons.check,
                                      color: Colors.white, size: 15),
                                ],
                              ],
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailsStep(AppLocalizations localizations) {
    return _card(
      child: Form(
        key: _detailsFormKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localizations.translate('special_order_product_details_title'),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _productNameController,
              decoration: _fieldDecoration(localizations.translate('productName'), icon: FontAwesomeIcons.box),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return localizations.translate('special_order_product_name_required');
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _quantityController,
              decoration: _fieldDecoration(localizations.translate('quantity'), hint: 'Ex: 2', icon: FontAwesomeIcons.hashtag),
              keyboardType: TextInputType.number,
              validator: (value) {
                final q = int.tryParse(value?.trim() ?? '');
                if (q == null || q <= 0) {
                  return localizations.translate('special_order_invalid_quantity');
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: _fieldDecoration(localizations.translate('description'), hint: 'Marque, taille, couleur…', icon: FontAwesomeIcons.alignLeft),
              maxLines: 4,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return localizations.translate('special_order_description_required');
                }
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImagesStep(AppLocalizations localizations) {
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  localizations.translate('special_order_images_optional_title'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: _isSubmitting ? null : _pickImages,
                icon: const Icon(Icons.add_a_photo),
                label: Text(localizations.translate('special_order_add')),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            localizations.translate('special_order_images_hint'),
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 14),
          if (_selectedImages.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? Theme.of(context).colorScheme.surfaceContainerHighest
                    : Colors.grey.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Theme.of(context).dividerColor),
              ),
              child: Text(
                localizations.translate('uploadImage'),
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w700),
              ),
            )
          else
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: List.generate(_selectedImages.length, (index) {
                final img = _selectedImages[index];
                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: Image.memory(
                        img.bytes,
                        width: 104,
                        height: 104,
                        fit: BoxFit.cover,
                      ),
                    ),
                    Positioned(
                      right: 4,
                      top: 4,
                      child: IconButton(
                        icon: const Icon(Icons.close, color: Colors.white),
                        onPressed: _isSubmitting ? null : () => _removeImage(index),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.black.withOpacity(0.55),
                        ),
                      ),
                    ),
                  ],
                );
              }),
            ),
        ],
      ),
    );
  }

  Widget _buildDeliveryStep() {
    final localizations = AppLocalizations.of(context);
    return _card(
      child: Form(
        key: _deliveryFormKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              localizations.translate('special_order_delivery_title'),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _isSubmitting || _isGettingLocation
                  ? null
                  : _captureDeliveryLocation,
              icon: _isGettingLocation
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location),
              label: Text(
                (_deliveryLat != null && _deliveryLng != null)
                    ? localizations.translateParams(
                        'special_order_location_ready_with_accuracy',
                        {'meters': (_deliveryAccuracy ?? 0).toStringAsFixed(0)},
                      )
                    : localizations.translate('special_order_use_my_location'),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? Theme.of(context).colorScheme.surfaceContainerHighest
                    : Colors.grey.withOpacity(0.06),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Theme.of(context).dividerColor),
              ),
              child: Column(
                children: [
                  RadioListTile<String>(
                    value: 'air',
                    groupValue: _shippingMethod,
                    title: Text(localizations.translate('special_order_shipping_air_fast')),
                    onChanged: _isSubmitting
                        ? null
                        : (v) {
                            if (v == null) return;
                            setState(() {
                              _shippingMethod = v;
                            });
                            _scheduleDraftSave();
                          },
                  ),
                  const Divider(height: 1),
                  RadioListTile<String>(
                    value: 'other',
                    groupValue: _shippingMethod,
                    title: Text(localizations.translate('special_order_shipping_other_standard')),
                    onChanged: _isSubmitting
                        ? null
                        : (v) {
                            if (v == null) return;
                            setState(() {
                              _shippingMethod = v;
                            });
                            _scheduleDraftSave();
                          },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notesController,
              decoration: _fieldDecoration(
                localizations.translate('special_order_notes_optional'),
                hint: localizations.translate('special_order_notes_hint'),
              ),
              maxLines: 3,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryStep() {
    final localizations = AppLocalizations.of(context);
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            localizations.translate('special_order_summary_title'),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 14),
          _SummaryRow(
            label: localizations.translate('special_order_summary_product'),
            value: _productNameController.text.trim(),
          ),
          const SizedBox(height: 10),
          _SummaryRow(
            label: localizations.translate('special_order_summary_quantity'),
            value: _quantityController.text.trim(),
          ),
          const SizedBox(height: 10),
          _SummaryRow(
            label: localizations.translate('special_order_summary_delivery'),
            value: _shippingMethod == 'air'
                ? localizations.translate('special_order_shipping_air')
                : localizations.translate('special_order_shipping_standard'),
          ),
          const SizedBox(height: 10),
          _SummaryRow(
            label: localizations.translate('special_order_summary_images'),
            value: _selectedImages.length.toString(),
          ),
          if (_notesController.text.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            _SummaryRow(
              label: localizations.translate('special_order_summary_notes'),
              value: _notesController.text.trim(),
            ),
          ],
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark
                  ? Theme.of(context).colorScheme.surfaceContainerHighest
                  : Colors.grey.withOpacity(0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Theme.of(context).dividerColor),
            ),
            child: Text(
              localizations.translate('special_order_confirm_hint'),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  void _removeImage(int index) {
    setState(() {
      _selectedImages.removeAt(index);
    });
  }

  String _randomSuffix() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final r = Random();
    return List.generate(6, (_) => chars[r.nextInt(chars.length)]).join();
  }

  Future<void> _submitSpecialOrder() async {
    final detailsOk = _detailsFormKey.currentState?.validate() ?? false;
    final deliveryOk = _deliveryFormKey.currentState?.validate() ?? false;
    if (!detailsOk || !deliveryOk) {
      _showSnack(AppLocalizations.of(context).translate('special_order_check_required_fields'));
      return;
    }

    final quantity = int.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      _showSnack(AppLocalizations.of(context).translate('special_order_invalid_quantity'));
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final service = SpecialOrderService();
    final result = await service.createSpecialOrder(
      productName: _productNameController.text.trim(),
      quantity: quantity,
      description: _descriptionController.text.trim(),
      shippingMethod: _shippingMethod,
      notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      deliveryLat: _deliveryLat,
      deliveryLng: _deliveryLng,
      deliveryAccuracy: _deliveryAccuracy,
      deliveryCapturedAt: (_deliveryLat != null && _deliveryLng != null)
          ? DateTime.now().toUtc().toIso8601String()
          : null,
      images: _selectedImages
          .map(
            (img) => SpecialOrderUploadImage(
              bytes: img.bytes,
              fileName: img.fileName,
              mimeType: img.mimeType,
              randomSuffix: img.randomSuffix,
            ),
          )
          .toList(),
    );

    if (!mounted) return;

    setState(() {
      _isSubmitting = false;
    });

    if (result['success'] == true) {
      await _clearDraft();
      final orderId = (result['order'] is Map<String, dynamic>)
          ? (result['order']['id']?.toString() ?? '')
          : '';
      _showSnack(AppLocalizations.of(context).translate('special_order_sent'), backgroundColor: Colors.green);
      if (orderId.isNotEmpty) {
        context.go('/special-order/$orderId');
      } else {
        context.go('/special-orders');
      }
    } else {
      final localizations = AppLocalizations.of(context);
      _showSnack(
        result['error']?.toString() ?? localizations.translate('special_order_send_error'),
        backgroundColor: Colors.red,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    final theme = Theme.of(context);

    return PopScope(
      canPop: _currentStep == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _goBack();
      },
      child: Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.primary.withOpacity(0.08),
              theme.colorScheme.secondary.withOpacity(0.05),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(theme, localizations),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                  child: PageView(
                    controller: _pageController,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      SingleChildScrollView(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        child: _buildDetailsStep(localizations),
                      ),
                      SingleChildScrollView(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        child: _buildImagesStep(localizations),
                      ),
                      SingleChildScrollView(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        child: _buildDeliveryStep(),
                      ),
                      SingleChildScrollView(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        child: _buildSummaryStep(),
                      ),
                    ],
                  ),
                ),
              ),
              _buildBottomControls(localizations),
            ],
          ),
        ),
      ),
      ),
    );
  }

  @override
  void dispose() {
    _draftSaveTimer?.cancel();
    _pageController.dispose();
    _productNameController.dispose();
    _quantityController.dispose();
    _descriptionController.dispose();
    _notesController.dispose();
    super.dispose();
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;

  const _SummaryRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 92,
          child: Text(
            label,
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value.isEmpty ? '—' : value,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _SelectedImage {
  final Uint8List bytes;
  final String fileName;
  final String? mimeType;
  final String randomSuffix;

  const _SelectedImage({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.randomSuffix,
  });
}
