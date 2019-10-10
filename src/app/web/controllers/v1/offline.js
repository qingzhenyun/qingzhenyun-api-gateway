const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const IceUtil = require('../../../util/ice_util')
// const download = require('download')
const ApiValidateException = require('../../../exception/api_validate_exception')
const logger = require('log4js').getLogger('controller::offline')
const parseURL = require('url-parse')
const parseTorrent = require('parse-torrent')
const ed2k = require('../../../external/ed2k-link')
const md5 = require('md5')
const Rpcs = require('../../../common/rpcs')
const StringUtil = require('../../../util/string_util')
const OFFLINE_CONST = require('../../../constant/offline_task_const')
const jsRequest = require('request-promise-native')
const PREFIX_CONFIG = require('../../../config/api_config')

router.post('/parseTorrent', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let uuid = RequestUtil.getString(req, 'uuid')
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        // get user file first
        let fileData = await Rpcs.userFileService.get(userId, uuid, path)
        if (fileData === null || fileData === undefined) {
            throw new ApiValidateException('Download torrent file not found', 'FILE_NOT_FOUND')
        }
        if (fileData.type === 1) {
            // file
            throw new ApiValidateException('Trying to download a directory', 'UNSUPPORTED_FILE')
        }
        // get this file
        let storeId = fileData['storeId']
        let storeFile = await Rpcs.cloudStoreService.getEx(storeId, IceUtil.number2IceLong(-1), true)
        if (storeFile === null) {
            throw new ApiValidateException('Download torrent file not found', 'FILE_NOT_FOUND_ON_STORE')
        }
        // down file
        try {
            let option = { 'method': 'GET', 'uri': storeFile['downloadAddress'], 'encoding': null, 'gzip': true, 'timeout': 10 * 1000 }
            let fileBinaryData = await jsRequest(option)
            let parsedData = parseTorrent(fileBinaryData)
            let sObj = { 'taskId': parsedData['infoHash'], 'type': OFFLINE_CONST.TORRENT_TYPE, 'storeId': storeId, 'infoHash': parsedData['infoHash'] }
            sObj['name'] = parsedData['name'] ? parsedData['name'] : parsedData['infoHash']
            let taskHash = StringUtil.encodeHashStrings(JSON.stringify(sObj))
            let data = { 'taskHash': taskHash, 'name': sObj['name'], 'server': false }
            let res = await Rpcs.offlineTaskService.getSystemTask(sObj['taskId'])
            if (res !== null) {
                data['server'] = true
                data['name'] = res['task']['name']
                let files = []
                for (let detail of res['detail']) {
                    files.push({ 'path': detail['path'], 'size': detail['size'], 'order': detail['order'] })
                }
                data['files'] = files.sort(StringUtil.sortBy('order'))
            }

            return data

        } catch (error) {
            logger.error(error)
            throw new ApiValidateException('Download torrent file failed', 'DOWNLOAD_TORRENT_FILE_FAILED')
        }
    })
})

router.post('/parseUrl', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let url = RequestUtil.getString(req, 'url').trim()
        let password = RequestUtil.getString(req, 'password').trim()
        if (!url) {
            throw new ApiValidateException('Url required', '{URL}_REQUIRED')
        }
        if (url.indexOf('\n') != -1) {
            let urlArray = url.split('\n')
            return urlArray
            // TODO: Add array support.
        } else {
            let sObj = validateSingleUrl(url)
            if (!sObj['taskId']) {
                // validate
                throw new ApiValidateException('Url not valid', 'MAGNET_URL_INVALID')
            }
            //
            //let passwordNeed = false
            
            let data = { 'name': sObj['name'], 'server': false , 'type': sObj['type']}
            data['needPassword'] = false
            let systemId = sObj['taskId']
            let res = await Rpcs.offlineTaskService.getSystemTask(systemId)
            if (res !== null) {
                data['server'] = true
                data['name'] = res['task']['name']
                let files = []
                for (let detail of res['detail']) {
                    files.push({ 'path': detail['path'], 'size': detail['size'], 'order': detail['order'] })
                }
                data['files'] = files.sort(StringUtil.sortBy('order'))
            }
            sObj['fail'] = false
            if(sObj['type'] === OFFLINE_CONST.BAIDU_TYPE) {
                await decodeBaiduUrl(url, password, data, sObj)
            }
            //data['needPassword'] = false
            if(data['needPassword'] && sObj['fail']){
                throw new ApiValidateException('Url need password', 'URL_NED_PASSWORD')
            }
            let taskHash = StringUtil.encodeHashStrings(JSON.stringify(sObj))
            data['taskHash'] = taskHash
            data['fail'] = sObj['fail']
            return data
        }
        // ckeck url.
    })
})

