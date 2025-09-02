import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageSelector from '../components/LanguageSelector';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 1, title: t('myAccount'), icon: 'person', onPress: () => {} },
    { id: 2, title: t('myOrders'), icon: 'shopping-bag', onPress: () => navigation.navigate('Orders') },
    { id: 3, title: t('shippingAddresses'), icon: 'location-on', onPress: () => {} },
    { id: 4, title: t('paymentMethods'), icon: 'credit-card', onPress: () => {} },
    { id: 5, title: t('myWishlist'), icon: 'favorite', onPress: () => {} },
    { id: 6, title: t('notifications'), icon: 'notifications', onPress: () => {} },
    { id: 7, title: t('support'), icon: 'chat', onPress: () => navigation.navigate('Chat') },
    { id: 8, title: t('settings'), icon: 'settings', onPress: () => {} },
    { id: 9, title: t('about'), icon: 'info', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <Image 
            source={{ uri: user?.avatar_url || 'https://via.placeholder.com/100' }} 
            style={styles.avatar}
          />
          <Text style={styles.name}>{user?.name || t('user')}</Text>
          <Text style={styles.email}>{user?.email || 'email@example.com'}</Text>
          <View style={styles.languageSelectorContainer}>
            <LanguageSelector />
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index === menuItems.length - 1 && styles.lastMenuItem
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconContainer, { backgroundColor: `${getIconColor(item.icon)}20` }]}>
                  <Icon name={item.icon} size={22} color={getIconColor(item.icon)} />
                </View>
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <LinearGradient
            colors={['#ff4444', '#ff6666']}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="logout" size={20} color="#fff" />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function getIconColor(iconName) {
  const colors = {
    'person': '#667eea',
    'shopping-bag': '#4ECDC4',
    'location-on': '#FF6B6B',
    'credit-card': '#FFD93D',
    'favorite': '#FF8CC3',
    'notifications': '#95E77E',
    'chat': '#9B59B6',
    'settings': '#778899',
    'info': '#87CEEB',
  };
  return colors[iconName] || '#667eea';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 30,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  languageSelectorContainer: {
    marginTop: 15,
  },
  profileContainer: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 20,
    paddingVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginVertical: 20,
  },
});
