"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let milestoneSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    start: { type: Date, required: true },
    color: { type: Number, required: true, min: 1, max: 6 },
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

milestoneSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

const Milestone = mongoose.model('Milestone', milestoneSchema);

module.exports = Milestone;
