"use strict";

const Router = require('koa-router');
const Activity = require('mongoose').model('Activity');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (projectRouter) {

  const activityPopulateOptions = [{
    path: 'actor',
    model: 'User'
  }];

  const activityRouter = new Router({ prefix: '/:project/activities' });

  activityRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    try {
      const activities = yield Activity.find({ project: this.params.project }).sort({ created: -1 }).populate(activityPopulateOptions).exec();

      this.apiRespond(activities);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', activityRouter.routes(), activityRouter.allowedMethods());
};
