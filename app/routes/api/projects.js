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
    if ( !(this.request.body.title && this.request.body.title.trim() && this.request.body.start) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.title.trim();
    const start = new Date(this.request.body.start);
    const end = this.request.body.end ? new Date(this.request.body.end) : undefined;

    if ( end && end < start ) {
      this.throw(400, 'end_date_before_start');
      return;
    }

    try {
      let project = new Project({
        title: title,
        start: start,
        end: end,
        creator: this.user._id,
        owner: this.user._id,
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

  projectRouter.get('/:project/join', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  projectRouter.get('/:project/leave', auth.ensureAuthenticated, auth.ensureUser, function *() {
    this.throw(501, 'not_implemented');
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
