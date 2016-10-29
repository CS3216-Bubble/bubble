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

const counsellorId = '123';
const counsellorName = 'CC';

describe.skip('API', function() {
  this.timeout(3000);
  let client;
  let counsellor;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    counsellor = makeClient(io);
    done();
  });

  afterEach(function(done) {
    client.disconnect();
    counsellor.disconnect();
    server.close();
    done();
  });

  describe('find_counsellor', function() {
    it('should return error if no counsellor is available', function(done) {
      clientShouldNotReceiveEvent(client, k.FIND_COUNSELLOR);
      clientShouldReceiveAppError(client, e.COUNSELLOR_UNAVAILABLE, done);
      client.emit(k.FIND_COUNSELLOR);
    });

    describe('with counsellor online', function() {
      beforeEach(function(done) {
        // counsellor comes online
        counsellor.emit(k.COUNSELLOR_ONLINE, {
          counsellorId,
          counsellorName,
        });
        counsellor.on(k.COUNSELLOR_ONLINE, () => done());
      });

      it('should create a chat room with counsellor', function(done) {
        client.on(k.FIND_COUNSELLOR, data => {
          data.should.have.keys(
            'counsellorId', 'counsellorName', 'roomId', 'roomType', 'userLimit');
          data.roomId.should.match(uuid4Regex);
          data.roomType.should.equal(ROOM_TYPE.PRIVATE, 'room type should be private');
          data.userLimit.should.equal(2, 'room can only have 2 users');
          data.counsellorId.should.equal(counsellorId);
          data.counsellorName.should.equal(counsellorName);
          done();
        });

        client.emit(k.FIND_COUNSELLOR);
      });

      it('if client sends message, counsellor gets it', function(done) {
        let roomId;

        client.on(k.FIND_COUNSELLOR, data => {
          roomId = data.roomId;
          client.emit(k.ADD_MESSAGE, {
            roomId,
            message: 'Hello',
          });
        });

        counsellor.on(k.ADD_MESSAGE, data => {
          data.should.have.keys('userId', 'content');
          data.userId.should.equal(client.id);
          data.content.should.equal('Hello');
          done();
        });

        client.on(k.APP_ERROR, data => {
          should.fail(`should not have error ${data.message}`);
        });

        client.emit(k.FIND_COUNSELLOR);
      });
    });
  });
});
