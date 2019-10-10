const WCS_CONFIG = require('../config/wcs_config')
const StringUtil = require('../util/string_util')

const replaceKeyUri = (line = '', newKeyUri = '') => {
    let idx = line.indexOf('URI="')
    let quote = idx + 'URI='.length + 1
    let quoteLine = line.substring(quote)
    let quoteEndIndex = quoteLine.indexOf('"')
    return line.substring(0, quote) + newKeyUri + quoteLine.substring(quoteEndIndex)
}


const processM3u8File = (file = '', filePrefix = '', keyUri = '') => {
    let lines = file.split('\n')
    let success = false
    let results = []
    let timeOffset = 0.0 + 60 * 30 + ((new Date()).getTime() / 1000)
    for (let line of lines) {
        line = line.trim()
        if (line.startsWith('#EXT-X-KEY')) {
            results.push(replaceKeyUri(line, keyUri))
        }
        else if (line.startsWith('#EXTINF:')) {
            let fline = line.substring(8)
            let idx = fline.indexOf(',')
            if (idx > -1) {
                timeOffset += parseFloat(fline.substring(0, idx))
            }
            else {
                timeOffset += parseFloat(fline)
            }
            results.push(line)
        }
        else if (line.endsWith('.ts')) {
            results.push(addWcsKey(line, filePrefix, timeOffset))
        }
        else if(line.startsWith('#EXT-X-ENDLIST')){
            success = true
            results.push(line)
        }else{
            results.push(line)
        }
    }
    return [success, results.join('\n')]
}

const addWcsKey = (line = '', filePrefix = '', timeStamp = 0) => {
    timeStamp = parseInt(timeStamp)
    line += ('?wsSecret=' + StringUtil.calcWcsKey(filePrefix
        + line, WCS_CONFIG.VOD_HOST, timeStamp, WCS_CONFIG.ENCODE_KEY)
        + '&wsTime=' + timeStamp.toString(16))
    return WCS_CONFIG.VOD_HOST_PREFIX + filePrefix + line
}

module.exports = { replaceKeyUri,processM3u8File }