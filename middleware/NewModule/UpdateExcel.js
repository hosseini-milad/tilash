const brand = require("../models/product/brand")
const category = require("../models/product/category")
const master = require("../models/product/master")
const products = require("../models/product/products")

const UpdateExcel =async(data)=>{
  const Category = await updateCategory(data.find(item=>item.name=='Category'))
  const MasterProduct = await updateMaster(data.find(item=>item.name=='MasterProduct'))
  const Product = await updateProduct(data.find(item=>item.name=='Product'))
  const Brand = await updateBrand(data.find(item=>item.name=='Brand'))
  return({data,Category,MasterProduct,Product,Brand})
}
const updateCategory=async(rawData)=>{
  if(rawData){
    var data = rawData.data
    for(var i=1;i<data.length;i++){
      var updateResult = await category.updateOne({catCode:data[i][0]},
        {$set:{title:data[i][1],link:data[i][2],parent:data[i][3]}}
      )
      if(!updateResult.matchedCount){
        await category.create({
          catCode:data[i][0],
          title:data[i][1],
          link:data[i][2],
          parent:data[i][3]})
      }
    }
  }

}
const updateMaster=async(rawData)=>{
  if(rawData){
    var data = rawData.data
    for(var i=1;i<data.length;i++){
      var query = {
        title:data[i][1],
        enTitle:data[i][2],
        productUrl:data[i][2],
        catCode:data[i][3],
        category2:data[i][4],
        brandCode:data[i][5],
        tag1:data[i][6],
        tag2:data[i][7],
        tag3:data[i][8],
        tag4:data[i][9],
        tag5:data[i][10]}
      var updateResult = await master.updateOne({sku:data[i][0]},
        {$set:query}
      )
      if(!updateResult.matchedCount)
        await master.create({...query,sku:data[i][0]})
    }
  }

}
const updateProduct=async(rawData)=>{
  if(rawData){
    var data = rawData.data
    for(var i=1;i<data.length;i++){
      var query = {
        title:  data[i][1],
        ItemID: data[i][0],
        enTitle:data[i][2],
        size:data[i][3],
        weight:"",
        length:"",
        grade:data[i][4],
        masterSku:data[i][5],
        masterName:""}
      var updateResult = await products.updateOne({sku:data[i][0]},
        {$set:query}
      )
      if(!updateResult.matchedCount)
        await products.create({...query,sku:data[i][0]})
    }
  }

}
const updateBrand=async(rawData)=>{
  if(rawData){
    var data = rawData.data
    for(var i=1;i<data.length;i++){
      var query = {
        title:  data[i][1],
        enTitle:  data[i][2]
      }
      var updateResult = await brand.updateOne({brandCode:data[i][0]},
        {$set:query}
      )
      if(!updateResult.matchedCount)
        await brand.create({...query,brandCode:data[i][0]})
    }
  }

}
module.exports = UpdateExcel;