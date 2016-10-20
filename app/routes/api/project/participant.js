"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (projectRouter) {

  const participantPopulateOptions = [{
    path: 'user',
    model: 'User'
  }];

  const participantRouter = new Router({ prefix: '/:project/participants' });

  participantRouter.post('/invite/:user', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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
      participant = yield Participant.populate(participant, participantPopulateOptions);

      this.emitApiAction('invite', 'participant', participant, this.user);

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

  participantRouter.post('/leave', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let project;

    try {
      project = yield Project.findOne({ _id: this.params.project }).exec();
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
      const participant = yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { status: 'placeholder' }, { new: true }).populate(participantPopulateOptions).exec();

      this.emitApiAction('leave', 'participant', participant, this.user);

      this.apiRespond(participant);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  participantRouter.post('/accept', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
    try {
      const participant = yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { status: 'active' }, { new: true }).populate(participantPopulateOptions).exec();

      this.emitApiAction('accept', 'participant', participant, this.user);

      this.apiRespond(participant);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  participantRouter.post('/reject', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
    try {
      const participant = yield Participant.findOneAndUpdate({ project: this.params.project, user: this.user._id }, { status: 'placeholder' }, { new: true }).populate(participantPopulateOptions).exec();

      this.emitApiAction('reject', 'participant', participant, this.user);

      this.apiRespond(participant);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  participantRouter.post('/remove/:user', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectOwner, function *() {
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
      participant = yield Participant.findOneAndUpdate({ project: this.params.project, user: this.params.user }, { status: 'placeholder' }, { new: true }).populate(participantPopulateOptions).exec();
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !participant ) {
      this.throw(404, 'not_a_project_participant');
      return;
    }

    this.emitApiAction('remove', 'participant', participant, this.user);

    this.apiRespond(participant);
  });

  projectRouter.use('', participantRouter.routes(), participantRouter.allowedMethods());
};
