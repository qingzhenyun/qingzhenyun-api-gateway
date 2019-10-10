const redisServiceInstance = require('./redis_service')
const logger = require('log4js').getLogger('PhoneValidator')
const ApiException = require('../exception/api_exception')
const ApiValidateException = require('../exception/api_validate_exception')
const smsSender = require('../service/sms_sender')
const TimeUtil = require('../util/time_util')
const VALIDATE_FLAGS = require('../constant/phone')

const CODE_EXPIRE_IN_MINUTES = 5
const MAX_TRY_TIME = 5
class PhoneValidator {
    constructor() {
        this.redisService = redisServiceInstance
    }

    sendRegisterMessage(countryCode, phone, flag, code) {
        return this.sendMessageWithCode(countryCode, phone, flag, code, VALIDATE_FLAGS.REGISTER_TEMPL_ID, [], CODE_EXPIRE_IN_MINUTES)
    }

    sendResetPasswordMessage(countryCode, phone, flag, code) {
        return this.sendMessageWithCode(countryCode, phone, flag, code, VALIDATE_FLAGS.RESET_PASSWORD_TEMPL_ID, [], CODE_EXPIRE_IN_MINUTES)
    }

    sendLoginMessage(countryCode, phone, flag, code) {
        return this.sendMessageWithCode(countryCode, phone, flag, code, VALIDATE_FLAGS.LOGIN_TEMPL_ID, [], CODE_EXPIRE_IN_MINUTES)
    }

    async validateMessage(countryCode, phone, flag, code) {
        let current = TimeUtil.getCurrentTimeStamp()
        let key = this.getValidateKey(countryCode, phone, flag)
        let inDatabase = JSON.parse(await this.redisService.client.getAsync(key))
        if(inDatabase === null){
            return false
        }
        let expireTime = inDatabase['expireTime']
        if(current > expireTime){
            // delete return null
            await this.redisService.client.delAsync(key)
            return false
        }
        if(inDatabase['code'] === code){
            await this.redisService.client.delAsync(key)
            return true
        }else{
            if(inDatabase['fail'] < MAX_TRY_TIME){
                let expireInSeconds = parseInt((expireTime - current) / 1000)
                if(expireInSeconds < 1){
                    await this.redisService.client.delAsync(key)
                }else{
                    inDatabase['fail'] = inDatabase['fail'] + 1
                    await this.redisService.client.setAsync(key, JSON.stringify(inDatabase), 'EX', expireInSeconds)
                }
            }else{
                await this.redisService.client.delAsync(key)
            }
            return false
        }
    }

    async sendMessageWithCode(countryCode, phone, flag, code, tplId, args = [], expireInMinutes = CODE_EXPIRE_IN_MINUTES) {
        let expireInSeconds = (expireInMinutes + 1) * 60
        let key = this.getValidateKey(countryCode, phone, flag)
        let current = TimeUtil.getCurrentTimeStamp()
        let checkData = { 'code': code, 'createTime': current, 'fail': 0, 'expireTime': (current + expireInSeconds * 1000)}
        let inDatabase = JSON.parse(await this.redisService.client.getAsync(key))
        if (inDatabase !== null) {
            if (current - inDatabase.createTime < 60 * 1000) {
                // data feq
                throw new ApiException('Send message too frequently', 400, 'SEND_MESSAGE_FREQUENTLY')
            }
        }
        args.push(code, expireInMinutes.toString())
        await this.redisService.client.setAsync(key, JSON.stringify(checkData), 'EX', expireInSeconds)
        let result = await smsSender.sendWithParam(countryCode, phone, tplId, args)
        //let result = await smsSender.sendRegisterMessage(phone, code, countryCode, 5)
        let success = result['result'] === 0
        if (!success) {
            logger.error('Send message failed, server response %s', JSON.stringify(result))
            if (result['result'] === 1016) {
                throw new ApiValidateException('Phone not validate', 'PHONE_NOT_VALIDATE')
            }
        }
        return success
    }

    getValidateKey(countryCode, phone, flag) {
        return 'check_' + countryCode.toString() + phone.toString() + flag.toString()
    }
}
module.exports = new PhoneValidator()