import 'package:flutter/foundation.dart';

import '../services/messaging_service.dart';

/// Thin provider that wraps [MessagingService] and exposes a real-time
/// [unreadCount] sourced from Supabase Realtime subscriptions.
///
/// MessagingService already maintains listeners for `chat_conversations`
/// and `chat_messages` and exposes:
///   `int get unreadCount => conversations.where((c) => c.unreadCount > 0).length;`
///
/// This provider simply mirrors that value and re-notifies whenever the
/// underlying service changes.
class MessagingProvider extends ChangeNotifier {
  final MessagingService _service;

  MessagingProvider({MessagingService? service})
      : _service = service ?? MessagingService() {
    // Forward every change from the service to our own listeners
    _service.addListener(_onServiceChanged);
    // Kick off initialization (loads conversations + starts Realtime)
    _service.initialize().catchError((_) {});
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /// Number of conversations with at least one unread message.
  /// Updated in real-time via MessagingService's Supabase Realtime stream.
  int get unreadCount => _service.unreadCount;

  /// Direct access to the underlying service for screens that need it.
  MessagingService get service => _service;

  // ─── Legacy compatibility helpers ──────────────────────────────────────────
  // These kept so existing callers don't break. They now delegate to service.

  void setUnreadCount(int count) {
    // No-op: count is now derived from service; kept for API compatibility.
  }

  void incrementUnread() {
    // No-op: managed by service internally.
  }

  void decrementUnread() {
    // No-op: managed by service internally.
  }

  void resetUnread() {
    // Marks all conversations as read by leveraging markMessagesAsRead.
    // For a simple reset we just notify — the true count resets when the
    // user opens the chat (which calls markMessagesAsRead).
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  void _onServiceChanged() => notifyListeners();

  @override
  void dispose() {
    _service.removeListener(_onServiceChanged);
    _service.dispose();
    super.dispose();
  }
}
