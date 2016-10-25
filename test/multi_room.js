import { afterEach, beforeEach, describe, it } from 'mocha';
import io from 'socket.io-client';
import should from 'should'; // eslint-disable-line no-unused-vars

import * as k from '../src/constants';
import { server } from '../src/app'; // eslint-disable-line no-unused-vars
import {
  createRoom,
  makeClient,
} from './helpers';

describe('API', function() {
  this.timeout(3000);
  let client;
  let client2;
  let client3;

  beforeEach(function(done) {
    server.listen(3000);
    client = makeClient(io);
    client2 = makeClient(io);
    client3 = makeClient(io);
    done();
  });

  afterEach(function(done) {
    client.disconnect();
    client2.disconnect();
    client3.disconnect();
    server.close();
    done();
  });

  describe('create multiple rooms', function() {
    it('should allow client to create multiple rooms', function(done) {
      let roomsCreated = 0;
      client.on(k.CREATE_ROOM, () => {
        roomsCreated += 1;
        if (roomsCreated === 3) {
          client.emit(k.LIST_ROOMS);
        }
      });
      client.on(k.LIST_ROOMS, rooms => {
        rooms.should.have.length(3);
        [0, 1, 2].forEach(i => {
          rooms[i].numUsers.should.equal(1);
          rooms[i].createdBy.should.equal(client.id);
        });
        done();
      });
      createRoom(client);
      createRoom(client);
      createRoom(client);
    });

    it('should allow client to join multiple rooms', function(done) {
      let roomsCreated = 0;
      let room1Id;
      let room2Id;
      client.on(k.CREATE_ROOM, room => {
        if (roomsCreated === 0) {
          room1Id = room.roomId;
          client2.emit(k.JOIN_ROOM, { roomId: room1Id });
        } else if (roomsCreated === 1) {
          room2Id = room.roomId;
          client2.emit(k.JOIN_ROOM, { roomId: room2Id });
        }
        roomsCreated += 1;
      });
      client.on(k.JOIN_ROOM, data => {
        if (data.roomId === room2Id) {
          client.emit(k.LIST_ROOMS);
        }
      });
      client.on(k.LIST_ROOMS, rooms => {
        rooms.should.have.length(2);
        rooms[0].numUsers.should.equal(2);
        rooms[1].numUsers.should.equal(2);
        done();
      });
      createRoom(client);
      createRoom(client);
    });

    it('should allow client to chat in multiple rooms', function(done) {
      let roomsCreated = 0;
      let room1Id;
      let room2Id;
      // need this to verify that client 1 receives client 2's message and vice versa
      let canCallDone = false;
      const MESSAGE1 = 'Message to Room 1';
      const MESSAGE2 = 'Message to Room 2';

      // when room is created, store the room ids and make client2 join both rooms
      client.on(k.CREATE_ROOM, room => {
        if (roomsCreated === 0) {
          room1Id = room.roomId;
          client2.emit(k.JOIN_ROOM, { roomId: room1Id });
        } else if (roomsCreated === 1) {
          room2Id = room.roomId;
          client2.emit(k.JOIN_ROOM, { roomId: room2Id });
        }
        roomsCreated += 1;
      });

      // client 1 reacts when adding message
      // 1) client 1 sends message to room 1
      // 2) client 1 receives a message in room 2
      client.on(k.ADD_MESSAGE, data => {
        if (data.roomRoomId === room1Id) {
          data.sentByMe.should.be.true();
        }
        if (data.roomRoomId === room2Id) {
          data.sentByMe.should.be.false();
          data.userId.should.equal(client2.id);
          data.content.should.equal(MESSAGE2);
          // can only call done when both clients have received messages
          if (canCallDone) {
            done();
          } else {
            canCallDone = !canCallDone;
          }
        }
      });

      // client 2 reacts when adding message
      // 1) client 2 receives a message in room 1
      // 2) client 2 sends a message to room 2
      client2.on(k.ADD_MESSAGE, data => {
        if (data.roomRoomId === room1Id) {
          data.sentByMe.should.be.false();
          data.userId.should.equal(client.id);
          data.content.should.equal(MESSAGE1);
          if (canCallDone) {
            done();
          } else {
            canCallDone = !canCallDone;
          }
        }
        if (data.roomRoomId === room2Id) {
          data.sentByMe.should.be.true();
        }
      });

      // when client 2 has joined the room 1, send message to room 1
      client.on(k.JOIN_ROOM, data => {
        if (data.roomId === room1Id && data.userId === client2.id) {
          // send a message to room 1
          client.emit(k.ADD_MESSAGE, {
            roomId: room1Id,
            message: MESSAGE1,
          });
        }
        if (data.roomId === room2Id && data.userId === client2.id) {
          // send a message to room 1
          client2.emit(k.ADD_MESSAGE, {
            roomId: room2Id,
            message: MESSAGE2,
          });
        }
      });

      client2.on(k.JOIN_ROOM, data => {
        if (data.roomId === room1Id) {
          data.participants.should.containEql(client.id);
        }
        if (data.roomId === room2Id) {
          data.participants.should.containEql(client.id);
          // client 2 sends message to room 2
          client2.emit(k.ADD_MESSAGE, {
            roomId: room2Id,
            message: MESSAGE2,
          });
        }
      });
      createRoom(client);
      createRoom(client);
    });
  });
});
