import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  createRoom,
  errorRoomIdNotFound,
  errorWithoutRoomId,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
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
    /* All tests below require a room, create it here */
    createRoom(client);
  });

  afterEach(function(done) {
    client.disconnect();
    client2.disconnect();
    server.close();
    done();
  });

  describe('typing', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.TYPING, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.TYPING, done));

    it('should return error if user is not in room', function(done) {
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      clientShouldNotReceiveEvent(client, k.TYPING);
      client2.emit(k.TYPING, { roomId });
    });

    it('should emit typing event to all other users in a room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => client2.emit(k.TYPING, { roomId }));
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
      clientShouldReceiveAppError(client2, e.USER_NOT_IN_ROOM, done);
      clientShouldNotReceiveEvent(client, k.STOP_TYPING);
      client2.emit(k.STOP_TYPING, { roomId });
    });

    it('should emit stop_typing event to all other users in a room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => client2.emit(k.STOP_TYPING, { roomId }));
      client.on(k.STOP_TYPING, data => {
        data.should.have.keys('userId');
        data.userId.should.equal(client2.id);
        done();
      });
    });
  });
});
