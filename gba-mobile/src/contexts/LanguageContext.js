import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';
import { I18nManager } from 'react-native';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('fr');
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage) {
        setLanguage(savedLanguage);
        setIsRTL(savedLanguage === 'ar');
        
        // Configure RTL for Arabic
        if (savedLanguage === 'ar' && !I18nManager.isRTL) {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(true);
          // Restart app to apply RTL changes
          // App restart needed to apply RTL changes
          // RNRestart.Restart();
        } else if (savedLanguage !== 'ar' && I18nManager.isRTL) {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
          // App restart needed to apply RTL changes
          // RNRestart.Restart();
        }
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const changeLanguage = async (newLanguage) => {
    try {
      await AsyncStorage.setItem('app_language', newLanguage);
      const needsRestart = (newLanguage === 'ar' && !isRTL) || (newLanguage !== 'ar' && isRTL);
      
      setLanguage(newLanguage);
      setIsRTL(newLanguage === 'ar');
      
      if (needsRestart) {
        // Configure RTL
        if (newLanguage === 'ar') {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(true);
        } else {
          I18nManager.allowRTL(false);
          I18nManager.forceRTL(false);
        }
        
        // Restart app to apply RTL changes
        // App restart needed to apply RTL changes
        // RNRestart.Restart();
      }
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        // Fallback to French if key not found
        value = translations.fr;
        for (const k2 of keys) {
          if (value && typeof value === 'object') {
            value = value[k2];
          } else {
            return key; // Return key if translation not found
          }
        }
        return value;
      }
    }
    
    return value || key;
  };

  const value = {
    language,
    setLanguage: changeLanguage,
    t,
    isRTL,
    translations: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
