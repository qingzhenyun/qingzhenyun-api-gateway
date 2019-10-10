const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
//const IceUtil = require('../../../util/ice_util')
const StringUtil = require('../../../util/string_util')
const validator = require('validator')
const Rpcs = require('../../../common/rpcs')
const randomstring = require('randomstring')
const ApiValidateException = require('../../../exception/api_validate_exception')
const ApiException = require('../../../exception/api_exception')
const phoneValidator = require('../../../service/phone_validator')
const VALIDATE_FLAGS = require('../../../constant/phone')
const RequestUtil = require('../../../util/request_util')
const logger = require('log4js').getLogger('controller::user')

router.post('/sendRegisterMessage', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = randomstring.generate({
            charset: 'numeric',
            length: 6
        })
        let countryCode = (req.body['countryCode'] + '').replace(/[^0-9]/ig, '')
        let phone = (req.body['phone'] + '').replace(/[^0-9]/ig, '')
        if (!phone || !(typeof (phone) === 'string')) {
            throw new ApiValidateException('Phone required', '{PHONE}_REQUIRED')
        }
        if (!countryCode || (typeof (countryCode) !== 'string')) {
            countryCode = '86'
        }
        //user exists
        let exists = (await Rpcs.userCenterService.getUserByPhone(countryCode, phone)) !== null
        if (exists) {
            throw new ApiValidateException('User phone exists', 'USER_PHONE_EXIST')
        }
        let flag = VALIDATE_FLAGS.VALIDATE_PHONE_FLAG
        let checkMessageResult = await phoneValidator.sendRegisterMessage(countryCode,
            phone,
            flag,
            code)
        if (!checkMessageResult) {
            throw new ApiException('Cannot send message, try again later.', 500, 'SEND_MESSAGE_ERROR')
        }
        return StringUtil.encodeHashStrings(countryCode, phone, flag)
    })
})

router.post('/register', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = (req.body['code'] + '').replace(/[^0-9]/ig, '')
        let name = req.body['name']
        if (!name || typeof (name) !== 'string') {
            name = randomstring.generate(16)
        }
        if (StringUtil.isEmpty(code)) {
            throw new ApiValidateException('Code required', '{CODE}_REQUIRED')
        }
        let phoneInfo = req.body['phoneInfo'] + ''
        if (StringUtil.isEmpty(phoneInfo)) {
            throw new ApiValidateException('Phone info required', '{PHONE_INFO}_REQUIRED')
        }
        let validateCodeDecode = StringUtil.decodeHashStrings(phoneInfo)
        if (!validateCodeDecode || validateCodeDecode.length !== 3) {
            throw new ApiValidateException('Phone info not valid', '{PHONE_INFO}_NOT_VALID')
        }
        //countryCode, phone, flag
        if (validator.isEmail(name)) {
            throw new ApiValidateException('User name exists', '{NAME}_EXISTS')
        }
        if (validator.isInt(name)) {
            throw new ApiValidateException('User name exists', '{NAME}_EXISTS')
        }
        let password = req.body['password'] + ''
        if (StringUtil.isEmpty(password)) {
            throw new ApiValidateException('User password required', '{PASSWORD}_REQUIRED')
        }
        password = password.toLowerCase().trim()
        if(password.length != 32){
            throw new ApiValidateException('Password must be MD5 encoded(32 len)', '{PASSWORD}_MUST_MD5_ENCODE')
        }
        let flag = 10
        let phone = validateCodeDecode[1]
        let countryCode = validateCodeDecode[0]
        // Check message validate.
        let validateResult = await phoneValidator.validateMessage(countryCode, phone, flag, code)
        if (!validateResult) {
            throw new ApiValidateException('Code not valid', '{CODE}_NOT_VALID')
        }

        password = password.toLowerCase().trim()
        if(password.length != 32){
            throw new ApiValidateException('Password must be MD5 encoded(32 len)', '{PASSWORD}_MUST_MD5_ENCODE')
        }
        // Register RPC
        // No front server like nginx.
        //let ip = req.headers['x-real-ip'] || req.connection.remoteAddress
        let ip = RequestUtil.getIp(req)
        let device = RequestUtil.getDevice(req)
        let dat = await Rpcs.userCenterService.registerUser(name, password, countryCode, phone, ip, device)
        RequestUtil.writeLoginMessage(req, dat)
        return dat
    })
})