const decodeBaiduUrl = async (url, password , data, sObj) => {
    try{
        let post_body = password ? {'link':url , 'password':password} : {'link':url}
        let option = { 'method': 'POST','json':true,'body':post_body , 'uri': PREFIX_CONFIG.BAIDU_API_PREFIX + 'api/testing/password', 'encoding': 'utf-8', 'gzip': true, 'timeout': 1000 * 30 }
        let fileBinaryData = await jsRequest(option)
        //let result = JSON.parse()
        if('error' in fileBinaryData){
            let errorCode = fileBinaryData['error']
            if(errorCode === 1){
                data['needPassword'] = true
                sObj['fail'] = true
            }else if(errorCode === 0){
                data['needPassword'] = false
                if(password){
                    sObj['password'] = password
                }
                if ('shareInfo' in fileBinaryData) {
                    let info = fileBinaryData['shareInfo']
                    if('rootFileList' in info){
                        let fileList = info['rootFileList']
                        if(Array.isArray(fileList)){
                            let files = []
                            let count = 1
                            for (let detail of fileList) {
                                files.push({ 'path': detail['filePath'], 'size': detail['fileSize'],'name' : detail['fileName'], 'order': count })
                                count++
                            }
                            data['files'] = files.sort(StringUtil.sortBy('order'))
                        }
                    }
                }
            }
        }
        logger.info('Decode Baidu: %s', JSON.stringify(fileBinaryData))
    }catch(ex){
        if('statusCode' in ex){
            if(ex['statusCode'] === 400){
                if('error' in ex){
                    if('error' in ex['error']) {
                        //
                        if(ex['error']['error'] === 1){
                            data['needPassword'] = true
                            sObj['fail'] = true
                            return
                        }
                    }
                }
            }
        }
        logger.warn('Decode baidu failed %s,%s', url, ex)
        //console.log(ex)
        sObj['fail'] = true
    }
}

router.post('/list', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let start = RequestUtil.getInt(req, 'start', -1)
        let size = RequestUtil.getInt(req, 'size', 20)
        let order = RequestUtil.getInt(req, 'order', 0)
        if (size > 500) {
            size = 500
        }
        if (size < 1) {
            size = 5
        }
        // 
        let data =  await Rpcs.offlineTaskService.listOfflineTask(userId, start, size, order)
        await fillTaskData(data)
        return data
    })
})

router.post('/page', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let page = RequestUtil.getInt(req, 'page', 1)
        let pageSize = RequestUtil.getInt(req, 'pageSize', 20)
        let order = RequestUtil.getInt(req, 'order', 0)
        if (pageSize > 100) {
            pageSize = 100
        }
        if (pageSize < 1) {
            pageSize = 5
        }
        // fill list
        // getSystemOfflineTaskList
        let data = await Rpcs.offlineTaskService.listOfflineTaskPage(userId, page, pageSize, order)
        let list = data['list']
        if (list != undefined) {
            await fillTaskData(list)
        }
        return data
    })
})

