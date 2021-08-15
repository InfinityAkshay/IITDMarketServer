import express from 'express';
const router = express.Router();
import Item from '../models/item';
import User from '../models/user';
import Chat from '../models/chat';
import Notification from '../models/notification';
import middleware from '../middleware';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.pem'));

// var multer = require('multer');
// var storage = multer.diskStorage({
//   filename: function(req, file, callback) {
//     callback(null, Date.now() + file.originalname);
//   }
// });
// var imageFilter = function (req, file, cb) {
//     // accept image files only
//     if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
//         return cb(new Error('Only image files are allowed!'), false);
//     }
//     cb(null, true);
// };
// var upload = multer({ storage: storage, fileFilter: imageFilter})

// var cloudinary = require('cloudinary');
// cloudinary.config({
//   cloud_name: 'cloudxx365',
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// Define escapeRegex function for search feature
const escapeRegex = (text: string) =>
  text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

// INDEX - show all courses
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const perPage = 8;
    const pageQuery = parseInt(`${req.query.page}`);
    const pageNumber: number = pageQuery ? pageQuery : 1;
    let noMatch = null;
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(`${req.query.search}`), 'gi');
      const allItems = await Item.find({title: `${regex}`})
        .sort({createdAt: -1})
        .skip(perPage * pageNumber - perPage)
        .limit(perPage)
        .exec();
      const count = await Item.count({title: `${regex}`}).exec();
      if (allItems.length < 1) {
        noMatch = 'No items match that query, please try again.';
      }
      res.json({
        items: allItems,
        currentPage: pageNumber,
        pages: Math.ceil(count / perPage),
        noMatch: noMatch,
        search: req.query.search,
      });
    } else {
      // get all campgrounds from DB
      const allItems = await Item.find({})
        .sort({createdAt: -1})
        .skip(perPage * pageNumber - perPage)
        .limit(perPage)
        .exec();
      const count = await Item.countDocuments().exec();
      res.json({
        items: allItems,
        currentPage: pageNumber,
        pages: Math.ceil(count / perPage),
        noMatch: noMatch,
        search: false,
      });
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// INDEX - show all items by category
router.get(
  '/cat/:category',
  async (req: express.Request, res: express.Response) => {
    try {
      const perPage = 8;
      const pageQuery = parseInt(`${req.query.page}`);
      const pageNumber: number = pageQuery ? pageQuery : 1;
      let noMatch = null;
      if (req.query.search) {
        const regex = new RegExp(escapeRegex(`${req.query.search}`), 'gi');
        const allItems = await Item.find({
          $and: [{title: `${regex}`}, {category: req.params.category}],
        })
          .sort({createdAt: -1})
          .skip(perPage * pageNumber - perPage)
          .limit(perPage)
          .exec();
        const count = await Item.count({
          $and: [{title: `${regex}`}, {category: req.params.category}],
        }).exec();
        if (allItems.length < 1) {
          noMatch = 'No items match that query, please try again.';
        }
        res.json({
          items: allItems,
          currentPage: pageNumber,
          pages: Math.ceil(count / perPage),
          noMatch: noMatch,
          search: req.query.search,
        });
      } else {
        // get all campgrounds from DB
        const allItems = await Item.find({category: req.params.category})
          .sort({createdAt: -1})
          .skip(perPage * pageNumber - perPage)
          .limit(perPage)
          .exec();
        const count = await Item.countDocuments({
          category: req.params.category,
        }).exec();
        res.json({
          items: allItems,
          currentPage: pageNumber,
          pages: Math.ceil(count / perPage),
          noMatch: noMatch,
          search: false,
        });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.get('/hostel/:h', (req: express.Request, res: express.Response) => {
  Item.find({hostel: req.params.h}, (err, items) => {
    if (err) {
      res.status(500).send(err.message);
    }
    res.json(items);
  });
});

// //INDEX - show all courses
// router.get("/", function(req, res){
//   if(req.query.search && req.xhr) {
//       const regex = new RegExp(escapeRegex(req.query.search), 'gi');
//       // Get all courses from DB
//       Course.find({title: regex}, function(err, allCourse){
//          if(err){
//             console.log(err);
//          } else {
//             res.status(200).json(allCourse);
//          }
//       });
//   } else {
//       // Get all courses from DB
//       Course.find({}, function(err, allCourse){
//          if(err){
//              console.log(err);
//          } else {
//             if(req.xhr) {
//               res.json(allCourse);
//             } else {
//               res.render("course/index",{course: allCourse, page: 'course'});
//             }
//          }
//       });
//   }
// });

//CREATE - add new course to DB
router.post(
  '/',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      // get data from form and add to courses array
      const newItem: Record<string, unknown> = {
        title: req.body.title,
        image: req.body.image,
        description: req.body.description,
        seller: req.user,
        price: req.body.price,
        tag: req.body.tag,
        userIsAnonymous: Boolean(req.body.anonymous),
        category: req.body.category,
        ApproxTime: {
          month: req.body.month,
          year: req.body.year,
        },
        hostel: req.body.hostel,
      };
      const item = await Item.create(newItem);
      const users = await User.find({folCategory: item.category}).exec();
      const newNotification = {
        target: item._id,
        message:
          'A new item has been added in the category of your interest. Hurry up and checkout the item details before the item is sold',
        isItem: true,
      };
      // Socket !!
      for (const follower of users) {
        const notification = await Notification.create(newNotification);
        follower.notifs.push(notification);
        follower.save();
      }
      res.json(item);
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

// SHOW - shows more info about one item
router.get('/:id', async (req: express.Request, res: express.Response) => {
  try {
    //find the item with provided ID
    const item = await Item.findById(req.params.id).exec();
    res.json(item);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// PUT - updates course in the database
router.put(
  '/:id',
  middleware.isLoggedIn,
  middleware.checkUserItem,
  async (req: express.Request, res: express.Response) => {
    try {
      req.item.title = req.body.title;
      req.item.image = req.body.image;
      req.item.description = req.body.description;
      req.item.seller = req.user;
      req.item.price = req.body.price;
      req.item.tag = req.body.tag;
      req.item.userIsAnonymous = Boolean(req.body.anonymous);
      req.item.category = req.body.category;
      req.item.ApproxTime = {
        month: req.body.month,
        year: req.body.year,
      };
      await req.item.save();
      const users = await User.find({folCategory: req.item.category}).exec();
      const chats = await Chat.find({
        item: {_id: req.params.id, title: req.body.title},
      }).exec();
      const newNotification = {
        target: req.item._id,
        message: 'Item details are updated successfully',
        isItem: true,
      };
      // Socket !!
      for (const follower of users) {
        const notification = await Notification.create(newNotification);
        follower.notifs.push(notification);
        follower.save();
      }
      for (const notifusers of chats) {
        const notification = await Notification.create(newNotification);
        const userx = await User.findById(notifusers.user1._id).exec();
        userx.notifs.push(notification);
        await userx.save();
      }
      res.send(req.item);
    } catch (err) {
      res.send(500).send(err.message);
    }
  }
);

// DELETE - removes course and its comments from the database
router.delete(
  '/:id',
  middleware.isLoggedIn,
  middleware.checkUserItem,
  async (req: express.Request, res: express.Response) => {
    try {
      const newNotification = {
        target: req.item._id,
        message: 'The item has been deleted successfully',
        isItem: true,
      };
      const chats = await Chat.find({
        item: {_id: req.params.id, title: req.item.title},
      }).exec();
      for (const notifusers of chats) {
        const notification = await Notification.create(newNotification);
        const userx = await User.findById(notifusers.user1._id).exec();
        userx.notifs.push(notification);
        await userx.save();
        Chat.findOneAndRemove({_id: notifusers._id});
      }
      await req.item.remove();
      res.status(200).send('Deleted');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:id/sellIni',
  middleware.isLoggedIn,
  middleware.checkUserItem,
  async (req: express.Request, res: express.Response) => {
    try {
      const user = await User.findOne({
        $or: [{_id: req.body.id}, {email: req.body.email}],
      }).exec();
      if (!user) {
        res.send(300);
      } else {
        req.item.buyer = user;
        req.item.buy_date = new Date(Date.now());
        req.item.status = 'INPROCESS';
        const chats = await Chat.find({
          item: {_id: req.params.id, title: req.item.title},
        }).exec();
        for (const chat of chats) {
          chat.active = false;
          chat.save();
        }
        const newNotification = {
          target: req.item._id,
          message: '$$ISN',
          isItem: true,
        };
        const notification = await Notification.create(newNotification);
        user.notifs.push(notification);
        await user.save();
        delete user.password;
        const accessToken = jwt.sign({user}, privateKey, {
          expiresIn: '10min',
          issuer: 'auth.devclub.in',
          algorithm: 'RS256',
        });
        // const refreshToken = jwt.sign({user}, privateKey);
        // res.status(200).send({accessToken, refreshToken});

        res.status(200).send(accessToken);
        await req.item.save();
        res.status(200).send(req.item);
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:id/sellFin',
  middleware.isLoggedIn,
  middleware.checkItem,
  async (req: express.Request, res: express.Response) => {
    try {
      if (req.body.accept) {
        req.item.status = 'SOLD';
        await req.item.save();
        res.send('Done');
      } else {
        req.item.status = 'UNSOLD';
        req.item.buy_date = undefined;
        req.item.buyer = undefined;
        const chats = await Chat.find({
          item: {_id: req.params.id, title: req.item.title},
        }).exec();
        for (const chat of chats) {
          chat.active = true;
          chat.save();
        }
        let notif = 'The item has been rejected by the buyer';
        if (req.body.accept) {
          notif = 'The item has been marked sold by the buyer';
        }
        const newNotification = {
          target: req.item._id,
          message: notif,
          isItem: true,
        };
        const notification = await Notification.create(newNotification);
        const seller = await User.findById(req.item.seller);
        seller.notifs.push(notification);
        await seller.save();
        await req.item.save();
        res.status(200).send(req.item);
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:id/resolve',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      item.isReported = false;
      await item.save();
      res.send('OK');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:id/report',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const item = await Item.findById(req.params.id).exec();
      item.isReported = true;
      await item.save();
      res.send('OK');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

export default router;
