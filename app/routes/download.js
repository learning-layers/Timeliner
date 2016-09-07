"use strict";

const Router = require('koa-router');
const Resource = require('mongoose').model('Resource');
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
    this.set('Content-Disposition', 'attachment; filename=' + resource.file.name);
    this.set('Content-Type', resource.file.type);
    this.body = fse.createReadStream(config.app.fs.storageDir + '/' + resource.getFilePath());
  });


  app.use(downloadRouter.routes());
  app.use(downloadRouter.allowedMethods());
};
