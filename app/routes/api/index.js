"use strict";

var Router = require('koa-router');
var cors = require('kcors');

module.exports = function (app) {

  var apiRouter = new Router({ prefix: '/api' });

  //TODO cors should be only on api, not app
  app.use(cors());
  /*apiRouter.use(function *(next) {
    this.type = 'json';
    return yield next;
  });*/

  require(__dirname + '/hello')(apiRouter);
  require(__dirname + '/auth')(apiRouter);

  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};
