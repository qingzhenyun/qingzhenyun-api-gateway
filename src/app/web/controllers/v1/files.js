const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')
const ApiValidateException = require('../../../exception/api_validate_exception')
const ApiNotFoundException = require('../../../exception/api_not_found_exception')
const Rpcs = require('../../../common/rpcs')
const logger = require('log4js').getLogger('controller::files')

router.post('/page', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let pageObj = RequestUtil.getPageObjecet(req)
        let parent = RequestUtil.getString(req, 'parent')
        if(!parent){
            parent = RequestUtil.getString(req, 'uuid')
        }
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let parentData = await Rpcs.userFileService.get(userId, parent, path)
        if(parentData === null){
            logger.warn('%d:%s cannot find patent %s',userId, path, parent)
            throw new ApiNotFoundException('Parent directory not found','FILE_NOT_FOUND')
        }
        fillDirectoryData(parentData)
        let uuid = parentData.uuid
        let orderBy = RequestUtil.getInt(req, 'orderBy', -1)
        let type = RequestUtil.getInt(req, 'type', -1)
        // execRPC
        let data = await Rpcs.userFileService.listDirectoryPage(userId, uuid, type, pageObj.page, pageObj.pageSize, orderBy)
        data['info'] = parentData
        let list = data['list']
        if(list != undefined){
            await fillFileData(list)
        }
        return data
    })
})

router.post('/list', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        //let pageObj = RequestUtil.getPageObjecet(req)
        let parent = RequestUtil.getString(req, 'parent')
        if(!parent){
            parent = RequestUtil.getString(req, 'uuid')
        }
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let parentData = await Rpcs.userFileService.get(userId, parent, path)
        if(parentData === null){
            throw new ApiNotFoundException('Parent directory not found','FILE_NOT_FOUND')
        }
        let start = RequestUtil.getInt(req, 'start', -1)
        let size = RequestUtil.getInt(req, 'size', -1)
        fillDirectoryData(parentData)
        let uuid = parentData.uuid
        let orderBy = RequestUtil.getInt(req, 'orderBy', -1)
        let type = RequestUtil.getInt(req, 'type', -1)
        // execRPC
        let data = await Rpcs.userFileService.listDirectory(userId, uuid, type, start, size, orderBy)
        await fillFileData(data)
        return data
    })
})

router.post('/list2', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        //let pageObj = RequestUtil.getPageObjecet(req)
        let parent = RequestUtil.getString(req, 'parent')
        if(!parent){
            parent = RequestUtil.getString(req, 'uuid')
        }
        let path = RequestUtil.getString(req, 'path')
        let userId = req.user.uuid
        let parentData = await Rpcs.userFileService.get(userId, parent, path)
        if(parentData === null){
            throw new ApiNotFoundException('Parent directory not found','FILE_NOT_FOUND')
        }
        let start = RequestUtil.getInt(req, 'start', -1)
        let size = RequestUtil.getInt(req, 'size', -1)
        fillDirectoryData(parentData)
        let uuid = parentData.uuid
        let orderBy = RequestUtil.getInt(req, 'orderBy', -1)
        let type = RequestUtil.getInt(req, 'type', -1)
        // execRPC
        let data = await Rpcs.userFileService.listDirectory(userId, uuid, type, start, size, orderBy)
        await fillFileData(data)
        return {'info': parentData,'list': data}
    })
})

router.post('/createDirectory', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let parent = RequestUtil.getString(req, 'parent')
        let userId = req.user.uuid
        let name = RequestUtil.getString(req, 'name')
        let path = RequestUtil.getString(req, 'path')
        // TODO: Check legal
        let data =  await Rpcs.userFileService.createDirectory(userId, parent, path, name)
        fillDirectoryData(data)
        return data
    })
})

router.post('/get', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let uuid = RequestUtil.getString(req, 'uuid')
        let userId = req.user.uuid
        let path = RequestUtil.getString(req, 'path')
        // UserFileResponse get(long userId,string uuid,string path);
        let fileData = await Rpcs.userFileService.get(userId, uuid, path)
        if(fileData === null || fileData === undefined){
            return null
        }
        if(fileData.type !== 1){
            // file
            if(fileData.storeId !== undefined && fileData.storeId !== null){
                let fileDetail = await Rpcs.cloudStoreService.getEx(fileData.storeId,userId,false)
                fillSimpleData(fileData, fileDetail)
            }
        }else{
            fillDirectoryData(fileData)
        }
        return fileData
        // return await Rpcs.userFileService.createDirectory(userId, parent, path, name)
    })
})

router.post('/rename', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let uuid = RequestUtil.getString(req, 'uuid')
        let path = RequestUtil.getString(req, 'path')
        let name = RequestUtil.getString(req, 'name')
        if(name === ''){
            name = RequestUtil.getString(req, 'newName')
        }
        if(name === undefined || name === ''){
            throw new ApiValidateException('new name cannot be empty','{NAME}_REQUIRED')
        }
        // rename(userId: Long, uuid: String?, path: String?, newName: String?
        return await Rpcs.userFileService.rename(userId, uuid, path, name)
    })
})

router.post('/remove', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let uuid = req.body['uuid']
        let path = req.body['path']
        if(!uuid){
            // source is path
            if(Array.isArray(path)){
                //paths
                let data = path.map((s) => Rpcs.userFileService.remove(userId, '', s))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }else{
                if(path === undefined){
                    throw new ApiValidateException('Path cannot be empty','{PATH}_REQUIRED')
                }
                return await Rpcs.userFileService.remove(userId, '', path)
            }
        }else{
            // source is uuid
            // check if is array
            if(Array.isArray(uuid)){
                //let count = 0
                let data = uuid.map((s) => Rpcs.userFileService.remove(userId, s, ''))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }
            else{
                // move single Uuid
                if(uuid === undefined){
                    throw new ApiValidateException('Uuid cannot be empty','{UUID}_REQUIRED')
                }
                return await Rpcs.userFileService.remove(userId, uuid, '')
            }
        }
    })
})

