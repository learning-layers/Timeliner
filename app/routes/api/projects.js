"use strict";

var Router = require('koa-router');
var Project = require('mongoose').model('Project');
var bodyParser = require('koa-body')();
const auth = require(__dirname + '/../../auth');

module.exports = function (apiRouter) {

  var projectRouter = new Router({ prefix: '/projects' });

  projectRouter.get('/', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.get('/:project', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.post('/', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.put('/:project', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.delete('/:project', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
