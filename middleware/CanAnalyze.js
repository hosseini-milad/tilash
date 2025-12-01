const tasks = require('../models/crm/tasks');

const CanAnalyze = async (orderNo) => {
	const taskData = await tasks.findOne({ orderNo }).lean();
    if (!taskData) {
        return 0;
    }
    if (taskData.taskStep === 'cancel' || taskData.taskStep === 'quote') {
        return 0;
    } else {
        return 1;
    }
};

module.exports = CanAnalyze;
