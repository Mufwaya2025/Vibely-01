import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

// For serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const port = parseInt(process.env.PORT ?? '4000', 10);
const clientOrigin = process.env.CLIENT_ORIGIN ?? '*';
const jsonLimit = process.env.JSON_BODY_LIMIT ?? '1mb';

const allowedOrigins = clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins.length === 0 || allowedOrigins.includes('*')
        ? true
        : allowedOrigins,
  })
);
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the dist directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../dist')));
}

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// In-memory storage for demo purposes
// In production, this should be replaced with a database
interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: string; // ISO date string
  read: boolean;
}

interface UserSession {
  userId: string;
  socketId: string;
}

// In-memory stores for demo purposes
const messages: Message[] = [];
const userSessions: UserSession[] = [];

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;
  if (userId) {
    // Add user session
    userSessions.push({ userId, socketId: socket.id });
    next();
  } else {
    next(new Error("Authentication error"));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on('join-room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room: ${userId}`);
    
    // Notify other clients that user is online
    socket.broadcast.emit('user-online', userId);
  });

  socket.on('send-message', (messageData) => {
    const { receiverId, content, senderId, senderName } = messageData;
    
    // Create new message
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      senderId,
      senderName,
      receiverId,
      content,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    messages.push(newMessage);
    
    // Send message to receiver
    const receiverSession = userSessions.find(session => session.userId === receiverId);
    if (receiverSession) {
      io.to(receiverSession.socketId).emit('receive-message', newMessage);
    }
    
    // Also send to sender to confirm
    socket.emit('message-sent', newMessage);
  });

  socket.on('mark-as-read', (messageId) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      message.read = true;
      // Notify sender that message was read
      const senderSession = userSessions.find(session => session.userId === message.senderId);
      if (senderSession) {
        io.to(senderSession.socketId).emit('message-read', messageId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Remove user session
    const sessionIndex = userSessions.findIndex(session => session.socketId === socket.id);
    if (sessionIndex !== -1) {
      const userId = userSessions[sessionIndex].userId;
      userSessions.splice(sessionIndex, 1);
      
      // Notify other clients that user is offline
      socket.broadcast.emit('user-offline', userId);
    }
  });
});

import { attachUser } from './middleware/attachUser';
import { registerRoutes } from './routes';

app.use(attachUser);
registerRoutes(app);

// In production, serve the index.html file for any route that doesn't match an API endpoint
if (process.env.NODE_ENV === 'production') {
  app.get('/*splat', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist/index.html'));
  });
} else {
  // In development, return JSON for unmatched routes
  app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
}

app.use(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
);

httpServer.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
});
