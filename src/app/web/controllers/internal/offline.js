const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const logger = require('log4js').getLogger('controller::internal::offline')
const ApiValidateException = require('../../../exception/api_validate_exception')
const Rpcs = require('../../../common/rpcs')
const IceUtil = require('../../../util/ice_util')
const SystemOfflineTaskWithDetailResponse = require('../../../ice/offline').offline.SystemOfflineTaskWithDetailResponse
const SystemOfflineTaskResponse = require('../../../ice/offline').offline.SystemOfflineTaskResponse
const SystemTaskDetailResponse = require('../../../ice/offline').offline.SystemTaskDetailResponse

const parseTorrent = require('parse-torrent')


// Internal task
router.post('/fetchTask', (req, res) => {
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
        let type = RequestUtil.getIntArray(req, 'type')
        let status = RequestUtil.getIntArray(req, 'status')
        if (type.length < 1) {
            throw new ApiValidateException('Type required', '{TYPE}_REQUIRED')
        }

        if (status.length < 1) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        return await Rpcs.offlineTaskService.fetchTask(serverId, type, status, nextStatus, size)
    })
})

router.post('/addMagnet', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let url = RequestUtil.getString(req, 'url')
        let torrentInfo = {}
        try {
            torrentInfo = parseTorrent(url)

        } catch (torrentError) {
        // console.error(torrentError)
        // console.error(url)
            logger.info('Unrecongnised magnet %s', url)
            throw new ApiValidateException('Magnet parse fail', 'MAGNET_URL_INVALID')
        }
        let result = {
            'infoHash': torrentInfo['infoHash']
        }
        result['name'] = torrentInfo['name'] ? torrentInfo['name'] : torrentInfo['infoHash']
        result['taskId'] = torrentInfo['infoHash']
        result['type'] = 30
        let userId = IceUtil.number2IceLong(5)
        let userIp = RequestUtil.getIp(req)
        let taskId = result['taskId']
        let name = result['name']
        let type = result['type']
        result['url'] = url
        // ckeck url.
        // return decodeObj
        let remoteTask = await Rpcs.offlineTaskService.addSystemTask(taskId, type, name, userId, userIp, JSON.stringify(result))
        if (remoteTask === null) {
            return null
        }
        let copyFile = RequestUtil.getString(req, 'copyFile', '')
        let savePath = RequestUtil.getString(req, 'savePath', '')
        let userTask = await Rpcs.offlineTaskService.addUserTask(taskId, userId, copyFile, savePath)
        return userTask
    })
})

// updateDownloadingStatus
router.post('/updateDownloadingStatus', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let serverId = RequestUtil.getString(req, 'serverId')
        if (!serverId) {
            let serverIp = RequestUtil.getIp(req)
            logger.info('Unknown server %s access fetchTask.', serverIp)
            serverId = 'Unknown-' + serverIp
        }
        let taskId = RequestUtil.getString(req, 'taskId')
        if (!taskId) {
            throw new ApiValidateException('Task id required', '{TASK_ID}_REQUIRED')
        }
        let status = RequestUtil.getInt(req, 'status', undefined)
        if (status === undefined) {
            throw new ApiValidateException('Status required', '{STATUS}_REQUIRED')
        }
        let message = RequestUtil.getString(req, 'message')
        let force = RequestUtil.getBoolean(req, 'force')
        if (force !== true) {
            force = false
        }
        return await Rpcs.offlineTaskService.updateDownloadingStatus(taskId, serverId, status, message, force)
    })
})

router.post('/getWithDetail', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let taskId = RequestUtil.getString(req, 'taskId')
        if (!taskId) {
            throw new ApiValidateException('Task id required', '{TASK_ID}_REQUIRED')
        }
        return await Rpcs.offlineTaskService.getSystemTask(taskId)
    })
})

