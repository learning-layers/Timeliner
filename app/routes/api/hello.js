"use strict";

const Router = require('koa-router');

module.exports = function (apiRouter) {

  const helloRouter = new Router({ prefix: '/hello' });

  helloRouter.get('/', function *(){
    this.apiRespond({
      message: "Hello world!"
    });
  });
  helloRouter.get('/:name', function *(){
    this.apiRespond({
      message: "Hello " + this.params.name + "!"
    });
  });

  helloRouter.post('/', function *(){
    this.apiRespond({
      message: "Hello POST"
    });
  });

  apiRouter.use('', helloRouter.routes(), helloRouter.allowedMethods());
};
