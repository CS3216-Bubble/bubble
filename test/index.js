import database, { RoomDB, SocketDB } from '../src/database';
import { after, before, describe } from 'mocha';

// these cases are just for the side effect of cleaning up DB
before(function(done) {
  // done();
  database.sync({ force: true }).then(() => done());
  // Promise.all([
  //   RoomDB.drop(),
  //   SocketDB.drop(),
  // ]).then(() => done());
});

after(function(done) {
  // done();
  database.sync({ force: true }).then(() => done());
});