router.post('/move', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let uuid = req.body['uuid']
        let path = req.body['path']
        let parent = RequestUtil.getString(req, 'parent', null)
        if(parent === null){
            parent = RequestUtil.getString(req, 'destUuid')
        }
        let destPath = RequestUtil.getString(req, 'destPath')
        if(!uuid){
            // source is path
            if(Array.isArray(path)){
                //paths
                let data = path.map((s) => Rpcs.userFileService.move(userId, '', s, parent, destPath))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }else{
                return await Rpcs.userFileService.move(userId, '', path, parent, destPath)
            }
        }else{
            // source is uuid
            // check if is array
            if(Array.isArray(uuid)){
                //let count = 0
                let data = uuid.map((s) => Rpcs.userFileService.move(userId, s, '', parent, destPath))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }
            else{
                // move single Uuid
                return await Rpcs.userFileService.move(userId, uuid, '', parent, destPath)
            }
        }
    })
})

router.post('/copy', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        let userId = req.user.uuid
        let uuid = req.body['uuid']
        let path = req.body['path']
        let parent = RequestUtil.getString(req, 'parent', null)
        if(parent === null){
            parent = RequestUtil.getString(req, 'destUuid')
        }
        let destPath = RequestUtil.getString(req, 'destPath')
        if(!uuid){
            // source is path
            if(Array.isArray(path)){
                //paths
                let data = path.map((s) => Rpcs.userFileService.copy(userId, '', s, parent, destPath))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }else{
                return await Rpcs.userFileService.copy(userId, '', path, parent, destPath)
            }
        }else{
            // source is uuid
            // check if is array
            if(Array.isArray(uuid)){
                //let count = 0
                let data = uuid.map((s) => Rpcs.userFileService.copy(userId, s, '', parent, destPath))
                let counts = await Promise.all(data)
                return counts.reduce((sum, x) => sum + x)
            }
            else{
                // move single Uuid
                return await Rpcs.userFileService.copy(userId, uuid, '', parent, destPath)
            }
        }
    })
})

const fillDirectoryData = file => {
    if(file === undefined || file === null){
        return
    }
    if(!file['mime']){
        file['mime'] = 'application/x-directory'
    }
    if(!file['preview']){
        file['preview'] = -1
    }
    file['flag'] = 0
    file['hasPreview'] = false
}

const fillErrorData = file => {
    if(file === undefined || file === null){
        return
    }
    file['mime'] = 'application/x-error-file'
    file['preview'] = -1
    file['flag'] = 0
    file['type'] = -1
    file['storeId'] = ''
    file['hasPreview'] = false
}

const fillSimpleData = (file,simpleData) => {
    if(file === undefined || file === null){
        return
    }
    if(simpleData === undefined || simpleData === null){
        return
    }
    file['mime'] = simpleData['mime']
    if(!file['mime']){
        file['mime'] = 'application/x-error-file'
    }
    file['size'] = simpleData['size']
    file['preview'] = simpleData['preview']
    file['flag'] = simpleData['flag']
    if(simpleData['downloadAddress']){
        file['downloadAddress'] = simpleData['downloadAddress']
        if(file['path']){
            //let realPath = file['path']
            file['downloadAddress'] = encodeURI(simpleData['downloadAddress'].replace('${QINGZHEN-USER-PATH}',file['path']))
        }
    }
    file['hasPreview'] = simpleData['hasPreview']
}

const fillFileData = async (list) => {
    if(list === undefined || list === null){
        logger.info('Fill file data on empty list')
        return
    }
    if(!Array.isArray(list)){
        logger.warn('fillFileData only accept array')
        return
    }
    
    let map = new Map()
    let inArr = []
    list.forEach((fileData) => {
        // find this
        if(fileData.type !== 1){
            // is a file, need fetch
            //map.set(fileData.storeId,index)
            inArr.push(fileData.storeId)
        }else{
            fillDirectoryData(fileData)
        }
    })
    //logger.info('List dir %s',JSON.stringify(inArr))
    //
    //let cCount = 0
    if(inArr.length > 0){
        let fileDetails = await Rpcs.cloudStoreService.getList(inArr)
        for(let fileDetail of fileDetails){
            let remoteId = fileDetail['hash']
            //logger.info('Response %s',remoteId)
            //let index = map.get(remoteId)
            //map.delete(remoteId)
            //cCount++
            map.set(remoteId, fileDetail)
        }
    }
    list.forEach((fileData) => {
        if(fileData.type !== 1){
            let fileDetail = map.get(fileData['storeId'])
            if(!fileDetail){
                logger.error('File %s, store id %s cannot be found', fileData['uuid'], fileData['storeId'])
                fillErrorData(fileData)
            }else{
                fillSimpleData(fileData,fileDetail)
            }
        }
    })
    /*
    if(map.size != cCount){
        logger.error('Some store file id cannot found.')
        list.forEach((fileData) => {
        // find this
            if(fileData['mime'] === undefined || fileData['mime'] === null){
            // is a file, need fetch
                logger.error('File %s, store id %s cannot be found', fileData['uuid'], fileData['storeId'])
                fillErrorData(fileData)
            }
        })
    }
    */
}


module.exports = router