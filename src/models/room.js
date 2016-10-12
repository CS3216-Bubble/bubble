import ROOM_TYPE from './room_type';
import MESSAGE_TYPE from './message_type';

class Room {
  roomId: string;
  roomName: string;
  roomType: number;
  userLimit: number;
  roomDescription: string;
  categories: string[];
  socketIds: string[];
  lastActive: Date;

  constructor({
    roomId,
    roomName,
    roomType = ROOM_TYPE.PUBLIC,
    userLimit,
    roomDescription = '',
    categories = [],
    socketIds = [],
    messages = [],
  }) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.roomType = roomType;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.socketIds = socketIds;
    this.lastActive = new Date();
    this.messages = messages;
    this._room = null;
  }

  get numberOfUsers() {
    return this.socketIds.length;
  }

  isUserHere(socket) {
    return this.socketIds.filter(s => s === socket.id).length > 0;
  }

  addUser(socket) {
    this.socketIds = this.socketIds.concat(socket.id);
    // should we update lastActive here?
  }

  removeUser(socket) {
    this.socketIds = this.socketIds.filter(
      s => s !== socket.id
    );
    // should we update lastActive here?
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
  }

  addReaction(userId, reaction) {
    this.messages.push({
      userId,
      type: MESSAGE_TYPE.REACTION,
      reaction,
      date: new Date(),
    });
    this.touch();
  }

  preSave(values) {
    values.categories = JSON.stringify(values.categories);
    values.socketIds = JSON.stringify(values.socketIds);
    values.messages = JSON.stringify(values.messages);
    return values;
  }

  save(db) {
    return db.upsert(
      this.preSave(this.toJson)
    );
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
      socketIds: this.socketIds,
      lastActive: this.lastActive.toISOString(),
      messages: this.messages,
    };
  }

}

export default Room;
