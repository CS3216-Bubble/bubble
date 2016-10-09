import should from 'should';

import * as k from '../src/constants';
import * as e from '../src/error_code';

const INVALID_ROOM_ID = 'invalidroomid';
const ROOM_KEYS = [
  'roomId', 'roomName', 'userLimit', 'roomDescription',
  'categories', 'numberOfUsers', 'lastActive',
];


/**
 * Ensures that client does not received specified event.
 * @param {object} client socket.io client
 * @param {string} event event that client should not receive
 */
function clientShouldNotReceiveEvent(client, event) {
  client.on(
    event,
    () => should.fail(`${event} should not be emitted`));
}

/**
 * Ensures that client receives an APP_ERROR event with an error code.
 * @param {object} client socket.io client
 * @param {int} errorCode expected error code
 * @param {function} done mocha done callback
 */
function clientShouldReceiveAppError(client, errorCode, done) {
  client.on(k.APP_ERROR, function(data) {
    data.should.have.keys('code', 'message');
    data.code.should.equal(errorCode);
    done();
  });
}

/**
 * Verifies that a specific error is emitted when a roomId
 * specified in a request is invalid or cannot be found
 *
 * @param {object} client socket.io client
 * @param {string} event event to emit that will trigger error
 * @param {function} done mocha done callback
 */
function errorRoomIdNotFound(client, event, done) {
  clientShouldReceiveAppError(client, e.ROOM_ID_NOT_FOUND, done);
  clientShouldNotReceiveEvent(client, event);
  client.emit(event, { roomId: INVALID_ROOM_ID });
}

/**
 * Verifies that a specific error is emitted when a request
 * is made without specifying roomId.
 *
 * @param {object} client socket.io client
 * @param {string} event event to emit that will trigger error
 * @param {function} done mocha done callback
 */
function errorWithoutRoomId(client, event, done) {
  clientShouldReceiveAppError(client, e.NO_ROOM_ID, done);
  clientShouldNotReceiveEvent(client, event);
  client.emit(event, { /* roomId not specified */ });
}

/**
 * Creates a room that client will be an owner of.
 * @param {object} client socket.io client
 * @param {object} opts options to override default room creation params
 */
function createRoom(client, opts = {}) {
  const defaults = {
    roomName: 'this is my room',
    roomDescription: 'my room description',
    userLimit: 2, // optional, defaults to 7
    categories: ['cat1'],
  };
  client.emit(k.CREATE_ROOM, {
    ...defaults,
    ...opts
  });
}

/**
 * Creates a socket.io client on default host and port
 * @return {object} socket.io client
 */
function makeClient(io) {
  return io.connect("http://localhost:3000", {
    transports: ['websocket'],
  });
}

export {
  ROOM_KEYS,
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  createRoom,
  errorRoomIdNotFound,
  errorWithoutRoomId,
  makeClient,
};
