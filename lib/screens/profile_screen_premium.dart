import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import '../models/profile.dart';
import '../services/profile_service.dart';
import '../widgets/bottom_nav_bar.dart';
import 'settings_screen_premium.dart';

class ProfileScreenPremium extends StatefulWidget {
  const ProfileScreenPremium({super.key});

  @override
  State<ProfileScreenPremium> createState() => _ProfileScreenPremiumState();
}

class _ProfileScreenPremiumState extends State<ProfileScreenPremium>
    with TickerProviderStateMixin {
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late AnimationController _rotationController;
  final ImagePicker _picker = ImagePicker();
  late final ProfileService _profileService;
  bool _isEditing = false;
  bool _isUploadingPhoto = false;
  
  // Controllers pour les champs
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _phoneController;
  late TextEditingController _bioController;
  late TextEditingController _addressController;
  late TextEditingController _cityController;
  
  @override
  void initState() {
    super.initState();
    _profileService = ProfileService();
    _loadProfile();
    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _slideController = AnimationController(
      duration: const Duration(milliseconds: 600),
      vsync: this,
    );
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
    _rotationController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    
    _fadeController.forward();
    _slideController.forward();
  }
  
  Future<void> _loadProfile() async {
    setState(() => _isLoadingProfile = true);
    try {
      final profile = await _profileService.getCurrentUserProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _isLoadingProfile = false;
          if (profile != null) {
            _firstNameController.text = profile.firstName ?? '';
            _lastNameController.text = profile.lastName ?? '';
            _phoneController.text = profile.phone ?? '';
            _bioController.text = profile.bio ?? '';
            _addressController.text = profile.address ?? '';
            _cityController.text = profile.city ?? '';
            _postalCodeController.text = profile.postalCode ?? '';
          }
        });
      }
    } catch (e) {
      print('Error loading profile: $e');
      if (mounted) {
        setState(() => _isLoadingProfile = false);
      }
    }
  }
  
  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _rotationController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _postalCodeController.dispose();
    super.dispose();
  }
  
  Future<void> _pickImage() async {
    try {
      setState(() => _isUploadingPhoto = true);
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1000,
        maxHeight: 1000,
        imageQuality: 85,
      );
      
      if (image != null) {
        HapticFeedback.mediumImpact();
        _rotationController.repeat();
        
        final avatarUrl = await _profileService.uploadAvatar(image);
        
        if (avatarUrl != null) {
          // Refresh profile data
          _loadProfile();
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    const Icon(FontAwesomeIcons.circleCheck, color: Colors.white, size: 20),
                    const SizedBox(width: 12),
                    const Text('Photo mise à jour avec succès!'),
                  ],
                ),
                backgroundColor: const Color(0xFF00b894),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            );
          }
        }
      }
    } catch (e) {
      print('Erreur pick image: $e');
    } finally {
      _rotationController.stop();
      _rotationController.reset();
      setState(() => _isUploadingPhoto = false);
    }
  }
  
  Future<void> _saveProfile(Profile profile) async {
    HapticFeedback.lightImpact();
    
    final updatedProfile = profile.copyWith(
      firstName: _firstNameController.text,
      lastName: _lastNameController.text,
      phone: _phoneController.text,
      bio: _bioController.text,
      address: _addressController.text,
      city: _cityController.text,
      postalCode: _postalCodeController.text,
    );
    
    final success = await _profileService.updateProfile(updatedProfile);
    
    if (success && mounted) {
      setState(() => _isEditing = false);
      ref.refresh(profileProvider);
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(FontAwesomeIcons.circleCheck, color: Colors.white, size: 20),
              const SizedBox(width: 12),
              const Text('Profil mis à jour avec succès!'),
            ],
          ),
          backgroundColor: const Color(0xFF00b894),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }
  
  @override
  Widget build(BuildContext context) {
    // Get profile data from state
    final profile = _profile;
    final isLoading = _isLoadingProfile;

    
    if (isLoading) {
      return _buildLoadingState();
    }
    
    if (profile == null) {
      return _buildErrorState();
    }
    
    return Scaffold(
      body: Stack(
        children: [
            _lastNameController.text = profile.lastName ?? '';
            _phoneController.text = profile.phone ?? '';
            _bioController.text = profile.bio ?? '';
            _addressController.text = profile.address ?? '';
            _cityController.text = profile.city ?? '';
            _postalCodeController.text = profile.postalCode ?? '';
          }
          
          return Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      const Color(0xFF667eea).withOpacity(0.1),
                      const Color(0xFF764ba2).withOpacity(0.1),
                    ],
                  ),
                ),
              ),
              
              CustomScrollView(
                slivers: [
                  SliverAppBar(
                    expandedHeight: 280,
                    pinned: true,
                    backgroundColor: Colors.transparent,
                    flexibleSpace: _buildHeader(profile),
                  ),
                  
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          _buildStatsSection(statsAsync),
                          const SizedBox(height: 24),
                          _buildProfileInfoSection(profile),
                          const SizedBox(height: 24),
                          _buildQuickActions(),
                          const SizedBox(height: 24),
                          _buildMenuItems(),
                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: const BottomNavBar(currentIndex: 4),
    );
  }
  
  Widget _buildHeader(Profile? profile) {
    return FlexibleSpaceBar(
      background: Stack(
        children: [
          Container(
            height: 200,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF667eea),
                  const Color(0xFF764ba2),
                  const Color(0xFFf093fb),
                ],
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -50,
                  top: -50,
                  child: Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          Positioned(
            bottom: 20,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    AnimatedBuilder(
                      animation: _rotationController,
                      builder: (context, child) {
                        return Transform.rotate(
                          angle: _rotationController.value * 2 * 3.14159,
                          child: Container(
                            width: 130,
                            height: 130,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const LinearGradient(
                                colors: [Color(0xFF667eea), Color(0xFFf093fb), Color(0xFF764ba2)],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                    
                    GestureDetector(
                      onTap: _pickImage,
                      child: Stack(
                        children: [
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 4),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.2),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: profile?.avatarUrl != null && profile!.avatarUrl!.isNotEmpty
                                  ? Image.network(
                                      profile!.avatarUrl!,
                                      fit: BoxFit.cover,
                                      width: 120,
                                      height: 120,
                                      loadingBuilder: (context, child, progress) {
                                        if (progress == null) return child;
                                        return Container(
                                          color: Colors.grey.shade200,
                                          child: const Center(
                                            child: CircularProgressIndicator(color: Color(0xFF667eea)),
                                          ),
                                        );
                                      },
                                      errorBuilder: (context, error, stackTrace) {
                                        print('❌ Erreur chargement avatar: $error');
                                        print('📸 URL tentée: ${profile.avatarUrl}');
                                        return Container(
                                          decoration: const BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                                            ),
                                          ),
                                          child: const Icon(FontAwesomeIcons.user, size: 50, color: Colors.white),
                                        );
                                      },
                                    )
                                  : Container(
                                      decoration: const BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                                        ),
                                      ),
                                      child: const Icon(FontAwesomeIcons.user, size: 50, color: Colors.white),
                                    ),
                            ),
                          ),
                          
                          if (!_isUploadingPhoto)
                            Positioned(
                              bottom: 5,
                              right: 5,
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF667eea),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 2),
                                ),
                                child: const Icon(FontAwesomeIcons.camera, size: 14, color: Colors.white),
                              ),
                            ),
                          
                          if (_isUploadingPhoto)
                            Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.black.withOpacity(0.5),
                              ),
                              child: const Center(
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                FadeTransition(
                  opacity: _fadeController,
                  child: Column(
                    children: [
                      Text(
                        '${profile?.firstName ?? ''} ${profile?.lastName ?? ''}'.trim().isEmpty
                            ? 'Mon Profil'
                            : '${profile?.firstName ?? ''} ${profile?.lastName ?? ''}'.trim(),
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        profile?.email ?? '',
                        style: TextStyle(fontSize: 14, color: Colors.white.withOpacity(0.9)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          Positioned(
            top: 50,
            right: 20,
            child: GestureDetector(
              onTap: () {
                HapticFeedback.lightImpact();
                setState(() => _isEditing = !_isEditing);
                if (_isEditing) {
                  _scaleController.forward();
                } else {
                  _scaleController.reverse();
                  if (profile != null) _saveProfile(profile);
                }
              },
              child: AnimatedBuilder(
                animation: _scaleController,
                builder: (context, child) {
                  return Transform.scale(
                    scale: 1.0 + (_scaleController.value * 0.1),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: _isEditing
                                  ? [const Color(0xFF00b894).withOpacity(0.3), const Color(0xFF00cec9).withOpacity(0.3)]
                                  : [Colors.white.withOpacity(0.2), Colors.white.withOpacity(0.1)],
                            ),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white.withOpacity(0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _isEditing ? FontAwesomeIcons.check : FontAwesomeIcons.penToSquare,
                                size: 16,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _isEditing ? 'Valider' : 'Éditer',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildStatsSection(AsyncValue<Map<String, dynamic>> statsAsync) {
    return statsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const SizedBox.shrink(),
      data: (stats) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.5),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: _slideController,
            curve: Curves.easeOutBack,
          )),
          child: Row(
            children: [
              _buildStatCard(
                icon: FontAwesomeIcons.boxOpen,
                label: 'Commandes',
                value: '${stats['orders'] ?? 0}',
                gradient: [const Color(0xFF667eea), const Color(0xFF764ba2)],
              ),
              const SizedBox(width: 12),
              Consumer(
                builder: (context, ref, child) {
                  final favorites = ref.watch(favoritesProvider);
                  return _buildStatCard(
                    icon: FontAwesomeIcons.heart,
                    label: 'Favoris',
                    value: '${favorites.length}',
                    gradient: [const Color(0xFFe74c3c), const Color(0xFFc0392b)],
                  );
                },
              ),
              const SizedBox(width: 12),
              _buildStatCard(
                icon: FontAwesomeIcons.star,
                label: 'Points',
                value: '${ref.watch(profileProvider).value?.loyaltyPoints ?? 0}',
                gradient: [const Color(0xFFf39c12), const Color(0xFFe67e22)],
              ),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required List<Color> gradient,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradient,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: gradient[0].withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 24),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12)),
          ],
        ),
      ),
    );
  }
  
  Widget _buildProfileInfoSection(Profile? profile) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF667eea).withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(FontAwesomeIcons.circleInfo, size: 20, color: Color(0xFF667eea)),
              const SizedBox(width: 12),
              const Text('Informations personnelles', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 20),
          
          _buildTextField(controller: _firstNameController, label: 'Prénom', icon: FontAwesomeIcons.user, enabled: _isEditing),
          const SizedBox(height: 16),
          _buildTextField(controller: _lastNameController, label: 'Nom', icon: FontAwesomeIcons.user, enabled: _isEditing),
          const SizedBox(height: 16),
          _buildTextField(controller: _phoneController, label: 'Téléphone', icon: FontAwesomeIcons.phone, enabled: _isEditing, keyboardType: TextInputType.phone),
          const SizedBox(height: 16),
          _buildTextField(controller: _bioController, label: 'Bio', icon: FontAwesomeIcons.penToSquare, enabled: _isEditing, maxLines: 3),
          const SizedBox(height: 16),
          _buildTextField(controller: _addressController, label: 'Adresse', icon: FontAwesomeIcons.locationDot, enabled: _isEditing),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildTextField(controller: _cityController, label: 'Ville', icon: FontAwesomeIcons.city, enabled: _isEditing),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildTextField(controller: _postalCodeController, label: 'Code postal', icon: FontAwesomeIcons.mailBulk, enabled: _isEditing, keyboardType: TextInputType.number),
              ),
            ],
          ),
        ],
      ),
    );
  }
  
  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool enabled = true,
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: enabled ? Colors.grey.shade50 : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: enabled ? const Color(0xFF667eea).withOpacity(0.3) : Colors.grey.shade300,
          width: enabled ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: enabled ? const Color(0xFF667eea) : Colors.grey),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              maxLines: maxLines,
              keyboardType: keyboardType,
              style: TextStyle(color: enabled ? Colors.black : Colors.grey.shade600),
              decoration: InputDecoration(
                labelText: label,
                labelStyle: TextStyle(color: enabled ? const Color(0xFF667eea) : Colors.grey, fontSize: 14),
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildQuickActions() {
    return Row(
      children: [
        _buildActionCard(icon: FontAwesomeIcons.moon, label: 'Mode sombre', onTap: () => HapticFeedback.lightImpact()),
        const SizedBox(width: 12),
        _buildActionCard(icon: FontAwesomeIcons.language, label: 'Langue', onTap: () {
          HapticFeedback.lightImpact();
          context.go('/language');
        }),
        const SizedBox(width: 12),
        _buildActionCard(icon: FontAwesomeIcons.bell, label: 'Notif.', onTap: () => HapticFeedback.lightImpact()),
      ],
    );
  }
  
  Widget _buildActionCard({required IconData icon, required String label, required VoidCallback onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 5))],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [
                    const Color(0xFF667eea).withOpacity(0.1),
                    const Color(0xFF764ba2).withOpacity(0.1),
                  ]),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 20, color: const Color(0xFF667eea)),
              ),
              const SizedBox(height: 8),
              Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildMenuItems() {
    final menuItems = [
      {'icon': FontAwesomeIcons.clockRotateLeft, 'title': 'Historique', 'color': const Color(0xFF667eea)},
      {'icon': FontAwesomeIcons.locationDot, 'title': 'Adresses', 'color': const Color(0xFF00b894)},
      {'icon': FontAwesomeIcons.creditCard, 'title': 'Paiements', 'color': const Color(0xFF6c5ce7)},
      {'icon': FontAwesomeIcons.gear, 'title': 'Paramètres', 'color': const Color(0xFF95afc0)},
      {'icon': FontAwesomeIcons.questionCircle, 'title': 'Aide', 'color': const Color(0xFFfdcb6e)},
      {'icon': FontAwesomeIcons.rightFromBracket, 'title': 'Déconnexion', 'color': const Color(0xFFe74c3c)},
    ];
    
    return Column(
      children: menuItems.map((item) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                if (item['title'] == 'Déconnexion') {
                  // Sign out logic
                  ref.read(authProvider.notifier).signOut();
                  context.go('/login');
                } else if (item['title'] == 'Paramètres') {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const SettingsScreenPremium(),
                    ),
                  );
                }
              },
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 5))],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: (item['color'] as Color).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(item['icon'] as IconData, size: 20, color: item['color'] as Color),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(item['title'] as String, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                    ),
                    Icon(FontAwesomeIcons.chevronRight, size: 14, color: Colors.grey.shade400),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
  
  Widget _buildLoadingState() {
    return const Center(child: CircularProgressIndicator(color: Color(0xFF667eea)));
  }
  
  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(FontAwesomeIcons.triangleExclamation, size: 48, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          const Text('Erreur de chargement', style: TextStyle(fontSize: 18)),
        ],
      ),
    );
  }
}
