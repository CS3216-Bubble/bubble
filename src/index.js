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

const tryJson = data => {
  try {
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
};

const emitAppError = (socket, code, message) => (
  socket.emit(k.APP_ERROR, {
    code,
    message,
  }));

const roomIdToRoomName : {[roomId:string]: string} = {};
const roomIdToUserLimit : {[roomId:string]: number} = {};

const onCreateRoom = socket => data => {
  const { userId, roomName, userLimit = 7 } = tryJson(data);

  if (userId) {
  }

  if (!roomName) {
    const message = 'Room name is not specified.';
    return emitAppError(socket, 1, message);
  }

  const roomId = uuid.v4();
  roomIdToRoomName[roomId] = roomName;
  roomIdToUserLimit[roomId] = userLimit;
  socket.join(roomId, () => {
    socket.emit('room_created', { roomId: roomId });
  });
};

io.on('connection', function(socket) {
  var addedUser = false;

  socket.on(k.CREATE_ROOM, onCreateRoom(socket));

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
