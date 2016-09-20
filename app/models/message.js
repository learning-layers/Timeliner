"use strict";

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create a schema
let messageSchema = new Schema({
    message: { type: String, required: true, maxlength: 150 },
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    created: Date
  },
  {
    toJSON : {
      transform: function (doc, ret) {
        delete ret.__v;
      }
    }
  });

messageSchema.pre('save', function(done) {
  const currentDate = new Date();

  if (!this.created){
    this.created = currentDate;
  }

  done();
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
