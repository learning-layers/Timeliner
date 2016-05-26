"use strict";

const Router = require('koa-router');
const User = require('mongoose').model('User');
const auth = require(__dirname + '/../../auth');

module.exports = function (apiRouter) {
  const userRouter = new Router({ prefix: '/users' });

  userRouter.get('/', auth.ensureAuthenticated, auth.ensureUser, auth.ensureAdmin, function *() {
    try {
      const users = yield User.find({}).exec();

      this.status = 200;
      this.body = {
        data: users
      };
    } catch(err) {
      this.throw(500, 'internal_server_error');
    }
  });

  apiRouter.use('', userRouter.routes(), userRouter.allowedMethods());
};
