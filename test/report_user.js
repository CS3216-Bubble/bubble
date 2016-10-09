import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
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

  describe('report_user', function() {
    it('should return error when room id is not specified',
      done => errorWithoutRoomId(client, k.ADD_MESSAGE, done));

    it('should return error when room id cannot be found',
      done => errorRoomIdNotFound(client, k.ADD_MESSAGE, done));

    it('should return error when user to report is not specified', function(done) {
      clientShouldReceiveAppError(client, e.NO_USER_TO_REPORT, done);
      client.emit(k.REPORT_USER, {
        roomId,
        /* userToReport not specified */
      });
    });

    it('should return error when user to report is not in room', function(done) {
      clientShouldReceiveAppError(client, e.NO_USER_TO_REPORT, done);
      client.emit(k.REPORT_USER, {
        roomId,
        userToReport: 'usernotinroom',
      });
    });

    // should we allow empty reasons?
    it('should return error when reason is not specified');

    it('should emit report_user event to all other users in a room', function(done) {
      client2.emit(k.JOIN_ROOM, { roomId });
      client.on(k.JOIN_ROOM, data => {
        client.emit(k.REPORT_USER, {
          roomId,
          userToReport: data.userId,
          reason: 'no reason',
        });
      });

      // let the reported user know that he has been reported
      client2.on(k.REPORT_USER, data => {
        data.roomId.should.equal(roomId);
        data.reportedUserId.should.equal(client2.id);
        data.reason.should.equal('no reason');
        done();
      });
    });
  });
});
