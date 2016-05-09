"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let projectSchema = new Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    created: Date,
    updated: Date,
  },
  {
    toJSON : {
      transform: function (doc, ret, options) {
        delete ret.__v;
      }
    }
  });

projectSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
