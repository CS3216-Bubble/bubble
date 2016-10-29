import process from 'process';
import FCM from 'fcm-push';

import logger from './logging';

function fcmPusher() {
  return new FCM(process.env.FCM_SERVER_KEY);
}

function consoleLogPusher() {
  return {
    send: function(args) {
      console.log('[Console log pusher]', JSON.stringify(args));
      return Promise.resolve('Success');
    }
  };
}

class Push {
  constructor() {
    if (process.env.NODE_ENV === 'prod' && process.env.FCM_SERVER_KEY) {
      logger.info('Set up firebase fcm', { event: 'push' });
      this.pusher = fcmPusher();
    } else {
      logger.info('Set up console fcm', { event: 'push' });
      this.pusher = consoleLogPusher();
    }
    this.socketsToPushToken = {};
    this.subscriptions = {};
  }

  addSocketToPushToken(socketId, pushToken) {
    this.socketsToPushToken[socketId] = pushToken;
  }

  subscribeSocketToRoomEvents(socketId, roomId) {
    this.subscriptions[roomId] = this.subscriptions[roomId] || [];
    this.subscriptions[roomId].push(socketId);
  }

  unsubscribeSocketToRoomEvents(socketId, roomId) {
    this.subscriptions[roomId] = this.subscriptions[roomId] || [];
    this.subscriptions[roomId] = this.subscriptions[roomId].filter(
      sid => sid !== socketId);
  }

  sendEventForRoom(roomId, title = '', body = '') {
    const subs = this.subscriptions[roomId];

    if (!subs) {
      return Promise.resolve();
    }

    return Promise.all(
      subs
      .filter(sid => {
        if (typeof this.socketsToPushToken[sid] === 'string') {
          logger.info('Will push to %s', sid, { event: 'push' });
          return true;
        }

        logger.info('Skip %s because no token', sid, { event: 'no_push' });
        return false;
      })
      .map(sid => this.pushTo(this.socketsToPushToken[sid], title, body)));
  }

  pushTo(target, title = '', body = '') {
    return this.pusher.send({
      to: target,
      collapse_key: 'com.bubble', // eslint-disable-line camelcase
      notification: {
        title: title,
        body: body,
      },
    });
  }
}

export default Push;
