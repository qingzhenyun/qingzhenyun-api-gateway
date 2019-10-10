// const m3u8Parser = require('m3u8-parser')
// const request = require('request-promise-native')
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const mediaPreviewService = require('../../../service/preview_service')
const router = require('express').Router()
const logger = require('log4js').getLogger('controller::preview')
const Rpcs = require('../../../common/rpcs')
const CONFIG = require('../../../config/config')
// const IceUtil = require('../../../util/ice_util')

/*
const redis = require('../../../service/redis_service')

router.get('/page', (req, res) => {
    // echo m3u
    ResponseUtil.tryRun(req, res, async () => {
        return await redis.client.delAsync(['a','b','c'])
    })

})
*/
//getPreview

router.post('/image', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let uuid = RequestUtil.getString(req, 'uuid')
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let fileData = await Rpcs.userFileService.get(userId, uuid, path)
        if(fileData){
            let storeId = fileData['storeId']
            let preview = await mediaPreviewService.getPreview(storeId)
            if(preview){
                let fileDetail = await Rpcs.cloudStoreService.getEx(fileData.storeId,userId,false)
                if(fileDetail){
                    if(fileDetail['downloadAddress']){
                        //preview['address'] = fileDetail['downloadAddress']
                        //preview['url'] = fileDetail['downloadAddress']
                        fillSimpleData(fileData,preview,fileDetail)
                        preview['mime'] = fileDetail['mime']
                        preview['size'] = fileDetail['size']
                        delete preview['_id']
                        return preview
                    }
                }
            }
        }
        return {}
    })
})

router.post('/pdf', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let uuid = RequestUtil.getString(req, 'uuid')
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let fileData = await Rpcs.userFileService.get(userId, uuid, path)
        if(fileData){
            let storeId = fileData['storeId']
            let preview = await mediaPreviewService.getPreview(storeId)
            if(preview && preview['previewHash']){
                let fileDetail = await Rpcs.cloudStoreService.getEx(fileData.storeId,userId,false)
                if(fileDetail){
                    let previewDetail = await Rpcs.cloudStoreService.getEx(preview['previewHash'], userId, false)
                    if(previewDetail){
                        // preview['address'] = previewDetail['downloadAddress']
                        // preview['url'] = previewDetail['downloadAddress']
                        // preview['downloadAddress'] = fileDetail['downloadAddress']
                        fillSimpleData(fileData,preview,previewDetail)
                        preview['mime'] = fileDetail['mime']
                        preview['size'] = fileDetail['size']
                        delete preview['_id']
                        return preview
                    }
                    return preview
                }
            }else{
                if(preview && preview['fileHash']){
                    let fileDetail = await Rpcs.cloudStoreService.getEx(fileData.storeId,userId,false)
                    if(fileDetail){
                        let previewDetail = await Rpcs.cloudStoreService.getEx(preview['fileHash'], userId, false)
                        if(previewDetail){
                            await mediaPreviewService.buildAndWritePDF(storeId,preview['fileHash'],'unknown.pdf')
                            preview['previewHash'] = preview['fileHash']
                            // preview['address'] = previewDetail['downloadAddress']
                            // preview['url'] = previewDetail['downloadAddress']
                            // preview['downloadAddress'] = fileDetail['downloadAddress']
                            fillSimpleData(fileData,preview,previewDetail)
                            preview['mime'] = fileDetail['mime']
                            preview['size'] = fileDetail['size']
                            delete preview['_id']
                            return preview
                        }
                        return preview
                    }
                }
            }
        }
        return {}
    })
})

router.post('/media', (req, res) => {
    // echo m3u
    ResponseUtil.tryRun(req, res, async () => {
        let uuid = RequestUtil.getString(req, 'uuid')
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let fileData = await Rpcs.userFileService.get(userId, uuid, path)
        if(fileData){
            let storeId = fileData['storeId']
            let preview = await mediaPreviewService.getPreview(storeId)
            if(preview){
                delete preview['_id']
                let p = preview['preview']
                if (p) {
                    let idx  = 0
                    for(let item of p){
                        delete item['key']
                        delete item['bucket']
                        item['url'] = CONFIG.PLAY_PREFIX + 'v1/preview/play/' + fileData.uuid + '/' + idx.toString() + '/index.m3u8'
                        idx++
                    }
                }
                return preview
            }
        }
        return {}
    })
    
})

router.get('/hlsKey/:hlsKey', async (req, res) => {
    try {
        let userId = req.user.uuid
        let hlsKey = RequestUtil.getStringFromParam(req, 'hlsKey')
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.write(await mediaPreviewService.getViewKey(userId, hlsKey))
    } catch (error) {
        logger.error('Req play failed %s', error)
    } finally {
        res.end()
    }
})

router.get('/play/:fileId/:index/index.m3u8', async (req, res) => {
    try {
        let fileId = RequestUtil.getStringFromParam(req, 'fileId')
        let index = RequestUtil.getIntFromParam(req, 'index')
        let token = ResponseUtil.generateToken(req)
        let userId = req.user.uuid
        let fileData = await Rpcs.userFileService.get(userId, fileId, '')
        if (fileData !== null) {
            let storeId = fileData['storeId']
            let preview = await mediaPreviewService.getPreview(storeId)
            if (preview !== null) {
                let p = preview['preview']
                if (p) {
                    let xxx = p[index]
                    if (xxx) {
                        let key = xxx['key']
                        let bucket = xxx['bucket']
                        // 1. genetate view key
                        // 2.put it in redis
                        let viewKey = mediaPreviewService.generateViewKey(userId, preview['encodeKey'], parseInt(xxx['duration'] / 1000))
                        let content = await mediaPreviewService.fetchM3u8File(bucket, key, CONFIG.SITE_HLS_KEY_PREFIX + 'v1/preview/hlsKey/' + encodeURIComponent(viewKey) + '?token=' + encodeURIComponent(token))
                        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl;charset=UTF-8' })
                        res.write(content[1])
                    }
                }
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' })
                res.write('This file. cannot be viewed')

            }
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.write('This is not your file. %s', fileId)
        }
        // fetch file first
    } catch (error) {
        logger.error('Req play failed', error)
    } finally {
        res.end()
    }
})


const fillSimpleData = (file,previewDetail,simpleData) => {
    if(file === undefined || file === null){
        return
    }
    if(simpleData === undefined || simpleData === null){
        return
    }

    if(previewDetail === undefined || previewDetail === null){
        return
    }
    
    if(simpleData['downloadAddress']){
        previewDetail['downloadAddress'] = simpleData['downloadAddress']
        if(file['path']){
            //let realPath = file['path']
            previewDetail['downloadAddress'] = encodeURI(simpleData['downloadAddress'].replace('${QINGZHEN-USER-PATH}',file['path']))
        }
        previewDetail['url'] = previewDetail['downloadAddress']
        previewDetail['address'] = previewDetail['downloadAddress']
    }
    
}


module.exports = router