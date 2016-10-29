import process from 'process';
import FCM from 'fcm-push';

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
      this.pusher = fcmPusher();
    } else {
      this.pusher = consoleLogPusher();
    }
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
