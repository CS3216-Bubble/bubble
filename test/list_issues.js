import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as e from '../src/error_code';
import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import { makeClient } from './helpers';

const counsellorId = '123';
const counsellorName = 'CC';

describe('API', function() {
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

  describe('list_issues', function() {
    it('should return USER_MISSED issues', function(done) {
      // this should create a new issue
      client.emit(k.FIND_COUNSELLOR);
      client.on(k.APP_ERROR, data => {
        data.code.should.equal(e.COUNSELLOR_UNAVAILABLE);
        counsellor.emit(k.LIST_ISSUES, {});
      });
      counsellor.on(k.LIST_ISSUES, data => {
        data.length.should.equal(1);
        done();
      });
    });

    it('should return USER_REQUESTED issues', function(done) {
      // First the counsellor goes online
      counsellor.emit(k.COUNSELLOR_ONLINE, {
        counsellorId,
        counsellorName,
      });
      // when the counsellor is online, client finds a counseller
      counsellor.on(k.COUNSELLOR_ONLINE, () => client.emit(k.FIND_COUNSELLOR));

      client.on(k.FIND_COUNSELLOR, data => {
        counsellor.emit(k.LIST_ISSUES, {
          counsellorId
        });
      });

      counsellor.on(k.LIST_ISSUES, data => {
        data.length.should.equal(1);
        done();
      });
    });
  });
});
