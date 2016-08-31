"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let participantSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    status: { type: String, enum: ['pending', 'active', 'placeholder'], required: true, index: true },
    showOnTimeline: { type: Boolean, default: true },
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

/**
 * Returns active project participant for user, if exists.
 * @param  {string}  projectId Project unique identifier
 * @param  {string}  userId    User unique identifier
 * @return {promise}           Resolves to Participant or null
 */
participantSchema.statics.getProjectActiveParticipant = function(projectId, userId) {
  return Participant.findOne({ project: projectId, user: userId, status: 'active' }).exec();
};

/**
 * Retuns pending project participant for user, if exsits.
 * @param  {string} projectId Project unique identifier
 * @param  {string} userId    User unique identifier
 * @return {promise}          Resolves to participant or null
 */
participantSchema.statics.getProjectPendingParticipant = function(projectId, userId) {
  return Participant.findOne({ project: projectId, user: userId, status: 'pending' }).exec();
};

/**
 * Returns acrive or pending project participant, if exists.
 * @param  {string} projectId Project unique identifier
 * @param  {string} userId    User unique identifier
 * @return {promise}          Resolves to participant or null
 */
participantSchema.statics.getProjectParticipant = function(projectId, userId) {
  return Participant.findOne({ project: projectId, user: userId, status: { $in: ['pending', 'active'] } }).exec();
};

const Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
