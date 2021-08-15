import mongoose from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';
import {PassportLocalSchema} from 'mongoose';
import {MReview} from './review';
import {MNotification} from './notification';
import bcrypt from 'bcrypt';

const SALT_WORK_FACTOR = 10;

export interface MUser extends mongoose.Document {
  username: string;
  password: string;
  avatar: string;
  contact_number: string;
  entry_number: string;
  hostel: string;
  chatPersons: {username: string; _id: string}[];
  firstName: string;
  lastName: string;
  email: string;
  isBanned: boolean;
  banExpires: Date;
  isAdmin: boolean;
  description: string;
  notifs: MNotification[];
  reviews: MReview[];
  rating: number;
  folCategory: string[];
  isverified: boolean;
  roles: string[];
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new mongoose.Schema(
  {
    username: {type: String, unique: true, required: true},
    password: String,
    avatar: String,
    contact_number: String,
    entry_number: String,
    hostel: {
      type: String,
      enum: [
        'KAILASH',
        'HIMADRI',
        'KUMAON',
        'JWALAMUKHI',
        'ARAVALI',
        'KARAKORAM',
        'NILGIRI',
        'VINDHYACHAL',
        'SHIVALIK',
        'ZANSKAR',
        'SATPURA',
        'GIRNAR',
        'UDAIGIRI',
      ],
    },
    chatPersons: [
      {
        username: String,
        _id: String,
      },
    ],
    firstName: String,
    lastName: String,
    email: {type: String, required: true, unique: true},
    isBanned: {type: Boolean, default: false},
    banExpires: Date,
    isAdmin: {type: Boolean, default: false},
    description: String,
    notifs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Notification',
      },
    ],
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Review',
      },
    ],
    rating: {
      type: Number,
      default: 0,
    },
    folCategory: [
      {
        type: String,
        enum: ['GENERAL', 'COOLER', 'LAPTOP', 'CYCLE', 'MATTRESS'],
        trim: true,
      },
    ],
    isverified: {
      type: Boolean,
      default: false,
    },

    roles: {
      type: [String],
      default: ['external_user'],
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre('save', function (next) {
  var user = this as MUser;

  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();

  // generate a salt
  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err);

    // hash the password using our new salt
    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err);
      // override the cleartext password with the hashed one
      user.password = hash;
      next();
    });
  });
});

UserSchema.methods.comparePassword = async function (password: string) {
  return bcrypt.compare(password, this.password);
};

// UserSchema.plugin(passportLocalMongoose);

// export default mongoose.model<MUser>('User', UserSchema as PassportLocalSchema);

export default mongoose.model<MUser>('User', UserSchema);
