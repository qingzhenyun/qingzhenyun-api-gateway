
const CONFIG = require('../config/config')
const RequestUtil = require('../util/request_util')
const jwt = require('express-jwt')
function configureExpress(app){
    app.use(
        jwt({
            secret: CONFIG.JWT_SECRET_KEY,
            'getToken': (req) => {
                return RequestUtil.getToken(req)
                /*
                if(data){
                    logger4j.info('Token %s',data)
                    logger4j.info('Get UA %s',req.headers['user-agent'])
                }
                return data
                */
                /*
                var parts = req.headers.authorization.split(' ');
                if (parts.length == 2) {
                    var scheme = parts[0];
                    var credentials = parts[1];
                    if (/^Bearer$/i.test(scheme)) {
                        return token;
                    }
                } else {
                    return undefined
                }
                */
                //logger4j.info('Get token %s',req.query.token)
                //logger4j.info('Get UA %s',req.headers['user-agent'])
                // logger4j.info('', )
                
                /*
                if (req.headers.Authorization) {
                    return req.headers.Authorization
                }
                if (req.query && req.query.authorization) {
                    return req.query.authorization;
                }
                */
                
            }
        }).unless({
            path: ['/v1/user/login',
                '/v1/user/register',
                '/v1/user/check',
                '/v1/user/sendRegisterMessage',
                '/v1/user/loginByMessage',
                '/v1/user/sendLoginMessage',
                '/v1/user/sendChangePasswordMessage2',
                '/v1/user/changePasswordByMessage2',
                '/v1/user/checkUpdate',
                '/v1/store/callback/wcs',
                /^\/v1\/store\/callback\/wcsm3u8\/.*/,
                /^\/v1\/store\/callback\/detected\/.*/,
                '/v1/store/callback/wcsm3u8',
                '/v1/store/play',
                /^\/internal\/*/,
                /^\/v1\/common\/*/,
                /^\/v1\/store\/play\/.*/
            ]
        })
    )
}
module.exports = configureExpress