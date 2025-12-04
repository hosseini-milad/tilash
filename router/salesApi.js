const express = require('express');
const router = express.Router()
const auth = require("../middleware/auth");
const productSchema = require('../models/product/products');
const cart = require('../models/product/cart');
const qCart = require('../models/product/quickCart');
const users = require('../models/auth/users');
const category = require('../models/product/category');
const userModel = require('../models/auth/users');
const taskModel = require('../models/crm/tasks');
const profileModel = require('../models/auth/ProfileAccess');
const cartModel = require('../models/product/cart');
const quickCartModel = require('../models/product/quickCart');
const stockModel = require('../models/product/Stocks');

router.post('/find-products', auth, async (req, res) => {
	try {
        const { search, filters = {} } = req.body;
        const { brand, subCat, category } = filters;
		if (!brand && !category) {
			if (!search) {
                return res.status(400).json({ error: 'brand or category must be selected.' });
            }
		}
		const userData = await userModel.findOne({ _id: req.headers['userid'] }).lean();
		// const stockId = userData.StockId ? userData.StockId : '13'; // TODO: remove this line
		const stockId = userData.StockId;
        const stockArr = userData.StockArr
		const filter = userData.group === 'bazaryab' ? 'fs' : '';

        const productsMatchCondition = {
            active: true,
            sku: { $exists: true },
        };
        if (search) {
            productsMatchCondition['$or'] = [
                { sku: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
            ];
        }
        if (brand) {
            productsMatchCondition.brandId = brand;
        }
        if (subCat) {
            productsMatchCondition.catId = subCat;
        } else if (category) {
            productsMatchCondition.catId = category;
        }
        const productsAggregation = [
            { $match: productsMatchCondition },
            {
				$lookup: {
					from: 'productprices',
					localField: 'ItemID',
					foreignField: 'ItemID',
					as: 'priceData',
				},
			},
			{
				$lookup: {
					from: 'productcounts',
					localField: 'ItemID',
					foreignField: 'ItemID',
					as: 'countData',
				},
			},
        ];
		const searchProducts = await productSchema.aggregate(productsAggregation);
        //return res.json(searchProducts)
        const searchedProducts = searchProducts.map((i) => i.sku);
        // const tasksMatchCondition = {
        //     taskStep: {
        //         $nin: ['archive', 'cancel', 'quote', 'suuport'],
        //     }
        // };
        // const cartList = await taskModel.find(tasksMatchCondition).lean();
        // const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
		// // const cartList = await cart.find({ 'cartItems.sku': { $in: searchedProducts }, stockId, InvoiceID: { $exists: false } }).lean();
		// const currentCart = await cart.find({ 'cartItems.sku': { $in: searchedProducts }, cartNo: { $in: cartIds } }).lean();
		// const qCartList = await qCart.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
        const userProfiles = await profileModel.find({ _id: { $in: userData.profile } }).lean();
        const isSale = true//userProfiles.find((item) => item.profileCode === 'sale') ? true : false;
        let currentCart;
        let qCartList;
        if (isSale) {
            const cartsCondition = {
                'cartItems.sku': { $in: searchedProducts },
                isQuote: false,
                isSale,
                stockId,
                $or: [{ InvoiceID: { $exists: false } }, { taskStep: 'cancel' }],
            };
            currentCart = await cartModel.find(cartsCondition).lean();
            qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
        } else {
            const tasksMatchCondition = {
                taskStep: {
                    $nin: ['archive', 'cancel', 'quote', 'suuport'],
                }
            };
            const cartList = await taskModel.find(tasksMatchCondition).lean();
            const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
            currentCart = await cartModel.find({ 'cartItems.sku': { $in: searchedProducts }, cartNo: { $in: cartIds } }).lean();
            qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
        }
		let searchProductResult = [];
		let index = 0;
		for (let i = 0; i < searchProducts.length; i++) {
            let countArr = []
            for(var j=0;j<(stockArr&&stockArr.length);j++){
                //const stockInfo = await stockModel.findOne({StockID:stockArr[j].StockID})
                var tempCount = searchProducts[i].countData.find((item) => item.Stock == stockArr[j].StockID)
                countArr.push({
                    count:tempCount&&tempCount.quantity,
                    title:stockArr[j].Title,
                    id:stockArr[j].StockID,
                    isMain:(stockId == stockArr[j].StockID)?true:false
                })
            }
			let count = searchProducts[i].countData.find((item) => item.Stock == stockId);
			let desc = '';
			let cartCount = findCartCount(searchProducts[i].sku, currentCart.concat(qCartList), stockId);
            searchProducts[i].isZero = false
			if (!count) {
                count = {}
                searchProducts[i].isZero = true
                //continue;
            }
            count.quantity = parseInt(count.quantity) - parseInt(cartCount);
			if (1||count.quantity > 0) {
				index++;
				desc = searchProducts[i].title + '(' + searchProducts[i].sku + ')' + '___' + count.quantity;

				searchProductResult.push({
					...searchProducts[i],
					count,
                    countArr,
					description: desc,
				});
				if (index === 50) {
                    break;
                }
			}
		}
		return res.json({ products: searchProductResult });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const findCartCount = (item, cart, stockId) => {
	let cartCount = 0;
	for (let i = 0; i < cart.length; i++) {
        if (cart[i].stockId != stockId) {
            continue;
        }
		let cartItem = cart[i].cartItems;
		for (let c = 0; c < cartItem.length; c++) {
			if (cartItem[c].sku === item) {
				cartCount = parseInt(cartCount) + parseInt(cartItem[c].count);
			}
		}
	}
	return cartCount;
};

router.post('/find-products2', auth, async (req, res) => {
    const { search, filters } = req.body;
    const { brand, subCat, category } = filters;
    try {
        if (!filters || (!brand && !category)) {
			if (!search) {
				return res.status(400).json({ error: 'brand or category must select' });
			}
		}
        const userData = await users.findOne({ _id: req.headers['userid'] }).lean();
		const stockId = userData.StockId ? userData.StockId : '13';
		const filter = userData.group === 'bazaryab' ? 'fs' : '';

        const productsMatchCondition = {
            active: true,
            sku: { $exists: true },
        };
        if (filter) {
            productsMatchCondition.sku = { $in: [/fs/i, /cr/i, /pr/i] };
        }
        if (search) {
            productsMatchCondition['$or'] = [
                { sku: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
            ]
        }
        if (filters) {
            if (brand) {
                productsMatchCondition.brandId = brand;
            }
            if (subCat) {
                productsMatchCondition.catId = subCat;
            } else if (category) {
                productsMatchCondition.catId = category;
            }
        }
        const productsAggregation = [
			{ $match: productsMatchCondition },
			{
				$lookup: {
					from: 'productprices',
					localField: 'ItemID',
					foreignField: 'ItemID',
					as: 'priceData',
				},
			},
			{
				$lookup: {
					from: 'productcounts',
					localField: 'ItemID',
					foreignField: 'ItemID',
					as: 'countData',
				},
			},
		];
        const searchProducts = await productSchema.aggregate(productsAggregation);
            // aggregate([
                // {
            //     $match:
            //     search?{
            //         $or: [
            //             { sku: { $regex: search, $options: 'i' } },
            //             { title: { $regex: search, $options: 'i' } }
            //         ]
            //     }:{}
            // },
            // {$match:{active:true}},
            // {$match: filters && filters.brand ? { brandId: filters.brand }:{}},
            // {$match: filters ? filters.subCat ? { catId: filters.subCat }:
            //     filters.category ? { catId: filters.category } : {} :{} },
            // filter ? { $match: { sku: { $in: [/fs/i, /cr/i, /pr/i] } } } :
            //     { $match: { sku: { $exists: true } } },
            // {
            //     $lookup: {
            //         from: "productprices",
            //         localField: "ItemID",
            //         foreignField: "ItemID",
            //         as: "priceData"
            //     }
            // },
            // {
            //     $lookup: {
            //         from: "productcounts",
            //         localField: "ItemID",
            //         foreignField: "ItemID",
            //         as: "countData"
            //     }
            // }])
        const products = []
        const cartList = await cart.find(stockId ? { stockId, InvoiceID: { $exists: false } } : {}).lean();
        const qCartList = await qCart.find(stockId ? { stockId } : {}).lean();
        let index = 0
        for (let i = 0; i < searchProducts.length; i++) {
			let count = searchProducts[i].countData.find((item) => item.Stock === stockId); // TODO: check for Stock in query
			let description = '';
			const cartCount = findCartCount2(searchProducts[i].sku, cartList.concat(qCartList), stockId);
			if (count) {
                count.quantity = parseInt(count.quantity) - cartCount;
            }
			if (count && count.quantity > 0) {
				index++;
				description = `${searchProducts[i].title} (${searchProducts[i].sku})___${count.quantity}`;
				products.push({
					...searchProducts[i],
					count,
					description,
				});
				if (index === 15) {
                    break;
                }
			}
		}
        return res.json({ products });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
})

const findCartCount2 = (item, cart) => {
	let cartCount = 0;
	for (let i = 0; i < cart.length; i++) {
		let cartItems = cart[i].cartItems;
		for (let c = 0; c < cartItems.length; c++) {
			if (cartItems[c].sku === item) {
				cartCount = cartCount + parseInt(cartItems[c].count);
			}
		}
	}
	return cartCount;
};

module.exports = router;
