const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const BrandSchema = new Schema({
    title:  String,
    enTitle:String,
    purchase:String,
    purchaseContact:String,
    imageUrl: String,
    brandUrl: String,
    description: String,
    fullDesc: String,
    brandCode:String,
    active:{type:Boolean,default:true},
    store: String,
})

BrandSchema.index({ brandCode: -1 });

const brandModel = mongoose.model('brands',BrandSchema);
module.exports = brandModel;
