// @flow

import express from 'express';
import process from 'process';
import raven from 'raven';
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
import { IssueDB, RoomDB, MessageDB, UserDB } from './database';

const app = express();
const server = createServer(app);
const io = socketio(server);

app.use(raven.middleware.express.requestHandler(process.env.RAVEN_URL));
app.use(raven.middleware.express.errorHandler(process.env.RAVEN_URL));

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
 * Tentative helper until we make categories a FK
 * @param {object} room room model
 * @return {object} room
 */
const roomToJSON = room => {
  const j = room.toJSON();
  return {
    ...j,
    categories: JSON.parse(j.categories),
  };
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
    include: [MessageDB],
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
  RoomDB.create({
    roomId,
    roomName: roomName,
    roomType: ROOM_TYPE.PUBLIC,
    userLimit: userLimit,
    roomDescription: roomDescription,
    categories: JSON.stringify(categories),
    lastActive: new Date(),
    numUsers: 1,
    createdBy: socket.id,
  })
    .then(room => socket.join(roomId, () => {
      socket.emit(k.CREATE_ROOM, roomToJSON(room));
    }))
    .catch(e => console.error(e));
};

const onJoinRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (room.numUsers === 0) {
    const message = `Room ${room.roomId} is closed`;
    return emitAppError(socket, e.ROOM_CLOSED, message);
  }

  // ensures user is not already in the room
  if (Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User ${socket.id} is already in room ${room.roomId}`;
    return emitAppError(socket, e.USER_ALREADY_IN_ROOM, message);
  }

  // ensures that we are under the user limit for the room
  const aboveLimit = room.numUsers + 1 > room.userLimit;
  if (aboveLimit) {
    const message = `Room ${room.roomId} is at user limit of ${room.userLimit}.`;
    return emitAppError(socket, e.ROOM_FULL, message);
  }

  room.numUsers += 1;
  return room
    .save()
    .then(() => {
      return socket.join(room.roomId, () => {
        socket.to(room.roomId).emit(k.JOIN_ROOM, {
          roomId: room.roomId,
          userId: socket.id,
        });

        io.in(room.roomId).clients((err, clients) => {
          socket.emit(k.JOIN_ROOM, {
            ...roomToJSON(room),
            userId: socket.id,
            messages: filterMessages(room.messages),
            participants: clients,
          });
        });
      });
    });
});

function filterMessages(messages) {
  return messages.filter(m => {
    const now = new Date();
    const yesterday = now - (24 * 60 * 60 * 1000);
    const c = new Date(m.createdAt);
    return c >= yesterday && c <= now;
  });
}

const onExitRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (Object.keys(socket.rooms).indexOf(room.roomId) < 0) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }
  room.numUsers -= 1;
  room.save()
    .then(
      () => {
        socket.leave(room.roomId, () => {
          socket.to(room.roomId).emit(k.EXIT_ROOM, {
            roomId: room.roomId,
            userId: socket.id,
          });
          socket.emit(k.EXIT_ROOM);
        });
      }
    );
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

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
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
    .then(() => {
      socket.to(room.roomId).emit(k.ADD_MESSAGE, {
        roomId: room.roomId,
        userId: socket.id,
        message,
      });
      socket.emit(k.ADD_MESSAGE, {
        roomId: room.roomId,
        userId: socket.id,
        sentByMe: true,
        message,
      });
    })
    .catch(e => console.error(e));
});

const onAddReaction = ensureRoomExists(socket => data => {
  const room = data.room;
  const { reaction, targetUser } = data;

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  if (!reaction) {
    const message = `No reaction specified.`;
    return emitAppError(socket, e.NO_REACTION, message);
  }

  if (!targetUser) {
    const message = `No targetUser specified for reaction.`;
    return emitAppError(socket, e.NO_TARGET_USER, message);
  }

  MessageDB
    .create({
      userId: socket.id,
      messageType: MESSAGE_TYPE.REACTION,
      content: reaction,
      roomRoomId: room.roomId,
      targetUser: targetUser,
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
        targetUser,
      });
      socket.emit(k.ADD_REACTION, {
        roomId: room.roomId,
        userId: socket.id,
        reaction,
        targetUser,
        sentByMe: true,
      });
    })
    .catch(e => console.error(e));
});

const onListRooms = socket => () => {
  RoomDB
    .findAll({
      include: [MessageDB],
    })
    .then(rooms => {
      return rooms
        .filter(r => r.numUsers > 0)
        .map(roomToJSON);
    })
    .then(rooms => {
      rooms.sort((a, b) => a.lastActive - b.lastActive);
      return socket.emit(k.LIST_ROOMS, rooms);
    });
};

const onDisconnect = socket => () => {
  delete SOCKETS[socket.id];
};

const onDisconnecting = socket => () => {
  return Promise.all(Object.keys(socket.rooms).map(rid => {
    if (rid === socket.id) {
      return null;
    }
    return RoomDB.findById(rid)
      .then(r => {
        r.numUsers -= 1;
        r.save();
      })
      .then(() => {
        return socket.to(rid).emit(k.EXIT_ROOM, {
          userId: socket.id,
        });
      });
  }));
};

const onViewRoom = ensureRoomExists(socket => data => {
  io.in(data.room.roomId).clients((err, clients) => {
    socket.emit(k.VIEW_ROOM, {
      ...roomToJSON(data.room),
      participants: clients,
    });
  });
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

const onFindCounsellor = socket => () => {
  const counsellorsAvailable = Object.keys(SOCKETS).filter(sid => {
    return SOCKETS[sid].counsellor &&
      SOCKETS[sid].counsellor.userType === USER_TYPE.COUNSELLOR;
  });
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
    const cSoc = SOCKETS[counsellorsAvailable[0]];
    const roomId = uuid.v4();

    // create an issue to track this match
    IssueDB
      .create({
        id: uuid.v4(),
        issueType: ISSUE_TYPE.USER_REQUESTED,
        userId: socket.id,
        counsellorId: cSoc.counsellor.id,
      })
      .then(() => {
        return RoomDB.create({
          roomId,
          roomName: 'Chat with counsellor',
          roomType: ROOM_TYPE.PRIVATE,
          userLimit: 2,
          numUsers: 2,
          roomDescription: '',
          categories: '[]',
          lastActive: new Date(),
          createdBy: socket.id,
        });
      })
      .then(room => {
        const cJson = {
          counsellorName: cSoc.counsellor.name,
          counsellorId: cSoc.counsellor.id,
          ...roomToJSON(room),
        };
        socket.join(roomId, () => {
          cSoc.join(roomId, () => {
            socket.emit(k.FIND_COUNSELLOR, {
              ...cJson,
            });
            cSoc.emit(k.FIND_COUNSELLOR, {
              userId: socket.id,
              ...cJson,
            });
          });
        });
      });
  }
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
      socket.isC = true;
      socket.counsellor = c;
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

  if (!SOCKETS[userToReport] || !Object.keys(SOCKETS[userToReport].rooms).includes(room.roomId)) {
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
  socket.on(k.DISCONNECTING, onDisconnecting(socket));
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
