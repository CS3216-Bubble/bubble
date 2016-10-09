import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should';

import * as e from '../src/error_code';
import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  ROOM_KEYS,
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  createRoom,
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
    server.close();
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
      done => errorWithoutRoomId(client, k.JOIN_ROOM, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.JOIN_ROOM, done));

    it('should return error when room limit is reached', function(done) {
      // the default room has a user limit of 3
      client2 = makeClient(io);
      client3 = makeClient(io);
      clientShouldNotReceiveEvent(client2, k.JOIN_ROOM);
      clientShouldReceiveAppError(client3, e.ROOM_FULL, done);
      client2.emit(k.JOIN_ROOM, { roomId: roomId });
      client3.emit(k.JOIN_ROOM, { roomId: roomId });
    });

    it('should return error when user is already in another room');
    it('should return error if user is already in room', function(done) {
      clientShouldNotReceiveEvent(client, k.JOIN_ROOM);
      clientShouldReceiveAppError(client, e.USER_ALREADY_IN_ROOM, done);
      client.emit(k.JOIN_ROOM, { roomId });
    });

    it('should emit JOIN_ROOM event to other users in room', function(done) {
      client2 = makeClient(io);
      client.on(k.JOIN_ROOM, function(data) {
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
      done => errorWithoutRoomId(client, k.EXIT_ROOM, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.EXIT_ROOM, done));

    it('should return error if user is not in room', function(done) {
      client2 = makeClient(io);
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      clientShouldNotReceiveEvent(client, k.EXIT_ROOM);
      client2.emit(k.EXIT_ROOM, { roomId });
    });

    it('should emit EXIT_ROOM event to users in a room', function(done) {
      client2 = makeClient(io);
      client.on(k.EXIT_ROOM, data => {
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
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.VIEW_ROOM, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.VIEW_ROOM, done));

    it('should return room details', function(done) {
      client.on(k.VIEW_ROOM, data => {
        data.should.have.keys(...ROOM_KEYS);
        done();
      });
      client.emit(k.VIEW_ROOM, { roomId });
    });
  });

  describe('list_rooms', function() {
    it('should return a list of all rooms', function(done) {
      client.emit(k.LIST_ROOMS);
      client.on(k.LIST_ROOMS, data => {
        data.should.be.Array();
        data.length.should.equal(1);
        data[0].should.have.keys(...ROOM_KEYS);
        done();
      });
    });

    it('should return a list of rooms ordered by last activity', function(done) {
      // first create another room that has a newer lastActive
      createRoom(client);
      client.emit(k.LIST_ROOMS);
      client.on(k.LIST_ROOMS, data => {
        data.should.be.Array();
        data.length.should.equal(2);
        data[0].lastActive.should.be.below(data[1].lastActive);
        done();
      });
    });
  });

  describe('typing', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.TYPING, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.TYPING, done));

    it('should return error if user is not in room', function(done) {
      client2 = makeClient(io);
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      clientShouldNotReceiveEvent(client, k.TYPING);
      client2.emit(k.TYPING, { roomId });
    });

    it('should emit typing event to all other users in a room', function(done) {
      client2 = makeClient(io);
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
      done => errorWithoutRoomId(client, k.STOP_TYPING, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.STOP_TYPING, done));

    it('should return error if user is not in room', function(done) {
      client2 = makeClient(io);
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      clientShouldNotReceiveEvent(client, k.STOP_TYPING);
      client2.emit(k.STOP_TYPING, { roomId });
    });

    it('should emit stop_typing event to all other users in a room', function(done) {
      client2 = makeClient(io);
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
      done => errorWithoutRoomId(client, k.ADD_MESSAGE, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.ADD_MESSAGE, done));

    it('should return error when message is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_MESSAGE, done);
      client.emit(k.ADD_MESSAGE, {
        roomId,
        /* message not specified */
      });
    });

    it('should return error when user is not in room', function(done) {
      client2 = makeClient(io);
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      client2.emit(k.ADD_MESSAGE, {
        roomId,
        message: 'Hello',
      });
    });

    it('should emit add_message event to all users in a room', function(done) {
      client2 = makeClient(io);
      client2.emit(k.JOIN_ROOM, { roomId });
      client2.emit(k.ADD_MESSAGE, {
        roomId,
        message: 'Hello',
      });
      client.on(k.ADD_MESSAGE, data => {
        data.should.have.keys('userId', 'message');
        data.userId.should.equal(client2.id);
        data.message.should.equal('Hello');
        done();
      });
    });

    it('should not send message to other rooms', function(done) {
      // make another room with just client2
      let room2Id;
      client2 = makeClient(io);
      client2.once(k.CREATE_ROOM, function(room) {
        room2Id = room.roomId;
        // ensure that the rooms are unique
        room2Id.should.not.equal(roomId);
      });
      createRoom(client2);
      // no messages will be sent to client2 because it is in another room
      clientShouldNotReceiveEvent(client2, k.ADD_MESSAGE);

      // client3 joins the room client created
      client3 = makeClient(io);
      // so a message client3 sends should not go to client2
      client3.emit(k.JOIN_ROOM, { roomId });
      client3.emit(k.ADD_MESSAGE, {
        roomId,
        message: 'Hello',
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
      client.emit(k.ADD_MESSAGE, {
        roomId,
        message: 'Hello',
      });
      client.emit(k.VIEW_ROOM, { roomId });
    });
  });

  describe('add_reaction', function() {
    it('should return error when room id is not specified');
    it('should return error when message is not specified');
    it('should emit add_reaction event to all other users in a room');
  });

  describe('disconnect', function() {
    it('should emit EXIT_ROOM to other users in room', function(done) {
      client2 = makeClient(io);

      client.on(k.EXIT_ROOM, data => {
        done();
      });

      client.on(k.JOIN_ROOM, data => {
        data.should.have.keys('userId');
        data.userId.should.equal(client2.id);
        client2.disconnect();
      });

      client2.emit(k.JOIN_ROOM, { roomId });
    });
  });

  describe('set_user_name', function() {
    it('should return error when newName is not specified', function(done) {
      clientShouldReceiveAppError(client, 9, done);
      client.emit(k.SET_USER_NAME, { /* roomName not specified */ });
    });

    it('should emit set_user_name event to all users in room', function(done) {
      const newName = 'client 2 name';
      client2 = makeClient(io);
      client2.emit(k.JOIN_ROOM, { roomId });
      client2.emit(k.SET_USER_NAME, { newName });
      client.on(k.SET_USER_NAME, data => {
        data.should.have.keys('userId', 'newName');
        data.userId.should.equal(client2.id);
        data.newName.should.equal(newName);
        done();
      });
    });
  });
});
