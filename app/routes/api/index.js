"use strict";

var Router = require('koa-router');
var cors = require('kcors');

module.exports = function (app) {

  var apiRouter = new Router({ prefix: '/api' });

  //TODO cors should be only on api, not app
  app.use(cors());

  require(__dirname + '/hello')(apiRouter);
  require(__dirname + '/auth')(apiRouter);

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

  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};
