const brandModel = require("../../models/product/brand");
const category = require("../../models/product/category");
const faktorModel = require("../../models/product/faktor");
const faktorItemModel = require("../../models/product/faktorItems");
const productCountModel = require("../../models/product/productCount");
const productPriceModel = require("../../models/product/productPrice");
const productModel = require("../../models/product/products");
const productSchema = require("../../models/product/products");

const FindFaktor=async(faktorNo)=>{
    if(!faktorNo) return('')
    try{
        const faktorData = await faktorModel.findOne({faktorNo:faktorNo}).lean()
        if(!faktorNo) return ('')
        const faktorItems = await faktorItemModel.find({faktorNo:faktorNo})
        faktorData.cartItems = faktorItems
        faktorData.cartNo = faktorData.faktorNo
        return(faktorData)
    }
    catch{ return('')}

}
module.exports =FindFaktor