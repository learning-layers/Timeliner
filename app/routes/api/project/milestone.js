"use strict";

const Router = require('koa-router');
const Milestone = require('mongoose').model('Milestone');
const bodyParser = require('koa-body')();
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (projectRouter) {

  const milestonePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const milestonesRouter = new Router({ prefix: '/:project/milestones' });

  milestonesRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const milestones = yield Milestone.find({ project: this.params.project }).sort({ created: 1 }).populate(milestonePopulateOptions).exec();

      this.apiRespond(milestones);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  milestonesRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    if ( !(this.request.body.title && this.request.body.title.trim() && this.request.body.start && this.request.body.color) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.title.trim();
    const description = this.request.body.description;
    const start = new Date(this.request.body.start);
    const color = this.request.body.color;

    try {
      let milestone = new Milestone({
        title: title,
        description: description,
        start: start,
        color: color,
        creator: this.user._id,
        project: this.params.project,
      });

      milestone = yield milestone.save();

      milestone = yield Milestone.populate(milestone, milestonePopulateOptions);

      this.emitApiAction('create', 'milestone', milestone, this.user);

      this.apiRespond(milestone);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  milestonesRouter.put('/:milestone', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    let milestone;

    try {
      milestone = yield Milestone.findOne({ _id: this.params.milestone }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !milestone ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !milestone.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    if ( this.request.body.title ) {
      milestone.title = this.request.body.title.trim();
    } else {
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.description !== undefined ) {
      milestone.description = this.request.body.description;
    }
    if ( this.request.body.start ) {
      milestone.start = new Date(this.request.body.start);
    }
    if ( this.request.body.color ) {
      milestone.color = this.request.body.color;
    }

    try {
      milestone = yield milestone.save();

      milestone = yield Milestone.populate(milestone, milestonePopulateOptions);

      this.emitApiAction('update', 'milestone', milestone, this.user);

      this.apiRespond(milestone);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  milestonesRouter.delete('/:milestone', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let milestone;

    try {
      milestone = yield Milestone.findOne({ _id: this.params.milestone }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !milestone ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !milestone.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield milestone.remove();

      this.emitApiAction('delete', 'milestone', milestone, this.user);

      this.apiRespond(milestone);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', milestonesRouter.routes(), milestonesRouter.allowedMethods());
};
