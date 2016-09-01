"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let taskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    start: { type: Date, required: false },
    end: { type: Date, required: false },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    participants:  { type: [{ type: Schema.Types.ObjectId, ref: 'Participant' }], index: true },
    resources:  { type: [{ type: Schema.Types.ObjectId, ref: 'Resource' }], index: true },
    documents:  { type: [{ type: Schema.Types.ObjectId, ref: 'Document' }], index: true },
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

taskSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
