import Item from '../models/item';
import Review from '../models/review';
import User from '../models/user';
import {Request, Response, NextFunction} from 'express';
import moment from 'moment';
import jwt from 'jsonwebtoken';
import auth from './auth.js';
import path from 'path';
import fs from 'fs';

function isLoggedIn(req: Request, res: Response, next: NextFunction) {
  if (!req.user.isBanned) {
    if (
      req.user.banExpires &&
      moment(req.user.banExpires) > moment(Date.now())
    ) {
      // req.flash('error', 'User has been banned temporarily');
      console.log('error, User has been banned temporarily');
      
      return res.status(500).send('/course');
    } else {
      return next();
    }
  } else {
    // req.flash('error', 'User has been banned permanently');
    console.log('error, User has been banned permanently');
    
    return res.status(500).send('/course');
  }
}

function checkReviewOwnership(req: Request, res: Response, next: NextFunction) {
  Review.findById(req.params.review_id, (err: Error, foundReview) => {
    if (err || !foundReview) {
      return res.status(500).send('back');
    } else {
      // does user own the review?
      if (foundReview.author._id === req.user._id || req.user.isAdmin) {
        return next();
      } else {
        console.log("error, You don't have permission to do that");
        // req.flash('error', "You don't have permission to do that");
        return res.status(500).send('back');
      }
    }
  });
}

async function checkUserReviewExistence(req: Request, res: Response, next: NextFunction) {
  const foundUser = await User.findById(req.params.id)
    .populate('reviews')
    .exec();
  if (!foundUser) {
    // req.flash('error', 'User not found.');
    console.log('error, User not found.');
    
    return res.status(500).send('back');
  } else {
    // check if req.user._id exists in foundCourse.reviews
    const foundUserReview = foundUser.reviews.some(
      review => review.author._id === req.user._id
    );
    if (foundUserReview) {
      // req.flash('error', 'You already wrote a review.');
      console.log('error', 'You already wrote a review.');
      return res.status(500).send('/users/' + foundUser.id);
    }
    // if the review was not found, go to the next middleware
    return next();
  }
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.isAdmin) {
    return next();
  } else {
    // req.flash(
    //   'error',
    //   'This site is now read only thanks to spam and trolls.'
    // );
    console.log('error',
      'This site is now read only thanks to spam and trolls.');
    
    return res.status(500).send('/item');
  }
}

export default {
  isLoggedIn: (req: Request, res: Response, next: NextFunction) =>
    auth(req, res, next, isLoggedIn),

  checkUserItem: (req: Request, res: Response, next: NextFunction) => {
    Item.findById(req.params.id).exec((err, foundItem) => {
      if (err || !foundItem) {
        console.log(err);
        // req.flash('error', 'Sorry, that course does not exist!');
        console.log('error', 'Sorry, that course does not exist!');
        
        res.status(500).send('/item');
      } else if (foundItem.seller === req.user._id || req.user.isAdmin) {
        req.item = foundItem;
        next();
      } else {
        // req.flash('error', "You don't have permission to do that!");
        console.log('error', "You don't have permission to do that!");
        
        res.status(500).send('/item/' + req.params.id);
      }
    });
  },

  checkItem: (req: Request, res: Response, next: NextFunction) => {
    Item.findById(req.params.id).exec(async (err, foundItem) => {
      if (err || !foundItem) {
        console.log(err);
        // req.flash('error', 'Sorry, that course does not exist!');
        console.log('error', 'Sorry, that course does not exist!');
        
        res.status(500).send('/item');
      } else if (foundItem.buyer._id === req.user._id) {
        req.item = foundItem;
        next();
      } else {
        // req.flash('error', "You don't have permission to do that!");
        console.log('error', "You don't have permission to do that!");
        
        res.status(500).send('/item/' + req.params.id);
      }
    });
  },

  isAdmin: (req: Request, res: Response, next: NextFunction) => auth(req, res, next, isAdmin),

  checkReviewOwnership: (req: Request, res: Response, next: NextFunction) =>
    auth(req, res, next, checkReviewOwnership),

  checkUserReviewExistence: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => auth(req, res, next, checkUserReviewExistence),

  checkRegister: async (req: Request, res: Response, next: NextFunction) => {
    const exp = /iitd\.ac\.in$/gm;
    if (!exp.test(req.body.email)) {
      next();
    } else {
      const kebid = /^(\w+)/gm;
      kebid.lastIndex = 0;
      const result: RegExpExecArray = kebid.exec(req.body.email);
      const user = await User.findOne({
        email: String(new RegExp(`^${result[0]}`, 'gm')),
      }).exec();
      if (user) {
        // req.flash(
        //   'error',
        //   'You are already registered with email ' + user.email
        // );
        console.log('error',
          'You are already registered with email ' + user.email);
        
        res.status(500).send('/register');
      } else {
        next();
      }
    }
  },

};
