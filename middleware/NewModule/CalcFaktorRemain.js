const CalcFaktorRemain=(netPrice,bankData)=>{
	if(!bankData || bankData.length == 0)
		return netPrice
	var bankTotal = 0
	for(var b = 0;b<bankData.length;b++){
		if(!bankData[b].amount) return 0
		bankTotal += Number(bankData[b].amount)
	}
	return Number(netPrice) - bankTotal

}
module.exports =CalcFaktorRemain