import uuid from 'uuid';
import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import { server } from '../src/app'; // eslint-disable-line no-unused-vars

function connectWithToken(token) {
  return io.connect(`http://localhost:3000?bubble=${token}`);
}

describe.skip('API', function() {
  beforeEach(function(done) {
    server.listen(3000);
    done();
  });

  afterEach(function(done) {
    server.close();
    done();
  });

  it('tells me my socket id once I connect', function(done) {
    const socket = io.connect("http://localhost:3000");

    socket.on('my_id', data => {
      data.should.not.be.empty();
      done();
    });
  });

  it('assigns me same bubbleId same token is used', function(done) {
    const token = uuid.v4();

    // use 2 different io.connect calls to avoid any shared state
    const socketOld = connectWithToken(token);
    let socketNew;
    let myBubbleId;

    socketOld.on('my_id', data => {
      data.should.not.be.empty();
      // set myBubbleId to be asserted against later
      myBubbleId = data;
      socketOld.disconnect();
    });

    socketOld.on('disconnect', () => {
      socketNew = connectWithToken(token);

      socketNew.on('my_id', data => {
        data.should.not.be.empty();
        // second event, assert
        data.should.be.equal(myBubbleId);
        done();
      });
    });
  });

  it('assigns different bubbleId if different token', function(done) {
    const tokenOld = uuid.v4();
    const tokenNew = uuid.v4();

    // use 2 different io.connect calls to avoid any shared state
    const socketOld = connectWithToken(tokenOld);
    let socketNew;
    let myBubbleId;

    socketOld.on('my_id', data => {
      data.should.not.be.empty();
      // set myBubbleId to be asserted against later
      myBubbleId = data;
      socketOld.disconnect();
    });

    socketOld.on('disconnect', () => {
      socketNew = connectWithToken(tokenNew);

      socketNew.on('my_id', data => {
        data.should.not.be.empty();
        // second event, assert
        data.should.not.equal(myBubbleId);
        done();
      });
    });
  });
});
