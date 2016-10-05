class Room {
  roomName: string;
  userLimit: number;
  roomDescription: string;
  categories: string[];
  numberOfUsers: number;
  constructor(
      roomName,
      userLimit,
      roomDescription,
      categories,
      numberOfUsers: 1) {
    this.roomName = roomName;
    this.userLimit = userLimit;
    this.roomDescription = roomDescription;
    this.categories = categories;
    this.numberOfUsers = numberOfUsers;
  }
}

export default Room;
