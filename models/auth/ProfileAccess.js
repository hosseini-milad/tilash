const mongoose = require("mongoose");

const profileAccessSchema = new mongoose.Schema({
  profileName: { type: String},
  profileCode: { type: String},
  parentId: { type: String},
  manId: { type: String },
  access: { type: Array},
    menusAccess: [{
    menuCode: { type: String, required: true },
    title: { type: String, required: true },
    enTitle: { type: String, required: true },
    access: {
      read: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
    },
  }],
  date: { type: Date , default:Date.now() }
});

const profileModel = mongoose.model("profiles", profileAccessSchema);
module.exports = profileModel;
