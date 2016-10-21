import _ from './env';
import './logging';
import './database';
import { server } from './app';

export default server.listen(3000);
