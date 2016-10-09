import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  ROOM_KEYS,
  createRoom,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    // important that this happens only once during initialization
    client.once(k.CREATE_ROOM, function(room) {
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

    it('should not return rooms that are private (counseller)');
  });
});
