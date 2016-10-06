import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should';

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars

const INVALID_ROOM_ID = 'invalidroomid';

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
function makeClient() {
  return io.connect("http://localhost:3000", {
    transports: ['websocket'],
  });
}

/**
 * Verifies that a specific error is emitted when a request
 * is made without specifying roomId.
 *
 * @param {object} client socket.io client
 * @param {string} eventToEmit event to emit that will trigger error
 * @param {string} shouldNot event that should not be emitted to client
 * @param {function} done mocha done callback
 */
function errorWithoutRoomId(client, eventToEmit, shouldNot, done) {
  clientShouldReceiveAppError(client, 2, done);
  clientShouldNotReceiveEvent(client, shouldNot);
  client.emit(eventToEmit, { /* roomId not specified */ });
}

/**
 * Verifies that a specific error is emitted when a roomId
 * specified in a request is invalid or cannot be found
 *
 * @param {object} client socket.io client
 * @param {string} eventToEmit event to emit that will trigger error
 * @param {string} shouldNot event that should not be emitted to client
 * @param {function} done mocha done callback
 */
function errorRoomIdNotFound(client, eventToEmit, shouldNot, done) {
  clientShouldReceiveAppError(client, 3, done);
  clientShouldNotReceiveEvent(client, shouldNot);
  client.emit(eventToEmit, { roomId: INVALID_ROOM_ID });
}

