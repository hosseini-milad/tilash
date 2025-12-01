const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const auth = require('../middleware/auth');

const stockModel = require('../models/product/Stocks');
const userModel = require('../models/auth/users');

router.use(bodyParser.json());
router.use(auth);

const getStocksController = async (req, res) => {
	try {
		const userData = await userModel.findOne({ _id: req.headers['userid'] }).lean();
        const myStock = userData.StockArr && userData.StockArr.map((item) => item.StockID);
		const stockList = userData.access === 'manager'
			? await stockModel.find({ IsActive: true }).lean()
			: await stockModel.find({ StockID: { $in: myStock } }).lean();

		return res.send({ stockList });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

router.get('/', getStocksController);

module.exports = router;
