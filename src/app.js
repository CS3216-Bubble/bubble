// @flow

import express from 'express';
import socketio from 'socket.io';
import uuid from 'uuid';
import { createServer } from 'http';

import * as k from './constants';
import Room from './models/room';

const app = express();
const server = createServer(app);
const io = socketio(server);

app.get('/', function(req, res) {
  res.sendFile('index.html', {root: __dirname});
});

var numUsers = 0;

const emitAppError = (socket, code, message) => (
  socket.emit(k.APP_ERROR, {
    code,
    message,
  }));

const roomIdToRoom : {[roomId:string]: Room} = {};

/**
 * Checks that `roomId` is provided in `data`, and that `roomId` exists
 * Calls nextFn with `room` added to `data`.
 *
 * @param {function} nextFn next function to call if room exists
 * @param {object} socket socket.io socket client
 * @param {object} data data sent by socket client
 * @return {null} emits errors when roomId is not provided or does not exist
 */
const ensureRoomExists = nextFn => socket => data => {
  const { roomId } = data;
  if (!roomId) {
    const message = 'Room id not specified.';
    return emitAppError(socket, 2, message);
  }

  if (!Object.keys(roomIdToRoom).includes(roomId)) {
    const message = `Room ${roomId} cannot be found.`;
    return emitAppError(socket, 3, message);
  }

  return nextFn(socket)({...data, room: roomIdToRoom[roomId]});
};

const onCreateRoom = socket => data => {
  const {
    roomName,
    userLimit = 7,
    roomDescription = '',
    categories = [],
  } = data;

  if (!roomName) {
    const message = 'Room name is not specified.';
    return emitAppError(socket, 1, message);
  }

  const roomId = uuid.v4();
  roomIdToRoom[roomId] = new Room(
    roomId,
    roomName,
    userLimit,
    roomDescription,
    categories,
    [socket],
  );
  socket.join(roomId, () => {
    socket.emit(k.ROOM_CREATED, { roomId: roomId });
  });
};

const onJoinRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (room.numberOfUsers + 1 > room.userLimit) {
    const message = `Room ${room.roomId} is at user limit of ${room.userLimit}.`;
    return emitAppError(socket, 4, message);
  }

  room.addUser(socket);
  socket.join(room.roomId, () => {
    socket.to(room.roomId).emit(k.ROOM_JOINED, {
      userId: socket.id.slice(2),
    });
  });
});

const onExitRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, 5, message);
  }

  room.removeUser(socket);
  socket.leave(room.roomId, () => {
    socket.to(room.roomId).emit(k.ROOM_EXITED, {
      userId: socket.id.slice(2),
    });
  });
});

const onTyping = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, 5, message);
  }

  socket.to(room.roomId).emit(k.TYPING, {
    userId: socket.id.slice(2),
  });
});

const onStopTyping = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, 5, message);
  }

  socket.to(room.roomId).emit(k.STOP_TYPING, {
    userId: socket.id.slice(2),
  });
});

const onAddMessage = ensureRoomExists(socket => data => {
  const room = data.room;
  const { message } = data;

  if (!message) {
    const message = `No message specified.`;
    return emitAppError(socket, 6, message);
  }

  socket.to(room.roomId).emit(k.ADD_MESSAGE, {
    userId: socket.id.slice(2),
    message,
  });
});

io.on('connection', function(socket) {
  var addedUser = false;

  socket.on(k.CREATE_ROOM, onCreateRoom(socket));
  socket.on(k.JOIN_ROOM, onJoinRoom(socket));
  socket.on(k.EXIT_ROOM, onExitRoom(socket));
  // when the client emits 'typing', we broadcast it to others
  socket.on(k.TYPING, onTyping(socket));
  socket.on(k.STOP_TYPING, onStopTyping(socket));
  socket.on(k.ADD_MESSAGE, onAddMessage(socket));

  // when the user disconnects.. perform this
  socket.on('disconnect', function() {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

export {
  io,
  server,
};
