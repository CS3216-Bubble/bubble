// @flow

import express from 'express';
import socketio from 'socket.io';
import uuid from 'uuid';
import { createServer } from 'http';

import * as e from './error_code';
import * as k from './constants';
import ISSUE_TYPE from './models/issue_type';
import ROOM_TYPE from './models/room_type';
import MESSAGE_TYPE from './models/message_type';
import USER_TYPE from './models/user_type';
import logger from './logging';
import { IssueDB, RoomDB, MessageDB, SocketDB, UserDB } from './database';

const app = express();
const server = createServer(app);
const io = socketio(server);
const SOCKETS = {};

app.get('/', function(req, res) {
  res.sendFile('index.html', {root: __dirname});
});

app.get('/demo.js', function(req, res) {
  res.sendFile('demo.js', {root: __dirname});
});

const emitAppError = (socket, code, message) => {
  logger.warn(k.APP_ERROR, { code, message });
  socket.emit(k.APP_ERROR, {
    code,
    message,
  });
};

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
    include: [MessageDB, SocketDB],
  })
    .then(r => {
      if (r === null) {
        const message = `Room ${roomId} cannot be found.`;
        return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
      }
      return nextFn(socket)({...data, room: r});
    })
    .catch(err => {
      console.error(err);
      const message = `Room ${roomId} cannot be found.`;
      return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
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
  let room;

  RoomDB.create({
    roomId,
    roomName: roomName,
    roomType: ROOM_TYPE.PUBLIC,
    userLimit: userLimit,
    roomDescription: roomDescription,
    categories: JSON.stringify(categories),
    lastActive: new Date(),
  })
    .then(r => {
      room = r;
      return r.addSocket(socket.socketDb);
    })
    .then(() => {
      return socket.socketDb.reload();
    })
    .then(_ => socket.join(roomId, () => {
      socket.emit(k.CREATE_ROOM, room.toJSON());
    }))
    .catch(e => console.error(e));
};

const onJoinRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  // ensures user is not already in the room
  const userInRoom = Boolean(room.sockets.find(s => s.id === socket.id));
  if (userInRoom) {
    const message = `User ${socket.id} is already in room ${room.roomId}`;
    return emitAppError(socket, e.USER_ALREADY_IN_ROOM, message);
  }

  // ensures that we are under the user limit for the room
  const aboveLimit = room.sockets.length + 1 > room.userLimit;
  if (aboveLimit) {
    const message = `Room ${room.roomId} is at user limit of ${room.userLimit}.`;
    return emitAppError(socket, e.ROOM_FULL, message);
  }

  SocketDB
    .findById(socket.id)
    .then(
      s => room.addSocket(s)
    )
    .then(() => socket.socketDb.reload())
    .then(() => {
      socket.join(room.roomId, () => {
        socket.to(room.roomId).emit(k.JOIN_ROOM, {
          roomId: room.roomId,
          userId: socket.id,
        });
        socket.emit(k.JOIN_ROOM, {
          ...room.toJSON()
        })
      });
    });
});

const onExitRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  SocketDB
    .findById(socket.id)
    .then(s => {
      if (socket.socketDb.roomRoomId !== room.roomId) {
        const message = `User is not in room ${room.roomId}.`;
        return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
      }
      room
        .removeSocket(s)
        .then(() => socket.socketDb.reload())
        .then(
          () => {
            socket.leave(room.roomId, () => {
              socket.to(room.roomId).emit(k.EXIT_ROOM, {
                roomId: room.roomId,
                userId: socket.id,
              });
            });
          }
        );
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

  const userNotInRoom = !room.sockets.find(s => s.id === socket.id);
  if (userNotInRoom) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  return MessageDB
    .create({
      userId: socket.id,
      messageType: MESSAGE_TYPE.MESSAGE,
      content: message,
      roomRoomId: room.roomId,
    })
    .then(() => {
      room.lastActive = new Date();
      return room.save();
    })
    .then(r => {
      return socket.to(room.roomId).emit(k.ADD_MESSAGE, {
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

  const userNotInRoom = !room.sockets.find(s => s.id === socket.id);
  if (userNotInRoom) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  if (!reaction) {
    const message = `No reaction specified.`;
    return emitAppError(socket, e.NO_REACTION, message);
  }

  MessageDB
    .create({
      userId: socket.id,
      messageType: MESSAGE_TYPE.REACTION,
      content: reaction,
      roomRoomId: room.roomId,
    })
    .then(() => {
      room.lastActive = new Date();
      return room.save();
    })
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
  RoomDB
    .findAll({
      include: [MessageDB, SocketDB],
    })
    .then(rooms => {
      return rooms
        .filter(r => r.sockets.length > 0)
        .map(r => r.toJSON());
    })
    .then(rooms => {
      rooms.sort((a, b) => a.lastActive - b.lastActive);
      return socket.emit(k.LIST_ROOMS, rooms);
    });
};

const onDisconnect = socket => data => {
  let roomId;
  SocketDB
    .findById(socket.id)
  .then(s => {
    if (s === null) {
      return;
    }
    s.connected = false;
    s.save()
      .then(s => {
        if (!s.roomRoomId) {
          return;
        }
        roomId = s.roomRoomId;
        return RoomDB.findById(s.roomRoomId, {
          include: [SocketDB],
        });
      })
      .then(room => {
        if (!room) return;
        return room.removeSocket(s);
      })
      .then(() => {
        delete SOCKETS[socket.id];
        return socket.to(roomId).emit(k.EXIT_ROOM, {
          userId: socket.id,
        });
      });
  });
};

const onViewRoom = ensureRoomExists(socket => data => {
  socket.emit(k.VIEW_ROOM, data.room.toJSON());
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
  SocketDB.findAll({
    where: {
      connected: true,
    },
    include: [{
      model: UserDB,
      where: { userType: USER_TYPE.COUNSELLOR },
    }]
  })
  .then(counsellorsAvailable => {
    if (counsellorsAvailable.length === 0) {
      // If there are no counsellors available, we want to create an issue
      // to track that a user request was missed.
      // The next time a counsellor logs in we can deliver a notification.
      IssueDB.create({
        id: uuid.v4(),
        issueType: ISSUE_TYPE.USER_MISSED,
        userId: socket.id,
      }).then(() => {
        const message = 'No counsellors available';
        emitAppError(socket, e.COUNSELLOR_UNAVAILABLE, message);
      });
    } else {
      // TODO: some sort of selection for counsellor, right now just use first
      const counsellorSocketDb = counsellorsAvailable[0];
      let room;
      const roomId = uuid.v4();

      // create an issue to track this match
      IssueDB
        .create({
          id: uuid.v4(),
          issueType: ISSUE_TYPE.USER_REQUESTED,
          userId: socket.id,
          counsellorId: counsellorSocketDb.user.id,
        })
        .then(() => {
          return RoomDB.create({
            roomId,
            roomName: 'Chat with counsellor',
            roomType: ROOM_TYPE.PRIVATE,
            userLimit: 2,
            roomDescription: '',
            categories: '[]',
            lastActive: new Date(),
          });
        })
        .then(r => {
          room = r;
          return SocketDB.findById(socket.id);
        })
        .then(s => room.addSockets([s, counsellorSocketDb]))
        .then(() => {
          const counsellorSocket = SOCKETS[counsellorSocketDb.id];
          const cJson = {
            counsellorName: counsellorSocketDb.user.name,
            counsellorId: counsellorSocketDb.user.id,
          };
          socket.join(roomId, () => {
            counsellorSocket.join(roomId, () => {
              socket.emit(k.FIND_COUNSELLOR, {
                ...cJson,
                ...room.toJSON(),
              });
              counsellorSocket.emit(k.FIND_COUNSELLOR, {
                userId: socket.id,
                ...cJson,
                ...room.toJSON(),
              });
            });
          });
        });
    }
  });
};

const onCounsellorOnline = socket => data => {
  UserDB
    .findById(data.counsellorId)
    .then(c => {
      if (c === null) {
        return UserDB.create({
          id: data.counsellorId,
          name: data.counsellorName,
          userType: USER_TYPE.COUNSELLOR,
        });
      }
      return c;
    })
    .then(c => {
      socket.socketDb.userId = c.id;
      return socket.socketDb.save();
    })
    .then(sdb => {
      socket.socketDb = sdb;
      socket.emit(k.COUNSELLOR_ONLINE, {});
    });
  // // TODO errors when data not provided
  // TODO notifications, chat list for counsellor
};

const onReportUser = ensureRoomExists(socket => data => {
  const room = data.room;
  const { userToReport, reason } = data;

  if (!userToReport) {
    let message = `Did not specify user to report`;
    return emitAppError(socket, e.NO_USER_TO_REPORT, message);
  }

  const userNotInRoom = !room.sockets.find(s => s.id === userToReport);
  if (userNotInRoom) {
    let message = `User is not in room`;
    return emitAppError(socket, e.NO_USER_TO_REPORT, message);
  }

  socket.to(room.roomId).emit(k.REPORT_USER, {
    roomId: room.roomId,
    reportedUserId: userToReport,
    reason: reason,
  });
});

const onListIssues = socket => data => {
  const cId = data.counsellorId;
  IssueDB.findAll({
    where: {
      $or: [
        {
          issueType: ISSUE_TYPE.USER_MISSED,
        },
        {
          issueType: ISSUE_TYPE.USER_REQUESTED,
          counsellorId: cId,
        },
      ],
    },
  }).then(issues => {
    socket.emit(k.LIST_ISSUES, issues.map(i => i.toJSON()));
  });
};

// const requireRoomId = socket => data => nextFn => {
//   if (!data.roomId) {
//     //emit error
//   }
//   return RoomDB.create()
//   nextFn(socket, data, )
// }

// const onJoinRoom = socket => data => {
//   requireRoomId(socket)(data)
//     .then(room => {

//     })
// }

// const middle = socket, event, middle, final => {
//   fn = data => {
//     const ms = middle.map(m => m(socket)).map(m => m(data));

//   }
//   socket.on(event, fn)

// }
io.on('connection', function(socket) {
  SocketDB.create({
    id: socket.id,
    connected: true,
  }).then(s => {
    SOCKETS[socket.id] = socket;
    socket.socketDb = s;
  });
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
  socket.on(k.LIST_ISSUES, onListIssues(socket));
});

export {
  io,
  server,
};
