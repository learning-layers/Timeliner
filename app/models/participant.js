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
      transform: function (doc, ret, options) {
        delete ret.__v;
      }
    }
  });

participantSchema.pre('save', function(done) {
  const currentDate = new Date();

  this.updated = currentDate;

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

const Participant = mongoose.model('Participant', participantSchema);

module.exports = Participant;
