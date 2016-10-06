import { server } from './app';
import winston from 'winston';

winston.add(winston.transports.File, { filename: 'debug.log' });

export default server.listen(3000);
