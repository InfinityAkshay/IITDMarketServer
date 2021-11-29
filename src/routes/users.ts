import express from 'express';
const router = express.Router();
import User from '../models/user';
import Item from '../models/item';
import Chat from '../models/chat';
import Message from '../models/message';
import '../models/review';
import '../models/notification';
import middleware from '../middleware';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.pem'));

//User Profile
router.get('/:id/own', async (req: express.Request, res: express.Response) => {
  try {
    const foundUser = await User.findById(req.params.id)
      .populate('reviews')
      .exec();
    const foundItem = await Item.find({seller: foundUser}).exec();
    const itemSold = await Item.find({
      $and: [
        {$or: [{status: 'INPROCESS'}, {status: 'SOLD'}]},
        {$or: [{seller: foundUser}, {buyer: foundUser}]},
      ],
    }).exec();
    res.json({user: foundUser, item: foundItem, transactions: itemSold});
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.get(
  '/:id/others',
  async (req: express.Request, res: express.Response) => {
    try {
      const foundUser = await User.findById(req.params.id)
        .populate('reviews')
        .exec();
      res.json(foundUser);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.put(
  '/:id/ban',
  middleware.isAdmin,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findById(req.params.id).exec();
      if (!user.isAdmin) {
        user.isBanned = true;
        user.folCategory = [];
        const chats = await Chat.find({
          $or: [
            {user1: {_id: req.params.id, username: user.username}},
            {user2: {_id: req.params.id, username: user.username}},
          ],
        });
        for (const chat of chats) {
          await Message.remove({
            _id: {$in: chat.messages},
          });
          chat.remove();
        }
        await Item.remove({seller: user._id}).exec();
        await user.save();
        // delete user.password;
        const accessToken = jwt.sign({user}, privateKey, {
          expiresIn: '10min',
          issuer: 'auth.devclub.in',
          algorithm: 'RS256',
        });
        // const refreshToken = jwt.sign({user}, privateKey);
        // res.status(200).send({accessToken, refreshToken});

        res.status(200).send({accessToken, done: true});
      }
      res.send(false);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.put(
  '/:id/ban/temp',
  middleware.isAdmin,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findById(req.params.id).exec();
      if (!user.isAdmin) {
        user.banExpires = new Date(
          Date.now() + 3600000 * 24 * Number(req.body.day)
        );
        await user.save();
        // delete user.password;
        const accessToken = jwt.sign({user}, privateKey, {
          expiresIn: '10min',
          issuer: 'auth.devclub.in',
          algorithm: 'RS256',
        });
        // const refreshToken = jwt.sign({user}, privateKey);
        // res.status(200).send({accessToken, refreshToken});

        res.status(200).send({accessToken, done: true});
      }
      res.send(false);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.put(
  '/:id',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findById(req.params.id).exec();
      if (user._id != req.user._id && !req.user.isAdmin) {
        console.log(req.user._id !== user._id, req.user._id, user._id);
        throw new Error('invalid user');
      }
      user.avatar = req.body.avatar;
      user.contact_number = req.body.contactNumber;
      // user.entry_number = req.body.entryNumber;
      user.hostel = req.body.hostel;
      // user.firstName = req.body.firstName;
      // user.lastName = req.body.lastName;
      // user.email = req.body.email;
      user.description = req.body.description;
      await user.save();
      // delete user.password;
      const accessToken = jwt.sign({user}, privateKey, {
        expiresIn: '10min',
        issuer: 'auth.devclub.in',
        algorithm: 'RS256',
      });
      res.status(200).send(accessToken);
      res.send('Done');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

export default router;
