const express = require('express');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const router = express.Router()
const { ObjectId } = require('mongodb');
const jMoment = require('moment-jalaali');
const auth = require("../middleware/auth");
const logger = require('../middleware/logger');
const productSchema = require('../models/product/products');
const productcounts = require('../models/product/productCount');
const category = require('../models/product/category');
const cart = require('../models/product/cart');
const qCart = require('../models/product/quickCart');
const FaktorSchema = require('../models/product/faktor');
const customerSchema = require('../models/auth/customers');
const sepidarPOST = require('../middleware/SepidarPost');
const productCount = require('../models/product/productCount');
const cartLog = require('../models/product/cartLog');
const users = require('../models/auth/users');
const quickCart = require('../models/product/quickCart');
const bankAccounts = require('../models/product/bankAccounts');
const sepidarFetch = require('../middleware/Sepidar');
const products = require('../models/product/products');
const tasks = require('../models/crm/tasks');
const CheckSale = require('../middleware/CheckSale')
const profiles = require('../models/auth/ProfileAccess');
const CreateTask = require('../middleware/CreateTask');
const NewCode = require('../middleware/NewCode');
const customers = require('../models/auth/customers');
const brand = require('../models/product/brand');
const FindCurrentCart = require('../middleware/CurrentCart');
const FindCurrentExist = require('../middleware/CurrentExist');
const OrderToTask = require('../middleware/OrderToTask');
const IsToday = require('../middleware/IsToday');
const NewQuote = require('../middleware/NewQuote');
const quote = require('../models/product/quote');
const publicLinks = require ('../models/product/publicLinks');
const salePolicyGroupModel = require('../models/sale/salePolicyGroup');
const productPriceModel = require('../models/product/productPrice');
const userModel = require('../models/auth/users');
const quickCartModel = require('../models/product/quickCart');
const salePolicyDependentProductModel = require('../models/sale/salePolicyDependentProducts');
const productModel = require('../models/product/products');
const SendSMS = require('../middleware/NewModule/SendSMS');
const cartModel = require('../models/product/cart');
const profileModel = require('../models/auth/ProfileAccess');
const customerModel = require('../models/auth/customers');
const FindFaktor = require('../middleware/NewModule/FindFaktor');
const FindQuick = require('../middleware/NewModule/FindQuick');
const CartDiscountToItems = require('../middleware/NewModule/CartDiscountToItems');
const { TaxRate } = process.env

const commaSeparatedPrices = (number) => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

