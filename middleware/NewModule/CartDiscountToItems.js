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
			
			var count = Number(oldCartItems[i].count)
			var oldDiscount = Number(oldCartItems[i].discount )
			var roundDiscount = 0
			console.log(disPercent , cDiscount)
			if(i == oldCartItems.length-1){
				var remainDiscount = Number(totalPrice) *disPercent
				roundDiscount = remainDiscount - cDiscount
			}
			else roundDiscount= (parseInt(Number(disPercent*price*count)/10000)*10000)
			
			var newDiscount = oldDiscount + roundDiscount
			cDiscount += newDiscount
			oldCartItems[i].discount = newDiscount;
		}
		if(isQuote)
			await quoteApi.updateOne({ userId: userId }, { $set: { cartItems: oldCartItems } });
		else
			await qCart.updateOne({ userId: userId }, { $set: { cartItems: oldCartItems } });
		

}
module.exports =CartDiscountToItems