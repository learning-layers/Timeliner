"use strict";

const Project = require('mongoose').model('Project');
const Participant = require('mongoose').model('Participant');
const config = require(__dirname + '/../../config/config');

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

const bodyParserUpload = require('koa-body')({
  multipart: true,
  formidable: {
    multiples: false,
    uploadDir: config.app.fs.uploadDir
  }
});

module.exports = {
  ensureProjectOwner: ensureProjectOwner,
  ensureProjectAccessRight: ensureProjectAccessRight,
  ensureActiveProjectParticipant: ensureActiveProjectParticipant,
  ensurePendingProjectParticipant: ensurePendingProjectParticipant,
  bodyParserUpload: bodyParserUpload
};
