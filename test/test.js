var assert = require('assert');
var describe = require('mocha').describe;
var it = require('mocha').it;

// dummy test, should remove!
describe('Array', function() {
  describe('#indexOf()', function() {
    it('should return -1 when the value is not present', function() {
      assert.equal(-1, [1, 2, 3].indexOf(4));
    });
  });
});

describe('API', function() {
  describe('create_room', function() {
    it('should return error when room name is not specified');
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
