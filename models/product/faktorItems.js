const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const FaktorItems = new Schema({
    InvoiceID:{ type: String },
    InvoiceNumber:{ type: String },
    initDate: { type: Date, default: Date.now },
    progressDate: { type: Date },
    sku:{ type: String },
    Description:{ type: String },
    ItemID:{ type: String },
    discount:{ type: String },
    fee:{ type: String },
    price:{ type: String },
    tax:{ type: String },
    faktorNo:String,
    netPrice:{ type: String },
    count:{ type: String }
})

FaktorItems.index({ InvoiceNumber: -1 });

const faktorItemModel = mongoose.model('faktorItems',FaktorItems);
module.exports = faktorItemModel;
