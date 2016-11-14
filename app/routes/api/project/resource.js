"use strict";

const Router = require('koa-router');
const Resource = require('mongoose').model('Resource');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');
const BBPromise = require("bluebird");
const fse = require('fs-extra');
const moveFile = BBPromise.promisify(fse.move);
const removeFile = BBPromise.promisify(fse.remove);

module.exports = function (projectRouter, config) {

  const resourcePopulateOptions = [{
    path: 'creator',
    model: 'User'
  }];

  const resourceRouter = new Router({ prefix: '/:project/resources' });

  resourceRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    try {
      const resources = yield Resource.find({ project: this.params.project }).sort({ created: 1 }).populate(resourcePopulateOptions).exec();

      this.apiRespond(resources);
    } catch (err) {
      console.error('Getting resource list failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  resourceRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, Middleware.bodyParserUpload, function *() {
    if ( !(this.request.body.fields.title && this.request.body.fields.title.trim()) ) {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.fields.title.trim();
    const description = this.request.body.fields.description;
    const url = this.request.body.fields.url ? this.request.body.fields.url : undefined;
    let file;

    if ( this.request.body.files.file ) {
      file = {
        size: this.request.body.files.file.size,
        name: this.request.body.files.file.name,
        type: this.request.body.files.file.type
      };
    } else {
      file = undefined;
    }

    if ( url && file ) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      this.throw(400, 'either_url_or_file_not_both');
      return;
    } else if ( !( url || file ) ) {
      this.throw(400, 'no_url_or_file_provided');
      return;
    }

    try {
      let resource = new Resource({
        title: title,
        description: description,
        url: url,
        file: file,
        creator: this.user._id,
        project: this.params.project,
      });

      resource = yield resource.save();

      resource = yield Resource.populate(resource, resourcePopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id));
        } catch (err) {
          console.error('Moving of uploaded resource file failed', err);
        }
      }

      this.emitApiAction('create', 'resource', resource, this.user);

      this.apiRespond(resource);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      console.error('Resource creation failed', err);
      this.throw(500, 'creation_failed');
    }
  });

  resourceRouter.put('/:resource', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, Middleware.bodyParserUpload, function *() {
    let resource, hasFile;

    try {
      resource = yield Resource.findOne({ _id: this.params.resource }).exec();
    } catch(err) {
      // XXX Need to remove uploaded file
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !resource ) {
      // XXX Need to remove uploaded file
      this.throw(404, 'not_found');
      return;
    }

    if ( !resource.project.equals(this.params.project) ) {
      // XXX Need to remove uploaded file
      this.throw(403, 'permission_error');
      return;
    }

    if ( this.request.body.fields.url && this.request.body.files.file ) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      this.throw(400, 'either_url_or_file_not_both');
      return;
    } else if ( !( this.request.body.fields.url || this.request.body.files.file ) ) {
      this.throw(400, 'no_url_or_file_provided');
      return;
    }

    hasFile = resource.file ? true : false;

    if ( this.request.body.fields.title ) {
      resource.title = this.request.body.fields.title.trim();
    } else {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.fields.description !== undefined ) {
      resource.description = this.request.body.fields.description;
    }

    if ( this.request.body.fields.url ) {
      resource.url = this.request.body.fields.url;

      // Remove file data from resource body, if required
      if ( hasFile ) {
        resource.file = undefined;
      }
    }

    if ( this.request.body.files.file ) {
      resource.file = {
        size: this.request.body.files.file.size,
        name: this.request.body.files.file.name,
        type: this.request.body.files.file.type
      };

      // Remove url data from resource body, if required
      if ( !hasFile ) {
        resource.url = undefined;
      }
    }

    try {
      resource = yield resource.save();

      resource = yield Resource.populate(resource, resourcePopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          // Move new file in, rewriting previous one; see the clobber option
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id), {
            clobber: true
          });
        } catch (err) {
          console.error('Moving new uploaded resource file failed', err);
        }
      }

      if ( hasFile && !resource.file ) {
        try {
          yield removeFile(config.app.fs.storageDir + '/' + Resource.createFilePathMatrix(resource.project, resource._id));
        } catch (err) {
          console.error('Removal of exisring resource file failed', err);
        }
      }

      this.emitApiAction('update', 'resource', resource, this.user);

      this.apiRespond(resource);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded resource file failed', err);
        }
      }
      console.error('Resource update failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  // TODO This should run a query to remove any connections between for tasks
  // It might also be needed to notify the front-end about the change (unless the logic is implemented there)
  resourceRouter.delete('/:resource', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let resource;

    try {
      resource = yield Resource.findOne({ _id: this.params.resource }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !resource ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !resource.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield resource.remove();

      if ( resource.file ) {
        try {
          yield removeFile(config.app.fs.storageDir + '/' + resource.getFilePath());
        } catch(err) {
          console.error('Removal of existing resource file failed', err);
        }
      }

      this.emitApiAction('delete', 'resource', resource, this.user);

      this.apiRespond(resource);
    } catch (err) {
      console.error('Resource removal failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', resourceRouter.routes(), resourceRouter.allowedMethods());
};
