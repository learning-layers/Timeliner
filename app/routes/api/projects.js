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

  projectRouter.post('/', auth.ensureAuthenticated, auth.ensureUser, bodyParser, function *() {
    try {
      let project = new Project({
        title: this.request.body.title,
        start: new Date(this.request.body.start),
        end: new Date(this.request.body.end),
        creator: this.user._id,
        participants: [this.user._id]
      });

      project = yield project.save();

      this.status = 200;
      this.body = {
        data: {
          project: project
        }
      };
    } catch(err) {
      console.log('Create project', err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.delete('/:project', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
