import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

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
  let client;
  let client2;
  let client3;
  let roomId;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client2 = makeClient(io);
    client3 = makeClient(io);
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
    client3.disconnect();
    server.close();
    done();
  });

  describe('join_room', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.JOIN_ROOM, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.JOIN_ROOM, done));

    it('should return error when room limit is reached', function(done) {
      // the default room has a user limit of 2
      clientShouldNotReceiveEvent(client3, k.JOIN_ROOM);
      clientShouldReceiveAppError(client3, e.ROOM_FULL, done);
      client2.emit(k.JOIN_ROOM, { roomId: roomId });
      client.on(k.JOIN_ROOM, () => {
        // after client sees that client2 has joined
        client3.emit(k.JOIN_ROOM, { roomId: roomId });
      });
    });

    it('should return error if trying to join a closed room');
    it('should return error when room is private (counsellor)');
    it('should return error when user is already in another room');
    it('should return error if user is already in room', function(done) {
      clientShouldNotReceiveEvent(client, k.JOIN_ROOM);
      clientShouldReceiveAppError(client, e.USER_ALREADY_IN_ROOM, done);
      client.emit(k.JOIN_ROOM, { roomId });
    });

    it('should emit JOIN_ROOM event to other users in room', function(done) {
      client.on(k.JOIN_ROOM, function(data) {
        data.should.have.keys('userId');
        data.userId.should.equal(client2.id);
        done();
      });
      client2.emit(k.JOIN_ROOM, { roomId });
    });

    it('should emit JOIN_ROOM event to user that just joined room', function(done) {
      client2.on(k.JOIN_ROOM, function(room) {
        room.should.have.keys(...ROOM_KEYS);
        room.should.have.keys('participants');
        room.participants.should.containEql(client.id);
        done();
      });
      client2.emit(k.JOIN_ROOM, { roomId });
    });

    it('should update room with new member');
    it('should show message history up to 24 hours', function(done) {
      client.emit(k.ADD_MESSAGE, {
        roomId,
        message: '1',
      })
      client.emit(k.ADD_MESSAGE, {
        roomId,
        message: '2',
      })
      client2.on(k.JOIN_ROOM, function(room) {
        room.should.have.keys('messages');
        room.messages.should.have.length(2);
        console.log(room.messages);
        done();
      });
      client2.emit(k.JOIN_ROOM, { roomId });
    });
  });
});
