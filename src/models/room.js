import ROOM_TYPE from './room_type';
import MESSAGE_TYPE from './message_type';
import { MessageDB } from '../database';

class Room {
  roomId: string;
  roomName: string;
  roomType: number;
  userLimit: number;
  roomDescription: string;
  categories: string[];
  sockets: string[];
  lastActive: Date;

  constructor({
    roomId,
    roomName,
    roomType = ROOM_TYPE.PUBLIC,
    userLimit,
    roomDescription = '',
    categories = [],
    sockets = [],
    messages = [],
    lastActive = null,
    _room = null,
  }) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.roomType = roomType;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.sockets = sockets;
    this.lastActive = lastActive || new Date();
    this.messages = messages;
    this._room = _room;
  }

  static fromDb(r) {
    return new Room({
      roomId: r.roomId,
      roomName: r.roomName,
      roomType: r.roomType,
      userLimit: r.userLimit,
      roomDescription: r.roomDescription,
      categories: JSON.parse(r.categories),
      sockets: r.sockets.map(m => m.dataValues),
      lastActive: r.lastActive,
      messages: r.messages.map(m => m.dataValues),
      _room: r,
    });
  }


  get numberOfUsers() {
    return this.sockets.length;
  }

  isUserHere(socket) {
    return this.sockets.filter(s => s.id === socket.id).length > 0;
  }

  touch() {
    this.lastActive = new Date();
  }

  addMessage(userId, message) {
    this.messages.push({
      userId,
      type: MESSAGE_TYPE.MESSAGE,
      message,
      date: new Date(),
    });
    this.touch();
    return MessageDB.create({
      userId,
      messageType: MESSAGE_TYPE.MESSAGE,
      content: message,
      roomRoomId: this.roomId
    });
  }

  addReaction(userId, reaction) {
    this.messages.push({
      userId,
      type: MESSAGE_TYPE.REACTION,
      reaction,
      date: new Date(),
    });
    this.touch();
    return MessageDB.create({
      userId,
      messageType: MESSAGE_TYPE.REACTION,
      content: reaction,
      roomRoomId: this.roomId
    });
  }

  preSave(values) {
    values.categories = JSON.stringify(values.categories);
    return values;
  }

  create(db) {
    return db.create({
      roomId: this.roomId,
      roomName: this.roomName,
      roomType: this.roomType,
      userLimit: this.userLimit,
      roomDescription: this.roomDescription,
      categories: JSON.stringify(this.categories),
      numberOfUsers: this.numberOfUsers,
      lastActive: this.lastActive,
    });
  }

  save(db) {
    return db.update({
      roomName: this.roomName,
      roomType: this.roomType,
      userLimit: this.userLimit,
      roomDescription: this.roomDescription,
      categories: JSON.stringify(this.categories),
      numberOfUsers: this.numberOfUsers,
      lastActive: this.lastActive,
    }, {
      where: {
        roomId: this.roomId,
      },
    });
  }

  get toJson() {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      roomType: this.roomType,
      userLimit: this.userLimit,
      roomDescription: this.roomDescription,
      categories: this.categories,
      numberOfUsers: this.numberOfUsers,
      sockets: this.sockets,
      lastActive: this.lastActive.toISOString(),
      messages: this.messages,
    };
  }

}

export default Room;
