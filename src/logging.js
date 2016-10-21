import _ from 'winston-loggly-bulk';
import process from 'process';
import winston from 'winston';

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

  logger.add(winston.transports.Loggly, {
    token: process.env.LOGGLY_TOKEN,
    subdomain: process.env.LOGGLY_SUBDOMAIN,
    tags: [process.env.LOGGLY_TAG],
    json: true
  });
}

export default logger;
