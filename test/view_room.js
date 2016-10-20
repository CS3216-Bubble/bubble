import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  ROOM_KEYS,
  createRoom,
  errorRoomIdNotFound,
  errorWithoutRoomId,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;
  let roomId;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
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
    server.close();
    done();
  });

  describe('view_room', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.VIEW_ROOM, done));

    it('should return error when room is private (counsellor)');

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.VIEW_ROOM, done));

    it('should return room details', function(done) {
      client.on(k.VIEW_ROOM, data => {
        data.should.have.keys(...ROOM_KEYS);
        done();
      });
      client.emit(k.VIEW_ROOM, { roomId });
    });

    it('should return categories as an array of categories', function(done) {
      client.on(k.VIEW_ROOM, data => {
        data.categories.should.have.length(1);
        done();
      });
      client.emit(k.VIEW_ROOM, { roomId });
    });
  });
});
