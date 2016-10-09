// @flow

import express from 'express';
import socketio from 'socket.io';
import uuid from 'uuid';
import { createServer } from 'http';

import * as e from './error_code';
import * as k from './constants';
import Room from './models/room';
import ROOM_TYPE from './models/room_type';
import Counsellor from './models/counsellor';
import logger from './logging';

const app = express();
const server = createServer(app);
const io = socketio(server);

app.get('/', function(req, res) {
  res.sendFile('index.html', {root: __dirname});
});

const emitAppError = (socket, code, message) => {
  logger.warn(k.APP_ERROR, { code, message });
  socket.emit(k.APP_ERROR, {
    code,
    message,
  });
};

const roomIdToRoom : {[roomId:string]: Room} = {};
let COUNSELLERS = [];

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
    return emitAppError(socket, e.NO_ROOM_ID, message);
  }

  if (!Object.keys(roomIdToRoom).includes(roomId)) {
    const message = `Room ${roomId} cannot be found.`;
    return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
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
    return emitAppError(socket, e.NO_ROOM_NAME, message);
  }

  const roomId = uuid.v4();
  const room = new Room({
    roomId,
    roomName,
    userLimit,
    roomDescription,
    categories,
    sockets: [socket],
  });
  roomIdToRoom[roomId] = room;

  socket.join(roomId, () => {
    socket.emit(k.CREATE_ROOM, room.toJson);
  });
};

const onJoinRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  // ensures user is not already in the room
  if (room.isUserHere(socket)) {
    const message = `User ${socket.id} is already in room ${room.roomId}`;
    return emitAppError(socket, e.USER_ALREADY_IN_ROOM, message);
  }

  // ensures that we are under the user limit for the room
  if (room.numberOfUsers + 1 > room.userLimit) {
    const message = `Room ${room.roomId} is at user limit of ${room.userLimit}.`;
    return emitAppError(socket, e.ROOM_FULL, message);
  }

  room.addUser(socket);

  socket.join(room.roomId, () => {
    socket.to(room.roomId).emit(k.JOIN_ROOM, {
      roomId: room.roomId,
      userId: socket.id,
    });
  });
});

const onExitRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  room.removeUser(socket);

  socket.leave(room.roomId, () => {
    socket.to(room.roomId).emit(k.EXIT_ROOM, {
      roomId: room.roomId,
      userId: socket.id,
    });
  });
});

const onTyping = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  socket.to(room.roomId).emit(k.TYPING, {
    roomId: room.roomId,
    userId: socket.id,
  });
});

const onStopTyping = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  socket.to(room.roomId).emit(k.STOP_TYPING, {
    roomId: room.roomId,
    userId: socket.id,
  });
});

const onAddMessage = ensureRoomExists(socket => data => {
  const room = data.room;
  const { message } = data;

  if (!room.isUserHere(socket)) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  if (!message) {
    const message = `No message specified.`;
    return emitAppError(socket, e.NO_MESSAGE, message);
  }

  room.addMessage(socket.id, message);

  socket.to(room.roomId).emit(k.ADD_MESSAGE, {
    roomId: room.roomId,
    userId: socket.id,
    message,
  });
});

const onAddReaction = ensureRoomExists(socket => data => {
  const room = data.room;
  const { reaction } = data;

  if (!room.isUserHere(socket)) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  if (!reaction) {
    const message = `No reaction specified.`;
    return emitAppError(socket, e.NO_REACTION, message);
  }

  room.addReaction(socket.id, reaction);

  socket.to(room.roomId).emit(k.ADD_REACTION, {
    roomId: room.roomId,
    userId: socket.id,
    reaction,
  });
});

const onListRooms = socket => data => {
  const rooms = Object.keys(roomIdToRoom)
    .map(k => roomIdToRoom[k])
    .filter(r => r.numberOfUsers > 0)
    .map(r => r.toJson);

  rooms.sort((a, b) => a - b);
  return socket.emit(k.LIST_ROOMS, rooms);
};

