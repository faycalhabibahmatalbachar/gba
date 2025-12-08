import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/cart_provider_simple.dart';

class HomeScreenPremium extends StatefulWidget {
  const HomeScreenPremium({super.key});

  @override
  State<HomeScreenPremium> createState() => _HomeScreenPremiumState();
}

class _HomeScreenPremiumState extends State<HomeScreenPremium> {
  @override
  Widget build(BuildContext context) {
    final cartProvider = Provider.of<CartProvider>(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('GBA Store'),
        backgroundColor: Colors.deepPurple,
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart),
                onPressed: () {},
              ),
              if (cartProvider.itemCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '${cartProvider.itemCount}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.store,
              size: 100,
              color: Colors.deepPurple,
            ),
            const SizedBox(height: 20),
            const Text(
              'Bienvenue sur GBA Store',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Votre boutique en ligne',
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.deepPurple,
                padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 15),
              ),
              child: const Text(
                'Commencer',
                style: TextStyle(fontSize: 16, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: Colors.deepPurple,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Accueil',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.category),
            label: 'Catégories',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite),
            label: 'Favoris',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
