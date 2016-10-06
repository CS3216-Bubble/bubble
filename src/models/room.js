class Room {
  roomId: string;
  roomName: string;
  userLimit: number;
  roomDescription: string;
  categories: string[];
  sockets: string[];
  constructor(
      roomId,
      roomName,
      userLimit,
      roomDescription,
      categories,
      sockets:[]) {
    this.roomId = roomId;
    this.roomName = roomName;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.sockets = sockets;
  }

  get numberOfUsers() {
    return this.sockets.length;
  }

  isUserHere(socket) {
    return this.sockets.filter(s => s.id === socket.id).length > 0;
  }

  addUser(socket) {
    this.sockets = this.sockets.concat(socket);
  }

  removeUser(socket) {
    this.sockets = this.sockets.filter(
      s => s.id !== socket.id
    );
  }

  get toJson() {
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      userLimit: this.userLimit,
      roomDescription: this.roomDescription,
      categories: this.categories,
      numberOfUsers: this.numberOfUsers,
    };
  }

}

export default Room;
