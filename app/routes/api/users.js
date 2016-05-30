"use strict";

const Router = require('koa-router');
const User = require('mongoose').model('User');
const auth = require(__dirname + '/../../auth');
const bodyParser = require('koa-body')();

module.exports = function (apiRouter) {
  const userRouter = new Router({ prefix: '/users' });

  userRouter.get('/', auth.ensureAuthenticated, auth.ensureUser, auth.ensureAdmin, function *() {
    try {
      const users = yield User.find({}).exec();

      this.apiRespond(users);
    } catch(err) {
      this.throw(500, 'internal_server_error');
    }
  });

  userRouter.get('/kala', function *() {
    this.throw(501, 'not_implemented');
  });

  userRouter.put('/:user/manage/admin', auth.ensureAuthenticated, auth.ensureUser, auth.ensureAdmin, bodyParser, function *() {
    let user, isAdmin;

    isAdmin = this.request.body.isAdmin;

    if ( isAdmin !== true && isAdmin !== false ) {
      this.throw(400, 'unknown_value');
    }

    if ( isAdmin === false && this.user._id.toString() === this.params.user ) {
      this.throw(403, 'can_not_remove_own_admin');
    }

    try {
      user = yield User.findOne({ _id: this.params.user }).exec();
    } catch (err) {
      // TODO Use some logger library
      console.error(err);
      this.throw(500, 'internal_server_error');
    }

    if ( !user ) {
      this.throw(404, 'user_not_found');
    }

    if ( isAdmin === false && user.isAdmin === false ) {
      this.throw(403, 'not_an_admin');
    } else if ( isAdmin === true && user.isAdmin === true ) {
      this.throw(403, 'already_an_admin');
    }

    try {
      if ( isAdmin === true ) {
        user = yield user.addAdmin();
      } else {
        user = yield user.removeAdmin();
      }
    } catch(err) {
      // TODO Use some logger library
      console.error(err);
      this.throw(500, 'internal_server_error');
    }

    this.apiRespond({
      _id: user._id,
      isAdmin: user.isAdmin
    });
  });

  apiRouter.use('', userRouter.routes(), userRouter.allowedMethods());
};
