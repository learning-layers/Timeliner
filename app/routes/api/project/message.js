"use strict";

const Router = require('koa-router');
const Message = require('mongoose').model('Message');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');
const bodyParser = require('koa-body')();

module.exports = function (projectRouter) {

  const messagePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const messageRouter = new Router({ prefix: '/:project/messages' });

  messageRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    let lastCreated;
    let limit = 50;
    if ( this.request.query && this.request.query.lastCreated ) {
      lastCreated = new Date(this.request.query.lastCreated);
    }
    if ( this.request.query && this.request.query.limit ) {
      limit = parseInt(this.request.query.limit);
      if ( limit > 50 ) {
        this.throw(400, 'max_item_limit_exceeded');
        return;
      }
    }

    try {
      let messages;
      if ( lastCreated ) {
        messages = yield Message.find({ project: this.params.project, created: { $lt: lastCreated } }).sort({ created: -1 }).limit(limit).populate(messagePopulateOptions).exec();
      } else {
        messages = yield Message.find({ project: this.params.project }).sort({ created: -1 }).limit(limit).populate(messagePopulateOptions).exec();
      }

      let remaining = 0;
      if ( messages && messages.length >= limit ) {
        remaining = yield Message.find({ project: this.params.project, created: { $lt: messages[messages.length-1].created } }).count();
      }

      this.apiRespond({
        messages: messages,
        remaining: remaining
      });
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  messageRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, bodyParser, function *() {
    if ( !( this.request.body.message && this.request.body.message.trim() ) ) {
      this.throw(400, 'required_parameter_missing');
      return;
    }

    try {
      let message = new Message({
        message: this.request.body.message.trim(),
        creator: this.user._id,
        project: this.params.project,
      });

      message = yield message.save();

      message = yield Message.populate(message, messagePopulateOptions);

      this.emitApiAction('create', 'message', message, this.user);

      this.apiRespond(message);
    } catch(err) {
      console.error(err);
      if ( err.errors && err.errors.message && err.errors.message.kind === 'maxlength' ) {
        this.throw(400, 'message_is_too_long');
        return;
      }
      this.throw(500, 'creation_failed');
    }
  });

  projectRouter.use('', messageRouter.routes(), messageRouter.allowedMethods());
};
