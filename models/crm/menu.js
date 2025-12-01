const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema(
	{
		menuCode: { type: String, required: true },
		title: { type: String, required: true },
		enTitle: { type: String, required: true },
		url: { type: String },
		parent: { type: String },
	},
	{ timestamps: true }
);

const menuModel = mongoose.model('menu', menuSchema);
module.exports = menuModel;