router.post('/login', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let value = req.body['value']
        let password = req.body['password']
        let countryCode = (req.body['countryCode'] + '').replace(/[^0-9]/ig, '')
        if (!countryCode) {
            countryCode = '86'
        }
        if (StringUtil.isEmpty(value)) {
            throw new ApiValidateException('Check value required', '{VALUE}_REQUIRED')
        }
        if (StringUtil.isEmpty(password)) {
            throw new ApiValidateException('User password required', '{PASSWORD}_REQUIRED')
        }
        // logger.info('Login: %s:%s', value, password)
        let device = RequestUtil.getDevice(req)
        // 
        let dat = null
        if (validator.isInt(value)) {
            dat = await Rpcs.userCenterService.loginByPhone(countryCode, value, password, device)
        } else {
            dat = await Rpcs.userCenterService.loginByName(value, password, device)
        }
        if (dat !== null) {
            RequestUtil.writeLoginMessage(req, dat)
        }
        return dat
    })
})

/*****
 * Login By Message
 */

router.post('/sendLoginMessage', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = randomstring.generate({
            charset: 'numeric',
            length: 6
        })
        let countryCode = (req.body['countryCode'] + '').replace(/[^0-9]/ig, '')
        let phone = (req.body['phone'] + '').replace(/[^0-9]/ig, '')
        if (!phone || !(typeof (phone) === 'string')) {
            throw new ApiValidateException('Phone required', '{PHONE}_REQUIRED')
        }
        if (!countryCode || !(typeof (countryCode) === 'string')) {
            countryCode = '86'
        }
        //user exists
        let exists = (await Rpcs.userCenterService.getUserByPhone(countryCode, phone)) !== null
        if (!exists) {
            throw new ApiValidateException('User phone not exists', 'USER_PHONE_NOT_EXIST')
        }
        let flag = VALIDATE_FLAGS.LOGIN_PHONE_FLAG

        let checkMessageResult = await phoneValidator.sendLoginMessage(countryCode,
            phone,
            flag,
            code)
        if (!checkMessageResult) {
            throw new ApiException('Cannot send message, try again later.', 500, 'SEND_MESSAGE_ERROR')
        }
        return StringUtil.encodeHashStrings(countryCode, phone, flag)
        // 97082
    })
})

// 
router.post('/loginByMessage', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = (req.body['code'] + '').replace(/[^0-9]/ig, '')
        if (StringUtil.isEmpty(code)) {
            throw new ApiValidateException('Code required', '{CODE}_REQUIRED')
        }
        let phoneInfo = req.body['phoneInfo'] + ''
        if (StringUtil.isEmpty(phoneInfo)) {
            throw new ApiValidateException('Phone info required', '{PHONE_INFO}_REQUIRED')
        }
        let validateCodeDecode = StringUtil.decodeHashStrings(phoneInfo)
        if (!validateCodeDecode || validateCodeDecode.length !== 3) {
            throw new ApiValidateException('Phone info not valid', '{PHONE_INFO}_NOT_VALID')
        }
        let flag = VALIDATE_FLAGS.LOGIN_PHONE_FLAG
        let phone = validateCodeDecode[1]
        let countryCode = validateCodeDecode[0]
        let validateResult = await phoneValidator.validateMessage(countryCode, phone, flag, code)
        if (!validateResult) {
            throw new ApiValidateException('Code not valid', '{CODE}_NOT_VALID')
        }
        let device = RequestUtil.getDevice(req)
        let dat = await Rpcs.userCenterService.loginByMessage(countryCode, phone, device)
        if (dat !== null) {
            RequestUtil.writeLoginMessage(req, dat)
        }
        return dat
    })
})


router.post('/logout', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let device = RequestUtil.getDevice(req)
        let userId = req.user.uuid
        let succ = await Rpcs.userCenterService.logout(userId, device)
        delete req.user
        return succ !== null
    })
})

router.post('/info', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        return await Rpcs.userCenterService.getUserByUuid(userId)
    })
})

router.post('/changeName', (req, res) => {

    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let name = RequestUtil.getString(req,'name','')
        if(!name){
            return false
        }
        if (validator.isInt(name)) {
            throw new ApiValidateException('User name exists', '{NAME}_EXISTS')
        }
        // let newPassword = req.body['newPassword'] + ''
        return await Rpcs.userCenterService.changeName(userId, name)
    })
})

