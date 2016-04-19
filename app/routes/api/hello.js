"use strict";

var Router = require('koa-router');

module.exports = function (apiRouter) {

  var helloRouter = new Router({ prefix: '/hello' });

  helloRouter.get('/', function *(){
    this.body = "Hello world!";
  });
  helloRouter.get('/:name', function *(){
    this.body = "Hello " + this.params.name + "!";
  });

  apiRouter.use('', helloRouter.routes(), helloRouter.allowedMethods());
};
