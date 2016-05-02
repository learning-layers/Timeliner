"use strict";

var Router = require('koa-router');
var User = require('mongoose').model('User');
var bodyParser = require('koa-body')();
var crypto = require('crypto');
const auth = require(__dirname + '/../../auth');
const reCaptcha = require(__dirname + '/../../reCaptcha')();

module.exports = function (apiRouter) {

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

      user = yield user.save();

      this.status = 201;
      this.body = {
        email: user.email,
        key: user.confirmationKey.key
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
      this.body = user;
    } catch (err) {
      console.log(err)
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
        this.body = {
          user: user,
          token: auth.generateAuthToken({ sub: user._id })
        };
      } catch (err) {
        console.log(err); // TODO Remove me
        this.status = 401;
        this.body = {
          message: 'authentication_failed'
        };
      }
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
