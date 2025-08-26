import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

class AppLocalizations {
  AppLocalizations(this.locale);

  final Locale locale;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate = _AppLocalizationsDelegate();

  // Translations for English
  Map<String, String> _englishTranslations = {
    'appName': 'E-commerce Client',
    'home': 'Home',
    'categories': 'Categories',
    'cart': 'Cart',
    'orders': 'Orders',
    'profile': 'Profile',
    'specialOrder': 'Special Order',
    'messaging': 'Messaging',
    'settings': 'Settings',
    'language': 'Language',
    'helpSupport': 'Help & Support',
    'login': 'Login',
    'register': 'Register',
    'email': 'Email',
    'password': 'Password',
    'forgotPassword': 'Forgot Password?',
    'search': 'Search',
    'popularProducts': 'Popular Products',
    'addToCart': 'Add to Cart',
    'checkout': 'Checkout',
    'total': 'Total',
    'confirmOrder': 'Confirm Order',
    'orderHistory': 'Order History',
    'trackOrder': 'Track Order',
    'uploadImage': 'Upload Image',
    'productName': 'Product Name',
    'quantity': 'Quantity',
    'description': 'Description',
    'send': 'Send',
    'message': 'Message',
  };

  // Translations for French
  Map<String, String> _frenchTranslations = {
    'appName': 'GBA',
    'home': 'Accueil',
    'categories': 'Catégories',
    'cart': 'Panier',
    'orders': 'Commandes',
    'profile': 'Profil',
    'specialOrder': 'Commande Spéciale',
    'messaging': 'Messagerie',
    'settings': 'Paramètres',
    'language': 'Langue',
    'helpSupport': 'Aide et Support',
    'login': 'Connexion',
    'register': 'Inscription',
    'email': 'Email',
    'password': 'Mot de passe',
    'forgotPassword': 'Mot de passe oublié?',
    'search': 'Recherche',
    'popularProducts': 'Produits Populaires',
    'addToCart': 'Ajouter au Panier',
    'checkout': 'Validation',
    'total': 'Total',
    'confirmOrder': 'Confirmer la Commande',
    'orderHistory': 'Historique des Commandes',
    'trackOrder': 'Suivre la Commande',
    'uploadImage': 'Télécharger une Image',
    'productName': 'Nom du Produit',
    'quantity': 'Quantité',
    'description': 'Description',
    'send': 'Envoyer',
    'message': 'Message',
  };

  // Translations for Arabic
  Map<String, String> _arabicTranslations = {
    'appName': 'عميل التجارة الإلكترونية',
    'home': 'الرئيسية',
    'categories': 'الفئات',
    'cart': 'السلة',
    'orders': 'الطلبات',
    'profile': 'الملف الشخصي',
    'specialOrder': 'طلب خاص',
    'messaging': 'المراسلة',
    'settings': 'الإعدادات',
    'language': 'اللغة',
    'helpSupport': 'المساعدة والدعم',
    'login': 'تسجيل الدخول',
    'register': 'تسجيل',
    'email': 'البريد الإلكتروني',
    'password': 'كلمة المرور',
    'forgotPassword': 'هل نسيت كلمة المرور؟',
    'search': 'بحث',
    'popularProducts': 'المنتجات الشائعة',
    'addToCart': 'أضف إلى السلة',
    'checkout': 'التحقق من',
    'total': 'المجموع',
    'confirmOrder': 'تأكيد الطلب',
    'orderHistory': 'سجل الطلبات',
    'trackOrder': 'تتبع الطلب',
    'uploadImage': 'تحميل صورة',
    'productName': 'اسم المنتج',
    'quantity': 'الكمية',
    'description': 'الوصف',
    'send': 'إرسال',
    'message': 'رسالة',
  };

  String translate(String key) {
    switch (locale.languageCode) {
      case 'en':
        return _englishTranslations[key] ?? key;
      case 'fr':
        return _frenchTranslations[key] ?? key;
      case 'ar':
        return _arabicTranslations[key] ?? key;
      default:
        return _englishTranslations[key] ?? key;
    }
  }
}

class _AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return ['en', 'fr', 'ar'].contains(locale.languageCode);
  }

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(AppLocalizations(locale));
  }

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}
