"use strict";

var Router = require('koa-router');

module.exports = function (app) {

  var apiRouter = new Router({ prefix: '/api' });
  var helloRouter = new Router({ prefix: '/hello' });

  helloRouter.get('/', function *(){
    this.body = "Hello world!";
  });
  helloRouter.get('/:name', function *(){
    this.body = "Hello " + this.params.name + "!";
  });


  apiRouter.use('', helloRouter.routes(), helloRouter.allowedMethods());
  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};