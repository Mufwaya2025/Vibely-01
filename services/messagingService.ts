import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;
let connectionCount = 0;
const noop = () => {};

const normalizeBaseUrl = (raw: string): string | undefined => {
  if (!raw) return undefined;

  const trimmed = raw.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return trimmed.replace(/\/$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location) {
    try {
      return new URL(trimmed, window.location.origin).origin;
    } catch {
      // fall through
    }
  }

  return undefined;
};

const resolveSocketBaseUrl = (): string | undefined => {
  const env = (import.meta as any).env ?? {};
  const explicitBase = normalizeBaseUrl((env.VITE_SOCKET_BASE_URL ?? '').toString());
  if (explicitBase) return explicitBase;

  const apiBase = normalizeBaseUrl((env.VITE_API_BASE_URL ?? '').toString());
  if (apiBase) return apiBase;

  return typeof window !== 'undefined' ? window.location.origin : undefined;
};

export interface MessageData {
  receiverId: string;
  content: string;
  senderId: string;
  senderName: string;
}

export const connectToMessaging = (userId: string): Promise<Socket> => {
  connectionCount = Math.max(connectionCount, 0) + 1;

  if (socket && socket.connected) {
    return Promise.resolve(socket);
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = new Promise((resolve, reject) => {
    const env = (import.meta as any).env ?? {};
    const socketPath = env.VITE_SOCKET_PATH ?? '/socket.io';
    const baseUrl = resolveSocketBaseUrl();

    const options = {
      path: socketPath,
      auth: {
        userId,
      },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    } as const;

    socket = baseUrl ? io(baseUrl, options) : io(options);

    socket.on('connect', () => {
      console.log('Connected to messaging server');
      socket!.emit('join-room', userId);
      connectPromise = null;
      resolve(socket!);
    });

    socket.on('disconnect', () => {
      socket = null;
      connectPromise = null;
      connectionCount = 0;
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      connectionCount = Math.max(0, connectionCount - 1);
      connectPromise = null;
      reject(error);
    });
  });

  return connectPromise;
};

export const sendMessage = (messageData: MessageData) => {
  if (socket && socket.connected) {
    socket.emit('send-message', messageData);
  } else {
    console.error('Socket not connected');
  }
};

export const onMessageReceived = (callback: (message: Message) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('receive-message', callback);
  return () => {
    socket?.off('receive-message', callback);
  };
};

export const onMessageSent = (callback: (message: Message) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('message-sent', callback);
  return () => {
    socket?.off('message-sent', callback);
  };
};

export const onMessageRead = (callback: (messageId: string) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('message-read', callback);
  return () => {
    socket?.off('message-read', callback);
  };
};

export const onUserOnline = (callback: (userId: string) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('user-online', callback);
  return () => {
    socket?.off('user-online', callback);
  };
};

export const onUserOffline = (callback: (userId: string) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('user-offline', callback);
  return () => {
    socket?.off('user-offline', callback);
  };
};

// Request the current online status of a specific user
export const requestUserStatus = (userId: string) => {
  if (socket && socket.connected) {
    socket.emit('request-user-status', userId);
  }
};

// Listen for user status responses
export const onUserStatusResponse = (callback: (data: { userId: string; isOnline: boolean }) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('user-status-response', callback);
  return () => {
    socket?.off('user-status-response', callback);
  };
};

export const fetchConversation = (participantId: string) => {
  if (socket && socket.connected) {
    socket.emit('fetch-conversation', participantId);
  }
};

export const onConversationHistory = (
  callback: (payload: { userId: string; messages: Message[] }) => void
): (() => void) => {
  if (!socket) return noop;
  socket.on('conversation-history', callback);
  return () => {
    socket?.off('conversation-history', callback);
  };
};

export const markMessageAsRead = (messageId: string) => {
  if (socket && socket.connected) {
    socket.emit('mark-as-read', messageId);
  }
};

export const disconnectFromMessaging = () => {
  if (connectionCount > 0) {
    connectionCount -= 1;
  }

  if (connectionCount === 0 && socket) {
    socket.disconnect();
    socket = null;
    connectPromise = null;
  }
};

export const getSocket = () => socket;
