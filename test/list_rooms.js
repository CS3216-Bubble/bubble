import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import ROOM_TYPE from '../src/models/room_type';
import { createHotRoom, createInactiveRoom } from './database_helpers';
import {
  ROOM_KEYS,
  createRoom,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;
  let client2;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client2 = makeClient(io);
    // important that this happens only once during initialization
    client.once(k.CREATE_ROOM, () => {
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
      client2.on(k.CREATE_ROOM, () => {
        client.emit(k.LIST_ROOMS);
      });
      client.on(k.LIST_ROOMS, data => {
        data.should.be.Array();
        data.length.should.equal(2);
        data[0].lastActive.should.be.below(data[1].lastActive);
        done();
      });
      createRoom(client2);
    });

    it('should return list with HOT rooms first', function(done) {
      createRoom(client);

      client.once(k.CREATE_ROOM, () => {
        createHotRoom(client.id)
          .then(() => {
            client.emit(k.LIST_ROOMS);
          });
      });

      client.on(k.LIST_ROOMS, data => {
        data.length.should.equal(3);
        data[0].roomType.should.equal(ROOM_TYPE.HOT);
        done();
      });
    });

    it('should not return inactive rooms (lastActive > 3 days)', function(done) {
      createInactiveRoom(client2.id)
        .then(() => {
          client.emit(k.LIST_ROOMS);
        });
      client.on(k.LIST_ROOMS, data => {
        data.should.be.Array();
        data.length.should.equal(1);
        done();
      });
    });

    it('should return HOT room even if it is inactive (lastActive > 3 days)', function(done) {
      createInactiveRoom(client2.id, ROOM_TYPE.HOT)
        .then(() => {
          client.emit(k.LIST_ROOMS);
        });
      client.on(k.LIST_ROOMS, data => {
        data.should.be.Array();
        data.length.should.equal(2);
        data[0].roomType.should.equal(ROOM_TYPE.HOT);
        done();
      });
    });

    it('should not return rooms that are private (counseller)');
  });
});
