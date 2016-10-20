"use strict";

const Router = require('koa-router');
const Activity = require('mongoose').model('Activity');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');

module.exports = function (projectRouter) {

  const activityPopulateOptions = [{
    path: 'actor',
    model: 'User'
  }, {
    path: 'data.user',
    model: 'User'
  }];

  const activityRouter = new Router({ prefix: '/:project/activities' });

  activityRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
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
      let activities;
      if ( lastCreated ) {
        activities = yield Activity.find({ project: this.params.project, created: { $lt: lastCreated } }).sort({ created: -1 }).limit(limit).populate(activityPopulateOptions).exec();
      } else {
        activities = yield Activity.find({ project: this.params.project }).sort({ created: -1 }).limit(limit).populate(activityPopulateOptions).exec();
      }

      this.apiRespond(activities);
    } catch (err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', activityRouter.routes(), activityRouter.allowedMethods());
};
