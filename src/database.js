import Sequelize from 'sequelize';
import dotenv from 'dotenv';
import process from 'process';

import MESSAGE_TYPE from './models/message_type';
import ROOM_TYPE from './models/room_type';
import USER_TYPE from './models/user_type';

switch (process.env.NODE_ENV) {
  case 'prod':
    dotenv.config({ path: './prod.env' });
    break;
  case 'development':
  case 'test':
  default:
    dotenv.config({ path: './dev.env' });
    break;
}

const database = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: () => {},
  });

const UserDB = database.define('user', {
  id: { type: Sequelize.STRING, primaryKey: true },
  userType: { type: Sequelize.ENUM( // eslint-disable-line new-cap
    USER_TYPE.ANON, USER_TYPE.COUNSELLOR)},
  name: { type: Sequelize.STRING },
  // connectedVia: { type: Sequelize.STRING, primaryKey: true },
});

const SocketDB = database.define('socket', {
  id: { type: Sequelize.STRING, primaryKey: true },
  connected: { type: Sequelize.BOOLEAN, allowNull: false },
});

// UserDB.belongsTo(SocketDB);
SocketDB.belongsTo(UserDB);

const RoomDB = database.define('room', {
  roomId: { type: Sequelize.STRING, primaryKey: true },
  roomName: { type: Sequelize.STRING, allowNull: false },
  roomType: Sequelize.ENUM(ROOM_TYPE.PUBLIC, ROOM_TYPE.PRIVATE), // eslint-disable-line new-cap
  userLimit: Sequelize.INTEGER,
  roomDescription: Sequelize.TEXT,
  categories: Sequelize.STRING,
  // socketIds: Sequelize.STRING,
  lastActive: Sequelize.DATE,
}, {
  getterMethods: {
    numberOfUsers: function() {
      return this.sockets ? this.sockets.length : 0;
    },
  },
});

const MessageDB = database.define('message', {
  userId: { type: Sequelize.STRING, allowNull: false }, // socket id
  messageType: Sequelize.ENUM( // eslint-disable-line new-cap
    MESSAGE_TYPE.MESSAGE, MESSAGE_TYPE.REACTION),
  content: { type: Sequelize.TEXT, allowNull: false },
});

RoomDB.hasMany(MessageDB);
RoomDB.hasMany(SocketDB);

database.sync();

export default database;
export {
  MessageDB,
  RoomDB,
  SocketDB,
  UserDB,
};
