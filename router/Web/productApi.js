const express = require('express');
const { default: fetch } = require("node-fetch");
const request = require("request");
const fs = require('fs')
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const router = express.Router()
const auth = require("../../middleware/auth");
const { ObjectId } = require('mongodb');
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
const CalcCount = require('../../middleware/NewModule/CalcCount');

router.post('/list-product', jsonParser, async (req, res) => {
	try {
        const { page = 1, pageSize = 12, category, 
            title,  brandId} = req.body;
        const data = req.body
        // let pageSize = req.body.pageSize ? req.body.pageSize : '10';
        // let offset = req.body.offset ? parseInt(req.body.offset) : 0;
        const productsMatchCondition = {
			//active: true,
			sku: { $exists: true },
		};
        if (title) {
			productsMatchCondition['$or'] = [
                { sku: { $regex: title, $options: 'i' } },
                { title: { $regex: title, $options: 'i' } }
            ];
		}
        var catData=''
        if (category) {
            catData = await categorySchema.findOne({link:category})
			if(catData)
                productsMatchCondition.catId=catData.catCode
            else
                productsMatchCondition.catId=category
		}

        if (brandId) {
			productsMatchCondition.brandId = brandId
		}
        var filterData = await Filters.find()
        for(var i=0;i<filterData.length;i++){
            if(data[filterData[i].enTitle]){
                productsMatchCondition[`filters.${filterData[i].enTitle}`] = 
                data[filterData[i].enTitle]
            }
        }
        //return res.json(productsMatchCondition)
        const productData = await productModel.aggregate([
            { $match: productsMatchCondition },
            {
                $facet: {
                totalCount: [
                    { $count: "count" }
                ],
                data: [
                    {
                    $lookup: {
                        from: "categories",
                        let: { catId: "$catId" },
                        pipeline: [
                        {
                            $match: {
                            $expr: { $eq: ["$catCode", "$$catId"] }
                            }
                        },
                        {
                            $project: {
                            _id: 0, title: 1, catCode: 1,
                            thumbUrl: 1, link: 1
                            }
                        }
                        ],
                        as: "categoryInfo"
                    }},
                    
                    {$lookup: {
                        from: "productcounts",
                        let: { sku: "$ItemID" },
                        pipeline: [
                        {
                            $match: {
                            $expr: {$and:[
                                {$eq: ["$ItemID", "$$sku"] },
                                {$eq: ["$Stock", "13"] }
                                ]
                            }
                            }
                        }
                        ],
                        as: "count"
                    }},
                    {
                        $unwind: {
                            path: "$count",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    
                    {$sort: {
                        "count.quantity": -1  // or -1 for descending
                    }},
                    { $skip: (Number(page)-1)*Number(pageSize) },
                    { $limit: Number(pageSize) },
                    {$lookup: {
                        from: "brands",
                        let: { brandId: "$brandId" },
                        pipeline: [
                        {
                            $match: {
                            $expr: { $eq: ["$brandCode", "$$brandId"] }
                            }
                        },
                        {
                            $project: {
                            _id: 0, title: 1, catCode: 1,
                            thumbUrl: 1, link: 1
                            }
                        }
                        ],
                        as: "brandInfo"
                    }},
                    {$lookup: {
                        from: "productprices",
                        let: { sku: "$ItemID" },
                        pipeline: [
                        {
                            $match: {
                            $expr: {$and:[
                                {$eq: ["$ItemID", "$$sku"] },
                                {$eq: ["$saleType", "35"] }
                                ]
                            }
                            }
                        }
                        ],
                        as: "price"
                    }},
                    {
                        $unwind: {
                            path: "$price",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {$project: {
                        _id: 0,
                        title: 1,
                        catId: 1,
                        brandId: 1,
                        sku: 1,
                        thumbUrl: 1,
                        ItemID: 1,
                        imageUrl: 1,
                        categoryInfo: 1,
                        brandInfo: 1,
                        count:1,price:1
                    }}
                ]
                }
            },
            {
                $project: {
                totalSize: { $arrayElemAt: ["$totalCount.count", 0] },
                data: 1
                }
            }
            ])
        var totalSize =productData[0].totalSize
        var totalPageCount =totalSize?Math.ceil(totalSize/pageSize):0
        //var bannerData = category.
        return res.json({...productData[0],totalPageCount,catData,message:"لیست محصولات"})
    }
    catch(error){ return res.status(500).json(error)}
})
router.get('/fetch-product/:sku', jsonParser, async (req, res) => {
    var sku = req.params.sku
    sku = sku.replace( /--/g, '/')
    try{
        const productData = await CalcCount(sku,'',"35")
        if(!productData) return res.status(400).json({error:"محصول وجود ندارد"})
        res.json({...productData})
    }
    catch(error){
        res.status(500).json(error)
    }
})
router.post('/list-filters', jsonParser, async (req, res) => {
	try {
        const { offset = 0, pageSize = 10, store, category, 
            title, sku, exist, brandId, active} = req.body;
        // let pageSize = req.body.pageSize ? req.body.pageSize : '10';
        // let offset = req.body.offset ? parseInt(req.body.offset) : 0;
        const catData = await categorySchema.aggregate([
            {$match:{$or:[
                {parent:{$exists:false}},
                {parent:{$in:['',null]}}
            ]}},
            {$addFields: {"enTitle": "$catCode" }},
            {$lookup: {
                from: 'categories',
                let: { parentId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$parent', '$$parentId'] } } },
                    { $project:{
                        _id:0, title:1, catCode:1,
                        thumbUrl:1,link:1
                    } } ],
                as: 'children'
            }},
            {$project:{
                _id:0, title:1, catCode:1, enTitle:1,
                thumbUrl:1,parent:1,link:1,
                children:1

            }}
        ])
        const brandData = await brandModel.aggregate([
            {$match:{active:true}},
            {$project:{
                _id:0, title:1, brandCode:1,brandUrl:1

            }}
        ])
        const filterData = await Filters.aggregate([
            {$limit:pageSize},
            {$project:{
                _id:0, title:1, enTitle:1,optionsP:1

            }}
             
        ])
        return res.json({
            category:catData,
            brands:brandData,
            data:filterData,message:"لیست فیلترها"})
    }
    catch{}
})
module.exports = router;
