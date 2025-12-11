const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const CartDataSchema = new Schema({
    initDate: { type: Date, default: Date.now },
    progressDate: { type: Date },

    bank:{type:String},
    transport:{type:String},
    transportPrice:{type:String},
    manageId:{type:String},
    userId:{type:String},
    description:{type:String},
    discount:{type:Number}
})

module.exports = mongoose.model('cartdata',CartDataSchema);