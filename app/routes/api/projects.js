"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const Annotation = require('mongoose').model('Annotation');
const Milestone = require('mongoose').model('Milestone');
const Task = require('mongoose').model('Task');
const bodyParser = require('koa-body')();
const auth = require(__dirname + '/../../auth');
const ObjectId = require('mongoose').Types.ObjectId;

module.exports = function (apiRouter) {
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
    try {
      let project = yield Project.findOne({ _id: this.params.project }).exec();

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

      project = yield project.save();

      project = yield Project.populate(project, projectPopulateOptions);

      this.apiRespond(project);
    } catch(err) {
      // TODO Need to add handing for NOT FOUND project
      // Maybe some others
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
    }

    if ( !participant ) {
      this.throw(404, 'not_a_project_participant');
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
    try {
      let annotation = yield Annotation.findOne({ _id: this.params.annotation }).exec();

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
    try {
      let annotation = yield Annotation.findOne({ _id: this.params.annotation }).exec();

      if ( !annotation ) {
        this.throw(404, 'not_found');
        return;
      }

      if ( !annotation.project.equals(this.params.project) ) {
        this.throw(403, 'permission_error');
        return;
      }

      yield annotation.remove().exec();

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
    try {
      let milestone = yield Milestone.findOne({ _id: this.params.milestone }).exec();

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
    try {
      let milestone = yield Milestone.findOne({ _id: this.params.milestone }).exec();

      if ( !milestone ) {
        this.throw(404, 'not_found');
        return;
      }

      if ( !milestone.project.equals(this.params.project) ) {
        this.throw(403, 'permission_error');
        return;
      }

      yield milestone.remove().exec();

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

    // XXX Need to make sure that either start and end are both present or none
    // Need to make sure that start is less than end (maybe even chakc the difference being more than a day or two)

    const title = this.request.body.title.trim();
    const description = this.request.body.description;
    const start = this.request.body.start ? new Date(this.request.body.start) : undefined;
    const end = this.request.body.end ? new Date(this.request.body.end) : undefined;

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
    try {
      let task = yield Task.findOne({ _id: this.params.task }).exec();

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
      // XXX Need to check that both are present and start is less than end
      // Also what creation is currently missing
      if ( this.request.body.start ) {
        task.start = new Date(this.request.body.start);
      }
      if ( this.request.body.end ) {
        task.end = new Date(this.request.body.end);
      }

      // TODO Check about connection to partticipant, resource and document

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
    try {
      let task = yield Task.findOne({ _id: this.params.task }).exec();

      if ( !task ) {
        this.throw(404, 'not_found');
        return;
      }

      if ( !task.project.equals(this.params.project) ) {
        this.throw(403, 'permission_error');
        return;
      }

      yield task.remove().exec();

      this.emitApiAction('delete', 'task', task);

      this.apiRespond(task);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  apiRouter.use('', projectRouter.routes(), projectRouter.allowedMethods());
};
