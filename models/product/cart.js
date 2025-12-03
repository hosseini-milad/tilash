const mongoose = require('mongoose');

var Schema = mongoose.Schema;

const CartSchema = new Schema({
    cartItems:  { type : Array , "default" : [] },
    initDate: { type: Date, default: Date.now },
    cartNo:{ type: String },
    progressDate: { type: Date },
    userId:{ type: String },
    manageId:{ type: String },
    profileId:{ type: Array },
    profileName:{ type: Array },
    payValue:{ type: String },
    stockId:{type:String},
    status:{type:String},
    description:{type:String},
    discount:{type:String},
    totalPrice:{ type: String },
    taskStep:{ type: String },
    query:{ type: String },
    result:{ type: String },
    isSale:{type:Boolean,default:false},
    isQuote:{type:Boolean,default:false},
    Number:{type:String},
    InvoiceID:{type:String},
    branchId :{type:String},
    branchName :{type:String},
    transport :{type:String},
    transportPrice :{type:String},
    bank :{type:String}
})

CartSchema.index({ initDate: -1 });
CartSchema.index({ cartNo: -1 });
CartSchema.index({ 'cartItems.sku': -1 });
CartSchema.index({ InvoiceID: -1 });
CartSchema.index({ stockId: -1 });
CartSchema.index({ isSale: -1 });

const cartModel = mongoose.model('cart',CartSchema);
module.exports = cartModel;
