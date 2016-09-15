"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const Annotation = require('mongoose').model('Annotation');
const Milestone = require('mongoose').model('Milestone');
const Task = require('mongoose').model('Task');
const Resource = require('mongoose').model('Resource');
const Outcome = require('mongoose').model('Outcome');
const bodyParser = require('koa-body')();
const Auth = require(__dirname + '/../../auth');
const Middleware = require(__dirname + '/../../lib/middleware');
const ObjectId = require('mongoose').Types.ObjectId;
const BBPromise = require("bluebird");
const fse = require('fs-extra');
const moveFile = BBPromise.promisify(fse.move);
const removeFile = BBPromise.promisify(fse.remove);

module.exports = function (apiRouter, config) {
  const bodyParserUpload = require('koa-body')({
    multipart: true,
    formidable: {
      multiples: false,
      uploadDir: config.app.fs.uploadDir
    }
  });

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

  const annotationPopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const milestonePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const taskPopulateOptions = [{
    path: 'creator',
    model: 'User'
  },{
    path : 'participants',
    model: 'Participant',
    populate: {
      path: 'user',
      model: 'User'
    }
  }];

  const resourcePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  // XXX There seems to be an issue with population of embedded versions
  const outcomePrepopulateOptions = [{
    path: 'creator',
    model: 'User',
  },{
    path: 'versions',
    populate: {
      path: 'creator',
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

      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  // TODO Consider moving these functionalities into standalone Router
  projectRouter.post('/:project/participants/invite/:user', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    // TODO Make sure that user parameter exists and is a user
    try {
      let participant = new Participant({
        user: this.params.user,
        project: this.params.project,
        status: 'pending'
      });

      participant = yield participant.save();
      yield Project.findByIdAndUpdate(this.params.project, {
        $push: {
          participants: participant._id
        }
      }).exec();
      participant = yield Participant.populate(participant, 'user');

      this.apiRespond(participant);
    } catch (err) {
      if ( err.code === 11000 ) {
        this.throw(409, 'already_is_a_participant');
        return;
      }

      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/participants/leave', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let project;

    try {
      project = Project.findOne({ _id: this.params.project }).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( project.owner.equals(this.user._id) ) {
      this.throw(403, 'owner_can_not_leave');
      return;
    }

    try {
      const participant = yield Participant.findOneAndRemove({ project: this.params.project, user: this.user._id }).exec();
      yield Project.findByIdAndUpdate(this.params.project, {
        $pull: {
          participants: ObjectId(participant._id)
        }
      }).exec();

      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/participants/accept', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
    try {
      yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { status: 'active' }).exec();

      // TODO See if responding with participant makes sense
      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/participants/reject', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
    try {
      yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { status: 'placeholder' }).exec();

      // TODO See if responding with participant makes sense
      this.apiRespond({
        _id: this.params.project
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/participants/remove/:user', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectOwner, function *() {
    let project, participant;

    try {
      project = Project.findOne({ _id: this.params.project }).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( project.owner.equals(this.user._id) ) {
      this.throw(403, 'owner_can_not_be_removed');
      return;
    }

    try {
      participant = yield Participant.findOneAndRemove({ project: this.params.project, user: this.params.user }).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !participant ) {
      this.throw(404, 'not_a_project_participant');
      return;
    }

    try {
      yield Project.findByIdAndUpdate(this.params.project, {
        $pull: {
          participants: ObjectId(participant._id)
        }
      }).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    this.apiRespond({
      _id: this.params.project
    });
  });

  projectRouter.post('/:project/timeline/hide', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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

  projectRouter.post('/:project/timeline/show', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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

  projectRouter.get('/:project/annotations', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const annotations = yield Annotation.find({ project: this.params.project }).sort({ created: 1 }).populate(annotationPopulateOptions).exec();

      this.apiRespond(annotations);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/annotations', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    if ( !(this.request.body.title && this.request.body.title.trim() && this.request.body.start) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.title.trim();
    const description = this.request.body.description;
    const start = new Date(this.request.body.start);

    try {
      let annotation = new Annotation({
        title: title,
        description: description,
        start: start,
        creator: this.user._id,
        project: this.params.project,
      });

      annotation = yield annotation.save();

      annotation = yield Annotation.populate(annotation, annotationPopulateOptions);

      this.emitApiAction('create', 'annotation', annotation);

      this.apiRespond(annotation);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/annotations/:annotation', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    let annotation;

    try {
      annotation = yield Annotation.findOne({ _id: this.params.annotation }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !annotation ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !annotation.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    if ( this.request.body.title ) {
      annotation.title = this.request.body.title.trim();
    } else {
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.description !== undefined ) {
      annotation.description = this.request.body.description;
    }
    if ( this.request.body.start ) {
      annotation.start = new Date(this.request.body.start);
    }

    try {
      annotation = yield annotation.save();

      annotation = yield Annotation.populate(annotation, annotationPopulateOptions);

      this.emitApiAction('update', 'annotation', annotation);

      this.apiRespond(annotation);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/annotations/:annotation', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let annotation;

    try {
      annotation = yield Annotation.findOne({ _id: this.params.annotation }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }

    if ( !annotation ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !annotation.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield annotation.remove();

      this.emitApiAction('delete', 'annotation', annotation);

      this.apiRespond(annotation);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/milestones', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const milestones = yield Milestone.find({ project: this.params.project }).sort({ created: 1 }).populate(milestonePopulateOptions).exec();

      this.apiRespond(milestones);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/milestones', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
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

      this.emitApiAction('create', 'milestone', milestone);

      this.apiRespond(milestone);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/milestones/:milestone', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
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

      this.emitApiAction('update', 'milestone', milestone);

      this.apiRespond(milestone);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/milestones/:milestone', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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

      this.emitApiAction('delete', 'milestone', milestone);

      this.apiRespond(milestone);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/tasks', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const tasks = yield Task.find({ project: this.params.project }).sort({ created: 1 }).populate(taskPopulateOptions).exec();

      this.apiRespond(tasks);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/tasks', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    if ( !(this.request.body.title && this.request.body.title.trim()) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.title.trim();
    const description = this.request.body.description;
    const start = this.request.body.start ? new Date(this.request.body.start) : undefined;
    const end = this.request.body.end ? new Date(this.request.body.end) : undefined;

    if ( ( start && !end ) || ( !start && end ) ) {
      this.throw(400, 'either_both_dates_or_none');
      return;
    }

    if ( start && end && end < start ) {
      this.throw(400, 'end_date_before_start');
      return;
    }

    try {
      let task = new Task({
        title: title,
        description: description,
        start: start,
        end: end,
        creator: this.user._id,
        project: this.params.project,
      });

      task = yield task.save();

      task = yield Task.populate(task, taskPopulateOptions);

      this.emitApiAction('create', 'task', task);

      this.apiRespond(task);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/tasks/:task', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    let task;

    try {
      task = yield Task.findOne({ _id: this.params.task }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !task ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !task.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    if ( this.request.body.title ) {
      task.title = this.request.body.title.trim();
    } else {
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.description !== undefined ) {
      task.description = this.request.body.description;
    }

    const start = this.request.body.start ? new Date(this.request.body.start) : undefined;
    const end = this.request.body.end ? new Date(this.request.body.end) : undefined;

    if ( ( start && !end ) || ( !start && end ) ) {
      this.throw(400, 'either_both_dates_or_none');
      return;
    }

    if ( start && end && end < start ) {
      this.throw(400, 'end_date_before_start');
      return;
    }

    if ( start && end ) {
      task.start = start;
      task.end = end;
    } else if ( start === undefined && end === undefined && task.start && task.end ) {
      task.start = start;
      task.end = end;
    }

    // TODO Check about connection to participant, resource and document
    try {
      task = yield task.save();

      task = yield Task.populate(task, taskPopulateOptions);

      this.emitApiAction('update', 'task', task);

      this.apiRespond(task);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/tasks/:task', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let task;

    try {
      task = yield Task.findOne({ _id: this.params.task }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !task ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !task.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield task.remove();

      this.emitApiAction('delete', 'task', task);

      this.apiRespond(task);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/resources', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const resources = yield Resource.find({ project: this.params.project }).sort({ created: 1 }).populate(resourcePopulateOptions).exec();

      this.apiRespond(resources);
    } catch (err) {
      console.error('Getting resource list failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/resources', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParserUpload, function *() {
    if ( !(this.request.body.fields.title && this.request.body.fields.title.trim()) ) {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.fields.title.trim();
    const description = this.request.body.fields.description;
    const url = this.request.body.fields.url ? this.request.body.fields.url : undefined;
    let file;

    if ( this.request.body.files.file ) {
      file = {
        size: this.request.body.files.file.size,
        name: this.request.body.files.file.name,
        type: this.request.body.files.file.type
      };
    } else {
      file = undefined;
    }

    if ( url && file ) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      this.throw(400, 'either_url_or_file_not_both');
      return;
    } else if ( !( url || file ) ) {
      this.throw(400, 'no_url_or_file_provided');
      return;
    }

    try {
      let resource = new Resource({
        title: title,
        description: description,
        url: url,
        file: file,
        creator: this.user._id,
        project: this.params.project,
      });

      resource = yield resource.save();

      resource = yield Resource.populate(resource, resourcePopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id));
        } catch (err) {
          console.error('Moving of uploaded resource file failed', err);
        }
      }

      this.emitApiAction('create', 'resource', resource);

      this.apiRespond(resource);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      console.error('Resource creation failed', err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/resources/:resource', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParserUpload, function *() {
    let resource, hasFile;

    try {
      resource = yield Resource.findOne({ _id: this.params.resource }).exec();
    } catch(err) {
      // XXX Need to remove uploaded file
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !resource ) {
      // XXX Need to remove uploaded file
      this.throw(404, 'not_found');
      return;
    }

    if ( !resource.project.equals(this.params.project) ) {
      // XXX Need to remove uploaded file
      this.throw(403, 'permission_error');
      return;
    }

    if ( this.request.body.fields.url && this.request.body.files.file ) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      this.throw(400, 'either_url_or_file_not_both');
      return;
    } else if ( !( this.request.body.fields.url || this.request.body.files.file ) ) {
      this.throw(400, 'no_url_or_file_provided');
      return;
    }

    hasFile = resource.file ? true : false;

    if ( this.request.body.fields.title ) {
      resource.title = this.request.body.fields.title.trim();
    } else {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.fields.description !== undefined ) {
      resource.description = this.request.body.fields.description;
    }

    if ( this.request.body.fields.url ) {
      resource.url = this.request.body.fields.url;

      // Remove file data from resource body, if required
      if ( hasFile ) {
        resource.file = undefined;
      }
    }

    if ( this.request.body.files.file ) {
      resource.file = {
        size: this.request.body.files.file.size,
        name: this.request.body.files.file.name,
        type: this.request.body.files.file.type
      };

      // Remove url data from resource body, if required
      if ( !hasFile ) {
        resource.url = undefined;
      }
    }

    try {
      resource = yield resource.save();

      resource = yield Resource.populate(resource, resourcePopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          // Move new file in, rewriting previous one; see the clobber option
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id), {
            clobber: true
          });
        } catch (err) {
          console.error('Moving new uploaded resource file failed', err);
        }
      }

      if ( hasFile && !resource.file ) {
        try {
          yield removeFile(config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id));
        } catch (err) {
          console.error('Removal of exisring resource file failed', err);
        }
      }

      this.emitApiAction('update', 'resource', resource);

      this.apiRespond(resource);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      console.error('Resource update failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/resources/:resource', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let resource;

    try {
      resource = yield Resource.findOne({ _id: this.params.resource }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !resource ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !resource.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield resource.remove();

      if ( resource.file ) {
        try {
          yield removeFile(config.app.fs.storageDir + '/' + resource.getFilePath());
        } catch(err) {
          console.error('Removal of existing resource file failed', err);
        }
      }

      this.emitApiAction('delete', 'resource', resource);

      this.apiRespond(resource);
    } catch (err) {
      console.error('Resource removal failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/outcomes', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const outcomes = yield Outcome.find({ project: this.params.project }).sort({ created: 1 }).populate(outcomePrepopulateOptions).exec();

      this.apiRespond(outcomes);
    } catch (err) {
      console.error('Getting outcome list failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/outcomes', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParserUpload, function *() {
    if ( !(this.request.body.fields.title && this.request.body.fields.title.trim() && this.request.body.files.file) ) {
      // XXX Remove uploaded file if present
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.fields.title.trim();
    const description = this.request.body.fields.description;
    const file = {
      size: this.request.body.files.file.size,
      name: this.request.body.files.file.name,
      type: this.request.body.files.file.type
    };

    try {
      let outcome = new Outcome({
        title: title,
        description: description,
        versions: [
          {
            file: file,
            creator: this.user._id
          }
        ],
        creator: this.user._id,
        project: this.params.project,
      });

      outcome = yield outcome.save();

      outcome = yield Outcome.populate(outcome, outcomePrepopulateOptions);

      try {
        // XXX Project is probably a full object, should make sesne to only use the _id attribute
        yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Outcome.createVersionFilePathMatrix(outcome.project, outcome._id, outcome.versions[0]._id));
      } catch (err) {
        console.error('Moving of uploaded outcome file failed', err);
      }

      this.emitApiAction('create', 'outcome', outcome);

      this.apiRespond(outcome);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded outcome file failed', err);
        }
      }
      console.error('Outcome creation failed', err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/outcomes/:outcome', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParserUpload, function *() {
    let outcome;

    try {
      outcome = yield Outcome.findOne({ _id: this.params.outcome }).exec();
    } catch(err) {
      console.error(err);
      // XXX Need to remove uploaded file
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !outcome ) {
      // XXX Need to remove uploaded file
      this.throw(404, 'not_found');
      return;
    }

    if ( this.request.body.fields.title ) {
      outcome.title = this.request.body.fields.title.trim();
    } else {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.fields.description !== undefined ) {
      outcome.description = this.request.body.fields.description;
    }

    if ( this.request.body.files.file ) {
      outcome.versions.push({
        file: {
          size: this.request.body.files.file.size,
          name: this.request.body.files.file.name,
          type: this.request.body.files.file.type
        },
        creator: this.user._id
      });
    }

    try {
      outcome = yield outcome.save();

      outcome = yield Outcome.populate(outcome, outcomePrepopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          // XXX Need a better way to determine last version
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Outcome.createVersionFilePathMatrix(outcome.project, outcome._id, outcome.versions[outcome.versions.length-1]._id));
        } catch (err) {
          console.error('Moving of uploaded outcome file failed', err);
        }
      }

      this.emitApiAction('update', 'outcome', outcome);

      this.apiRespond(outcome);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded outcome file failed', err);
        }
      }
      console.error('Outcome update failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/outcomes/:outcome', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let outcome;

    try {
      outcome = yield Outcome.findOne({ _id: this.params.outcome }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !outcome ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !outcome.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield outcome.remove();

      if ( outcome.versions ) {
        for ( let i = 0; i < outcome.versions.length; i++ ) {
          try {
            yield removeFile(config.app.fs.storageDir + '/' + outcome.getVersionFilePath(outcome.versions[i]._id));
          } catch(err) {
            console.error('Removal of existing resource file failed', err);
          }
        }
      }

      this.emitApiAction('delete', 'outcome', outcome);

      this.apiRespond(outcome);
    } catch (err) {
      console.error('Outcome removal failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
