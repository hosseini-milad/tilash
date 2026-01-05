const qCart = require("../../models/product/quickCart");
const products = require("../../models/product/products");
const findQCartSum = require("./FindQuickCartSum");
const findCartItemDetail = require("./FindQuickItem");
const quoteApi = require('../../models/product/quote');
const cartModel = require("../../models/product/cart");

const FindCart=async(cartNo,noDiscount,isQuote)=>{
    if(!cartNo) return('')
        try{
        var qCartDetail= {}
        const qCartData = await cartModel.findOne({cartNo:cartNo}).lean()
        if (qCartData) {
			for (let j = 0; j < qCartData.cartItems.length; j++) {
				try {	const cartTemp = qCartData.cartItems[j];
					const productData = await products.findOne({ sku: cartTemp.sku }).lean();
					const cartItemDetail = findCartItemDetail(cartTemp, qCartData.payValue, noDiscount?0:qCartData.discount);
					qCartData.cartItems[j].total = cartItemDetail;
					qCartData.cartItems[j].productData = productData;
				} catch {}
			}
			qCartDetail = await findQCartSum(qCartData.cartItems, qCartData.payValue, 
                qCartData.discount, qCartData.transportPrice);
                
            return({qCartDetail,qCartData})
		}
    }
    catch{ return('')}

}
module.exports =FindCart