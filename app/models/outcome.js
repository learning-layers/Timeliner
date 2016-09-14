"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let outcomeVersionSchema = new Schema({
  file: { type: Schema.Types.Mixed, reqired: true }, // { size: BYTES, name: original name, type: MIME TYPE }
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  created: Date
});

outcomeVersionSchema.pre('save', function(done) {
  const currentDate = new Date();

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

// Create a schema
let outcomeSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    versions: [outcomeVersionSchema],
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    created: Date,
    updated: Date
  },
  {
    toJSON : {
      transform: function (doc, ret) {
        delete ret.__v;
      }
    }
  });

outcomeSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

outcomeSchema.methods.getVersionFilePath = function (versionId) {
  let version = this.versions.id(versionId);

  if ( !version ) {
    throw new Error('No such version');
  }

  return this.project.toString() + '/' + this._id.toString() + '/' + version._id.toString();
};

outcomeSchema.statics.createVersionFilePathMatrix = function(projectId, outcomeId, versionId) {
  return projectId.toString() + '/' + outcomeId.toString() + '/' + versionId.toString();
};

const Outcome = mongoose.model('Outcome', outcomeSchema);

module.exports = Outcome;
