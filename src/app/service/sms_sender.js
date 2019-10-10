const QcloudSms = require('qcloudsms_js')
const randomstring = require('randomstring')
const logger = require('log4js').getLogger('SmsSender')
const smsConfig = require('../config/message_config')


class SmsSender {
    constructor(appid, appkey) {
        this.qcloudsms = QcloudSms(smsConfig.appid, smsConfig.appkey)
        this.appid = appid
        this.appkey = appkey
        logger.info('Init QcloudSms')
    }

    sendRegisterMessage(phoneNumber, validateCode, countryCode = '86', expireInMinutes = 5) {
        let templId = '94257'
        return this.sendWithParam(countryCode, phoneNumber, templId, [validateCode, expireInMinutes.toString()])
    }
    sendCommonMessage(phoneNumber, validateCode, templId, countryCode = '86', expireInMinutes = 5) {
        return this.sendWithParam(countryCode, phoneNumber, templId, [validateCode, expireInMinutes.toString()])
    }
    sendWithParam(countryCode, phoneNumber, templId, args) {
        let ssender = this.qcloudsms.SmsSingleSender()
        let messageId = randomstring.generate(12)
        return new Promise((reslove, reject) => {
            ssender.sendWithParam(countryCode, phoneNumber, templId, args, '', '', messageId, (err, res, resData) => {
                //let success = false
                if (err) {
                    logger.error(err)
                }
                if (resData) {
                    // success = resData['result'] === 0
                    reslove(resData)
                    return
                }
                if(err){
                    reject(err)
                    return
                }
                reslove({'result':-10001,'message':'send failed..'})
                /*
                if (success) {
                    reslove(resData)
                } else {
                    let code = 0
                    
                    if (resData) {
                        logger.error('Return fail')
                        code = resData['result']
                        logger.error(resData)
                    }
                    reject(code)
                }
                */
            })
        })
    }

}
module.exports = new SmsSender()