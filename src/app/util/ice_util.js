const Ice = require('ice').Ice
const Long = Ice.Long
class IceUtil{
    static number2IceLong(number){
        return new Long(number)
    }

    static iceLong2Number(obj) {
        return (new Long(obj['high'], obj['low'])).toNumber()
    }
}

module.exports = IceUtil