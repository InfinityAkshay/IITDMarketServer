// middleware function to use to interact with auth server
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId;

const url = 'mongodb://localhost:27017/';
const dbname = 'casi';

// SSO Url for refreshing tokens that are about to expire
const SSO_Refresh_URL = 'https://auth.devclub.in/auth/refresh-token';
const SSO_Login_URL = 'https://auth.devclub.in/user/login?serviceURL=';

// Client url, this string should be equal to the exact base URL of the client
const clientURL = 'http://localhost:5000';

const accessTokenName = 'token'; // The default JWT token name
const refreshTokenName = 'rememberme'; // Name for remember me style tokens

const publicKey = fs.readFileSync(path.resolve(__dirname, '../public.pem')); // Public Key path

// Max time remaining for token expiry, after which a refresh request will be sent to the SSO for refreshing the token
const maxTTL = 2 * 60; // 5 minutes

// Url for handling redirects, if none is provided than the user will automatically be redirected
// to the SSO Login Page
const redirectURL = '/';
// Array of public paths, these paths will be available without logging in and even for users that do not have sufficient permisisons
const publicPaths = ['^/public.*', '^/asset.*', '^/$'];

const logoutPath = '/logout';

const UnauthorizedHandler = (req, res) => {
  // return res
  //   .status(401)
  //   .send('Alas You are out of scope! Go get some more permissions dude');
  // req.flash('error', 'You must be signed in to do that!');
  console.log('error', 'You must be signed in to do that!');
  return res.status(500).send('/login');
};

const ROLES = {
  '^/admin.*': ['admin'],
};

const defaultRoles = ['external_user'];

const auth = async (req, res, next, todo) => {
  return next();
  // Extract tokens from cookies
  const token = req.cookies[accessTokenName];
  const refreshToken = req.cookies[refreshTokenName];

  try {
    let decoded;
    if (!token) {
      if (!refreshToken) {
        // req.flash('error', 'You must be signed in to do that!');
        console.log('error', 'You must be signed in to do that!');
        res.status(500).send('back');
      }
      decoded = await jwt.verify(refreshToken, publicKey, {
        algorithms: ['RS256'],
      });

      // Send a refresh request to the SSO Server if the time remaining is less than maxTTL
      const response = await axios.post(SSO_Refresh_URL, {
        rememberme: refreshToken,
      });
      res.setHeader('set-cookie', response.headers['set-cookie']);
    } else {
      decoded = await jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
      });
      const tokenAgeRemaining = decoded.exp - Math.floor(Date.now() / 1000);
      if (tokenAgeRemaining <= maxTTL) {
        console.log('refreshing token, since it is about to expire!');
        const response = await axios.post(SSO_Refresh_URL, {token});
        res.setHeader('set-cookie', response.headers['set-cookie']);
      }
    }
    if (req.path === logoutPath) {
      throw Error('Logout');
    }
    let casiUser;
    // console.log(123);
    if (decoded.user.casiID == undefined) {
      console.log('error', 'User is not CASI');
      return UnauthorizedHandler(req, res);
    }

    MongoClient.connect(url, (err, client) => {

      assert.equal(err, null);

      console.log('Connected correctly to server');

      const db = client.db(dbname);
      const collection = db.collection("users");

      // find by id
      collection.findOne(
        {
          _id: ObjectId(decoded.user.casiID),
        },
        async (err, item) => {
          // console.log(item);
          assert.equal(err, null);
          if (item) {
            console.log(item);
            if (isAuthorized(req, item)) {
              console.log(decoded.user);
              req.user = decoded.user;
              return await todo(req, res, next);
            } else return UnauthorizedHandler(req, res);
            // console.log({ item, casiUser });
          }
          else {
            res.send("/login");
          }
          client.close();
        }
      );
    });
    // console.log(casiUser);
    // if(casiUser == undefined){
    //   console.log('error', 'User is not CASI. something is wrong');
    //   return UnauthorizedHandler(req, res);
    // }

    
    
  } catch (error) {
    console.log(error);
    req.user = null;
    res.clearCookie(accessTokenName, {
      domain: process.env.NODE_ENV !== 'DEV' ? 'devclub.in' : null,
    });
    res.clearCookie(refreshTokenName, {
      domain: process.env.NODE_ENV !== 'DEV' ? 'devclub.in' : null,
    });
    // If the requested URL is a public path, proceed without any checks
    if (
      publicPaths.find(pathRegex => {
        return new RegExp(pathRegex).test(req.originalUrl);
      }) !== undefined
    ) {
      next();
    } else {
      if (redirectURL != null) res.redirect(redirectURL);
      else res.redirect(SSO_Login_URL + clientURL + req.originalUrl);
    }
  }
};

const isAuthorized = (req, user) => {
  // console.log(user)
  if (
    publicPaths.find(pathRegex => {
      return new RegExp(pathRegex).test(req.url);
    }) !== undefined
  )
    return true;
  const match = Object.keys(ROLES).find(pathRegex => {
    return new RegExp(pathRegex).test(req.url);
  });
  if (match) {
    for (const index in ROLES[match]) {
      if (!user.roles.includes(ROLES[match][index])) return false;
    }
    return true;
  }

  for (const index in defaultRoles) {
    if (!user.roles.includes(defaultRoles[index])) return false;
  }
  return true;
};

module.exports = auth;
