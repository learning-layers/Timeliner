"use strict";

var Router = require('koa-router');
var User = require('mongoose').model('User');
var bodyParser = require('koa-body')();
var bcrypt   = require('bcrypt-nodejs');

module.exports = function (apiRouter) {

  var authRouter = new Router({ prefix: '/auth' });

  authRouter.post('/register', bodyParser, function *(){
    var user = new User({ email: this.request.body.email });
    try {
      user = yield user.save();
    } catch (err) {
      user = err;
    }
    this.body = user;
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
    console.log(this.request.body);

    try {
      var user = yield User.findByConfirmationKey(this.request.body.confirmationKey);
      user.password = this.request.body.password;
      user.name.first = this.request.body.name.first;
      user.name.last = this.request.body.name.last;

      user.confirmationKey = undefined;

      user = yield user.save();
      this.body = user;
    } catch (err) {
      console.log(err)
    }

  });

  apiRouter.use('', authRouter.routes(), authRouter.allowedMethods());
};

function generateConfirmationKey() {
  return 's';
}
