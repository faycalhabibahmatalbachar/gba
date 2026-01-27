import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/profile.dart';
import '../services/profile_service.dart';
import '../providers/auth_provider.dart';
import '../providers/favorites_provider.dart';
import '../routes/app_routes.dart';
import '../widgets/adaptive_scaffold.dart';
import 'settings_screen_premium.dart';

class ProfileScreenUltra extends StatefulWidget {
  const ProfileScreenUltra({super.key});

  @override
  State<ProfileScreenUltra> createState() => _ProfileScreenUltraState();
}

class _ProfileScreenUltraState extends State<ProfileScreenUltra>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late AnimationController _pulseController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _pulseAnimation;
  
  final ImagePicker _picker = ImagePicker();
  late final ProfileService _profileService;
  bool _isEditing = false;
  bool _isUploadingPhoto = false;
  Profile? _profile;
  String? _coverUrl;
  bool _isLoadingProfile = true;
  Map<String, dynamic> _stats = {'orders': 0, 'favorites': 0, 'reviews': 0, 'points': 0};
  int _selectedTab = 0;
  
  // Controllers pour les champs
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _bioController = TextEditingController();
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _postalCodeController = TextEditingController();
  final _countryController = TextEditingController(text: 'France');

  String _effectiveEmail(Profile? profile) {
    final p = (profile?.email ?? '').trim();
    if (p.isNotEmpty) return p;
    return (Supabase.instance.client.auth.currentUser?.email ?? '').trim();
  }

  double _profileCompletionRatio(Profile? profile) {
    const total = 6;
    var filled = 0;
    if ((profile?.firstName ?? '').trim().isNotEmpty) filled++;
    if ((profile?.lastName ?? '').trim().isNotEmpty) filled++;
    if (_effectiveEmail(profile).isNotEmpty) filled++;
    if ((profile?.phone ?? '').trim().isNotEmpty) filled++;
    if ((profile?.address ?? '').trim().isNotEmpty) filled++;
    if ((profile?.city ?? '').trim().isNotEmpty) filled++;
    return filled / total;
  }
  
  @override
  void initState() {
    super.initState();
    _profileService = ProfileService();
    _loadProfile();
    _loadStats();
    
    // Initialisation des animations
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );
    
    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeInOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: Curves.easeOutCubic,
    ));
    _scaleAnimation = CurvedAnimation(
      parent: _scaleController,
      curve: Curves.easeOutBack,
    );
    _pulseAnimation = Tween<double>(
      begin: 1.0,
      end: 1.1,
    ).animate(CurvedAnimation(
      parent: _pulseController,
      curve: Curves.easeInOut,
    ));
    
    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
    _pulseController.repeat(reverse: true);
  }

  Widget _buildProfileCompletionCard(Profile? profile) {
    final ratio = _profileCompletionRatio(profile);
    final percent = (ratio * 100).round();
    final isComplete = ratio >= 0.999;

    if (isComplete) {
      return const SizedBox.shrink();
    }

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Complétion du profil',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                Text(
                  '$percent%',
                  style: const TextStyle(
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF667eea),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: ratio,
                minHeight: 10,
              ),
            ),
            if (!isComplete) ...[
              const SizedBox(height: 12),
              Text(
                'Complète ton profil pour accélérer le checkout.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () => context.push('/onboarding'),
                icon: const Icon(Icons.auto_fix_high_rounded),
                label: const Text('Compléter maintenant'),
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  Future<void> _loadProfile() async {
    setState(() => _isLoadingProfile = true);
    try {
      final cached = await _profileService.getCachedUserProfile();
      if (mounted && cached != null) {
        setState(() {
          _profile = cached;
          _isLoadingProfile = false;
          _firstNameController.text = cached.firstName ?? '';
          _lastNameController.text = cached.lastName ?? '';
          _emailController.text = _effectiveEmail(cached);
          _phoneController.text = cached.phone ?? '';
          _bioController.text = cached.bio ?? '';
          _addressController.text = cached.address ?? '';
          _cityController.text = cached.city ?? '';
          _postalCodeController.text = cached.postalCode ?? '';
        });
      }

      final profile = await _profileService.getCurrentUserProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _isLoadingProfile = false;
          if (profile != null) {
            _firstNameController.text = profile.firstName ?? '';
            _lastNameController.text = profile.lastName ?? '';
            _emailController.text = _effectiveEmail(profile);
            _phoneController.text = profile.phone ?? '';
            _bioController.text = profile.bio ?? '';
            _addressController.text = profile.address ?? '';
            _cityController.text = profile.city ?? '';
            _postalCodeController.text = profile.postalCode ?? '';
          }
        });
      }

      final userId = Supabase.instance.client.auth.currentUser?.id;
      if (userId != null) {
        try {
          final url = await _profileService.getCoverUrl(userId);
          if (mounted) setState(() => _coverUrl = url);
        } catch (_) {}

        await _loadStats();
      }
    } catch (e) {
      print('Error loading profile: $e');
      if (mounted) {
        setState(() => _isLoadingProfile = false);
      }
    }
  }
  
  Future<void> _loadStats() async {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    if (userId == null) return;

    final stats = await _profileService.getProfileStats(userId);
    final points = _profile?.loyaltyPoints ?? 0;
    if (!mounted) return;
    setState(() {
      _stats = {
        'orders': stats['orders'] ?? 0,
        'favorites': stats['favorites'] ?? 0,
        'reviews': stats['reviews'] ?? 0,
        'points': points,
      };
    });
  }
  
  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _pulseController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _postalCodeController.dispose();
    _countryController.dispose();
    super.dispose();
  }

  Future<void> _showImageViewer({required String title, required String imageUrl}) async {
    await showDialog<void>(
      context: context,
      builder: (context) {
        return Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: InteractiveViewer(
                  child: CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _showAvatarActions() async {
    final avatarUrl = _profile?.avatarUrl;

    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(16),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  leading: const Icon(Icons.visibility),
                  title: const Text('Voir'),
                  enabled: avatarUrl != null && avatarUrl.trim().isNotEmpty,
                  onTap: avatarUrl == null || avatarUrl.trim().isEmpty
                      ? null
                      : () => Navigator.pop(context, 'view'),
                ),
                ListTile(
                  leading: const Icon(Icons.photo_camera),
                  title: const Text('Modifier'),
                  onTap: () => Navigator.pop(context, 'change'),
                ),
                ListTile(
                  leading: Icon(Icons.delete, color: Theme.of(context).colorScheme.error),
                  title: Text('Supprimer', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  enabled: avatarUrl != null && avatarUrl.trim().isNotEmpty,
                  onTap: avatarUrl == null || avatarUrl.trim().isEmpty
                      ? null
                      : () => Navigator.pop(context, 'delete'),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (action == null) return;

    if (action == 'view' && avatarUrl != null && avatarUrl.trim().isNotEmpty) {
      await _showImageViewer(title: 'Photo de profil', imageUrl: avatarUrl);
      return;
    }
    if (action == 'change') {
      await _pickImage();
      return;
    }
    if (action == 'delete') {
      setState(() => _isUploadingPhoto = true);
      try {
        await _profileService.deleteAvatar();
        await _loadProfile();
      } finally {
        if (mounted) setState(() => _isUploadingPhoto = false);
      }
    }
  }

  Future<void> _showCoverActions() async {
    final coverUrl = _coverUrl;

    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(16),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                ListTile(
                  leading: const Icon(Icons.visibility),
                  title: const Text('Voir'),
                  enabled: coverUrl != null && coverUrl.trim().isNotEmpty,
                  onTap: coverUrl == null || coverUrl.trim().isEmpty
                      ? null
                      : () => Navigator.pop(context, 'view'),
                ),
                ListTile(
                  leading: const Icon(Icons.photo),
                  title: const Text('Modifier'),
                  onTap: () => Navigator.pop(context, 'change'),
                ),
                ListTile(
                  leading: Icon(Icons.delete, color: Theme.of(context).colorScheme.error),
                  title: Text('Supprimer', style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  enabled: coverUrl != null && coverUrl.trim().isNotEmpty,
                  onTap: coverUrl == null || coverUrl.trim().isEmpty
                      ? null
                      : () => Navigator.pop(context, 'delete'),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (action == null) return;

    if (action == 'view' && coverUrl != null && coverUrl.trim().isNotEmpty) {
      await _showImageViewer(title: 'Photo de couverture', imageUrl: coverUrl);
      return;
    }
    if (action == 'change') {
      final source = await showModalBottomSheet<ImageSource>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (context) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.onSurfaceVariant.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Choisir une couverture',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildImageSourceOption(
                    icon: FontAwesomeIcons.camera,
                    label: 'Caméra',
                    onTap: () => Navigator.pop(context, ImageSource.camera),
                  ),
                  _buildImageSourceOption(
                    icon: FontAwesomeIcons.images,
                    label: 'Galerie',
                    onTap: () => Navigator.pop(context, ImageSource.gallery),
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      );

      if (source == null) return;
      final image = await _picker.pickImage(
        source: source,
        maxWidth: 1800,
        maxHeight: 900,
        imageQuality: 85,
      );
      if (image == null) return;

      setState(() => _isUploadingPhoto = true);
      try {
        final url = await _profileService.uploadCover(image);
        if (mounted) setState(() => _coverUrl = url);
      } finally {
        if (mounted) setState(() => _isUploadingPhoto = false);
      }
      return;
    }
    if (action == 'delete') {
      setState(() => _isUploadingPhoto = true);
      try {
        await _profileService.deleteCover();
        if (mounted) setState(() => _coverUrl = null);
      } finally {
        if (mounted) setState(() => _isUploadingPhoto = false);
      }
    }
  }
  
  Future<void> _pickImage() async {
    try {
      setState(() => _isUploadingPhoto = true);
      
      final source = await showModalBottomSheet<ImageSource>(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (context) => Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Choisir une photo',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildImageSourceOption(
                    icon: FontAwesomeIcons.camera,
                    label: 'Caméra',
                    onTap: () => Navigator.pop(context, ImageSource.camera),
                  ),
                  _buildImageSourceOption(
                    icon: FontAwesomeIcons.images,
                    label: 'Galerie',
                    onTap: () => Navigator.pop(context, ImageSource.gallery),
                  ),
                ],
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      );
      
      if (source != null) {
        final XFile? image = await _picker.pickImage(
          source: source,
          maxWidth: 1000,
          maxHeight: 1000,
          imageQuality: 85,
        );
        
        if (image != null) {
          HapticFeedback.mediumImpact();
          final avatarUrl = await _profileService.uploadAvatar(image);
          
          if (avatarUrl != null) {
            _loadProfile();
            _showSuccessMessage('Photo mise à jour avec succès!');
          }
        }
      }
    } catch (e) {
      _showErrorMessage('Erreur lors de la mise à jour de la photo');
    } finally {
      setState(() => _isUploadingPhoto = false);
    }
  }
  
  Widget _buildImageSourceOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        decoration: BoxDecoration(
          color: theme.brightness == Brightness.dark
              ? theme.colorScheme.surface
              : Colors.grey[100],
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, size: 32, color: const Color(0xFF667eea)),
            const SizedBox(height: 8),
            Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
  
  Future<void> _saveProfile(Profile profile) async {
    if (!_validateForm()) return;
    
    HapticFeedback.lightImpact();
    
    final updatedProfile = profile.copyWith(
      firstName: _firstNameController.text,
      lastName: _lastNameController.text,
      email: _emailController.text.trim().isEmpty ? _effectiveEmail(profile) : _emailController.text.trim(),
      phone: _phoneController.text,
      bio: _bioController.text,
      address: _addressController.text,
      city: _cityController.text,
      postalCode: _postalCodeController.text,
    );
    
    final success = await _profileService.updateProfile(updatedProfile);
    
    if (success && mounted) {
      setState(() => _isEditing = false);
      _loadProfile();
      _showSuccessMessage('Profil mis à jour avec succès!');
    }
  }
  
  bool _validateForm() {
    if (_firstNameController.text.isEmpty || _lastNameController.text.isEmpty) {
      _showErrorMessage('Veuillez remplir tous les champs obligatoires');
      return false;
    }
    final phoneDigits = _phoneController.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (phoneDigits.isNotEmpty && phoneDigits.length < 8) {
      _showErrorMessage('Numéro de téléphone invalide');
      return false;
    }
    if (_emailController.text.isNotEmpty && !RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(_emailController.text)) {
      _showErrorMessage('Email invalide');
      return false;
    }
    return true;
  }
  
  void _showSuccessMessage(String message) {
    final messenger =
        ScaffoldMessenger.maybeOf(context) ?? AppRoutes.scaffoldMessengerKey.currentState;
    if (messenger == null) return;
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(FontAwesomeIcons.circleCheck, color: Colors.white, size: 20),
            const SizedBox(width: 12),
            Text(message),
          ],
        ),
        backgroundColor: Colors.green,
        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
  
  void _showErrorMessage(String message) {
    final messenger =
        ScaffoldMessenger.maybeOf(context) ?? AppRoutes.scaffoldMessengerKey.currentState;
    if (messenger == null) return;
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(FontAwesomeIcons.circleExclamation, color: Colors.white, size: 20),
            const SizedBox(width: 12),
            Text(message),
          ],
        ),
        backgroundColor: Colors.red,
        behavior: kIsWeb ? SnackBarBehavior.fixed : SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
  
  @override
  Widget build(BuildContext context) {
    // Get data from state
    final profile = _profile;
    final isLoading = _isLoadingProfile;
    final stats = _stats;
    final favoritesCount = 0; // TODO: Get from FavoritesProvider
    final theme = Theme.of(context);
    final isDarkMode = theme.brightness == Brightness.dark;
    
    if (isLoading) {
      return _buildLoadingState();
    }
    
    if (profile == null) {
      return _buildErrorState();
    }
    
    return AdaptiveScaffold(
      currentIndex: 4,
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // Background gradient
          AnimatedContainer(
            duration: const Duration(seconds: 3),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDarkMode
                    ? [
                        Colors.deepPurple.shade900.withOpacity(0.3),
                        Colors.purple.shade900.withOpacity(0.3),
                      ]
                    : [
                        const Color(0xFF667eea).withOpacity(0.05),
                        const Color(0xFF764ba2).withOpacity(0.05),
                      ],
              ),
            ),
          ),
          
          CustomScrollView(
            physics: const BouncingScrollPhysics(),
            slivers: [
              SliverAppBar(
                expandedHeight: 320,
                pinned: true,
                backgroundColor: Colors.transparent,
                flexibleSpace: _buildModernHeader(profile),
              ),
              
              SliverToBoxAdapter(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          _buildProfileCompletionCard(profile),
                          const SizedBox(height: 18),
                          _buildAnimatedStats(stats),
                          const SizedBox(height: 32),
                          _buildTabSelector(),
                          const SizedBox(height: 24),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 500),
                            child: _selectedTab == 0
                                ? _buildProfileInfo(profile)
                                : _buildEditForm(profile),
                          ),
                          const SizedBox(height: 32),
                          _buildQuickActions(),
                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildLoadingState() {
    return Center(
      child: CircularProgressIndicator(
        color: const Color(0xFF667eea),
      ),
    );
  }
  
  Widget _buildErrorState() {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              FontAwesomeIcons.triangleExclamation,
              size: 60,
              color: Colors.red[300],
            ),
            const SizedBox(height: 16),
            Text(
              'Erreur de chargement',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                _loadProfile();
              },
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildModernHeader(Profile? profile) {
    final ratio = _profileCompletionRatio(profile);
    final isComplete = ratio >= 0.999;
    final email = _effectiveEmail(profile);

    return FlexibleSpaceBar(
      background: Stack(
        fit: StackFit.expand,
        children: [
          _coverUrl != null
              ? CachedNetworkImage(
                  imageUrl: _coverUrl!,
                  fit: BoxFit.cover,
                  errorWidget: (context, url, error) {
                    return Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                        ),
                      ),
                    );
                  },
                )
              : Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                    ),
                  ),
                ),
          
          Positioned(
            right: -100,
            top: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Theme.of(context).colorScheme.surface.withOpacity(0.1),
              ),
            ),
          ),
          
          Positioned.fill(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _showCoverActions,
                child: const SizedBox.expand(),
              ),
            ),
          ),

          SafeArea(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 18),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ScaleTransition(
                      scale: _scaleAnimation,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          if (isComplete)
                            SizedBox(
                              width: 146,
                              height: 146,
                              child: CircularProgressIndicator(
                                value: 1,
                                strokeWidth: 7,
                                color: const Color(0xFF00C853),
                                backgroundColor: Colors.white.withOpacity(0.25),
                              ),
                            ),
                          GestureDetector(
                            onTap: _showAvatarActions,
                            child: Container(
                              width: 130,
                              height: 130,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LinearGradient(
                                  colors: [
                                    Theme.of(context).colorScheme.surface.withOpacity(0.9),
                                    Theme.of(context).colorScheme.surface.withOpacity(0.6),
                                  ],
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(4),
                              child: ClipOval(
                                child: profile?.avatarUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: profile!.avatarUrl!,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(
                                          color: Colors.grey[200],
                                          child: const Center(
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          ),
                                        ),
                                      )
                                    : Container(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              Colors.purple.shade200,
                                              Colors.blue.shade200,
                                            ],
                                          ),
                                        ),
                                        child: Icon(
                                          FontAwesomeIcons.userLarge,
                                          size: 50,
                                          color: Colors.white,
                                        ),
                                      ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: AnimatedScale(
                              scale: _isUploadingPhoto ? 1.2 : 1.0,
                              duration: const Duration(milliseconds: 200),
                              child: Container(
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Theme.of(context).colorScheme.surface,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.2),
                                      blurRadius: 10,
                                    ),
                                  ],
                                ),
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: _isUploadingPhoto ? null : _showAvatarActions,
                                    borderRadius: BorderRadius.circular(20),
                                    child: Padding(
                                      padding: const EdgeInsets.all(8),
                                      child: _isUploadingPhoto
                                          ? const SizedBox(
                                              width: 20,
                                              height: 20,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                              ),
                                            )
                                          : const Icon(
                                              FontAwesomeIcons.camera,
                                              size: 20,
                                              color: Color(0xFF667eea),
                                            ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${profile?.firstName ?? ''} ${profile?.lastName ?? ''}',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimary,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    if (email.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        email,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onPrimary.withOpacity(0.9),
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildAnimatedStats(Map<String, dynamic> stats) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 380;
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: isNarrow ? 2.05 : 2.3,
          children: [
            _buildStatCard(
              icon: FontAwesomeIcons.bagShopping,
              label: 'Commandes',
              value: stats['orders'].toString(),
              color: Colors.blue,
              delay: 0,
            ),
            _buildStatCard(
              icon: FontAwesomeIcons.heart,
              label: 'Favoris',
              value: stats['favorites'].toString(),
              color: Colors.red,
              delay: 100,
            ),
            _buildStatCard(
              icon: FontAwesomeIcons.star,
              label: 'Avis',
              value: stats['reviews'].toString(),
              color: Colors.amber,
              delay: 200,
            ),
            _buildStatCard(
              icon: FontAwesomeIcons.coins,
              label: 'Points',
              value: stats['points'].toString(),
              color: Colors.green,
              delay: 300,
            ),
          ],
        );
      },
    );
  }
  
  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
    required int delay,
  }) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 500 + delay),
      curve: Curves.easeOutBack,
      builder: (context, animValue, child) {
        final theme = Theme.of(context);
        return Transform.scale(
          scale: animValue,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.2),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.bold,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
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
  
  Widget _buildTabSelector() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? theme.colorScheme.surface : Colors.grey[100],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = 0),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _selectedTab == 0 ? Theme.of(context).colorScheme.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _selectedTab == 0
                      ? [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 10,
                          ),
                        ]
                      : [],
                ),
                child: Center(
                  child: Text(
                    'Informations',
                    style: TextStyle(
                      fontWeight: _selectedTab == 0 ? FontWeight.bold : FontWeight.normal,
                      color: _selectedTab == 0
                          ? const Color(0xFF667eea)
                          : theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedTab = 1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _selectedTab == 1 ? Theme.of(context).colorScheme.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: _selectedTab == 1
                      ? [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 10,
                          ),
                        ]
                      : [],
                ),
                child: Center(
                  child: Text(
                    'Modifier',
                    style: TextStyle(
                      fontWeight: _selectedTab == 1 ? FontWeight.bold : FontWeight.normal,
                      color: _selectedTab == 1
                          ? const Color(0xFF667eea)
                          : theme.colorScheme.onSurfaceVariant,
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
  
  Widget _buildProfileInfo(Profile? profile) {
    final email = _effectiveEmail(profile);
    return Column(
      key: const ValueKey('info'),
      children: [
        _buildInfoCard(
          title: 'Informations personnelles',
          children: [
            _buildInfoRow(FontAwesomeIcons.user, 'Nom complet', '${profile?.firstName ?? ''} ${profile?.lastName ?? ''}'),
            _buildInfoRow(FontAwesomeIcons.envelope, 'Email', email.isEmpty ? 'Non renseigné' : email),
            _buildInfoRow(FontAwesomeIcons.phone, 'Téléphone', profile?.phone ?? 'Non renseigné'),
          ],
        ),
        const SizedBox(height: 16),
        _buildInfoCard(
          title: 'Adresse',
          children: [
            _buildInfoRow(FontAwesomeIcons.locationDot, 'Adresse', profile?.address ?? 'Non renseignée'),
            _buildInfoRow(FontAwesomeIcons.city, 'Ville', profile?.city ?? 'Non renseignée'),
            _buildInfoRow(FontAwesomeIcons.mailBulk, 'Code postal', profile?.postalCode ?? 'Non renseigné'),
          ],
        ),
        if (profile?.bio != null && profile!.bio!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF667eea).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      FontAwesomeIcons.comment,
                      size: 18,
                      color: Color(0xFF667eea),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Bio',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          profile.bio!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
  
  Widget _buildInfoCard({required String title, required List<Widget> children}) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ),
          ...children,
        ],
      ),
    );
  }
  
  Widget _buildInfoRow(IconData icon, String label, String value) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildEditForm(Profile? profile) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      key: const ValueKey('form'),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          _buildFormField(
            controller: _firstNameController,
            label: 'Prénom *',
            icon: FontAwesomeIcons.user,
            required: true,
          ),
          const SizedBox(height: 16),
          _buildFormField(
            controller: _lastNameController,
            label: 'Nom *',
            icon: FontAwesomeIcons.user,
            required: true,
          ),
          const SizedBox(height: 16),
          _buildFormField(
            controller: _emailController,
            label: 'Email',
            icon: FontAwesomeIcons.envelope,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          _buildFormField(
            controller: _phoneController,
            label: 'Téléphone',
            icon: FontAwesomeIcons.phone,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          _buildFormField(
            controller: _addressController,
            label: 'Adresse',
            icon: FontAwesomeIcons.locationDot,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildFormField(
                  controller: _cityController,
                  label: 'Ville',
                  icon: FontAwesomeIcons.city,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildFormField(
                  controller: _postalCodeController,
                  label: 'Code postal',
                  icon: FontAwesomeIcons.mailBulk,
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildFormField(
            controller: _bioController,
            label: 'Bio',
            icon: FontAwesomeIcons.comment,
            maxLines: 3,
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () => setState(() => _selectedTab = 0),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isDark ? theme.colorScheme.surface : Colors.grey[200],
                    foregroundColor: isDark ? theme.colorScheme.onSurface : Colors.grey[700],
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Annuler'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton(
                  onPressed: profile != null ? () => _saveProfile(profile) : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF667eea),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text('Enregistrer'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildFormField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool required = false,
    TextInputType? keyboardType,
    int maxLines = 1,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF667eea), width: 2),
        ),
        filled: true,
        fillColor: isDark ? theme.colorScheme.surface : Colors.grey[50],
      ),
    );
  }
  
  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Actions rapides',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final crossAxisCount = constraints.maxWidth < 360 ? 2 : 3;
            return GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: crossAxisCount,
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              childAspectRatio: 1,
              children: [
                _buildActionCard(
                  icon: FontAwesomeIcons.bagShopping,
                  label: 'Commandes',
                  color: Colors.blue,
                  onTap: () => context.push('/orders'),
                ),
                _buildActionCard(
                  icon: FontAwesomeIcons.heart,
                  label: 'Favoris',
                  color: Colors.red,
                  onTap: () => context.push('/favorites'),
                ),
                _buildActionCard(
                  icon: FontAwesomeIcons.lock,
                  label: 'Mot de passe',
                  color: Colors.orange,
                  onTap: () => context.push('/settings/change-password'),
                ),
                _buildActionCard(
                  icon: FontAwesomeIcons.gear,
                  label: 'Paramètres',
                  color: Colors.grey,
                  onTap: () => context.push('/settings'),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
  
  Widget _buildActionCard({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          color: isDark
              ? theme.colorScheme.surface
              : color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? theme.colorScheme.onSurface : color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
