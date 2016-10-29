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

  describe('my_rooms', function() {
    it('should return rooms I am in except my socket id', function(done) {
      client.emit(k.MY_ROOMS);
      client.on(k.MY_ROOMS, data => {
        data.should.have.length(1);
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

  describe('registerPush', function() {
    it('should register push', function(done) {
      client.emit(k.REGISTER_PUSH, { pushToken: '123'});
      client.on(k.REGISTER_PUSH, () => done());
    });

    it('send a push when client is disconnected', function(done) {
      client.emit(k.REGISTER_PUSH, { pushToken: '123'});
      client.on(k.REGISTER_PUSH, () => done());
    });
  });

  describe('set_claim_token', function() {
    it('should set claim token', function(done) {
      client.emit(k.SET_CLAIM_TOKEN, { claimToken: '123'});
      client.on(k.SET_CLAIM_TOKEN, () => done());
    });

    it('return error if claimToken is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_CLAIM_TOKEN, done);
      client.emit(k.SET_CLAIM_TOKEN, { /* claimToken not specified */ });
    });

    it('return error if claimToken is not specified', function(done) {
      clientShouldReceiveAppError(client, e.INVALID_CLAIM_TOKEN, done);
      client.emit(k.SET_CLAIM_TOKEN, { claimToken: ['invalid'] });
    });
  });
});
