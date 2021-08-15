import express from 'express';
const router = express.Router({mergeParams: true});
import Review, {MReview} from '../models/review';
import User from '../models/user';
import Notification from '../models/notification';
import middleware from '../middleware';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const privateKey = fs.readFileSync(path.resolve(__dirname, '../private.pem'));

// Reviews Index
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    const user = await await User.findById(req.params.id)
    .populate({
      path: 'reviews',
      options: {sort: {createdAt: -1}}, // sorting the populated reviews array to show the latest first
    })
    .exec()
    if(!user){
      res.status(500).send("User not found");
    }
    res.status(200).json(user.reviews);
  } catch (err) {
    res.status(500).send(err.message);
  }
  // await User.findById(req.params.id)
  //   .populate({
  //     path: 'reviews',
  //     options: {sort: {createdAt: -1}}, // sorting the populated reviews array to show the latest first
  //   })
  //   .exec((err, user) => {
  //     if (err || !user) {
  //       res.status(500).send(err.message);
  //     }
  //     res.status(200).json(user.reviews);
  //   });
});

// Reviews Create
router.post(
  '/',
  middleware.isLoggedIn,
  middleware.checkUserReviewExistence,
  async (req: express.Request, res: express.Response) => {
    try {
      //lookup course using ID
      const user = await User.findById(req.params.id)
        .populate('reviews')
        .populate('notifs')
        .exec();
      const review = await Review.create(req.body.review);
      // console.log(review);
      
      //add author username/id and associated course to the review
      // review.author={username: req.user.username, _id: req.user._id};
      review.author.username = req.user.username;
      review.author._id = req.user._id;
      review.user.username = user.username;
      review.user._id = user._id;
      //save review
      await review.save();
      user.reviews.push(review);
      // calculate the new average review for the course
      user.rating = calculateAverage(user.reviews);
      //save course
      const newNotification = {
        target: user._id,
        message: 'Review has been added successfully',
        isItem: false,
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
    } catch (err) {
      console.log(err);
      res.send(500).status(err.message);
    }
  }
);

//calculates average
const calculateAverage = (reviews: MReview[]) => {
  if (reviews.length === 0) {
    return 0;
  }
  let sum = 0;
  reviews.forEach(element => {
    sum += element.rating;
  });
  return sum / reviews.length;
};

// Reviews Update
router.put(
  '/:review_id',
  middleware.isLoggedIn,
  middleware.checkReviewOwnership,
  async (req: express.Request, res: express.Response) => {
    try {
      await Review.findByIdAndUpdate(req.params.review_id, req.body.review, {
        new: true,
      }).exec();
      const user = await User.findById(req.params.id)
        .populate('reviews')
        .exec();
      // recalculate course average
      user.rating = calculateAverage(user.reviews);
      //save changes
      const newNotification = {
        targetSlug: user._id,
        message: 'Review has been updated successfully',
        isItem: false,
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

      res.status(200).send({accessToken, reviews:user.reviews});
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

// Reviews Delete
router.delete(
  '/:review_id',
  middleware.isAdmin,
  async (req: express.Request, res: express.Response) => {
    try {
      await Review.findByIdAndRemove(req.params.review_id).exec();
      const user = await User.findByIdAndUpdate(
        req.params.id,
        {$pull: {reviews: req.params.review_id}},
        {new: true}
      )
        .populate('reviews')
        .exec();
      // recalculate course average
      user.rating = calculateAverage(user.reviews);
      const newNotification = {
        target: user._id,
        message: 'Review has been deleted successfully',
        isItem: false,
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
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:review_id/report',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const review = await Review.findById(req.params.review_id).exec();
      review.isReported = true;
      await review.save();
      res.send('OK');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:review_id/resolve',
  middleware.isAdmin,
  async (req: express.Request, res: express.Response) => {
    try {
      const review = await Review.findById(req.params.review_id).exec();
      review.isReported = false;
      await review.save();
      res.send('OK');
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:review_id/upvote',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {      
      const review = await Review.findById(req.params.review_id).exec();
      if (review.upvoted(req.user._id)) {
        review.unvote(req.user._id);
        await review.save();
        res
          .status(200)
          .json({votes: review.upvotes() - review.downvotes(), upvoted: false});
      } else if (review.downvoted(req.user._id)) {
        review.unvote(req.user._id);
        await review.save();
        review.upvote(req.user._id);
        await review.save();
        res
          .status(200)
          .json({votes: review.upvotes() - review.downvotes(), upvoted: true});
      } else {
        review.upvote(req.user._id);
        await review.save();
        res
          .status(200)
          .json({votes: review.upvotes() - review.downvotes(), upvoted: true});
      }
    } catch (err) {      
      res.status(500).send(err.message);
    }
  }
);

router.patch(
  '/:review_id/downvote',
  middleware.isLoggedIn,
  async (req: express.Request, res: express.Response) => {
    try {
      const review = await Review.findById(req.params.review_id).exec();
      if (review.downvoted(req.user._id)) {
        review.unvote(req.user._id);
        await review.save();
        res.status(200).json({
          votes: review.upvotes() - review.downvotes(),
          downvoted: false,
        });
      } else if (review.downvoted(req.user._id)) {
        review.unvote(req.user._id);
        await review.save();
        review.downvote(req.user._id);
        await review.save();
        res.status(200).json({
          votes: review.upvotes() - review.downvotes(),
          downvoted: true,
        });
      } else {
        review.downvote(req.user._id);
        await review.save();
        res.status(200).json({
          votes: review.upvotes() - review.downvotes(),
          downvoted: true,
        });
      }
    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);

// router.get(
//   '/:review_id/votes',
//   async (req: express.Request, res: express.Response) => {
//     let review = await Review.findById(req.params.review_id).exec();
//     res.status(200).json(review.upvotes() - review.downvotes());
//   }
// );

export default router;
