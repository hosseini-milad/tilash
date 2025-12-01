const mongoose = require('mongoose');

const salePolicyDependentProductsSchema = new mongoose.Schema(
	{
		productId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'product',
			required: true,
		},
		productSku: {
			type: String,
			required: true,
		},
		dependentProductId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'product',
			required: true,
		},
		dependentProductSku: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true }
);

const salePolicyDependentProductModel = mongoose.model('salePolicyDependentProducts', salePolicyDependentProductsSchema);
module.exports = salePolicyDependentProductModel;