router.post('/start', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let taskHash = RequestUtil.getString(req, 'taskHash').trim()
        if (!taskHash) {
            throw new ApiValidateException('taskHash required', '{TASK_HASH}_REQUIRED')
        }
        let res = StringUtil.decodeHashStrings(taskHash)
        if (!res) {
            throw new ApiValidateException('taskHash not valid', '{TASK_HASH}_NOT_VALID')
        }
        let decodeObj = {}
        try {
            decodeObj = JSON.parse(res)
        } catch (error) {
            throw new ApiValidateException('taskHash not valid', '{TASK_HASH}_NOT_VALID')
        }
        let userId = req.user.uuid
        let userIp = RequestUtil.getIp(req)
        let taskId = decodeObj['taskId']
        let name = decodeObj['name']
        let type = decodeObj['type']
        // ckeck url.
        // return decodeObj
        let remoteTask = await Rpcs.offlineTaskService.addSystemTask(taskId, type, name, userId, userIp, res)
        if (remoteTask === null) {
            return null
        }
        let copyFile = RequestUtil.getString(req, 'copyFile', '')
        let savePath = RequestUtil.getString(req, 'savePath', '')
        let userTask = await Rpcs.offlineTaskService.addUserTask(taskId, userId, copyFile, savePath)
        return userTask
    })
})

router.post('/remove', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {

        let taskId = req.body['taskId']
        let userId = req.user.uuid
        if(Array.isArray(taskId)){
            //paths
            let data = taskId.map((s) => Rpcs.offlineTaskService.removeUserTask(s + '', userId))
            let counts = await Promise.all(data)
            //return counts.reduce((sum, x) => sum + x)
            //logger.info('REMOVE %s', JSON.stringify(counts))
            //logger.info('REMOVE ---  %s', JSON.stringify(taskId))
            return counts.length > 0
        }else{
            if(taskId === undefined){
                throw new ApiValidateException('taskId required', '{TASK_ID}_REQUIRED')
            }
            return await Rpcs.offlineTaskService.removeUserTask(taskId + '', userId)
        }
    })
})


const validateSingleUrl = (url => {
    let result = {}
    url = url.trim()
    if (!url) {
        return result
    }
    // let type = 0
    let parsed = parseURL(url, true)
    result['url'] = url
    result['type'] = OFFLINE_CONST.URL_TYPE
    if (parsed['protocol'] === 'magnet:') {
        result = parseMagnet(url)
        result['type'] = OFFLINE_CONST.MAGNET_TYPE
    }
    else if (parsed['protocol'] === 'ed2k:') {
        //logger.info('-')
        result = parseEd2k(url)
        result['type'] = OFFLINE_CONST.EK2K_TYPE
    }
    else if (parsed['protocol'] === 'ed2k') {
        //logger.info('-')
        result = parseEd2k(url)
        result['type'] = OFFLINE_CONST.EK2K_TYPE
    }
    else if (parsed['protocol'] === 'http:') {
        result['type'] = OFFLINE_CONST.URL_TYPE
        if(url.indexOf('pan.baidu.com/s') > -1){
            result['type'] = OFFLINE_CONST.BAIDU_TYPE
        }
    }

    else if (parsed['protocol'] === 'https:') {
        result['type'] = OFFLINE_CONST.URL_TYPE
        if(url.indexOf('pan.baidu.com/s') > -1){
            result['type'] = OFFLINE_CONST.BAIDU_TYPE
        }
    }
    else if (parsed['protocol'] === 'thunder:') {
        //result['type'] = 10
        let decodedUrl = StringUtil.decodeThunder(url)
        if(decodedUrl.indexOf('thunder:') < 0){
            return validateSingleUrl(decodedUrl)
        }
    }
    else if (parsed['protocol']) {
        result['type'] = -1
        logger.info('Unrecongnised protocol %s, %s', parsed['protocol'], url)
        throw new ApiValidateException('Unrecongnised protocol', 'UNSUPPORED_PROTOCOL')
    }
    result['url'] = url
    if (!result['taskId']) {
        result['taskId'] = md5('file:' + url)
        result['name'] = result['url']
        let xt = result['name'].substring(result['name'].lastIndexOf('/') + 1)
        let cv = xt.indexOf('?')
        if (cv !== -1) {
            xt = xt.substring(0, cv)
        }
        result['name'] = decodeURIComponent(xt)
        if (result['name'].length > 128) {
            result['name'] = result['name'].substring(0, 127)
        }
    }
    return result
})

