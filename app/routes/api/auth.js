"use strict";

var Router = require('koa-router');
var User = require('mongoose').model('User');
var bodyParser = require('koa-body')();
var crypto = require('crypto');

module.exports = function (apiRouter) {

  var authRouter = new Router({ prefix: '/auth' });

  authRouter.post('/register', bodyParser, function *(){
    try {
      var user = new User({
        email: this.request.body.email,
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
      this.status = 409;
      this.body = {
        message: 'Email already registered'
      };
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

  apiRouter.use('', authRouter.routes(), authRouter.allowedMethods());
};

function generateConfirmationKey() {
  return crypto.randomBytes(20).toString('hex');
}