router.post('/products', async (req, res) => {
	try {
		const products = await productSchema.find({}).lean();
		return res.json({ products });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/list-products', jsonParser, async (req, res) => {
	try {
		const filter = req.body.filters;
		const brandId = filter ? filter.brand : '';
		const catId = filter ? filter.category : '';
		//const subId = filter ? filter.subCategory : ''
		const subId = filter ? filter.subCat : '';
		const search = filter ? filter.search : '';
		const stockId = req.body.stockId;
        const offset = filter ? filter.offset:0; 
        const pageSize = filter ? filter.pageSize :10;
        const skip = offset?Number(offset):0;
        const limit = pageSize?Number(pageSize):10;


		const categoryData = await category.findOne({ catCode: catId }).lean();
		const catDataID = categoryData && categoryData._id;
		const subChild = subId ? [] : await category.find({ parent: catDataID }).lean();
		const subChildId = subChild.map((item) => item.catCode);

		let searchCat = '';
		if (subId) {
			searchCat = {
				catId: subId,
			};
		} else {
			if (catId) {
				if (subChildId && subChildId.length) {
					searchCat = {
						catId: {
							$in: subChildId,
						},
					};
				} else {
					searchCat = {
						catId,
					};
				}
			} else {
				searchCat = {};
			}
		}

        const productsMatchCondition = {
            ...searchCat,
        };
        if (brandId) {
            productsMatchCondition.brandId = brandId;
        }
        if (search) {
            productsMatchCondition['$or'] = [
                { title: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }
        const productCount = await productSchema.countDocuments([
			{ $match: productsMatchCondition },
            ])
		const products = await productSchema.aggregate([
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
            { $skip: skip },
            { $limit: limit },
		]);

		let showProduct = products//[];
		/*for (let i = 0; i < products.length; i++) {
			let count = products[i].countData && products[i].countData.find((item) => item.Stock == stockId);
			// let count3 = products[i].countData && products[i].countData.find((item) => item.Stock == '9');

			if (count) count = count.quantity;
			products[i].countData = count;
			// if (count3) count3 = count3.quantity;
			// if (count || count3) showProduct.push(products[i]);
			if (count) showProduct.push(products[i]);
		}*/
		return res.json({ products: showProduct ,size:productCount});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.get('/get-sub-cats', async (req, res) => {
	try {
		const title = req.query.title;
		const catData = await category.findOne({ catCode: title }).lean();
		if (!catData) {
			return res.status(400).json({ error: 'دسته بندی یافت نشد' });
		}
		const subCat = await category.find({ parent: catData._id }, { description: 0, __v: 0, date: 0 }).lean();
		return res.send(subCat);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.get('/list-filters', async (req, res) => {
	try {
		const brands = await brand.find({}).lean();
		const cats = await category.find({
            $or: [
                { parent: { $exists: false } },
                { parent: null }
            ],
        }).lean();

		return res.json({ brands, cats });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.get('/list-filters-panel', auth, async (req, res) => {
	try {
		const userId = req.headers['userid'];
		const user = await users.findOne({ _id: userId }).lean();
		if (!user || !user.CustomerID) {
			return res.status(400).json({ error: 'user has no default.' });
		}
		const defaultUser = await customers.findOne({ default: user.username }).lean();
		const brands = await brand.find().lean();
		const cats = await category.find({
            $or: [
                { parent: { $exists: false } },
                { parent: null }
            ],
        }).lean();
		return res.json({ brands, cats, defaultUser, user });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/find-products', jsonParser, auth, async (req, res) => {
	try {
        const salePolicyGroups = {
            side1: 'lowSellingProducts1',
            side2: 'lowSellingProducts2',
            sub: 'sideProducts',
			dependent: 'neutral',
        };
        const { search = '', sale } = req.body;
		const userData = await users.findOne({ _id: req.headers['userid'] }).lean();
		if (!userData) {
			return res.status(400).json({ error: 'کاربر مجاز نیست.' });
		}
		const stockId = userData.StockId;
		const productsMatchCondition = {
			active: true,
			sku: { $exists: true },
		};
        if (salePolicyGroups[sale]) {
            const targetSalePolicyGroup = await salePolicyGroupModel.findOne({ category: salePolicyGroups[sale] }).lean();
            if (targetSalePolicyGroup) {
                productsMatchCondition.salePolicyGroupId = targetSalePolicyGroup._id;
            }
        }
		if (search) {
			productsMatchCondition['$or'] = [
                { sku: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } }
            ];
		}
		const searchProducts = await productSchema.aggregate([
			{
				$match: productsMatchCondition,
			},
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
		]);
        const searchedProducts = searchProducts.map((i) => i.sku);
        const userProfiles = await profiles.find({ _id: { $in: userData.profile } }).lean();
        const isSale = userProfiles.find((item) => item.profileCode === 'sale') ? true : false;
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
            const cartList = await tasks.find(tasksMatchCondition).lean();
            const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
            currentCart = await cartModel.find({ 'cartItems.sku': { $in: searchedProducts }, cartNo: { $in: cartIds } }).lean();
            qCartList = await qCart.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
        }
		const products = [];
		let index = 0;
		for (let i = 0; i < searchProducts.length; i++) {
			let count = searchProducts[i].countData.find((item) => item.Stock == stockId); // TODO: check for Stock in query
			// let count3 = searchProducts[i].countData.find((item) => item.Stock == '9');
			let desc = '';
			let cartCount = findCartCount(searchProducts[i].sku, currentCart.concat(qCartList), stockId);
			if (!count) {
                continue;
			}
            count.quantity = parseInt(count.quantity) - parseInt(cartCount.count);
			// if ((count && count.quantity > 0) || (count3 && count3.quantity > 0)) {
			if (count.quantity > 0) {
				index++;
				desc = searchProducts[i].title + '(' + searchProducts[i].sku + ')' + '___' + (count.quantity);

				products.push({
					...searchProducts[i],
					count,
					description: desc,
				});
				if (index === 30) {
                    break;
                }
			}
		}
		return res.json({ products, productsMatchCondition });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/calc-count2', auth, async (req, res) => {
    const userData = await users.findOne({ _id: req.headers['userid'] })
    var allOrder = req.body.allOrder
    const stock = req.body.stockId
    const stockId =stock?stock: userData.StockId ? userData.StockId : ""
    if(!stockId){
        res.status(400).json({ message: "انبار انتخاب نشده است" })
        return
    }
    const sku = req.body.sku
    if (!sku) {
        res.status(400).json({ message: "not found" })
        return
    }
    try {
        const searchProducts = await productSchema.aggregate([
            { $match: { sku: sku } },
            {
                $lookup: {
                    from: "productprices",
                    localField: "ItemID",
                    foreignField: "ItemID",
                    as: "priceData"
                }
            },
            {
                $lookup: {
                    from: "productcounts",
                    localField: "ItemID",
                    foreignField: "ItemID",
                    as: "countData"
                }
            }
        ])
        var date = new Date(Date.now())
        var today = date.toISOString().slice(0, 10) + " 00:00"
        const cartList = await tasks.aggregate([
            {
                $match: {
                    taskStep: {
                        $nin:
                            allOrder ? ['cancel'] : ['archive', 'cancel','quote','suuport']
                    }
                }
            },
            { $match: allOrder ? { date: { $gte: new Date(today) } } : {} }
        ])
        var cartIds = cartList.map(item => item.orderNo)
        var currentCart = await FindCurrentCart(cartList.map(item => item.orderNo))
        //console.log(today)
        const qCartList = await qCart.find(stockId ? { stockId: stockId } : {})
        for (var i = 0; i < searchProducts.length; i++) {
            var count = searchProducts[i].countData.find(item => (item.Stock == stockId))
            // var count3 = searchProducts[i].countData.find(item => (item.Stock == "9"))
            var desc = ''
            count = count ? count : 0
            // count3 = count3 ? count3 : 0
            var countData = await findCartCount2(searchProducts[i].sku, currentCart.concat(qCartList), stockId)
            var cartCount = countData && countData.count
            //console.log(cartCount)
            const storeCount = count ? parseInt(count.quantity) : 0
            const orderCount = parseInt(cartCount)
            // if (count || count3) {
            //     if (count)
            //         count.quantity = storeCount - orderCount
            //     else if (count3)
            //         count3.quantity = count3.quantity - orderCount
            //     res.json({
            //         count, storeCount, orderCount, count3: count3 ? count3.quantity : 0,
            //         perBox: searchProducts[i].perBox ? searchProducts[i].perBox : 0,
            //         orderData: countData.data, cartList
            //     })
            //     return
            // }
            if (count) {
                count.quantity = storeCount - orderCount
                res.json({
                    count, storeCount, orderCount,
                    perBox: searchProducts[i].perBox ? searchProducts[i].perBox : 0,
                    orderData: countData.data, cartList
                })
                return
            }
            else {
                res.json({ count: 0, storeCount, orderCount })
                return
            }
        }

    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
//const findCartCount = async (item, cart,stockId	) => {

const findCartCount2 = async (item, cart,stockId	) => {
    var cartCount = 0
    var inOrder = []
    for (var i = 0; i < cart.length; i++) {
        if(cart[i].stockId != stockId) continue
        var cartItem = cart[i].cartItems
        var userData = await customers.findOne({ _id: cart[i].userId })
        for (var c = 0; c < (cartItem && cartItem.length); c++) {
            if (cartItem[c].sku === item) {
                inOrder.push({
                    orderNo: cart[i].cartNo,
                    count: cartItem[c].count,
                    cName: userData ? userData.username : cart[i].userId,
                    date: cart[i].initDate
                })
                cartCount = parseInt(cartCount) + parseInt(cartItem[c].count)
            }
        }
    }
    //console.log(inOrder)
    return ({ count: cartCount, data: inOrder })

}

router.post('/calc-count', auth, async (req, res) => {
	try {
		const { stockId: stock, allOrder, sku } = req.body;
		const userData = await users.findOne({ _id: req.headers['userid'] }).lean();
		const stockId = stock ? stock : userData.StockId;
		if (!stockId) {
			return res.status(400).json({ message: 'انبار انتخاب نشده است' });
		}
		if (!sku) {
			return res.status(400).json({ message: 'not found' });
		}
		const [searchProducts] = await productSchema.aggregate([
			{ $match: { sku } },
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
		]);
        if (!searchProducts) {
            return res.status(400).send({ error: 'محصولی یافت نشد.' });
        }
        // const today = jMoment().startOf('day').toISOString();
        // const tasksMatchCondition = {
        //     taskStep: {
        //         $nin: ['archive', 'cancel', 'quote', 'suuport'],
        //     }
        // };
        // if (allOrder) {
        //     tasksMatchCondition.taskStep = { $nin: ['cancel'] };
        //     tasksMatchCondition.date = { $gte: new Date(today) };
        // }
		// const cartList = await tasks.find(tasksMatchCondition).lean();
        // const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
		// let currentCart = await FindCurrentCart(cartIds);
		// const currentCart = await cartModel.find({ 'cartItems.sku': sku, cartNo: { $in: cartIds } }).lean();
		//console.log(today)
		// const qCartList = await qCart.find({ 'cartItems.sku': sku, stockId }).lean();
        // TODO: I think it is better to find carts and then tasks
        const userProfiles = await profiles.find({ _id: { $in: userData.profile } }).lean();
        const isSale = userProfiles.find((item) => item.profileCode === 'sale') ? true : false;
        let currentCart;
        let qCartList;
        if (isSale) {
            const cartsCondition = {
                'cartItems.sku': sku,
                isQuote: false,
                isSale,
                stockId,
                $or: [{ InvoiceID: { $exists: false } }, { taskStep: 'cancel' }],
            };
            currentCart = await cartModel.find(cartsCondition).lean();
            qCartList = await quickCartModel.find({ 'cartItems.sku': sku, stockId }).lean();
        } else {
            const tasksMatchCondition = {
                taskStep: {
                    $nin: ['archive', 'cancel', 'quote', 'suuport'],
                }
            };
            const cartList = await tasks.find(tasksMatchCondition).lean();
            const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
            currentCart = await cartModel.find({ 'cartItems.sku': sku, cartNo: { $in: cartIds } }).lean();
            qCartList = await qCart.find({ 'cartItems.sku': sku, stockId }).lean();
        }
		// for (let i = 0; i < searchProducts.length; i++) {
			let count = searchProducts.countData.find((item) => item.Stock == stockId);
			// count = count ? count : 0;
            if (!count) {
				return res.json({ count: 0 });
            }
			let countData = findCartCount(searchProducts.sku, currentCart.concat(qCartList), stockId);
			let cartCount = countData && countData.count;
			//console.log(cartCount)
			const storeCount = count ? parseInt(count.quantity) : 0;
			const orderCount = parseInt(cartCount);
            count.quantity = storeCount - orderCount;
            return res.json({
                count,
                storeCount,
                orderCount,
                perBox: searchProducts.perBox ? searchProducts.perBox : 0,
                orderData: countData.data,
                cartList: [],
            });
		// }
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const findCartCount = (item, cart, stockId) => {
	let cartCount = 0;
	let inOrder = [];
	for (let i = 0; i < cart.length; i++) {
		if (cart[i].stockId != stockId) {
            continue;
        }
		let cartItem = cart[i].cartItems;
		// let userData = await customers.findOne({ _id: ObjectID(cart[i].userId) });
		for (let c = 0; c < (cartItem && cartItem.length); c++) {
			if (cartItem[c].sku === item) {
				 inOrder.push({
				 	count: cartItem[c].count,
				 	orderNo: cart[i].cartNo,
				 	date: cart[i].initDate,
				 });
				cartCount = parseInt(cartCount) + parseInt(cartItem[c].count);
			}
		}
	}
	return { count: cartCount, data: inOrder };
};

router.post('/update-product', jsonParser, auth, async (req, res) => {
    const data = {
        title: req.body.title,
        sku: req.body.sku,
        date: Date.now()
    }
    try {
        var status = "";
        const searchProduct = await productSchema.findOne({ sku: data.sku })
        if (!searchProduct) {
            await productSchema.create(data)
            status = "new product"
        }
        else {
            await productSchema.updateOne(
                { sku: data.sku }, { $set: data })
            status = "update product"
        }
        const allProducts = await productSchema.find()
        //logger.warn("main done")
        res.json({ products: allProducts, status: status })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/categories', async (req, res) => {
	try {
		const categories = await category.find({}).lean();
		return res.json({ categories });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/update-category', jsonParser, auth, async (req, res) => {
    const data = {
        title: req.body.title,
        parent: req.body.parent,
        body: req.body.body,
        date: Date.now()
    }
    try {
        var status = "";
        const searchCategory = await category.findOne({ catCode: req.body.catCode })
        if (!searchCategory) {
            await category.create(data)
            status = "new category"
        }
        else {
            await category.updateOne(
                { catCode: req.body.catCode }, { $set: data })
            status = "update category"
        }
        const allCategory = await category.find()
        res.json({ categories: allCategory, status: status })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/cart2', auth, async (req, res) => {
    var pageSize = req.body.pageSize?req.body.pageSize:"10";
    var search = req.body.search;
    var offset = req.body.offset?(parseInt(req.body.offset)):0;
    const userId = req.body.userId
    try {
        const cartDetails = await findCartFunction2(userId, 
            req.headers['userid'],pageSize,offset,search)
        res.json(cartDetails)
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
const findCartFunction2 = async (userId, managerId,pageSize,offset,search) => {
    const isSale = await CheckSale(managerId)
    if(managerId==userId) userId = ''
    try {
        const cartData = await cart.aggregate([
            { $match: { manageId: managerId } },
            { $match: userId ? { userId: userId } : {} },
            { $match: { result: { $exists: false } } },
            { $sort: { "initDate": -1 } },
            //{$limit:10}
        ])

        const qCartData = await qCart.findOne({ userId: userId ? userId : managerId }).lean()
        const qCartAdmin = await qCart.aggregate([
            { $match: { manageId: managerId } },

            { $match: { cartItems: { $ne: [] } } },

            { $addFields: { "userId": { "$toObjectId": "$userId" } } },
            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
        ])
        //const userData = await customerSchema.findOne({userId:ObjectID(userId)})

        var cartDetail = []
        var qCartDetail = ''
        var description = ''
        var todayCartData = []
        for (var c = 0; c < (cartData && cartData.length); c++) {
            if ((!userId&&isSale) &&(IsToday(cartData[c].initDate) !== 1)) {// 
                continue
            }
            try {
                var found = 0
                for (var j = 0; j < cartData[c].cartItems.length; j++) {
                    try {
                        var cartTemp = cartData[c].cartItems[j]                      
                        const productData = await products.findOne({ sku: cartTemp.sku })
                        
                        if(search){
                            var reg = new RegExp(search,"i")
                            var skuSearch = reg.test(cartTemp.sku)
                            var nameSearch = productData&&reg.test(productData.title)
                            if(nameSearch||skuSearch)
                                found = 1
                        }  
                        const cartItemDetail = findCartItemDetail(cartTemp, cartData[c].payValue,cartData[c].discount)
                        cartData[c].cartItems[j].total = cartItemDetail
                        cartData[c].cartItems[j].productData = productData
                    }
                    catch { }
                }
                const userData = await customers.findOne({ _id: cartData[c].userId }).lean();
                var official = 1
                if(!userData.CustomerID) official = 0
                if(userData.cName&&userData.cName.includes("مصرف"))official = 0

                
            
            if(search&&!found)continue
            else
                todayCartData.push({...cartData[c], userData: userData})
                cartData[c] = { ...cartData[c] ,official}
                cartDetail.push(findCartSum(cartData[c].cartItems,
                    cartData[c].payValue,cartData[c].transportPrice))
            }
            catch { }
        }
        if (qCartData) {
            for (var j = 0; j < qCartData.cartItems.length; j++) {
                try {
                    var cartTemp = qCartData.cartItems[j]
                    const productData = await products.findOne({ sku: cartTemp.sku })
                    qCartData.cartItems[j].productData = productData

                    const cartItemDetail = findCartItemDetail(cartTemp, qCartData.payValue, qCartData.discount)
                    qCartData.cartItems[j].total = cartItemDetail
                    qCartData.cartItems[j].productData = productData
                }
                catch { }
            }
            qCartDetail = findQuickCartSum(qCartData.cartItems,
                qCartData.payValue, qCartData.discount)
        }
        const pageCart = todayCartData.slice(offset?offset:0,
            (parseInt(offset?offset:0)+parseInt(pageSize?pageSize:10)))  
        return ({
            cart: pageCart, cartDetail: cartDetail, userData: "userData", isSale,
            size:todayCartData&&todayCartData.length,
            quickCart: qCartData, qCartDetail: qCartDetail, qCartAdmin: qCartAdmin
        })
    }
    catch {
        return ({
            cart: [], cartDetail: [], isSale,
            quickCart: '', qCartDetail: ''
        })
    }
}

const checkIfCanSubmitOrderForThisCustomer = async (userId, customerId) => {
	let canSubmit = false;
	const targetCustomer = await customerModel.findOne({ _id: customerId }).lean();
    if(!targetCustomer) return true
    if(!targetCustomer.visitorId && !targetCustomer.profileId) {
        return(true) 
    }       
	const targetUser = await userModel.findOne({ _id: userId }).lean();
    if(targetUser.access == "manager") return true
    if(targetUser.profile.find(item=>item=="65d5aea47e64e13ebcfba6ad") ) return true
	if (targetCustomer.visitorId) {
		if (`${targetUser._id}` === targetCustomer.visitorId) {
			canSubmit = true;
		}
	}
	if (!canSubmit && targetCustomer.profileId) {
		if (targetUser.profile.includes(targetCustomer.profileId)) {
			canSubmit = true;
		}
	}
	return canSubmit;
};

router.post('/canSubmitOrderForCustomer', jsonParser, auth, async (req, res) => {
    try {
        const { customerId } = req.body;
        const canSubmit = await checkIfCanSubmitOrderForThisCustomer(req.headers['userid'], customerId);
        return res.json({ canSubmit });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post('/cart', jsonParser, auth, async (req, res) => {
    try {
        const { userId, offset = 0, pageSize = 10, search, dateFrom, dateTo ,isQuote=0} = req.body;
        const skip = parseInt(offset);
        const limit = parseInt(pageSize);
        const canSubmit = userId?await checkIfCanSubmitOrderForThisCustomer(req.headers['userid'], userId):1;
        if (!canSubmit) {
            return res.status(400).json({ message: 'امکان ثبت سفارش برای این مشتری برای شما وجود ندارد.' });
        }
		const cartDetails = await findCartFunction(userId, 
            req.headers['userid'], limit, skip, 
            search, dateFrom, dateTo,isQuote);
        const response = {
            canSubmit: true,
            ...cartDetails,
        };
        const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
        response.needDependency = needDependency;
        response.dependencyCheckResult = dependencyCheckResult;
		return res.json(response);
		// return res.json(cartDetails);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const findCartFunction = async (userIdRaw, manageId, pageSize = 10, offset = 0, 
    search, dateFrom = [], dateTo = [],isQuoteTemp=0) => {
    let isSale;
    var userId=userIdRaw
    try {
        isSale = await CheckSale(manageId);
        const fromDate = dateFrom[0] ? jMoment(`${dateFrom[0]}-${dateFrom[1]}-${dateFrom[2]}`).startOf('day').toISOString() : '';//jMoment().startOf('day').toISOString();
        const toDate = dateTo[0] ? jMoment(`${dateTo[0]}-${dateTo[1]}-${dateTo[2]}`).endOf('day').toISOString() : '';//jMoment().endOf('day').toISOString();
        if (manageId == userId) {
            userId = '';
        }
        var clientList=[]
        const adminData = await users.findOne({ _id: new ObjectId(manageId) });

        if(adminData.access=="admin"){
            var userList = await users.find(
                {profile:{$in:adminData.profile}})//{StockId:userData.StockId})
            clientList=(userList.map(item=>item._id.toString()))
        }
        clientList.push(adminData._id.toString())
		const cartDataMatchCondition = {
            taskStep:{$nin:["cancel"]},
            manageId: {$in:clientList}
			//manageId, 
		};
        if(fromDate){
            cartDataMatchCondition.initDate={ $gte: new Date(fromDate), $lte: new Date(toDate)}
        }
		if (userId) {
			cartDataMatchCondition.userId = userId;
		}
        if (search) {
            cartDataMatchCondition['$or'] = [
                { 'cartItems.sku': { $regex: search } },
                { 'cartItems.title': { $regex: search } },
            ]
        }
        //console.log(cartDataMatchCondition)
        var isQuote = false 
        if(isQuoteTemp){
            if(isQuoteTemp =="true") isQuote = true 
        }
		const cartDataAggregation = [
            { $match: isQuoteTemp?(isQuoteTemp =="true"?{isQuote:true}:{isQuote:false}):{}},
            { $match: cartDataMatchCondition },
            { $sort: { initDate: -1 } },
            { $skip: offset },
            { $limit: pageSize },
        ];
		const qCartAdminMatchCondition = {
			manageId,
			cartItems: { $ne: [] }, // TODO
		};
		const qCartAdminAggregation = [
			{ $match: qCartAdminMatchCondition },
			{ $addFields: { userId: { $toObjectId: '$userId' } } },
			{
				$lookup: {
					from: 'customers',
					localField: 'userId',
					foreignField: '_id',
					as: 'userInfo',
				},
			},
		];
        const [cartData, qCartData, qCartAdmin] = await Promise.all([
            cart.aggregate(cartDataAggregation),
            qCart.findOne({ userId: userId ? userId : manageId }).lean(),
            qCart.aggregate(qCartAdminAggregation),
        ])
        // const cartData = await cart.aggregate(cartDataAggregation);
		// const qCartData = await qCart.findOne({ userId: userId ? userId : manageId }).lean();
		// const qCartAdmin = await qCart.aggregate(qCartAdminAggregation);
		let cartDetail = [];
		let qCartDetail = '';
		let description = '';
		let todayCartData = [];
        var userData = ''
		for (let c = 0; c < (cartData && cartData.length); c++) {
            if (!userId && isSale && IsToday(cartData[c].initDate) !== 1) {
                // TODO: what is this if for?
                //continue;
            }
			try {
				for (let j = 0; j < cartData[c].cartItems.length; j++) {
					try {
						const cartTemp = cartData[c].cartItems[j];
						const productData = await products.findOne({ sku: cartTemp.sku }).lean();
						const cartItemDetail = findCartItemDetail(cartTemp, cartData[c].payValue, cartData[c].pDiscount);
						cartData[c].cartItems[j].total = cartItemDetail;
						cartData[c].cartItems[j].productData = productData;
					} catch {}
				}
				userData = await customers.findOne({ _id: cartData[c].userId }).lean();
				let official = 1;
				if (!userData.CustomerID) {
                    official = 0;
                }
				if (userData.cName && userData.cName.includes('مصرف')) {
                    official = 0;
                }
                userData = await customers.findOne({ _id: cartData[c].userId }).lean();
                var bankData = cartData[c].bank&&
                await bankAccounts.findOne({ BankAccountID: cartData[c].bank})
                cartData[c].bankName = bankData&&bankData.DlTitle
				cartData[c] = { ...cartData[c], official ,userData};
                todayCartData.push({ ...cartData[c], userData });
				cartDetail.push(findCartSum(cartData[c].cartItems, 
                    cartData[c].payValue,cartData[c].transportPrice,
                    cartData[c].discount));
			} catch {}
		}
		if (qCartData) {
			for (let j = 0; j < qCartData.cartItems.length; j++) {
				try {
					const cartTemp = qCartData.cartItems[j];
					const productData = await products.findOne({ sku: cartTemp.sku }).lean();
					const cartItemDetail = findCartItemDetail(cartTemp, qCartData.payValue, qCartData.discount);
					qCartData.cartItems[j].total = cartItemDetail;
					qCartData.cartItems[j].productData = productData;
				} catch {}
			}
			qCartDetail = findQuickCartSum(qCartData.cartItems, qCartData.payValue, 
                qCartData.pDiscount, qCartData.transportPrice);
		}

        const response = {
            policy: true,
			cart: cartData,
			cartDetail,
			isSale,
			size: todayCartData.length,
			quickCart: qCartData,
			qCartDetail,
			qCartAdmin,
		};

		if (qCartData) {
            const { isSalePolicyRulesPassed, salePolicyRuleMessage, requiredProducts } = await checkForSalePolicyRules(qCartData, manageId);
            const { lowSellingProducts1, lowSellingProducts2, sideProducts } = await getCartItemsByPolicyGroup(qCartData);
            if (!isSalePolicyRulesPassed) {
                response.policy = false;
                response.policyRules = {
                    requiredProducts,
                    salePolicyRuleMessage,
                    selectedProducts: {
                        side: [...lowSellingProducts1, ...lowSellingProducts2],
                        sub: sideProducts,
                    },
                }
            }
        }

		return response;
	} catch (err) {
        console.log(err);
		return {
			cart: [],
			cartDetail: [],
			isSale,
			quickCart: '',
			qCartDetail: '',
		};
	}
};

const findQuoteFunction = async (userId, managerId) => {
    const isSale = await CheckSale(managerId)
    try {
        const cartData = await cart.aggregate([
            { $match: { manageId: managerId } },
            { $match: userId ? { userId: userId } : {} },
            { $match: { result: { $exists: false } } },
            { $sort: { "initDate": -1 } }
        ])

        const quoteData = await quote.findOne({ userId: userId ? userId : managerId }).lean()
        const quoteAdmin = await quote.aggregate([
            { $match: { manageId: managerId } },

            { $match: { cartItems: { $ne: [] } } },

            { $addFields: { "userId": { "$toObjectId": "$userId" } } },
            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
        ])
        //const userData = await customerSchema.findOne({userId:ObjectID(userId)})

        var cartDetail = []
        var quoteDetail = ''
        var description = ''
        var todayCartData = []
        for (var c = 0; c < (cartData && cartData.length); c++) {

            if (!userId && IsToday(cartData[c].initDate) !== 1) {
                continue
            }
            try {
                for (var j = 0; j < cartData[c].cartItems.length; j++) {
                    try {
                        var cartTemp = cartData[c].cartItems[j]
                        const productData = await products.findOne({ sku: cartTemp.sku })
                        const cartItemDetail = findCartItemDetail(cartTemp, cartData[c].payValue,cartData[c].discount)
                        cartData[c].cartItems[j].total = cartItemDetail
                        cartData[c].cartItems[j].productData = productData
                    }
                    catch { }
                }
                const userData = await customers.findOne({ _id: cartData[c].userId }).lean();
                cartData[c] = { ...cartData[c], userData: userData }
                cartDetail.push(findCartSum(cartData[c].cartItems))
            }
            catch { }
            todayCartData.push(cartData[c])

        }
        if (quoteData) {
            for (var j = 0; j < quoteData.cartItems.length; j++) {
                try {
                    var cartTemp = quoteData.cartItems[j]
                    const productData = await products.findOne({ sku: cartTemp.sku })
                    quoteData.cartItems[j].productData = productData

                    const cartItemDetail = findCartItemDetail(cartTemp, quoteData.payValue, quoteData.discount)
                    quoteData.cartItems[j].total = cartItemDetail
                    quoteData.cartItems[j].productData = productData
                }
                catch { }
            }
            quoteDetail = findQuickCartSum(quoteData.cartItems,
                quoteData.payValue, quoteData.discount)
        }
        return ({
            cart: todayCartData, cartDetail: cartDetail, userData: "userData", isSale,
            quote: quoteData, quoteDetail: quoteDetail, quoteAdmin: quoteAdmin
        })
    }
    catch {
        return ({
            cart: [], cartDetail: [], isSale,
            quote: '', quoteDetail: ''
        })
    }
}
const findPayValuePrice = (priceArray, payValue) => {
    if (!priceArray) return (0)
    if (!payValue) payValue = 3
    var price = priceArray
    if (priceArray.length && priceArray.constructor === Array)
        price = priceArray.find(item => item.saleType == payValue).price

    return (price)

}
const findCartItemDetail = (cartItem, payValue, totalDiscount) => {
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
const findCartData = async (cartNo) => {
    try {
        const cartData = await cart.findOne({ cartNo: cartNo })
        var cartDetail = ''

        cartDetail = findQuickCartSum(cartData.cartItems, 
            cartData.payValue, cartData.pDiscount,cartData.transportPrice)
        //if(qCartData) qCartDetail =findQuickCartSum(qCartData.cartItems,qCartData.payValue)
        for (var j = 0; j < cartData.cartItems.length; j++) {
            try {
                var cartTemp = cartData.cartItems[j]
                const productData = await products.findOne({ sku: cartTemp.sku })
                cartData.cartItems[j].productData = productData

                const cartItemDetail = findCartItemDetail(cartTemp, cartData.payValue, cartData.discount)
                cartData.cartItems[j].total = cartItemDetail
                cartData.cartItems[j].productData = productData
            }
            catch { }
        }

        return ({ cart: [cartData], cartDetail: cartDetail })
    }
    catch {
        return ({ cart: [], cartDetail: [] })
    }
}
const findQuickCartSum = (cartItems, payValue, discount ,transportPrice) => {
    if (!cartItems) return ({ totalPrice: 0, totalCount: 0 })
    var cartSum = 0;
    var cartCount = 0;
    var cartDescription = ''
    var cartDiscount = 0;
    var tPrice = Number(transportPrice)
    for (var i = 0; i < cartItems.length; i++) {
        try {//console.log(payValue)
            var fixPrice = cartItems[i].fixPrice
            var cartItemPrice = ''
            try {
                cartItemPrice = cartItems[i].price.find(item => item.saleType === payValue).price
                    .replace(/,/g, '').replace(/^\D+/g, '')
            }
            catch {
                cartItemPrice = cartItems[i].price && cartItems[i].price
                    .replace(/,/g, '').replace(/^\D+/g, '')
            }
            if(fixPrice) cartItemPrice = fixPrice
            //console.log(cartItemPrice)
            var newCount = parseInt(cartItems[i].count.toString().replace(/,/g, '').replace(/^\D+/g, ''))
            if (cartItems[i].price)
                cartSum += parseInt(cartItemPrice) * newCount

            if (cartItems[i].count)
                cartCount += newCount
            cartDescription += cartItems[i].description ? cartItems[i].description : ''

            if (cartItems[i].discount) {
                var off = parseInt(cartItems[i].discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))

                if (off > 100)
                    cartDiscount += off
                else
                    cartDiscount += parseInt(cartItemPrice) *
                        newCount * (off) / 100
                //console.log(off+": "+cartDiscount)
            }
        } catch { }

    }
    if (discount) {
        if (parseInt(discount) > 100)
            cartDiscount += parseInt(discount)
        else
            cartDiscount += discount &&
                (parseInt(cartSum) *
                    parseInt(discount) / 100)
    }
    const totalPriceNoTax = cartSum - cartDiscount
    var totalPrice = (totalPriceNoTax * (1 + Number(TaxRate)))
    if(tPrice){
        totalPrice += tPrice
    }
    return ({
        totalFee: cartSum,
        totalCount: cartCount,
        transportPrice:tPrice,
        totalDiscount: cartDiscount,
        totalTax: (totalPriceNoTax * Number(TaxRate)),
        totalPrice: totalPrice,
        cartDescription: cartDescription
    })
}
const findCartSum = (cartItems, payValue,transportPrice,cartDiscount=0) => {
    if (!cartItems) return ({ totalPrice: 0, totalCount: 0 })
    var cartSum = 0;
    var cartCount = 0;
    var cartDiscount = Number(cartDiscount);
    var cartDescription = ''
    var tPrice = transportPrice?Number(transportPrice):0
    for (var i = 0; i < cartItems.length; i++) {
        //console.log(payValue)
        var cartItemPrice = findPayValuePrice(cartItems[i].price, payValue)
        if(cartItems[i].fixPrice) cartItemPrice = cartItems[i].fixPrice
        //console.log(cartItemPrice)
        try {
            if (cartItems[i].price){
                cartSum += parseInt(cartItemPrice) *
                    parseInt(cartItems[i].count.toString().replace(/,/g, '').replace(/^\D+/g, ''))
                    
            }
            if (cartItems[i].count)
                cartCount += parseInt(cartItems[i].count.toString().replace(/,/g, '').replace(/^\D+/g, ''))
            cartDescription += cartItems[i].description ? cartItems[i].description : ''
            if (cartItems[i].discount) {
                var off = parseInt(cartItems[i].discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))
                if (off > 100)
                    cartDiscount += off
                else
                    cartDiscount += parseInt(cartItemPrice)
                        * Number(cartItems[i].count) *
                        (1 + Number(TaxRate)) * (off) / 100
            }
        } catch { }
    }
    return ({
        totalFee: cartSum,
        totalCount: cartCount,
        transportPrice:tPrice,
        totalDiscount: cartDiscount,
        totalTax: (cartSum * Number(TaxRate)),
        totalPrice: (cartSum * (1 + Number(TaxRate)) - cartDiscount)+tPrice,
        cartDescription: cartDescription
    })
}
router.post('/cartlist', async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    const cartID = req.body.cartID
    try {
        const cartList = await cart.aggregate
            ([{ $match: { manageId: userId } },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },

            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "Code",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "adminData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "managerData"
                }
            }])
        var cartTotal = { cartPrice: 0, cartCount: 0 }
        for (var i = 0; i < cartList.length; i++) {
            if (cartList[i].cartItems && cartList[i].cartItems.length) {
                var cartResult = findCartSum(cartList[i].cartItems)
                cartList[i].countData = cartResult
            }
            else {
                cartList.splice(i, 1)
            }
            if (!cartList[i].userData || !cartList[i].userData.length) {
                //console.log(cartList[i].userData)
                var userData = await users.find({ _id: cartList[i].userId }).limit(1)
                cartList[i].userData = userData
            }
        }
        for (var i = 0; i < cartList.length; i++) {
            const found = (cartID && cartID.find(item => item === cartList[i]._id.toString()))
            if (found || !cartID.length) {
                cartTotal.cartPrice += cartList[i].countData ?
                    cartList[i].countData.totalPrice : 0;
                cartTotal.cartCount += cartList[i].countData ?
                    cartList[i].countData.totalCount : 0;
            }
        }
        res.json({
            cart: cartList,
            cartTotal: cartTotal
        })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/cart-fetch', async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    const cartID = req.body.cartID
    try {
        const cartList = await cart.aggregate
            ([{ $match: { manageId: userId } },
            { $match: { _id: new ObjectId(cartID) } },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "Code",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "adminData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "managerData"
                }
            }])
        var orderData = { cartPrice: 0, cartCount: 0 }
        var cartPrice = 0
        var cartItems = (cartList && cartList[0].cartItems) ?
            cartList[0].cartItems : []
        for (var i = 0; i < cartItems.length; i++) {
            cartPrice += parseInt(cartItems[i].price) *
                cartItems[i].count
        }
        orderData.cartPrice = cartPrice

        res.json({ cart: cartList, orderData: orderData })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/cart-delete', jsonParser, auth, async (req, res) => {
	try {
        const userId = req.headers['userid'];
        const cartID = req.body.cartID;
        const adminData = await users.findOne({ _id: userId }).lean();
		if (!adminData) {
			return res.status(500).json({ message: 'دسترسی ندارید', error: 'deny' });
		}
		await cart.updateOne({ cartNo: cartID },{$set:{taskStep:"cancel"}});
		await tasks.updateOne({ orderNo: cartID }, { $set: { taskStep: 'cancel' } });
		const cartDetails = await findCartFunction(userId, req.headers['userid']);
		return res.json(cartDetails);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const findTodayCartCount = (item, cart) => {
	let cartCount = 0;
	for (let i = 0; i < cart.length; i++) {
		let cartItem = cart[i].cartItems;
		for (let c = 0; c < cartItem.length; c++) {
			if (cartItem[c].sku === item) {
				cartCount = parseInt(cartCount) + parseInt(cartItem[c].count);
			}
		}
	}
	return cartCount;
};

router.post('/cart-find', jsonParser, async (req, res) => {
    const cartNo = req.body.cartNo
    try {
        var cartList = await cart.aggregate
            ([{ $match: { cartNo: cartNo } },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
            { $addFields: { "userId": { "$toObjectId": "$userId" } } },
            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "managerData"
                }
            }])
        var cartData = cartList && cartList[0]
        if (!cartData) {
            cartData = await FindFaktor(cartNo)
            cartList = [cartData]
            if(!cartData)
                return res.status(400).json({ error: "error", message: "آیتم ها با مشکل مواجه شدند" });
        }
		var canEdit = 0
        var taskData = await OrderToTask(cartData.cartNo)
        if (taskData && (
            taskData.taskStep == "initial" || taskData.taskStep == "edit"|| taskData.taskStep == "quote"))
            canEdit = 1
        if(!cartData.InvoiceID) canEdit = 1
        var cartItems = cartData&&cartData.cartItems
        if (cartItems)
            for (var i = 0; i < cartItems.length; i++) {
                try {
                    var cartTemp = cartItems[i]
                    // var productData = await products.findOne({ sku: cartTemp.sku }).lean()
					let [productData] = await products.aggregate([
						{ $match: { sku: cartTemp.sku } },
						{
							$lookup: {
								from: "productcounts",
								localField: "ItemID",
								foreignField: "ItemID",
								as: "countData",
							},
						},
					]);
                    const boxs=calculateBoxing(cartTemp.count,productData.perBox)
                    productData.boxs = boxs
                    if(cartList[0]){
                    cartList[0].cartItems[i].productData = productData
                    var count = cartList[0].cartItems[i].count
                    var perBox = productData&&productData.perBox
                    var boxCount = parseInt(count/perBox) 
                    var singleCount = count - boxCount*perBox
                    cartList[0].cartItems[i].boxCount=boxCount
                    cartList[0].cartItems[i].singleCount=singleCount
                    }
                }
                catch { }

                if(cartList[0])
                cartList[0].cartItems[i].total = findCartItemDetail(cartItems[i], cartData.payValue,cartData.discount)




            }
        var orderData = findCartSum(cartItems, cartData.payValue,
            cartData.transportPrice,cartData.discount)

		if (canEdit&&0) {
			// add productscount
			const userData = await userModel.findOne({ _id: cartData.manageId }).lean();
			const stockId = userData.StockId ? userData.StockId : '13';
			const fromData = jMoment().startOf('day').toISOString();
			const todayCartList = await cart.aggregate([
				{ $match: { initDate: { $gte: new Date(fromData) } } },
				{ $match: stockId ? { stockId, InvoiceID: { $exists: false } } : {} },
				{
					$lookup: {
						from: 'tasks',
						let: {
							cart_no: '$cartNo',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ['$orderNo', '$$cart_no'] },
											{ $ne: ['$taskStep', 'archive'] },
											{ $ne: ['$taskStep', 'cancel'] },
											{ $ne: ['$taskStep', 'quote'] },
										],
									},
								},
							},
						],
						as: 'taskInfo',
					}
				}
			]);
			const qCartList = await quickCartModel.find(stockId ? { stockId } : {}).lean();
			for (let i = 0; i < cartItems.length; i++) {
				let count = cartItems[i].productData.countData.find((item) => item.Stock == stockId);
				let cartCount = findTodayCartCount(cartItems[i].sku, todayCartList.concat(qCartList), stockId);
				if (count) {
					count.quantity = parseInt(count.quantity) - cartCount;
				}
				cartItems[i].productCount = count;
			}
		}

        return res.json({ cart: cartList, orderData: orderData, canEdit, taskData })
    }
    catch (error) {
        return res.status(500).json({ message: error.message })
    }
})

router.post('/cartData', async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    const cartNo = req.body.cartNo
    try {
        const cartList = await cart.aggregate
            ([
                { $match: { cartNo: cartNo } },
                { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
                { $addFields: { "userId": { "$toObjectId": "$userId" } } },
                {
                    $lookup: {
                        from: "customers",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "adminData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "manageId",
                        foreignField: "_id",
                        as: "managerData"
                    }
                }])
        var orderData = { totalPrice: 0, totalCount: 0 }
        var cartPrice = 0
        var cartItem = 0
        var cartDiscount = 0
        var cartItems = (cartList && cartList[0].cartItems) ?
            cartList[0].cartItems : []
        for (var i = 0; i < cartItems.length; i++) {
            cartPrice += parseInt(cartItems[i].price.replace(/,/g, '')) *
                cartItems[i].count
            cartItem += Number(cartItems[i].count)
            if (cartItems[i].discount) {
                var off = parseInt(cartItems[i].discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))
                if (off > 100)
                    cartDiscount += off
                else
                    cartDiscount += parseInt(cartItems[i].price)
                        * Number(cartItems[i].count) * (1 + Number(TaxRate)) * off / 100
            }
        }
        orderData.totalFee = cartPrice
        orderData.totalCount = cartItem
        orderData.totalDiscount = cartDiscount
        orderData.totalTax = cartPrice * Number(TaxRate)
        orderData.totalPrice = cartPrice * (1 + Number(TaxRate)) - cartDiscount
        res.json({
            cart: cartList && cartList[0],
            cartDetail: orderData
        })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/cartRemove', async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    const cartID = req.body.cartID
    try {
        const cartList = await cart.deleteOne({ _id: cartID })

        res.json({ cart: cartList, message: "Cart Removed" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

const checkForSalePolicyDependentProducts = async (itemId, sku, manageId, cart) => {
    try {
        const targetManagerId = await userModel.findOne({ _id: manageId }).lean();
        if (!targetManagerId.hasCommission) {
            return {
                needDependency: false,
            }
        }
        const targetProduct = await products.findOne({ sku }).populate({ path: 'salePolicyGroupId' }).lean();
        const doesProductNeedDepenedentProductsInSalePolicy = targetProduct.salePolicyGroupId.category === 'neutral';
        if (!doesProductNeedDepenedentProductsInSalePolicy) {
            return {
                needDependency: false,
            }
        }
        let numberOfSelectedDependentProducts = 0;
        let selectedDependentProducts = [];
        for (let i = 0; i < cart?.quickCart?.cartItems?.length; i++) {
            const thisCartItem = cart?.quickCart?.cartItems[i];
            const isThisCartItemDependentToTargetProduct = await salePolicyDependentProductModel.findOne({
                dependentProductSku: thisCartItem?.sku,
                productSku: targetProduct.sku,
            }).lean();
            if (isThisCartItemDependentToTargetProduct) {
                numberOfSelectedDependentProducts += thisCartItem?.count;
                const thisProduct = await productModel.findOne({ sku: thisCartItem?.sku }).lean();
                selectedDependentProducts.push(thisProduct);
            }
        }
        const needDependency = numberOfSelectedDependentProducts < targetProduct.dependentProductsCount;
        if (!needDependency) {
            return {
                needDependency: false,
            }
        }
        const dependencyMessage = `باید حداقل تعداد ${targetProduct.dependentProductsCount} عدد از محصولات وابسته به این محصول انتخاب شود.
تعداد محصول انتخاب شده: ${numberOfSelectedDependentProducts}`;
        return {
            itemId,
            sku,
            needDependency,
            selectedDependentProducts,
            dependencyMessage,
        };
    } catch (error) {
        return {
            needDependency: true,
            dependencyMessage: error.message,
            sku: 'Error',
        }
    }
};

const checkForSalePolicyDependentProductsByAction = async (manageId, cart) => {
    return {
        needDependency: false,
        dependencyCheckResult:[],
    };
    try {
        const dependencyCheckResult = [];
        for (let i = 0; i < cart?.quickCart?.cartItems?.length; i++) {
            const thisSku = cart?.quickCart?.cartItems[i]?.sku;
            const itemId = cart?.quickCart?.cartItems[i]?.id;
            const { needDependency, sku, dependencyMessage, selectedDependentProducts } = await checkForSalePolicyDependentProducts(itemId, thisSku, manageId, cart);
            if (needDependency) {
                dependencyCheckResult.push({
                    itemId,
                    sku,
                    dependencyMessage,
                    selectedDependentProducts,
                })
            }
        }
        return {
            needDependency: dependencyCheckResult.length > 0,
            dependencyCheckResult,
        };
    } catch (error) {
        return {
            needDependency: false,
            dependencyCheckResult: [],
        };
    }
};

router.post('/update-cart', jsonParser, async (req, res) => {
    try {
        const userId = req.body.userId ;
        const manageId = req.headers['userid']
        if(!userId||userId == manageId){
            return res.status(400).json({message:"مشتری انتخاب نشده است"})
        }

        const data = {
            userId,
            manageId: req.headers['userid'],
            date: req.body.date,
            payValue: req.body.payValue,
            progressDate: Date.now(),
        };
        const targetProduct = await productSchema.findOne({ sku: req.body.cartItem.sku }).lean();
		const userData = await users.findOne({ _id: req.headers['userid'] }).lean();
		const stockId = userData.StockId ? userData.StockId : '13';
		let status = '';
		//const cartData = await cart.find({userId:userId})
		const qCartData = await quickCart.findOne({ userId }).lean();
		const availItems = await checkAvailable(req.body.cartItem, stockId);
		if (!availItems) {
			return res.status(400).json({ error: 'موجودی کافی نیست' });
		}
        if (!req.body.cartItem.price) {
            const fetchPrice = await productPriceModel.find({ ItemID: targetProduct.ItemID }).lean();
            req.body.cartItem.price = fetchPrice;
        }
		const cartItems = createCart(qCartData ? qCartData.cartItems : [], req.body.cartItem);
		data.cartItems = cartItems;
		if (!qCartData) {
			cartLog.create({ ...data, ItemID: req.body.cartItem, action: 'create' });
			await quickCart.create({ ...data, stockId }); //Quote
			status = 'new Cart';
		} else {
			cartLog.create({ ...data, ItemID: req.body.cartItem, action: 'update' });
			await quickCart.updateOne({ userId }, { $set: data });
			status = 'update cart';
		}
		const cartDetails = await findCartFunction(userId, req.headers['userid']); // TODO

        // check for product category. if category === 'neutral' needDependentProduct should be true;
        // const { needDependency, sku, dependencyMessage, selectedDependentProducts } = await checkForSalePolicyDependentProducts(req.body.cartItem.sku, manageId, cartDetails);
        // if (needDependency) {
        //     response.needDependency = true;
        //     response.needDependencyRule = {
        //         sku,
        //         dependencyMessage,
        //         selectedDependentProducts,
        //     };
        // }
        const response = {
            ...cartDetails,
            message: 'آیتم اضافه شد',
        };
        const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
        response.needDependency = needDependency;
        response.dependencyCheckResult = dependencyCheckResult;
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/update-quote', jsonParser, async (req, res) => {
    try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const data = {
			userId: userId,
			manageId: req.headers['userid'],
			date: req.body.date,
			payValue: req.body.payValue,
			progressDate: Date.now(),
		};
		const userData = await users.findOne({ _id: req.headers['userid'] }).lean();
		const stockId = userData.StockId ? userData.StockId : '13';
		let status = '';
		//const cartData = await cart.find({userId:userId})
		const quoteData = await quote.findOne({ userId }).lean();

		const cartItems = createCart(quoteData ? quoteData.cartItems : [], req.body.cartItem);
		data.cartItems = cartItems;
		if (!quoteData) {
			cartLog.create({ ...data, ItemID: req.body.cartItem, action: 'create' });
			await quote.create({ ...data, stockId });
			status = 'new Cart';
		} else {
			cartLog.create({ ...data, ItemID: req.body.cartItem, action: 'update' });
			await quote.updateOne({ userId }, { $set: data });
			status = 'update quote';
		}
		const cartDetails = await findCartFunction(userId, req.headers['userid'])
		return res.json({ ...cartDetails, message: 'آیتم اضافه شد.' })
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
})

router.post('/update-desc', jsonParser, async (req, res) => {
    try {
        const userId = req.body.userId ? req.body.userId : req.headers['userid']
        const cartNo = req.body.cartNo
        var dataQuick={}
        const data = {
            description: req.body.description,
            pDiscount: req.body.discount,
            payValue: req.body.payValue,
            bank:req.body.bank ,
            bankArray:req.body.bankArray ,
            transport:req.body.transport,
            transportPrice:req.body.transportPrice,
        }
        if (cartNo) {
            await cart.updateOne({ cartNo }, { ...data });
        } else {
            /*dataQuick = await FindQuick(userId);
            var cartDiscount = req.body.discount
            if(cartDiscount){
                var qCartData = dataQuick&&dataQuick.qCartData
                var qCartDetail = dataQuick&&dataQuick.qCartDetail
                var totalPrice = qCartDetail&&qCartDetail.totalPrice
                await CartDiscountToItems(userId,qCartData&&qCartData.cartItems,
                    cartDiscount,totalPrice,qCartData&&qCartData.pDiscount
                )
            }*/
            await quickCart.updateOne({ userId }, {$set:{ ...data }});

            //return res.json({...dataQuick,disPercent})
        }

        const cartDetails = cartNo
            ? await findCartData(cartNo)
            : await findCartFunction(userId, req.headers['userid']);

        // return res.json({ ...cartDetails,canEdit:1, message: 'سبد بروز شد.' })
        const response = {
            ...cartDetails,dataQuick,
            message: 'سبد بروز شد.',
            canEdit: 1,
        };
        if (!cartNo) {
            const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
            response.needDependency = needDependency;
            response.dependencyCheckResult = dependencyCheckResult;
        }
		return res.json(response);
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
})

router.post('/edit-cart', jsonParser, async (req, res) => {
	try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const data = {
			payValue: req.body.payValue,
			date: req.body.date,
			progressDate: Date.now(),
		};

		let status = '';
		//const cartData = await cart.find({userId:data.userId})
		const qCartData = await quickCart.findOne({ userId }).lean();
		const availItems = await checkAvailable(req.body.cartItem);
		if (!availItems) {
			return res.status(400).json({ error: 'موجودی کافی نیست.' });
		}
		const cartItems = editCart(qCartData, req.body.cartItem);
		data.cartItems = cartItems;
		await quickCart.updateOne({ userId: userId }, { $set: data });
		status = 'update cart';
		const cartDetails = await findCartFunction(userId, req.headers['userid']);
		return res.json({ ...cartDetails, message: 'آیتم ها بروز شدند.' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/edit-quote', jsonParser, async (req, res) => {
	try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const data = {
			payValue: req.body.payValue,
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		//const cartData = await cart.find({userId:data.userId})
		const quoteData = await quote.findOne({ userId: userId });
		const quote = editCart(quoteData, req.body.cartItem);
		data.cartItems = quote;
		await quote.updateOne({ userId: userId }, { $set: data });
		status = 'update quote';
		const quoteDetails = await findQuoteFunction(userId, req.headers['userid']);
		return res.json({ ...quoteDetails, message: 'آیتم ها بروز شدند' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const checkAvailable = async (item, stockId = '13', cartNo) => {
	const existItem = await productcounts.findOne({ ItemID: item.id, Stock: stockId }).lean();
	// const existItem3 = await productcounts.findOne({ ItemID: item.id, Stock: '9' }).lean();

	// if (!existItem && !existItem3) {
	if (!existItem) {
        return '';
    }

	let totalCount = existItem ? parseFloat(existItem.quantity) : 0;
	// totalCount += existItem3 ? parseFloat(existItem3.quantity) : 0;

	const currentOrder = await FindCurrentExist(item.id, cartNo, stockId);
	let minusCount = currentOrder + item.count;
	return compareCount(totalCount, minusCount);
};

const createCart = (cartData, cartItem) => {
	let cartItemTemp = cartData ? cartData : [];
	let repeat = 0;
	for (let i = 0; i < (cartItemTemp && cartItemTemp.length); i++) {
		if (cartItemTemp[i].id === cartItem.id) {
			cartItemTemp[i].count = parseInt(cartItemTemp[i].count) + parseInt(cartItem.count);
			repeat = 1;
			break;
		}
	}
	!repeat && cartItemTemp.push({ ...cartItem, date: Date.now() });
	return cartItemTemp;
};

const removeCart = (cartData, cartID) => {
    if (!cartData || !cartData.cartItems) return ([])
    var cartItemTemp = cartData.cartItems
    for (var i = 0; i < cartItemTemp.length; i++) {
        if (cartItemTemp[i].id === cartID) {
            cartItemTemp.splice(i, 1)
            return (cartItemTemp)
        }
    }
}
const removeCartCount = (cartData, cartID, count) => {
    if (!cartData || !cartData.cartItems) return ([])
    var cartItemTemp = cartData.cartItems
    for (var i = 0; i < cartItemTemp.length; i++) {
        if (cartItemTemp[i].id === cartID) {
            cartItemTemp[i].count = parseInt(cartItemTemp[i].count) - parseInt(count)
            return (cartItemTemp)
        }
    }
}
const editCart = (cartData, cartItem) => {
    if (!cartData || !cartData.cartItems) return ([])
    var cartItemTemp = cartData.cartItems
    for (var i = 0; i < (cartItemTemp && cartItemTemp.length); i++) {
        if (cartItemTemp[i].id === cartItem.id) {
            cartItemTemp[i].count = cartItem.count;
            if (cartItem.price)
                cartItemTemp[i].price = cartItem.price
            return (cartItemTemp)
        }
    }
}
const totalCart = (cartArray) => {
    var cartListTotal = []
    for (var i = 0; i < cartArray.length; i++) {
        const userCode = cartArray[i].userData[0] ?
            cartArray[i].userData[0].CustomerID :
            cartArray[i].adminData[0].CustomerID
        const userAddress = cartArray[i].userData[0] ?
            cartArray[i].userData[0].AddressID :
            cartArray[i].adminData[0].AddressID
        var repeat = 0
        for (var j = 0; j < cartListTotal.length; j++)
            if (userCode && (userCode === cartListTotal[j].userId)) {
                cartListTotal[j].cartItems.push(
                    ...cartArray[i].cartItems)
                cartListTotal[j].userTotal += "|" + cartArray[i].userId
                repeat = 1
                break
            }
        !repeat && cartListTotal.push({
            userId: userCode,
            userTemp: cartArray[i].userId,
            userAddress: userAddress,
            userTotal: cartArray[i].userId,
            payValue: cartArray[i].payValue,
            stockId: cartArray[i].stockId ? cartArray[i].stockId : "13",
            cartItems: cartArray[i].cartItems
        })
    }
    return (cartListTotal)
}
router.post('/update-Item',auth, jsonParser, async (req, res) => {
	const data = {
		userId: req.body.userId ? req.body.userId : req.headers['userid'],
		cartID: req.body.cartID,
		changes: req.body.changes,
		progressDate: Date.now(),
	};
    const manageId = req.user.user_id
    const manageDetail = await users.findOne({_id:new ObjectId(manageId)})
	try {
		var status = '';
		//const cartData = await cart.find({userId:data.userId})
		const qCartData = await quickCart.findOne({ userId: data.userId });
		var oldCartItems = qCartData.cartItems;
		for (var i = 0; i < (oldCartItems && oldCartItems.length); i++) {
			if (!data.changes) break;
			if (oldCartItems[i].id == data.cartID) {
				if (data.changes.description) oldCartItems[i].description = data.changes.description;
				if (data.changes.count) oldCartItems[i].count = data.changes.count;
				if (data.changes.discount) oldCartItems[i].discount = data.changes.discount;
                if (data.changes.price){
                    oldCartItems[i].fixPrice = data.changes.price;
                    oldCartItems[i].price.forEach(item => {
                        item.price = data.changes.price;
                        });
                } 

				const availItems = await checkAvailable(oldCartItems[i], manageDetail&&manageDetail.StockId);

				if (!availItems) {
					res.status(400).json({ error: 'موجودی کافی نیست' });
					return;
				}
			}
		}

		//const cartItems = removeCart(qCartData,req.body.cartID)
		//data.cartItems =(cartItems)
		cartLog.create({ ...data, ItemID: req.body.cartID, action: 'delete' });
		await quickCart.updateOne({ userId: data.userId }, { $set: { cartItems: oldCartItems } });
		status = 'update cart';
		const cartDetails = await findCartFunction(data.userId, req.headers['userid']);
        const response = {
            ...cartDetails,
            message: 'آیتم بروز شد.'
        };
        const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
        response.needDependency = needDependency;
        response.dependencyCheckResult = dependencyCheckResult;
		return res.send(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/update-Item-cart', jsonParser, async (req, res) => {
    try {
        const adminId = req.headers['userid'];
        const { newUserId, cartID: ItemID, cartNo, changes } = req.body;
        const data = {
            cartID: ItemID,
            changes,
            cartNo,
            progressDate: Date.now(),
        };
		let status = '';
		//const cartData = await cart.find({userId})
		const CartData = await cart.findOne({ cartNo }).lean();
        if(!CartData){
            return res.status(400).json({error:"سفارش پیدا نشد"})
        }
        if(newUserId != CartData.userId){
            await cart.updateOne({ cartNo }, { $set: { userId: newUserId } });
        }
		let oldCartItems;
        if(changes && changes.count){
            var rCount = Number(changes.count)
            if(rCount<0){
                return res.status(400).json({error:"برگشتی نمی تواند منفی باشد"})
            }
        }
		if (changes && changes.count == '0') {
			oldCartItems = removeCart(CartData, ItemID);
		} else {
			oldCartItems = CartData.cartItems;
			let manId = await users.findOne({ _id: CartData.manageId }).lean();
			for (let i = 0; i < oldCartItems.length; i++) {
				if (!changes) break;
				if (oldCartItems[i].id == ItemID) {
					if (changes.description) oldCartItems[i].description = changes.description;
					if (changes.count) oldCartItems[i].count = changes.count;
					if (changes.discount) oldCartItems[i].discount = changes.discount;
					if (changes.stock) {
						newStock = changes.stock;
						oldCartItems[i].stock = changes.stock;
					}
                    if (changes.price) {
                        const managerProfile = await profileModel.findOne({ profileCode: 'manager' }).lean();
                        const isManager = await userModel.findOne({ _id: adminId, profile: `${managerProfile._id}` }).lean();
                        if (!isManager) {
                            //return res.status(403).send({ error: 'شما مجاز به تغییر قیمت نیستید.' });
                        }
                        // oldCartItems[i].price = changes.newPrice;
                        for (let j = 0; j < oldCartItems[i].price.length; j++) {
                            if (oldCartItems[i].price[j].saleType === CartData.payValue) {
                                oldCartItems[i].originalPrice = JSON.parse(JSON.stringify(oldCartItems[i].price));
                                oldCartItems[i].price[j].price = `${changes.price}`;
                                oldCartItems[i].hasNewPrice = true;
                                oldCartItems[i].priceUpdatedAt = new Date();
                            }
                        }
                    }
					const availItems = await checkAvailable(oldCartItems[i], manId.StockId, cartNo);
					if (!availItems) {
						return res.status(400).json({ error: 'موجودی کافی نیست' });
					}
				}
			}
		}
		cartLog.create({ ...data, ItemID, action: 'update' });
		await cart.updateOne({ cartNo }, { $set: { cartItems: oldCartItems } });
		status = 'update cart';
		const cartDetails = await findCartData(cartNo);
		let canEdit = 0;
		// let taskData = await OrderToTask(data.cartNo);
        const taskData = await tasks.findOne({ orderNo: cartNo }).lean();
        const canEditSteps = ['initial', 'edit', 'quote'];
		if (taskData && (canEditSteps.includes(taskData.taskStep))) {
            canEdit = 1;
        }
        if(!CartData.InvoiceID) canEdit = 1
		return res.json({ ...cartDetails, message: 'آیتم بروز شد.', canEdit });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});
router.post('/change-cart-user', auth,jsonParser, async (req, res) => {
    try {
        const adminId = req.headers['userid'];
        const { userId, cartNo } = req.body;
		const CartData = await cart.findOne({ cartNo }).lean();
        if(!CartData){
            return res.status(400).json({error:"سفارش پیدا نشد"})
        }
        if(CartData.InvoiceID){
            return res.status(400).json({error:"سفارش در سپیدار ثبت شده است"})
        }
        if(userId != CartData.userId){
            await cart.updateOne({ cartNo }, { $set: { userId: userId } });
        }
		
		return res.json({  message: 'مشتری سفارش بروز شد.' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});
router.post('/remove-cart', jsonParser, async (req, res) => {
    try {
		const data = {
			userId: req.body.userId ? req.body.userId : req.headers['userid'],
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		const qCartData = await quickCart.findOne({ userId: data.userId }).lean();
		const cartItems = removeCart(qCartData, req.body.cartID);
		data.cartItems = cartItems;
		cartLog.create({ ...data, ItemID: req.body.cartID, action: 'delete' });
		await quickCart.updateOne({ userId: data.userId }, { $set: data });
		status = 'update cart';
		const cartDetails = await findCartFunction(data.userId, req.headers['userid']);
        const response = {
            ...cartDetails,
            message: 'آیتم حذف شد.',
        };
        const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
        response.needDependency = needDependency;
        response.dependencyCheckResult = dependencyCheckResult;
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/remove-quote', jsonParser, async (req, res) => {
    try {
		const data = {
			userId: req.body.userId ? req.body.userId : req.headers['userid'],
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		const quoteData = await quote.findOne({ userId: data.userId }).lean();
		const cartItems = removeCart(quoteData, req.body.cartID);
		data.cartItems = cartItems;
		cartLog.create({ ...data, ItemID: req.body.cartID, action: 'delete' });
		await quote.updateOne({ userId: data.userId }, { $set: data });
		status = 'update cart';
		const cartDetails = await findCartFunction(data.userId, req.headers['userid']);
		return res.json({ ...cartDetails, message: 'آیتم حذف شد.' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/return-cart', jsonParser, async (req, res) => {
    try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const data = {
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		const cartData = await cart.findOne({ _id: req.body.cartID }).lean();
		const cartItems = removeCartCount(cartData, req.body.itemId, req.body.count);
		data.cartItems = cartItems;
		cartLog.create({ ...data, ItemID: req.body.cartID, action: 'return' });
		await cart.updateOne({ _id: req.body.cartID }, { $set: data });
		status = 'Return ';
		const cartDetails = await findCartFunction(userId, req.headers['userid']);
		return res.json(cartDetails);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/return-quote', jsonParser, async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid']
    const data = {
        date: req.body.date,
        progressDate: Date.now()
    }
    try {
        var status = "";
        const cartData = await cart.findOne({ _id: req.body.cartID })
        const cartItems = removeCartCount(cartData, req.body.itemId, req.body.count)
        data.cartItems = (cartItems)

        cartLog.create({ ...data, ItemID: req.body.cartID, action: "return" })
        await cart.updateOne(
            { _id: req.body.cartID }, { $set: data })
        status = "Return "
        const cartDetails = await findQuoteFunction(userId, req.headers['userid'])
        res.json(cartDetails)
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
const findNullCount = async (items, cart) => {
    //console.log(items)
    for (var i = 0; i < items.length; i++) {
        const itemCount = await productCount.findOne({ ItemID: items[i].id, Stock: '13' })
        var countData = findCartCount(items[i].sku, cart)
        var count = countData && countData.count
        count += parseInt(items[i].count)
        var cmpr = compareCount(itemCount.quantity, count)
        //console.log(itemCount.quantity,count,cmpr)

    }
}

const getCartItemsByPolicyGroup = async (qCartData) => {
	try {
        for (let i = 0; i < qCartData.cartItems.length; i++) {
            const targetProduct = await products.findOne({ sku: qCartData.cartItems[i].sku }).populate({ path: 'salePolicyGroupId' }).lean();
            qCartData.cartItems[i] = { ...qCartData.cartItems[i], salePolicyGroupId: targetProduct.salePolicyGroupId};
        }
        const productsList = qCartData.cartItems;
        const mainProducts = productsList.filter((i) => {
            if (i.salePolicyGroupId) {
                return i.salePolicyGroupId.category === 'mainProducts';
            }
        })
        const mainProductsCount = mainProducts.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.count;
        }, 0);
        const lowSellingProducts1 = productsList.filter((i) => {
            if (i.salePolicyGroupId) {
                return i.salePolicyGroupId.category === 'lowSellingProducts1';
            }
        });
        const lowSellingProducts1Count = lowSellingProducts1.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.count;
        }, 0);
        const lowSellingProducts2 = productsList.filter((i) => {
            if (i.salePolicyGroupId) {
                return i.salePolicyGroupId.category === 'lowSellingProducts2';
            }
        });
        const lowSellingProducts2Count = lowSellingProducts2.reduce((accumulator, currentItem) => {
            return accumulator + currentItem.count;
        }, 0);
        const sideProducts = productsList.filter((i) => {
            if (i.salePolicyGroupId) {
                return i.salePolicyGroupId.category === 'sideProducts';
            }
        });
        const withoutSideProducts = productsList.filter((i) => {
            if (i.salePolicyGroupId) {
                return i.salePolicyGroupId.category !== 'sideProducts';
            }
        });
        return {
            mainProductsCount,
            lowSellingProducts1Count,
            lowSellingProducts2Count,
            mainProducts,
            lowSellingProducts1,
            lowSellingProducts2,
            sideProducts,
            withoutSideProducts,
        };
    } catch (error) {
        return {
            mainProductsCount: 0,
            lowSellingProducts1Count: 0,
            lowSellingProducts2Count: 0,
            sideProducts: [],
            withoutSideProducts: [],
        };
    }
};

const checkForSalePolicyRules = async (qCartData, manageId) => {
	try {
        // return {
        //     isSalePolicyRulesPassed: true,
        // }
		let isSalePolicyRulesPassed = false;
        let lowSellingProduct1Rule = false;
        let lowSellingProduct2Rule = false;
        let salePolicyRuleMessage = 'شروط سیاست‌های فروش رعایت نشده است.';
        // check if sale policy rule is active for this user or not
        const targetManagerId = await userModel.findOne({ _id: manageId }).lean();
        if (!targetManagerId.hasCommission) {
            return {
                isSalePolicyRulesPassed: true,
            }
        }
        const requiredProducts = {};
        const payValue = qCartData.payValue;
        const {
            mainProductsCount = 0,
            lowSellingProducts1Count = 0,
            lowSellingProducts2Count = 0,
            sideProducts = [],
            withoutSideProducts = [],
        } = await getCartItemsByPolicyGroup(qCartData);

        if (!mainProductsCount && !lowSellingProducts1Count) {
        // if (!mainProductsCount) {
            isSalePolicyRulesPassed = true;
            return {
                isSalePolicyRulesPassed,
            };
        }

        const faktorPriceWithoutSideProducts = withoutSideProducts.reduce((accumulator, currentItem) => {
            const cartItemPrice = findCartItemDetail(currentItem, payValue);
            const itemPrice = Number(cartItemPrice.total);
            return accumulator + itemPrice;
        }, 0);

        const calculateSideProductsPrice = sideProducts.reduce((accumulator, currentItem) => {
            const cartItemPrice = findCartItemDetail(currentItem, payValue);
            const itemPrice = Number(cartItemPrice.total);
            return accumulator + itemPrice;
        }, 0);

        if (mainProductsCount) {
            const lowSellingProduct1Score = lowSellingProducts1Count * 0.5;
            const lowSellingProduct2Score = lowSellingProducts2Count * 1;
            const lowSellingProductsScores = lowSellingProduct1Score + lowSellingProduct2Score;
            if (lowSellingProductsScores >= mainProductsCount) {
                isSalePolicyRulesPassed = true;
            }
            if (isSalePolicyRulesPassed || (lowSellingProducts1Count >= (mainProductsCount * 2))) {
                // isSalePolicyRulesPassed = true;
                lowSellingProduct1Rule = true;
            }
            if (isSalePolicyRulesPassed || (lowSellingProducts2Count >= (mainProductsCount * 1))) {
                // isSalePolicyRulesPassed = true;
                lowSellingProduct2Rule = true;
            }
            if (!isSalePolicyRulesPassed || (!lowSellingProduct1Rule && !lowSellingProduct2Rule)) {
                isSalePolicyRulesPassed = false;
                salePolicyRuleMessage = 'شروط سیاست‌های فروش رعایت نشدند.'
                requiredProducts.lowSellingProducts = {
                    message: `می‌بایست حداقل ${mainProductsCount * 2} عدد از محصولات کم فروش 1 یا ${mainProductsCount * 1} عدد از محصولات کم فروش 2 انتخاب نمایید.`,
                    selectedMessage: `تعداد محصولات کم فروش 1 انتخاب شده: ${lowSellingProducts1Count}
تعداد محصولات کم فروش 2 انتخاب شده: ${lowSellingProducts2Count}`
                };
            }

            if (calculateSideProductsPrice < faktorPriceWithoutSideProducts) {
                const selectedPrice = Math.round(calculateSideProductsPrice / 1000) * 1000;
                const targetPrice = Math.round(faktorPriceWithoutSideProducts / 1000) * 1000;
                isSalePolicyRulesPassed = false;
                salePolicyRuleMessage = 'شروط سیاست‌های فروش رعایت نشدند.'
                requiredProducts.sideProducts = {
                    message: `مبلغ ${commaSeparatedPrices(selectedPrice)} از محصولات کناری انتخاب کرده‌اید.
می‌بایست حداقل ${commaSeparatedPrices(targetPrice)} انتخاب نمایید.`,
                    selectedMessage: `مبلغ باقی مانده: ${commaSeparatedPrices(targetPrice - selectedPrice)}`,
                };
            }
        }

        if (!mainProductsCount && lowSellingProducts1Count) {
            if (calculateSideProductsPrice < faktorPriceWithoutSideProducts) {
                const selectedPrice = Math.round(calculateSideProductsPrice / 1000) * 1000;
                const targetPrice = Math.round(faktorPriceWithoutSideProducts / 1000) * 1000;
                isSalePolicyRulesPassed = false;
                salePolicyRuleMessage = 'شروط سیاست‌های فروش رعایت نشدند.'
                requiredProducts.sideProducts = {
                    message: `مبلغ ${commaSeparatedPrices(selectedPrice)} از محصولات کناری انتخاب کرده‌اید.
می‌بایست حداقل ${commaSeparatedPrices(targetPrice)} انتخاب نمایید.`,
                    selectedMessage: `مبلغ باقی مانده: ${commaSeparatedPrices(targetPrice - selectedPrice)}`,
                };
            } else {
                isSalePolicyRulesPassed = true;
            }
        }

		return {
            isSalePolicyRulesPassed,
            salePolicyRuleMessage,
            requiredProducts,
        };
	} catch (error) {
		return {
            isSalePolicyRulesPassed: false,
        };
	}
};

router.post('/quick-to-cart', jsonParser, async (req, res) => {
	try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const { branchName, branchId, date,  transport ,bankArray,
                transportPrice,bank,bankDate,cartID, isQuote } = req.body;
        var now = new Date()
        var bDate = bankDate?bankDate:now.toLocaleDateString('en')
		const data = {
			userId: userId,
			manageId: req.headers['userid'],
			date,
            transport,transportPrice,
            bankArray,
            bank,
            bankDate:bDate,
			progressDate: Date.now(),
			branchName,
			branchId,
			isQuote,
		};
        let status = '';
		const isSale = await CheckSale(data.manageId); // 1 or 0
		data.isSale = true//isSale;
		//const cartAll = await cart.find()
		const userData = await customers.findOne({ _id: userId }).lean();
		const adminData = await users.findOne({ _id: data.manageId }).lean();
		var adminProfiles = adminData.profile ? adminData.profile.map((item) => new ObjectId(item)) : [];
		// console.log(adminProfiles);
		const profileData = adminData && (await profiles.find({ _id: { $in: adminProfiles } }));
		const qCartData = await quickCart.findOne({ userId: userId });
		// check sale policy rules
		if (!qCartData) {
			return res.status(400).json({ error: 'یافت نشد.' });
		}
		const { isSalePolicyRulesPassed, salePolicyRuleMessage, requiredProducts } = await checkForSalePolicyRules(qCartData, data.manageId);
		if (!isSalePolicyRulesPassed) {
            const cartDetails = await findCartFunction(userId, req.headers['userid']);
			const response = {
				message: salePolicyRuleMessage,
                policy: false,
                ...cartDetails,
			};
			return res.json(response);
		}
		const defaultPay = customers.CustomerID ? '3' : '4';
		data.payValue = qCartData && qCartData.payValue ? qCartData.payValue : defaultPay;
		data.description = qCartData && qCartData.description;
		data.pDiscount = qCartData && qCartData.pDiscount;
		const quickCartItems = qCartData && qCartData.cartItems;
		data.cartItems = quickCartItems;
        data.bank = data.bank?data.bank:(qCartData && qCartData.bank);
        data.bankArray = qCartData && qCartData.bankArray
        data.transport = data.transport?data.transport:(qCartData && qCartData.transport);
        data.transportPrice = data.transportPrice?data.transportPrice:(qCartData && qCartData.transportPrice);
		const stockId = adminData.StockId ? adminData.StockId : '5';

		const availItems = !data.isQuote ? await checkCart(quickCartItems, stockId, data.payValue) : 0;
		if (availItems) {
			return res.status(400).json({ error: availItems });
		} 
        
		data.cartNo = await NewCode(isSale ? 's' : 'd');
		data.profileId = adminData && adminData.profile;
		data.profileName = profileData && profileData.map((item) => item.profileName);
		data.stockId = qCartData && qCartData.stockId;
		cartLog.create({ ...data, ItemID: cartID, action: 'quick to cart' });
		const smsResult = 0&&await SendSMS(userData.phone,"sabt",
            userData.username&&userData.username.replace(/ /g,'_'),data.cartNo);
		//return res.json(data)
            await cart.create(data);
		status = 'create cart';
		await quickCart.deleteOne({ userId: data.userId });
		if (!isSale) {
            await CreateTask('border', data, userData);
        }
		const cartDetails = await findCartFunction(userId, req.headers['userid']);
		// setTimeout(() => res.json(cartDetails), 3000);
        // return res.json(cartDetails);
        const response = {
            ...cartDetails,
        };
        const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
        response.needDependency = needDependency;
        response.dependencyCheckResult = dependencyCheckResult;
        response.smsResult = smsResult?smsResult:"smsResult"
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
})
router.post('/sendSMSTest',jsonParser,async(req,res)=>{
    try {
        const smsResult = await SendSMS("09214234099","sabt","hosseini","ST12345");
        res.json(smsResult)
    } catch (error) {
    return res.status(500).json({ message: error.message });
}
})
router.post('/quick-to-quote', jsonParser, async (req, res) => {
	try {
		const userId = req.body.userId ? req.body.userId : req.headers['userid'];
		const data = {
			userId: userId,
			manageId: req.headers['userid'],
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		//const cartAll = await cart.find()
		const userData = await customers.findOne({ _id: userId }).lean();
		const quoteData = await quote.findOne({ userId: userId }).lean();

		data.payValue = quoteData && quoteData.payValue;
		data.description = quoteData && quoteData.description;
		data.discount = quoteData && quoteData.discount;
		const quoteItems = quoteData && quoteData.cartItems;
		data.cartItems = quoteItems;
		const stockId = userData.StockId ? userData.StockId : '5';

		//data.cartItems =pureCartPrice(quickCartItems,qCartData.payValue)
		data.cartNo = await NewQuote('q');
        data.status = "undone"
		data.stockId = quoteData && quoteData.stockId;
		cartLog.create({ ...data, ItemID: req.body.cartID, action: 'quick to quote' });
		await quote.create(data);
		status = 'create quote';
		await quickCart.deleteOne({ userId });
		if (!isSale) {
            await CreateTask('bquote', data, userData);
        }
		const cartDetails = await findCartFunction(userId, req.headers['userid']);
		// setTimeout(() => res.json(cartDetails), 3000);
        return res.json(cartDetails);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

const pureCartPrice = (cartItem, payValue) => {
    var cartItems = cartItem
    for (var c = 0; c < cartItems.length; c++) {
        try {
            cartItems[c].price = cartItem[c].price.find(item => item.saleType === payValue).price
        }
        catch {
        }
    }
    return cartItems
}
router.post('/quote-to-initial', auth, jsonParser, async (req, res) => {
    var orderNo = req.body.orderNo
    if(!orderNo)
        orderNo = req.body.OrderNo


    const cartData = await cart.findOne({ cartNo: orderNo })
    if (!cartData) {
        res.status(400).json({ error: "سفارشی یافت نشد" })
        return
    }
    if (!cartData.isQuote) {
        res.status(400).json({ error: "این کارت پیش فاکتور نیست" })
        return
    }

    const cartItems = cartData && cartData.cartItems
    const stockId = cartData.stockId

    // const availItems = await checkCart(cartItems, stockId)
    let availItems = []
    let error = ''
    for (let i = 0; i < cartItems.length; i++) {
        const result = await checkAvailable(cartItems[i], stockId)

        if (!result) {
            availItems.push({ error: "موجودی کالا کافی نمیباشد", sku: cartItems[i].sku })
            error = `موجودی کالا کافی نمیباشد -  شناسه ${cartItems[i].sku}`
        }
    }
    if (availItems.length != 0) {
        res.status(500).json({ error: error, errorArr :availItems });
        return
    }

    try {
        

        const result2 = await cart.updateOne(
            { cartNo: orderNo },
            {
                $set: { isQuote: false ,initDate:Date.now()}
            },
        );

        res.status(200).json({ message: "وضعیت با موفقیت به‌روزرسانی شد" ,
            result,result2
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "در هنگام به‌روزرسانی خطایی رخ داد" });
    }
});

router.post('/cancel-faktor', auth, jsonParser, async (req, res) => {
    const id = req.body._id;
    const userId = req.body.userId ? req.body.userId : req.headers['userid']


    try {
        const result = await db.collection('tasks').updateOne(
            { _id: id },
            { $set: { taskStep: 'cancel' } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "داده ای یافت نشد" });
        }
        res.status(200).json({ message: "وضعیت با موفقیت به‌روزرسانی شد" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "در هنگام به‌روزرسانی خطایی رخ داد" });
    }
});

const checkCart = async (cartItems, stockId, payValue) => {
	if (!cartItems.length) return;
	let checkCart = '';
	for (let i = 0; i < cartItems.length; i++) {
		const sku = cartItems[i].sku;
        const cartList = await tasks.find({ taskStep: { $nin: ['archive', 'cancel', 'quote', 'suuport'] } }).lean();
        // let currentCart = await FindCurrentCart(cartList.map(item => item.orderNo));
        const orderNumbers = cartList.map((item) => item.orderNo);
        const currentCart = await cartModel.find({ stockId, 'cartItems.sku': sku, cartNo: { $in: orderNumbers } }).lean();
        const qCartList = await qCart.find(stockId ? { stockId } : {}).lean();

		const count = await findItemBySku(sku, currentCart.concat(qCartList), stockId, cartItems[i]);
		// const count3 = await findItemBySku(sku, currentCart.concat(qCartList), '9', cartItems[i]);
		//console.log(count)
		// if (count < 0 && count3 < 0) {
		if (count < 0) {
			checkCart += `sku: ${sku}, value: ${count} || `;
		}
	}
	return checkCart;
};

const findItemBySku = async (sku, cartItems, stockId, item) => {
	let existCount = 0;
	// const ItemID = item.price ? item.price[0].ItemID : '0'; // ? What is this line?!
	// const searchProducts = await productCount.find({ ItemID: item.id }).lean();
	// let countSep = searchProducts.find((item) => item.Stock == stockId);
	const countSep = await productCount.findOne({ ItemID: item.id, Stock: stockId }).lean();
	const stockCount = countSep ? countSep.quantity : 0;
	let countData = findCartCount(sku, cartItems, stockId);
	let countCart = countData && countData.count;
	return stockCount - countCart;
};

router.post('/faktor', async (req, res) => {
    const offset = req.body.offset ? parseInt(req.body.offset) : 0
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    try {
        const userDetail = await users.findOne({ _id: req.headers['userid'] })
        if (!userDetail) {
            res.status(500).json({ error: "access deny" })
            return
        }
        const access = userDetail.access
        const faktorTotalCount = await FaktorSchema.find(
            access === "manager" ? {} : { manageId: userId }).count()
        const faktorList = await FaktorSchema.aggregate
            ([{ $match: access === "manager" ? {} : { manageId: userId } },
            {
                $lookup: {
                    from: "customers",
                    localField: "customerID",
                    foreignField: "CustomerID",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "productcounts",
                    localField: "ItemID",
                    foreignField: "ItemID",
                    as: "countData"
                }
            }, { $sort: { "initDate": -1 } },
            { $skip: offset }, { $limit: 10 }])
        //logger.warn("main done")
        res.json({ faktor: faktorList, faktorCount: faktorTotalCount })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/faktor-find', async (req, res) => {
    const faktorId = req.body.faktorId;
    try {
        const faktorData = await FaktorSchema.findOne({ InvoiceID: faktorId })

        //logger.warn("main done")
        var userId = faktorData && faktorData.manageId

        const OnlineFaktor = await sepidarFetch(data, "/api/invoices/" + faktorId, userId)
        const userDetail = await customerSchema.findOne({ CustomerID: OnlineFaktor.CustomerRef })
        const invoice = OnlineFaktor.InvoiceItems
        if (!invoice)
            res.status(400).json({ error: OnlineFaktor.Message })
        //var itemRefs=OnlineFaktor.InvoiceItems
        for (var i = 0; i < invoice.length; i++) {
            var faktorItem = invoice[i]
            var itemDetail = await products.findOne({ ItemID: faktorItem.ItemRef })
            OnlineFaktor.InvoiceItems[i].itemDetail = itemDetail
            //itemRefs.push(faktorItem)
        }
        res.json({ faktor: OnlineFaktor, userDetail: userDetail, itemRefs: invoice })
    }
    catch (error) {
        res.status(500).json({ error: error.message })
    }
})

router.post('/faktor-fetch', async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid'];
    const faktorID = req.body.faktorID
    try {
        const faktorList = await FaktorSchema.aggregate
            ([
                { $match: { _id: new ObjectId(faktorID) } },
                { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
                {
                    $lookup: {
                        from: "customers",
                        localField: "customerID",
                        foreignField: "CustomerID",
                        as: "userData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "adminData"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "manageId",
                        foreignField: "_id",
                        as: "managerData"
                    }
                }])
        var faktorData = faktorList && faktorList[0]
        var faktorDetail = ''
        if (faktorData) {
            faktorDetail = (faktorData.userId + " " + faktorData.manageId)
            if (faktorData.userId != faktorData.manageId) {
                var userShow = await users.findOne({ _id: faktorData.userId })
                faktorList[0].userData[0] = userShow
            }
        }
        var orderData = { cartPrice: 0, cartCount: 0 }
        var cartPrice = 0
        var cartItems = (faktorList && faktorList[0].faktorItems) ?
            faktorList[0].faktorItems : []
        for (var i = 0; i < cartItems.length; i++) {
            cartPrice += parseInt(cartItems[i].price) *
                cartItems[i].count
        }
        orderData.cartPrice = cartPrice

        res.json({ faktor: faktorList, orderData: orderData, faktorDetail: faktorDetail })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/update-faktor', jsonParser, async (req, res) => {
    const userId = req.body.userId ? req.body.userId : req.headers['userid']
    const data = {
        //
        manageId: req.headers['userid'],
        date: req.body.date,
        progressDate: Date.now()
    }
    const cartID = req.body.cartID
    try {
        const cartList = await cart.aggregate
            ([{ $match: { manageId: userId } },
            { $addFields: { "cartID": { "$toString": "$_id" } } },
            (cartID && cartID.length) ? { $match: { cartID: { $in: cartID } } } : { $match: {} },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },

            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "Code",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "adminData"
                }
            }])
        const faktorSeprate = totalCart(cartList)
        const faktorDetail = await IntegrateCarts(faktorSeprate)

        var sepidarQuery = []
        var addFaktorResult = []
        var faktorNo = 0
        for (var i = 0; i < faktorDetail.length; i++) {
            faktorNo = await createfaktorNo("F", "02", "21")
            sepidarQuery[i] = await SepidarFunc(faktorDetail[i], faktorNo)
            //console.log(sepidarQuery[i])
            res.status(400).json(sepidarQuery[i])
            return
            //console.log(sepidarQuery[i])
            addFaktorResult[i] = await sepidarPOST(sepidarQuery[i], "/api/invoices", req.headers['userid'])
            //console.log(addFaktorResult[i])
            if (!addFaktorResult[i] || addFaktorResult[0].Message || !addFaktorResult[i].Number) {
                res.status(400).json({
                    error: addFaktorResult[0].Message ? addFaktorResult[0].Message : "error occure",
                    query: sepidarQuery[i], status: "faktor"
                })
                return
            }
            else {
                const cartDetail = findCartSum(faktorDetail[i].cartItems)
                await FaktorSchema.create(
                    {
                        ...data, faktorItems: faktorDetail[i].cartItems,
                        userId: faktorDetail[i].userTemp,
                        customerID: faktorDetail[i].userId,
                        faktorNo: faktorNo,
                        totalPrice: cartDetail.totalPrice,
                        totalCount: cartDetail.totalCount,
                        InvoiceNumber: addFaktorResult[i].Number,
                        InvoiceID: addFaktorResult[i].InvoiceID
                    })

            }
        }
 
        (cartID && cartID.length) ? await cart.deleteMany({ _id: { $in: cartID } }) :
            await cart.deleteMany({ manageId: userId })

        const recieptQuery = 1//await RecieptFunc(req.body.receiptInfo,addFaktorResult[0],faktorNo)
        const recieptResult = 1//await sepidarPOST(recieptQuery,"/api/Receipts/BasedOnInvoice")
        //const SepidarFaktor = await SepidarFunc(faktorDetail)
        if (!recieptQuery || recieptResult.Message) {
            res.json({ error: recieptResult.Message, query: recieptQuery, status: "reciept" })
            return
        }
        else {
            res.json({
                recieptInfo: faktorDetail,
                users: users,
                faktorInfo: addFaktorResult,
                faktorData: sepidarQuery,
                status: "done"
            })
        }

    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
const IntegrateCarts = async (carts) => {
    var cartList = carts
    for (var i = 0; i < cartList.length; i++) {
        cartList[i].cartItems = setCart(cartList[i].cartItems)

    }
    return (cartList)
}
const setCart = (cartItems) => {
    var tempCart = []
    for (var i = 0; i < cartItems.length; i++) {
        repeat = 0
        for (var j = 0; j < tempCart.length; j++) {
            if (cartItems[i].id === tempCart[j].id) {
                tempCart[j].count = parseInt(tempCart[j].count) +
                    parseInt(cartItems[i].count)
                repeat = 1
                break
            }
        }
        !repeat && tempCart.push({ ...cartItems[i] })
    }
    return (tempCart)
}
const SepidarFunc = async (data, faktorNo) => {
    const notNullCartItem = []
    for (var i = 0; i < data.cartItems.length; i++)
        data.cartItems[i].count ?
            notNullCartItem.push(data.cartItems[i]) : ''
    const totalDiscount = parseInt(data&&data.discount)
    var query = {
        "GUID": "124ab075-fc79-417f-b8cf-2a" + faktorNo,
        "CustomerRef": toInt(data.userId),
        "AddressRef": toInt(data.userAddress) ? toInt(data.userAddress) : '',
        "CurrencyRef": 1,
        "Description": faktorNo,
        "DescriptionRef": faktorNo,
        "SaleTypeRef": data.payValue ? toInt(data.payValue) : 4,
        "Duty": 0.0000,
        "Items":
            notNullCartItem.map((item, i) => (
                {
                    "ItemRef": toInt(item.id),
                    "TracingRef": null,
                    "Description": item.description,
                    "StockRef": "5",//data.stockId,
                    "Quantity": toInt(item.count),
                    "Fee": toInt(item.price),
                    "Price": normalPriceCount(item.price, item.count, 1),
                    "Discount": findDiscount(item,totalDiscount),
                    "Tax": normalPriceCount(item.price, item.count, TaxRate),
                    "Duty": 0.0000,
                    "Addition": 0.0000
                }))

    }
    return (query)
}
const RecieptFunc = async (data, FaktorInfo, faktorNo) => {
    var query = {
        "GUID": "124ab075-fc79-417f-b8cf-2a" + faktorNo,
        "InvoiceID": toInt(FaktorInfo.InvoiceID),
        "Description": toInt(FaktorInfo.Number),
        "Date": new Date(),
        "Drafts":
            data.filter(n => n).map((pay, i) => (
                {
                    "BankAccountID": toInt(pay.id),
                    "Description": pay.title,
                    "Number": pay.Number ? pay.Number : "000",
                    "Date": new Date(),
                    "Amount": toInt(pay.value)
                }))

    }
    return (query)
}
const updateCount = async (items) => {
    for (var i = 0; i < items.length; i++) {
        await productCount.updateOne({ ItemID: items[i].id, Stock: "13" },
            { $inc: { quantity: toInt(items[i].count, "1", -1) } })
    }
}
const returnUpdateCount = async (itemID, count) => {
    await productCount.updateOne({ ItemID: itemID, Stock: "13" },
        { $inc: { quantity: toInt(count) } })

}
const createfaktorNo = async (Noun, year, userCode) => {
    var faktorNo = '';
    for (var i = 0; i < 10; i++) {
        faktorNo = Noun + year + userCode +
            Math.floor(Math.random() * (99999 - 10000) + 10000)
        const findFaktor = await FaktorSchema.findOne({ faktorNo: faktorNo })
        if (!findFaktor)
            return (faktorNo)
    }
}
const toInt = (strNum, count, align) => {
    if (!strNum) return (0)

    return (parseInt(parseInt((align ? "-" : '') + strNum.toString().replace(/,/g, '')) *
        (count ? parseFloat(count) : 1)))
}
const normalPriceCount = (priceText, count, tax) => {
    if (!priceText || priceText === null || priceText === undefined) return ("")
    var rawCount = parseFloat(count.toString())
    var rawTax = parseFloat(tax.toString())
    var tempPrice = priceText.toString().split('.')[0]
    var rawPrice = Math.round(parseInt(tempPrice.replace(/,/g, '')
        .replace(/\D/g, '')) * rawCount * rawTax / 1000)
    rawPrice = parseInt(rawPrice) * 1000
    return (
        (rawPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",").replace(/^\D+/g, ''))
    )
}
const findDiscount = (item,totalDiscount) => {
    if (!item.discount) return (0.00)
    var total = totalDiscount?Number(totalDiscount):0
    var off = item.discount?Number(item.discount):0
    var discount = off
    if (off < 100) {
        discount = Number(item.price) * Number(item.count) * (discount+total) / 100
    }
    return ((discount))
}
const roundNumber = (number) => {
    var rawNumber = parseInt(number.toString().replace(/,/g, ''))
    return (parseInt(Math.round(rawNumber / 1000)) * 1000)

}
const minusInt = (quantity, minus) => {
    if (!quantity) return (0)

    return (parseInt(quantity.replace(/\D/g, '')) -
        parseInt(minus.replace(/\D/g, '')))
}
const compareCount = (count1, count2) => {
    return (parseInt(count1.toString().replace(/\D/g, '')) >=
        (parseInt(count2.toString().replace(/\D/g, ''))))
}

router.post('/customer-find', auth, jsonParser, async (req, res) => {
	try {
		const { search = '', code="", phone="",username=""} = req.body;
        const userId = req.headers["userid"];
        const theseProfilesShouldSeeTheirCustomers = ['marketadmin', 'market', 'innerSale'];
        const targetProfiles = await profileModel.find({ profileCode: { $in: theseProfilesShouldSeeTheirCustomers } }).lean();
        const allowedProfiles = targetProfiles.map((p) => `${p._id}`);
        const theseUsersShouldSeeTheirCustomers = await userModel.find({ profile: { $in: allowedProfiles } }).lean();
        const theseUsersShouldSeeTheirCustomersIds = theseUsersShouldSeeTheirCustomers.map((u) => `${u._id}`);

		const userMatchConditoin = {
			active: true,
        };
        if (0&&search) {
            userMatchConditoin['$or'] = [
                { username: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { mobile: { $regex: search, $options: 'i' } },
                { cCode: { $regex: search, $options: 'i' } }
            ];
        }
		const customerMatchCondition = {
			active: true,
		};
        if(username){
            customerMatchCondition['$and'] = [
                {
                    $or: [
                        { username: { $regex: username, $options: 'i' } },
                        { cName: { $regex: username, $options: 'i' } },
                        { sName: { $regex: username, $options: 'i' } },
                    ]
                }
                
            ]
        }
        if(phone){
            customerMatchCondition.phone= { $regex: phone, $options: 'i' } 
        }
        if(code){
            customerMatchCondition.cCode= { $regex: code, $options: 'i' }  
        }
        if (search) {
            customerMatchCondition['$and'] = [
                {
                    $or: [
                        { username: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { cName: { $regex: search, $options: 'i' } },
                        { sName: { $regex: search, $options: 'i' } },
                        { mobile: { $regex: search, $options: 'i' } },
                        { cCode: { $regex: search, $options: 'i' } }
                    ],
                },
            ];
        }
        // if (theseUsersShouldSeeTheirCustomersIds.includes(userId)) {
        //     // customerMatchCondition['$or'].push({ visitorId: userId });
        //     // customerMatchCondition['$or'].push({ visitorId: { $exists: false } });
        //     customerMatchCondition['$and'].push({
        //         $or: [
        //             { visitorId: userId },
        //             { visitorId: { $exists: false } },
        //             { profileId: { $in: allowedProfiles } },
        //             { profileId: { $exists: false } },
        //         ],
        //     })
        // }
		const [searchUser, searchCustomer] = await Promise.all([
            userModel.find(userMatchConditoin).lean(),
            customerSchema.find(customerMatchCondition).limit(30).lean()
        ]);
		const allUser = searchCustomer.concat(searchUser);
        // if (!allUser.length) { // this check now has a separate endpoint /canSubmitOrderForCustomer
        //     return res.status(400).send({ error: 'امکان ثبت برای این مشتری برای شما وجود ندارد.' });
        // }
        const temp = await Promise.all(allUser.map(async (u) => ({
            ...u,
            canSubmit: await checkIfCanSubmitOrderForThisCustomer(userId, u._id)
        })));
		return res.json({ customers: temp });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/bankCustomer', async (req, res) => {
    const search = req.body.search
    try {
        var bankCustomer = await bankAccounts.find()

        res.json({ bankList: bankCustomer })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/edit-addCart', async (req, res) => {
    const cartNo = req.body.cartNo
    const data = req.body.data
    try {
        //const userData = await users.findOne({_id:req.headers['userid']})
        //const stockId = userData.StockId?userData.StockId:"13"
        var status = "";
        //const cartData = await cart.find({userId:userId})
        const CartData = await cart.findOne({ cartNo: cartNo })

        const availItems = await checkAvailable(data, CartData.stockId)
        if (!availItems) {
            res.status(400).json({ error: "موجودی کافی نیست" })
            return
        }
        const cartItems = createCart(CartData ? CartData.cartItems : [],
            data)
        CartData.cartItems = (cartItems)
        if (!CartData) {

        }
        else {
            cartLog.create({ ...CartData, ItemID: data, action: "edit cart" })
            await cart.updateOne(
                { cartNo: cartNo }, { $set: CartData })
            status = "edit cart"
        }
        const cartDetails = await findCartData(cartNo)
        res.json({ ...cartDetails,canEdit:1, message: "آیتم اضافه شد" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/edit-removeCart', jsonParser, async (req, res) => {
    const cartNo = req.body.cartNo
    const cartID = req.body.cartID

    try {
        var status = "";
        const cartData = await cart.findOne({ cartNo: cartNo })
        const cartItems = removeCart(cartData, cartID)
        //cartData.cartItems =(cartItems)
        await cart.updateOne({ cartNo: cartNo },
            { $set: { cartItems: cartItems } })
        //console.log(req.body.cartItem)
        cartLog.create({ ...cartData, ItemID: cartID, action: "edit delete" })

        const cartDetails = await findCartData(cartNo)
        res.json({ ...cartDetails,canEdit:1, message: "آیتم حذف شد" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/edit-updateFaktor', jsonParser, async (req, res) => {
    const data = {
        //
        manageId: req.headers['userid'],
        date: req.body.date,
        progressDate: Date.now()
    }
    const cartNo = req.body.cartNo
    try {
        const adminUser = await users.findOne({ _id: req.headers["userid"] })

        if (!adminUser.access == "manager") {
            res.status(400).json({ error: "no access" })
            return
        }
        const cartList = await cart.aggregate
            ([{ $match: { cartNo: cartNo } },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
            { $addFields: { "userId": { "$toObjectId": "$userId" } } },

            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "adminData"
                }
            }])
        const faktorSeprate = totalCart(cartList)
        const faktorDetail = await IntegrateCarts(faktorSeprate)

        var sepidarQuery = []
        var addFaktorResult = []
        var faktorNo = 0

        for (var i = 0; i < faktorDetail.length; i++) {
            faktorNo = await createfaktorNo("F", "02", "21")
            sepidarQuery[i] = await SepidarFunc(faktorDetail[i], faktorNo)

            addFaktorResult[i] = await sepidarPOST(sepidarQuery[i], "/api/invoices", req.headers['userid'])

            //console.log(addFaktorResult[i])
            if (!addFaktorResult[i] || addFaktorResult[0].Message || !addFaktorResult[i].Number) {
                res.status(400).json({
                    error: addFaktorResult[0].Message ? addFaktorResult[0].Message : "error occure",
                    query: sepidarQuery[i], status: "faktor"
                })
                return
            }
            else {
                //console.log(addFaktorResult[i].Number)
                const cartDetail = findCartSum(faktorDetail[i].cartItems,cartData[c].transportPrice)
                await FaktorSchema.create(
                    {
                        ...data, faktorItems: faktorDetail[i].cartItems,
                        userId: faktorDetail[i].userTemp,
                        customerID: faktorDetail[i].userId,
                        faktorNo: faktorNo,
                        totalPrice: cartDetail.totalPrice,
                        totalCount: cartDetail.totalCount,
                        InvoiceNumber: addFaktorResult[i].Number,
                        InvoiceID: addFaktorResult[i].InvoiceID
                    })

            }
        }

        await cart.deleteOne({ cartNo: cartNo })


        const recieptQuery = 1//await RecieptFunc(req.body.receiptInfo,addFaktorResult[0],faktorNo)
        const recieptResult = 1//await sepidarPOST(recieptQuery,"/api/Receipts/BasedOnInvoice")
        //const SepidarFaktor = await SepidarFunc(faktorDetail)
        if (!recieptQuery || recieptResult.Message) {
            res.json({ error: recieptResult.Message, query: recieptQuery, status: "reciept" })
            return
        }
        else {
            res.json({
                recieptInfo: faktorDetail,
                users: users,
                faktorInfo: addFaktorResult,
                faktorData: sepidarQuery,
                status: "done"
            })
        }

    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/edit-payValue', jsonParser, async (req, res) => {
	try {
		const cartNo = req.body.cartNo;
		const data = {
			userId: req.body.userId ? req.body.userId : req.headers['userid'],
			payValue: req.body.payValue,
			date: req.body.date,
			progressDate: Date.now(),
		};
		let status = '';
		cartNo ? await cart.updateOne({ cartNo }, { $set: { payValue: req.body.payValue } }) : await quickCart.updateOne({ userId: data.userId }, { $set: data });
		status = 'update cart';
		const cartDetails = cartNo ? await findCartData(cartNo) : await findCartFunction(data.userId, req.headers['userid']);
		// return res.json({ ...cartDetails, message: 'تغییرات ذخیره شد' });
        const response = {
            ...cartDetails,
            message: 'تغییرات ذخیره شد',
        };
        if (!cartNo) {
            const { needDependency, dependencyCheckResult } = await checkForSalePolicyDependentProductsByAction(req.headers['userid'], cartDetails)
            response.needDependency = needDependency;
            response.dependencyCheckResult = dependencyCheckResult;
        }
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
})

router.post('/public-cart-find', async (req, res) => {
    const cartNo = req.body.cartNo;

    try {
        const publicLink = await publicLinks.findOne({ cartNo: cartNo });

        if (!publicLink || new Date(publicLink.expirationDate) <= new Date()) {
            return res.status(400).json({ error: "error", message: "لینک عمومی نامعتبر است یا منقضی شده است." });
        }

        const cartList = await cart.aggregate([
            { $match: { cartNo: cartNo } },
            { $addFields: { "manageId": { "$toObjectId": "$manageId" } } },
            { $addFields: { "userId": { "$toObjectId": "$userId" } } },
            {
                $lookup: {
                    from: "customers",
                    localField: "userId",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "manageId",
                    foreignField: "_id",
                    as: "managerData"
                }
            }
        ]);

        const cartData = cartList && cartList[0];
        var canEdit = 0;
        var taskData = await OrderToTask(cartData.cartNo);

        if (taskData && (
            taskData.taskStep == "initial" || 
            taskData.taskStep == "edit" || 
            taskData.taskStep == "quote")) {
            canEdit = 1;
        }

        if (!cartData) {
            res.status(400).json({ error: "error", message: "آیتم ها با مشکل مواجه شدند" });
            return;
        }

        var cartItems = cartData.cartItems;
        if (cartItems) {
            for (var i = 0; i < cartItems.length; i++) {
                try {
                    var cartTemp = cartItems[i];
                    const productData = await products.findOne({ sku: cartTemp.sku });
                    cartList[0].cartItems[i].productData = productData;
                } catch { }

                cartList[0].cartItems[i].total = findCartItemDetail(cartItems[i], cartData.payValue, cartData.discount);
            }
        }

        var orderData = findQuickCartSum(cartItems, cartData.payValue, 
            cartData.discount,cartData.transportPrice);

        res.json({ cart: cartList, orderData: orderData, canEdit, taskData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


router.post("/create-public-link", auth, async (req, res) => {
    try {
      const { cartNo, expirationDate } = req.body;
      const creatorUserId = req.headers['userid'];
  
      // Validate if cartNo is provided
      if (!cartNo) {
        return res.status(400).json({ error: "CartNo را وارد کنید" });
      }
  
      // Validate if user ID is provided in the headers
      if (!creatorUserId) {
        return res.status(400).json({ error: "شناسه کاربری در هدر الزامی است." });
      }
  
      // Fetch user details by user ID
      const userDetail = await users.findOne({ _id: creatorUserId });
      if (!userDetail) {
        return res.status(404).json({ error: "کاربر یافت نشد." });
      }
  
      // Check if a record with the same cartNo exists and its expiration date is still valid
      const existingLink = await publicLinks.findOne({
        cartNo: cartNo,
        expirationDate: { $gte: new Date() }, // Check if the link has not expired
      });
  
      if (existingLink) {
        return res.json({ message: "لینک عمومی با این شماره کارت قبلاً ایجاد شده و هنوز منقضی نشده است." });
      }
  
      // Default expiration date to 30 days from now if not provided
      const defaultExpirationDate = expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
      // Create a new public link
      const newLink = new publicLinks({
        cartNo: cartNo,
        creatorUserId,
        expirationDate: defaultExpirationDate,
      });
  
      // Save the new public link
      await newLink.save();
  
      // Respond with success message in Persian
      res.status(201).json({ 
        message: "لینک عمومی با موفقیت ایجاد شد.", 
        data: newLink 
      });
    } catch (error) {
      res.status(500).json({ error: "ایجاد لینک عمومی با شکست مواجه شد." });
    }
  });  

router.post('/sepidar-find', jsonParser, async (req, res) => {
    const faktorId = req.body.faktorId;
    try {
        //const faktorData = await tasks.findOne({orderNo:cartId})
        //var faktorId = faktorData&&faktorData.result
        if (!faktorId) {
            res.send({ error: "not Found", message: "not found" })
            return
        }
        //logger.warn("main done")
        var userId = ""

        const OnlineFaktor = await sepidarFetch("data", "/api/invoices/" + faktorId)

        const userDetail = await customerSchema.findOne({ CustomerID: OnlineFaktor.CustomerRef})
        const invoice = OnlineFaktor.InvoiceItems
        if (!invoice)
            res.status(400).json({ error: OnlineFaktor.Message })
        //var itemRefs=OnlineFaktor.InvoiceItems
        for (var i = 0; i < invoice.length; i++) {
            var faktorItem = invoice[i]
            var itemData = await products.findOne({ ItemID: faktorItem.ItemRef ,active:true}).lean()
         const boxs=calculateBoxing(invoice[i].Quantity,itemData.perBox)
            OnlineFaktor.InvoiceItems[i].itemDetail = {...itemData,boxs}
        }
        res.json({ faktor: OnlineFaktor, userDetail: userDetail, itemRefs: invoice })
    }
    catch (error) {
        res.status(500).json({ error: error.message })
    }
})
function calculateBoxing(count, boxCapicity) {
    return {
        box: parseInt(parseInt(count) / parseInt(boxCapicity)),
        single: parseInt(parseInt(count) % parseInt(boxCapicity))
    }
}

router.post('/public-sepidar-find', jsonParser, async (req, res) => {
    try {
        const faktorId = req.body.faktorId;
        if (!faktorId) {
            return res.status(400).json({ error: "not Found", message: "فاکتور یافت نشد." });
        }

        const publicLink = await publicLinks.findOne({ cartNo: faktorId }).lean();
        if (!publicLink || new Date(publicLink.expirationDate) <= new Date()) {
            return res.status(400).json({ error: "error", message: "لینک عمومی نامعتبر است یا منقضی شده است." });
        }

        const OnlineFaktor = await sepidarFetch("data", "/api/invoices/" + faktorId);
        if (!OnlineFaktor.InvoiceItems) {
            return res.status(400).json({ error: OnlineFaktor.Message });
        }

        const userDetail = await customerSchema.findOne({ CustomerID: OnlineFaktor.CustomerRef }).lean();
        const invoice = OnlineFaktor.InvoiceItems;
        for (let i = 0; i < invoice.length; i++) {
            const faktorItem = invoice[i];
            const itemDetail = await products.findOne({ ItemID: faktorItem.ItemRef });
            OnlineFaktor.InvoiceItems[i].itemDetail = itemDetail;
        }
        return res.json({ faktor: OnlineFaktor, userDetail: userDetail, itemRefs: invoice });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/copy-quote', jsonParser, async (req, res) => {
	const { userId, cartNo } = req.body;

	try {
        const data = {
            userId,
            manageId: req.headers['userid'],
            // date,
            progressDate: Date.now(),
            // branchName,
            // branchId,
            isQuote: true,
        };
		const isSale = await CheckSale(data.manageId); // 1 or 0
		data.isSale = isSale;
		//const cartAll = await cart.find()
		const userData = await customers.findOne({ _id: userId }).lean();
		const adminData = await users.findOne({ _id: data.manageId }).lean();
		const adminProfiles = adminData.profile ? adminData.profile.map((item) => new ObjectId(item)) : [];
		const profileData = adminData && (await profiles.find({ _id: { $in: adminProfiles } })); // { _id: { $in: adminData.profile } }
		const targetCart = await cart.findOne({ cartNo }).lean();
		// // check sale policy rules
		// const { isSalePolicyRulesPassed, salePolicyRuleMessage, requiredProducts } = await checkForSalePolicyRules(qCartData);
		// if (!isSalePolicyRulesPassed) {
		// 	const response = {
		// 		message: salePolicyRuleMessage,
		// 		productsList: requiredProducts,
		// 	};
		// 	return res.status(400).json(response);
		// }
		const defaultPay = customers.CustomerID ? '3' : '4';
		data.payValue = targetCart && targetCart.payValue ? targetCart.payValue : defaultPay;
		data.description = targetCart && targetCart.description;
		data.discount = targetCart && targetCart.discount;
		const targetCartItems = targetCart && targetCart.cartItems;
		data.cartItems = targetCartItems;
		const stockId = userData.StockId ? userData.StockId : '5';

		const availItems = !data.isQuote ? await checkCart(targetCartItems, stockId, data.payValue) : 0;

		if (availItems) {
			res.status(400).json({ error: availItems });
			return;
		}
		//data.cartItems =pureCartPrice(quickCartItems,qCartData.payValue)
		data.cartNo = await NewCode(isSale ? 's' : 'd');
		data.profileId = adminData && adminData.profile;
		data.profileName = profileData && profileData.map((item) => item.profileName);
		data.stockId = targetCart && targetCart.stockId;
		// cartLog.create({ ...data, ItemID: cartID, action: 'copy quote' });
		cartLog.create({ ...data, action: 'copy quote' });
		await cart.create(data);
		// status = 'create cart';
		// await quickCart.deleteOne({ userId: data.userId });
		if (!isSale) await CreateTask('border', data, userData);
		// const cartDetails = await findCartFunction(userId, req.headers['userid']);
		// setTimeout(() => res.json(cartDetails), 3000);
        return res.json({ success: 'پیش فاکتور کپی شد.' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

module.exports = router;
