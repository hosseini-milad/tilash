var Kavenegar = require('kavenegar');
var api = Kavenegar.KavenegarApi({
  apikey: process.env.SMS_API
});

const SendSMS=async(phone,template,token,token2)=>{
    const query = {
        token: token,
        token2:token2,
        template: template,
        receptor: phone 
    }
    const result = api.VerifyLookup(query,function(response, status) {
        //console.log(query)
        //console.log(response)
        //console.log(status)
        return(response,status);
    });
    return result
}

module.exports =SendSMS