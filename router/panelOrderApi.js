const express = require('express');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const router = express.Router()
const auth = require("../middleware/auth");
const { ObjectId } = require('mongodb');
const orders = require('../models/orders/orders');
const carts = require('../models/product/cart')
const products = require('../models/product/products');
const users = require('../models/auth/users');
const Invoice = require('../models/product/Invoice');
const crmlist = require('../models/crm/crmlist');
const bankAccounts = require('../models/product/bankAccounts');
const transaction = require('../models/product/transaction');
const FindRemainBank = require('../middleware/FindRemainBank');
const utils = require('../utils');
const userModel = require('../models/auth/users');
const customerModel = require('../models/auth/customers');
const { TaxRate } = process.env

router.post('/sku/find', jsonParser, async (req, res) => {
    try {
        const manData = await products.findOne({ sku: req.body.sku });
        res.json(manData)
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/list', jsonParser, async (req, res) => {
	try {
        const userId = req.headers['userid'];
        const { dateFrom = [], dateTo = [], offset = 0, pageSize = 10, orderNo, status, customer, manager, brand, type } = req.body;
        const fromDate = utils.helper.getFromDate(dateFrom);
        const toDate = utils.helper.getToDate(dateTo);
        const skip = parseInt(offset);
		const type = req.body.type?req.body.type:"Sale"
        const limit = parseInt(pageSize);

		const adminData = await users.findOne({ _id: userId }).select({ password: 0 }).lean();
		if (!adminData) {
			return res.status(400).json({ error: 'کاربر معتبر نیست.' });
		}
        const userList = await users.find()
		var managerTabs = [
			{ title: 'ویزیتور', type: 'Visitor', manager: 'visitor' },
        ]
        for(var i=0;i<userList.length;i++){
            managerTabs.push({
                title: userList[i].username,
                type: 'Sale',manager: userList[i].username
            })
        }
        managerTabs.push({ title: 'وب سایت', type: 'Website' })
		const tabs = adminData.access === 'manager' ? managerTabs : [];
		// if (adminData.access !== 'manager') { // TODO: This condition should be checked
		// 	if (adminData.username === 'zohre' || adminData.username === 'hesarak') {
		// 		type = 'Sale';
		// 		data.manager = adminData.username;
		// 	} else {
        //         type = 'Visitor';
        //     }
		// }

		let brandUnique = [];
		let resultData = [];
		let fullSize = 0;
		let isSale = false;
		let size = 0;
		// let crmStatus = [];
		let bankList = [];
		let transactions = [];
		let transRemain = { remain: 0, totalPay: 1234000 };

		if (!type || type === 'Visitor') {
			if (adminData.access === 'sale') {
				return res.status(400).json({ error: 'دسترسی به این بخش ندارید.' });
			}
			// const crmData = await crmlist.findOne({ crmCode: 'main' }).lean();
			// crmStatus = crmData ? crmData.crmSteps : [];
            const limitAccess = adminData.access === 'manager' ? false : true;
            const usersCondition = {};
			if (adminData.access === 'manager') {
				usersCondition.profile = manager === 'markazi' ? '6732ef0da39e1c5c6ed2a8d5' : '660409167887fe34af0d0c77';
			} else {
				usersCondition.profile = { $in: adminData.profile };
			}
            const usersList = await userModel.find(usersCondition).lean();
			const userIds = usersList.map((item) => `${item._id}`);

            const matchCondition = {
				manageId: { $in: userIds },
                $or: [
                    { isSale: { $exists: false } },
                    { isSale: '0' },
                    { isSale: false }
                ],
            };
			var statusArr = ''
			if(status){
				statusArr = [status]
				if(status == "dodone"){
					statusArr.push("archive")
				}
				if(status == "undone"){
					statusArr.push("initial","edit","accepted","prepare","sending","done")
				}
			}
            if (orderNo) {
                matchCondition.cartNo = new RegExp('.*' + orderNo + '.*');
            } else {
                matchCondition.initDate = {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate)
                };
            }
            // if (limitAccess) {
            //     matchCondition.manageId = { $in: userIds };
            // }
            if (customer) {
                const customerMatchCondition = {
                    $or: [
                        { meli: new RegExp('.*' + customer + '.*') },
                        { phone: new RegExp('.*' + customer + '.*') },
                        { cName: new RegExp('.*' + customer + '.*') },
                        { username: new RegExp('.*' + customer + '.*') },
                        { mobile: new RegExp('.*' + customer + '.*') },
                    ],
                };
                const targetCustomers = await customerModel.find(customerMatchCondition).lean();
                matchCondition.userId = { $in: targetCustomers.map(c => `${c._id}`) };
            }
            const aggregation = [
				{ $match: matchCondition },
				...(status
					? [
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
													$and: [{ $eq: ['$orderNo', '$$cart_no'] }, 
													{ $in: ['$taskStep', statusArr] }],
												},
											},
										},
									],
									as: 'taskInfo',
								},
							},
							{
								$match: {
									taskInfo: { $ne: [] },
								},
							},
					  ]
					: []),
				{
					$facet: {
						totalSize: [{ $count: 'totalSize' }],
						result: [
							{ $sort: { initDate: -1 } },
							{ $skip: skip },
							{ $limit: limit },
							{ $addFields: { userId: { $toObjectId: '$userId' } } },
							{
								$lookup: {
									from: 'customers',
									localField: 'userId',
									foreignField: '_id',
									as: 'userInfo',
								},
							},
							{
								$lookup: {
									from: 'tasks',
									localField: 'cartNo',
									foreignField: 'orderNo',
									as: 'taskInfo',
								},
							},
						],
					},
				},
			];
			const [aggregationResult] = await carts.aggregate(aggregation);
            size = aggregationResult?.totalSize[0]?.totalSize || 0;
            const cartList = aggregationResult?.result || [];
			resultData = cartList.map((i) => {
				const totalCart = findCartSum(i.cartItems, i.payValue);
				const temp = {
					...i,
					totalCart,
					InvoiceID: i.taskInfo && i.taskInfo[0] ? i.taskInfo[0]?.result?.InvoiceID : '',
					status: i.taskInfo && i.taskInfo[0] ? i.taskInfo[0]?.taskStep : '',
				};
				return temp;
			});
		}

		if (type === 'WebSite') {
			const matchCondition = {};
			const aggregation = [
				{ $match: matchCondition },
				{
					$facet: {
						totalSize: [{ $count: 'totalSize' }],
						result: [
							{ $sort: { initDate: -1 } },
							{ $skip: skip },
							{ $limit: limit },
							{ $addFields: { userId: { $toObjectId: '$userId' } } },
							{
								$lookup: {
									from: 'customers',
									localField: 'userId',
									foreignField: '_id',
									as: 'userInfo',
								},
							},
						],
					},
				},
			];
			const reportList = await orders.aggregate([
				{ $match: orderNo ? { rxOrderNo: new RegExp('.*' + orderNo + '.*') } : {} },
				{ $match: !orderNo ? { date: { $gte: new Date(fromDate) } } : {} },
				{ $match: !orderNo ? { date: { $lte: new Date(toDate) } } : {} },
				{ $sort: { date: -1 } },
			]);

			var filter1Report = customer
				? reportList.filter((item) => item.userInfo[0] && item.userInfo[0].cName && item.userInfo[0].cName.includes(customer))
				: reportList;

			resultData = [];
		}

		if (type === 'Sale') {
			if (adminData.access === 'market') {
				return res.status(400).json({ error: 'دسترسی به این بخش ندارید.' });
			}
			// crmStatus = [
			// 	{ title: 'انجام نشده', enTitle: 'undone', id: 0 },
			// 	{ title: 'انجام شده', enTitle: 'done', id: 1 },
			// ];
			if (adminData.access !== 'manager') {
				if (!manager) {
					return res.status(400).json({ error: 'اطلاعات واحد فروش وارد نشده است.' });
				}
				if (adminData.username !== manager) {
					return res.status(400).json({ error: 'دسترسی به فاکتورهای واحدهای دیگر را ندارید.' });
				}
			}
			const matchCondition = {
				//isSale: true,
			};
			if (orderNo) {
				matchCondition.cartNo = new RegExp('.*' + orderNo + '.*');
			} else {
				matchCondition.initDate = {
					$gte: new Date(fromDate),
					$lte: new Date(toDate)
				};
			}
			if (manager) {
				const targetManager = await userModel.findOne({ username: manager }).lean();
				matchCondition.manageId = `${targetManager._id}`;
			}
			if (status) {
				if (status === 'dodone') {
					matchCondition.InvoiceID = { $exists: true };
				} else {
					matchCondition.InvoiceID = { $exists: false };
				}
			}
			const aggregation = [
				{ $match: matchCondition },
				{
					$facet: {
						totalSize: [{ $count: 'totalSize' }],
						result: [
							{ $sort: { initDate: -1 } },
							{ $skip: skip },
							{ $limit: limit },
							{ $addFields: { userId: { $toObjectId: '$userId' } } },
							{
								$lookup: {
									from: 'customers',
									localField: 'userId',
									foreignField: '_id',
									as: 'userInfo',
								},
							},
						],
					},
				},
			];
			const [aggregationResult] = await carts.aggregate(aggregation);
            size = aggregationResult?.totalSize[0]?.totalSize || 0;
            const openList = aggregationResult?.result || [];
			resultData = openList.map((i) => {
				const userData = i.userInfo && i.userInfo[0] && i.userInfo[0].CustomerID;
				const totalCart = findCartSum(i.cartItems, i.payValue);
				const temp = {
					...i,
					totalCart,
					status: i.InvoiceID ? 'dodone' : 'undone',
					isOfficial: userData ? 1 : 0
				};
				return temp;
			});
			bankList = await bankAccounts.find({ limit: { $ne: adminData.username } });
			transactions = await transaction.find({ userId, sepidarID: { $exists: false } });
			// brandUnique = [...new Set(showCart && showCart.map((item) => item.brand))];
			transRemain = FindRemainBank(transactions, req.body.totalCartValue);
		}

		if (type == 'Invoice') { //? type of Invoice is not exists in types. Why is this if here?
			if (adminData.access == 'market') {
				res.status(400).json({ error: 'دسترسی به این بخش ندارید' });
				return;
			}

			var showCart = [];
			const invoiceList = await Invoice.aggregate([
				{
					$lookup: {
						from: 'customers',
						localField: 'CustomerRef',
						foreignField: 'CustomerID',
						as: 'userInfo',
					},
				},
				{
					$lookup: {
						from: 'invoiceitems',
						localField: 'InvoiceID',
						foreignField: 'InvoiceID',
						as: 'invoiceItems',
					},
				},
				{ $sort: { Date: -1 } },
			]);

			for (var i = 0; i < (invoiceList && invoiceList.length); i++) {
				var totalPrice = findCartSum(invoiceList[i].cartItems, 3);
				showCart.push({ ...invoiceList[i], totalCart: totalPrice });
			}

			size = showCart && showCart.length;
			const orderList = showCart && showCart.slice(offset, parseInt(offset) + parseInt(pageSize));
			resultData = orderList;
		}

		return res.json({
			filter: resultData,
			brand: brandUnique,
			isSale,
			...transRemain,
			size,
			adminData,
			// status: crmStatus,
			bankList,
			transData: transactions,
			tabs,
		});
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/list-client',auth, jsonParser, async (req, res) => { // TODO: check filters like above /list endpoint
    var pageSize = req.body.pageSize ? req.body.pageSize : "10";
    var offset = req.body.offset ? (parseInt(req.body.offset)) : 0;
    var nowDate = new Date();
    try {
        const data = {
            orderNo: req.body.orderNo,
            status: req.body.status,
            customer: req.body.customer,
            manager: req.body.manager,
            brand: req.body.brand,
            dateFrom:
                req.body.dateFrom ? req.body.dateFrom[0] + "/" +
                    req.body.dateFrom[1] + "/" + req.body.dateFrom[2] + " " + "00:00" :
                    new Date().toISOString().slice(0, 10) + " 00:00",
            dateTo:
                req.body.dateTo ? req.body.dateTo[0] + "/" +
                    req.body.dateTo[1] + "/" + req.body.dateTo[2] + " 23:59" :
                    new Date().toISOString().slice(0, 10) + " 23:59",
            pageSize: pageSize
        }

        const nowIso = nowDate.toISOString();
        const nowParse = Date.parse(nowIso);
        const now = new Date(nowParse);
        var now2 = new Date();
        var now3 = new Date();

        var type = req.body.type ? req.body.type : "";
        const adminData = await users.findOne({ _id: new ObjectId(req.headers["userid"]) });

        const dateFromEn = new Date(now2.setDate(now.getDate() - (data.dateFrom ? data.dateFrom : 1)));
        dateFromEn.setHours(0, 0, 0, 0);
        const dateToEn = new Date(now3.setDate(now.getDate() - (data.dateTo ? data.dateTo : 0)));
        dateToEn.setHours(23, 59, 0, 0);

        if (!adminData) {
            res.status(400).json({ error: "کاربر معتبر نیست" });
            return;
        }
        var clientList=[]
        if(adminData.access=="admin"){
            var userList = await users.find(
                {profile:{$in:adminData.profile},access:{$nin:["manager","admin"]}})//{StockId:userData.StockId})
            clientList=(userList.map(item=>item._id.toString()))
        }
        clientList.push(adminData._id.toString())
            var showCart = [];
            const cartList = await carts.aggregate([
                { $addFields: { "userId": { "$toObjectId": "$userId" } } },
                {
                    $lookup: {
                        from: "customers",
                        localField: "userId",
                        foreignField: "_id",
                        as: "userInfo"
                    }
                },
                {
                    $lookup: {
                        from: "tasks",
                        localField: "cartNo",
                        foreignField: "orderNo",
                        as: "taskInfo"
                    }
                },
                { $match: { manageId: {$in:clientList}}},
                { $match: data.orderNo ? { cartNo: new RegExp('.*' + data.orderNo + '.*') } : {} },
                { $match: !data.orderNo ? { initDate: { $gte: new Date(data.dateFrom) } } : {} },
                { $match: !data.orderNo ? { initDate: { $lte: new Date(data.dateTo) } } : {} },
                { $sort: { "initDate": -1 } }
            ]);
            var isSale = false
            for (var i = 0; i < (cartList && cartList.length); i++) {
                if (data.customer) {
                    if (cartList[i].userInfo[0]) {
                        var userSimilar = cartList[i].userInfo[0].username &&
                            cartList[i].userInfo[0].username.includes(data.customer);
                        var phoneSimilar = cartList[i].userInfo[0].phone &&
                            cartList[i].userInfo[0].phone.includes(data.customer);
                        if (!userSimilar && !phoneSimilar)
                            continue;
                    } else {
                        continue;
                    }
                }
            var tempStatus = cartList[i].InvoiceID?"done":"undone"
                if(!isSale) isSale=cartList[i].isSale?true:false
                var cartTask = cartList[i].taskInfo && cartList[i].taskInfo[0];
                var InvoiceID = cartTask?(cartTask.result?cartTask.result.InvoiceID:''):''
                var taskStep = cartTask ? cartTask.taskStep : null;
                var orderStatus =  cartList[i].status
                if (data.status&&!orderStatus) {
					if(taskStep){
						if ((taskStep) !== data.status)
							continue;
					}
					else if(tempStatus!== data.status)
						continue;
                }

                var totalPrice = findCartSum(cartList[i].cartItems, cartList[i].payValue);

                var cartWithTaskStep = {
                    _id: cartList[i]._id,
                    status: taskStep, InvoiceID,
                    ...cartList[i], status:tempStatus,
                    totalCart: totalPrice
                };

                showCart.push(cartWithTaskStep);
            }
            var crmData = await crmlist.findOne({crmCode:"main"})
            status = crmData?crmData.crmSteps:[]
            brandUnique = [...new Set(showCart &&
                showCart.map((item) => item.brand))];
            size = showCart && showCart.length;
            const orderList = showCart && showCart.slice(offset,
                (parseInt(offset) + parseInt(pageSize)));

            resultData = orderList;
        


        res.json({
            filter: resultData, brand: brandUnique, 
            size,adminData,clientList,isSale
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const findCartSum = (cartItems, payValue) => {
    if (!cartItems) return ({ totalPrice: 0, totalCount: 0 })
    var cartSum = 0;
    var cartCount = 0;
    var cartDiscount = 0;
    var cartTax = 0;
    var cartDescription = ''
    for (var i = 0; i < cartItems.length; i++) {
        //console.log(payValue)
        var cartItemPrice = findPayValuePrice(cartItems[i].price, payValue)
        var countTemp = parseInt(cartItems[i].count.toString().replace(/,/g, '').replace(/^\D+/g, ''))
        try {
            if (cartItems[i].price){
                var tempPrice = parseInt(cartItemPrice) *countTemp
                cartSum += tempPrice
                cartTax += Math.round(tempPrice*TaxRate)
            }
            if (cartItems[i].count)
                cartCount += countTemp
            cartDescription += cartItems[i].description ? cartItems[i].description : ''
            if (cartItems[i].discount) {
                var off = parseInt(cartItems[i].discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))
                if (off > 100)
                    cartDiscount += off
                else
                    cartDiscount += parseInt(cartItemPrice)
                        * Number(cartItems[i].count) *
                        (1 + TaxRate) * (off) / 100
            }
        } catch { }
    }
    return ({
        totalFee: cartSum,
        totalCount: cartCount,
        totalDiscount: cartDiscount,
        totalTax: cartTax,
        totalPrice: (cartSum +cartTax - cartDiscount),
        cartDescription: cartDescription
    })
}

const findPayValuePrice = (priceArray, payValue) => {
    if (!priceArray) return (0)
    if (!payValue) payValue = 3
    var price = priceArray
    if (priceArray.length && priceArray.constructor === Array)
        price = priceArray.find(item => item.saleType == payValue).price

    return (price)

}
module.exports = router;
