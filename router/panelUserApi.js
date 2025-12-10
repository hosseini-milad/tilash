const express = require("express");
const bodyParser = require("body-parser");
const jsonParser = bodyParser.json();
const router = express.Router();
const auth = require("../middleware/auth");
var ObjectID = require("mongodb").ObjectID;
const multer = require("multer");
const fs = require("fs");
const user = require("../models/auth/users");
const customer = require("../models/auth/customers");
const payLog = require("../models/orders/payLog");
const tasks = require("../models/crm/tasks");
const ProfileAccess = require("../models/auth/ProfileAccess");
const orders = require("../models/orders/orders");
const cart = require("../models/product/cart");
const quickCart = require("../models/product/quickCart");
const classes = require("../models/auth/classes");
const Policy = require("../models/auth/Policy");
const category = require("../models/product/category");
const brand = require("../models/product/brand");
const Filters = require("../models/product/Filters");
const factory = require("../models/product/factory");
const crmlist = require("../models/crm/crmlist");
const sepidarPOST = require("../middleware/SepidarPost");
const file = require("../models/product/file");
const salePolicyGroupModel = require('../models/sale/salePolicyGroup');
const products = require('../models/product/products');
const advType = require("../models/auth/advType");
const EnNumber = require("../middleware/enNumber");
const Stocks = require("../models/product/Stocks");
const FindRepeat = require("../middleware/NewModule/FindRepeat");
const quickCartModel = require('../models/product/quickCart');
const userModel = require('../models/auth/users');
const productModel = require('../models/product/products');
const jMoment = require('moment-jalaali');
const salePolicyDependentProductModel = require('../models/sale/salePolicyDependentProducts');
const profileModel = require('../models/auth/ProfileAccess');
const customerModel = require('../models/auth/customers');
const cartModel = require('../models/product/cart');

