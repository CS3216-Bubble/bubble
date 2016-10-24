import dotenv from 'dotenv';

switch (process.env.NODE_ENV) {
  case 'prod':
    dotenv.config({ path: './prod.env' });
    break;
  case 'dev':
    dotenv.config({ path: './dev.env' });
    break;
  case 'test':
  default:
    dotenv.config({ path: './test.env' });
    break;
}
