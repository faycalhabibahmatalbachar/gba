import 'package:flutter/material.dart';
import '../localization/app_localizations.dart';
import 'chat_detail_screen.dart';

class MessagingScreen extends StatefulWidget {
  const MessagingScreen({super.key});

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final List<Map<String, dynamic>> _conversations = [
    {
      'id': 1,
      'name': 'Admin Support',
      'lastMessage': 'Your order is being processed',
      'time': '10:30 AM',
      'unread': true,
    },
    {
      'id': 2,
      'name': 'Special Order Team',
      'lastMessage': 'We received your special order request',
      'time': 'Yesterday',
      'unread': false,
    },
  ];

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('messaging')),
      ),
      body: ListView.builder(
        itemCount: _conversations.length,
        itemBuilder: (context, index) {
          final conversation = _conversations[index];
          
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primary,
              child: Text(
                conversation['name'][0],
                style: const TextStyle(color: Colors.white),
              ),
            ),
            title: Text(conversation['name']),
            subtitle: Text(conversation['lastMessage']),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  conversation['time'],
                  style: const TextStyle(fontSize: 12),
                ),
                if (conversation['unread'])
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ChatDetailScreen(
                    conversationId: conversation['id'].toString(),
                    conversationName: conversation['name'],
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Create new conversation
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
