const qCart = require("../../models/product/quickCart");
const findPayValuePrice = require("./FindPayValuePrice");
const quoteApi = require('../../models/product/quote');
const cartModel = require("../../models/product/cart");

const CartDiscountToItemsCart=async(cartNo,oldCartItems, cartDiscount,totalPrice,
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
			if(i == oldCartItems.length-1){
				var remainDiscount = Number(totalPrice) *disPercent
				roundDiscount = remainDiscount - cDiscount
			}
			else roundDiscount= (parseInt(Number(disPercent*price*count)/1000)*1000)
			
			var newDiscount = oldDiscount + roundDiscount
			cDiscount += roundDiscount
			oldCartItems[i].discount = newDiscount;
		}
		//return(oldCartItems)
		//if(isQuote)
			await cartModel.updateOne({ cartNo: cartNo }, { $set: { cartItems: oldCartItems } });
		
		

}
module.exports =CartDiscountToItemsCart