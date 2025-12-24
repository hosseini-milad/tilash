const express = require('express');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const router = express.Router()
const auth = require("../middleware/auth");
const xlsx = require('node-xlsx');
const task = require('../models/main/task');
const LogCreator = require('../middleware/logCreator');
const users = require('../models/auth/users');
const slider = require('../models/main/slider');
const state = require('../models/main/state');
const city = require('../models/main/city');
const cart = require('../models/product/cart');
var ObjectID = require('mongodb').ObjectID;
const MergeOrder = require('../middleware/MergeOrder');
const CartToSepidar = require('../middleware/CartToSepidar');
const sepidarPOST = require('../middleware/SepidarPost');
const Invoice = require('../models/product/Invoice');
const InvoiceItems = require('../models/product/InvoiceItems');
const transaction = require('../models/product/transaction');
const RecieptFunc = require('../middleware/RecieptFunc');
const customers = require('../models/auth/customers');
const SumArray = require('../middleware/SumArray');
const FindRemainBank = require('../middleware/FindRemainBank');
const orderLog = require('../models/orders/orderLog');
const CalcCartTotal = require('../middleware/CalcCartTotaljs');
const CartToFaktor = require('../middleware/NewModule/MultiCartToFaktor');
const faktor = require('../models/product/faktor');
const faktorItems = require('../models/product/faktorItems');
const bankAccounts = require('../models/product/bankAccounts');
const utils = require('../utils');
const customerModel = require('../models/auth/customers');
const userModel = require('../models/auth/users');
const CalcFaktorRemain = require('../middleware/NewModule/CalcFaktorRemain');
//const UpdateExcel = require('../middleware/UpdateExcel');

