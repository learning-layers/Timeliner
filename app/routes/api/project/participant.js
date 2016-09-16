"use strict";

const Router = require('koa-router');
const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');
const ObjectId = require('mongoose').Types.ObjectId;

module.exports = function (projectRouter) {

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

  participantRouter.post('/leave', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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

  participantRouter.post('/accept', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
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

  participantRouter.post('/reject', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensurePendingProjectParticipant, function *() {
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

  projectRouter.use('', participantRouter.routes(), participantRouter.allowedMethods());
};
