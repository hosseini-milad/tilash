const customers = require("../../models/auth/customers");

const FindRepeat=async()=>{
    var cartData = await customers.aggregate([
        {"$group" : { "_id": "$username", "count": { "$sum": 1 } } },
        {"$match": {"_id" :{ "$ne" : null } , "count" : {"$gt": 1} } }, 
        {"$project": {"username" : "$_id", "_id" : 0} }
    ]);
    if(!cartData || !cartData.length) return('')
    const result = cartData[0]
    var repCustomer = await customers.find(result)
    return (repCustomer)
}

module.exports =FindRepeat