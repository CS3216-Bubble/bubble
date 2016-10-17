import database from '../src/database';
import { afterEach, beforeEach } from 'mocha';

// these cases are just for the side effect of cleaning up DB
beforeEach(function(done) {
  database
    .sync()
    .then(_ => database.truncate())
    .then(_ => done())
});

afterEach(function(done) {
  database
    .sync()
    .then(_ => database.truncate())
    .then(_ => done())
});
