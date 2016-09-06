"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const Annotation = require('mongoose').model('Annotation');
const Milestone = require('mongoose').model('Milestone');
const Task = require('mongoose').model('Task');
const Resource = require('mongoose').model('Resource');
const bodyParser = require('koa-body')();
const auth = require(__dirname + '/../../auth');
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
  }];

  const resourcePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const ensureProjectOwner = function *(next) {
    let project;

    try {
      project = Project.findOne({ _id: this.params.project }).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !project ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( project.owner !== this.user._id ) {
      this.throw(403, 'not_a_project_owner');
      return;
    }

    return yield next;
  };

  const ensureProjectAccessRight = function *(next) {
    let participant;

    try {
      participant = yield Participant.getProjectParticipant(this.params.project, this.user._id);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !participant ) {
      this.throw(403, 'not_a_project_participant');
      return;
    }

    return yield next;
  };

  const ensureActiveProjectParticipant = function *(next) {
    let participant;

    try {
      participant = yield Participant.getProjectActiveParticipant(this.params.project, this.user._id);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !participant ) {
      this.throw(403, 'not_a_project_participant');
      return;
    }

    return yield next;
  };

  const ensurePendingProjectParticipant = function *(next) {
    let participant;

    try {
      participant = yield Participant.getProjectPendingParticipant(this.params.project, this.user._id);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !participant ){
      this.throw(403, 'not_a_project_participant');
      return;
    }

    return yield next;
  };

  const projectRouter = new Router({ prefix: '/projects' });

  projectRouter.get('/', auth.ensureAuthenticated, auth.ensureUser, auth.ensureAdmin, function *() {
    try {
      const projects = yield Project.find({}).populate(projectPopulateOptions).exec();

      this.apiRespond(projects);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/mine', auth.ensureAuthenticated, auth.ensureUser, function *() {
    try {
      const ids = yield Participant.getUserProjects(this.user._id);
      // TODO Needs a bit more control over what kind of data is populated
      // Full user objects might not be needed. It could be enough to get:
      // _id, name and email (not sure of last one is really needed here)
      // Limiting amout of loaded data should be a wise choice
      const projects = yield Project.find({ _id: { $in: ids } }).populate(projectPopulateOptions).exec();
      this.apiRespond(projects);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.get('/:project/', auth.ensureAuthenticated, auth.ensureUser, ensureProjectAccessRight, function *() {
    let project;

    try {
      project = yield Project.findOne({ _id: this.params.project }).populate(projectPopulateOptions).exec();

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

  projectRouter.put('/:project', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.delete('/:project', auth.ensureAuthenticated, auth.ensureUser, ensureProjectOwner, function *() {
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
  projectRouter.post('/:project/participants/invite/:user', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.post('/:project/participants/leave', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.post('/:project/participants/accept', auth.ensureAuthenticated, auth.ensureUser, ensurePendingProjectParticipant, function *() {
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

  projectRouter.post('/:project/participants/reject', auth.ensureAuthenticated, auth.ensureUser, ensurePendingProjectParticipant, function *() {
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

  projectRouter.post('/:project/participants/remove/:user', auth.ensureAuthenticated, auth.ensureUser, ensureProjectOwner, function *() {
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

  projectRouter.post('/:project/timeline/hide', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.post('/:project/timeline/show', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.get('/:project/annotations', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
    try {
      const annotations = yield Annotation.find({ project: this.params.project }).populate(annotationPopulateOptions).exec();

      this.apiRespond(annotations);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/annotations', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.put('/:project/annotations/:annotation', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.delete('/:project/annotations/:annotation', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.get('/:project/milestones', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
    try {
      const milestones = yield Milestone.find({ project: this.params.project }).populate(milestonePopulateOptions).exec();

      this.apiRespond(milestones);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/milestones', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.put('/:project/milestones/:milestone', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.delete('/:project/milestones/:milestone', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.get('/:project/tasks', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
    try {
      const tasks = yield Task.find({ project: this.params.project }).populate(taskPopulateOptions).exec();

      this.apiRespond(tasks);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/tasks', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.put('/:project/tasks/:task', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

  projectRouter.delete('/:project/tasks/:task', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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

  projectRouter.get('/:project/resources', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
    try {
      const resources = yield Resource.find({ project: this.params.project }).populate(resourcePopulateOptions).exec();

      this.apiRespond(resources);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.post('/:project/resources', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParserUpload, function *() {
    if ( !(this.request.body.fields.title && this.request.body.fields.title.trim()) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.fields.title.trim();
    const description = this.request.body.fields.description;
    const url = this.request.body.fields.url ? this.request.body.fields.url : undefined;
    let file;

    // XXX Need to make sure that either URL or file is provided
    // XXX Both are not allowed
    if ( this.request.body.files.file ) {
      file = {
        size: this.request.body.files.file.size,
        name: this.request.body.files.file.name,
        type: this.request.body.files.file.type
      };
    } else {
      file = undefined;
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
        // XXX Need to handle errors and probably remove the task that has just been created
        yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + resource._id);
      }

      this.emitApiAction('create', 'resource', resource);

      this.apiRespond(resource);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        // XXX Need to handle errors
        // Probably just catch any and send those to logger/debudder
        yield removeFile(this.request.body.files.file.path);
      }
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.put('/:project/resources/:resource', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, bodyParser, function *() {
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

    if ( this.request.body.title ) {
      resource.title = this.request.body.title.trim();
    } else {
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.description !== undefined ) {
      resource.description = this.request.body.description;
    }

    try {
      resource = yield resource.save();

      resource = yield Resource.populate(resource, resourcePopulateOptions);

      this.emitApiAction('update', 'resource', resource);

      this.apiRespond(resource);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.delete('/:project/resources/:resource', auth.ensureAuthenticated, auth.ensureUser, ensureActiveProjectParticipant, function *() {
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
        // XXX Needs better handling and storage of message
        try {
          yield removeFile(config.app.fs.storageDir + '/' + resource.getFilePath());
        } catch(err) {
          console.error('Could not remove file for resource at location: ' + ( config.app.fs.storageDir + '/' + resource.getFilePath() ), err);
        }
      }

      this.emitApiAction('delete', 'resource', resource);

      this.apiRespond(resource);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
