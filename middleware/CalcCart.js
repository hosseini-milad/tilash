const productPrice = require("../models/product/productPrice")
const NormalTax = require("./NormalTax")
const {StockId,SaleType} = process.env;

var tax = process.env.TaxRate

const CalcCart=async(cartDetails,saleTypeLocal)=>{
    var totalPrice = 0
    var totalCount = 0
    for(var c=0;c<cartDetails.length;c++){
    //const ItemId = 
    const priceData = await productPrice.findOne(
        {ItemID:cartDetails[c].ItemId,saleType:saleTypeLocal?saleTypeLocal:SaleType},
        {price:1,_id:0})

    cartDetails[c].price=Number(priceData.price)//NormalTax(priceData.price)
    totalPrice += cartDetails[c].price*cartDetails[c].count
    totalCount += parseInt(cartDetails[c].count)
    }
    return({totalPrice:totalPrice,totalCount:totalCount})
}

module.exports =CalcCart