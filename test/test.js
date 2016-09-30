import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import 'should';

describe('API', function() {
  let server;
  let options = {
    'transports': ['websocket'],
    'force new connection': true,
  };

  beforeEach(function(done) {
    // require and runs the server before each test
    server = require('../').server;
    done();
  });

  afterEach(function(done) {
    // close the server connection after each test
    server.close();
    done();
  });

  describe('create_room', function() {
    it('should return error when room name is not specified', function(done) {
      const client = io.connect("http://localhost:3000", options);
      client.on('bubble_error', function(data) {
        data.should.have.keys('code', 'message');
        client.disconnect();
        done();
      });
      client.on('room_created', function(data) {
        throw Error('should not reach');
      });
      client.emit('create_room', {
        // roomName not specified
      });
    });

    it('should default limit of room to 10');
    it('should return a room_id');
    it('should create a new room');
  });

  describe('join_room', function() {
    it('should return error when room id is not specified');
    it('should return error when room limit is reached');
    it('should return error when user is already in another room');
    it('should emit room_joined event to all other users in a room');
    it('should update room with new member');
  });

  describe('exit_room', function() {
    it('should return error when room id is not specified');
    it('should emit room_exited event to all other users in a room');
    it('should update room member list');
  });

  describe('view_room', function() {
    it('TODO');
  });

  describe('typing', function() {
    it('should return error when room id is not specified');
    it('should emit typing event to all other users in a room');
  });

  describe('stop_typing', function() {
    it('should return error when room id is not specified');
    it('should emit stop_typing event to all other users in a room');
  });

  describe('report_user', function() {
    it('should return error when room id is not specified');
    it('should return error when user to report is not specified');
    it('should return error when reason is not specified');
    // TODO it('should emit user_reported event to all other users in a room');
  });

  describe('add_message', function() {
    it('should return error when room id is not specified');
    it('should return error when message is not specified');
    it('should emit add_message event to all other users in a room');
  });

  describe('add_reaction', function() {
    it('should return error when room id is not specified');
    it('should return error when message is not specified');
    it('should emit add_reaction event to all other users in a room');
  });
});