describe('API', function() {
  /* All tests here will have a room created */
  let client;
  /* store the created roomId so tests can join this room */
  let roomId;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient();
    client.on('connect', () => done());
  });

  afterEach(function(done) {
    client.disconnect();
    server.close();
    done();
  });

  describe('create_room', function() {
    it('should return error when room name is not specified', function(done) {
      clientShouldReceiveAppError(client, 1, done);
      clientShouldNotReceiveEvent(client, k.ROOM_CREATED);
      client.emit(k.CREATE_ROOM, { /* roomName not specified */ });
    });

    it('should default limit of room to 7');

    it('should return a room_id', function(done) {
      client.on(k.ROOM_CREATED, function(data) {
        data.should.have.keys('roomId');
        done();
      });
      createRoom(client);
    });
  });

  describe('given a room', function() {
    let client2;
    let client3;

    /* All tests below require a room, create it here */
    beforeEach(function(done) {
      // important that this happens only once during initialization
      client.once(k.ROOM_CREATED, function(data) {
        roomId = data.roomId;
        done();
      });
      createRoom(client);
    });

    afterEach(function(done) {
      if (client2) {
        client2.disconnect();
      }
      if (client3) {
        client3.disconnect();
      }
      done();
    });

    describe('join_room', function() {
      it('should return error when room id is not specified',
        done => errorWithoutRoomId(client, k.JOIN_ROOM, k.ROOM_JOINED, done));

      it('should return error when room id cannot be found',
        done => errorRoomIdNotFound(client, k.JOIN_ROOM, k.ROOM_JOINED, done));

      it('should return error when room limit is reached', function(done) {
        // the default room has a user limit of 3
        client2 = makeClient();
        client3 = makeClient();
        clientShouldNotReceiveEvent(client2, k.ROOM_JOINED);
        clientShouldReceiveAppError(client3, 4, done);
        client2.emit(k.JOIN_ROOM, { roomId: roomId });
        client3.emit(k.JOIN_ROOM, { roomId: roomId });
      });

      it('should return error when user is already in another room');

      it('should emit room_joined event to other users in room', function(done) {
        client2 = makeClient();
        client.on(k.ROOM_JOINED, function(data) {
          data.should.have.keys('userId');
          data.userId.should.equal(client2.id);
          done();
        });
        client2.emit(k.JOIN_ROOM, { roomId });
      });

      it('should update room with new member');
    });

    describe('exit_room', function() {
      it('should return error when room id is not specified',
        done => errorWithoutRoomId(client, k.EXIT_ROOM, k.ROOM_EXITED, done));

      it('should return error when room id cannot be found',
        done => errorRoomIdNotFound(client, k.EXIT_ROOM, k.ROOM_EXITED, done));

      it('should return error if user is not in room', function(done) {
        client2 = makeClient();
        clientShouldReceiveAppError(client2, 5, done);
        clientShouldNotReceiveEvent(client, k.ROOM_EXITED);
        client2.emit(k.EXIT_ROOM, { roomId });
      });

      it('should emit room_exited event to users in a room', function(done) {
        client2 = makeClient();
        client.on(k.ROOM_EXITED, data => {
          data.should.have.keys('userId');
          data.userId.should.equal(client2.id);
          done();
        });
        client2.emit(k.JOIN_ROOM, { roomId });
        client2.emit(k.EXIT_ROOM, { roomId });
      });

      it('should update room member list');
    });

    describe('view_room', function() {
      it('TODO');
    });

    describe('list_rooms', function() {
      it('should return a list of all rooms', function(done) {
        client.emit(k.LIST_ROOMS);
        client.on(k.LIST_ROOMS, data => {
          data.should.be.Array();
          data.length.should.equal(1);
          data[0].should.have.keys(
            'roomId', 'roomName', 'userLimit', 'roomDescription',
            'categories', 'numberOfUsers',
          );
          done();
        });
      });

      it('should return a list of rooms ordered by last activity');
    });

    describe('typing', function() {
      it('should return error when room id is not specified',
        done => errorWithoutRoomId(client, k.TYPING, k.TYPING, done));

      it('should return error when room id cannot be found',
        done => errorRoomIdNotFound(client, k.TYPING, k.TYPING, done));

      it('should return error if user is not in room', function(done) {
        client2 = makeClient();
        clientShouldReceiveAppError(client2, 5, done);
        clientShouldNotReceiveEvent(client, k.TYPING);
        client2.emit(k.TYPING, { roomId });
      });

      it('should emit typing event to all other users in a room', function(done) {
        client2 = makeClient();
        client2.emit(k.JOIN_ROOM, { roomId });
        client2.emit(k.TYPING, { roomId });
        client.on(k.TYPING, data => {
          data.should.have.keys('userId');
          data.userId.should.equal(client2.id);
          done();
        });
      });
    });

    describe('stop_typing', function() {
      it('should return error when room id is not specified',
        done => errorWithoutRoomId(client, k.STOP_TYPING, k.STOP_TYPING, done));

      it('should return error when room id cannot be found',
        done => errorRoomIdNotFound(client, k.STOP_TYPING, k.STOP_TYPING, done));

      it('should emit stop_typing event to all other users in a room', function(done) {
        client2 = makeClient();
        client2.emit(k.JOIN_ROOM, { roomId });
        client2.emit(k.STOP_TYPING, { roomId });
        client.on(k.STOP_TYPING, data => {
          data.should.have.keys('userId');
          data.userId.should.equal(client2.id);
          done();
        });
      });
    });

    describe('report_user', function() {
      it('should return error when room id is not specified');
      it('should return error when user to report is not specified');
      it('should return error when reason is not specified');
      // TODO it('should emit user_reported event to all other users in a room');
    });

    describe('add_message', function() {
      it('should return error when room id is not specified',
        done => errorWithoutRoomId(client, k.ADD_MESSAGE, k.ADD_MESSAGE, done));

      it('should return error when room id cannot be found',
        done => errorRoomIdNotFound(client, k.ADD_MESSAGE, k.ADD_MESSAGE, done));

      it('should return error when message is not specified', function(done) {
        clientShouldReceiveAppError(client, 6, done);
        client.emit(k.ADD_MESSAGE, {
          roomId,
          /* message not specified */
        });
      });

      it('should emit add_message event to all users in a room', function(done) {
        client2 = makeClient();
        client2.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
        client.on(k.ADD_MESSAGE, data => {
          data.should.have.keys('userId', 'message');
          data.userId.should.equal(client2.id);
          data.message.should.equal('Hello');
          client2.disconnect();
          done();
        });
      });
    });

    describe('add_reaction', function() {
      it('should return error when room id is not specified');
      it('should return error when message is not specified');
      it('should emit add_reaction event to all other users in a room');
    });

    describe('disconnect', function() {
      it('should emit room_exit to other users in room', function(done) {
        client2 = makeClient();

        client.on(k.ROOM_EXITED, data => {
          done();
        });

        client.on(k.ROOM_JOINED, data => {
          data.should.have.keys('userId');
          data.userId.should.equal(client2.id);
          client2.disconnect();
        });

        client2.emit(k.JOIN_ROOM, { roomId });
      });
    });
  });
});
