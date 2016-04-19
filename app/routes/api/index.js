"use strict";

var Router = require('koa-router');

module.exports = function (app) {

  var apiRouter = new Router({ prefix: '/api' });

  require(__dirname + '/hello')(apiRouter);

  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};
