const mongodb = require('../common/mongodbs')
const PREFIX = 'video_preview_'
const logger = require('log4js').getLogger('previewService')
const StringUtil = require('../util/string_util')
const M3u8Util = require('../util/m3u8_util')
const request = require('request-promise-native')
const PREFIX_CONFIG = require('../config/wcs_config')
const randomstring = require('randomstring')
const redisServiceInstance = require('./redis_service')

const _findCollectionName = (hash = '') => {
    if (!hash) {
        return PREFIX + '0'
    }
    return PREFIX + hash.charAt(hash.length - 1)
}

const _findCollection = (hash = '') => {
    return mongodb.mainDb.collection(_findCollectionName(hash))
}

const getPreview = async (hash) => {
    let _collection = _findCollection(hash)
    return await _collection.findOne({ '_id': hash })
}

const setPreview = async (hash, previewObject, cleanObjects) => {
    let _collection = _findCollection(hash)
    previewObject['_id'] = hash
    //logger.info(JSON.stringify(previewObject))
    try {
        await _collection.updateOne({ '_id': hash }, { '$set': previewObject }, { upsert: true })
        if(cleanObjects){
            await redisServiceInstance.client.delAsync(cleanObjects)
        }    
        return true
    }
    catch (err) {
        logger.error('Set preview failed. %s', err)
        return false
    }
}

const generateViewKey = (userId, rsaKey, duration = 0) => {
    let current = (new Date()).getTime()
    let currentString = current.toString(16)
    let viewKey = randomstring.generate(12) + currentString
    let storeKey = viewKey + '_' + userId.high.toString() + '_' + userId.low.toString()
    // save it to redis
    let save = { 'key': rsaKey, 'access': 0 }
    redisServiceInstance.client.setAsync(storeKey, JSON.stringify(save), 'EX', (duration + 20) * 2).then(() => { }).catch(err => logger.error(err))
    return viewKey
}

const getViewKey = async (userId, viewKey) => {
    let storeKey = viewKey + '_' + userId.high.toString() + '_' + userId.low.toString()
    // save it to redis
    let inDatabase = JSON.parse(await redisServiceInstance.client.getAsync(storeKey))
    if (inDatabase) {
        return inDatabase['key']
    }
    return 'an9EaNqnzy6WAABB'
}

const addCacheKeyPrefix = (type, bucket, key) => {
    return 'preview_cache_' + type + '_' + bucket + key
}

const fetchM3u8File = async (fileBucket, fileKey, keyUri) => {
    let cacheKey = addCacheKeyPrefix('m3u8',fileBucket, fileKey)
    let fileBinaryData = await redisServiceInstance.client.getAsync(cacheKey)
    let remote = false
    if (!fileBinaryData) {
        let option = { 'method': 'GET', 'uri': PREFIX_CONFIG.INTERNAL_DOWNLOAD_PREFIX + fileKey, 'encoding': 'utf-8', 'gzip': true, 'timeout': 30 * 1000 }
        fileBinaryData = await request(option)
        remote = true
    }
    let filePath = fileKey.substring(0, fileKey.lastIndexOf('/'))
    let d = M3u8Util.processM3u8File(fileBinaryData, filePath + '/', keyUri)
    if (remote && d[0]) {
        redisServiceInstance.client.setAsync(cacheKey, fileBinaryData, 'EX', 3600 * 24).then(() => { }).catch(err => logger.error(err))
    }
    return d
}

const buildAndWritePDF = async (fileHash, previewHash, filename = 'unknown.pdf') => {
    // do not use cache.
    let saveObj = { 'fileHash': fileHash, 'previewHash': previewHash, 'filename': filename, 'type': 1 }
    return await setPreview(fileHash,saveObj,undefined)
}

const buildAndWriteImage = async (fileHash, data) => {
    // do not use cache.
    let saveObj = !data ? {} : data
    saveObj['fileHash'] = fileHash 
    return await setPreview(fileHash,saveObj,undefined)
}