router.post("/fetch-user", jsonParser, async (req, res) => {
  var pageSize = req.body.pageSize ? req.body.pageSize : "10";
  var userId = req.body.userId;
  try {
    const userData = await user.findOne({ _id: ObjectID(userId) }).lean();
    if (userData) {
      var profile = [];
      try {
        for (
          var p = 0;
          p < (userData.profile && userData.profile.length);
          p++
        ) {
          profile.push(
            await ProfileAccess.findOne({ _id: ObjectID(userData.profile[p]) })
          );
        }

        userData.profileData = profile;
        userData.profileCode = profile.map((item) => item.profileCode);
        userData.profileName = profile.map((item) => item.profileName);
      } catch {}
      /*var userProfile = userData.profile?
                await ProfileAccess.findOne({_id:ObjectID(userData.profile)}):''
            if(userProfile)
                userData.profileName = userProfile.profileName*/
    }
    res.json({ data: userData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/list", jsonParser, async (req, res) => {
  var pageSize = req.body.pageSize ? req.body.pageSize : "20";
  var offset = req.body.offset ? parseInt(req.body.offset) : 0;
  try {
    const data = {
      orderNo: req.body.orderNo,
      status: req.body.status,
      customer: req.body.customer,
      access: req.body.access,
      offset: req.body.offset,
      brand: req.body.brand,
    };
    const reportList = await user.aggregate([
      { $match: data.access ? { access: data.access } : {} },
    ]);
    const filter1Report = data.customer
      ? reportList.filter(
          (item) =>
            item &&
            item.userInfo[0] &&
            item.userInfo[0].cName &&
            item.userInfo[0].cName.includes(data.customer)
        )
      : reportList;
    const orderList = filter1Report.slice(
      offset,
      parseInt(offset) + parseInt(pageSize)
    );
    const stockList = await Stocks.find({IsActive:true});
    const accessUnique = [...new Set(filter1Report.map((item) => item.access))];
    res.json({
      filter: orderList,
      size: filter1Report.length,
      access: accessUnique,
      stockList,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-user", jsonParser, async (req, res) => {
  var userId = req.body._id;
  if (userId == "new") userId = "";
  const data = {
    username: req.body.username,
    cName: req.body.username,
    sName: req.body.sName,
    email: req.body.email,
    phone: req.body.phone,
    meli: req.body.meli,
    cCode: req.body.cCode,
    address: req.body.address,
    classess: req.body.classes,
    profile: req.body.profile,
    access: req.body.access,
    default: req.body.default,
    password: req.body.password,
    StockId: req.body.StockId,
    StockArr: req.body.StockArr,
    CustomerID: req.body.CustomerID,
    hasCommission: req.body.hasCommission,
  };
  if (req.body.profileId) {
    const targetProfile = await profileModel.exists({ _id: req.body.profileId });
    if (!targetProfile) {
      return res.status(400).send({ message: 'پروفایل مورد نظر یافت نشد.' });
    }
    data.profileId = req.body.profileId;
  }
  try {
    const userData = userId
      ? await user.updateOne({ _id: ObjectID(userId) }, { $set: data })
      : await user.create(data);
    res.json({ data: userData, success: "تغییرات اعمال شدند" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const StoreList = () => {
  return [
    {
      StockID: 5,
      Code: 1,
      Title: "انبار مرکزی",
      IsActive: true,
    },
    {
      StockID: 6,
      Code: 2,
      Title: "انبار فروشگاه ",
      IsActive: true,
    },
    {
      StockID: 9,
      Code: 3,
      Title: "انبار 3",
      IsActive: true,
    },
    {
      StockID: 12,
      Code: 4,
      Title: "انبار غیر قابل فروش",
      IsActive: true,
    },
    {
      StockID: 13,
      Code: 5,
      Title: "انبار فروشگاه جایگاه",
      IsActive: true,
    },
    {
      StockID: 17,
      Code: 6,
      Title: "انبار پخش",
      IsActive: true,
    },
    {
      StockID: 21,
      Code: 7,
      Title: "انبار سایت",
      IsActive: true,
    },
  ];
};

/*Customers*/
router.post('/fetch-customer', auth, jsonParser, async (req, res) => {
	try {
    // TODO: maybe here should check userId requesting for customer
		const { userId } = req.body;
		const customer = await customerModel.findOne({ _id: userId }).lean();
		if (customer.visitorId) {
			const targetVisitor = await userModel.findOne({ _id: customer.visitorId }).lean();
			customer.visitorInfo = {
				username: targetVisitor.username,
			};
		}
		if (customer.profileId) {
			const targetProfile = await profileModel.findOne({ _id: customer.profileId }).lean();
			customer.profileInfo = {
				profileName: targetProfile.profileName,
			};
		}
		return res.json({ data: customer });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/list-customers', auth, jsonParser, async (req, res) => {
	// const pageSize = req.body.pageSize ? req.body.pageSize : '10';
	// const offset = req.body.offset ? parseInt(req.body.offset) : 0;
	try {
		const { offset = 0, pageSize = 10, orderNo, status, customer, access, brand, official, repeat, active } = req.body;
		const skip = parseInt(offset);
		const limit = parseInt(pageSize);
		const userId = req.headers["userid"];
    const theseProfilesShouldSeeTheirCustomers = ['marketadmin', 'market', 'innerSale'];
		const targetProfiles = await profileModel.find({ profileCode: { $in: theseProfilesShouldSeeTheirCustomers } }).lean();
    const allowedProfiles = targetProfiles.map((p) => `${p._id}`);
		const theseUsersShouldSeeTheirCustomers = await userModel.find({ profile: { $in: allowedProfiles } }).lean();
    const theseUsersShouldSeeTheirCustomersIds = theseUsersShouldSeeTheirCustomers.map((u) => `${u._id}`);
		const matchCondition = {};
		if (theseUsersShouldSeeTheirCustomersIds.includes(userId)) {
			if (!matchCondition['$and']) {
				matchCondition['$and'] = [];
			}
			matchCondition['$and'].push({
        $or: [
          { visitorId: userId },
          { visitorId: { $exists: false } },
          { profileId: { $in: allowedProfiles } },
          { profileId: { $exists: false } },
        ],
      });
		}
		if (access) {
			matchCondition.access = access;
		}
		if (official) {
			if (official === 'official') {
				matchCondition.CustomerID = { $exists: true };
			} else {
				matchCondition.CustomerID = { $exists: false };
			}
		}
		if (customer) {
			if (!matchCondition['$and']) {
				matchCondition['$and'] = [];
			}
      matchCondition['$and'].push({
        $or: [
          { meli: new RegExp('.*' + customer + '.*') },
          { phone: new RegExp('.*' + customer + '.*') },
          { cName: new RegExp('.*' + customer + '.*') },
          { username: new RegExp('.*' + customer + '.*') },
          { cCode: new RegExp('.*' + customer + '.*') },
          { mobile: new RegExp('.*' + customer + '.*') },
        ],
      })
		}
		const customersAggregation = [
			{ $match: matchCondition },
			{
				$facet: {
					totalSize: [{ $count: 'totalSize' }],
					accessUnique: [
						{
							$group: {
								_id: null,
								result: { $addToSet: '$access' },
							},
						},
					],
					result: [
						{ $sort: { _id: -1 } },
						{ $skip: skip },
						{ $limit: limit },
						{
							$addFields: {
								visitorId: { $toObjectId: '$visitorId' },
								profileId: { $toObjectId: '$profileId' },
								// visitorId: {
								// 	$convert: {
								// 		input: '$visitorId',
								// 		to: 'objectId',
								// 		onError: '',
								// 		onNull: '',
								// 	},
								// },
							},
						},
						{
							$lookup: {
								from: 'users',
								localField: 'visitorId',
								foreignField: '_id',
								as: 'visitorInfo',
							},
						},
						{
							$lookup: {
								from: 'profiles',
								localField: 'profileId',
								foreignField: '_id',
								as: 'profileInfo',
							},
						},
					],
				},
			},
		];

		if (repeat) {
			const duplicateUsernames = await customerModel.aggregate([
				{ $group: { _id: '$username', count: { $sum: 1 } } },
				{ $match: { _id: { $ne: null }, count: { $gt: 1 } } },
				{ $project: { username: '$_id', _id: 0 } }, // TODO: should be like this: { $group: { _id: null, userNames: { $addToSet: '$_id' } } }
			]);
			if (!duplicateUsernames || !duplicateUsernames.length) {
				return res.json({ filter: [], size: 0, access: [] });
			}
			const result = duplicateUsernames[0];
			matchCondition.username = result.username; // TODO: should be like this: matchCondition.username = { $in: result };
			// const repCustomer = await customerModel.find(result).lean();
			// return repCustomer;
		}

		const [aggregationResult] = await customerModel.aggregate(customersAggregation);
		const size = aggregationResult?.totalSize[0]?.totalSize || 0;
		const customersList = aggregationResult?.result || [];
		const accessList = aggregationResult?.accessUnique[0]?.result || [];
		// const accessUnique = [...new Set(filter1Report.map((item) => item.access))];
		// const orderList = filter1Report.slice(offset, parseInt(offset) + parseInt(pageSize));
		const filter = customersList.map((i) => {
			const visitor = i.visitorInfo[0];
			const profile = i.profileInfo[0];
			const temp = {
				...i,
			};
			if (visitor) {
				temp.visitorInfo = {
					username: visitor.username,
				};
			}
			if (profile) {
				temp.profileInfo = {
					profileName: profile.profileName,
				};
			}
			return temp;
		});
		const response = {
			filter,
			size,
			access: accessList,
		};
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/update-customer', auth, jsonParser, async (req, res) => {
	try {
		const userId = req.body.userId;
		const data = {
			cName: req.body.cName,
			sName: req.body.sName,
			//username:req.body.sName+" "+req.body.cName,
			email: req.body.email,
			phone: req.body.phone,
			mobile: req.body.mobile,
			meliCode: req.body.meliCode,
			cCode: req.body.cCode,
			Address: req.body.Address,
			postalCode: req.body.postalCode,
			city: req.body.city,
			state: req.body.state,
			country: req.body.country,
			about: req.body.about,
			roleId: req.body.roleId,
			nif: req.body.nif,
			perBox: req.body.perBox,
			active: req.body.active,
			default: req.body.default,
			official: req.body.official,
			birthDay: req.body.birthDay,
			clothSize: req.body.clothSize,
			call: req.body.call,
			urgCall: req.body.urgCall,
			contractCall: req.body.contractCall,
			zone: req.body.zone,
			gps: req.body.gps,
			CustomerID: req.body.CustomerID,
			workTime: req.body.workTime,
			website: req.body.website,
		};
		if (req.body.imageUrl1) data.imageUrl1 = req.body.imageUrl1;
		if (req.body.imageUrl2) data.imageUrl2 = req.body.imageUrl2;
		if (req.body.kasbUrl) data.kasbUrl = req.body.kasbUrl;
		if (req.body.shopUrl1) data.shopUrl1 = req.body.shopUrl1;
		if (req.body.shopUrl2) data.shopUrl2 = req.body.shopUrl2;
		if (req.body.shopUrl3) data.shopUrl3 = req.body.shopUrl3;
		if (req.body.visitorId) {
			const adminId = req.headers['userid'];
			const managerProfile = await profileModel.findOne({ profileCode: 'manager' }).lean();
			const isManager = await userModel.findOne({ _id: adminId, profile: `${managerProfile._id}` }).lean();
			if (!isManager) {
				return res.status(403).send({ error: 'شما دسترسی کافی ندارید.' });
			}
			const allowedProfileCodes = ['marketadmin', 'market', 'innerSale'];
			const profiles = await profileModel.find({ profileCode: { $in: allowedProfileCodes } }).lean();
			const targetVisitor = await userModel.findOne({ _id: req.body.visitorId, profile: { $in: profiles.map((i) => `${i._id}`)} }).lean();
			if (!targetVisitor) {
				return res.status(400).send({ error: 'ویزیتور یافت نشد.' })
			}
			data.visitorId = req.body.visitorId;
		}
		if (req.body.visitorId === '') {
			// If visitorId is empty, unset visitorId from customer model
			const removeVisitorIdFromCustomer = await customerModel.updateOne(
				{ _id: userId },
				{ $unset: { visitorId: 1 } }
			);
		}
		if (req.body.profileId) {
			const adminId = req.headers['userid'];
			const managerProfile = await profileModel.findOne({ profileCode: 'manager' }).lean();
			const isManager = await userModel.findOne({ _id: adminId, profile: `${managerProfile._id}` }).lean();
			if (!isManager) {
				return res.status(403).send({ error: 'شما دسترسی کافی ندارید.' });
			}
			const allowedProfileCodes = ['marketadmin', 'market', 'innerSale'];
			const targetProfile = await profileModel.findOne({ _id: req.body.profileId }).lean();
			if (!targetProfile) {
				return res.status(400).send({ error: 'پروفایل یافت نشد.' })
			}
			if (!allowedProfileCodes.includes(targetProfile.profileCode)) {
				return res.status(400).send({ error: 'پروفایل صحیح نمی‌باشد.' })
			}
			data.profileId = req.body.profileId;
		}
		if (req.body.profileId === '') {
			// If profileId is empty, unset profileId from customer model
			const removeProfileIdFromCustomer = await customerModel.updateOne(
				{ _id: userId },
				{ $unset: { profileId: 1 } }
			);
		}
		const userOld = await customer.findOne({ _id: userId }).lean();
		if (!userOld) {
			res.status(400).json({
				error: 'کاربر پیدا نشد',
			});
			return;
		}
		if (!data.cName) data.cName = userOld.cName;
		if (!data.sName) data.sName = userOld.sName;
		data.username = data.sName + ' ' + data.cName;
		const userData = await customer.findOne({ _id: userId }).lean();
		data.mobile = data.mobile ? EnNumber(data.mobile) : EnNumber(userData.mobile);
		data.meliCode = data.meliCode ? EnNumber(data.meliCode) : EnNumber(userData.meliCode);
		const userUpdate = await customer.updateOne({ _id: userId }, { $set: data });
		return res.json({ data: userUpdate, success: 'تغییرات اعمال شدند.' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post("/merge-customers", jsonParser, async (req, res) => {
  var userIds = req.body.userIds;
  var userData=[]
  var userInfos=[]
  var mainUser=''
  var mainId = ''
  var isActive=false
  try {
  for(var i=0;i<userIds.length;i++){
    const userInfo = await customer.findOne({ _id: ObjectID(userIds[i]) });
    if(!userInfo){
      res.status(400).json({
        error: "کاربر پیدا نشد",
      });
      return
    }
    if(userInfo.active){
      if(isActive){
        res.status(400).json({
        error: "تنها یک کاربر فعال نیاز است",
        })
        return
      }
      else {
        isActive=true
        mainUser = userInfo
        mainId = userInfo._id.toString()
      }
    }
    else{
      userData.push(userInfo._id)
      userInfos.push(userInfo)
    }
  }
  if(!isActive){
    res.status(400).json({data:userInfos,
    error: "یک کاربر فعال نیاز است",
    })
    return
  }
    await cart.updateMany(
      { userId: {$in:userIds} },{$set:{userId:mainId}})
    const data={
      mobile : EnNumber(mainUser.mobile),
      meliCode	: EnNumber(mainUser.meliCode)
    }
    const userUpdate = await customer.updateOne(
      { _id: ObjectID(mainId) },
      { $set: data }
    );
    await customer.deleteMany({_id:{$in:userData}})
    res.json({ data: userUpdate, success: "تغییرات اعمال شدند" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/customers-mobile", jsonParser, async (req, res) => {
  var phone = req.body.phone;
  
  try {
    if(!phone) return res.status(400).json({error:"کاربر پیدا نشد"})
    const userData = await customerModel.findOne(
      {phone:{ $regex: phone, $options: 'i' }}).lean()
    res.json({...userData});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/create-customer', jsonParser, async (req, res) => {
	try {
		const agent = req.headers['userid'];
		const data = req.body;
		const checkIfCustomerExistsCondition = {
			roleId: data.roleId,
			meliCode: data.meliCode,
			mobile: data.mobile,
		};
		const customer = await customerModel.findOne(checkIfCustomerExistsCondition).lean();
		if (customer) {
			return res.status(400).send({ message: 'مشتری با این اطلاعات قبلا ثبت شده است.' });
		}
		data.username = data.sName + ' ' + data.cName;
		data.agent = agent;
		data.active = true;
		const userData = await customerModel.create(data);
		return res.json({ data: userData, success: 'مشتری اضافه شد' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post('/my-customer', auth, jsonParser, async (req, res) => {
	try {
		const { search } = req.body;
		const targetUser = await userModel.findOne({ _id: req.headers['userid'] }).lean();
		const matchCondition = {
			agent: { $exists: true },
			/*$or: [
				{ visitorId: req.headers['userid'] },
				{ visitorId: { $exists: false } },
				{ profileId: { $in: targetUser.profile } },
				{ profileId: { $exists: false } },
			],*/
		};
		if (search) {
      matchCondition['$or'] = []
			matchCondition['$or'].push({ meli: new RegExp('.*' + search + '.*') });
			matchCondition['$or'].push({ phone: new RegExp('.*' + search + '.*') });
			matchCondition['$or'].push({ cName: new RegExp('.*' + search + '.*') });
			matchCondition['$or'].push({ username: new RegExp('.*' + search + '.*') });
			matchCondition['$or'].push({ mobile: new RegExp('.*' + search + '.*') });
		}
		const aggregation = [
			{ $match: matchCondition },
      { $limit: 10}
		];
		const data = await customer.aggregate(aggregation);
		return res.json({ data, success: 'مشتری پیدا شد' });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

/*Profile*/
router.post("/fetch-profile", jsonParser, async (req, res) => {
  var profileId = req.body.profileId;
  try {
    const profileData = await ProfileAccess.findOne({
      _id: ObjectID(profileId),
    });
    const crmData = await crmlist.findOne({});
    res.json({ data: profileData, crmData: crmData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/list-profiles', jsonParser, async (req, res) => { // TODO: should add auth middleware
	var pageSize = req.body.pageSize ? req.body.pageSize : '10';
	var offset = req.body.offset ? parseInt(req.body.offset) : 0;
	try {
		const { offset = 0, pageSize = 10 } = req.body;
		const skip = parseInt(offset);
		const limit = parseInt(pageSize);
		const profilesList = await ProfileAccess.find().lean();
		return res.json({ profiles: profilesList });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.post("/update-profile", jsonParser, async (req, res) => {
  var profileId = req.body.profileId;
  if (profileId === "new") profileId = "";
  const data = {
    profileName: req.body.profileName,
    profileCode: req.body.profileCode,
    manId: req.body.manId,
    parentId: req.body.parentId,
    access: req.body.access,
  };
  try {
      const targetItem = await profileModel.findOne({ _id: profileId }).lean();
      if (!targetItem) {
        return res.status(404).send({ message: 'پروفایل یافت نشد.' });
      }
      const menusAccessData = targetItem.menusAccess.map((menu) => {
        req.body.menusAccess.forEach((reqMenu) => {
          if (reqMenu.menuCode === menu.menuCode) {
            menu.access = reqMenu.access;
          }
        });
        return menu;
      });
      data.menusAccess = menusAccessData;
    //const profile = await ProfileAccess.find({_id: ObjectID(profileId)})
    var profileData = "";
    if (profileId)
      profileData = await ProfileAccess.updateOne(
        { _id: ObjectID(profileId) },
        { $set: data }
      );
    else profileData = await ProfileAccess.create(data);

    res.json({ data: profileData, success: "تغییرات اعمال شدند" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/fetch-class", jsonParser, async (req, res) => {
  var classId = req.body.classId;
  if (classId === "new") classId = "";
  try {
    const classData =
      classId && (await classes.findOne({ _id: ObjectID(classId) }));
    const userClass =
      classData &&
      (await user.find({
        class: { $elemMatch: { _id: String(classData._id) } },
      }));
    const customerClass =
      classData &&
      (await customer.find({
        class: { $elemMatch: { _id: String(classData._id) } },
      }));
    const policyClass =
      classData && (await Policy.find({ classId: String(classData._id) }));
    res.json({
      filter: classData,
      userClass: userClass,
      policyClass: policyClass,
      customerClass: customerClass,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/list-classes", jsonParser, async (req, res) => {
  try {
    //const classList = await classes.find()
    const allClasses = await classSeprate(req.body.userId);
    res.json(allClasses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-class", jsonParser, async (req, res) => {
  var classId = req.body.classId;
  if (classId === "new") classId = "";
  const data = {
    className: req.body.className,
    classEn: req.body.classEn,
    classCat: req.body.classCat,
    manId: req.body.manId,
  };
  try {
    //const profile = await ProfileAccess.find({_id: ObjectID(profileId)})
    var profileData = "";
    if (classId)
      classData = await classes.updateOne(
        { _id: ObjectID(classId) },
        { $set: data }
      );
    else classData = await classes.create(data);

    const allClasses = await classSeprate(req.body.userId);
    res.json(allClasses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-user-class", jsonParser, async (req, res) => {
  var userId = req.body.userId;
  const data = {
    class: req.body.class,
  };
  try {
    const userData = await user.findOne({ _id: ObjectID(userId) });
    var userClass = userData.class ? userData.class : [];
    var found = 0;
    for (var i = 0; i < userClass.length; i++) {
      if (userClass[i]._id == data.class._id) {
        userClass.splice(i, 1);
        found = 1;
      }
    }
    !found && userClass.push(data.class);

    const newClassUser = await user.updateOne(
      { _id: ObjectID(userId) },
      { $set: { class: userClass } }
    );
    //const allClasses =await classSeprate(req.body.userId)
    res.json({ data: newClassUser, status: "23" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-customer-class", jsonParser, async (req, res) => {
  var userId = req.body.userId;
  const data = {
    class: req.body.class,
  };
  try {
    const userData = await customer.findOne({ _id: ObjectID(userId) });
    var userClass = userData.class ? userData.class : [];
    var found = 0;
    for (var i = 0; i < userClass.length; i++) {
      if (userClass[i]._id == data.class._id) {
        userClass.splice(i, 1);
        found = 1;
      }
    }
    !found && userClass.push(data.class);

    const newClassUser = await customer.updateOne(
      { _id: ObjectID(userId) },
      { $set: { class: userClass } }
    );
    //const allClasses =await classSeprate(req.body.userId)
    res.json({ data: newClassUser, status: "23" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/// حذف مشتری از پنل اگر در مودل های
///orderوcartوquickCart
/// رکوردی موجود نباشد.
///و اینکه به گفته مهندس میلاد، یوزر ایدی همان کاستومر ایدی می باشد
router.post("/delete-customer", jsonParser, async (req, res) => {
  var { userId } = req.body;
  if (!userId)
    return res.status(500).json({ message: "شناسه کاربر ارسال نشده است" });
  userId;
  try {
    const userData = await customer.findOne({ _id: ObjectID(userId) });
    if (!userData)
      return res
        .status(400)
        .json({ message: "کاربر با این شناسه در سامانه وجود ندارد" });
    const order = await orders.findOne({ userId });
    if (order)
      return res.status(400).json({
        message: `مشتری دارای سفارشی با شماره ${order.orderNo} می باشد`,
      });
    const cartObj = await cart.findOne({ userId });
    if (cartObj)
      return res.status(400).json({
        message: `مشتری دارای سبد خرید با شماره ${cartObj.cartNo} می باشد`,
      });
    const quickCartObj = await quickCart.findOne({ userId });
    if (quickCartObj)
      return res.status(400).json({
        message: `مشتری دارای ${"quickCart"} می باشد`,
      });
    const deleteResponse = await customer.deleteOne({ _id: ObjectID(userId) });
    if (!deleteResponse.acknowledged)
      res.status(500).json({ message: "خطا در حذف مشتری داده" });
    res.json({ message: "مشتری با موفقیت حذف شد." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
const classSeprate = async (userId) => {
  const allClass = await classes.find();

  var userData = await user.findOne({ _id: ObjectID(userId) });
  if (!userData) userData = await customer.findOne({ _id: ObjectID(userId) });
  const assignClass = userData && userData.class;

  var availableClass = [];
  if (assignClass)
    for (var i = 0; i < allClass.length; i++) {
      var found = 0;
      for (var j = 0; j < assignClass.length; j++) {
        if (allClass[i]._id == assignClass[j]._id) {
          found = 1;
          break;
        }
      }
      !found && availableClass.push(allClass[i]);
    }
  else availableClass = allClass;
  return {
    availableClass: availableClass,
    assignClass: assignClass,
    filter: allClass,
  };
};

router.post("/fetch-policy", jsonParser, async (req, res) => {
  var policyId = req.body.policyId;
  try {
    const policyData =
      policyId !== "new" &&
      (await Policy.aggregate([
        { $match: { _id: ObjectID(policyId) } },
        { $addFields: { user_Id: { $toObjectId: "$userId" } } },
        {
          $lookup: {
            from: "users",
            localField: "user_Id",
            foreignField: "_id",
            as: "userInfo",
          },
        },
      ]));
    const classData = await classes.find();
    const catData = await category.find();
    const brandData = await brand.find();
    const filterData = await Filters.find();
    res.json({
      filter: policyData && policyData[0],
      classes: classData,
      brands: brandData,
      filters: filterData,
      category: catData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/option-policy", jsonParser, async (req, res) => {
  const category = req.body.category;
  const factoryInfo = req.body.factory;
  const catId = String(category._id);
  try {
    const brandData = category.brands; //await brand.find()
    //console.log(brandData)
    const factoryData = await factory.find();
    const filterData = await Filters.find();
    const resultBrand = [];
    const resultFilter = [];
    for (var i = 0; i < filterData.length; i++) {
      if (filterData[i].category._id === catId)
        resultFilter.push(filterData[i]);
    }
    if (factoryInfo && brandData)
      for (var i = 0; i < brandData.length; i++) {
        const brandFact = brandData[i].factory;
        if (brandFact)
          for (var j = 0; j < brandFact.length; j++) {
            if (brandFact[j]._id === factoryInfo._id)
              resultBrand.push(brandData[i]);
          }
      }
    res.json({
      factory: factoryData,
      filters: resultFilter,
      brands: factoryInfo ? resultBrand : brandData,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/list-policy", jsonParser, async (req, res) => {
  try {
    const policyList = await Policy.aggregate([
      { $addFields: { user_Id: { $toObjectId: "$userId" } } },
      {
        $lookup: {
          from: "users",
          localField: "user_Id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
    ]);
    //const allClasses =await classSeprate(req.body.userId)
    res.json({ filter: policyList, message: "List" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-policy", jsonParser, async (req, res) => {
  var policyId = req.body.policyId;
  if (policyId === "new") policyId = "";
  const data = req.body;
  try {
    //const profile = await ProfileAccess.find({_id: ObjectID(profileId)})
    var policyData = "";
    if (policyId)
      policyData = await Policy.updateOne(
        { _id: ObjectID(policyId) },
        { $set: data }
      );
    else policyData = await Policy.create(data);

    //const allPolicy =await classSeprate(req.body.userId)
    res.json({ data: policyData, status: "Done" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/update-user-class", jsonParser, async (req, res) => {
  var userId = req.body.userId;
  const data = {
    class: req.body.class,
  };
  try {
    const userData = await user.findOne({ _id: ObjectID(userId) });
    var userClass = userData.class ? userData.class : [];
    var found = 0;
    for (var i = 0; i < userClass.length; i++) {
      if (userClass[i]._id == data.class._id) {
        userClass.splice(i, 1);
        found = 1;
      }
    }
    !found && userClass.push(data.class);
    const newClassUser = await user.updateOne(
      { _id: ObjectID(userId) },
      { $set: { class: userClass } }
    );
    //const allClasses =await classSeprate(req.body.userId)
    res.json({ data: newClassUser, status: "23" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/sendSMS", jsonParser, async (req, res) => {
  var userId = req.body.userId;
  const data = {
    users: req.body.users,
    message: req.body.message,
  };
  try {
    var messageStatus = [];
    for (var i = 0; i < data.users.length; i++) {
      const result = await sendMessageUser(data.users[i], data.message);
      messageStatus.push({ status: result, userId: data.users[i] });
    }
    res.json({
      data: messageStatus,
      sentStatus: messageStatus.length + " sent",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/allow-menu", auth, jsonParser, async (req, res) => {
  var userId = req.headers["userid"];
  if (!userId) {
    res.status(500).json({ error: "no Credit" });
  }

  try {
    const userData = await user.findOne({ _id: ObjectID(userId) });
    var profile = [];
    for (var p = 0; p < (userData.profile && userData.profile.length); p++) {
      var profileData = await ProfileAccess.findOne({
        _id: ObjectID(userData.profile[p]),
      });

      for (
        var a = 0;
        a < (profileData.access && profileData.access.length);
        a++
      ) {
        var accessProf = profileData.access[a];
        if (profile.findIndex((item) => item.title == accessProf.title) == -1)
          profile.push(accessProf);
      }
    }
    res.json({ access: profile, message: "Profile List" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

var storage = multer.diskStorage({
  destination: "/dataset/",
  filename: function (req, file, cb) {
    cb(null, "Deep" + "-" + Date.now() + "-" + file.originalname);
  },
});
const uploadImg = multer({ storage: storage, limits: { fileSize: "5mb" } });

router.post("/upload", uploadImg.single("upload"), async (req, res, next) => {
  const folderName = req.body.folderName ? req.body.folderName : "temp";
  try {
    // to declare some path to store your converted image
    var matches = req.body.base64image.match(
        /^data:([A-Za-z-+/]+);base64,(.+)$/
      ),
      response = {};
    if (matches.length !== 3) {
      return new Error("Invalid input string");
    }
    response.type = matches[1];
    response.data = new Buffer.from(matches[2], "base64");
    let decodedImg = response;
    let imageBuffer = decodedImg.data;
    //let type = decodedImg.type;
    //let extension = mime.extension(type);
    let fileName = `MGM-${Date.now().toString() + "-" + req.body.imgName}`;
    var upUrl = `/upload/${folderName}/${fileName}`;
    fs.writeFileSync("." + upUrl, imageBuffer, "utf8");
    return res.send({ status: "success", url: upUrl });
  } catch (e) {
    res.send({ status: "failed", error: e });
  }
});

const storage2 = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const uploadArray = multer({ storage: storage2, limits: { fileSize: "5mb" } });
const uploadFields = uploadArray.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "uploads", maxCount: 1 },
]);

router.post("/uploadImage", uploadFields, uploadImage);
router.post("/updateImage", updateImage);
router.post("/getImage", getImage);
router.post("/deleteImage", deleteImage);

router.post("/createAdvType", createAdvType);
router.get("/getAdvType", getAdvType);
router.post("/updateAdvType", updateAdvType);

router.post("/transactions", jsonParser, async (req, res) => {
  var pageSize = req.body.pageSize ? req.body.pageSize : "10";
  var offset = req.body.offset ? parseInt(req.body.offset) : 0;
  try {
    const data = {
      orderNo: req.body.orderNo,
      status: req.body.status,
      customer: req.body.customer,
    };
    const reportList = await payLog.aggregate([
      { $match: data.orderNo ? { stockOrderNo: data.orderNo } : {} },

      {
        $match: data.status
          ? { payStatus: data.status }
          : { payStatus: { $in: ["paid", "undone"] } },
      },
      { $sort: { payDate: -1 } },
    ]);
    const filter1Report = /*data.customer?
        reportList.filter(item=>item&&item.cName&&
            item.cName.includes(data.customer)):*/ reportList;
    const logList = filter1Report.slice(
      offset,
      parseInt(offset) + parseInt(pageSize)
    );
    for (var i = 0; i < logList.length; i++) {
      var orderData = await orders.aggregate([
        { $match: { orderNo: logList[i].orderNo } },
        { $addFields: { user_Id: { $toObjectId: "$userId" } } },
        {
          $lookup: {
            from: "customers",
            localField: "user_Id",
            foreignField: "_id",
            as: "userDetail",
          },
        },
      ]);
      logList[i].orderData = orderData;
      logList[i].userDetail = [];
    }
    res.json({ filter: logList, size: filter1Report.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/taskData", async (req, res) => {
  const taskId = req.body.taskId;
  try {
    const taskDetail = taskId && (await tasks.findOne({ _id: taskId }));
    const currentUser =
      taskDetail &&
      taskDetail.assign &&
      (await user.findOne({ _id: taskDetail.assign }));
    const currentProfile =
      taskDetail &&
      taskDetail.profile &&
      (await ProfileAccess.findOne({ _id: taskDetail.profile }));
    const profileList = await ProfileAccess.find();
    const userDetails = await user.find({
      profile: { $exists: true },
      cName: { $nin: [""] },
      access: { $nin: ["customer"] },
    });
    res.json({
      user: userDetails,
      currentUser: currentUser ? currentUser : "",
      currentAssign: currentProfile ? currentProfile : "",
      profileList: profileList,
      message: "list users",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.post("/formal-customer", async (req, res) => {
  const userInfo = req.body.userData;
  const customerQuery = SepidarUser(userInfo);
  //console.log(customerQuery)
  if (!customerQuery) {
    res.status(400).json({
      message: "اطلاعات کافی نیست، کدملی، کدپستی و شماره تماس اجباری است",
      error: "error occure",
    });
    return;
  }
  const sepidarResult =
    customerQuery &&
    (await sepidarPOST(customerQuery, "/api/Customers", "", "admin"));
  //console.log(sepidarResult)
  if (!sepidarResult || sepidarResult.Message) {
    res.status(400).json({
      message: sepidarResult ? sepidarResult.Message : "Error",
      error: "error occure",
    });
    return;
  }
  //console.log(userInfo)
  if (sepidarResult.CustomerID) {
    await customer.updateOne(
      { _id: userInfo._id },
      {
        $set: {
          CustomerID: sepidarResult.CustomerID,
          creator: userInfo.agent,
          agent: "",
        },
      },
      { $unset: { agent: 1 } }
    );
  }
  res.json({
    query: customerQuery,
    result: sepidarResult,
    message: "مشتری در سپیدار ثبت شد",
  });
  //
  return;
  const taskId = req.body.taskId;
  try {
    const taskDetail = taskId && (await tasks.findOne({ _id: taskId }));
    const currentUser =
      taskDetail &&
      taskDetail.assign &&
      (await user.findOne({ _id: taskDetail.assign }));
    const currentProfile =
      taskDetail &&
      taskDetail.profile &&
      (await ProfileAccess.findOne({ _id: taskDetail.profile }));
    const profileList = await ProfileAccess.find();
    const userDetails = await user.find({
      profile: { $exists: true },
      cName: { $nin: [""] },
      access: { $nin: ["customer"] },
    });
    res.json({
      user: userDetails,
      currentUser: currentUser ? currentUser : "",
      currentAssign: currentProfile ? currentProfile : "",
      profileList: profileList,
      message: "list users",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
function normalNumber(number) {
  return number.replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}
const SepidarUser = (data) => {
  if (!data) return "";
  if (!data.meliCode || !data.postalCode || (!data.phone && !data.mobile))
    return "";
  var max = 999999999999;
  var min = 100000000000;
  var query = {
    GUID:
      "124ab075-fc79-417f-b8cf-" + Math.ceil(Math.random() * (max - min) + min),
    PhoneNumber: normalNumber(data.phone ? data.phone : data.mobile),
    CustomerType: 1,
    Name: data.cName,
    LastName: data.sName,
    NationalID: data.meliCode,
    EconomicCode: data.roleId,
    Addresses: [
      {
        Title: data.Address ? data.Address.split(" ")[0] : "شریف اویل",
        IsMain: true,
        CityRef: 1,
        Address: data.Address,
        ZipCode: data.postalCode,
        Latitude: "", //data.nif?data.nif.split(','||'|')[0]:"",
        Longitude: "", //data.nif?data.nif.split(',')[0]:"",
        GUID: "3fa85f64-5717-4562-b3fc-2c" + data.meliCode,
      },
    ],
  };
  return query;
};

async function uploadImage(req, res) {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send({ message: "هیچ فایلی آپلود نشده است" });
    }

    const {
      description,
      productName,
      productNameEn,
      advType,
      brandName,
      title,
      isActive = true,
    } = req.body;

    const fileDetails = files.uploads.map((file) => ({
      originalName: file.originalname,
      mimetype: file.mimetype,
      imagePath: file.path,
      thumbnailPath: files.thumbnail?.[0].path,
      size: file.size,
      description,
      productName,
      productNameEn,
      brandName,
      title,
      isActive,
      advType,
    }));

    const result = await file.insertMany(fileDetails);

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "uploadImage", error: e });
  }
}
async function updateImage(req, res) {
  try {
    let updateProps = {};
    for (prop in req.body) {
      if (prop) updateProps[prop] = req.body[prop];
    }
    if (!updateProps?.id) {
      return res.status(500).send({ message: "شناسه تصویر صحیح نمی باشد" });
    }

    const adv = await file.findOne({ _id: ObjectID(updateProps?.id) });
    if (!adv) {
      return res.status(500).send({ message: "شناسه تصویر صحیح نمی باشد" });
    }

    const result = await file.updateOne(
      { _id: ObjectID(updateProps.id) },
      updateProps
    );

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "updateImage", error: e.message });
  }
}
async function getImage(req, res) {
  try {
    const { advType } = req.body;

    const result = await file.find({ advType });

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "getImage", error: e });
  }
}
async function deleteImage(req, res) {
  try {
    const { id } = req.body;

    const result = await file.deleteOne({ _id: ObjectID(id) });

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "deleteImage", error: e.message });
  }
}

async function getAdvType(req, res) {
  try {
    const result = await advType.find({});
    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "deleteImage", error: e.message });
  }
}
async function updateAdvType(req, res) {
  try {
    let updateProps = {};
    for (prop in req.body) {
      if (prop) updateProps[prop] = req.body[prop];
    }
    if (!updateProps?.id) {
      return res.status(500).send({ message: "شناسه تبلیغ صحیح نمی باشد" });
    }

    const adv = await advType.findOne({ _id: ObjectID(updateProps?.id) });
    if (!adv) {
      return res.status(500).send({ message: "شناسه تبلیغ صحیح نمی باشد" });
    }

    const result = await advType.updateOne(
      { _id: ObjectID(updateProps.id) },
      updateProps
    );

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "updateAdvType", error: e.message });
  }
}
async function createAdvType(req, res) {
  try {
    const { advTypeName, description, isActive = true } = req.body;
    const exist = await advType.findOne({ advTypeName });
    if (exist) {
      return res.send({
        status: "unsuccess",
        error: "این advTypeName در سامانه موجود می باشد",
      });
    }

    const result = await advType.create({ advTypeName, description, isActive });

    return res.send({ status: "success", data: result });
  } catch (e) {
    res.send({ status: "createAdvType", error: e.message });
  }
}
router.route('/sale-policy-groups')
    .post(async (req, res) => {
        try {
            const salePolicyGroups = await salePolicyGroupModel.find({}).lean();
            if (!salePolicyGroups.length) {
                return res.status(400).json({ error: 'گروهی یافت نشد.' });
            }
            const response = {
                salePolicyGroups: salePolicyGroups.map((i) => {
                    return {
                        _id: i._id || '',
                        name: i.name || '',
                        category: i.category || '',
                    }
                })
            }
            return res.json(response);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

router.route('/sale-policy-groups/:id')
    .get(async (req, res) => {
        try {
            const { id } = req.params;
            const salePolicyGroup = await salePolicyGroupModel.findOne({ _id: id }).lean();
            if (!salePolicyGroup) {
                return res.status(500).json({ error: 'گروهی یافت نشد.' });
            }
            const response = {
                salePolicyGroups: {
                    _id: salePolicyGroup._id || '',
                    name: salePolicyGroup.name || '',
                    category: salePolicyGroup.category || '',
                    createdAt: salePolicyGroup.createdAt, // TODO: convert to persian date
                    updateAt: salePolicyGroup.updatedAt, // TODO: convert to persian date
                }
            }
            return res.json(response);
        } catch (error) {
            return res.status(500).json({ error: error.message });
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

router.route('/sale-policy-products').post(jsonParser, async (req, res) => {
	try {
		const salePolicyGroups = {
			side1: 'lowSellingProducts1',
			side2: 'lowSellingProducts2',
			sub: 'sideProducts',
			dependent: 'neutral',
		};
		const allowedIds = ['side1', 'side2', 'sub', 'dependent']; // to be simillar with ther other API somewhere else
		const { id, offset = 0, pageSize = 10, search } = req.body;
		const skip = parseInt(offset);
		const limit = parseInt(pageSize);
		const salePolicyGroup = allowedIds.includes(id)
			? await salePolicyGroupModel.findOne({ category: salePolicyGroups[id] }).lean()
			: await salePolicyGroupModel.findOne({ _id: id }).lean();
		if (!salePolicyGroup) {
			return res.status(400).json({ error: 'گروهی یافت نشد.' });
		}
		const userData = await userModel.findOne({ _id: req.headers['userid'] });
		if (!userData) {
			return res.status(400).json({ error: 'کاربر مجاز نیست.' });
		}
		const stockId = userData.StockId;

		const matchCondition = {
			active: true,
			sku: { $exists: true },
			salePolicyGroupId: salePolicyGroup._id,
		};
		if (search) {
			matchCondition['$or'] = [
				{ title: { $regex: search, $options: 'i' } },
				{ sku: { $regex: search, $options: 'i' } }
			];
		}

		const searchProducts = await productModel.aggregate([
			{ $match: matchCondition },
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
    //     const tasksMatchCondition = {
    //         taskStep: {
    //             $nin: ['archive', 'cancel', 'quote', 'suuport'],
    //         }
    //     };
		// const cartList = await tasks.find(tasksMatchCondition).lean();
    //     const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
		// const currentCart = await cartModel.find({ 'cartItems.sku': { $in: searchedProducts }, cartNo: { $in: cartIds } }).lean();
		// const qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
    const userProfiles = await profileModel.find({ _id: { $in: userData.profile } }).lean();
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
        qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
    }
		let searchProductResult = [];
		let index = 0;
		for (let i = 0; i < searchProducts.length; i++) {
			let count = searchProducts[i].countData.find((item) => item.Stock == stockId);
			let description = '';
			let cartCount = findCartCount(searchProducts[i].sku, currentCart.concat(qCartList), stockId);
			if (!count) {
                continue;
			}
			count.quantity = parseInt(count.quantity) - cartCount;
			if (count.quantity > 0) {
				index++;
				description = searchProducts[i].title + '(' + searchProducts[i].sku + ')' + '___' + count.quantity;
				searchProductResult.push({
					...searchProducts[i],
					count,
					description,
				});
			}
		}
		const temp = searchProductResult.slice(skip, skip + limit);
		const response = {
			products: temp,
			count: searchProductResult.length,
		};
		return res.json(response);
	} catch (error) {
		return res.status(500).json({ error: error.message });
	}
});

router.route('/sale-policy-products2')
	.post(jsonParser, async (req, res) => {
		try {
			const salePolicyGroups = {
				side1: 'lowSellingProducts1',
				side2: 'lowSellingProducts2',
				sub: 'sideProducts',
			};
			const allowedIds = ['side1', 'side2', 'sub']; // to be simillar with ther other API somewhere else
			const { id, offset = 0, pageSize = 10, search } = req.body;
			const skip = parseInt(offset);
			const limit = parseInt(pageSize);
			const salePolicyGroup = allowedIds.includes(id)
				? await salePolicyGroupModel.findOne({ category: salePolicyGroups[id] }).lean()
				: await salePolicyGroupModel.findOne({ _id: id }).lean();
			if (!salePolicyGroup) {
				return res.status(400).json({ error: 'گروهی یافت نشد.' });
			}
			const matchCondition = {
				salePolicyGroupId: salePolicyGroup._id,
			};
			if (search) {
				matchCondition['$or'] = [
          { title: { $regex: search } },
          { sku: { $regex: search } }
        ];
			}
			// list of this group skus
			// calculate number of each sku sale and add it to the product
			// sort by saleCount in products
			const [salePolicyProducts, count] = await Promise.all([
				products.find(matchCondition).skip(skip).limit(limit).lean(),
				products.countDocuments(matchCondition)
			]);

			const response = {
				products: salePolicyProducts,
				count,
			};
			return res.json(response);
		} catch (error) {
			return res.status(500).json({ error: error.message });
		}
	});

router.route('/sale-policy-products/:id')
    .post(jsonParser, async (req, res) => {
        try {
            const { id } = req.params;
            const { sku, dependentProductsCount } = req.body;
            const salePolicyGroup = await salePolicyGroupModel.findOne({ _id: id }).lean();
            if (!salePolicyGroup) {
                return res.status(400).json({ error: 'گروهی یافت نشد.' });
            }
            const targetProduct = await products.findOne({ sku }).lean();
            if (!targetProduct) {
                return res.status(400).json({ error: 'محصولی یافت نشد.' });
            }
			const updateData = {
				$set: {
					salePolicyGroupId: salePolicyGroup._id,
				}
			};
			const doesProductNeedDependentProductInSalePolicy = salePolicyGroup.category === 'neutral';
			if (doesProductNeedDependentProductInSalePolicy) {
				if (!dependentProductsCount) {
					return res.status(400).send({ error: 'تعداد محصولات وابسته مورد نیاز مشخص نشده است.' });
				}
				updateData['$set'].dependentProductsCount = dependentProductsCount;
				updateData['$set'].needDependentProducts = true;
			}
            const updateProductSalePolicyGroup = await products.updateOne({ sku }, updateData);
            const response = {
                message: 'محصول به لیست اضافه شد.',
            }
            return res.json(response);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    })
    .delete(jsonParser, async (req, res) => {
        try {
            const { id } = req.params;
            const { sku } = req.body;
            const targetProduct = await products.findOne({ sku, salePolicyGroupId: id }).lean();
            if (!targetProduct) {
                return res.status(400).json({ error: 'محصولی یافت نشد.' });
            }
            const updateProductSalePolicyGroup = await products.updateOne({ sku }, { $unset: { salePolicyGroupId: true } });
            const response = {
                message: 'محصول از لیست حذف شد.',
            }
            return res.json(response);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });

const getDependentProducts = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, sku, search } = req.body;
		const skip = parseInt(offset);
		const limit = parseInt(pageSize);
		const userData = await userModel.findOne({ _id: req.headers['userid'] });
		if (!userData) {
			return res.status(400).json({ error: 'کاربر مجاز نیست.' });
		}
		const stockId = userData.StockId;
		// const condition = {
		// 	sku,
		// };
		const targetProducts = await productModel.findOne({ sku }).lean();
		if (!targetProducts) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		// const [dependentProducts, size] = await Promise.all([ // TODO: send products just like sale-policy-rules products
		// 	salePolicyDependentProductModel.find(condition).skip(skip).limit(limit).sort({ _id: -1 }).lean(),
		// 	salePolicyDependentProductModel.countDocuments(condition),
		// ]);
		const dependentProducts = await salePolicyDependentProductModel.find({ productSku: sku }).sort({ _id: -1 }).lean();
		const dependentProductsSku = dependentProducts.map((i) => i.dependentProductSku);
		const matchCondition = {
			active: true,
			sku: { $in: dependentProductsSku },
		};
		if (search) {
			matchCondition['$or'] = [
				{ title: { $regex: search, $options: 'i' } },
				{ sku: { $regex: search, $options: 'i' } }
			];
		}

		const searchProducts = await productModel.aggregate([
			{ $match: matchCondition },
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
    //     const tasksMatchCondition = {
    //         taskStep: {
    //             $nin: ['archive', 'cancel', 'quote', 'suuport'],
    //         }
    //     };
		// const cartList = await tasks.find(tasksMatchCondition).lean();
    //     const cartIds = cartList.map((item) => item.orderNo).filter((i) => i);
		// const currentCart = await cartModel.find({ 'cartItems.sku': { $in: searchedProducts }, cartNo: { $in: cartIds } }).lean();
		// const qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
    const userProfiles = await profileModel.find({ _id: { $in: userData.profile } }).lean();
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
        qCartList = await quickCartModel.find({ 'cartItems.sku': { $in: searchedProducts }, stockId }).lean();
    }
		let searchProductResult = [];
		let index = 0;
		for (let i = 0; i < searchProducts.length; i++) {
			let count = searchProducts[i].countData.find((item) => item.Stock == stockId);
			let description = '';
			let cartCount = findCartCount(searchProducts[i].sku, currentCart.concat(qCartList), stockId);
			if (!count) {
				continue;
			}
			count.quantity = parseInt(count.quantity) - cartCount;
			if (count.quantity > 0) {
				index++;
				description = searchProducts[i].title + '(' + searchProducts[i].sku + ')' + '___' + count.quantity;
				searchProductResult.push({
					...searchProducts[i],
					count,
					description,
				});
			}
		}
		const temp = searchProductResult.slice(skip, skip + limit);
		const response = {
			products: temp,
			size: searchProductResult.length,
		};
		return res.send(response);
	} catch (error) {
		return res.status(500).send({ message: error.message });
	}
};

const addDependentProduct = async (req, res) => {
	try {
		const { sku, dependentProductSku } = req.body;
		const [targetProduct, dependentProduct] = await Promise.all([
			productModel.findOne({ sku }).lean(),
			productModel.findOne({ sku: dependentProductSku }).lean()
		]);
		if (!targetProduct) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		if (!dependentProduct) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		const targetProductSalePolicyGroup = await salePolicyGroupModel.findOne({ _id: targetProduct.salePolicyGroupId }).lean();
		if (targetProductSalePolicyGroup.category !== 'neutral') {
			return res.status(400).send({ message: 'این محصول جزو گروه محصولات خنثی نمی باشد.' });
		}
		// check if dependent product is in one of lowSellingProducts2 or sideProducts sale policy groups
		const allowedGroupsToAddDependentProducts = [
			'lowSellingProducts2',
			'sideProducts',
		];
		const dependentProductSalePolicyGroup = await salePolicyGroupModel.findOne({ _id: dependentProduct.salePolicyGroupId }).lean();
		if (!allowedGroupsToAddDependentProducts.includes(dependentProductSalePolicyGroup.category)) {
			return res.status(400).send({ message: 'این محصول نمی تواند وابسته محصول دیگری باشد. می بایست از گروه نوع 2 و یا کناری ها انتخاب کنید.' });
		}
		const data = {
			productId: targetProduct._id,
			productSku: targetProduct.sku,
			dependentProductId: dependentProduct._id,
			dependentProductSku: dependentProduct.sku,
		};
		const newDependentProduct = await salePolicyDependentProductModel.create(data);
		return res.send({ message: 'محصول وابسته اضافه شد.' });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
};

const removeDependentProduct = async (req, res) => {
	try {
		const { sku, dependentProductSku } = req.body;
		const [targetProduct, dependentProduct] = await Promise.all([
			productModel.findOne({ sku }).lean(),
			productModel.findOne({ sku: dependentProductSku }).lean()
		]);
		if (!targetProduct) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		if (!dependentProduct) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		const condition = {
			productId: targetProduct._id,
			productSku: targetProduct.sku,
			dependentProductId: dependentProduct._id,
			dependentProductSku: dependentProduct.sku,
		};
		const result = await salePolicyDependentProductModel.deleteOne(condition);
		return res.send({ message: 'محصول وابسته حذف شد.' });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
};

const getDependentProductsOfProduct = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, sku, search } = req.body;
		const skip = parseInt(offset);
		const limit = parseInt(pageSize);
		const condition = {
			productSku: sku,
		};
		const targetProducts = await productModel.findOne({ sku }).lean();
		if (!targetProducts) {
			return res.status(400).send({ message: 'محصولی یافت نشد.' });
		}
		const [dependentProducts, size] = await Promise.all([
			salePolicyDependentProductModel.find(condition).skip(skip).limit(limit).sort({ _id: -1 }).lean(),
			salePolicyDependentProductModel.countDocuments(condition),
		]);
		const productsCondition = {
			sku: {
				$in: dependentProducts.map((i) => i.dependentProductSku),
			},
		};
		const products = await productModel.find(productsCondition).skip(skip).limit(limit).lean();
		return res.send({ products, size });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
}

const getUsers = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, profiles = [] } = req.body;
		// const skip = parseInt(offset); // TODO: add pagination
		// const limit = parseInt(pageSize);
		const profileCondition = {
			profileCode: {
				$in: profiles
			},
		};
		const profilesList = await profileModel.find(profileCondition).lean();
		const users = await userModel.find({ profile: { $in: profilesList.map((i) => `${i._id}`) } }).select({ password: 0, __v: 0}).lean();
		const response = {
			users,
		};
		return res.send(response);
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
}

const getProfiles = async (req, res) => {
	try {
		const { offset = 0, pageSize = 10, profiles = [] } = req.body;
		// const skip = parseInt(offset); // TODO: add pagination
		// const limit = parseInt(pageSize);
		const profileCondition = {};
    if (profiles.length) {
      profileCondition.profileCode = {
				$in: profiles
			};
    }
		const profilesList = await profileModel.find(profileCondition).lean();
		const response = {
			profiles: profilesList,
		};
		return res.send(response);
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
}

const checkCustomerExistence = async (req, res) => {
	try {
		const { phone } = req.query;
		const customer = await customerModel.findOne({ phone }).lean();
		if (customer) {
			return res.send({ exists: true, customer });
		}
		return res.send({ exists: false });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
};

router.route('/get-all-sale-policy-dependent-products')
	.post(getDependentProductsOfProduct)

router.route('/get-sale-policy-dependent-products')
	.post(getDependentProducts);

router.route('/sale-policy-dependent-products')
	.post(addDependentProduct)
	.delete(removeDependentProduct);

router.route('/users-list')
	.post(getUsers);

router.post('/profiles', getProfiles);

router.get('/check-customer', checkCustomerExistence);

module.exports = router;
