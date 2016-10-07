import winston from 'winston';
import process from 'process';

let logger;

if (process.env.NODE_ENV === 'test') {
  /* Silence all winston logging when testing */
  logger = new winston.Logger({
    transports: []
  });
} else {
  logger = new winston.Logger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: 'debug.log',
      }),
    ]
  });
}

export default logger;
