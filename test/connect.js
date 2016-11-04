import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

// import * as k from '../src/constants';
// import * as e from '../src/error_code';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars

describe('API', function() {
  beforeEach(function(done) {
    server.listen(3000);
    done();
  });

  afterEach(function(done) {
    server.close();
    done();
  });

  it('assigns me a bubbleId', function(done) {
    var socket = io.connect("http://localhost:3000", {
      transports: ['websocket'],
    });
    socket.on('connect', () => {
      socket.emit('my_id');
    });
    socket.on('my_id', data => {
      data.should.not.be.empty();
      done();
    });
  });

  it('assigns me same bubbleId same token is used', function(done) {
    let token = '123';
    let connect = () => io.connect(`http://localhost:3000?bubble=${token}`);

    // use 2 different io.connect calls to avoid any shared state
    let socketOld = connect();
    let socketNew;
    let myBubbleId;

    socketOld.on('connect', () => {
      socketOld.emit('my_id');
    });

    socketOld.on('my_id', data => {
      data.should.not.be.empty();
      // set myBubbleId to be asserted against later
      myBubbleId = data;
      socketOld.disconnect();
    });

    socketOld.on('disconnect', () => {
      socketNew = connect();
      socketNew.on('connect', () => {
        socketNew.emit('my_id');
      });

      socketNew.on('my_id', data => {
        data.should.not.be.empty();
        // second event, assert
        data.should.be.equal(myBubbleId);
        done();
      });
    });
  });

  it('assigns different bubbleId if different token', function(done) {
    let tokenOld = '123';
    let tokenNew = '456';
    let connect = token => io.connect(`http://localhost:3000?bubble=${token}`);

    // use 2 different io.connect calls to avoid any shared state
    let socketOld = connect(tokenOld);
    let socketNew;
    let myBubbleId;

    socketOld.on('connect', () => {
      socketOld.emit('my_id');
    });

    socketOld.on('my_id', data => {
      data.should.not.be.empty();
      // set myBubbleId to be asserted against later
      myBubbleId = data;
      socketOld.disconnect();
    });

    socketOld.on('disconnect', () => {
      socketNew = connect(tokenNew);
      socketNew.on('connect', () => {
        socketNew.emit('my_id');
      });

      socketNew.on('my_id', data => {
        data.should.not.be.empty();
        // second event, assert
        data.should.not.equal(myBubbleId);
        done();
      });
    });
  });
});
