"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const bodyParser = require('koa-body')();
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (apiRouter, config) {

  // TODO Needs a bit more control over what kind of data is populated
  // Full user objects might not be needed. It could be enough to get:
  // _id, name and email (not sure of last one is really needed here)
  // Limiting amount of loaded data should be a wise choice
  const projectPopulateOptions = [{
    path: 'creator',
    model: 'User'
  },{
    path: 'owner',
    model: 'User'
  },{
    path : 'participants',
    model: 'Participant',
    populate: {
      path: 'user',
      model: 'User'
    }
  }];

  const projectRouter = new Router({ prefix: '/projects' });

  projectRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Auth.ensureAdmin, function *() {
    try {
      const projects = yield Project.find({}).sort({ created: 1 }).populate(projectPopulateOptions).exec();

      this.apiRespond(projects);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/mine', Auth.ensureAuthenticated, Auth.ensureUser, function *() {
    try {
      const ids = yield Participant.getUserProjects(this.user._id);
      // TODO Needs a bit more control over what kind of data is populated
      // Full user objects might not be needed. It could be enough to get:
      // _id, name and email (not sure of last one is really needed here)
      // Limiting amout of loaded data should be a wise choice
      const projects = yield Project.find({ _id: { $in: ids } }).sort({ created: 1 }).populate(projectPopulateOptions).exec();
      this.apiRespond(projects);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    let project;

    try {
      project = yield Project.findOne({ _id: this.params.project }).sort({ created: 1 }).populate(projectPopulateOptions).exec();

      this.apiRespond(project);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !project ) {
      this.throw(404, 'not_found');
    }
  });

  projectRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, bodyParser, function *() {
    if ( !(this.request.body.title && this.request.body.title.trim() && this.request.body.start) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.title.trim();
    const start = new Date(this.request.body.start);
    const end = this.request.body.end ? new Date(this.request.body.end) : undefined;
    const description = this.request.body.description ? this.request.body.description : '';
    const goal = this.request.body.goal ? this.request.body.goal : '';

    if ( end && end < start ) {
      this.throw(400, 'end_date_before_start');
      return;
    }

    try {
      let project = new Project({
        title: title,
        description: description,
        goal: goal,
        start: start,
        end: end,
        creator: this.user._id,
        owner: this.user._id,
        participants: []
      });

      project = yield project.save();

      let participant = new Participant({
        user: this.user._id,
        project: project._id,
        status: 'active'
      });

      // TODO Needs own error handler
      // Created project would be left hanging if this fails
      participant = yield participant.save();

      project.participants = [participant._id];

      // TODO Needs own error handler
      // Failing to create this one would crate issues
      project = yield project.save();
      // TODO Check it this could fail and effect others somehow
      project = yield Project.populate(project, projectPopulateOptions);

      this.emitApiAction('create', 'project', project, this.user);

      this.apiRespond(project);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    let project;

    try {
      project = yield Project.findOne({ _id: this.params.project }).exec();
    } catch(err) {
      console.error(err);
      this.thow(500, 'internal_server_error');
      return;
    }

    if ( !project ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( this.request.body.title ) {
      project.title = this.request.body.title.trim();
    } else {
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.description !== undefined ) {
      project.description = this.request.body.description;
    }
    if ( this.request.body.goal !== undefined ) {
      project.goal = this.request.body.goal;
    }
    if ( this.request.body.status ) {
      if ( !project.owner.equals(this.user._id) ) {
        this.throw(403, 'status_change_by_not_owner');
        return;
      }
      project.status = this.request.body.status;
    }
    if ( this.request.body.end ) {
      if ( this.request.body.end && this.request.body.end < project.start ) {
        this.throw(400, 'end_date_before_start');
        return;
      }
      project.end = new Date(this.request.body.end);
    } else if ( project.end ) {
      project.end = undefined;
    }

    try {
      project = yield project.save();

      project = yield Project.populate(project, projectPopulateOptions);

      this.emitApiAction('update', 'project', project, this.user);

      this.apiRespond(project);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectOwner, function *() {
    try {
      // TODO Need to see what happes if one of the queries fails
      // This would leave the system in a bad state
      yield Project.find({ _id: this.params.project }).remove().exec();
      yield Participant.find({ project: this.params.project }).remove().exec();

      this.emitApiAction('delete', 'project', {
        _id: this.params.project
      }, this.user);

      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/timeline/hide', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    try {
      yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { showOnTimeline: false }).exec();

      // TODO See if responding with participant makes sense
      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/timeline/show', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    try {
      yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { showOnTimeline: true }).exec();

      // TODO See if responding with participant makes sense
      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  require(__dirname + '/task')(projectRouter);
  require(__dirname + '/annotation')(projectRouter);
  require(__dirname + '/milestone')(projectRouter);
  require(__dirname + '/participant')(projectRouter);
  require(__dirname + '/resource')(projectRouter, config);
  require(__dirname + '/outcome')(projectRouter, config);
  require(__dirname + '/activity')(projectRouter);
  require(__dirname + '/message')(projectRouter);

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
