const ApiError = require('../exception/api_exception')
const logger = require('log4js').getLogger('CommonRpc.js')
const SLOW_DEFAULT_TIME = 200
class CommonRpc {
    constructor(ice, adapterName, prx, callback) {

        // check
        this.slowIgnore = new Map()
        this._adapterName = adapterName
        let base = ice.stringToProxy(adapterName)
        this._data = undefined
        prx.checkedCast(base).then(data => {
            if (data != null) {
                this._data = data
                logger.info('%s comfirmed.', adapterName)
                if(callback != null){
                    callback.apply(null,[this])
                }
                for (let xx in data) {
                    let v = data[xx]
                    if (typeof (v) == 'function') {
                        if (!xx.startsWith('ice_')) {
                            // logger.info('Register function %s on %s', xx, adapterName)
                            this[xx] = (...args) => {
                                
                                let func = data[xx](...args)
                                if(func instanceof Promise){
                                    //logger.info('call %s:%s',adapterName, xx)
                                    let startTime = (new Date()).getTime()
                                    return new Promise((reslove,reject) => {
                                        func.then(result => {
                                            let timeEslimate = (new Date()).getTime() - startTime
                                            reslove(result)
                                            let time = this.slowIgnore.get(xx)
                                            if(time === undefined){
                                                time = SLOW_DEFAULT_TIME
                                            }
                                            if(timeEslimate > time){
                                                logger.warn('Slow Log: Call %s:%s success in %d ms', adapterName, xx, timeEslimate)
                                            }
                                            
                                        }).catch(error => {
                                            let timeEslimate = (new Date()).getTime() - startTime
                                            if (!(error instanceof ApiError)){
                                                reject(error)
                                            }
                                            let time = this.slowIgnore.get(xx)
                                            if(time === undefined){
                                                time = SLOW_DEFAULT_TIME
                                            }
                                            if(timeEslimate > time){
                                                logger.warn('Slow (Call Failed) Log: Call %s:%s success in %d ms', adapterName, xx, timeEslimate)
                                            }
                                        })
                                    })
                                    
                                }else{
                                    return func
                                }
                                //let timeEslimate = (new Date()).getTime() - startTime
                            }
                        }
                    }
                }
                this._inited = true
            } else {
                logger.error('%s failed.(Server responses null)', adapterName)
                this._inited = false
            }

        }).catch((ex) => {
            logger.error('%s failed.', adapterName)
            logger.error(ex)
            this._inited = false
        })
    }

    get rpc() {
        if (!this._inited) {
            throw new Error('RPC not inited.')
        }
        return this._data
    }

    addSlowFunction(functionName = '', warningTime = 1000){
        if(functionName === undefined || functionName === null || Number.isNaN(functionName) || functionName === ''){
            return this
        }
        if(warningTime < 1){
            return this
        }
        this.slowIgnore.set(functionName, warningTime)
        return this
    }
}

module.exports = CommonRpc