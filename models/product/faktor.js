const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const FaktorSchema = new Schema({
    initDate: { type: Date, default: Date.now },
    progressDate: { type: Date },
    userId:{ type: String },
    customerID:{ type: String },
    customerName:{ type: String },
    manageId:{ type: String },
    managerName:{ type: String },
    faktorNo:{ type: String },
    isWeb:{type: Boolean, default:false},
 
    NetPrice:{ type: String },
    InvoiceID:{ type: String},
    InvoiceNumber:{ type: String },
    ReceiptID:String,
    Status:{type:String,default:"unregister"},
    payStatus:{type:String},
    totalCount:{ type: String },
    sepidarResult:{type:Object},
    query:{type:Object},
    branchId :{type:String},
    branchName :{type:String},
    transport :{type:String},
    transportPrice :{type:String},
    bank :{type:String}
});

FaktorSchema.index({ initDate: -1 });
FaktorSchema.index({ manageId: -1 });
FaktorSchema.index({ Status: -1 });

const faktorModel = mongoose.model('faktor',FaktorSchema);
module.exports = faktorModel;
