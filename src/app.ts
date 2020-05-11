import * as express from 'express';

const app = express();

app.set('port', process.env.PORT || 5000);

app.get('/', (req, res) => {
  res.send('Welcome to the IITD Market Server !!');
});

export default app;
