import should from 'should';
import uuid from 'uuid';

import * as k from '../src/constants';
import * as e from '../src/error_code';

const ROOM_NOT_FOUND = uuid.v4(); // hopefully this never collides...
const INVALID_ROOM_ID = 'invalidroomid';
const ROOM_KEYS = [
  'roomId',
  'roomName',
  'userLimit',
  'roomDescription',
  'categories',
  'numUsers',
  'lastActive',
  'createdBy',
  'isOpen',
];
const MESSAGE_KEYS = [
  'userId',
  'roomRoomId',
  'content',
  'messageType',
];
const REACTION_KEYS = [
  'userId',
  'roomRoomId',
  'content',
  'messageType',
  'targetUser',
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
 * Verifies that a specific error is emitted when an
 * invalid roomId is sent in a request that needs a roomId.
 *
 * @param {object} client socket.io client
 * @param {string} event event to emit that will trigger error
 * @param {function} done mocha done callback
 */
function errorInvalidRoomId(client, event, done) {
  clientShouldReceiveAppError(client, e.INVALID_ROOM_ID, done);
  clientShouldNotReceiveEvent(client, event);
  client.emit(event, { roomId: INVALID_ROOM_ID });
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
  client.emit(event, { roomId: ROOM_NOT_FOUND });
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
 * @param {object} io socket.io
 * @return {object} socket.io client
 */
function makeClient(io) {
  return io.connect("http://localhost:3000", {
    transports: ['websocket'],
  });
}

const uuid4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tests that str is a UUID4
 * @param {string} str a string to test
 * @return {bool} if str is a UUID4
 */
function matchUuid4(str) {
  return str && uuid4Regex.test(str);
}

export {
  MESSAGE_KEYS,
  REACTION_KEYS,
  ROOM_KEYS,
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  createRoom,
  errorInvalidRoomId,
  errorRoomIdNotFound,
  errorWithoutRoomId,
  makeClient,
  matchUuid4,
  uuid4Regex,
};
