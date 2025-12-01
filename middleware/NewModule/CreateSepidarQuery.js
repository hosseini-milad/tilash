const CreateSepidarQuery=(data,items, faktorNo) => {
    const notNullCartItem = []
    for (var i = 0; i < items.length; i++)
        items[i].count ?
            notNullCartItem.push(items[i]) : ''
    const totalDiscount = parseInt(data&&data.discount)
    var query = {
        "GUID": "124ab075-fc79-417f-b2cf-2a" + faktorNo,
        "CustomerRef": 2200,
        "AddressRef": Number(data.userAddress) ? Number(data.userAddress) : '',
        "CurrencyRef": 1,
        "Description": faktorNo,
        "DescriptionRef": faktorNo,
        "SaleTypeRef": data.payValue ? Number(data.payValue) : 5,
        "Duty": 0.0000,
        "Items":
            notNullCartItem.map((item, i) => (
                {
                    "ItemRef": Number(item.ItemID),
                    "TracingRef": null,
                    "Description": item.description,
                    "StockRef": "13",//data.stockId,
                    "Quantity": Number(item.count),
                    "Fee": Number(item.price),
                    "Price": Number(item.price)*Number(item.count),
                    "Discount": 0,
                    "Tax": 0,
                    "Duty": 0.0000,
                    "Addition": 0.0000
                }))

    }
    return (query)
}
module.exports =CreateSepidarQuery