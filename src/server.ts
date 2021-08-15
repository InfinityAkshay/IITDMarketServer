import http from 'http';
import app from './app';
import User from './models/user';
import socketI from './routes/chat';

const server = http.createServer(app);
socketI(server);

server.listen(app.get('port'), () => {
  // const changeStream = User.watch([{$match: {}}]);
  // changeStream.on('change', change => console.log(change));
  console.log(`App is Running at http://localhost:${app.get('port')}`);
  console.log('  Press CTRL-C to stop\n');
});

export default server;
