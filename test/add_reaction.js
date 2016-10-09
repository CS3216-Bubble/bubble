// import { afterEach, beforeEach, describe, it } from 'mocha';
// import io from 'socket.io-client';
// import should from 'should'; // eslint-disable-line no-unused-vars

// import * as e from '../src/error_code';
// import * as k from '../src/constants';
// import { server } from '../src/app'; // eslint-disable-line no-unused-vars
// import {
//   ROOM_KEYS,
//   clientShouldNotReceiveEvent,
//   clientShouldReceiveAppError,
//   createRoom,
//   errorRoomIdNotFound,
//   errorWithoutRoomId,
//   makeClient,
// } from './helpers';

// describe('API', function() {
//   this.timeout(3000);
//   /* All tests here will have a room created */
//   let client;
//   let client2;
//   let client3;
//   /* store the created roomId so tests can join this room */
//   let createdRoom;
//   let roomId;

//   beforeEach(function(done) {
//     server.listen(3000);
//     client = makeClient(io);
//     // important that this happens only once during initialization
//     client.once(k.CREATE_ROOM, function(room) {
//       createdRoom = room;
//       roomId = createdRoom.roomId;
//       done();
//     });
//     /* All tests below require a room, create it here */
//     createRoom(client);
//   });

//   afterEach(function(done) {
//     client.disconnect();
//     server.close();
//     if (client2) {
//       client2.disconnect();
//     }
//     if (client3) {
//       client3.disconnect();
//     }
//     done();
//   });

//   describe('add_reaction', function() {
//     it('should return error when room id is not specified');
//     it('should return error when message is not specified');
//     it('should emit add_reaction event to all other users in a room');
//   });
// });
