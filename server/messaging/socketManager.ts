import type { Server, Socket } from 'socket.io';
import { messageStore } from './messageStore';

interface PendingMessagePayload {
  receiverId: string;
  content: string;
  senderName?: string;
}

const onlineUsers = new Map<string, Set<string>>();

const registerConnection = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId) ?? new Set<string>();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
};

const unregisterConnection = (userId: string, socketId: string) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
  }
};

const isUserOnline = (userId: string): boolean => onlineUsers.has(userId);

const normalizeContent = (content: string): string => content.trim().slice(0, 2000);

const sanitizePayload = (socket: Socket, payload: PendingMessagePayload | undefined) => {
  if (!payload || typeof payload.receiverId !== 'string' || typeof payload.content !== 'string') {
    socket.emit('message-error', 'Invalid message payload.');
    return null;
  }
  if (!payload.receiverId.trim()) {
    socket.emit('message-error', 'Receiver id is required.');
    return null;
  }
  if (!payload.content.trim()) {
    socket.emit('message-error', 'Message cannot be empty.');
    return null;
  }
  return {
    receiverId: payload.receiverId.trim(),
    content: normalizeContent(payload.content),
    senderName: payload.senderName?.trim() || 'Vibely User',
  };
};

export const registerMessagingHandlers = (io: Server): void => {
  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    if (typeof userId === 'string' && userId.length > 0) {
      return next();
    }
    next(new Error('Authentication error'));
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId as string;
    registerConnection(userId, socket.id);
    socket.join(userId);
    socket.broadcast.emit('user-online', userId);

    socket.on('send-message', (payload: PendingMessagePayload) => {
      const sanitized = sanitizePayload(socket, payload);
      if (!sanitized) return;

      const record = messageStore.addMessage({
        senderId: userId,
        senderName: sanitized.senderName,
        receiverId: sanitized.receiverId,
        content: sanitized.content,
      });

      socket.emit('message-sent', record);
      io.to(record.receiverId).emit('receive-message', record);
    });

    socket.on('request-user-status', (targetUserId: string) => {
      socket.emit('user-status-response', {
        userId: targetUserId,
        isOnline: isUserOnline(targetUserId),
      });
    });

    socket.on('fetch-conversation', (targetUserId: string) => {
      if (typeof targetUserId !== 'string' || !targetUserId.trim()) return;
      const sanitizedTarget = targetUserId.trim();
      const history = messageStore.getConversation(userId, sanitizedTarget);
      socket.emit('conversation-history', {
        userId: sanitizedTarget,
        messages: history,
      });
    });

    socket.on('mark-as-read', (messageId: string) => {
      if (typeof messageId !== 'string' || !messageId.trim()) return;
      const updated = messageStore.markAsRead(messageId, userId);
      if (updated) {
        io.to(updated.senderId).emit('message-read', messageId);
      }
    });

    socket.on('disconnect', () => {
      unregisterConnection(userId, socket.id);
      if (!isUserOnline(userId)) {
        socket.broadcast.emit('user-offline', userId);
      }
    });
  });
};
