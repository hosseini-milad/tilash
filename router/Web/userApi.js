const express = require('express');
const { default: fetch } = require("node-fetch");
const request = require("request");
const fs = require('fs')
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const router = express.Router()
const auth = require("../../middleware/auth");
const { ObjectId, ObjectID } = require('mongodb');
const { OLD_SITE_URL,API_PORT,StockId,SaleType} = process.env;
var im = require('imagemagick');
const resizeImg = require('resize-img');
 
const ServiceSchema = require('../../models/product/Services');
const ProductSchema = require('../../models/product/products');
const BrandSchema = require('../../models/product/brand')
const categorySchema = require('../../models/product/category');
const { env } = require('process');
const filterNumber = require('../../middleware/Functions');

const productCount = require('../../models/product/productCount');
const productPrice = require('../../models/product/productPrice');
const NormalTax = require('../../middleware/NormalTax');
const openOrders = require('../../models/orders/openOrders');
const Filters = require('../../models/product/Filters');
const factory = require('../../models/product/factory');
const orders = require('../../models/orders/orders');
const faktor = require('../../models/product/faktor');
const cart = require('../../models/product/cart');
const users = require('../../models/auth/users');
const products = require('../../models/product/products');
const UpdateMarket = require('../../middleware/UpdateMarket');
const crmlist = require('../../models/crm/crmlist');
const CanAnalyze = require('../../middleware/CanAnalyze');
const Stocks = require('../../models/product/Stocks');
const salePolicyGroupModel = require('../../models/sale/salePolicyGroup');
const saleCommissionGroupModel = require('../../models/sale/saleCommissionGroup');
const userModel = require('../../models/auth/users');
const FindAccess = require('../../middleware/FindAccess');
const ProfileAccess = require("../../models/auth/ProfileAccess");
const productModel = require('../../models/product/products');
const brandModel = require('../../models/product/brand');
const customerModel = require('../../models/auth/customers');

router.get('/my-profile', jsonParser,auth, async (req, res) => {
    const userId = req.user&&req.user.user_id
    if(!userId)
        return res.status(400).json({error:"کاربر نامعتبر است"})
	try {
        const productData = await customerModel.findOne({_id:ObjectID(userId)})
        if(!productData)
            return res.status(400).json({error:"کاربر پیدا نشد"})
        return res.json({data:productData,
            message:"اطلاعات کاربر"})
    }
    catch{}
})
router.post('/update-profile', jsonParser,auth, async (req, res) => {
    const userId = req.user&&req.user.user_id
    const data = req.body;
        
    if(!userId)
        return res.status(400).json({error:"کاربر نامعتبر است"})
	try {
        const userData = await customerModel.updateOne({_id:ObjectID(userId)},
        data
    )
        
        return res.json({data:userData,
            message:"اطلاعات کاربر بروز شد"})
    }
    catch{}
})

module.exports = router;
