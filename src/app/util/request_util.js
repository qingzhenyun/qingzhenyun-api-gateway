const ApiException = require('../exception/api_exception')
const REG_MOBILE_CLIENT = /CFNetwork|okhttp/i
const validator = require('validator')

class RequestUtil {
    static getIp(req) {
        return req.headers['x-real-ip'] || req.connection.remoteAddress
    }

    static writeLoginMessage(req, dat) {
        req.user = {
            'uuid': dat.uuid,
            'name': dat.name,
            'email': dat.email,
            'phone': dat.phone,
            'refreshTime': (new Date()).getTime(),
            'version': dat.version
        }
    }
    static getDevice(req) {
        return RequestUtil.isMobile(req) ? 'mobile' : 'pc'
    }

    static isMobile(req) {
        let ua = req.headers['user-agent']
        return REG_MOBILE_CLIENT.test(ua)
    }

    static getPageObjecet(req) {
        let page = RequestUtil.getInt(req,'page',1)
        if (page < 1) {
            page = 1
        }
        let pageSize = RequestUtil.getInt(req,'pageSize',20)
        if (pageSize < 1) {
            pageSize = 20
        }
        if (pageSize > 999) {
            pageSize = 999
        }
        return { 'page': page, 'pageSize': pageSize }
    }

    static getIntArray(req,param){
        let type = req.body[param]
        if(!Array.isArray(type)){
            type = [RequestUtil.getInt(req,param,NaN)]
        }
        return type.filter(data => Number.isInteger(data))
    }

    static getInt(req, param, defaultValue = -1) {
        let data = RequestUtil.getString(req,param)
        if(data === ''){
            return defaultValue
        }
        if(!validator.isInt(data)){
            return defaultValue
        }
        return parseInt(data)
    }

    static getString(req, param, defaultValue = '') {
        let data = req.body[param]
        if (data === null || data === undefined || Number.isNaN(data)) {
            return defaultValue
        }
        return data.toString()
    }

    static getIntFromParam(req, param, defaultValue = -1) {
        let data = RequestUtil.getStringFromParam(req,param)
        if(data === ''){
            return defaultValue
        }
        if(!validator.isInt(data)){
            return defaultValue
        }
        return parseInt(data)
    }

    static getStringFromParam(req, param, defaultValue = '') {
        let data = req.params[param]
        if (data === null || data === undefined || Number.isNaN(data)) {
            return defaultValue
        }
        return data.toString()
    }

    static getBoolean(req, param, defaultValue = false){
        let data = RequestUtil.getString(req,param)
        if(data === ''){
            return defaultValue
        }
        let toLower = data.trim().toLowerCase()
        if(toLower === 'yes' || toLower === '1' || toLower === 'true'){
            return true
        }
        return false
    }

    static getToken(req) {
        let pre = req.headers.authorization ? req.headers.authorization : (req.headers.Authorization ? req.headers.Authorization : undefined)
        if (pre) {
            let parts = pre.split(' ')
            if (parts.length == 2) {
                var scheme = parts[0]
                var credentials = parts[1]
                if (/^Bearer$/i.test(scheme)) {
                    return credentials
                } else {
                    throw new ApiException('Format is Authorization: Bearer [token]', 401, 'BEARER_AUTHORIZATION_HEADER_INVALID')
                }
            } else {
                return undefined
            }
        }
        let headToken = req.headers.token ? req.headers.token : req.headers.Token
        if(headToken){
            return headToken
        }
        if (req.query && req.query.auth) {
            return req.query.auth
        }
        if (req.query && req.query.token) {
            return req.query.token
        }
        if (req.body && req.body.token) {
            return req.body.token
        }
        return undefined
    }
}
module.exports = RequestUtil