router.post('/sliders', async (req, res) => {
    try {
        const SlidersList = await slider.find()
        res.json({ filter: SlidersList, message: "slider list" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/fetch-slider', async (req, res) => {
    var sliderId = req.body.sliderId ? req.body.sliderId : ''
    try {
        const SliderData = await slider.findOne({ _id: sliderId })
        res.json({ filter: SliderData, message: "slider Data" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/updateSlider', auth, jsonParser, async (req, res) => {
    var sliderId = req.body.sliderId ? req.body.sliderId : ''
    if (sliderId === "new") sliderId = ''
    try {
        const data = {
            title: req.body.title,
            enTitle: req.body.enTitle,
            link: req.body.link,
            description: req.body.description,
            imageUrl: req.body.imageUrl,
            thumbUrl: req.body.thumbUrl
        }
        var sliderResult = ''
        if (sliderId) sliderResult = await slider.updateOne({ _id: sliderId },
            { $set: data })
        else
            sliderResult = await slider.create(data)

        res.json({ result: sliderResult, success: sliderId ? "Updated" : "Created" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/changeState', auth, jsonParser, async (req, res) => {
    const data = {
        state: req.body.state,
        prior: req.body.prior * 5 + 1
    }
    try {
        const userData = await users.findOne({ _id: req.headers['userid'] })

        const logData = await LogCreator(userData, "change State",
            `task no ${req.body.id}'s state change to ${data.state}`)
        const leadTask = await task.updateOne({ _id: req.body.id },
            { $set: data })
        //if(leadTask)
        res.json({ status: "report done", data: leadTask })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/changeOrder', auth, jsonParser, async (req, res) => {
    const tasks = req.body.tasks
    try {
        const userData = await users.findOne({ _id: req.headers['userid'] })

        const logData = await LogCreator(userData, "change Sort",
            `task sort by: ${tasks}`)

        for (var i = 0; i < tasks.length; i++) {
            const updateState = await task.updateOne({ _id: tasks[i] }, { $set: { prior: i * 5 + 3 } })
        }

        //if(leadTask)
        res.json({ status: "sort done" })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/list-state', jsonParser, async (req, res) => {
    const search = req.body.search
    try {
        const stateList = await state.find(search ?
            { stateName: new RegExp('.*' + search + '.*') } : {})
        res.json({ data: stateList })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/list-city', jsonParser, async (req, res) => {
    const search = req.body.search
    const state = req.body.stateId
    try {
        if (!state) {
            res.status(400).json({ message: "لطفا کد استان را وارد نمایید" })
            return ('')
        }
        const cityList = await city.find(search ?
            {
                cityName: new RegExp('.*' + search + '.*'),
                stateId: state
            } : { stateId: state })
        res.json({ data: cityList })
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})
router.post('/multi-sepidar', jsonParser, auth, async (req, res) => {
    const orderList = req.body.orderNo
    const manageId = req.headers['userid']
    var official = req.body.official?req.body.official:1
    
    var error=''
    
    try {
        const orderDetails = await cart.find({ cartNo: { $in: orderList } })
        if(!orderDetails||!orderDetails.length){
            res.status(400).json({error:"سفارش پیدا نشد"})
            return
        }
        //const mergeOrder = await MergeOrder(orderDetails.map(item => item.cartItems),orderDetails)
        var query = []
        var result = []
        //const recResult = await RecieptFunc()
        const adminData = await users.findOne({ _id: ObjectID(manageId) })
        for(var i = 0;i<orderDetails.length;i++){
            var orderData = orderDetails[i]
            var cartItems = orderData.cartItems
            const customerData = await customers.findOne({ _id: ObjectID(orderDetails[i].userId) })
        
        const faktorNo = "T100" + orderDetails[i].cartNo
        var sepidarQuery = await CartToSepidar(cartItems, faktorNo,
            customerData, 
            orderData.stockId,orderData.pDiscount,
            orderData.cartNo,
            orderData&&orderData.payValue,'',
            orderData&&orderData.transportPrice)
        query.push(sepidarQuery)
        return res.json(sepidarQuery)
        try{
        var sepidarResult = await sepidarPOST(sepidarQuery, "/api/invoices", 
            ObjectID(adminData._id))
        result.push(sepidarResult)
        if (sepidarResult && sepidarResult.InvoiceID) {
            await CartToFaktor(sepidarQuery,customerData,adminData,
                sepidarResult, orderData)
            
            await orderLog.create({
                    userId:manageId,
                    orderNo: faktorNo,
                    invoiceID:sepidarResult.InvoiceID,
                    orderPrice: "123",
                    orderCount:"12",
                    orderItem:orderData,
                    orderList:orderList,
                    errorMessage:'',
                    query:sepidarQuery
            })
            await cart.updateOne({ cartNo: orderData.cartNo }, {
                $set: { 
                    status:"done",
                    Number: sepidarResult.Number,
                    InvoiceID: sepidarResult.InvoiceID,
                    sepidarError:''
                } 
            })
            
        }
        else{
            error = sepidarResult && sepidarResult.Message
            await orderLog.create({
                userId:manageId,
                orderNo: faktorNo,
                invoiceID:'',
                orderPrice: "123",
                orderCount:"12",
                orderItem:orderData,
                orderList:orderList,
                errorMessage:error,
                query:sepidarQuery
        })
        await cart.updateOne({ cartNo: orderData.cartNo }, {
            $set: { 
                sepidarError: error
            } 
        })

        }
        }
        catch{continue}
        }
        
        res.json({ data: "sepidarResult",query,result,
            message: error?error:"سفارشات در سپیدار ثبت شد" })
    }
    catch (error) {
        res.status(500).json({ error: error.message })
    }
})

router.post('/multi-sepidar-old', jsonParser, auth, async (req, res) => {
    const orderList = req.body.orderNo
    const manageId = req.headers['userid']
    var official = req.body.official?req.body.official:1
    
    var error=''
    try {
        const orderDetails = await cart.find({ cartNo: { $in: orderList } })
        if(!orderDetails||!orderDetails.length){
            res.status(400).json({error:"سفارش پیدا نشد"})
            return
        }
        const mergeOrder = await MergeOrder(orderDetails.map(item => item.cartItems),orderDetails)
        
        //const recResult = await RecieptFunc()
        const adminData = await users.findOne({ _id: ObjectID(manageId) })
        const customerData = await customers.findOne({ _id: ObjectID(orderDetails[0].userId) })
        if(customerData&&customerData.username&&customerData.username.includes("مصرف"))
            official =0
        if(customerData&&!customerData.CustomerID) official = 0
        const faktorNo = "F321" + orderDetails[0].cartNo
        var sepidarQuery = await CartToSepidar(mergeOrder, faktorNo,
            official?customerData:adminData, 
            adminData.StockId,orderDetails[0].discount,
            orderDetails[0].cartNo,
            orderDetails[0]&&orderDetails[0].payValue,'',
            orderDetails[0]&&orderDetails[0].transportPrice)
        
        
        var sepidarResult = await sepidarPOST(sepidarQuery, "/api/invoices", 
            ObjectID(adminData._id))
        
        if (sepidarResult && sepidarResult.InvoiceID) {
            await CartToFaktor(sepidarQuery,customerData,adminData,sepidarResult)
            //res.json({sepidarQuery})
            //return
            //console.log(recieptResult)
            /*await Invoice.create({ ...sepidarResult, manageId: adminData._id })
            var invoiceItems = sepidarResult.InvoiceItems
            for (var i = 0; i < invoiceItems.length; i++)
                await InvoiceItems.create({
                    ...invoiceItems[i],
                    InvoiceID: sepidarResult.InvoiceID
                })*/
            await orderLog.create({
                    userId:manageId,
                    orderNo: faktorNo,
                    invoiceID:sepidarResult.InvoiceID,
                    orderPrice: "123",
                    orderCount:"12",
                    orderItem:mergeOrder,
                    orderList:orderList,
                    errorMessage:'',
                    query:sepidarQuery
            })
            await cart.updateMany({ cartNo: { $in: orderList } }, {
                $set: { 
                    Number: sepidarResult.Number,
                    InvoiceID: sepidarResult.InvoiceID
                } 
            })
            
        }
        else{
            error = sepidarResult && sepidarResult.Message
            await orderLog.create({
                userId:manageId,
                orderNo: faktorNo,
                invoiceID:'',
                orderPrice: "123",
                orderCount:"12",
                orderItem:mergeOrder,
                orderList:orderList,
                errorMessage:error,
                query:sepidarQuery
        })
        }
        res.json({ data: sepidarResult,query:sepidarQuery, 
            error, InvoiceID:sepidarResult.Number,
            message: error?'':"سفارش در سپیدار ثبت شد" })
    }
    catch (error) {
        res.status(500).json({ error: error.message })
    }
})


router.post('/reg-sanad-sepidar', jsonParser, auth, async (req, res) => {
    const InvoiceIDList = req.body.InvoiceID
    //const NumberID = req.body.NumberID
    const manageId = req.headers['userid']
    result = []
    var success = 0
    var fail = 0
    var bankList = []
    var bankDetail = []
    const faktorList = await faktor.find({ InvoiceID: { $in: InvoiceIDList } })
    for (var i=0;i<faktorList.length;i++){
        const faktorData = faktorList[i]
        const InvoiceID = faktorData.InvoiceID
        var bankArray = faktorData.bankArray
        bankList = bankArray?bankArray:[]
        var now = new Date()
        var bDate = faktorData.bankDate?faktorData.bankDate:now.toLocaleDateString('en')
        bankDetail.push(faktorData)
        if(!faktorData.bankArray||faktorData.bankArray.length == 0){
            
            if(!faktorData.bank){
                fail ++
            result.push({
                error:"کد بانک وارد نشده است",
                message:"ناموفق",
                query:"",
                InvoiceID:InvoiceID
            })
            continue
            }

            bankArray.push({
                bank:faktorData.bank,
                bankDate:bDate,
                amount:faktorData.NetPrice
            })
        }
        for(var c=0;c<bankArray.length;c++){
            var trBank = bankArray[c]
            bDate = trBank.bankDate?trBank.bankDate:now.toLocaleDateString('en')
            var ReceiptIDs = []
            var payQuery={
                "GUID": "124ab075-fc79-417f-b8cf-2a"+
                    (Math.floor(Math.random()*9000000000) + 1000000000),
                "InvoiceID": InvoiceID,
                "Description": faktorData.InvoiceNumber,
                "Date":bDate,
                "Drafts": [{
                    "BankAccountID": trBank.bank,
                    "Description": "حواله",
                    "Number": faktorData.description?faktorData.description:"000",
                    "Date":bDate,
                    "Amount": trBank.amount?trBank.amount:faktorData.NetPrice
                }]
            }
            var recieptResult = await sepidarPOST(payQuery, "/api/Receipts/BasedOnInvoice", ObjectID(manageId))
            
            var ReceiptID = recieptResult&&recieptResult.ReceiptID
            if(!ReceiptID){
                fail ++
                result.push({
                    error:recieptResult&&recieptResult.Message,
                    message:"ناموفق",
                    query:payQuery,
                    InvoiceID:InvoiceID
                })
                continue
                //res.status(400).json({error:recieptResult&&recieptResult.Message,query:recieptQuery})
                //return
            }
            success++
            await transaction.create({
                userId:manageId,
                sepidarID:ReceiptID,
                InvoiceID:InvoiceID,
                sepidarResult:recieptResult,
                bankCode:trBank.bank,
                faktorNo:faktorData.faktorNo,
                orderNo:faktorData.Number,
                payStatus:"done",
                date:trBank.bankDate,
                payValue:trBank.amount}
            )
            result.push({
                error:'',
                result:ReceiptID,
                query:payQuery,
                InvoiceID:InvoiceID
            })
            ReceiptIDs.push(ReceiptID)
            await faktor.updateOne({InvoiceID:InvoiceID},
            {$set:{ReceiptID:ReceiptID,ReceiptIDs,Status:"register"}}) 
        }
        
    }
    
    res.json({message:"سند سفارش ثبت شد",
        success,fail,bankList,bankDetail,
        result:result})
})
router.post('/attach-sanad-sepidar', jsonParser, auth, async (req, res) => {
    const InvoiceID = req.body.InvoiceID
    const {bank,bankDate,amount}= req.body
    if(!bank || !InvoiceID || !amount){
        return res.status(400).json({error:"اطلاعات ناقص است"})
    }
    //const NumberID = req.body.NumberID
    const manageId = req.headers['userid']

    const faktorData = await faktor.findOne({ InvoiceID: InvoiceID })
    
    var bDate = bankDate?bankDate:now.toLocaleDateString('en')
    var ReceiptIDs = ''
    var payQuery={
        "GUID": "124ab075-fc79-417f-b8cf-2a"+
            (Math.floor(Math.random()*9000000000) + 1000000000),
        "InvoiceID": InvoiceID,
        "Description": faktorData.InvoiceNumber,
        "Date":bDate,
        "Drafts": [{
            "BankAccountID": bank,
            "Description": "حواله",
            "Number": faktorData.description?faktorData.description:"000",
            "Date":bDate,
            "Amount": amount?amount:faktorData.NetPrice
        }]
    }
    var recieptResult = await sepidarPOST(payQuery, "/api/Receipts/BasedOnInvoice", ObjectID(manageId))
            
    var ReceiptID = recieptResult&&recieptResult.ReceiptID
    if(!ReceiptID){
        result={
            error:recieptResult&&recieptResult.Message,
            message:"ناموفق",
            query:payQuery,
            InvoiceID:InvoiceID
        }
        res.status(400).json({error:recieptResult&&recieptResult.Message,query:payQuery})
        return
    }
    await transaction.create({
        userId:manageId,
        sepidarID:ReceiptID,
        InvoiceID:InvoiceID,
        sepidarResult:recieptResult,
        bankCode:bank,
        faktorNo:faktorData.faktorNo,
        orderNo:faktorData.Number,
        payStatus:"done",
        date:bDate,
        payValue:amount}
    )
    result={
        error:'',
        result:ReceiptID,
        query:payQuery,
        InvoiceID:InvoiceID
    }
    await faktor.updateOne({InvoiceID:InvoiceID},
    {$set:{ReceiptID:ReceiptID,ReceiptIDs,Status:"register"}}) 
    
        
    
    
    res.json({message:"سند سفارش ثبت شد",
        payQuery,
        result:result})
})

router.post('/reg-sanad-sepidar-old', jsonParser, auth, async (req, res) => {
    const InvoiceID = req.body.InvoiceID
    const NumberID = req.body.NumberID
    var ReceiptID=''
    const manageId = req.headers['userid']
    var bankDetail = await transaction.find({InvoiceID:InvoiceID,sepidarID:{$exists:false}})
    var recieptQuery = await RecieptFunc(bankDetail,InvoiceID,NumberID,
        Math.floor(Math.random()*9000000000) + 1000000000
    )
    
    var recieptResult = await sepidarPOST(recieptQuery, "/api/Receipts/BasedOnInvoice", ObjectID(manageId))
    
    ReceiptID = recieptResult&&recieptResult.ReceiptID
    if(!ReceiptID){
        res.status(400).json({error:recieptResult&&recieptResult.Message,query:recieptQuery})
        return
    }
    await transaction.updateMany({userId:manageId,sepidarID:{$exists:false}},
        {$set:{sepidarID:ReceiptID,
            InvoiceID:InvoiceID
        }}
    )
    await faktor.updateOne({InvoiceID:InvoiceID},
        {$set:{ReceiptID:ReceiptID,Status:"register"}}
    ) 
    res.json({message:"سند سفارش ثبت شد",ReceiptID:ReceiptID,query:recieptQuery})
})
router.post('/list-faktors', auth, async (req, res) => {
	try {
        const userId = req.headers['userid']; 
        const { dateFrom = [], dateTo = [], offset = 0, pageSize = 10, manager, customer, type, payValue, orderNo, status, description } = req.body;
        const fromDate = utils.helper.getFromDate(dateFrom);
		const toDate = utils.helper.getToDate(dateTo);
        const skip = parseInt(offset);
        const limit = parseInt(pageSize);
        const adminData = await userModel.findOne({ _id: userId }).lean();
        if (!adminData) {
            res.status(400).json({ error: "کاربر معتبر نیست" });
            return;
        }
        var clientList=[]
        if(adminData.access=="admin"){
            var userList = await userModel.find(
                {profile:{$in:adminData.profile},access:{$nin:["manager","admin"]}})//{StockId:userData.StockId})
            clientList=(userList.map(item=>item._id.toString()))
        }
        clientList.push(adminData._id.toString())
        //const userList = await userModel.find()
        var managerTabs = [
			{ title: 'ویزیتور', type: 'Visitor', manager: 'visitor' },
        ]
        for(var i=0;i<userList&&userList.length;i++){
            managerTabs.push({
                title: userList[i].username,
                type: 'Sale',manager: userList[i].username
            })
        }
        managerTabs.push({ title: 'وب سایت', type: 'Website' })
        const hasManagerAccess = adminData.access === 'manager';
		const tabs = hasManagerAccess ? managerTabs : [];
        const matchCondition = {};
        if (orderNo) {
			matchCondition.InvoiceNumber = new RegExp('.*' + orderNo + '.*'); // TODO: exact search is much better and much faster, because it avoids partial matches and uses index
        } else {
			matchCondition.initDate = {
				$gte: new Date(fromDate),
				$lte: new Date(toDate)
			};
		}
        if (hasManagerAccess) {
            if (manager) {
                const targetManager = await userModel.findOne({ username: manager }).lean();
                if (targetManager) {
                    matchCondition.manageId = `${targetManager._id}`;
                }
            }
        } else {
            //{ $match: { manageId: {$in:clientList}}},
            matchCondition.manageId = {$in:clientList}//userId;
        }
        if (status) {
            matchCondition.Status = status;
        }
        if (type === 'Website') {
            matchCondition.isWeb = true;
        }
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
            matchCondition.customerID = { $in: targetCustomers.map(c => c.CustomerID) };
        }
        const aggregation = [
            {
                $match: matchCondition,
            },
            {
				$facet: {
					totalSize: [{ $count: 'totalSize' }],
					result: [
                        { $sort: { initDate: -1 } },
						{ $skip: skip },
						{ $limit: limit },
					],
				},
			},
        ];
        const [aggregationResult] = await faktor.aggregate(aggregation);
        
		const size = aggregationResult?.totalSize[0]?.totalSize || 0;
		const filter = aggregationResult?.result || [];
        for(var i = 0;i<filter.length;i++){
            var cartData = filter[i]
            var bankData = cartData.bank&&
            await bankAccounts.findOne({ BankAccountID: cartData.bank})
            filter[i].bankName = bankData&&bankData.DlTitle
            const customerDetail = await customers.findOne({_id:ObjectID(cartData.userId)})
            filter[i].customer = customerDetail
            filter[i].remainPrice = CalcFaktorRemain(cartData.NetPrice,cartData.bankArray)
            
            if(filter[i].remainPrice&&filter[i].ReceiptID)
                filter[i].hasRemain = true
            else
                filter[i].hasRemain = false
            if(filter[i].remainPrice == "-")
                filter[i].hasRemain = true
        }
		const bankList = await bankAccounts.find({ limit: adminData.username }).lean();
		return res.json({ filter, tabs, size, bankList });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});
router.post('/edit-faktor', auth, async (req, res) => {
	try {
        const userId = req.headers['userid'];
        const { InvoiceID,bankArray, bankDate,bank } = req.body;
        
        const result = await faktor.updateOne({InvoiceID:InvoiceID},
            {bankDate,bankArray,bank}
        );
		
		return res.json({ data:result });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
});

router.get('/list-bank', async (req,res)=>{
    const bankList = await bankAccounts.find({ }).lean()
    //var bankFull = []
    for(var i=0;i<bankList.length;i++){
        bankList[i].DlTitle = bankList[i].DlTitle+" - " + bankList[i].DlCode
    }

    res.json({data:bankList})
})

router.get('/my-list-bank',auth, async (req,res)=>{
    var userId = req.user.user_id
    const adminData = await userModel.findOne({ _id: userId }).lean();
    const bankList = await bankAccounts.find({ limit: adminData.username }).lean();
    //const bankList = await bankAccounts.find({ }).lean()
    for(var i=0;i<bankList.length;i++){
        bankList[i].DlTitle = bankList[i].DlTitle+" - " + bankList[i].DlCode
    }
    res.json({data:bankList,bankData:adminData&&adminData.bank})
})

router.post('/add-bank-to-cart',auth, async (req,res)=>{
    
    const data = {
        userId: req.headers['userid'],
        title: req.body.title,
        bankCode: req.body.bankCode,
        payValue: req.body.payValue,
        orderNo:req.body.orderNo,
        description: req.body.description
    }
    try{ 
        await transaction.create(data)
        var bankDetail = await transaction.find({userId:data.userId,sepidarID:{$exists:false}})
        var payArray = bankDetail.map(item=>item.payValue)
        var total = req.body.totalCartValue
        var transRemain = FindRemainBank(bankDetail,total)
        res.json({transData:bankDetail,transRemain,payArray
        })
    }
    catch(error){
        res.status(500).json({message: error.message})
    }
})
router.post('/remove-bank-from-cart', async (req,res)=>{
    const userId = req.headers['userid']
    const id = req.body.id
    const total = req.body.totalCartValue
    try{ 
        await transaction.deleteOne({_id:ObjectID(id),userId:userId})
        var bankDetail = await transaction.find({userId:userId,sepidarID:{$exists:false}})
        var transRemain = FindRemainBank(bankDetail,total)
        res.json({transData:bankDetail,transRemain})
    } 
    catch(error){
        res.status(500).json({message: error.message})
    } 
}) 
router.post('/fetch-bank-of-cart', async (req,res)=>{
    const userId = req.headers['userid']
    //const total = req.body.totalCartValue
    var total = 0
    const carts = req.body.cartList
    try{ 
        if(!carts||!carts.length){
            res.status(400).json({error:"no cart"})
        }
        const cartTotal = await CalcCartTotal(carts)
        var bankDetail = await transaction.find({userId:userId,sepidarID:{$exists:false}})
        var transRemain = FindRemainBank(bankDetail,cartTotal&&cartTotal.totalPrice)
        res.json({transData:bankDetail,transRemain,cartTotal})
    } 
    catch(error){
        res.status(500).json({message: error.message})
    }
})
router.get('/clear-bank-of-cart',auth, async (req,res)=>{
    const userId = req.headers['userid']
    try{ 
        var bankDetail = await transaction.deleteMany({userId:userId,sepidarID:{$exists:false}})
        var transRemain = 0//FindRemainBank(bankDetail,total)
        res.json({message:"done"})
    } 
    catch(error){
        res.status(500).json({message: error.message})
    }
})


router.post('/add-bank-to-faktor',auth, async (req,res)=>{
    
    const data = {
        userId: req.headers['userid'],
        title: req.body.title,
        bankCode: req.body.bankCode,
        payValue: req.body.payValue,
        InvoiceID:req.body.InvoiceID,
        description: req.body.description
    }
    try{ 
        const faktorData = await faktor.findOne({InvoiceID:data.InvoiceID})
        if(!faktorData){
            res.status(400).json({error:"فاکتور پیدا نشد"})
            return
        }
        await transaction.create(data)
        var bankDetail = await transaction.find({InvoiceID:data.InvoiceID,sepidarID:{$exists:false}})
        var payArray = bankDetail.map(item=>item.payValue)
        var total = faktorData.NetPrice
        var transRemain = FindRemainBank(bankDetail,total)
        res.json({transData:bankDetail,transRemain,payArray
        })
    }
    catch(error){
        res.status(500).json({message: error.message})
    }
})
router.post('/remove-bank-from-faktor', async (req,res)=>{
    const userId = req.headers['userid']
    const id = req.body.id
    const InvoiceID = req.body.InvoiceID
    const total = req.body.totalCartValue
    try{ 
        await transaction.deleteOne({_id:ObjectID(id),userId:userId})
        var bankDetail = await transaction.find({InvoiceID:InvoiceID,sepidarID:{$exists:false}})
        var transRemain = FindRemainBank(bankDetail,total)
        res.json({transData:bankDetail,transRemain})
    } 
    catch(error){
        res.status(500).json({message: error.message})
    } 
}) 
router.post('/fetch-bank-of-faktor', async (req,res)=>{
    const userId = req.headers['userid']
    //const total = req.body.totalCartValue
    var total = 0
    //const carts = req.body.cartList
    const InvoiceID = req.body.InvoiceID
    const faktorData = await faktor.findOne({InvoiceID:InvoiceID})
        if(!faktorData){
            res.status(400).json({error:"فاکتور پیدا نشد"})
            return
        }
    try{ 
        //const cartTotal = await CalcCartTotal(carts)
        var bankDetail = await transaction.find({InvoiceID:InvoiceID,sepidarID:{$exists:false}})
        var transRemain = FindRemainBank(bankDetail,faktorData.NetPrice)
        res.json({transData:bankDetail,transRemain,total:faktorData.NetPrice})
    } 
    catch(error){
        res.status(500).json({message: error.message})
    }
})

router.post('/updateProductExcel',jsonParser,async(req,res)=>{
    var url= req.body.url
    try{ 
        const url = req.body.url
        //const data = fs.readFileSync(url)
        //console.log(data)
        const workSheetsFromFile = xlsx.parse(
            __dirname +"/../"+url);
        const result = 0&&await UpdateExcel(workSheetsFromFile)
        res.json({result})
    }
    catch(error){
        res.status(500).json({message: error.message})
    }
})

module.exports = router;
