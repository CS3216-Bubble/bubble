import { RoomDB } from '../src/database';
import { after, before, describe } from 'mocha';

// these cases are just for the side effect of cleaning up DB
describe('API', function() {
  before(function(done) {
    RoomDB
      .drop()
      .then(() => done());
  });

  after(function(done) {
    RoomDB
      .drop()
      .then(() => done());
  });
});