router.post('/changeNameAndGet', (req, res) => {

    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let name = RequestUtil.getString(req,'name','')
        if(!name){
            return false
        }
        if (validator.isInt(name)) {
            throw new ApiValidateException('User name exists', '{NAME}_EXISTS')
        }
        // let newPassword = req.body['newPassword'] + ''
        return await Rpcs.userCenterService.changeNameAndGet(userId, name)
    })
})

router.post('/checkUpdate', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        //let userId = req.user.uuid
        let version = RequestUtil.getInt(req,'version', -1)
        let platform = RequestUtil.getInt(req,'platform', -1)
        let type = RequestUtil.getInt(req,'type', -1)
        let arch = RequestUtil.getInt(req,'arch', -1)
        // 
        let result = await Rpcs.userCenterService.fetchAvailableUpdate(version,type)
        if(result.length > 0){
            [].filter((val) => {
                if(platform > -1){
                    if(!(val['platform'] & platform)){
                        return false
                    }
                }
                if(arch > -1){
                    if(!(val['arch'] & arch)){
                        return false
                    }
                }
                return true
            })
        }
        return await Rpcs.userCenterService.fetchAvailableUpdate(version,type)
    })
})

/**
 * Change user password
 */

router.post('/changePassword', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let newPassword = req.body['newPassword'] + ''
        let oldPassword = req.body['oldPassword'] + ''
        if (StringUtil.isEmpty(newPassword)) {
            throw new ApiValidateException('New password required', '{NEW_PASSWORD}_REQUIRED')
        }
        newPassword = newPassword.toLowerCase().trim()
        if(newPassword.length != 32){
            throw new ApiValidateException('Password must be MD5 encoded(32 len)', '{PASSWORD}_MUST_MD5_ENCODE')
        }
        if (StringUtil.isEmpty(oldPassword)) {
            throw new ApiValidateException('Old password required', '{OLD_PASSWORD}_REQUIRED')
        }
        let data = await Rpcs.userCenterService.changePassword(userId, oldPassword, newPassword)
        if(!data){
            throw new ApiValidateException('Change password failed', '{CHANGE_PASSWORD}_FAILED')
        }
        return data
    })
})

/**
 * Change user password (Login)
 */

router.post('/sendChangePasswordMessage', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = randomstring.generate({
            charset: 'numeric',
            length: 6
        })
        let userId = req.user.uuid
        let userInfo = await Rpcs.userCenterService.getUserByUuid(userId)
        if (userInfo === null) {
            throw new ApiValidateException('User not found', 'USER_NOT_FOUND')
        }
        let countryCode = userInfo.countryCode
        let phone = userInfo.phone
        if (!phone || !(typeof (phone) === 'string')) {
            throw new ApiValidateException('Phone required', '{PHONE}_REQUIRED')
        }
        if (!countryCode || !(typeof (countryCode) === 'string')) {
            countryCode = '86'
        }
        let flag = VALIDATE_FLAGS.CHANGE_PASSWORD_LOGIN_FLAG
        let checkMessageResult = await phoneValidator.sendResetPasswordMessage(countryCode,
            phone,
            flag,
            code)
        if (!checkMessageResult) {
            throw new ApiException('Cannot send message, try again later.', 500, 'SEND_MESSAGE_ERROR')
        }
        return StringUtil.encodeHashStrings(countryCode, phone, flag)
    })
})

router.post('/changePasswordByMessage', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = (req.body['code'] + '').replace(/[^0-9]/ig, '')
        let newPassword = req.body['newPassword'] + ''
        if (StringUtil.isEmpty(newPassword)) {
            throw new ApiValidateException('New password required', '{NEW_PASSWORD}_REQUIRED')
        }
        newPassword = newPassword.toLowerCase().trim()
        if(newPassword.length != 32){
            throw new ApiValidateException('Password must be MD5 encoded(32 len)', '{PASSWORD}_MUST_MD5_ENCODE')
        }
        if (StringUtil.isEmpty(code)) {
            throw new ApiValidateException('Code required', '{CODE}_REQUIRED')
        }
        let phoneInfo = req.body['phoneInfo'] + ''
        if (StringUtil.isEmpty(phoneInfo)) {
            throw new ApiValidateException('Phone info required', '{PHONE_INFO}_REQUIRED')
        }
        let validateCodeDecode = StringUtil.decodeHashStrings(phoneInfo)
        if (!validateCodeDecode || validateCodeDecode.length !== 3) {
            throw new ApiValidateException('Phone info not valid', '{PHONE_INFO}_NOT_VALID')
        }
        let flag = VALIDATE_FLAGS.CHANGE_PASSWORD_LOGIN_FLAG
        let phone = validateCodeDecode[1]
        let countryCode = validateCodeDecode[0]
        // Check message validate.
        let validateResult = await phoneValidator.validateMessage(countryCode, phone, flag, code)
        if (!validateResult) {
            throw new ApiValidateException('Code not valid', '{CODE}_NOT_VALID')
        }
        let userId = req.user.uuid
        let userInfo = await Rpcs.userCenterService.getUserByUuid(userId)
        if (userInfo === null) {
            throw new ApiValidateException('User not found', 'USER_NOT_FOUND')
        }
        if(userInfo.phone !== phone){
            logger.warn('User [%s] phone (%s) not match [%s]', JSON.stringify(userId), userInfo.phone, phone)
            throw new ApiValidateException('User phone not match.', 'USER_PHONE_NOT_MATCH')
        }
        // let newPassword = req.body['newPassword'] + ''
        return await Rpcs.userCenterService.changePasswordByUuid(userId, newPassword)
    })
})

