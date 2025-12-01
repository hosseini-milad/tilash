const profileModel = require('../models/auth/ProfileAccess');
const menuModel = require('../models/crm/menu');

const getAll = async (req, res) => {
	const LOG_NAME = 'getUserMenus';
	try {
		const menuItems = await menuModel.find();
		const data = menuItems.map((i) => {
			const temp = {
				_id: i._id,
				menuCode: i.menuCode,
				parent: i.parent,
				url: i.url,
				title: i.title,
				enTitle: i.enTitle,
			};
			return temp;
		});
		return res.send({ data, message: 'داده ها با موفقیت دریافت شد.' });
	} catch (err) {
		console.log(LOG_NAME, err);
		return res.status(500).send({ message: err.message });
	}
};

const create = async (req, res, next) => {
	const LOG_NAME = 'createMenuItem';
	try {
        const { menuCode, title, enTitle, url, parent } = req.body;
        if (!menuCode || !title || !enTitle) {
            return res.status(400).send({ message: 'کد منو، عنوان فارسی و انگلیسی الزامی است.' });
        }
		const newItem = await menuModel.create(req.body);
		// add new menu to all profiles
		if (newItem.parent) {
			const newMenu = {
				menuCode: newItem.menuCode,
				title: newItem.title,
				enTitle: newItem.enTitle,
				access: {
					read: false,
					create: false,
					update: false,
					delete: false,
				},
			};
			await profileModel.updateMany({}, { $push: { menusAccess: newMenu } });
		}
		return res.send({ data: newItem, message: 'منوی جدید با موفقیت ایجاد شد.' });
	} catch (err) {
		return res.status(500).send({ message: err.message });
	}
};

const getOne = async (req, res, next) => {
	const LOG_NAME = 'getMenuItem';
	try {
		const menuItem = await menuModel.findById(req.params.id);
		if (!menuItem) {
			return res.status(404).send({ message: 'منوی مورد نظر یافت نشد.' });
		}
		return res.send({ data: menuItem, message: 'منوی مورد نظر با موفقیت دریافت شد.' });
	} catch (err) {
		return res.status(500).send({ message: err.message });
	}
};

const editOne = async (req, res, next) => {
	const LOG_NAME = 'editMenuItem';
	try {
		const menuItem = await menuModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
		if (!menuItem) {
			return res.status(404).send({ message: 'منوی مورد نظر یافت نشد.' });
		}
		return res.send({ data: menuItem, message: 'منوی مورد نظر با موفقیت ویرایش شد.' });
	} catch (err) {
		return res.status(500).send({ message: err.message });
	}
};

const deleteOne = async (req, res, next) => {
	// #swagger.tags = [Panel/Menu]
	const LOG_NAME = 'deleteMenuItem';
	try {
		const menuItem = await menuModel.findByIdAndDelete(req.params.id);
		if (!menuItem) {
			return res.status(404).send({ message: 'منوی مورد نظر یافت نشد.' });
		}
		return res.send({ data: menuItem, message: 'منوی مورد نظر با موفقیت حذف شد.' });
	} catch (err) {
		return res.status(500).send({ message: err.message });
	}
};

module.exports = {
	getAll,
	create,
	getOne,
	editOne,
	deleteOne,
};
