import express from 'express';
const router = express.Router();
import passport from 'passport';
import User from '../models/user';
import Item from '../models/item';
import Review from '../models/review';
import '../models/notification';
import middleware from '../middleware';
import auth from '../middleware/auth.js';
import {ChangeStream} from 'mongodb';
import jwt from 'jsonwebtoken';
import fs, { access } from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.pem'));

// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// const foo = function (
//   req: express.Request
//   //res: express.Response,
//   //next: express.NextFunction
// ) {
//   let _changeStream = User.watch([
//     {$match: {'fullDocument._id': req.user._id}},
//   ]);
//   return {
//     get changeStream() {
//       return _changeStream;
//     },
//     set changeStream(val) {
//       _changeStream = val;
//     },
//   };
// };

// const globals: {changeStream: ChangeStream<unknown>} = {
//   changeStream: null,
// };

//handle sign up logic
router.post(
  '/register',
  middleware.checkRegister,
  async (req: express.Request, res: express.Response) => {
    try {
      const userobj: Record<string, unknown> = {
        username: req.body.username,
        password: req.body.password,
        avatar: req.body.avatar,
        contact_number: req.body.contactNumber,
        entry_number: req.body.entryNumber,
        hostel: req.body.hostel,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        description: req.body.description,
      };
      const newUser = new User(userobj);
      if (req.body.adminCode && req.body.adminCode === process.env.ADMIN_CODE) {
        newUser.isAdmin = true;
      }
      // const user = await User.register(newUser, req.body.password);
      // req.login(user, () => {});
      const user = await newUser.save();
      delete user.password;
      const accessToken = jwt.sign({user}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      // const refreshToken = jwt.sign({user}, privateKey);
      // res.status(200).send({accessToken, refreshToken});

      res.status(200).send(accessToken);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

//handling login logic
router.post('/login', async (req: express.Request, res: express.Response) => {
  // globals.changeStream = User.watch(
  //   [{$match: {'fullDocument._id': req.user._id}}],
  //   {fullDocument: 'updateLookup'}
  // );
  // globals.changeStream = User.watch([
  //   {$match: {'documentKey._id': req.user._id}},
  // ]);
  try {
    const user = await User.findOne({email: req.body.email});
    // console.log(await user.comparePassword(req.body.password));
    delete user.password;
    const accessToken = jwt.sign({user}, privateKey, {
      expiresIn: '10min',
      issuer: 'auth.devclub.in',
      algorithm: 'RS256',
    });
    // const refreshToken = jwt.sign({user}, privateKey);
    // res.status(200).send({accessToken, refreshToken});
    
    res.status(200).send(accessToken);
  } catch (error) {
    console.log(error);
  }
});

router.get('/test', middleware.isLoggedIn, (req: express.Request, res: express.Response) => {
  try {  
    res.send(req.user);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// logout route
router.get('/logout', async (req: express.Request, res: express.Response) => {
  try {
    req.cookies["token"] = jwt.sign({}, "token", {
      expiresIn: 1,
    });
    req.cookies["rememberme"] = jwt.sign({}, "rememberme", {
      expiresIn: 1,
    });
    console.log(req.cookies);
    
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// follow user
router.patch(
  '/follow/:slug',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(req.user);
      const user = await User.findById(req.user._id).exec();
      user.folCategory = [...new Set(user.folCategory.concat(req.params.slug))];
      const userx = await user.save();
      delete userx.password;
      const accessToken = jwt.sign({user:userx}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      // req.login(user, () => {});
      res.status(200).send({accessToken, user, userx});
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/unfollow/:slug',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      console.log(req.user);
      const user = await User.findById(req.user._id).exec();
      user.folCategory = user.folCategory.filter(
        value => value !== req.params.slug
      );
      const userx = await user.save();
      delete userx.password;
      const accessToken = jwt.sign({user:userx}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      // req.login(user, () => {});
      res.status(200).send(accessToken);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

// view all notifications
router.get(
  '/notifications',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findById(req.user._id)
        .populate({
          path: 'notifs',
          options: {sort: {_id: -1}},
        })
        .exec();
      const allNotifications = user.notifs;
      res.json(allNotifications);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.get(
  '/report',
  middleware.isAdmin,
  async (req: express.Request, res: express.Response) => {
    try {
      const items = await Item.find({isReported: true}).exec();
      const reviews = await Review.find({isReported: true}).exec();
      res.json({items, reviews});
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

// router.get('/streamUser', (_req: express.Request, res: express.Response) => {
//   res.writeHead(200, {
//     Connection: 'keep-alive',
//     'Content-Type': 'text/event-stream',
//     'Cache-Control': 'no-cache',
//   });
//   // res.setHeader('Cache-Control', 'no-cache');
//   // res.setHeader('Content-Type', 'text/event-stream');
//   res.flushHeaders();
//   // globals.changeStream.on('change', change => {
//   //   res.write(`data: ${JSON.stringify(change)}\n\n`);
//   //   //res.end();
//   // });
//   res.on('close', () => {
//     res.end();
//   });
// });

export default router;
