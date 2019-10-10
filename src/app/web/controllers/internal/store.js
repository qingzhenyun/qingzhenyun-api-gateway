const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const IceUtil = require('../../../util/ice_util')
const logger = require('../../../common/logger').getLogger('internal::store')
const ApiValidateException = require('../../../exception/api_validate_exception')
const Rpcs = require('../../../common/rpcs')
const previewService = require('../../../service/preview_service')


router.post('/getEx', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let hash = RequestUtil.getString(req, 'hash', undefined)
        if (!hash) {
            throw new ApiValidateException('File hash required.', '{HASH}_REQUIRED')
        }
        return await Rpcs.cloudStoreService.getEx(hash, IceUtil.number2IceLong(-1), true)
    })
})

router.post('/fetchPreviewTask', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let serverId = RequestUtil.getString(req, 'serverId')
        if (!serverId) {
            let serverIp = RequestUtil.getIp(req)
            logger.info('Unknown server %s access fetchTask.', serverIp)
            serverId = 'Unknown-' + serverIp
        }
        // start fetch..
        let size = RequestUtil.getInt(req, 'size', 5)
        let nextStatus = RequestUtil.getInt(req, 'nextStatus', 10)
        if (size < 0) {
            size = 5
        }
        let status = RequestUtil.getIntArray(req, 'status')
        if (status.length < 1) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        return await Rpcs.cloudStoreService.fetchPreviewTask(serverId, status, nextStatus, size)
    })
})

//getKnownMimeList
router.post('/getKnownMimeList', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        return await Rpcs.cloudStoreService.getKnownMimeList()
    })
})


router.post('/imagePreviewTaskFinish', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let serverId = RequestUtil.getString(req, 'serverId')
        if (!serverId) {
            let serverIp = RequestUtil.getIp(req)
            logger.info('Unknown server %s access imagePreviewTaskFinish.', serverIp)
            serverId = 'Unknown-' + serverIp
        }
        let hash = RequestUtil.getString(req, 'hash')
        if (!hash) {
            throw new ApiValidateException('Hash required', '{HASH}_REQUIRED')
        }
        /*
        let previewHash = RequestUtil.getString(req, 'previewHash')
        if (!previewHash) {
            throw new ApiValidateException('previewHash required', '{PREVIEW_HASH}_REQUIRED')
        }
        */
        // hash calc
        let status = RequestUtil.getInt(req, 'status', NaN)
        if (Number.isNaN(status)) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        // save to
        let res = {'hash' : hash, 
            'size' : RequestUtil.getInt(req, 'size', -1),
            'width' : RequestUtil.getInt(req, 'width', -1),
            'height' : RequestUtil.getInt(req, 'height', -1),
            'format' : RequestUtil.getString(req, 'format')
        }
        await previewService.buildAndWriteImage(hash,res)
        return await Rpcs.cloudStoreService.finishPreviewTask(serverId,hash, status)
    })
})

router.post('/pdfPreviewTaskFinish', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let serverId = RequestUtil.getString(req, 'serverId')
        if (!serverId) {
            let serverIp = RequestUtil.getIp(req)
            logger.info('Unknown server %s access pdfPreviewTaskFinish.', serverIp)
            serverId = 'Unknown-' + serverIp
        }
        let hash = RequestUtil.getString(req, 'hash')
        if (!hash) {
            throw new ApiValidateException('Hash required', '{HASH}_REQUIRED')
        }
        let previewHash = RequestUtil.getString(req, 'previewHash')
        if (!previewHash) {
            throw new ApiValidateException('previewHash required', '{PREVIEW_HASH}_REQUIRED')
        }
        // hash calc
        let status = RequestUtil.getInt(req, 'status', NaN)
        if (Number.isNaN(status)) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        // save to
        let filename = RequestUtil.getString(req, 'filename')
        if(!filename){
            filename = 'unknown.pdf'
        }
        await previewService.buildAndWritePDF(hash,previewHash,filename)
        return await Rpcs.cloudStoreService.finishPreviewTask(serverId,hash, status)
    })
})

router.post('/updatePreviewTask', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let serverId = RequestUtil.getString(req, 'serverId')
        if (!serverId) {
            let serverIp = RequestUtil.getIp(req)
            logger.info('Unknown server %s access updatePreviewTask.', serverIp)
            serverId = 'Unknown-' + serverIp
        }
        let hash = RequestUtil.getString(req, 'hash')
        if (!hash) {
            throw new ApiValidateException('Hash required', '{HASH}_REQUIRED')
        }
        
        // hash calc
        let status = RequestUtil.getInt(req, 'status', NaN)
        if (Number.isNaN(status)) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        // save to
        let info = RequestUtil.getString(req, 'info')
        if(!info){
            info = ''
        }
        return await Rpcs.cloudStoreService.updatePreviewTaskInfo(serverId,hash, status,info)
    })
})

//fetchPreviewTask

router.post('/token', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = IceUtil.number2IceLong(-1)
        let name = RequestUtil.getString(req, 'name')
        let hash = RequestUtil.getString(req, 'hash')
        let originalFilename = RequestUtil.getString(req, 'originalFilename')
        if (!hash) {
            hash = RequestUtil.getString(req, 'fileHash')
        }
        if (!name) {
            name = ''
        }
        if(!originalFilename){
            originalFilename = ''
        }
        if (hash) {
            let fileData = await Rpcs.cloudStoreService.get(hash)
            if (fileData !== null) {
                // copy fileData
                return fileData
            }
        }
        // create token userId: Long, parent: String?, path: String?, name: String
        return await Rpcs.cloudStoreService.createUploadToken(userId, 'SYSTEM-COPY', 'SYSTEM-COPY', name, originalFilename)
    })
})

module.exports = router