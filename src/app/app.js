const express = require('express')
const app = express()
const logger = require('log4js').getLogger('app.js')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const ApiException = require('./exception/api_exception')
const CONFIG = require('./config/config')
const ResponseUtil = require('./util/response_util')
const configureExpress = require('./util/configure_express')
const rpcs = require('./common/rpcs')
const mongo = require('./common/mongodbs')
const cors = require('cors')

rpcs.initialize()
mongo.init()
// Init rpc
// const communicator = ice.initialize(process.argv)

// Init express
const corsOptions = {
    /*
    origin: '*',
    methods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ["X-Requested-With"],
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
    */

    'origin': '*',
    'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
    'preflightContinue': false,
    'optionsSuccessStatus': 200
}
app.use(cors(corsOptions))
app.use(cookieParser())
app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.urlencoded({
    extended: false
}))

app.use('/v1/store/callback/wcsm3u8', bodyParser.text())
app.use(/^\/v1\/store\/callback\/wcsm3u8\/.*/, bodyParser.text())
app.use(/^\/v1\/store\/callback\/detected\/.*/, bodyParser.text())
configureExpress(app)
app.use((req, res, next) => {
    if (req.user) {
        if (req.user.version !== CONFIG.USER_VERSION) {
            let err = new ApiException('User JWT version not match. please login again', 401, 'USER_VERSION_NOT_MATCH')
            //console.log(req.user)
            next(err)
        } else {
            next()
        }
    } else {
        next()
    }

})

app.use('/v1', require('./web/controllers/v1'))
app.use('/internal', require('./web/controllers/internal'))
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    let err = new ApiException('Recource not found.', 404, 'RESOURCE_NOT_FOUND')
    next(err)
})

// error handler
// eslint-disable-next-line no-unused-vars
app.use(function (err, req, res, next) {
    if (!err['supress'] && err.name !== 'UnauthorizedError') {
        logger.error(err.stack)
    }
    let status = err.status || 500
    res.status(status)
    let data = {
        success: false,
        message: err.message
    }
    if (err['code']) {
        data.code = (err['code'] + '').toUpperCase()
    } else {
        data.code = 'INTERNAL_SERVER_ERROR'
    }
    data.status = status
    ResponseUtil.json(req, res, data)
})
module.exports = app