const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema({
  username: { type: String, required: true },
  audioname: { type: String, required: true },
  audiourl: { type: String, required: true },
});

const Audio = mongoose.model('Audio', audioSchema);

module.exports = Audio;
