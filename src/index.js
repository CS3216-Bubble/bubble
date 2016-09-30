// @flow

var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.get('/', function(req, res) {
  res.sendFile('index.html', {root: __dirname});
});

app.get('/readme', function(req, res) {
  res.sendFile('README.md', {root: __dirname});
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
  socket.emit('bubble_error', {
    code,
    message,
  }));

const createRoom = (roomName, userLimit) => ({});

const onCreateRoom = socket => data => {
  // socket.broadcast.emit('room_created');
  const { userId, roomName, userLimit = 7 } = tryJson(data);

  if (userId) {
  }

  if (!roomName) {
    const message = 'Room name is not specified';
    return emitAppError(socket, 1, message);
  }

  createRoom(roomName, userLimit);
  socket.emit('room_created', { roomId: 1 });
};

io.on('connection', function(socket) {
  var addedUser = false;

  socket.on('create_room', onCreateRoom(socket));

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

exports.server = http.listen(3000);
