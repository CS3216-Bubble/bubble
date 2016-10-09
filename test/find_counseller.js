import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import ROOM_TYPE from '../src/models/room_type';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  clientShouldNotReceiveEvent,
  clientShouldReceiveAppError,
  makeClient,
  uuid4Regex,
} from './helpers';

const counsellerId = '123';
const counsellerName = 'CC';

describe('API', function() {
  this.timeout(3000);
  /* All tests here will have a room created */
  let client;
  let counseller;
  /* store the created roomId so tests can join this room */

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    counseller = makeClient(io);
    done();
  });

  afterEach(function(done) {
    client.disconnect();
    counseller.disconnect();
    server.close();
    done();
  });

  describe('find_counseller', function() {
    it('should return error if no counseller is available', function(done) {
      clientShouldNotReceiveEvent(client, k.FIND_COUNSELLER);
      clientShouldReceiveAppError(client, e.COUNSELLER_UNAVAILABLE, done);
      client.emit(k.FIND_COUNSELLER);
    });

    describe('with counseller online', function() {
      beforeEach(function(done) {
        // counseller comes online
        counseller.emit(k.COUNSELLER_ONLINE, {
          counsellerId,
          counsellerName,
        });
        counseller.on(k.COUNSELLER_ONLINE, () => done());
      });

      it.only('should create a chat room with counseller', function(done) {
        client.on(k.FIND_COUNSELLER, data => {
          data.should.have.keys(
            'counsellerId', 'counsellerName', 'roomId', 'roomType', 'userLimit');
          data.roomId.should.match(uuid4Regex);
          data.roomType.should.equal(ROOM_TYPE.PRIVATE, 'room type should be private');
          data.userLimit.should.equal(2, 'room can only have 2 users');
          data.counsellerId.should.equal(counsellerId);
          data.counsellerName.should.equal(counsellerName);
          done();
        });

        client.emit(k.FIND_COUNSELLER);
      });

      it('if client sends message, counseller gets it', function(done) {
        let roomId;

        client.on(k.FIND_COUNSELLER, data => {
          roomId = data.roomId;
          client.emit(k.ADD_MESSAGE, {
            roomId,
            message: 'Hello',
          });
        });

        counseller.on(k.ADD_MESSAGE, data => {
          data.should.have.keys('userId', 'message');
          data.userId.should.equal(client.id);
          data.message.should.equal('Hello');
          done();
        });

        client.on(k.APP_ERROR, data => {
          should.fail(`should not have error ${data.message}`);
        });

        client.emit(k.FIND_COUNSELLER);
      });
    });
  });
});
