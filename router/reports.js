const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const jMoment = require('moment-jalaali');

const auth = require('../middleware/auth');

const brandModel = require('../models/product/brand');
const userModel = require('../models/auth/users');
const cartModel = require('../models/product/cart');
const profileModel = require('../models/auth/ProfileAccess');
const faktorModel = require('../models/product/faktor');
const saleCommissionGroupModel = require('../models/sale/saleCommissionGroup');

router.use(bodyParser.json());
router.use(auth);
router.use((req, res, next) => {
	// this middleware is because front had requeted.
	if (req.body) {
		if (req.body.mainList) {
			if (req.body.mainList.length) {
				if (!req.body.mainList[0]) {
					req.body.mainList = [];
				}
			}
		} else if (req.body.mainList === '') {
			req.body.mainList = [];
		}
	}
	next();
})

const tempPromise = () => {
	return new Promise((resolve, reject) => {
		return resolve();
	})
}

const getFromDate = (dateFrom, startOf = 'day') => {
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

const getToDate = (dateTo, endOf = 'day') => {
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

const getUserIdsByProfileCode = (profileCodes, requestedUserIds = []) => {
	return new Promise((resolve, reject) => {
		profileModel
			.find({ profileCode: { $in: profileCodes } })
			.lean()
			.then((profiles) => {
				const profileIds = profiles.length ? profiles.map((i) => `${i._id}`) : [];
				const condition = {
					profile: { $in: profileIds },
				};
				if (requestedUserIds.length) {
					condition._id = { $in: requestedUserIds };
				}
				return userModel.find(condition).lean();
			})
			.then((users) => {
				// const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				return resolve(users);
			})
			.catch((err) => {
				console.log(err);
				return resolve([]);
			});
	});
};

const getFaktorsTotalCountAndTotalPrice = (requestCondition) => {
	return new Promise((resolve, reject) => {
		const { date = {}, isWeb = false, profileCode, brandList = [], ProductList = [], requestedUserIds = [], step } = requestCondition;
		const { dateFrom = [], dateTo = [] } = date;
		const fromDate = getFromDate(dateFrom);
		const toDate = getToDate(dateTo);
		let data = [];
		profileModel
			.findOne({ profileCode })
			.then((profile) => {
				const condition = {
					profile: `${profile._id}`,
				};
				if (requestedUserIds.length) {
					condition._id = { $in: requestedUserIds };
				}
				return userModel.find(condition);
			})
			.then((users) => {
				data = users.map((item) => {
					return {
						id: `${item._id}`,
						name: item.cName,
						username: item.username,
						count: 0,
						price: 0,
					};
				})
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				const faktorsMatchCondition = {
					initDate: {
						$gte: new Date(fromDate),
						$lte: new Date(toDate),
					},
					isWeb: false,
				};
				if (isWeb) {
					faktorsMatchCondition.isWeb = true;
				}
				if (userIds.length) {
					faktorsMatchCondition.manageId = { $in: userIds };
				}
				// return faktorModel.find(faktorsMatchCondition);
				const faktorAggregation = [
					{ $match: faktorsMatchCondition },
					{
						$lookup: {
							from: 'faktoritems',
							let: {
								localField: '$InvoiceNumber',
							},
							pipeline: [
								{
									$match: {
										$expr: {
											$eq: ['$InvoiceNumber', '$$localField'],
											// 	$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $eq: ['$taskStep', '$$archiveTaskStep'] }],
										},
									},
								},
								{
									$lookup: {
										from: 'products',
										localField: 'sku',
										foreignField: 'sku',
										as: 'productInfo',
									},
								},
								{
									$addFields: {
										brandId: {
											$arrayElemAt: ['$productInfo.brandId', 0],
										},
									},
								},
							],
							as: 'faktorItems',
						},
					},
					{
						$unwind: {
							path: '$faktorItems',
						},
					},
					...(brandList.length
						? [
								{
									$match: Object.assign({ 'faktorItems.brandId': { $in: brandList }, }),
								},
						  ]
						: []),
					...(ProductList.length
						? [
								{
									$match: Object.assign({ 'faktorItems.sku': { $in: ProductList } }),
								},
						  ]
						: []),
				];
				return faktorModel.aggregate(faktorAggregation);
			})
			.then((faktors) => {
				let totalPrice = 0;
				let totalCount = 0;
				for (let i = 0; i < faktors.length; i++) {
					const thisFaktor = faktors[i];
					const price = parseInt(thisFaktor.faktorItems.netPrice);
					const count = parseInt(thisFaktor.faktorItems.count);
					const userIndex = data.findIndex((item) => item.id === thisFaktor.manageId);
					if (userIndex !== -1) {
						totalPrice += price;
						totalCount += count;
						data[userIndex].price += price;
						data[userIndex].count += count;
					}
				}
				return resolve({
					data,
					totalPrice,
					totalCount,
				});
			})
			.catch((err) => {
				console.log(err);
				return resolve({
					data: [],
					totalPrice: 0,
					totalCount: 0,
				});
			});
	});
};

const getMarketTotalCountAndTotalPrice = (requestCondition) => {
	return new Promise(async (resolve, reject) => {
		try {
			const { date = {}, requestedUserIds = [], brandList = [], ProductList = [], step } = requestCondition;
			const { dateFrom = [], dateTo = [] } = date;
			const fromDate = getFromDate(dateFrom);
			const toDate = getToDate(dateTo);
			const marketUsers = await getUserIdsByProfileCode(['market', 'marketadmin'], requestedUserIds);
			const marketUsersIds = marketUsers.map((i) => `${i._id}`);
			const usersData = marketUsers.map((item) => {
				return {
					id: `${item._id}`,
					name: item.cName,
					username: item.username,
					count: 0,
					price: 0,
				};
			});
			const marketMatchCondition = {
				initDate: {
					$gte: new Date(fromDate),
					$lte: new Date(toDate),
				},
				cartItems: { $ne: [] },
				manageId: { $in: marketUsersIds },
			};
			if (requestedUserIds.length) {
				marketMatchCondition.manageId = { $in: requestedUserIds };
			}
			// if (brandList.length) {
			// 	marketMatchCondition['cartItems.brandId'] = { $in: brandList };
			// }
			// if (ProductList.length) {
			// 	marketMatchCondition['cartItems.sku'] = { $in: ProductList };
			// }
			let tempLookup;
			if (step) {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: step,
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $eq: ['$taskStep', step] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			} else {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: 'quote',
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $ne: ['$taskStep', 'quote'] }, { $ne: ['$taskStep', 'cancel'] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			}
			const marketAggregation = [
				{
					$match: marketMatchCondition,
				},
				{
					$lookup: tempLookup,
				},
				{
					$match: {
						taskInfo: {
							$ne: [],
						},
					},
				},
				{
					$unwind: {
						path: '$cartItems',
					},
				},
				...(ProductList.length
					? [
							{
								$match: Object.assign({ 'cartItems.sku': { $in: ProductList } }),
							},
					  ]
					: []),
				{
					$lookup: {
						from: 'products',
						localField: 'cartItems.sku',
						foreignField: 'sku',
						as: 'productInfo',
					}
				},
				{
					$addFields: {
						brandId: {
							$arrayElemAt: ['$productInfo.brandId', 0],
						},
					},
				},
				...(brandList.length
					? [
							{
								$match: Object.assign({ brandId: { $in: brandList } }),
							},
					  ]
					: []),
			];
			const marketReportList = await cartModel.aggregate(marketAggregation);
			let totalPrice = 0;
			let totalCount = 0;
			for (let i = 0; i < marketReportList.length; i++) {
				const thisCart = marketReportList[i];
				let priceByPayValue = thisCart.cartItems.price;
				if (Array.isArray(thisCart.cartItems.price)) {
					priceByPayValue = thisCart.cartItems.price.find((p) => p.saleType === thisCart.payValue);
				}
				const price = priceByPayValue ? parseInt(priceByPayValue.price) : 0;
				const tempCount = parseInt(thisCart.cartItems.count);
				const thisCartTotalPrice = price * tempCount; // TODO: discount is not calculated
				const userIndex = usersData.findIndex((item) => item.id === thisCart.manageId);
				if (userIndex !== -1) {
					totalPrice += thisCartTotalPrice;
					totalCount += tempCount;
					usersData[userIndex].count += tempCount;
					usersData[userIndex].price += thisCartTotalPrice;
				}
			}
			return resolve({
				data: usersData,
				totalPrice,
				totalCount,
			});
		} catch (error) {
			console.log(error);
			return resolve({
				data: [],
				totalPrice: 0,
				totalCount: 0,
			});
		}
	});
}

const getInnerSaleTotalCountAndTotalPrice = (requestCondition) => {
	return new Promise(async (resolve, reject) => {
		try {
			const { date = {}, requestedUserIds = [], brandList = [], ProductList = [], step } = requestCondition;
			const { dateFrom = [], dateTo = [] } = date;
			const fromDate = getFromDate(dateFrom);
			const toDate = getToDate(dateTo);
			const fetchedUsers = await getUserIdsByProfileCode(['innerSale'], requestedUserIds);
			const fetchedUsersId = fetchedUsers.map((i) => `${i._id}`);
			const usersData = fetchedUsers.map((item) => {
				return {
					id: `${item._id}`,
					name: item.cName,
					username: item.username,
					count: 0,
					price: 0,
				};
			});
			const marketMatchCondition = {
				initDate: {
					$gte: new Date(fromDate),
					$lte: new Date(toDate),
				},
				cartItems: { $ne: [] },
				manageId: { $in: fetchedUsersId },
			};
			if (requestedUserIds.length) {
				marketMatchCondition.manageId = { $in: requestedUserIds };
			}
			// if (brandList.length) {
			// 	marketMatchCondition['cartItems.brandId'] = { $in: brandList };
			// }
			// if (ProductList.length) {
			// 	marketMatchCondition['cartItems.sku'] = { $in: ProductList };
			// }
			let tempLookup;
			if (step) {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: step,
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $eq: ['$taskStep', step] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			} else {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: 'quote',
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $ne: ['$taskStep', 'quote'] }, { $ne: ['$taskStep', 'cancel'] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			}
			const marketAggregation = [
				{
					$match: marketMatchCondition,
				},
				{
					$lookup: tempLookup,
				},
				{
					$match: {
						taskInfo: {
							$ne: [],
						},
					},
				},
				{
					$unwind: {
						path: '$cartItems',
					},
				},
				...(ProductList.length
					? [
							{
								$match: Object.assign({ 'cartItems.sku': { $in: ProductList } }),
							},
					  ]
					: []),
				{
					$lookup: {
						from: 'products',
						localField: 'cartItems.sku',
						foreignField: 'sku',
						as: 'productInfo',
					}
				},
				{
					$addFields: {
						brandId: {
							$arrayElemAt: ['$productInfo.brandId', 0],
						},
					},
				},
				...(brandList.length
					? [
							{
								$match: Object.assign({ brandId: { $in: brandList } }),
							},
					  ]
					: []),
			];
			const reportList = await cartModel.aggregate(marketAggregation);
			let totalPrice = 0;
			let totalCount = 0;
			for (let i = 0; i < reportList.length; i++) {
				const thisCart = reportList[i];
				let priceByPayValue = thisCart.cartItems.price;
				if (Array.isArray(thisCart.cartItems.price)) {
					priceByPayValue = thisCart.cartItems.price.find((p) => p.saleType === thisCart.payValue);
				}
				const price = priceByPayValue ? parseInt(priceByPayValue.price) : 0;
				const tempCount = parseInt(thisCart.cartItems.count);
				const thisCartTotalPrice = price * tempCount; // TODO: discount is not calculated
				const userIndex = usersData.findIndex((item) => item.id === thisCart.manageId);
				if (userIndex !== -1) {
					totalPrice += thisCartTotalPrice;
					totalCount += tempCount;
					usersData[userIndex].count += tempCount;
					usersData[userIndex].price += thisCartTotalPrice;
				}
			}
			return resolve({
				data: usersData,
				totalPrice,
				totalCount,
			});
		} catch (error) {
			console.log(error);
			return resolve({
				data: [],
				totalPrice: 0,
				totalCount: 0,
			});
		}
	});
}

const getBrandsPriceAndCount = (requestBody) => {
	return new Promise(async (resolve, reject) => {
		try {
			// {name: "سرکان", brandId: "19", count: 491, price: 731760948}
			const { date = {}, brandList = [], ProductList = [], mainList = [], marketList = [], saleList = [], innerSaleList = [], step } = requestBody;
			const { dateFrom = [], dateTo = [] } = date;
			const mainListIds = mainList.map((i) => i.id);
			const fromDate = getFromDate(dateFrom);
			const toDate = getToDate(dateTo);
			const brandsCondition = {};
			if (brandList.length) {
				brandsCondition.brandCode = { $in: brandList.map((i) => i.id) };
			}
			const brandsList = await brandModel.find(brandsCondition).sort({ title: -1 }).lean();
			const brandData = brandsList.map((i) => {
				return {
					id: i.brandCode,
					name: i.title,
					count: 0,
					price: 0,
				}
			});
			const brandsMatchConditionInTasks = {
				initDate: {
					$gte: new Date(fromDate),
					$lte: new Date(toDate),
				},
				cartItems: { $ne: [] },
			};
			if (mainListIds.includes('marketList')) {
				if (marketList.length) {
					const marketListIds = marketList.map((i) => i.id);
					brandsMatchConditionInTasks.manageId = { $in: marketListIds };
				} else {
					const users = await getUserIdsByProfileCode(['market', 'marketadmin']);
					const userIds = users.length ? users.map((i) => `${i._id}`) : [];
					brandsMatchConditionInTasks.manageId = { $in: userIds };
				}
			}
			if (mainListIds.includes('innerSaleList')) {
				if (innerSaleList.length) {
					const innerSaleListIds = innerSaleList.map((i) => i.id);
					brandsMatchConditionInTasks.manageId = { $in: innerSaleListIds };
				} else {
					const users = await getUserIdsByProfileCode(['innerSale']);
					const userIds = users.length ? users.map((i) => `${i._id}`) : [];
					brandsMatchConditionInTasks.manageId = { $in: userIds };
				}
			}
			let tempLookup;
			if (step) {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: step,
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $eq: ['$taskStep', step] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			} else {
				tempLookup = {
					from: 'tasks',
					let: {
						cart_no: '$cartNo',
						// archiveTaskStep: 'quote',
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $ne: ['$taskStep', 'quote'] }, { $ne: ['$taskStep', 'cancel'] }],
								},
							},
						},
					],
					as: 'taskInfo',
				};
			}
			const brandsAggregationInTasks = [
				{
					$match: brandsMatchConditionInTasks,
				},
				{
					$lookup: tempLookup,
				},
				{
					$match: {
						taskInfo: {
							$ne: [],
						},
					},
				},
				{
					$unwind: {
						path: '$cartItems',
					},
				},
				...(ProductList.length
					? [
							{
								$match: Object.assign({ 'cartItems.sku': { $in: ProductList } }),
							},
					  ]
					: []),
				{
					$lookup: {
						from: 'products',
						localField: 'cartItems.sku',
						foreignField: 'sku',
						as: 'productInfo',
					},
				},
				{
					$addFields: {
						brandId: {
							$arrayElemAt: ['$productInfo.brandId', 0],
						},
					},
				},
				...(brandList.length
					? [
							{
								$match: Object.assign({ brandId: { $in: brandList.map((i) => i.id) } }),
							},
					  ]
					: []),
			];
			const brandsMatchConditionInFaktors = {
				initDate: {
					$gte: new Date(fromDate),
					$lte: new Date(toDate),
				},
			};
			if (mainListIds.includes('saleList')) {
				if (saleList.length) {
					const saleListIds = saleList.map((i) => i.id);
					brandsMatchConditionInFaktors.manageId = { $in: saleListIds };
				} else {
					const users = await getUserIdsByProfileCode(['sale']);
					const userIds = users.length ? users.map((i) => `${i._id}`) : [];
					brandsMatchConditionInFaktors.manageId = { $in: userIds };
				}
			}
			const brandsAggregationInFaktors = [
				{ $match: brandsMatchConditionInFaktors },
				{
					$lookup: {
						from: 'faktoritems',
						let: {
							localField: '$InvoiceNumber',
						},
						pipeline: [
							{
								$match: {
									$expr: {
										$eq: ['$InvoiceNumber', '$$localField'],
									// 	$and: [{ $eq: ['$orderNo', '$$cart_no'] }, { $eq: ['$taskStep', '$$archiveTaskStep'] }],
									},
								},
							},
							{
								$lookup: {
									from: 'products',
									localField: 'sku',
									foreignField: 'sku',
									as: 'productInfo',
								},
							},
							{
								$addFields: {
									brandId: {
										$arrayElemAt: ['$productInfo.brandId', 0],
									},
								},
							},
						],
						as: 'faktorItems',
					},
				},
				{
					$unwind: {
						path: '$faktorItems',
					},
				},
				...(brandList.length
					? [
							{
								$match: Object.assign({ 'faktorItems.brandId': { $in: brandList.map((i) => i.id) } }),
							},
					  ]
					: []),
				...(ProductList.length
					? [
							{
								$match: Object.assign({ 'faktorItems.sku': { $in: ProductList } }),
							},
					  ]
					: []),
			];
			let promise1;
			let promise2;
			if (!mainListIds.length) {
				promise1 = cartModel.aggregate(brandsAggregationInTasks);
				promise2 = faktorModel.aggregate(brandsAggregationInFaktors);
			} else {
				if (mainListIds.includes('marketList') || mainListIds.includes('innerSaleList')) {
					promise1 = cartModel.aggregate(brandsAggregationInTasks);
					promise2 = Promise.resolve([]);
				} else {
					promise1 = Promise.resolve([]);
					promise2 = faktorModel.aggregate(brandsAggregationInFaktors);
				}
			}
			const [brandsReportInTasks, brandsReportInFaktors] = await Promise.all([
				// cartModel.aggregate(brandsAggregationInTasks),
				// faktorModel.aggregate(brandsAggregationInFaktors)
				promise1,
				promise2,
			]);
			let totalPrice = 0;
			let totalCount = 0;
			for (let i = 0; i < brandsReportInTasks.length; i++) {
				const thisCart = brandsReportInTasks[i];
				let priceByPayValue = thisCart.cartItems.price;
				if (Array.isArray(thisCart.cartItems.price)) {
					priceByPayValue = thisCart.cartItems.price.find((p) => p.saleType === thisCart.payValue);
				}
				const price = priceByPayValue ? parseInt(priceByPayValue.price) : 0;
				const tempCount = parseInt(thisCart.cartItems.count);
				const thisCartTotalPrice = price * tempCount; // TODO: discount is not calculated
				const userIndex = brandData.findIndex((item) => item.id === thisCart.brandId);
				if (userIndex !== -1) {
					totalPrice += thisCartTotalPrice;
					totalCount += tempCount;
					brandData[userIndex].count += tempCount;
					brandData[userIndex].price += thisCartTotalPrice;
				}
			}
			for (let i = 0; i < brandsReportInFaktors.length; i++) {
				const thisFaktor = brandsReportInFaktors[i];
				const price = parseInt(thisFaktor.faktorItems.netPrice);
				const count = parseInt(thisFaktor.faktorItems.count);
				const userIndex = brandData.findIndex((item) => item.id === thisFaktor.faktorItems.brandId);
				if (userIndex !== -1) {
					totalPrice += price;
					totalCount += count;
					brandData[userIndex].price += price;
					brandData[userIndex].count += count;
				}
			}
			return resolve({
				brandData,
				totalPrice,
				totalCount,
			});
		} catch (error) {
			console.log(error);
			return resolve({
				brandData: [],
				totalPrice: 0,
				totalCount: 0,
			});
		}
	});
};

