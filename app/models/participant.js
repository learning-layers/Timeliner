"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let participantSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'placeholder'], required: true, inxex: true },
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

participantSchema.index({ user: 1, project: 1 }, { unique: true } );

participantSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

/**
 * Returns an array of Project identifiers current user belongs to
 * @param  {string} userId User unique identifier
 * @return {array}         Array with Project unique identifiers
 */
participantSchema.statics.getUserProjects = function *(userId) {
  const participants = yield Participant.find({ user: userId, status: { $in: ['pending', 'active'] } }, { project: 1 }).lean().exec();

  return participants.map(function(single) {
    return single.project;
  });
};

const Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
