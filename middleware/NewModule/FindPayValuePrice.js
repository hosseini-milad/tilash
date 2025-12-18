const findPayValuePrice = (priceArray, payValue) => {
	if (!priceArray) return (0)
	if (!payValue) payValue = 3
	var price = priceArray
	if (priceArray.length && priceArray.constructor === Array)
		price = priceArray.find(item => item.saleType == payValue).price

	return (price)

}
module.exports =findPayValuePrice