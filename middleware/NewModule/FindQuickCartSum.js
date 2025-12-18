const { TaxRate } = process.env
const findQuickCartSum=async(cartItems, payValue, discount ,transportPrice) => {
    if (!cartItems) return ({ totalPrice: 0, totalCount: 0 })
    var cartSum = 0;
    var cartCount = 0;
    var cartDescription = ''
    var cartDiscount = 0;
    var tPrice = Number(transportPrice)
    for (var i = 0; i < cartItems.length; i++) {
        try {//console.log(payValue)
            var fixPrice = cartItems[i].fixPrice
            var cartItemPrice = ''
            try {
                cartItemPrice = cartItems[i].price.find(item => item.saleType === payValue).price
                    .replace(/,/g, '').replace(/^\D+/g, '')
            }
            catch {
                cartItemPrice = cartItems[i].price && cartItems[i].price
                    .replace(/,/g, '').replace(/^\D+/g, '')
            }
            if(fixPrice) cartItemPrice = fixPrice
            //console.log(cartItemPrice)
            var newCount = parseInt(cartItems[i].count.toString().replace(/,/g, '').replace(/^\D+/g, ''))
            if (cartItems[i].price)
                cartSum += parseInt(cartItemPrice) * newCount

            if (cartItems[i].count)
                cartCount += newCount
            cartDescription += cartItems[i].description ? cartItems[i].description : ''

            if (cartItems[i].discount) {
                var off = parseInt(cartItems[i].discount.toString().replace(/,/g, '').replace(/^\D+/g, ''))

                if (off > 100)
                    cartDiscount += off
                else
                    cartDiscount += parseInt(cartItemPrice) *
                        newCount * (off) / 100
                //console.log(off+": "+cartDiscount)
            }
        } catch { }

    }
    if (discount) {
        if (parseInt(discount) > 100)
            cartDiscount += parseInt(discount)
        else
            cartDiscount += discount &&
                (parseInt(cartSum) *
                    parseInt(discount) / 100)
    }
    const totalPriceNoTax = cartSum - cartDiscount
    var totalPrice = (totalPriceNoTax * (1 + Number(TaxRate)))
    if(tPrice){
        totalPrice += tPrice
    }
    return ({
        totalFee: cartSum,
        totalCount: cartCount,
        transportPrice:tPrice,
        totalDiscount: cartDiscount,
        totalTax: (totalPriceNoTax * Number(TaxRate)),
        totalPrice: totalPrice,
        cartDescription: cartDescription
    })
}
module.exports =findQuickCartSum