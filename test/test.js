import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { SocketDB } from '../src/database';
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

  describe('connect', function() {
    it('should have 2 clients connected', function(done) {
      SocketDB.findAll({
        where: {
          connected: true,
        },
      }).then((sockets) => {
        sockets.length.should.equal(2);
        done();
      });
    });
  })

  describe('set_user_name', function() {
    it('should return error when newName is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_NAME, done);
      client.emit(k.SET_USER_NAME, { /* roomName not specified */ });
    });

    it('should emit set_user_name event to all users in room', function(done) {
      const newName = 'client 2 name';
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, data => {
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
