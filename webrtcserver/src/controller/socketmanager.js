import { Server } from 'socket.io';
import { getAllowedOrigins } from '../config/cors.js';

const connections = {};
const userNames = {};
const messages = {};

const MAX_ROOM_SIZE = 2;

function removeSocketFromAllRooms(socket, io) {
  for (const roomId of Object.keys(connections)) {
    const index = connections[roomId].indexOf(socket.id);
    if (index === -1) continue;

    const userName = userNames[socket.id];
    connections[roomId].splice(index, 1);

    connections[roomId].forEach((id) => {
      io.to(id).emit('user-left', {
        socketId: socket.id,
        userName: userName || 'Anonymous',
      });
    });

    if (connections[roomId].length === 0) {
      delete connections[roomId];
      delete messages[roomId];
    }

    socket.leave(roomId);
    console.log(`[leave] ${userName || socket.id} removed from ${roomId}`);
    break;
  }
}

const connecttosocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-call', (data) => {
      const roomId = data?.roomId?.trim();
      const userName = data?.userName?.trim() || 'Anonymous';

      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }

      removeSocketFromAllRooms(socket, io);

      const roomMembers = connections[roomId] || [];

      if (roomMembers.length >= MAX_ROOM_SIZE) {
        socket.emit('room-full', {
          message: 'This room is full (max 2 participants).',
        });
        return;
      }

      if (roomMembers.includes(socket.id)) {
        return;
      }

      userNames[socket.id] = userName;
      socket.join(roomId);

      const isHost = roomMembers.length === 0;
      const existingParticipants = roomMembers.map((id) => ({
        socketId: id,
        userName: userNames[id] || 'Anonymous',
      }));

      connections[roomId] = [...roomMembers, socket.id];

      if (!isHost) {
        const hostSocketId = connections[roomId][0];
        io.to(hostSocketId).emit('new-participant', {
          socketId: socket.id,
          userName,
        });
      }

      socket.emit('room-joined', {
        roomId,
        isHost,
        socketId: socket.id,
        participants: existingParticipants,
      });

      if (messages[roomId]) {
        messages[roomId].forEach((msg) => {
          socket.emit('chat-message', msg.data, msg.sender);
        });
      }

      console.log(
        `[join-call] ${userName} (${socket.id}) → ${roomId} as ${isHost ? 'host' : 'guest'} (${connections[roomId].length}/${MAX_ROOM_SIZE})`
      );
    });

    socket.on('offer', (data) => {
      if (!data?.to) return;
      io.to(data.to).emit('offer', {
        from: socket.id,
        offer: data.offer,
        userName: userNames[socket.id],
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

    socket.on('chat-message', (data) => {
      const matchingRoom = Object.keys(connections).find((roomKey) =>
        connections[roomKey].includes(socket.id)
      );
      if (!matchingRoom) return;

      if (!messages[matchingRoom]) messages[matchingRoom] = [];
      messages[matchingRoom].push({ data, sender: socket.id });

      connections[matchingRoom].forEach((id) => {
        io.to(id).emit('chat-message', data, socket.id);
      });
    });

    socket.on('disconnect', () => {
      delete userNames[socket.id];
      removeSocketFromAllRooms(socket, io);
    });
  });

  return io;
};

export default connecttosocket;