router.post('/updateMetadata', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let detail = []
        let taskObject = req.body['task']
        let detailArray = req.body['detail']
        
        if (!taskObject) {
            throw new ApiValidateException('Task required', '{TASK}_REQUIRED')
        }
        let current = IceUtil.number2IceLong((new Date()).getTime())
        let size = IceUtil.number2IceLong(taskObject['size'])
        let task = new SystemOfflineTaskResponse(taskObject['taskId'],
            0,
            taskObject['name'],
            taskObject['status'],
            taskObject['serverId'], current, current, '', '', '', size, 0, IceUtil.number2IceLong(0),0,'')
        if (Array.isArray(detailArray)) {
            for (let detailObject of detailArray) {
                let size = IceUtil.number2IceLong(detailObject['size'])
                let completed = IceUtil.number2IceLong(detailObject['completed'])
                detail.push(new SystemTaskDetailResponse(taskObject['taskId'],
                    detailObject['path'],
                    size,
                    completed,
                    detailObject['progress'],
                    detailObject['order'],
                    detailObject['storeId']))
            }
        }
        let update = await Rpcs.offlineTaskService.updateSystemTaskMetadata(new SystemOfflineTaskWithDetailResponse(task, detail))
        let force = req.body['force']
        if(force){
            // update all users wait
            // logger.info('receive metadata force %s: %s',taskObject['taskId'], JSON.stringify(detailArray))
            await Rpcs.offlineTaskService.resetDownloadTask(taskObject['taskId'])
        }
        return update
    })
})

router.post('/updateTaskDetail', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let size = IceUtil.number2IceLong(RequestUtil.getInt(req, 'size', -1))
        let completed = IceUtil.number2IceLong(RequestUtil.getInt(req, 'completed', -1))
        let taskId = RequestUtil.getString(req, 'taskId')
        if (taskId === '') {
            throw new ApiValidateException('Task id required', '{TASK_ID}_REQUIRED')
        }
        let order = RequestUtil.getInt(req, 'order', -1)
        if (order < 1) {
            throw new ApiValidateException('Order must gt than 0', '{ORDER}_REQUIRED')
        }
        let data = new SystemTaskDetailResponse(taskId,
            RequestUtil.getString(req, 'path'),
            size,
            completed,
            RequestUtil.getInt(req, 'progress'),
            order,
            RequestUtil.getString(req, 'storeId'))

        // logger.info('update task detail %s : order :%d, storeId:%s', taskId, order, RequestUtil.getString(req, 'storeId'))
        return await Rpcs.offlineTaskService.updateSystemTaskDetail(data)
    })
})

router.post('/finishTask', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let taskId = RequestUtil.getString(req, 'taskId')
        if (taskId === '') {
            throw new ApiValidateException('Task id required', '{TASK_ID}_REQUIRED')
        }
        let errorCode = RequestUtil.getInt(req, 'errorCode', 0)
        let succ = await Rpcs.offlineTaskService.finishOfflineTask(taskId, errorCode)
        // get details
        try {
            let withDetail = await Rpcs.offlineTaskService.getSystemTask(taskId)
            // check if is dir
            if(withDetail['detail']){
                if(Array.isArray(withDetail['detail'])){
                    if(withDetail['detail'].length === 1){
                        // get file data
                        let taskDetail = withDetail['detail'][0]
                        let storId = taskDetail['storeId']
                        if(storId){
                            let file = await Rpcs.cloudStoreService.get(storId)
                            if(file && file['mime']){
                                // Update
                                await Rpcs.offlineTaskService.updateTaskMime(taskId,file['mime'])
                            }else{
                                logger.warn('Update meta %s : %s not found',taskId, storId)
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Update meta %s : %s',taskId, error)
        }
        return succ
    })
})

router.post('/updateProgress', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let taskId = RequestUtil.getString(req, 'taskId')
        if (taskId === '') {
            throw new ApiValidateException('Task id required', '{TASK_ID}_REQUIRED')
        }
        let status = RequestUtil.getInt(req, 'status', -1)
        let progress = RequestUtil.getInt(req, 'progress', -1)
        let size = IceUtil.number2IceLong(RequestUtil.getInt(req, 'size', -1))
        let finishedSize = IceUtil.number2IceLong(RequestUtil.getInt(req, 'finishedSize', -1))
        return await Rpcs.offlineTaskService.updateTaskProgress(taskId, status, progress, size, finishedSize)
    })
})

module.exports = router