import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import REACTION_TYPE from '../src/models/reaction_type';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  REACTION_KEYS,
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

  describe('add_reaction', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.ADD_REACTION, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.ADD_REACTION, done));

    it('should return error when reaction is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_REACTION, done);
      client.emit(k.ADD_REACTION, {
        roomId,
        /* reaction not specified */
      });
    });

    it('should return error when targetUser is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_TARGET_USER, done);
      client.emit(k.ADD_REACTION, {
        roomId,
        reaction: REACTION_TYPE.THANK,
        /* targetUser not specified */
      });
    });

    it('should emit add_reaction event to all users in a room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_REACTION, {
          roomId,
          reaction: REACTION_TYPE.THANK,
          targetUser: client.id,
        });
      });
      client.on(k.ADD_REACTION, data => {
        data.should.have.keys(...REACTION_KEYS);
        data.userId.should.equal(client2.id);
        data.roomRoomId.should.equal(roomId);
        data.content.should.equal(REACTION_TYPE.THANK);
        data.targetUser.should.equal(client.id);
        done();
      });
    });

    it('should emit add_reaction event to user who sent reaction', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_REACTION, {
          roomId,
          reaction: REACTION_TYPE.THANK,
          targetUser: client.id,
        });
      });
      client2.on(k.ADD_REACTION, data => {
        data.should.have.keys(...REACTION_KEYS);
        data.userId.should.equal(client2.id);
        data.targetUser.should.equal(client.id);
        done();
      });
    });

    it('should not emit add_reaction event to users in other room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, () => {
        client2.emit(k.ADD_REACTION, {
          roomId,
          reaction: REACTION_TYPE.THANK,
          targetUser: client.id,
        });
      });
      clientShouldNotReceiveEvent(client3, k.ADD_REACTION);
      client.on(k.ADD_REACTION, () => done());
    });
  });
});