const buildAndWrite = async (encode, callback) => {
    let maxReslov = encode['reslov']
    let fileHash = encode['hash']
    let encodeKey = encode['key']
    // let convertType = encode['type']
    let success = false
    let saveObj = { 'maxReslov': maxReslov, 'hash': fileHash, 'encodeKey': encodeKey, 'type': encode['type'] }
    let operationId = callback['id']
    let videos = []
    let audios = []
    let subs = []
    let images = []
    let cleanObjects = []
    for (let item of callback['items']) {
        let operationSuccess = (item['code'] === '3')
        if (!operationSuccess) {
            logger.warn('%s operation failed %s', operationId, item['desc'])
        } else {
            let orignKey = item['key']
            let split = orignKey.indexOf(':')
            let bucket = orignKey.substring(0, split)
            let key = orignKey.substring(split + 1)
            let filename = key.substring(key.lastIndexOf('/') + 1)
            let obj = _detectTypeAndClear(filename, bucket, key, item)
            if (obj[1]) {
                switch (obj[0]) {
                    case 'images':
                        images.push(obj[2])
                        break
                    case 'video':
                        videos.push(obj[2])
                        break
                    case 'audio':
                        audios.push(obj[2])
                        break
                    case 'sub':
                        subs.push(obj[2])
                        break
                    default:
                        break
                }
            }

        }
    }
    if (videos.length > 0) {
        videos = videos.sort(StringUtil.sortBy(videos, 'clear'))
        saveObj['previewType'] = 'video'
        saveObj['preview'] = videos
        let clears = []
        let clearTexts = []
        for (let nx of videos) {
            clears.push(nx['clear'])
            clearTexts.push(nx['clearText'])
            cleanObjects.push(addCacheKeyPrefix('m3u8',nx['bucket'], nx['key']))
        }
        saveObj['clears'] = clears
        saveObj['clearTexts'] = clearTexts
        success = true
    }
    else if (audios.length > 0) {
        audios = audios.sort(StringUtil.sortBy(audios, 'clear'))
        saveObj['previewType'] = 'audio'
        saveObj['preview'] = audios
        let clears = []
        let clearTexts = []
        for (let nx of audios) {
            clears.push(nx['clear'])
            clearTexts.push(nx['clearText'])
            cleanObjects.push(addCacheKeyPrefix('m3u8',nx['bucket'], nx['key']))
        }
        saveObj['clears'] = clears
        saveObj['clearTexts'] = clearTexts
        success = true
    }
    if (subs.length > 0) {
        saveObj['subs'] = subs
    }
    if (images.length > 0) {
        saveObj['capture'] = images
    }
    if (!success) {
        return false
    }
    return await setPreview(fileHash, saveObj, cleanObjects)
}


const _detectTypeAndClear = (filename, bucket, key, item) => {
    let fname = filename.substring(0, filename.lastIndexOf('.'))
    let typeIdx = fname.lastIndexOf('-')
    let type = fname.substring(typeIdx + 1)
    let data = { 'bucket': bucket, 'key': key }
    switch (type) {
        case 'images':
            return [type, true, data]
        case 'video':
            // find clear
            return [type, true, _buildSingleVideo(data, fname, typeIdx, item)]
        case 'audio':
            return [type, true, _buildSingleAudio(data, fname, typeIdx, item)]
        case 'sub':
            return [type, true, {}]
        default:
            logger.warn('Can\'t recongnise type %s', filename)
            return ['', false, {}]
    }
}

const _buildSingleVideo = (data, fname, typeIdx, item) => {
    let preName = fname.substring(0, typeIdx)
    let clear = parseInt(preName.substr(preName.lastIndexOf('-') + 1))
    data['clear'] = clear
    let clearText = '720P'
    if (clear > 720) {
        clearText = '1080P'
    }
    if (clear > 1080) {
        clearText = '2K'
    }
    if (clear > 1600) {
        clearText = '4K'
    }
    data['duration'] = item['duration'] * 1000
    data['resolution'] = item['resolution']
    data['clearText'] = clearText
    return data
}

const _buildSingleAudio = (data, fname, typeIdx, item) => {
    let preName = fname.substring(0, typeIdx)
    let clear = parseInt(preName.substr(preName.lastIndexOf('-') + 1))
    data['clear'] = clear
    data['duration'] = item['duration'] * 1000
    let clearText = '128K'
    if (clear > 128) {
        clearText = '256K'
    }
    if (clear > 256) {
        clearText = '320K'
    }
    data['clearText'] = clearText
    return data
}

module.exports = { setPreview, buildAndWrite, getPreview, fetchM3u8File, generateViewKey,buildAndWriteImage, getViewKey,buildAndWritePDF }