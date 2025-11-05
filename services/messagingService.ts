import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

let socket: Socket | null = null;

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

    socket = io(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'}`, {
      auth: {
        userId
      }
    });

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

export const onMessageReceived = (callback: (message: Message) => void) => {
  if (socket) {
    socket.on('receive-message', callback);
  }
};

export const onMessageSent = (callback: (message: Message) => void) => {
  if (socket) {
    socket.on('message-sent', callback);
  }
};

export const onMessageRead = (callback: (messageId: string) => void) => {
  if (socket) {
    socket.on('message-read', callback);
  }
};

export const onUserOnline = (callback: (userId: string) => void) => {
  if (socket) {
    socket.on('user-online', callback);
  }
};

export const onUserOffline = (callback: (userId: string) => void) => {
  if (socket) {
    socket.on('user-offline', callback);
  }
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