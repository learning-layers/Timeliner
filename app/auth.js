"use strict";

const _ = require('lodash');
const config = require(__dirname + '/../config/config');
const jwt = require('jsonwebtoken');
const secret = config.app.secret;
const defaultSignOptions = {
  algorithm: config.app.jwt.algorithm || 'HS256',
  issuer: config.app.jwt.issuer || 'timeliner.app'
};
const defaultVerifyOptions = {
  algorithms: [config.app.jwt.algorithm || 'HS256'],
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
      this.throw(401, 'authorization_header_missing');
      return;
    }

    if ( !/^Bearer\s/i.test(this.header.authorization) ) {
      this.throw(401, 'malformed_or_wrong_authorization_header');
      return;
    }

    try {
      let decoded = verifyAuthToken(this.header.authorization.split(' ')[1]);
      // TODO Make sure to document the convention of where and how user unique
      // identifier is stored
      this.user = {
        _id: decoded.sub
      };
    } catch (err) {
      this.thow(401, 'token_verification_failed');
      return;
    }

    if ( this.user && this.user._id ) {
      return yield next;
    }
  },
  ensureUser: function *(next) {
    if ( !this.user || !this.user._id ) {
      this.throw(401, 'user_identifier_missing');
      return;
    }

    try {
      // TODO Make sure to document the convention on how the user unique
      // identirier is found and data is replaced with real User object
      this.user = yield User.findOne({ '_id': this.user._id }).exec();
    } catch (err) {
      this.throw(404, 'user_not_found');
      return;
    }

    if ( this.user ) {
      return yield next;
    }
  },
  ensureAdmin: function *(next) {
    if ( this.user && User.isAdmin(this.user) ) {
      return yield next;
    } else {
      this.throw(403, 'user_not_admin');
      return;
    }
  }
};