const parseMagnet = (url => {
    let torrentInfo = {}
    try {
        torrentInfo = parseTorrent(url)

    } catch (torrentError) {
        // console.error(torrentError)
        // console.error(url)
        logger.info('Unrecongnised magnet %s', url)
        throw new ApiValidateException('Magnet parse fail', 'MAGNET_URL_INVALID')
    }
    // let taskHash = torrentInfo['infoHash']
    let result = {
        'infoHash': torrentInfo['infoHash']
    }
    result['name'] = torrentInfo['name'] ? torrentInfo['name'] : torrentInfo['infoHash']
    result['taskId'] = torrentInfo['infoHash']
    return result
})

const parseEd2k = (url => {
    try {
        let ed2kParse = ed2k.parse(url)
        return { 'taskId': ed2kParse['ed2k'], 'name': ed2kParse['filename'], 'size': ed2kParse['length'] }
    } catch (error) {
        logger.info('Unrecongnised ed2k url: %s', url)
        logger.error(error)
        throw new ApiValidateException('Ed2k parse fail', 'ED2K_URL_INVALID')
    }
})

const fillTaskData = async (list) => {
    if(list === undefined || list === null){
        logger.info('Fill task data on empty list')
        return
    }
    if(!Array.isArray(list)){
        logger.warn('fillTaskData only accept array')
        return
    }
    
    let map = new Map()
    let inArr = []
    list.forEach((taskData,index) => {
        // find this
        map.set(taskData.taskId,index)
        inArr.push(taskData.taskId)
        
    })
    //
    if(inArr.length > 0){
        let taskDetails = await Rpcs.offlineTaskService.getSystemOfflineTaskList(inArr)
        for(let taskDetail of taskDetails){
            // let taskName = taskDetail['name']
            // let taskStatus= taskDetail['status']
            let remoteId = taskDetail['taskId']
            let index = map.get(remoteId)
            map.delete(remoteId)
            if(index !== undefined){
                let orign = list[index]
                if(orign !== undefined){
                    fillSimpleData(orign,taskDetail)
                }
            }
        }
    }
    if(map.size > 0){
        logger.error('Some store file id cannot found.')
        list.forEach((taskData) => {
        // find this
            if(taskData['name'] === undefined || taskData['name'] === null){
            // is a file, need fetch
                logger.error('Task %s cannot be found', taskData['taskId'])
                fillErrorData(taskData)
            }
        })
    }
}


const fillErrorData = task => {
    if(task === undefined || task === null){
        return
    }
    task['name'] = task['taskId']
    task['progress'] = 0
    // task['flag'] = -1
    task['finishedSize'] = 0
    task['size'] = 0
    task['status'] = -1
    task['errorCode'] = -1
    task['serverId'] = 'error'
    task['mime'] = 'internal/error-task'
}

const fillSimpleData = (task,simpleData) => {
    if(task === undefined || task === null){
        return
    }
    if(simpleData === undefined || simpleData === null){
        return
    }
    task['name'] = simpleData['name']
    task['progress'] = simpleData['progress']
    // task['flag'] = -1
    task['finishedSize'] = simpleData['finishedSize']
    task['size'] = simpleData['size']
    
    if(task['status'] < simpleData['status']){
        task['status'] = simpleData['status']
    }
    task['errorCode'] = simpleData['errorCode']
    task['serverId'] = simpleData['serverId']
    task['mime'] = simpleData['mime']
    task['detail'] = simpleData['detail']
}

module.exports = router