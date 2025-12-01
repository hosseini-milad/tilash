const mongoose = require("mongoose");

const OpenOrdersSchema = new mongoose.Schema({
  orderNo:{type:String},
  count:{type:String},
  sku:{type:String},
  payStatus: {type: String},
  date:{ type: Date ,default:Date.now()}, 
});

OpenOrdersSchema.index({ sku: -1 });

const openorderModel = mongoose.model("openorders", OpenOrdersSchema);
module.exports = openorderModel;
