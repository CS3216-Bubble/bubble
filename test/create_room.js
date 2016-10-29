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

    describe('should return error when categories are invalid', function() {
      beforeEach(function() {
        clientShouldNotReceiveEvent(client, k.CREATE_ROOM);
      });

      it('categories not an array', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_CATEGORIES, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'Room Name',
          categories: {category: 'Funny'},
        });
      });

      it('category not a string', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_CATEGORIES, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'Room Name',
          categories: [{category: 'Funny'}],
        });
      });

      it('not a category we support', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_CATEGORIES, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'Room Name',
          categories: ['INVALID'],
        });
      });
    });

    describe('should return error when user limit invalid', function() {
      beforeEach(function() {
        clientShouldNotReceiveEvent(client, k.CREATE_ROOM);
      });

      it('user limit is less than lower bound', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_USER_LIMIT, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'room name',
          userLimit: -1,
        });
      });

      it('user limit is higher than upper bound', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_USER_LIMIT, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'room name',
          userLimit: 10000,
        });
      });

      it('user limit is not a number', function(done) {
        clientShouldReceiveAppError(client, e.INVALID_USER_LIMIT, done);
        client.emit(k.CREATE_ROOM, {
          roomName: 'room name',
          userLimit: 'invalid',
        });
      });
    });

    it('should default limit of room to 7');

    it('should be able to create a room with no categories ', function(done) {
      client.on(k.CREATE_ROOM, function() {
        done();
      });
      client.emit(k.CREATE_ROOM, {
        roomName: 'Room Name',
        categories: [],
      });
    });

    it('should return room information', function(done) {
      client.on(k.CREATE_ROOM, function(room) {
        room.should.have.keys(...ROOM_KEYS);
        room.createdBy.should.equal(client.id);
        room.isOpen.should.equal(true);
        done();
      });
      createRoom(client);
    });
  });
});
