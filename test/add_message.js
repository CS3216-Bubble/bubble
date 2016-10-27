import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import MESSAGE_TYPE from '../src/models/message_type';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  MESSAGE_KEYS,
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  createRoom,
  errorInvalidRoomId,
  errorRoomIdNotFound,
  errorWithoutRoomId,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  /* All tests here will have a room created */
  let client;
  let client2;
  let client3;
  /* store the created roomId so tests can join this room */
  let createdRoom;
  let roomId;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client2 = makeClient(io);
    client3 = makeClient(io);
    // important that this happens only once during initialization
    client.once(k.CREATE_ROOM, function(room) {
      createdRoom = room;
      roomId = createdRoom.roomId;
      done();
    });
    /* All tests below require a room, create it here */
    createRoom(client);
  });

  afterEach(function(done) {
    client.disconnect();
    client2.disconnect();
    client3.disconnect();
    server.close();
    done();
  });

  describe('add_message', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.ADD_MESSAGE, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.ADD_MESSAGE, done));

    it('should return error when room id is invalid',
      done => errorInvalidRoomId(client, k.ADD_MESSAGE, done));

    it('should return error when message is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_MESSAGE, done);
      client.emit(k.ADD_MESSAGE, {
        roomId,
        /* message not specified */
      });
    });

    it('should return error when message is too long', function(done) {
      clientShouldReceiveAppError(client, e.INVALID_MESSAGE, done);
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client.emit(k.ADD_MESSAGE, {
          roomId,
          message: Array(10000).join('a'),
        });
      });
    });

    it('should return error when user is not in room', function(done) {
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      client2.emit(k.ADD_MESSAGE, {
        roomId,
        message: 'Hello',
      });
    });

    it('should emit add_message event to all users in a room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
      });
      client.on(k.ADD_MESSAGE, data => {
        data.should.have.keys(...MESSAGE_KEYS);
        data.userId.should.equal(client2.id);
        data.roomRoomId.should.equal(roomId);
        data.content.should.equal('Hello');
        done();
      });
    });

    it('should emit add_message event to user who sent message', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
      });
      client2.on(k.ADD_MESSAGE, data => {
        data.should.have.keys(...MESSAGE_KEYS);
        data.userId.should.equal(client2.id);
        data.sentByMe.should.equal(true);
        done();
      });
    });

    it('should not send message to other rooms', function(done) {
      // make another room with just client2
      let room2Id;
      client2.once(k.CREATE_ROOM, function(room) {
        room2Id = room.roomId;
        // ensure that the rooms are unique
        room2Id.should.not.equal(roomId);
      });
      createRoom(client2);
      // no messages will be sent to client2 because it is in another room
      clientShouldNotReceiveEvent(client2, k.ADD_MESSAGE);

      // client3 joins the room client created
      // so a message client3 sends should not go to client2
      client3.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client3.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
      });
      client.on(k.ADD_MESSAGE, data => {
        data.userId.should.equal(client3.id);
        done();
      });
    });

    it('should update the room lastActive', function(done) {
      let originalLastActive = createdRoom.lastActive;
      client.on(k.VIEW_ROOM, room => {
        room.lastActive.should.not.equal(originalLastActive);
        done();
      });
      client.on(k.JOIN_ROOM, () => {
        client.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
      });
      client2.on(k.ADD_MESSAGE, () => client.emit(k.VIEW_ROOM, { roomId }));
      client2.emit(k.JOIN_ROOM, { roomId });
    });

    it('should update messages in room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_MESSAGE, {
          roomId,
          message: 'Hello',
        });
      });

      client.on(k.ADD_MESSAGE, () => {
        client.emit(k.VIEW_ROOM, { roomId });
      });
      client.on(k.VIEW_ROOM, room => {
        room.messages.should.have.length(1);
        const message = room.messages[0];
        message.should.have.keys(
          'userId', 'content', 'createdAt', 'messageType');
        message.userId.should.equal(client2.id);
        message.messageType.should.equal(MESSAGE_TYPE.MESSAGE);
        message.content.should.equal('Hello');
        done();
      });
    });
  });
});
