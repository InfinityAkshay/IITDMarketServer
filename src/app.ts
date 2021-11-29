import sd from 'dotenv';
sd.config();
import express = require('express');
const app = express();
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import psLocal from 'passport-local';
import './models/item';
import User from './models/user';
import session from 'express-session';
import methodOverride from 'method-override';
import Mongo from 'connect-mongo';
const MongoStore = Mongo(session);
import './models/notification';
const LocalStrategy = psLocal.Strategy;
//requiring routes
import itemRoutes from './routes/item';
import indexRoutes from './routes/index';
import userReviewRoutes from './routes/userReview';
import userRoutes from './routes/users';
import moment from 'moment';
import cors from 'cors';

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

// assign mongoose promise library and connect to database
mongoose.Promise = global.Promise;

const databaseUri =
  process.env.MONGODB_URI || 'mongodb+srv://admin:admin@node-crash-course.2vbeb.mongodb.net/node-crash?retryWrites=true&w=majority';
mongoose
  .connect(databaseUri)
  .then(() => console.log('Database connected'))
  .catch(err => console.log(`Database connection error: ${err.message}`));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set('trust proxy', 1);
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));
app.use(cookieParser('secret'));
//require moment
app.locals.moment = moment;
app.use(cors());
// PASSPORT CONFIGURATION
app.use(
  session({
    secret: 'Random Words have power!',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      // url: process.env.MONGODB_URI || 'mongodb+srv://<username>:<password>@node-crash-course.2vbeb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
      url: 'mongodb+srv://admin:admin@node-crash-course.2vbeb.mongodb.net/node-crash?retryWrites=true&w=majority',
    }),
  })
);

// app.use(passport.initialize());
// app.use(passport.session());
// passport.use(new LocalStrategy(User.authenticate()));
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

app.use('/', indexRoutes);
app.use('/item', itemRoutes);
app.use('/users', userRoutes);
app.use('/users/:id/reviews', userReviewRoutes);
app.set('port', process.env.PORT || 5000);

export default app;
