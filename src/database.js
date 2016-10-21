import Sequelize from 'sequelize';
import process from 'process';

import ISSUE_TYPE from './models/issue_type';
import MESSAGE_TYPE from './models/message_type';
import ROOM_TYPE from './models/room_type';
import USER_TYPE from './models/user_type';

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

const RoomDB = database.define('room', {
  roomId: { type: Sequelize.STRING, primaryKey: true },
  roomName: { type: Sequelize.STRING, allowNull: false },
  roomType: Sequelize.ENUM(ROOM_TYPE.PUBLIC, ROOM_TYPE.PRIVATE), // eslint-disable-line new-cap
  userLimit: Sequelize.INTEGER,
  roomDescription: Sequelize.TEXT,
  categories: Sequelize.STRING,
  // socketIds: Sequelize.STRING,
  lastActive: Sequelize.DATE,
  numUsers: Sequelize.INTEGER,
});

const MessageDB = database.define('message', {
  userId: { type: Sequelize.STRING, allowNull: false }, // socket id
  messageType: Sequelize.ENUM( // eslint-disable-line new-cap
    MESSAGE_TYPE.MESSAGE, MESSAGE_TYPE.REACTION),
  content: { type: Sequelize.TEXT, allowNull: false },
  targetUser: Sequelize.STRING,
});

MessageDB.belongsTo(RoomDB);
RoomDB.hasMany(MessageDB);

const IssueDB = database.define('issue', {
  id: { type: Sequelize.STRING, primaryKey: true },
  userId: { type: Sequelize.STRING, allowNull: false }, // socket id
  counsellorId: { type: Sequelize.STRING },
  issueType: {
    type: Sequelize.ENUM( // eslint-disable-line new-cap
      ISSUE_TYPE.USER_FLAGGED,
      ISSUE_TYPE.USER_REQUESTED,
      ISSUE_TYPE.USER_MISSED,
    ),
    allowNull: false,
  },
});

database.sync();

export default database;
export {
  IssueDB,
  MessageDB,
  RoomDB,
  UserDB,
};