const onDisconnect = socket => data => {
  Object.keys(roomIdToRoom)
    .map(roomId => roomIdToRoom[roomId])
    .forEach(room => {
      // remove user from rooms that user is in
      if (room.isUserHere(socket)) {
        room.removeUser(socket);
        // and notify all other users in the room
        socket.to(room.roomId).emit(k.EXIT_ROOM, {
          userId: socket.id,
        });
      }
    });
  COUNSELLERS = COUNSELLERS.filter(
    c => c.socket.id !== socket.id);
  COUNSELLERS = COUNSELLERS.filter(
    c => c.socket.id !== socket.id);
};

const onViewRoom = ensureRoomExists(socket => data => {
  socket.emit(k.VIEW_ROOM, data.room.toJson);
});

const onSetUserName = socket => data => {
  // should emit name change to all rooms that user is in
  const { newName } = data;
  if (!newName) {
    const message = 'newName not specified.';
    return emitAppError(socket, e.NO_NAME, message);
  }

  socket.userName = newName;

  Object.keys(socket.rooms)
    .filter(socketId => socketId !== socket.id)
    .forEach(roomId => {
      socket.to(roomId).emit(k.SET_USER_NAME, {
        userId: socket.id,
        newName,
      });
    });
};

const onFindCounseller = socket => data => {
  const counsellersAvailable = COUNSELLERS.filter(
    c => c.isOnline
  );

  if (counsellersAvailable.length === 0) {
    const message = 'No counsellers available';
    return emitAppError(socket, e.COUNSELLER_UNAVAILABLE, message);
  }

  // TODO: some sort of selection for counseller, right now just use first
  const counseller = COUNSELLERS[0];

  const roomId = uuid.v4();
  const room = new Room({
    roomId,
    roomName: 'Chat with counseller',
    roomType: ROOM_TYPE.PRIVATE,
    userLimit: 2,
    roomDescription: '',
    categories: [],
    sockets: [socket, counseller.socket],
  });
  roomIdToRoom[roomId] = room;

  socket.join(roomId, () => {
    counseller.socket.join(roomId, () => {
      socket.emit(k.FIND_COUNSELLER, {
        ...counseller.toJson,
        ...room.toJson,
      });
      counseller.socket.emit(k.FIND_COUNSELLER, {
        ...counseller.toJson,
        ...room.toJson,
      });
    });
  });
};

const onCounsellerOnline = socket => data => {
  // TODO errors when data not provided
  COUNSELLERS.push(
    new Counsellor(
      data.counsellerId,
      data.counsellerName,
      socket,
    )
  );
  // TODO notifications, chat list for counsellor
  socket.emit(k.COUNSELLER_ONLINE, {});
};

const onReportUser = ensureRoomExists(socket => data => {
  const room = data.room;
  const { userToReport, reason } = data;

  if (!userToReport) {
    let message = `Did not specify user to report`;
    return emitAppError(socket, e.NO_USER_TO_REPORT, message);
  }

  if (!room.isUserHere({id: userToReport})) {
    let message = `User is not in room`;
    return emitAppError(socket, e.NO_USER_TO_REPORT, message);
  }

  socket.to(room.roomId).emit(k.REPORT_USER, {
    roomId: room.roomId,
    reportedUserId: userToReport,
    reason: reason,
  });
});

io.on('connection', function(socket) {
  socket.on(k.CREATE_ROOM, onCreateRoom(socket));
  socket.on(k.JOIN_ROOM, onJoinRoom(socket));
  socket.on(k.EXIT_ROOM, onExitRoom(socket));
  socket.on(k.TYPING, onTyping(socket));
  socket.on(k.STOP_TYPING, onStopTyping(socket));
  socket.on(k.ADD_MESSAGE, onAddMessage(socket));
  socket.on(k.ADD_REACTION, onAddReaction(socket));
  socket.on(k.LIST_ROOMS, onListRooms(socket));
  socket.on(k.DISCONNECT, onDisconnect(socket));
  socket.on(k.VIEW_ROOM, onViewRoom(socket));
  socket.on(k.SET_USER_NAME, onSetUserName(socket));
  socket.on(k.FIND_COUNSELLER, onFindCounseller(socket));
  socket.on(k.COUNSELLER_ONLINE, onCounsellerOnline(socket));
  socket.on(k.REPORT_USER, onReportUser(socket));
});

export {
  io,
  server,
};
