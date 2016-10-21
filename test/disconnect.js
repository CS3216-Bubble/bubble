import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  createRoom,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;
  let client2;
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

  describe('disconnect', function() {
    it('should emit EXIT_ROOM to other users in room', function(done) {
      client.on(k.EXIT_ROOM, () => {
        done();
      });

      client.on(k.JOIN_ROOM, data => {
        data.should.have.keys('userId');
        data.userId.should.equal(client2.id);
        client2.disconnect();
      });

      client2.emit(k.JOIN_ROOM, { roomId });
    });

    it('should emit update numUsers in room', function(done) {
      client.on(k.EXIT_ROOM, () => {
        client.emit(k.VIEW_ROOM, { roomId });
        done();
      });

      client.on(k.VIEW_ROOM, data => {
        data.numUsers.should.equal(1);
      });

      client.on(k.JOIN_ROOM, () => {
        client2.disconnect();
      });

      client2.emit(k.JOIN_ROOM, { roomId });
    });
  });
});
