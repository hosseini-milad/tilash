const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const ProductCountSchema = new Schema({
    pID: String,
    ItemID: String,
    UnitRef:String,
    quantity:Number,
    Stock:String,
    date:{ type: Date }
})

const productCountModel = mongoose.model('productcount',ProductCountSchema);
module.exports = productCountModel;