/**
 * Change user password (NotLogin)
 */
router.post('/sendChangePasswordMessage2', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = randomstring.generate({
            charset: 'numeric',
            length: 6
        })
        let countryCode = (req.body['countryCode'] + '').replace(/[^0-9]/ig, '')
        let phone = (req.body['phone'] + '').replace(/[^0-9]/ig, '')
        if (!phone || !(typeof (phone) === 'string')) {
            throw new ApiValidateException('Phone required', '{PHONE}_REQUIRED')
        }
        if (!countryCode || !(typeof (countryCode) === 'string')) {
            countryCode = '86'
        }

        //user exists
        let exists = await Rpcs.userCenterService.getUserByPhone(countryCode, phone)
        if(exists === null){
            throw new ApiValidateException('User phone not found','USER_PHONE_NOT_FOUND')
        }
        let flag = VALIDATE_FLAGS.CHANGE_PASSWORD_NO_LOGIN_FLAG
        let checkMessageResult = await phoneValidator.sendResetPasswordMessage(countryCode,
            phone,
            flag,
            code)
        if (!checkMessageResult) {
            throw new ApiException('Cannot send message, try again later.', 500, 'SEND_MESSAGE_ERROR')
        }
        return StringUtil.encodeHashStrings(countryCode, phone, flag)
    })
})

router.post('/changePasswordByMessage2', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let code = (req.body['code'] + '').replace(/[^0-9]/ig, '')
        if (StringUtil.isEmpty(code)) {
            throw new ApiValidateException('Code required', '{CODE}_REQUIRED')
        }
        let newPassword = req.body['newPassword'] + ''
        if (StringUtil.isEmpty(newPassword)) {
            throw new ApiValidateException('New password required', '{NEW_PASSWORD}_REQUIRED')
        }
        newPassword = newPassword.toLowerCase().trim()
        if(newPassword.length != 32){
            throw new ApiValidateException('Password must be MD5 encoded(32 len)', '{PASSWORD}_MUST_MD5_ENCODE')
        }
        let phoneInfo = req.body['phoneInfo'] + ''
        if (StringUtil.isEmpty(phoneInfo)) {
            throw new ApiValidateException('Phone info required', '{PHONE_INFO}_REQUIRED')
        }
        let validateCodeDecode = StringUtil.decodeHashStrings(phoneInfo)
        if (!validateCodeDecode || validateCodeDecode.length !== 3) {
            throw new ApiValidateException('Phone info not valid', '{PHONE_INFO}_NOT_VALID')
        }
        let flag = VALIDATE_FLAGS.CHANGE_PASSWORD_NO_LOGIN_FLAG
        let phone = validateCodeDecode[1]
        let countryCode = validateCodeDecode[0]
        // Check message validate.
        let validateResult = await phoneValidator.validateMessage(countryCode, phone, flag, code)
        if (!validateResult) {
            throw new ApiValidateException('Code not valid', '{CODE}_NOT_VALID')
        }
        // check user
        //validate user exists first.
        let userInfo = await Rpcs.userCenterService.getUserByPhone(countryCode, phone)
        if(userInfo === null){
            throw new ApiValidateException('User not found', 'USER_NOT_FOUND')
        }
        return await Rpcs.userCenterService.changePasswordByUuid(userInfo.uuid, newPassword)
    })
})
module.exports = router