import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import * as e from '../src/error_code';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  clientShouldReceiveAppError,
  createRoom,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  /* All tests here will have a room created */
  let client;
  let client2;
  /* store the created roomId so tests can join this room */
  let roomId;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client2 = makeClient(io);
    // important that this happens only once during initialization
    client.once(k.CREATE_ROOM, function(room) {
      roomId = room.roomId;
      done();
    });
    createRoom(client);
  });

  afterEach(function(done) {
    client.disconnect();
    client2.disconnect();
    server.close();
    done();
  });

  describe(k.CLAIM_ID, function() {
    it('should return error when oldSocketId is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_OLD_SOCKET_ID, done);
      client.emit(k.CLAIM_ID, { /* oldSocketId is not specified */ });
    });

    it('should return error when oldSocketId is not found', function(done) {
      clientShouldReceiveAppError(client, e.OLD_SOCKET_ID_NOT_FOUND, done);
      client.emit(k.CLAIM_ID, { oldSocketId: '123' });
    });

    it('should make the new socket join the room old socket was in', function(done) {
      const oldSocketId = client.id;
      const newClient = makeClient(io);

      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client.disconnect();
      });

      client2.on(k.EXIT_ROOM, data => {
        if (data.userId === oldSocketId) {
          newClient.emit(k.CLAIM_ID, { oldSocketId });
        }
      });

      newClient.on(k.CLAIM_ID, () => {
        client2.emit(k.ADD_MESSAGE, { roomId, message: 'hi' });
      });

      newClient.on(k.ADD_MESSAGE, data => {
        data.userId.should.equal(client2.id);
        newClient.disconnect();
        done();
      });
    });
  });

  describe('set_user_name', function() {
    it('should return error when newName is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_NAME, done);
      client.emit(k.SET_USER_NAME, { /* newName not specified */ });
    });

    it('should return error when newName is invalid', function(done) {
      const newName = {not: 'a string'};
      clientShouldReceiveAppError(client, e.INVALID_NEW_NAME, done);
      client.emit(k.SET_USER_NAME, { newName });
    });

    it('should emit set_user_name event to all users in room', function(done) {
      const newName = 'client 2 name';
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.SET_USER_NAME, { newName });
      });
      client.on(k.SET_USER_NAME, data => {
        data.should.have.keys('userId', 'newName');
        data.userId.should.equal(client2.id);
        data.newName.should.equal(newName);
        done();
      });
    });
  });
});
