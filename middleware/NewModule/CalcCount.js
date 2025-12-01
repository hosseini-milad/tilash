const brandModel = require("../../models/product/brand");
const category = require("../../models/product/category");
const productCountModel = require("../../models/product/productCount");
const productPriceModel = require("../../models/product/productPrice");
const productModel = require("../../models/product/products");
const productSchema = require("../../models/product/products");

const CalcCount=async(sku,stockId,saleType)=>{
    if(!stockId) stockId = "13"
    if(!saleType) saleType = "5"
    const productData = await productModel.findOne({sku:sku}).lean()
    if(!productData) return('')
    const brandData = await brandModel.findOne({brandCode:productData&&productData.brandId})
    const catData = await category.findOne({catCode:productData&&productData.catId})
    
    productData.brandData = brandData
    productData.catData = catData
    const countProducts = await productCountModel.findOne(
        { ItemID:productData.ItemID , Stock:stockId});
    const priceProducts = await productPriceModel.findOne(
        { ItemID:productData.ItemID ,saleType:saleType});
    var count = countProducts?countProducts.quantity:0
    var price = priceProducts?roundNumber(priceProducts.price):0
    
    return ({
        data:productData,
        canSale:(!count||!price)?0:1,
        count:count,
        price:price})
}
const roundNumber = (number) => {
    var rawNumber = parseInt(number.toString().replace(/,/g, ''))
    return (parseInt(Math.round(rawNumber / 1000)) * 1000)

}
module.exports =CalcCount