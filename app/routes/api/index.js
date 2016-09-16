"use strict";

const Router = require('koa-router');
const cors = require('kcors');
const mount = require('koa-mount');
const _ = require('lodash');


module.exports = function (app, config) {

  const apiRouter = new Router({ prefix: '/api' });

  app.use(mount('/api', cors({
    credentials: true
  })));

  apiRouter.use(function *(next) {
    this.apiRespond = function () {
      if (arguments.length === 1 && typeof arguments[0] === 'object'){
        this.status = 200;
        this.body = {
          data: arguments[0]
        };
      } else if (arguments.length === 2 && typeof arguments[0] === 'number'){
        this.status = arguments[0];
        this.body = {
          data: arguments[1]
        };
      } else if (arguments.length === 2 && typeof arguments[0] === 'object'){
        this.status = arguments[1];
        this.body = {
          data: arguments[0]
        };
      } else {
        throw new Error('Unsuitable api response');
      }
    };
    this.emitApiAction = function(eventType, contentType, data, actor) {
      this.app.emit(eventType + ':' + contentType, {
        data: data,
        actor: actor
      }, this);
    };
    yield next;
  });

  apiRouter.use(function *(next) {
    try {
      yield next;
    } catch (err) {
      this.status = err.status || 500;
      let responseBody = { errors: [] };
      if ( err.status ) {
        if ( _.isArray(err.message) ) {
          responseBody.errors = err.message;
        } else if ( typeof err.message === 'object' ) {
          responseBody.errors.push( err.message );
        } else {
          responseBody.errors.push({ message: err.message });
        }
      } else {
        responseBody.errors.push({ message: 'internal_server_error' });
      }
      this.body = responseBody;
      this.app.emit('error', err, this);
    }
  });

  require(__dirname + '/hello')(apiRouter);
  require(__dirname + '/auth')(apiRouter, config);
  require(__dirname + '/user')(apiRouter);
  require(__dirname + '/project')(apiRouter, config);

  app.use(apiRouter.routes());
  app.use(apiRouter.allowedMethods());
};
