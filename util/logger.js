import { createLogger, format, transports } from 'winston';

const { simple, combine, timestamp } = format;

// const levels = {
//     error: 0,
//     warn: 1,
//     info: 2,
//     http: 3,
//     verbose: 4,
//     debug: 5,
//     silly: 6
//   };

export default createLogger({
    level: 'debug',
    format: combine(timestamp(), simple()),
    transports: [
        new transports.Console()
    ]
});