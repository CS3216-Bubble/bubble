// @flow

import express from 'express';
import socketio from 'socket.io';
import uuid from 'uuid';
import { createServer } from 'http';

import * as k from './constants';

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

class Room {
  roomName: string;
  userLimit: number;
  roomDescription: string;
  categories: string[];
  numberOfUsers: number;
  constructor(
      roomName,
      userLimit,
      roomDescription,
      categories,
      numberOfUsers: 1) {
    this.roomName = roomName;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.numberOfUsers = numberOfUsers;
  }
}
const roomIdToRoom : {[roomId:string]: Room} = {};

const onCreateRoom = socket => data => {
  const {
    roomName,
    userLimit = 7,
    roomDescription = '',
    categories = [],
    numberOfUsers = 1,
  } = data;

  if (!roomName) {
    const message = 'Room name is not specified.';
    return emitAppError(socket, 1, message);
  }

  const roomId = uuid.v4();
  roomIdToRoom[roomId] = new Room(
    roomName,
    userLimit,
    roomDescription,
    categories,
    numberOfUsers,
  );
  socket.join(roomId, () => {
    socket.emit(k.ROOM_CREATED, { roomId: roomId });
  });
};

const onJoinRoom = socket => data => {
  const {
    roomId,
  } = data;

  if (!roomId) {
    const message = 'Room id not specified.';
    return emitAppError(socket, 2, message);
  }

  if (!Object.keys(roomIdToRoom).includes(roomId)) {
    const message = `Room ${roomId} cannot be found.`;
    return emitAppError(socket, 3, message);
  }

  const room = roomIdToRoom[roomId];

  if (room.numberOfUsers + 1 > room.userLimit) {
    const message = `Room ${roomId} is at user limit of ${room.userLimit}.`;
    return emitAppError(socket, 4, message);
  }

  room.numberOfUsers++;
  socket.join(room.roomId, () => {
    socket.to(roomId).emit(k.ROOM_JOINED, {});
  });
};

io.on('connection', function(socket) {
  var addedUser = false;

  socket.on(k.CREATE_ROOM, onCreateRoom(socket));
  socket.on(k.JOIN_ROOM, onJoinRoom(socket));

  socket.on('chat message', function(msg) {
    io.emit('chat message', msg);
  });

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function(data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function(username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function() {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function() {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

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
