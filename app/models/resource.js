"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let resourceSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: false },
    file: { type: Schema.Types.Mixed, required: false }, // { size: BYTES, name: original name, type: MIME TYPE}
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

resourceSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

resourceSchema.methods.getFilePath = function () {
  if ( !this.file ) {
    return null;
  }

  return this.project.toString() + '/' + this._id.toString();
};

resourceSchema.statics.createFilePathMatrix = function(projectId, resoueceId) {
  return projectId.toString() + '/' + resoueceId.toString();
};

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;
