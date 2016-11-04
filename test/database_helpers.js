import uuid from 'uuid';

import { RoomDB } from '../src/database';
import ROOM_TYPE from '../src/models/room_type';

/**
 * Creates a room
 * @param {string} socketId of the creator
 * @param {object} opts to overwrite defaults
 * @return {object} promise of creating the room
 */
function createRoom(socketId, opts) {
  const defaults = {
    roomId: uuid.v4(),
    roomName: 'Room',
    roomType: ROOM_TYPE.PUBLIC,
    userLimit: 100,
    roomDescription: 'Description',
    categories: '[]',
    lastActive: new Date(),
    numUsers: 1,
    createdBy: socketId,
    createdByBubbleId: "NOT_IMPT",
  };
  const options = {
    ...defaults,
    ...opts,
  };

  return RoomDB.create(options);
}

/**
 * Creates a HOT room
 * @param {string} socketId of the creator
 * @return {object} promise of creating the room
 */
function createHotRoom(socketId) {
  return createRoom(socketId, {
    roomName: 'Hot Room',
    roomType: ROOM_TYPE.HOT,
  });
}

/**
 * Creates a closed room
 * @param {string} socketId of the creator
 * @return {object} promise of creating the room
 */
function createClosedRoom(socketId) {
  return createRoom(socketId, {
    roomName: 'Closed Room',
    isOpen: false,
  });
}

/**
 * Creates a inactive room, currenctly defined as > 3 days
 * @param {string} socketId of the creator
 * @param {string} roomType type of room
 * @return {object} promise of creating the room
 */
function createInactiveRoom(socketId, roomType = ROOM_TYPE.PUBLIC) {
  return createRoom(socketId, {
    roomName: 'Inactive Room',
    lastActive: new Date() - 4 * 24 * 60 * 60 * 1000,
    roomType: roomType,
  });
}

export {
  createClosedRoom,
  createHotRoom,
  createInactiveRoom,
};
