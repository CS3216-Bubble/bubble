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
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client.on('connect', () => done());
  });

  afterEach(function(done) {
    client.disconnect();
    server.close();
    done();
  });

  describe('create_room', function() {
    it('should return error when room name is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_ROOM_NAME, done);
      clientShouldNotReceiveEvent(client, k.CREATE_ROOM);
      client.emit(k.CREATE_ROOM, { /* roomName not specified */ });
    });

    it('should default limit of room to 7');

    it('should return room information', function(done) {
      client.on(k.CREATE_ROOM, function(room) {
        room.should.have.keys(...ROOM_KEYS);
        done();
      });
      createRoom(client);
    });
  });
});