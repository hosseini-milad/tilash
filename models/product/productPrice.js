const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const ProductPriceSchema = new Schema({
    pID: String,
    ItemID: String,
    saleType:String,
    stock:String,
    price:String,
    date:{ type: Date }
})

ProductPriceSchema.index({ ItemID: -1 });

const productPriceModel = mongoose.model('productprice',ProductPriceSchema);
module.exports = productPriceModel;
