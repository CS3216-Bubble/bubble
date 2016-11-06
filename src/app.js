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
import Push from './push';
import logger from './logging';
import {
  validateCategories,
  validateMessage,
  validateRoomId,
  validateString,
  validateUserLimit,
} from './validations';
import { IssueDB, RoomDB, MessageDB, UserDB } from './database';

const app = express();
const server = createServer(app);
const io = socketio(server);
const pushManager = new Push();

app.use(raven.middleware.express.requestHandler(process.env.RAVEN_URL));
app.use(raven.middleware.express.errorHandler(process.env.RAVEN_URL));

// TODO cache rooms query
const SOCKETS = {};
// [id] -> [rooms];
const SocketIdToRooms = {};

function cacheSocketRooms(socket) {
  SocketIdToRooms[socket.id] = Object.keys(socket.rooms)
    .filter(room => room !== socket.id);
}

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

  if (!validateRoomId(roomId)) {
    const message = 'Invalid room id.';
    return emitAppError(socket, e.INVALID_ROOM_ID, message);
  }

  RoomDB.findOne({
    where: {
      roomId
    },
    include: [MessageDB],
    order: [
      [MessageDB, 'createdAt', 'DESC'],
    ],
  })
    .then(r => {
      if (r === null) {
        const message = `Room ${roomId} cannot be found.`;
        return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
      }
      return nextFn(socket)({...data, room: r});
    })
    .catch(err => {
      logger.error(err);
      const message = `Room ${roomId} cannot be found.`;
      return emitAppError(socket, e.ROOM_ID_NOT_FOUND, message);
    });
};

const onCreateRoom = socket => data => {
  const {
    roomName,
    userLimit = 21,
    roomDescription = '',
    categories = [],
  } = data;

  if (!roomName) {
    const message = 'Room name is not specified.';
    return emitAppError(socket, e.NO_ROOM_NAME, message);
  }

  let parsedUserLimit = parseInt(userLimit, 10);
  if (!validateUserLimit(parsedUserLimit)) {
    const message = `User limit must be between 2 and 100, got ${userLimit}.`;
    return emitAppError(socket, e.INVALID_USER_LIMIT, message);
  }

  if (!validateCategories(categories)) {
    const message = `Invalid categories, should be one of ${k.valid_categories_for_display}.`;
    return emitAppError(socket, e.INVALID_CATEGORIES, message);
  }

  const roomId = uuid.v4();
  RoomDB.create({
    roomId,
    roomName: roomName,
    roomType: ROOM_TYPE.PUBLIC,
    userLimit: parsedUserLimit,
    roomDescription: roomDescription,
    categories: JSON.stringify(categories),
    lastActive: new Date(),
    numUsers: 1,
    createdBy: socket.id,
    createdByBubbleId: socket.bubbleId,
  })
    .then(room => socket.join(roomId, () => {
      socket.emit(k.CREATE_ROOM, roomToJSON(room));
      cacheSocketRooms(socket);
      logger.info(
        '%s creates %s', socket.id, room.roomId, { event: k.CREATE_ROOM });
      pushManager.subscribeSocketToRoomEvents(socket.id, room.roomId);
    }))
    .catch(e => logger.error(e));
};

const onJoinRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (!room.isOpen) {
    const message = `Room ${room.roomId} is closed`;
    return emitAppError(socket, e.ROOM_CLOSED, message);
  }

  if (Object.keys(socket.rooms).includes(room.roomId)) {
    // if socket is already in room, do nothing
    return socket.emit(k.JOIN_ROOM, {
      ...roomToJSON(room),
      userId: socket.id,
      messages: filterMessagesLimitX(room.messages),
    });
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
          bubbleId: socket.bubbleId,
        });

        cacheSocketRooms(socket);

        logger.info(
          '%s joins %s', socket.id, room.roomId, { event: k.JOIN_ROOM });

        pushManager.subscribeSocketToRoomEvents(socket.id, room.roomId);

        io.in(room.roomId).clients((error, clients) => {
          if (error) throw error;
          socket.emit(k.JOIN_ROOM, {
            ...roomToJSON(room),
            userId: socket.id,
            bubbleId: socket.bubbleId,
            messages: filterMessagesLimitX(room.messages),
            participants: clients,
          });
        });
      });
    });
});

/**
 * Limits messages to first 100.
 * Messages should have been sorted by createdAt DESC first.
 *
 * @param {array} messages an array of messages
 * @return {array} max 100 messages
 */
function filterMessagesLimitX(messages) {
  return messages.splice(0, 100);
}

// function filterMessages24Hr(messages) {
//   return messages.filter(m => {
//     const now = new Date();
//     const yesterday = now - (24 * 60 * 60 * 1000);
//     const c = new Date(m.createdAt);
//     return c >= yesterday && c <= now;
//   });
// }

