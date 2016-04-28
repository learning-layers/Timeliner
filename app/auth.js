"use strict";

const _ = require('lodash');
const config = require(__dirname + '/../config/config');
const jwt = require('jsonwebtoken');
const secret = config.app.secret;
const defaultSignOptions = {
  algorithm: config.app.jwt.algorithm || 'HS256',
  issuer: config.app.jwt.issuer || 'timeliner.app'
};
const defaultVerifyOptions = {
  algorithms: [config.app.jwt.algorithm || 'HS256'],
  issuer: config.app.jwt.issuer || 'timeliner.app'
};
const User = require('mongoose').model('User');

function generateAuthToken(payload) {
  let options = {
    audience: ['api'],
    expiresIn: '24h'
  };
  options = _.defaults(options, defaultSignOptions);

  return jwt.sign(payload, secret, options);
}

function verifyAuthToken(token) {
  let options = {
    audience: ['api']
  };
  options = _.defaults(options, defaultVerifyOptions);

  return jwt.verify(token, secret, options);
}

module.exports = {
  generateAuthToken: generateAuthToken,
  verifyAuthToken: verifyAuthToken,
  ensureAuthenticated: function *(next) {
    if ( !this.header || !this.header.authorization ) {
      this.status = 401;
      this.body = {
        message: 'authorization_header_missing'
      };
    }

    if ( !/^Bearer\s/i.test(this.header.authorization) ) {
      this.status = 401;
      this.body = {
        message: 'malformed_or_wrong_authorization_header'
      };
    }

    try {
      let decoded = verifyAuthToken(this.header.authorization.split(' ')[1]);
      // TODO Make sure to document the convention of where and how user unique
      // identifier is stored
      this.user = {
        _id: decoded.sub
      };
      return yield next;
    } catch (err) {
      // TODO Remove me
      console.log(err);
      this.status = 401;
      this.body = {
        message: 'token_verification_failed'
      };
    }
  },
  ensureUser: function *(next) {
    if ( !this.user || !this.user._id ) {
      this.status = 401;
      this.body = {
        message: 'user_missing'
      };
    }

    try {
      // TODO Make sure to document the convention on how the user unique
      // identirier is found and data is replaced with real User object
      var user = yield User.findOne({ '_id': this.user._id }).exec();
      // TODO A few check for user being activted and nit banned are needed
      this.user = user;
      return yield next;
    } catch (err) {
      this.status = 401;
      this.body = {
        message: 'user_not_found'
      };
    }
  }
};
