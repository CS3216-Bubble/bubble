import Sequelize from 'sequelize';
import dotenv from 'dotenv';
import process from 'process';

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

const RoomDB = database.define('room', {
  roomId: { type: Sequelize.STRING, primaryKey: true },
  roomName: Sequelize.STRING,
  roomType: Sequelize.ENUM(0, 1), // eslint-disable-line new-cap
  userLimit: Sequelize.INTEGER,
  roomDescription: Sequelize.TEXT,
  categories: Sequelize.STRING,
  socketIds: Sequelize.STRING,
  lastActive: Sequelize.DATE,
  messages: Sequelize.STRING,
});

database.sync();

export default database;
export {
  RoomDB,
};
