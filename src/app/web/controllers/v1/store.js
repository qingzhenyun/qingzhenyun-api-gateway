const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const IceUtil = require('../../../util/ice_util')
// const ApiValidateException = require('../../../exception/api_validate_exception')
// const ApiNotFoundException = require('../../../exception/api_not_found_exception')
const Rpcs = require('../../../common/rpcs')
const PREVIEW_CONST = require('../../../constant/preview_const')
const logger = require('log4js').getLogger('controller::store')
const AwesomeBase64 = require('awesome-urlsafe-base64')
const previewService = require('../../../service/preview_service')
const SERVER_ID = require('../../../config/config').SERVER_ID
//const logger = require('log4js').getLogger('controller::files')
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

router.post('/token', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let name = RequestUtil.getString(req, 'name')
        let hash = RequestUtil.getString(req, 'hash')
        if (!hash) {
            hash = RequestUtil.getString(req, 'fileHash')
        }
        let parent = RequestUtil.getString(req, 'parent')
        let path = RequestUtil.getString(req, 'path')
        if (!name) {
            name = ''
        }
        let originalFilename = RequestUtil.getString(req, 'originalFilename')
        if(!originalFilename){
            originalFilename = ''
        }
        if(originalFilename === ''){
            if(path){
                let pt = path.split('/')
                originalFilename = pt[pt.length - 1]
            }
        }
        if (hash) {
            let fileData = await Rpcs.cloudStoreService.get(hash)
            if (fileData !== null) {
                // copy fileData
                return await copyFileDataToUserSpace(userId, parent, path, name, fileData)
            }
        }
        // create token userId: Long, parent: String?, path: String?, name: String
        return await Rpcs.cloudStoreService.createUploadToken(userId, parent, path, name,originalFilename)
    })
})


router.post('/callback/wcs', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let data = await Rpcs.cloudStoreService.uploadFile(req.body.callbackBody)
        let names = data.originalFilename.split('|@qzy_inner@|')
        let parent = names[0]
        let name = names[1]
        let path = names[2]
        let userId = data.uploadUser
        if (IceUtil.iceLong2Number(userId) < 1) {
            data.originalFilename = names[1]
            return data
        }
        return await copyFileDataToUserSpace(userId, parent, path, name, data)
    })
})


router.post('/callback/wcsm3u8/:encoded', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        if (!req.body) {
            logger.warn('Wcs callback empty.')
        }
        let encode = JSON.parse(AwesomeBase64.decode(req.params.encoded).toString('utf8'))
        let callback = JSON.parse(AwesomeBase64.decode(req.body).toString('utf8'))
        //let maxReslov = encode['reslov']
        let fileHash = encode['hash']
        //let encodeKey = encode['key']
        //let convertType = encode['type']
        // let success = false
        let callbackCode = parseInt(callback['code'])
        if (callbackCode !== 3) {
            logger.error('Task %s failed convert(code %s). info %s',
                fileHash, callbackCode, JSON.stringify(callback))
            // update convert status.
            try{
                await Rpcs.cloudStoreService.finishPreviewTask(SERVER_ID,fileHash, PREVIEW_CONST.STATUS_CONVERT_FAILED)
            }catch(exception){
                logger.error('Call cloudStoreService failed %s', exception)
            }
            return
        } else {
            // for each to fetch.
            let success = await previewService.buildAndWrite(encode, callback)
            let status = PREVIEW_CONST.STATUS_SUCCESS
            if(!success){
                status = PREVIEW_CONST.STATUS_SAVE_FAILED
            }
            try{
                await Rpcs.cloudStoreService.finishPreviewTask(SERVER_ID,fileHash, status)
            }catch(exception){
                logger.error('Call cloudStoreService failed %s', exception)
            }
        }
        /*
        logger.info(JSON.stringify(encode))
        logger.info(JSON.stringify(callback))
        */
    })
})

router.post('/callback/detected/:encoded', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        if (!req.body) {
            logger.warn('Wcs callback empty.')
        }
        let encode = JSON.parse(AwesomeBase64.decode(req.params.encoded).toString('utf8'))
        let callback = JSON.parse(AwesomeBase64.decode(req.body).toString('utf8'))
        

        /*
        let maxReslov = encode['reslov']
        
        let encodeKey = encode['key']
        let convertType = encode['type']
        let success = false
        let callbackCode = parseInt(callback['code'])
        if (callbackCode !== 3) {
            logger.error('Task %s failed convert(code %s). info %s',
                fileHash, callbackCode, JSON.stringify(callback))
            // update convert status.
        } else {
            logger.info(JSON.stringify(callback))
        }
        */
        logger.info(JSON.stringify(callback))
        logger.info(JSON.stringify(encode))
    })
})

const copyFileDataToUserSpace = async (userId, parent, path, name, fileData) => {

    // createFile(userId: Long, parent: String?, path: String?, name: String?, size: Long, storeId: String?
    //logger.info('Create file %s, %s, %s', parent,path,name)
    return await Rpcs.userFileService.createFile(userId, parent, path, name, fileData.size, fileData.hash)
}

module.exports = router