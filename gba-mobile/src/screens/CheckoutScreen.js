import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useCart } from '../contexts/CartContext';
import Toast from 'react-native-toast-message';

export default function CheckoutScreen({ navigation }) {
  const { cartItems, cartTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
  });

  const paymentMethods = [
    { id: 'card', name: 'Carte Bancaire', icon: 'credit-card' },
    { id: 'mobile', name: 'Mobile Money', icon: 'phone-android' },
    { id: 'cash', name: 'Paiement à la livraison', icon: 'money' },
  ];

  const handlePlaceOrder = async () => {
    setLoading(true);
    // Simulate order placement
    setTimeout(() => {
      setLoading(false);
      clearCart();
      Toast.show({
        type: 'success',
        text1: 'Commande confirmée!',
        text2: 'Votre commande a été passée avec succès'
      });
      navigation.navigate('Orders');
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Icon name="person" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nom complet"
                placeholderTextColor="#999"
                value={formData.fullName}
                onChangeText={(text) => setFormData({...formData, fullName: text})}
              />
            </View>
            <View style={styles.inputGroup}>
              <Icon name="phone" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(text) => setFormData({...formData, phone: text})}
              />
            </View>
            <View style={styles.inputGroup}>
              <Icon name="location-on" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Adresse complète"
                placeholderTextColor="#999"
                value={formData.address}
                onChangeText={(text) => setFormData({...formData, address: text})}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                <Icon name="location-city" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ville"
                  placeholderTextColor="#999"
                  value={formData.city}
                  onChangeText={(text) => setFormData({...formData, city: text})}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 0.5 }]}>
                <TextInput
                  style={[styles.input, { paddingLeft: 10 }]}
                  placeholder="Code postal"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.postalCode}
                  onChangeText={(text) => setFormData({...formData, postalCode: text})}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Méthode de paiement</Text>
          <View style={styles.paymentMethods}>
            {paymentMethods.map(method => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethod,
                  selectedPayment === method.id && styles.paymentMethodActive
                ]}
                onPress={() => setSelectedPayment(method.id)}
              >
                <Icon 
                  name={method.icon} 
                  size={24} 
                  color={selectedPayment === method.id ? '#667eea' : '#999'} 
                />
                <Text style={[
                  styles.paymentMethodText,
                  selectedPayment === method.id && styles.paymentMethodTextActive
                ]}>
                  {method.name}
                </Text>
                <View style={[
                  styles.radioButton,
                  selectedPayment === method.id && styles.radioButtonActive
                ]}>
                  {selectedPayment === method.id && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {selectedPayment === 'card' && (
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Icon name="credit-card" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro de carte"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.cardNumber}
                  onChangeText={(text) => setFormData({...formData, cardNumber: text})}
                />
              </View>
              <View style={styles.inputGroup}>
                <Icon name="person" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nom sur la carte"
                  placeholderTextColor="#999"
                  value={formData.cardHolder}
                  onChangeText={(text) => setFormData({...formData, cardHolder: text})}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Icon name="date-range" size={20} color="#667eea" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={formData.expiryDate}
                    onChangeText={(text) => setFormData({...formData, expiryDate: text})}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 0.5 }]}>
                  <Icon name="lock" size={20} color="#667eea" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="CVV"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    secureTextEntry
                    value={formData.cvv}
                    onChangeText={(text) => setFormData({...formData, cvv: text})}
                  />
                </View>
              </View>
            </View>
          )}

          {selectedPayment === 'mobile' && (
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Icon name="phone-android" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Numéro Mobile Money"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé de la commande</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Articles ({cartItems.length})</Text>
              <Text style={styles.summaryValue}>{cartTotal.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Livraison</Text>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>Gratuite</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Taxes</Text>
              <Text style={styles.summaryValue}>0 FCFA</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{cartTotal.toLocaleString()} FCFA</Text>
            </View>
          </View>
        </View>

        {/* Place Order Button */}
        <TouchableOpacity 
          style={styles.placeOrderButton}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name="check-circle" size={20} color="#fff" />
                <Text style={styles.placeOrderText}>Confirmer la commande</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 15,
    paddingBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
  },
  paymentMethods: {
    marginBottom: 15,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  paymentMethodActive: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  paymentMethodText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  paymentMethodTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: '#667eea',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#667eea',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    marginTop: 5,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  placeOrderButton: {
    marginHorizontal: 15,
    marginVertical: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
