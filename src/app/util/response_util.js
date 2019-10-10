const ApiException = require('../exception/api_exception')
const jwt = require('jsonwebtoken')
const CONFIG = require('../config/config')
const IceUtil = require('./ice_util')
const logger = require('log4js').getLogger('ResponseUtil')
class ResponseUtil {
    static Ok(req, res, data) {
        // logger.info('Response %s', JSON.stringify(data))
        ResponseUtil.json(req, res, {
            status: 200,
            result: data,
            code: 'OK',
            success: true
        })
    }

    static async tryRun(req, res, func) {
        try {
            let data = await func.apply(null)
            if (data instanceof Promise) {
                data.then(finData => ResponseUtil.Ok(req, res, finData)).error(err => ResponseUtil.RenderStandardRpcError(req, res, err))
            } else {
                ResponseUtil.Ok(req, res, data)
            }
        } catch (error) {
            ResponseUtil.RenderStandardRpcError(req, res, error)
        }
    }


    static RenderStandardRpcError(req, res, error) {
        if (error['innerCode']) {
            ResponseUtil.ApiError(req, res, new ApiException(error['innerMessage'], 400, error['innerMessage']))
        } else {
            if (error instanceof ApiException) {
                ResponseUtil.ApiError(req, res, error)
            } else {
                ResponseUtil.Error(req, res, error)
            }

        }
    }

    static OkOrError(req, res, error, data) {
        if (error) {
            //console.error(error)
            //throw new ApiException('Internal Server Error', undefined, undefined, false)
            ResponseUtil.Error(req, res, error)
            return
        }
        ResponseUtil.json(req, res, {
            status: 200,
            result: data,
            code: 'OK',
            success: true
        })
    }

    static Error(req, res, error) {
        if (error) {
            logger.warn('Access [%s] %s error ', req.method, req.originalUrl)
            logger.error(error)
        }
        res.status(200)
        ResponseUtil.json(req, res, {
            status: 500,
            code: 'INTERNAL_ERROR',
            message: 'Server can\'t handle your request now.',
            success: false
        })
        //throw new ApiException('Internal Server Error', undefined, undefined, false)
        //res.json({ status: 200, result: data, code: "OK", success: true })
    }

    static ApiError(req, res, err) {
        if (!err) {
            ResponseUtil.Error(req, res, err)
            return
        }
        if (!err['supress']) {
            logger.error(err.stack)
        }
        let status = err.status || 500
        res.status(200)
        let data = {
            success: false,
            message: err.message
        }
        if (err['code']) {
            data.code = err['code']
        } else {
            data.code = 'INTERNAL_SERVER_ERROR'
        }
        data.status = status
        ResponseUtil.json(req, res, data)
        //throw new ApiException('Internal Server Error', undefined, undefined, false)
        //res.json({ status: 200, result: data, code: "OK", success: true })
    }

    static ApiErrorAsOk(req, res, err) {
        if (!err) {
            ResponseUtil.Ok(req, res, err)
            return
        }
        if (!err['supress']) {
            logger.error(err.stack)
        }
        let status = err.status || 500
        res.status(200)
        let data = {
            success: false,
            message: err.message
        }
        if (err['code']) {
            data.code = err['code']
        } else {
            data.code = 'INTERNAL_SERVER_ERROR'
        }
        data.status = status
        ResponseUtil.json(req, res, data)
        //throw new ApiException('Internal Server Error', undefined, undefined, false)
        //res.json({ status: 200, result: data, code: "OK", success: true })
    }

    static json(req, res, data) {
        if (req.user) {
            //Sign And put
            let auth = ResponseUtil.generateToken(req)
            res.header('Authorization', 'Bearer ' + auth)
            if (data) {
                data['token'] = auth
            } else {
                data = {
                    'token': auth
                }
            }
        }
        res.json(ResponseUtil.preProcessObject(data))
    }

    static generateToken(req) {
        let dat = req.user
        //console.log(dat)
        return jwt.sign({
            'uuid': dat.uuid,
            'name': dat.name,
            'email': dat.email,
            'phone': dat.phone,
            'lastLoginTime': dat.lastLoginTime,
            'refreshTime': dat.refreshTime,
            'version': dat.version
        }, CONFIG.JWT_SECRET_KEY, { expiresIn: '30d' })
    }

    static isObj(obj) {
        return typeof obj === 'object' && obj !== null
    }

    static needConvert(obj) {
        //const keys = Object.keys(obj)
        //if (keys.includes('high') && keys.includes('low')) {
        //const Constants = require('../const/constants')
        //
        // return false
        //}
        return typeof (obj)['high'] === 'number' && typeof (obj)['low'] === 'number'
    }

    static preProcessObject(obj) {
        if (!ResponseUtil.isObj(obj)) return obj
        if (ResponseUtil.needConvert(obj)) {
            return IceUtil.iceLong2Number(obj)
        }
        for (let key of Object.keys(obj)) {
            let value = obj[key]
            if (ResponseUtil.isObj(value)) {
                //
                if (ResponseUtil.needConvert(value)) {
                    obj[key] = IceUtil.iceLong2Number(value)
                } else {
                    obj[key] = ResponseUtil.preProcessObject(value)
                }
            }
        }
        return obj
    }

    /*
    static preProcessObject(obj) {
        //
        if (typeof (obj) == 'object') {
            if (typeof (obj['toNumber']) == 'function') {
                return obj.toNumber()
            }
            // Foreach
        }
        return onk
    }
    */
}
module.exports = ResponseUtil