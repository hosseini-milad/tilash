const findPayValuePrice = require("./FindPayValuePrice");

const SepidarDiscountToItems=(oldCartItems, cartDiscount,totalPrice)=>{
	var cDiscount = 0
	var preDiscount = 0//pDiscount?Number(pDiscount):0
	var disCount = Number(cartDiscount)-preDiscount
	var disPercent= 0
	//if(disCount>100){
		disPercent = disCount/Number(totalPrice)
	//}
		for (var i = 0; i < (oldCartItems && oldCartItems.length); i++) {
			var price = findPayValuePrice(oldCartItems[i].price, oldCartItems.payValue)
			var count = Number(oldCartItems[i].count)
			var oldDiscount = oldCartItems[i].discount?Number(oldCartItems[i].discount ):0
			if(oldDiscount&&oldDiscount<100) oldDiscount = oldDiscount * price*count
			var roundDiscount = 0
			if(i == oldCartItems.length-1){
				roundDiscount = disCount - cDiscount
			}
			else roundDiscount= (parseInt(Number(disPercent*price*count)/10000)*10000)

			var newDiscount = oldDiscount + roundDiscount
			cDiscount += roundDiscount
			oldCartItems[i].discount = newDiscount;
		}
		return oldCartItems

}
module.exports =SepidarDiscountToItems