const qCart = require("../../models/product/quickCart");
const findPayValuePrice = require("./FindPayValuePrice");
const { TaxRate } = process.env

const findCartItemDetail=async(cartItem, payValue, totalDiscount)=>{
	var cartItemPrice = findPayValuePrice(cartItem.price, payValue)
	if(cartItem.fixPrice)
		cartItemPrice = cartItem.fixPrice
	var tax = 0
	var discount = 0
	var totalPrice = 0
	var count = cartItem.count
	if (cartItem.discount||totalDiscount) {
		var off = 0
		if(cartItem.discount)
			off += parseInt(cartItem.discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))
		if (totalDiscount) {
			off += parseInt(totalDiscount.toString().replace(/,/g, '').replace(/^\D+/g, ''))
		}
		if (off > 100)
			discount += off
		else
			discount += parseInt(cartItemPrice) *
				count * (off) / 100
		//console.log(off+": "+cartDiscount)
	}
	tax = (cartItemPrice * count - discount) * Number(TaxRate)
	totalPrice = (cartItemPrice * count - discount) * (1 + Number(TaxRate))
	
	return ({
		price: cartItemPrice, tax: tax,
		total: totalPrice, discount: discount
	})
	

}
module.exports =findCartItemDetail