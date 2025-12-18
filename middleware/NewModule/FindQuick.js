const qCart = require("../../models/product/quickCart");
const products = require("../../models/product/products");
const findQuickCartSum = require("./findQuickCartSum");
const findCartItemDetail = require("./FindQuickItem");

const FindQuick=async(userId,noDiscount)=>{
    if(!userId) return('')
        try{
        var qCartDetail= {}
        const qCartData = await qCart.findOne({userId:userId}).lean()
        if (qCartData) {
			for (let j = 0; j < qCartData.cartItems.length; j++) {
				try {	const cartTemp = qCartData.cartItems[j];
					const productData = await products.findOne({ sku: cartTemp.sku }).lean();
					const cartItemDetail = findCartItemDetail(cartTemp, qCartData.payValue, noDiscount?0:qCartData.discount);
					qCartData.cartItems[j].total = cartItemDetail;
					qCartData.cartItems[j].productData = productData;
				} catch {}
			}
			qCartDetail = await findQuickCartSum(qCartData.cartItems, qCartData.payValue, 
                qCartData.discount, qCartData.transportPrice);
                
            return({qCartDetail,qCartData})
		}
    }
    catch{ return('')}

}
module.exports =FindQuick