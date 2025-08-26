import 'package:flutter/material.dart';
import '../localization/app_localizations.dart';

class ProductDetailScreen extends StatelessWidget {
  final String productId;
  
  const ProductDetailScreen({super.key, required this.productId});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('productDetails')),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 200,
              color: Theme.of(context).colorScheme.secondary.withOpacity(0.3),
              child: const Center(
                child: Icon(
                  Icons.image,
                  size: 100,
                  color: Colors.grey,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Product $productId',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '\$${(int.parse(productId) * 10).toStringAsFixed(2)}',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Product description goes here. This is a detailed description of the product features and specifications.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const Spacer(),
            Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.remove),
                  onPressed: () {
                    // TODO: Decrease quantity
                  },
                ),
                const Text('1'),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () {
                    // TODO: Increase quantity
                  },
                ),
                const Spacer(),
                SizedBox(
                  width: 150,
                  child: ElevatedButton(
                    onPressed: () {
                      // TODO: Add to cart functionality
                    },
                    child: Text(localizations.translate('addToCart')),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
