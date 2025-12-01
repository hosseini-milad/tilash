const cartModel = require('../../models/product/cart');
const productCountModel = require('../../models/product/productCount');
const productModel = require('../../models/product/products');
const quickCartModel = require('../../models/product/quickCart');
const jMoment = require('moment-jalaali');

const getFromDate = (dateFrom = [], startOf = 'day') => {
	try {
		if (dateFrom[0]) {
			const [year, month, day] = dateFrom;
			return jMoment(`${year}-${month}-${day}`, 'YYYY-MM-DD').startOf('day').toISOString();
		}
		return jMoment().startOf(startOf).toISOString();
	} catch (err) {
		console.log(err);
		return jMoment().startOf(startOf).toISOString();
	}
};

const getToDate = (dateTo = [], endOf = 'day') => {
	try {
		if (dateTo[0]) {
			const [year, month, day] = dateTo;
			return jMoment(`${year}-${month}-${day}`, 'YYYY-MM-DD').endOf('day').toISOString();
		}
		return jMoment().endOf(endOf).toISOString();
	} catch (err) {
		console.log(err);
		return jMoment().endOf(endOf).toISOString();
	}
};

const productCountData = async (sku, stockId, isSale) => {
	try {
        const targetProduct = await productModel.findOne({ sku }).lean();
        if (!targetProduct) {
            return 0;
        }
        const productCountForThisStock = await productCountModel.findOne({ ItemID: targetProduct.ItemID, Stock: stockId }).lean();
        if (!productCountForThisStock) {
            return { quantity: 0 };
        }
        const cartsCondition = {
			'cartItems.sku': sku,
			isQuote: false,
			isSale,
			stockId,
			$or: [{ InvoiceID: { $exists: false } }, { taskStep: 'cancel' }],
		};
        const currentCart = await cartModel.find(cartsCondition).lean();
        const qCartList = await quickCartModel.find({ 'cartItems.sku': sku, stockId }).lean();
        const { orderCount, orderData } = findCartCount(sku, currentCart.concat(qCartList), stockId);
        const response = {
            count: productCountForThisStock,
            storeCount: productCountForThisStock.quantity,
            orderCount,
            perBox: targetProduct.perBox ? targetProduct.perBox : 0,
            orderData,
        };
        return response;
	} catch (error) {
		console.error(error);
        return 0;
	}
};

const findCartCount = (item, cart, stockId) => {
	let orderCount = 0;
	let orderData = [];
	for (let i = 0; i < cart.length; i++) {
		if (cart[i].stockId != stockId) {
            continue;
        }
		let cartItem = cart[i].cartItems;
		// let userData = await customers.findOne({ _id: ObjectID(cart[i].userId) });
		for (let c = 0; c < (cartItem && cartItem.length); c++) {
			if (cartItem[c].sku === item) {
                orderData.push({
				 	count: cartItem[c].count,
				 	orderNo: cart[i].cartNo,
				 	date: cart[i].initDate,
				 });
				orderCount += parseInt(cartItem[c].count);
			}
		}
	}
	return { orderCount, orderData };
};

module.exports = {
	getFromDate,
	getToDate,
    productCountData,
};