const onExitRoom = ensureRoomExists(socket => data => {
  const room = data.room;

  if (Object.keys(socket.rooms).indexOf(room.roomId) < 0) {
    const message = `User is not in room ${room.roomId}.`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }
  room.numUsers -= 1;
  return room.save()
    .then(
      () => {
        return socket.leave(room.roomId, () => {
          socket.to(room.roomId).emit(k.EXIT_ROOM, {
            roomId: room.roomId,
            userId: socket.id,
            bubbleId: socket.bubbleId,
          });

          logger.info(
            '%s exits %s', socket.id, room.roomId, { event: k.EXIT_ROOM });
          pushManager.unsubscribeSocketToRoomEvents(socket.id, room.roomId);

          socket.emit(k.I_EXIT, {
            roomId: room.roomId,
            userId: socket.id,
            bubbleId: socket.bubbleId,
          });
          return socket.emit(k.EXIT_ROOM, {
            roomId: room.roomId,
            userId: socket.id,
            bubbleId: socket.bubbleId,
          });
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
    bubbleId: socket.bubbleId,
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
    bubbleId: socket.bubbleId,
  });
});

const onAddMessage = ensureRoomExists(socket => data => {
  const room = data.room;
  const { message } = data;

  if (!message) {
    const message = `No message specified.`;
    return emitAppError(socket, e.NO_MESSAGE, message);
  }

  if (!validateMessage(message)) {
    const message = `Message is invalid.`;
    return emitAppError(socket, e.INVALID_MESSAGE, message);
  }

  if (!Object.keys(socket.rooms).includes(room.roomId)) {
    const message = `User ${socket.id} is not in room ${room.roomId}`;
    return emitAppError(socket, e.USER_NOT_IN_ROOM, message);
  }

  let msg;
  return MessageDB
    .create({
      userId: socket.id,
      messageType: MESSAGE_TYPE.MESSAGE,
      content: message,
      roomRoomId: room.roomId,
      bubbleId: socket.bubbleId,
    })
    .then(m => {
      msg = m;
      room.lastActive = new Date();
      return room.save();
    })
    .then(() => {
      socket.to(room.roomId).emit(k.ADD_MESSAGE, {
        ...msg.toJSON(),
        roomName: room.roomName,
        sentByMe: false,
        bubbleId: socket.bubbleId,
      });
      socket.emit(k.ADD_MESSAGE, {
        ...msg.toJSON(),
        roomName: room.roomName,
        sentByMe: true,
        bubbleId: socket.bubbleId,
      });
      pushNotification(
        room.roomId,
        `New message in ${room.roomName}`,
        message);
    })
    .catch(e => logger.error(e));
});

const onAddReaction = ensureRoomExists(socket => data => {
  const room = data.room;
  const { reaction, targetUser } = data;
  /* TODO: frontend doesn't send this yet, it should */
  let { targetUserBubbleId } = data;

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
  /* TODO: temp fix for transition to bubble id */
  /* if frontend sends it, use it, otherwise we try to find from sockets */
  if (typeof targetUserBubbleId === 'undefined') {
    targetUserBubbleId = SOCKETS[targetUser] && SOCKETS[targetUser].bubbleId;
  }

  let msg;
  MessageDB
    .create({
      userId: socket.id,
      messageType: MESSAGE_TYPE.REACTION,
      content: reaction,
      roomRoomId: room.roomId,
      targetUser: targetUser,
      targetUserBubbleId,
      bubbleId: socket.bubbleId,
    })
    .then(m => {
      msg = m;
      room.lastActive = new Date();
      return room.save();
    })
    .then(() => {
      socket.to(room.roomId).emit(k.ADD_REACTION, {
        ...msg.toJSON(),
        sentByMe: true,
        bubbleId: socket.bubbleId,
      });
      socket.emit(k.ADD_REACTION, {
        ...msg.toJSON(),
        sentByMe: true,
        bubbleId: socket.bubbleId,
      });
    })
    .catch(e => logger.error(e));
});

/**
 * Weight of each time of room, used for sorting.
 * A HOT room should be earlier than a PUBLIC room in sorted order.
 */
const ROOM_TYPE_WEIGHT = {
  [ROOM_TYPE.HOT]: 0,
  [ROOM_TYPE.PUBLIC]: 1,
};

/**
 * Compares two rooms using it's type, followed by lastActive.
 * @param {object} a a room
 * @param {object} b another room
 * @return {number} -1, 0, or 1
 */
function compareRoom(a, b) {
  return (ROOM_TYPE_WEIGHT[a.roomType] - ROOM_TYPE_WEIGHT[b.roomType]) ||
    (a.lastActive - b.lastActive);
}

const STALE_TIME = 3 * 24 * 60 * 60 * 1000;
const onListRooms = socket => () => {
  RoomDB
    .findAll({
      where: {
        $or: [
          {
            lastActive: {
              $gt: new Date(new Date() - STALE_TIME),
            },
          },
          {
            roomType: ROOM_TYPE.HOT,
          }
        ]

      },
      include: [MessageDB],
      order: [
        [MessageDB, 'createdAt', 'DESC'],
      ],
    })
    .then(rooms => {
      return rooms
        .filter(r => r.numUsers >= 0)
        .filter(r => r.roomType !== ROOM_TYPE.PRIVATE)
        .map(r => {
          return {
            ...roomToJSON(r),
            messages: filterMessagesLimitX(r.messages),
          };
        });
    })
    .then(rooms => {
      rooms.sort(compareRoom);
      return socket.emit(k.LIST_ROOMS, rooms);
    });
};

const onDisconnect = socket => () => {
  // don't delete, we need the connection status
  logger.info('%s disconnects', socket.id, { event: k.DISCONNECT });
};

const onDisconnecting = socket => () => {
  // save the rooms that socket.id was in for restore if reconnect
  cacheSocketRooms(socket);
  return Promise.all(Object.keys(socket.rooms).map(rid => {
    if (rid === socket.id) {
      return null;
    }
    let roomId;
    return RoomDB.findById(rid)
      .then(r => {
        r.numUsers -= 1;
        r.save();
        roomId = r.roomId;
      })
      .then(() => {
        return socket.to(rid).emit(k.EXIT_ROOM, {
          userId: socket.id,
          roomId,
          bubbleId: socket.bubbleId,
        });
      });
  }));
};

const onViewRoom = ensureRoomExists(socket => data => {
  io.in(data.room.roomId).clients((error, clients) => {
    if (error) throw error;
    socket.emit(k.VIEW_ROOM, {
      ...roomToJSON(data.room),
      messages: filterMessagesLimitX(data.room.messages),
      participants: clients,
    });
  });
});

const onSetUserName = socket => data => {
  const { newName } = data;

  if (!newName) {
    const message = 'newName not specified.';
    return emitAppError(socket, e.NO_NAME, message);
  }

  if (!validateString(newName)) {
    const message = 'Invalid newName.';
    return emitAppError(socket, e.INVALID_NEW_NAME, message);
  }

  socket.userName = newName;

  // emit name change to all rooms that user is in
  Object.keys(socket.rooms)
    .filter(socketId => socketId !== socket.id) // except the socket's own room
    .forEach(roomId => {
      socket.to(roomId).emit(k.SET_USER_NAME, {
        userId: socket.id,
        newName,
        bubbleId: socket.bubbleId,
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

function onMyRooms(socket) {
  function onMyRoomsData() {
    socket.emit(
      k.MY_ROOMS,
      Object.keys(socket.rooms).filter(s => s !== socket.id));
  }
  return onMyRoomsData;
}

function onRegisterPush(socket) {
  function onRegisterPushData(data) {
    if (!data.pushToken) {
      const message = 'Push token is invalid.';
      emitAppError(socket, e.INVALID_PUSH_TOKEN, message);
    }

    pushManager.addSocketToPushToken(socket.id, data.pushToken);
    logger.info('%s registered push', socket.id, { event: k.REGISTER_PUSH });
    socket.emit(k.REGISTER_PUSH, {});
  }
  return onRegisterPushData;
}

function pushNotification(roomId, title = '', body = '') {
  pushManager.sendEventForRoom(roomId, title, body)
    .then(responses => {
      if (responses && responses.length && responses.length > 0) {
        logger.info('Pushed to %s', responses, { event: 'push'});
      }})
    .catch(err => logger.error(err));
}

const TokenToId = {};
const BubbleToSockets = {};

function onMyId(socket) {
  function onMyId() {
    socket.emit(k.MY_ID, socket.bubbleId);
  }
  return onMyId;
}

io.on(k.CONNECTION, function(socket) {
  logger.info('%s connects', socket.id, { event: k.CONNECTION });

  // try to get a token in query
  const bubbleToken = socket.request._query.bubble;

  let bubbleId = uuid.v4();

  if (bubbleToken) {
    if (TokenToId[bubbleToken]) {
      bubbleId = TokenToId[bubbleToken];
    } else {
      TokenToId[bubbleToken] = bubbleId;
    }
  }
  BubbleToSockets[bubbleId] = BubbleToSockets[bubbleId] || [];
  BubbleToSockets[bubbleId].push(socket.id);

  socket.bubbleId = bubbleId;
  // tell socket what bubbleId it has
  socket.emit(k.MY_ID, socket.bubbleId);

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
  socket.on(k.MY_ROOMS, onMyRooms(socket));
  socket.on(k.REGISTER_PUSH, onRegisterPush(socket));
  socket.on(k.MY_ID, onMyId(socket));
});

export {
  io,
  server,
};
