const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const auth = require("../middleware/auth");

const brandModel = require("../models/product/brand");

router.use(bodyParser.json());
router.use(auth);

const getBrandsController = async (req, res) => {
	try {
		const brands = await brandModel.find({}).lean();
		return res.send({ brands });
	} catch (error) {
		return res.status(500).json({ message: error.message });
	}
};

router.get("/", getBrandsController);

module.exports = router;