const customersListController = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, date = {}, brandList = [], ProductList = [], mainList = [], marketList = [], saleList = [], innerSaleList = [], step } = req.body;
		const { dateFrom = [], dateTo = [] } = date;
		const fromDate = getFromDate(dateFrom);
		const toDate = getToDate(dateTo);
		const limit = parseInt(pageSize);
		const skip = parseInt(offset);
		if (!mainList.length) {
			return res.send({
				size: 0,
				userList: [],
			});
		}
		const faktorsMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
		};
		const cartsMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
		};
		// if (ProductList.length) {
		// 	cartsMatchCondition['cartItems.sku'] = { $in: ProductList };
		// }
		const mainListIds = mainList.map((i) => i.id);
		if (mainListIds.includes('marketList')) {
			if (marketList.length) {
				const marketListIds = marketList.map((i) => i.id);
				cartsMatchCondition.manageId = { $in: marketListIds };
			} else {
				const users = await getUserIdsByProfileCode(['market', 'marketadmin']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				cartsMatchCondition.manageId = { $in: userIds };
			}
		} else if (mainListIds.includes('saleList')) {
			if (saleList.length) {
				const saleListIds = saleList.map((i) => i.id);
				faktorsMatchCondition.manageId = { $in: saleListIds };
			} else {
				const users = await getUserIdsByProfileCode(['sale']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				faktorsMatchCondition.manageId = { $in: userIds };
			}
		} else if (mainListIds.includes('innerSaleList')) {
			if (innerSaleList.length) {
				const innerSaleListIds = innerSaleList.map((i) => i.id);
				cartsMatchCondition.manageId = { $in: innerSaleListIds };
			} else {
				const users = await getUserIdsByProfileCode(['innerSale']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				cartsMatchCondition.manageId = { $in: userIds };
			}
		}
		const cartsAggregation = [
			{ $match: cartsMatchCondition },
			{
				$lookup: {
					from: 'tasks',
					localField: 'cartNo',
					foreignField: 'orderNo',
					as: 'taskInfo',
				},
			},
			{
				$match: {
					$and: [{ taskInfo: { $ne: [] } }, { 'taskInfo.taskStep': step ? { $eq: step } : { $nin: ['quote', 'cancel'] } }],
				},
			},
			{
				$unwind: {
					path: '$cartItems',
				},
			},
			...(ProductList.length
				? [
						{
							$match: Object.assign({ 'cartItems.sku': { $in: ProductList } }),
						},
				  ]
				: []),
			{
				$lookup: {
					from: 'products',
					localField: 'cartItems.sku',
					foreignField: 'sku',
					as: 'productInfo',
				},
			},
			{
				$addFields: {
					'cartItems.brandId': {
						$arrayElemAt: ['$productInfo.brandId', 0],
					},
				},
			},
			...(brandList.length
				? [
						{
							$match: Object.assign({ 'cartItems.brandId': { $in: brandList.map((i) => i.id) } }),
						},
				  ]
				: []),
			// { $sort: { initDate: -1 } },
			{
				$group: {
					_id: '$_id',
					userId: {
						$addToSet: '$userId',
					},
				},
			},
			{ $sort: { _id: -1 } },
			{
				$addFields: {
					userId: {
						$toObjectId: {
							$arrayElemAt: ['$userId', 0],
						},
					},
				},
			},
			{
				$facet: {
					totalSize: [{ $count: 'totalSize' }],
					result: [
						{
							$lookup: {
								from: 'customers',
								localField: 'userId',
								foreignField: '_id',
								as: 'userInfo',
							},
						},
						{ $skip: skip },
						{ $limit: limit },
					],
				},
			},
		];
		const faktorsAggregation = [
			{ $match: faktorsMatchCondition },
			{
				$lookup: {
					from: 'faktoritems',
					localField: 'InvoiceNumber',
					foreignField: 'InvoiceNumber',
					as: 'faktorItems',
				},
			},
			{
				$unwind: {
					path: '$faktorItems',
				},
			},
			{
				$lookup: {
					from: 'products',
					localField: 'faktorItems.sku',
					foreignField: 'sku',
					as: 'product',
				},
			},
			{
				$addFields: {
					'faktorItems.brandId': {
						$arrayElemAt: ['$product.brandId', 0],
					},
				},
			},
			...(brandList.length
				? [
						{
							$match: Object.assign({ 'faktorItems.brandId': { $in: brandList.map((i) => i.id) } }),
						},
				  ]
				: []),
			...(ProductList.length
				? [
						{
							$match: Object.assign({ 'faktorItems.sku': { $in: ProductList } }),
						},
				  ]
				: []),
			// {$sort: {
			// 	initDate: -1
			//   }},
			{
				$group: {
					_id: '$_id',
					userId: {
						$addToSet: '$userId',
					},
				},
			},
			{ $sort: { _id: -1 } }, // TODO: check this sort
			{
				$addFields: {
					userId: {
						$toObjectId: {
							$arrayElemAt: ['$userId', 0],
						},
					},
				},
			},
			{
				$facet: {
					totalSize: [{ $count: 'totalSize' }],
					result: [
						{
							$lookup: {
								from: 'customers',
								localField: 'userId',
								foreignField: '_id',
								as: 'userInfo',
							},
						},
						{ $skip: skip },
						{ $limit: limit },
					],
				},
			},
		];
		// const [aggregationResult] = await cartModel.aggregate(cartsAggregation);
		let promise;
		if (mainListIds.includes('marketList') || mainListIds.includes('innerSaleList')) {
			promise = cartModel.aggregate(cartsAggregation);
		} else {
			promise = faktorModel.aggregate(faktorsAggregation);
		}
		const [aggregationResult] = await promise.exec();
		const size = aggregationResult?.totalSize[0]?.totalSize || 0;
		const reportList = aggregationResult?.result || [];
		const userList = reportList.map((i) => {
			return {
				id: i.userId,
				...i.userInfo[0],
			}
		});
		return res.json({
			size,
			userList,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const productsListController = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, date = {}, brandList = [], ProductList = [], mainList = [], marketList = [], saleList = [], innerSaleList = [], step } = req.body;
		const { dateFrom = [], dateTo = [] } = date;
		const fromDate = getFromDate(dateFrom);
		const toDate = getToDate(dateTo);
		const limit = parseInt(pageSize);
		const skip = parseInt(offset);

		if (!mainList.length) {
			return res.send({
				size: 0,
				data: [],
			});
		}
		const faktorsMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
		};
		const cartsMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
		};
		// if (ProductList.length) {
		// 	cartsMatchCondition['cartItems.sku'] = { $in: ProductList };
		// }
		const mainListIds = mainList.map((i) => i.id);
		if (mainListIds.includes('marketList')) {
			if (marketList.length) {
				const marketListIds = marketList.map((i) => i.id);
				cartsMatchCondition.manageId = { $in: marketListIds };
			} else {
				const users = await getUserIdsByProfileCode(['market', 'marketadmin']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				cartsMatchCondition.manageId = { $in: userIds };
			}
		} else if (mainListIds.includes('saleList')) {
			if (saleList.length) {
				const saleListIds = saleList.map((i) => i.id);
				faktorsMatchCondition.manageId = { $in: saleListIds };
			} else {
				const users = await getUserIdsByProfileCode(['sale']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				faktorsMatchCondition.manageId = { $in: userIds };
			}
		} else if (mainListIds.includes('innerSaleList')) {
			if (innerSaleList.length) {
				const innerSaleListIds = innerSaleList.map((i) => i.id);
				cartsMatchCondition.manageId = { $in: innerSaleListIds };
			} else {
				const users = await getUserIdsByProfileCode(['innerSale']);
				const userIds = users.length ? users.map((i) => `${i._id}`) : [];
				cartsMatchCondition.manageId = { $in: userIds };
			}
		}

		const cartsAggregation = [
			{ $match: cartsMatchCondition },
			{
				$lookup: {
					from: 'tasks',
					localField: 'cartNo',
					foreignField: 'orderNo',
					as: 'taskInfo',
				},
			},
			{
				$match: {
					$and: [{ taskInfo: { $ne: [] } }, { 'taskInfo.taskStep': step ? { $eq: step } : { $nin: ['quote', 'cancel'] } }],
				},
			},
			{
				$unwind: {
					path: '$cartItems',
				},
			},
			...(ProductList.length
				? [
						{
							$match: Object.assign({ 'cartItems.sku': { $in: ProductList } }),
						},
				  ]
				: []),
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
					from: 'products',
					localField: 'cartItems.sku',
					foreignField: 'sku',
					as: 'product',
				},
			},
			{
				$addFields: {
					brandId: {
						$arrayElemAt: ['$product.brandId', 0],
					},
				},
			},
			...(brandList.length
				? [
						{
							$match: Object.assign({ brandId: { $in: brandList.map((i) => i.id) } }),
						},
				  ]
				: []),
			{
				$lookup: {
					from: 'brands',
					localField: 'brandId',
					foreignField: 'brandCode',
					as: 'brandData',
				},
			},
			{
				$group: {
					_id: '$cartItems.sku',
					list: {
						$push: '$$ROOT',
					},
				},
			},
			{ $sort: { _id: 1 } },
			{
				$facet: {
					totalSize: [
						{ $count: 'totalSize'},
					],
					result: [
						{ $skip: skip },
						{ $limit: limit },
					]
				}
			},
		];
		const faktorsAggregation = [
			{ $match: faktorsMatchCondition },
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
					from: 'faktoritems',
					localField: 'InvoiceNumber',
					foreignField: 'InvoiceNumber',
					as: 'faktorItems',
				},
			},
			{
				$unwind: {
					path: '$faktorItems',
				},
			},
			{
				$lookup: {
					from: 'products',
					localField: 'faktorItems.sku',
					foreignField: 'sku',
					as: 'product',
				},
			},
			// {
			// 	$lookup: {
			// 		from: 'productprices',
			// 		localField: 'faktorItems.ItemID',
			// 		foreignField: 'ItemID',
			// 		as: 'price',
			// 	},
			// },
			{
				$addFields: {
					'faktorItems.brandId': {
						$arrayElemAt: ['$product.brandId', 0],
					},
				}
			},
			...(brandList.length
				? [
						{
							$match: Object.assign({ 'faktorItems.brandId': { $in: brandList.map((i) => i.id) } }),
						},
				  ]
				: []),
			...(ProductList.length
				? [
						{
							$match: Object.assign({ 'faktorItems.sku': { $in: ProductList } }),
						},
					]
				: []),
			{
				$lookup: {
					from: 'brands',
					localField: 'faktorItems.brandId',
					foreignField: 'brandCode',
					as: 'brandData',
				},
			},
			{
				$group: {
					_id: '$faktorItems.sku',
					list: {
						$push: '$$ROOT',
					},
				},
			},
			{ $sort: { _id: 1 } },
			{
				$facet: {
					totalSize: [
						{ $count: 'totalSize'},
					],
					result: [
						{ $skip: skip },
						{ $limit: limit },
					]
				}
			},
		];
		let promise;
		if (mainListIds.includes('marketList') || mainListIds.includes('innerSaleList')) {
			promise = cartModel.aggregate(cartsAggregation);
		} else {
			promise = faktorModel.aggregate(faktorsAggregation);
		}
		const [aggregationResult] = await promise.exec();

		const size = aggregationResult?.totalSize[0]?.totalSize || 0;
		const reportList = aggregationResult?.result || [];
		const prepareCartsResult = (i) => {
			const thisCartItem = i.list[0];
			const temp = {
				id: i._id,
				count: 0,
				totalPrice: 0,
				orderList: [],
				sku: thisCartItem.cartItems.sku,
				title: thisCartItem.cartItems.title,
				product: thisCartItem.product[0],
				// price: thisCartItem.cartItems.price,
				brandData: thisCartItem.brandData[0],
			};
			i.list.forEach((item) => {
				let priceByPayValue = item.cartItems.price;
				if (Array.isArray(item.cartItems.price)) {
					priceByPayValue = item.cartItems.price.find((p) => p.saleType === item.payValue);
				}
				const price = priceByPayValue ? parseInt(priceByPayValue.price) : 0;
				const tempCount = parseInt(item.cartItems.count);
				temp.count += tempCount;
				temp.totalPrice += price * tempCount;
				// if (!item.userInfo[0]) {
				// 	console.log()
				// }
				temp.orderList.push({
					title: item.cartNo,
					count: tempCount,
					user: item.userInfo[0]?.username || '',
				});
			});
			return temp;
		};
		const prepareFaktorsResult = (i) => {
			const thisFaktor = i.list[0];
			const temp = {
				id: i._id,
				count: 0,
				totalPrice: 0,
				orderList: [],
				sku: thisFaktor.faktorItems.sku,
				title: thisFaktor.product[0].title,
				product: thisFaktor.product[0],
				// price: thisFaktor.price,
				brandData: thisFaktor.brandData[0],
			};
			i.list.forEach((item) => {
				const thisItem = item.faktorItems;
				const price = parseInt(thisItem.netPrice);
				const tempCount = parseInt(thisItem.count);
				temp.count += tempCount;
				temp.totalPrice += price;
				temp.orderList.push({
					title: item.InvoiceNumber,
					count: tempCount,
					user: item.userInfo[0]?.username || '',
				});
			});
			return temp;
		};
		const sortList = mainListIds.includes('marketList') || mainListIds.includes('innerSaleList')
			? reportList.map(prepareCartsResult)
			: reportList.map(prepareFaktorsResult);
		return res.send({
			size,
			data: sortList,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportTotalBrandsController = async (req, res) => {
	try {
		const brandsIds = req.body.brandList?.length ? req.body.brandList.map((i) => i.id) : [];
		req.body.brandList = brandsIds;
		const { brandData, totalPrice, totalCount } = await getBrandsPriceAndCount(req.body);
		return res.send({
			brandData,
			totalPrice,
			totalCount,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportTotalMarketController = async (req, res) => {
	try {
		const { manageId, date = {}, brandList = [], ProductList = [] } = req.body;
		const {dateFrom = [], dateTo = []} = date;
		const { data, totalPrice, totalCount } = await getMarketTotalCountAndTotalPrice({ dateFrom, dateTo, manageId, brandList, ProductList });
		return res.send({
			data,
			totalPrice,
			totalCount,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportTotalWebController = async (req, res) => {
	try {
		const { manageId, dateFrom = [], dateTo = [] } = req.body;
		const { totalPrice, totalCount } = await getFaktorsTotalCountAndTotalPrice({
			isWeb: true,
			dateFrom,
			dateTo,
		});
		return res.send({
			totalPrice,
			totalCount,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportTotalSaleController = async (req, res) => {
	try {
		const { manager, dateFrom = [], dateTo = [] } = req.body;
		const { totalPrice, totalCount } = await getFaktorsTotalCountAndTotalPrice({
			dateFrom,
			dateTo,
			profileCode: 'sale',
			requestedUsername: manager,
		});
		return res.send({
			totalPrice,
			totalCount,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportTotalInnerSaleController = async (req, res) => {
	try {
		const { manager, dateFrom = [], dateTo = [] } = req.body;
		const { totalPrice, totalCount } = await getInnerSaleTotalCountAndTotalPrice({
			dateFrom,
			dateTo,
			profileCode: 'innerSale',
			requestedUsername: manager,
		});
		return res.send({
			totalPrice,
			totalCount,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportFiltersListController = async (req, res) => {
	try {
		const mainList = [
			{ name: 'ویزیتور', id: 'marketList' },
			{ name: 'فروش', id: 'saleList' },
			{ name: 'فروش داخلی', id: 'innerSaleList' },
			{ name: 'سایت', id: 'webList' },
		];
		const [brandList, marketProfiles, saleProfiles, innerSaleProfiles] = await Promise.all([
			brandModel.find().sort({ title: -1 }).lean(),
			getUserIdsByProfileCode(['market', 'marketadmin']),
			getUserIdsByProfileCode(['sale']),
			getUserIdsByProfileCode(['innerSale']),
		]);
		const marketList = !marketProfiles.length ? [] : marketProfiles.map((i) => {
			return {
				id: i._id,
				username: i.username,
			}
		});
		const saleList = !saleProfiles.length ? [] : saleProfiles.map((i) => {
			return {
				id: i._id,
				username: i.username,
			}
		});
		const innerSaleList = !innerSaleProfiles.length ? [] : innerSaleProfiles.map((i) => {
			return {
				id: i._id,
				username: i.username,
			}
		});
		const response = {
			brandList: brandList.map((i) => {
				return {
					id: i.brandCode,
					title: i.title,
				}
			}),
			mainList,
			marketList,
			saleList,
			innerSaleList,
		};
		return res.send(response);
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

const reportCommissionController = async (req, res) => {
	try {
		const { date = {}, manageId = '', profileType } = req.body;
		const { dateFrom = [], dateTo = [] } = date;
		const marketList = ['market', 'marketadmin', 'innerSale'];
		const fromDate = getFromDate(dateFrom, 'jMonth');
		const toDate = getToDate(dateTo, 'jMonth');
		const saleCommissionGroups = await saleCommissionGroupModel.find({}).lean();
		const commissionInfo = saleCommissionGroups.map((item) => {
			return {
				id: `${item._id}`,
				name: item.name,
				count: 0,
				price: 0,
				commission: 0,
			};
		});
		if (!manageId) {
			return res.send({ commissionInfo });
		}
		const marketMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
			cartItems: { $ne: [] },
			manageId,
		};
		const cartsAggregation = [
			{
				$match: marketMatchCondition,
			},
			{
				$lookup: {
					from: 'tasks',
					localField: 'cartNo',
					foreignField: 'orderNo',
					as: 'taskInfo',
				},
			},
			{
				$match: {
					$and: [{ taskInfo: { $ne: [] } }, { 'taskInfo.taskStep': { $eq: 'archive' } }],
				},
			},
			{
				$unwind: {
					path: '$cartItems',
				},
			},
			{
				$lookup: {
					from: 'products',
					localField: 'cartItems.sku',
					foreignField: 'sku',
					as: 'productInfo',
				},
			},
			{
				$addFields: {
					saleCommissionGroupId: {
						$arrayElemAt: ['$productInfo.saleCommissionGroupId', 0],
					},
				},
			},
			{
				$lookup: {
					from: 'salecommissiongroups',
					localField: 'saleCommissionGroupId',
					foreignField: '_id',
					as: 'saleCommissionGroupInfo',
				},
			},
			{
				$addFields: {
					'cartItems.commissionPercentage': {
						$cond: {
							if: {
								$eq: ['$saleCommissionGroupId', null],
							},
							then: 0,
							else: {
								$arrayElemAt: ['$saleCommissionGroupInfo.percentage', 0],
							},
						},
					},
				},
			},
		];
		const faktorsMatchCondition = {
			initDate: {
				$gte: new Date(fromDate),
				$lte: new Date(toDate),
			},
			isWeb: false,
			manageId,
		};
		const faktorsAggregation = [
			{ $match: faktorsMatchCondition },
			{
				$lookup: {
					from: 'faktoritems',
					localField: 'InvoiceNumber',
					foreignField: 'InvoiceNumber',
					as: 'faktorItems',
				},
			},
			{
				$unwind: {
					path: '$faktorItems',
				},
			},
			{
				$lookup: {
					from: 'products',
					localField: 'faktorItems.sku',
					foreignField: 'sku',
					as: 'productInfo',
				},
			},
			{
				$addFields: {
					saleCommissionGroupId: {
						$arrayElemAt: ['$productInfo.saleCommissionGroupId', 0],
					},
				},
			},
			{
				$lookup: {
					from: 'salecommissiongroups',
					localField: 'saleCommissionGroupId',
					foreignField: '_id',
					as: 'saleCommissionGroupInfo',
				},
			},
			{
				$addFields: {
					'faktorItems.commissionPercentage': {
						$cond: {
							if: {
								$eq: ['$saleCommissionGroupId', null],
							},
							then: 0,
							else: {
								$arrayElemAt: ['$saleCommissionGroupInfo.percentage', 0],
							},
						},
					},
				},
			},
		];
		const marketReportList = await cartModel.aggregate(cartsAggregation);
		let promise;
		if (marketList.includes(profileType)) {
			promise = cartModel.aggregate(cartsAggregation);
		} else {
			promise = faktorModel.aggregate(faktorsAggregation);
		}
		const reportList = await promise.exec();
		let totalPrice = 0;
		let totalCount = 0;
		let totalCommission = 0;
		if (marketList.includes(profileType)) {
			for (let i = 0; i < reportList.length; i++) {
				const thisCart = reportList[i];
				let priceByPayValue = thisCart.cartItems.price;
				if (Array.isArray(thisCart.cartItems.price)) {
					priceByPayValue = thisCart.cartItems.price.find((p) => p.saleType === thisCart.payValue);
				}
				const price = priceByPayValue ? parseInt(priceByPayValue.price) : 0;
				const tempCount = parseInt(thisCart.cartItems.count);
				const thisCartTotalPrice = price * tempCount; // TODO: discount is not calculated
				const commission = thisCart.cartItems.commissionPercentage ? thisCartTotalPrice * (thisCart.cartItems.commissionPercentage / 100) : 0;
				const itemIndex = commissionInfo.findIndex((item) => item.id === `${thisCart.saleCommissionGroupId}`);
				totalPrice += thisCartTotalPrice;
				totalCount += tempCount;
				totalCommission += commission;
				if (itemIndex !== -1) {
					commissionInfo[itemIndex].count += tempCount;
					commissionInfo[itemIndex].price += thisCartTotalPrice;
					commissionInfo[itemIndex].commission += commission;
				}
			}
		} else {
			for (let i = 0; i < reportList.length; i++) {
				const thisFaktor = reportList[i];
				const tempCount = parseInt(thisFaktor.faktorItems.count);
				const thisFaktorTotalPrice = parseInt(thisFaktor.faktorItems.netPrice);
				const commission = thisFaktor.faktorItems.commissionPercentage ? thisFaktorTotalPrice * (thisFaktor.faktorItems.commissionPercentage / 100) : 0;
				const itemIndex = commissionInfo.findIndex((item) => item.id === `${thisFaktor.saleCommissionGroupId}`);
				totalPrice += thisFaktorTotalPrice;
				totalCount += tempCount;
				totalCommission += commission;
				if (itemIndex !== -1) {
					commissionInfo[itemIndex].count += tempCount;
					commissionInfo[itemIndex].price += thisFaktorTotalPrice;
					commissionInfo[itemIndex].commission += commission;
				}
			}
		}
		return res.send({
			totalPrice,
			totalCount,
			totalCommission,
			commissionInfo,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).send({ message: error.message });
	};
}

const commissionUsersController = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, profile = '' } = req.body;
		const limit = parseInt(pageSize);
		const skip = parseInt(offset);
		const allProfiles = await profileModel.find().lean();
		const profileCodes = profile ? [profile] : allProfiles.map((i) => i.profileCode);
		const usersMatchCondition = {
			hasCommission: true,
		};
		const usersAggregation = [
			{ $match: usersMatchCondition },
			{
				$unwind: {
					path: '$profile',
				},
			},
			{
				$lookup: {
					from: 'profiles',
					let: {
						localField: { $toObjectId: '$profile' },
						allowedList: profileCodes,
					},
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [{ $eq: ['$_id', '$$localField'] }, { $in: ['$profileCode', '$$allowedList'] }],
								},
							},
						},
					],
					as: 'profileInfo',
				},
			},
			{
				$match: {
					profileInfo: { $ne: [] },
				},
			},
			{
				$addFields: {
					profileInfo: {
						$arrayElemAt: ['$profileInfo', 0],
					},
				},
			},
			...(profile
				? [
						{
							$match: Object.assign({ 'profileInfo.profileCode': { $eq: profile } }),
						},
				  ]
				: []),
			{
				$facet: {
					totalSize: [{ $count: 'totalSize' }],
					result: [{ $skip: skip }, { $limit: limit }],
				},
			},
		];
		const [aggregationResult] = await userModel.aggregate(usersAggregation);
		const size = aggregationResult?.totalSize[0]?.totalSize || 0;
		const targetUsers = aggregationResult?.result || [];
		const users = targetUsers.map((i) => {
			return {
				id: i?._id,
				username: i?.username,
				profileName: i?.profileInfo?.profileName,
				profileCode: i?.profileInfo?.profileCode,
			};
		});
		const response = {
			size,
			users,
		};
		return res.send(response);
	} catch (error) {
		console.log(error);
		return res.status(500).send({ message: error.message });
	}
}

const reportTotalController = async (req, res) => {
	try {
		const { date = {}, brandList = [], ProductList = [], mainList = [], marketList = [], saleList = [], innerSaleList = [], step } = req.body;
		const condition = {
			date,
			isWeb: false,
			step,
		};
		if (brandList.length) {
			const brandsIds = brandList.map((i) => i.id);
			condition.brandList = brandsIds;
		}
		if (ProductList.length) {
			condition.ProductList = ProductList;
		}
		if (!mainList.length) {
			const [market, web, sale, innerSale, brandData] = await Promise.all([
				getMarketTotalCountAndTotalPrice({ ...condition }),
				getFaktorsTotalCountAndTotalPrice({ ...condition, isWeb: true }),
				getFaktorsTotalCountAndTotalPrice({ ...condition, profileCode: 'sale' }),
				getInnerSaleTotalCountAndTotalPrice({ ...condition }),
				getBrandsPriceAndCount(req.body),
			]);
			const totalCount = market.totalCount + web.totalCount + sale.totalCount + innerSale.totalCount;
			const totalPrice = market.totalPrice + web.totalPrice + sale.totalPrice + innerSale.totalPrice;
			const mainChartData = [
				{ name: 'ویزیتور', id: 'marketList', count: market.totalCount, price: market.totalPrice },
				{ name: 'فروش', id: 'saleList', count: sale.totalCount, price: sale.totalPrice },
				{ name: 'فروش داخلی', id: 'innerSaleList', count: innerSale.totalCount, price: innerSale.totalPrice },
				{ name: 'سایت', id: 'webList', count: web.totalCount, price: web.totalPrice },
			];
			return res.send({
				totalCount,
				totalPrice,
				brandsChartData: brandData?.brandData,
				mainChartData,
			});
		}
		const mainListIds = mainList.map((i) => i.id);
		const promises = [];
		if (mainListIds.includes('marketList')) {
			if (marketList.length) {
				const marketListIds = marketList.map((i) => i.id);
				condition.marketList = marketListIds;
				condition.requestedUserIds = marketListIds;
			}
			promises.push(getMarketTotalCountAndTotalPrice(condition));
		} else {
			promises.push(tempPromise());
		}
		if (mainListIds.includes('saleList')) {
			condition.profileCode = 'sale';
			if (saleList.length) {
				const saleListIds = saleList.map((i) => i.id);
				condition.saleList = saleListIds;
				condition.requestedUserIds = saleListIds;
			}
			promises.push(getFaktorsTotalCountAndTotalPrice(condition));
		} else {
			promises.push(tempPromise());
		}
		if (mainListIds.includes('innerSaleList')) {
			// condition.profileCode = 'innerSale';
			if (innerSaleList.length) {
				const innerSaleListIds = innerSaleList.map((i) => i.id);
				condition.innerSaleList = innerSaleListIds;
				condition.requestedUserIds = innerSaleListIds;
			}
			promises.push(getInnerSaleTotalCountAndTotalPrice(condition));
		} else {
			promises.push(tempPromise());
		}
		if (mainListIds.includes('webList')) {
			condition.isWeb = true;
			promises.push(getFaktorsTotalCountAndTotalPrice());
		} else {
			promises.push(tempPromise());
		}
		promises.push(getBrandsPriceAndCount(req.body));

		const [market, sale, innerSale, web, brandData] = await Promise.all(promises);
		let totalCount = 0;
		let totalPrice = 0;
		mainChartData = [];
		if (market) {
			totalCount += market.totalCount;
			totalPrice += market.totalPrice;
			mainChartData = market.data;
		}
		if (sale) {
			totalCount += sale.totalCount;
			totalPrice += sale.totalPrice;
			mainChartData = sale.data;
		}
		if (innerSale) {
			totalCount += innerSale.totalCount;
			totalPrice += innerSale.totalPrice;
			mainChartData = innerSale.data;
		}

		return res.send({
			totalCount,
			totalPrice,
			brandsChartData: brandData.brandData,
			mainChartData,
		});
	} catch (error) {
		console.log(error);
		return res.status(500).json({ message: error.message });
	}
};

router.post('/customers-list', customersListController);

router.post('/products-list', productsListController);

router.post('/report-total-brands', reportTotalBrandsController);

router.post('/report-total-market', reportTotalMarketController);

router.post('/report-total-web', reportTotalWebController);

router.post('/report-total-sale', reportTotalSaleController);

router.post('/report-total-innerSale', reportTotalInnerSaleController);

router.get('/report-filters', reportFiltersListController);

router.post('/commission', reportCommissionController);

router.post('/commission-users', commissionUsersController);

router.post('/report-total', reportTotalController);

module.exports = router;
