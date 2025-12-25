const productModel = require("../models/product/products")
const MultiplySum = require("./MultiplySum")
const findQCartSum = require("./NewModule/FindQuickCartSum")
const SepidarDiscountToItems = require("./NewModule/SepidarDiscountToItems")

const {TaxRate} = process.env
const CartToSepidar=async(data,faktorNo,user,stock,cartOff,
  orderNo,payValue,fullPrice,transportPrice)=>{
    var payValueFinal = (payValue&&payValue=="3")?"1":payValue
        const notNullCartItem = []
        const totalOff= cartOff?parseInt(cartOff):0
        for(var i=0;i<data.length;i++)
            data[i].count?
            notNullCartItem.push(data[i]):''
        var totalNetPrice = 0
        var totalNetCount = 0
        const addition = normalPriceCount(transportPrice,1,1)
        const result = await findQCartSum(notNullCartItem,"3")
        var itemsToSepidar=[]
        const newItems = SepidarDiscountToItems(notNullCartItem,totalOff,result&&result.totalPrice)
        //return({result,notNullCartItem})
        for(var i=0;i<newItems.length;i++){
          const item = newItems[i]
          var fee = findPayValuePrice(item.price,payValue?payValue:"3")
          if(item.fixPrice) fee = item.fixPrice
          //console.log("sku: ",item.sku," discount: ",itemDiscount," fee: ",fee)
          const Price = normalPriceCount(fee,item.count,1)
          const itemDiscount = MultiplySum(item.discount,1)
          const Discount =itemDiscount?itemDiscount:0
          totalNetCount += parseInt(item.count)
          //const Discount = discount?normalPriceCount(discount,item.count):0.0000
          const Tax = normalPriceCount(Price-Discount,1,TaxRate)
          var NetPrice = normalPriceCount(Price) - normalPriceCount(Discount) + normalPriceCount(Tax)
          //if(item.fixPrice)
          //  NetPrice = normalPriceCount(item.fixPrice,item.count,1)- normalPriceCount(Discount)
          totalNetPrice += NetPrice
          const ItemDetail = await productModel.findOne({sku:item.sku})
          var desc = item.desc?"("+item.desc+")":""
          itemsToSepidar.push({
            "ItemRef": toInt(ItemDetail&&ItemDetail.ItemID),
            "SKU":item.sku,
            "TracingRef": null,
            "Description":item.title+"|"+item.sku+desc,
            "StockRef":item.stock?item.stock:stock,
            "Quantity": toInt(item.count),
            "Fee": toInt(fee),
            "Price": normalPriceCount(Price),
            "Discount": i==0?normalPriceCount(Discount):0,
            "Tax": normalPriceCount(Tax),
            "NetPrice":normalPriceCount(NetPrice),
            "Duty": 0.0000,
            "Addition": i==0?normalPriceCount(addition):0.00
          })
        }

        var query ={
            "GUID": "104ab077-fc79-417f-b7cf-1"+faktorNo,
            "CustomerRef": toInt(user.CustomerID),
            "AddressRef": user.AddressID?user.AddressID:'',
            "CurrencyRef":1,
            "SaleTypeRef": payValueFinal?payValueFinal:1,
            "Duty":0.0000,
            "Description":faktorNo,
            "DescriptionRef":faktorNo,
            "Discount": 0.00,
            "Addition":0.00,
            "Items": itemsToSepidar,
              totalNetPrice:totalNetPrice,
              totalNetCount:totalNetCount
            
          }
        return(query)
    }

    
const toInt=(strNum,count,align)=>{
    if(!strNum)return(0)
    return(parseInt(parseInt((align?"-":'')+strNum.toString().replace( /,/g, ''))*
    (count?parseFloat(count):1)))
}
const normalPriceCount=(priceText,count,tax)=>{
    if(!priceText||priceText === null||priceText === undefined) return(0)
    var rawCount = count?parseFloat(count.toString()):1
    var rawTax = tax?parseFloat(tax.toString()):1
    var tempPrice = priceText.toString()
    var rawPrice = Number(tempPrice)*rawCount*rawTax
    //rawPrice = Math.round(rawPrice)
    return(Math.round(rawPrice))
  }
  const normalPriceFix=(priceText,count,mult)=>{
    if(!priceText||priceText === null||priceText === undefined) return("")
    var rawCount = parseFloat(count.toString())
    var rawMult = mult?parseFloat(mult.toString()):1
    var purePrice = priceText.toString().split('.')[0]
    var rawPrice = (parseInt(purePrice.replace( /,/g, '')
        .replace(/\D/g,''))*rawCount*rawMult)
    return(
      (rawPrice).toString().split('.')[0]
    )
  }
  const normalPriceRound=(priceText,count,mult)=>{
    if(!count) count =1
    if(!priceText||priceText === null||priceText === undefined) return(0)
    var rawCount = parseInt(count.toString())
    var rawMult = mult?parseFloat(mult.toString()):1
    var purePrice = priceText.toString().split('.')[0]
    var rawPrice = (parseInt(purePrice.replace( /,/g, '')
        .replace(/\D/g,''))*rawCount*rawMult)/1000
    return(
      (Math.round(rawPrice)*1000).toString()
    )
  }
  const normalPriceDiscount=(priceText,discount,count)=>{
    if(!priceText||priceText === null||priceText === undefined) return(0)
    if(!discount) return(0)
    var rawCount = parseFloat(count.toString())
    var discount = parseInt(discount.toString())
    var newDiscount = discount
    if(discount<100)
        newDiscount = discount * rawCount * priceText /100
    rawPrice = parseInt(Math.round(newDiscount/1000))*1000
    return(rawPrice)
}
const findPayValuePrice=(priceArray,payValue)=>{
    if(!priceArray)return(0)
    if(!payValue)payValue = 4
    var price = priceArray
    if(priceArray.length&&priceArray.constructor === Array)
        price=priceArray.find(item=>item.saleType==payValue).price
   
    return(price)

}

module.exports =CartToSepidar