"use strict";

const Router = require('koa-router');
const Annotation = require('mongoose').model('Annotation');
const bodyParser = require('koa-body')();
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (projectRouter) {

  const annotationPopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const annotationRouter = new Router({ prefix: '/:project/annotations' });

  annotationRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    try {
      const annotations = yield Annotation.find({ project: this.params.project }).sort({ created: 1 }).populate(annotationPopulateOptions).exec();

      this.apiRespond(annotations);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  annotationRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
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

      this.emitApiAction('create', 'annotation', annotation, this.user);

      this.apiRespond(annotation);
    } catch(err) {
      console.error(err);
      this.throw(500, 'creation_failed');
    }
  });

  annotationRouter.put('/:annotation', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
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

      this.emitApiAction('update', 'annotation', annotation, this.user);

      this.apiRespond(annotation);
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  annotationRouter.delete('/:annotation', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
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

      this.emitApiAction('delete', 'annotation', annotation, this.user);

      this.apiRespond(annotation);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', annotationRouter.routes(), annotationRouter.allowedMethods());
};
