import { PUBLIC } from './room_types';

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
      userLimit,
      roomDescription = '',
      categories = [],
      sockets = []
  }) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.roomType = PUBLIC;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.sockets = sockets;
    this.lastActive = new Date();
  }

  get numberOfUsers() {
    return this.sockets.length;
  }

  isUserHere(socket) {
    return this.sockets.filter(s => s.id === socket.id).length > 0;
  }

  addUser(socket) {
    this.sockets = this.sockets.concat(socket);
    // should we update lastActive here?
  }

  removeUser(socket) {
    this.sockets = this.sockets.filter(
      s => s.id !== socket.id
    );
    // should we update lastActive here?
  }

  touch() {
    this.lastActive = new Date();
  }

  get toJson() {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      userLimit: this.userLimit,
      roomDescription: this.roomDescription,
      categories: this.categories,
      numberOfUsers: this.numberOfUsers,
      lastActive: this.lastActive.toISOString(),
    };
  }

}

export default Room;
