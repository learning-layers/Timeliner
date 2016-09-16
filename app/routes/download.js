"use strict";

const Router = require('koa-router');
const Resource = require('mongoose').model('Resource');
const Outcome = require('mongoose').model('Outcome');
const fse = require('fs-extra');

module.exports = function (app, config) {

  const downloadRouter = new Router({ prefix: '/download' });

  // XXX MISSING PERMISSION CHECKS
  downloadRouter.get('/resources/:resource', function *() {
    let resource;

    try {
      resource = yield Resource.findOne({ _id: this.params.resource }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !( resource && resource.file ) ) {
      this.throw(404, 'not_found');
      return;
    }

    // TODO Check if this is enough or does it need something else
    this.set('Content-Disposition', 'inline; filename=' + resource.file.name);
    this.set('Content-Type', resource.file.type);
    this.body = fse.createReadStream(config.app.fs.storageDir + '/' + resource.getFilePath());
  });

  // XXX MISSING PERMISSION CHECKS
  downloadRouter.get('/outcomes/:outcome/versions/:version', function *() {
    let outcome, version;

    try {
      outcome = yield Outcome.findOne({ _id: this.params.outcome }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( outcome ) {
      try {
        version = outcome.versions.id(this.params.version);
      } catch (err) {
        console.error(err);
        this.throw(500, 'internal_server_error');
        return;
      }
    }

    if ( !( outcome && version ) ) {
      this.throw(404, 'not_found');
      return;
    }

    // TODO Check if this is enough or does it need something else
    this.set('Content-Disposition', 'inline; filename=' + version.file.name);
    this.set('Content-Type', version.file.type);
    this.body = fse.createReadStream(config.app.fs.storageDir + '/' + outcome.getVersionFilePath(version._id));
  });

  app.use(downloadRouter.routes());
  app.use(downloadRouter.allowedMethods());
};
