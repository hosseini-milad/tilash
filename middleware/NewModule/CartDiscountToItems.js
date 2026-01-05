const qCart = require("../../models/product/quickCart");
const findPayValuePrice = require("./FindPayValuePrice");
const quoteApi = require('../../models/product/quote');

const CartDiscountToItems=async(userId,oldCartItems, cartDiscount,totalPrice,
	pDiscount,isQuote)=>{
	var cDiscount = 0
	var preDiscount = 0//pDiscount?Number(pDiscount):0
	var disCount = Number(cartDiscount)-preDiscount
	var disPercent= 0

	if(disCount>100){
		disPercent = disCount/Number(totalPrice)
	}
	else disPercent = disCount/100
		for (var i = 0; i < (oldCartItems && oldCartItems.length); i++) {
			var price = findPayValuePrice(oldCartItems[i].price, oldCartItems.payValue)
			console.log("price: ",price)
			var count = Number(oldCartItems[i].count)
			var oldDiscount = Number(oldCartItems[i].discount )
			var roundDiscount = 0
			if(i == oldCartItems.length-1){
				var remainDiscount = Number(totalPrice) *disPercent
				console.log("remainDiscount: ",remainDiscount)
				roundDiscount = remainDiscount - cDiscount
			}
			else roundDiscount= 
				(parseInt(Number(disPercent*price*count)/1000)*1000)
			

			var newDiscount = oldDiscount + roundDiscount
			cDiscount += roundDiscount
			console.log("roundDiscount: ",roundDiscount)
			console.log("newDiscount: ",newDiscount)
			oldCartItems[i].discount = newDiscount;
		}
		//return oldCartItems
		if(isQuote)
			await quoteApi.updateOne({ userId: userId }, { $set: { cartItems: oldCartItems } });
		else
			await qCart.updateOne({ userId: userId }, { $set: { cartItems: oldCartItems } });
		

}
module.exports =CartDiscountToItems