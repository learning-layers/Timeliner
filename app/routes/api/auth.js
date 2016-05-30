"use strict";

var Router = require('koa-router');
var User = require('mongoose').model('User');
var bodyParser = require('koa-body')();
var crypto = require('crypto');
const auth = require(__dirname + '/../../auth');
const reCaptcha = require(__dirname + '/../../reCaptcha')();

module.exports = function (apiRouter, config) {

  var authRouter = new Router({ prefix: '/auth' });

  authRouter.post('/register', bodyParser, function *(){
    try {
      yield reCaptcha.verify(this.request.body.captchaResponse, this.request.ip);

      var user = new User({
        email: this.request.body.email.toLowerCase(),
        confirmationKey: {
          key: generateConfirmationKey(),
          created: new Date()
        },
        isActivated: false
      });

      user = yield User.createAccount(user);

      this.status = 201;
      this.body = {
        data: {
          email: user.email,
          key: user.confirmationKey.key
        }
      };
    } catch (err) {
      if(err.message == 'captcha_verification_invalid'){
        this.status = 401;
        this.body = {
          message: 'Captcha verification failed. Are you a robot?'
        };
      } else if(err.code == 11000){  // Mongo error code 11000 - duplicate key
        this.status = 409;
        this.body = {
          message: 'Email already registered'
        };
      } else {
        console.error(err);
        throw err;
      }
    }
  });

  authRouter.get('/confirm/:key', function *(){
    try {
      var user = yield User.findByConfirmationKey(this.params.key);
      this.status = 200;
      this.body = { email: user.email };
    } catch (error) {
      this.status = 404;
      this.body = { message: 'expired_or_missing' };
    }
  });

  authRouter.post('/confirm', bodyParser, function *(){
    try {
      var user = yield User.findByConfirmationKey(this.request.body.confirmationKey);
      user.password = this.request.body.password;
      user.name.first = this.request.body.name.first;
      user.name.last = this.request.body.name.last;

      user.confirmationKey = undefined;
      user.isActivated = true;

      user = yield user.save();
      yield user.updateLastLogin();
      this.body = {
        data: {
          user: user,
          token: auth.generateAuthToken({ sub: user._id })
        }
      };
    } catch (err) {
      console.error(err)
      // TODO Handle errors and respond correctly
      this.throw(500, 'internal_server_error');
    }
  });

  authRouter.post('/login', bodyParser, function *() {
    if ( !( this.request.body.email && this.request.body.password ) ) {
      this.status = 401;
      this.body = {
        message: 'credentials_missing'
      };
    } else {
      try {
        var user = yield User.matchUser(this.request.body.email, this.request.body.password);
        yield user.updateLastLogin();
        this.body = {
          data: {
            user: user,
            token: auth.generateAuthToken({ sub: user._id })
          }
        };
      } catch (err) {
        // TODO Better handling might be needed
        console.error(err);
        this.status = 401;
        this.body = {
          message: 'authentication_failed'
        };
      }
    }
  });

  authRouter.post('/login/social', bodyParser, function *() {
    let grantData, state;

    if ( !this.session.grant ) {
      this.throw(400, 'bad_request_');
      return;
    }

    grantData = this.session.grant;

    if ( !( this.request.body.state ) ) {
      this.throw(400, 'state_missing')
      return;
    }

    if ( this.request.body.state !== grantData.state ) {
      this.throw(400, 'wrong_state');
      return;
    }

    try {
      var user = yield User.findBySocialToken(grantData.provider, grantData.response.access_token);
      yield user.updateLastLogin();
      this.body = {
        data: {
          user: user,
          token: auth.generateAuthToken({ sub: user._id, social: true, provider: grantData.provider })
        }
      };

      this.session = null;
    } catch (err) {
      console.log(err); // TODO Remove me
      this.status = 401;
      this.body = {
        message: 'authentication_failed'
      };
    }
  });

  authRouter.get('/me', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.status = 200;
    this.body = {
      user: this.user
    }
  });

  apiRouter.use('', authRouter.routes(), authRouter.allowedMethods());
};

function generateConfirmationKey() {
  return crypto.randomBytes(20).toString('hex');
}
