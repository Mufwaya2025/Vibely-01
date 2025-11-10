import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

let socket: Socket | null = null;
const noop = () => {};

const resolveSocketBaseUrl = (): string | undefined => {
  const env = (import.meta as any).env ?? {};
  const configuredBase = (env.VITE_SOCKET_BASE_URL ?? env.VITE_API_BASE_URL ?? '').toString().trim();

  if (configuredBase.length > 0) {
    if (configuredBase.startsWith('http')) {
      return configuredBase.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin.replace(/\/$/, '');
      const normalizedPath = configuredBase.startsWith('/') ? configuredBase : `/${configuredBase}`;
      return `${origin}${normalizedPath}`.replace(/\/$/, '');
    }
  }

  return typeof window !== 'undefined' ? window.location.origin : undefined;
};

export interface MessageData {
  receiverId: string;
  content: string;
  senderId: string;
  senderName: string;
}

export const connectToMessaging = (userId: string): Promise<Socket> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      resolve(socket);
      return;
    }

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
      resolve(socket!);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      reject(error);
    });
  });
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
export const onUserStatusResponse = (callback: (data: { userId: string, isOnline: boolean }) => void): (() => void) => {
  if (!socket) return noop;
  socket.on('user-status-response', callback);
  return () => {
    socket?.off('user-status-response', callback);
  };
};

export const markMessageAsRead = (messageId: string) => {
  if (socket && socket.connected) {
    socket.emit('mark-as-read', messageId);
  }
};

export const disconnectFromMessaging = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
