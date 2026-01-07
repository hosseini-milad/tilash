const tasks = require("../models/crm/tasks")
const cart = require("../models/product/cart")
const quickCartModel = require("../models/product/quickCart")

const FindCurrentExistSale=async(itemId,cartNo,stockNo,userId)=>{
    const currentTasks = await cart.find({status:{$nin:["done","cancel","quote"]},
        isQuote:false,taskStep:{$nin:["cancel"]},stockId:stockNo})
        
    const currentQuick = await quickCartModel.find({stockId:stockNo})
   
    var stockId=stockNo?stockNo:"13"
    var countOrder =0
    for(var i=0;i<currentTasks.length;i++){
        if(currentTasks[i].cartNo == cartNo) continue
        var cartItems = currentTasks[i].cartItems
        if(!cartItems) continue
        for(var j=0;j<cartItems.length;j++){
            
            if(cartItems[j].id === itemId){
                //validOrder.push(cartItems[j]) 
                countOrder+=parseInt(cartItems[j].count)
            }
        }
        
        //validOrder.push(validOrder)
    }
    for(var i=0;i<currentQuick.length;i++){
        if(currentQuick[i].userId == userId) continue
        var cartItems = currentQuick[i].cartItems
        if(!cartItems) continue
        for(var j=0;j<cartItems.length;j++){
            
            if(cartItems[j].id === itemId){
                //validOrder.push(cartItems[j]) 
                countOrder+=parseInt(cartItems[j].count)
            }
        }
        
        //validOrder.push(validOrder)
    }
    return(countOrder)
    
    
}

module.exports =FindCurrentExistSale