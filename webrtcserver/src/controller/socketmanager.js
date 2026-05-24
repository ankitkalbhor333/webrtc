import { Server } from 'socket.io';
import { corsOrigin } from '../config/cors.js';

const MAX_ROOM_SIZE = 2;
const MAX_MESSAGE_LENGTH = 500;
const MAX_MESSAGES_PER_ROOM = 100;

/** @type {Record<string, Array<object>>} */
const roomMessages = {};

function parseJoinPayload(payload) {
  if (typeof payload === 'string') {
    return { roomId: payload.trim(), userName: 'Anonymous' };
  }
  return {
    roomId: payload?.roomId?.trim() || '',
    userName: payload?.userName?.trim() || 'Anonymous',
  };
}

function createChatMessage(socket, text) {
  return {
    id: `${socket.id}-${Date.now()}`,
    text,
    senderId: socket.id,
    senderName: socket.data.userName || 'Anonymous',
    timestamp: Date.now(),
  };
}

async function clearRoomIfEmpty(io, roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  if (sockets.length === 0) {
    delete roomMessages[roomId];
  }
}

const connecttosocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => corsOrigin(origin, callback),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-room', (payload) => {
      const { roomId: room, userName } = parseJoinPayload(payload);

      if (!room) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
      if (roomSize >= MAX_ROOM_SIZE) {
        socket.emit('room-full', {
          message: 'This room is full (max 2 participants).',
        });
        return;
      }

      socket.data.roomId = room;
      socket.data.userName = userName;
      socket.join(room);

      socket.to(room).emit('user-joined', socket.id);

      if (roomMessages[room]?.length) {
        socket.emit('chat-history', roomMessages[room]);
      }

      console.log(`[join-room] ${userName} (${socket.id}) joined ${room}`);
    });

    socket.on('chat-message', (payload) => {
      const room = socket.data.roomId;
      if (!room) {
        socket.emit('chat-error', { message: 'Join a room before sending messages.' });
        return;
      }

      const text = payload?.text?.trim();
      if (!text) {
        socket.emit('chat-error', { message: 'Message cannot be empty.' });
        return;
      }

      if (text.length > MAX_MESSAGE_LENGTH) {
        socket.emit('chat-error', {
          message: `Message must be ${MAX_MESSAGE_LENGTH} characters or less.`,
        });
        return;
      }

      const message = createChatMessage(socket, text);

      if (!roomMessages[room]) {
        roomMessages[room] = [];
      }
      roomMessages[room].push(message);

      if (roomMessages[room].length > MAX_MESSAGES_PER_ROOM) {
        roomMessages[room] = roomMessages[room].slice(-MAX_MESSAGES_PER_ROOM);
      }

      io.to(room).emit('chat-message', message);
      console.log(`[chat] ${socket.data.userName} in ${room}: ${text.slice(0, 40)}`);
    });

    socket.on('offer', (data) => {
      if (!data?.to) return;
      io.to(data.to).emit('offer', {
        from: socket.id,
        offer: data.offer,
        userName: socket.data.userName,
      });
    });

    socket.on('answer', (data) => {
      if (!data?.to) return;
      io.to(data.to).emit('answer', {
        from: socket.id,
        answer: data.answer,
      });
    });

    socket.on('ice-candidate', (data) => {
      if (!data?.to) return;
      io.to(data.to).emit('ice-candidate', {
        from: socket.id,
        candidate: data.candidate,
      });
    });

    socket.on('disconnect', async () => {
      const room = socket.data.roomId;
      if (room) {
        socket.to(room).emit('user-left');
        await clearRoomIfEmpty(io, room);
      }
      console.log(`[disconnect] ${socket.id}`);
    });
  });

  return io;
};

export default connecttosocket;
