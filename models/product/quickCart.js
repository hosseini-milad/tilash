const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const QCartSchema = new Schema({
    cartItems:  { type : Array , "default" : [] },
    initDate: { type: Date, default: Date.now },
    progressDate: { type: Date },
    userId:{ type: String },
    manageId:{ type: String },
    payValue:{ type: String },
    stockId:{type:String},
    description:{type:String},
    discount:{type:String},

    totalPrice:{ type: String }
})

const quickCartModel = mongoose.model('quickcart', QCartSchema);
module.exports = quickCartModel;
