"use strict";

const Router = require('koa-router');
const cors = require('kcors');
const mount = require('koa-mount');


module.exports = function (app, config) {

  var apiRouter = new Router({ prefix: '/api' });

  app.use(mount('/api', cors({
    credentials: true
  })));

  apiRouter.use(function *(next) {
    try {
      yield next;
    } catch (err) {
      this.status = err.status || 500;
      let responseBody = { message: 'internal_server_error' };
      if ( err.status ) {
        if ( typeof err.message === 'object' ) {
          responseBody = err.message;
        } else {
          responseBody.message = err.message;
        }
      }
      this.body = responseBody;
      this.app.emit('error', err, this);
    }
  });

  require(__dirname + '/hello')(apiRouter);
  require(__dirname + '/auth')(apiRouter, config);
  require(__dirname + '/users')(apiRouter);
  require(__dirname + '/projects')(apiRouter);

  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};
