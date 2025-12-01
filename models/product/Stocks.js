const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
    Title:  String,
    StockID:Number,
    Code:Number,
    IsActive: Boolean
})

const stockModel = mongoose.model('stock',StockSchema);
module.exports = stockModel;
