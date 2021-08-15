import mongoose from 'mongoose';
import {MUser} from './user';
// eslint-disable-next-line @typescript-eslint/no-var-requires
// const voting = require('mongoose-voting');
import voting from "./voting.js"

export interface MReview extends mongoose.Document {
  rating: number;
  text: string;
  author: {username: string; _id: string};
  user: {username: string; _id: string};
  isReported: boolean;
  isAnonymous: boolean;
  upvoted: (user: MUser) => boolean;
  downvoted: (user: MUser) => boolean;
  unvote: (user: MUser) => void;
  upvote: (user: MUser) => void;
  downvote: (user: MUser) => void;
  upvotes: () => number;
  downvotes: () => number;
}

const reviewSchema = new mongoose.Schema(
  {
    rating: {
      // Setting the field type
      type: Number,
      // Making the star rating required
      required: 'Please provide a rating (1-5 stars).',
      // Defining min and max values
      min: 1,
      max: 5,
      // Adding validation to see if the entry is an integer
      validate: {
        // validator accepts a function definition which it uses for validation
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value.',
      },
    },
    // review text
    text: {
      type: String,
    },
    // author id and username fields
    author: {
      username: String,
      _id: String,
    },
    // user associated with the review
    user: {
      username: String,
      _id: String,
    },
    isReported: {type: Boolean, default: false},
    isAnonymous: {type: Boolean, default: false},
  },
  {
    // if timestamps are set to true, mongoose assigns createdAt and updatedAt fields to your schema, the type assigned is Date.
    timestamps: true,
  }
);

reviewSchema.plugin(voting);

export default mongoose.model<MReview>('Review', reviewSchema);
