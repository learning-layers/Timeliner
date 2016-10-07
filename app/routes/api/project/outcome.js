"use strict";

const Router = require('koa-router');
const Outcome = require('mongoose').model('Outcome');
const Auth = require(__dirname + '/../../../auth');
const Middleware = require(__dirname + '/../../../lib/middleware');
const BBPromise = require("bluebird");
const fse = require('fs-extra');
const moveFile = BBPromise.promisify(fse.move);
const removeFile = BBPromise.promisify(fse.remove);

module.exports = function (projectRouter, config) {

  const outcomePrepopulateOptions = [{
    path: 'creator',
    model: 'User',
  },{
    path: 'versions.creator',
    model: 'User'
  }];

  const outcomeRouter = new Router({ prefix: '/:project/outcomes' });

  outcomeRouter.get('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureProjectAccessRight, function *() {
    try {
      const outcomes = yield Outcome.find({ project: this.params.project }).sort({ created: 1 }).populate(outcomePrepopulateOptions).exec();

      this.apiRespond(outcomes);
    } catch (err) {
      console.error('Getting outcome list failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  outcomeRouter.post('/', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, Middleware.bodyParserUpload, function *() {
    if ( !(this.request.body.fields.title && this.request.body.fields.title.trim() && this.request.body.files.file) ) {
      // XXX Remove uploaded file if present
      this.throw(400, 'required_parameter_missing');
      return;
    }

    const title = this.request.body.fields.title.trim();
    const description = this.request.body.fields.description;
    const file = {
      size: this.request.body.files.file.size,
      name: this.request.body.files.file.name,
      type: this.request.body.files.file.type
    };

    try {
      let outcome = new Outcome({
        title: title,
        description: description,
        versions: [
          {
            file: file,
            creator: this.user._id
          }
        ],
        creator: this.user._id,
        project: this.params.project,
      });

      outcome = yield outcome.save();

      outcome = yield Outcome.populate(outcome, outcomePrepopulateOptions);

      try {
        // XXX Project is probably a full object, should make sesne to only use the _id attribute
        yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Outcome.createVersionFilePathMatrix(outcome.project, outcome._id, outcome.versions[0]._id));
      } catch (err) {
        console.error('Moving of uploaded outcome file failed', err);
      }

      this.emitApiAction('create', 'outcome', outcome, this.user);

      this.apiRespond(outcome);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded outcome file failed', err);
        }
      }
      console.error('Outcome creation failed', err);
      this.throw(500, 'creation_failed');
    }
  });

  outcomeRouter.put('/:outcome', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, Middleware.bodyParserUpload, function *() {
    let outcome;

    try {
      outcome = yield Outcome.findOne({ _id: this.params.outcome }).exec();
    } catch(err) {
      console.error(err);
      // XXX Need to remove uploaded file
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !outcome ) {
      // XXX Need to remove uploaded file
      this.throw(404, 'not_found');
      return;
    }

    if ( this.request.body.fields.title ) {
      outcome.title = this.request.body.fields.title.trim();
    } else {
      // XXX Need to remove uploaded file
      this.throw(400, 'required_parameter_missing');
      return;
    }
    if ( this.request.body.fields.description !== undefined ) {
      outcome.description = this.request.body.fields.description;
    }

    if ( this.request.body.files.file ) {
      outcome.versions.push({
        file: {
          size: this.request.body.files.file.size,
          name: this.request.body.files.file.name,
          type: this.request.body.files.file.type
        },
        creator: this.user._id
      });
    }

    try {
      outcome = yield outcome.save();

      outcome = yield Outcome.populate(outcome, outcomePrepopulateOptions);

      if ( this.request.body.files.file ) {
        try {
          // XXX Need a better way to determine last version
          yield moveFile(this.request.body.files.file.path, config.app.fs.storageDir + '/' + Outcome.createVersionFilePathMatrix(outcome.project, outcome._id, outcome.versions[outcome.versions.length-1]._id));
        } catch (err) {
          console.error('Moving of uploaded outcome file failed', err);
        }
      }

      this.emitApiAction('update', 'outcome', outcome, this.user);

      this.apiRespond(outcome);
    } catch(err) {
      // Clean-up the uploaded file in case something fails
      if ( this.request.body.files.file ) {
        try {
          yield removeFile(this.request.body.files.file.path);
        } catch (err) {
          console.error('Removal of temporary uploaded outcome file failed', err);
        }
      }
      console.error('Outcome update failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  outcomeRouter.delete('/:outcome', Auth.ensureAuthenticated, Auth.ensureUser, Middleware.ensureActiveProjectParticipant, function *() {
    let outcome;

    try {
      outcome = yield Outcome.findOne({ _id: this.params.outcome }).exec();
    } catch(err) {
      console.error(err);
      this.throw(500, 'internal_server_error');
      return;
    }

    if ( !outcome ) {
      this.throw(404, 'not_found');
      return;
    }

    if ( !outcome.project.equals(this.params.project) ) {
      this.throw(403, 'permission_error');
      return;
    }

    try {
      yield outcome.remove();

      if ( outcome.versions ) {
        for ( let i = 0; i < outcome.versions.length; i++ ) {
          try {
            yield removeFile(config.app.fs.storageDir + '/' + outcome.getVersionFilePath(outcome.versions[i]._id));
          } catch(err) {
            console.error('Removal of existing resource file failed', err);
          }
        }
      }

      this.emitApiAction('delete', 'outcome', outcome, this.user);

      this.apiRespond(outcome);
    } catch (err) {
      console.error('Outcome removal failed', err);
      this.throw(500, 'internal_server_error');
    }
  });

  projectRouter.use('', outcomeRouter.routes(), outcomeRouter.allowedMethods());
};
