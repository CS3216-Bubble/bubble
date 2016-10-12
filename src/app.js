// @flow

import express from 'express';
import socketio from 'socket.io';
import uuid from 'uuid';
import { createServer } from 'http';

import * as e from './error_code';
import * as k from './constants';
import Room from './models/room';
import ROOM_TYPE from './models/room_type';
import { newMissedUserIssue, newUserRequestedIssue } from './models/issue';
import Counsellor from './models/counsellor';
import logger from './logging';
import { RoomDB, MessageDB } from './database';

const app = express();
const server = createServer(app);
const io = socketio(server);
const SOCKETS = {};

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
let COUNSELLORS = [];

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

  RoomDB.findOne({
    where: {
      roomId
    },
    include: [MessageDB],
  })
    .then(r => {
      if (r === null) {
        const message = `Room ${roomId} cannot be found.`;
        return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
      }
      const room = new Room({
        roomId,
        roomName: r.roomName,
        roomType: r.roomType,
        userLimit: r.userLimit,
        roomDescription: r.roomDescription,
        categories: JSON.parse(r.categories),
        socketIds: JSON.parse(r.socketIds),
        lastActive: r.lastActive,
        messages: r.messages.map(m => m.dataValues),
      });
      roomIdToRoom[room.roomId] = room;
      nextFn(socket)({...data, room: room});
    })
    .catch(err => {
      console.error(err);
      const message = `Room ${roomId} cannot be found.`;
      emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
    });
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
    socketIds: [socket.id],
  });

  room.save(RoomDB)
    .then(
      r => {
        roomIdToRoom[roomId] = room;

        socket.join(roomId, () => {
          socket.emit(k.CREATE_ROOM, room.toJson);
        });
      }
    )
    .catch(e => console.error(e));
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
  room.save(RoomDB).then(() => {
    socket.join(room.roomId, () => {
      socket.to(room.roomId).emit(k.JOIN_ROOM, {
        roomId: room.roomId,
        userId: socket.id,
      });
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
  room.save(RoomDB);

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

  if (!message) {
    const message = `No message specified.`;
    return emitAppError(socket, e.NO_MESSAGE, message);
  }

  if (!room.isUserHere(socket)) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  room.addMessage(socket.id, message)
    .then(() => room.save(RoomDB))
    .then(() => {
      socket.to(room.roomId).emit(k.ADD_MESSAGE, {
        roomId: room.roomId,
        userId: socket.id,
        message,
      });
    })
    .catch(e => console.error(e));
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

  room.addReaction(socket.id, reaction)
    .then(() => room.save(RoomDB))
    .then(() => {
      socket.to(room.roomId).emit(k.ADD_REACTION, {
        roomId: room.roomId,
        userId: socket.id,
        reaction,
      });
    })
    .catch(e => console.error(e));

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
  COUNSELLORS = COUNSELLORS.filter(
    c => c.socket.id !== socket.id);
  COUNSELLORS = COUNSELLORS.filter(
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

const onFindCounsellor = socket => data => {
  const counsellorsAvailable = COUNSELLORS.filter(
    c => c.isOnline
  );

  if (counsellorsAvailable.length === 0) {
    // If there are no counsellors available, we want to create an issue
    // to track that a user request was missed.
    // The next time a counsellor logs in we can deliver a notification.
    const issue = newMissedUserIssue({ userId: socket.id }); // eslint-disable-line no-unused-vars
    // TODO now save this issue somewhere
    const message = 'No counsellors available';
    return emitAppError(socket, e.COUNSELLOR_UNAVAILABLE, message);
  }

  // TODO: some sort of selection for counsellor, right now just use first
  const counsellor = COUNSELLORS[0];

  // create an issue to track this match
  const issue = newUserRequestedIssue({ // eslint-disable-line no-unused-vars
    userId: socket.id,
    counsellorId: counsellor.id,
  });
  // TODO: save this issue somewhere

  const roomId = uuid.v4();
  const room = new Room({
    roomId,
    roomName: 'Chat with counsellor',
    roomType: ROOM_TYPE.PRIVATE,
    userLimit: 2,
    roomDescription: '',
    categories: [],
    socketIds: [socket.id, counsellor.socket.id],
  });
  roomIdToRoom[roomId] = room;
  room.save(RoomDB);

  socket.join(roomId, () => {
    counsellor.socket.join(roomId, () => {
      socket.emit(k.FIND_COUNSELLOR, {
        ...counsellor.toJson,
        ...room.toJson,
      });
      counsellor.socket.emit(k.FIND_COUNSELLOR, {
        userId: socket.id,
        ...counsellor.toJson,
        ...room.toJson,
      });
    });
  });
};

const onCounsellorOnline = socket => data => {
  // TODO errors when data not provided
  COUNSELLORS.push(
    new Counsellor(
      data.counsellorId,
      data.counsellorName,
      socket,
    )
  );
  // TODO notifications, chat list for counsellor
  socket.emit(k.COUNSELLOR_ONLINE, {});
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
  SOCKETS[socket.id] = socket;
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
  socket.on(k.FIND_COUNSELLOR, onFindCounsellor(socket));
  socket.on(k.COUNSELLOR_ONLINE, onCounsellorOnline(socket));
  socket.on(k.REPORT_USER, onReportUser(socket));
});

export {
  io,
  server,
};
