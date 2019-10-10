const ice = require('ice').Ice
const CommonRpc = require('../service/common_rpc')
const logger = require('log4js').getLogger('Rpcs')
class Rpcs {

    constructor() {
        this.registeredRpc = {}
    }

    initialize() {
        let communicator = ice.initialize(process.argv)
        let cs = new CommonRpc(communicator,'UserFileServiceHandler', require('../ice/userfile').userfile.UserFileServiceHandlerPrx,res => this.registeredRpc['UserFileServiceHandler'] = res)
        cs.addSlowFunction('createFile', 400)
        new CommonRpc(communicator,'UserCenterServiceHandler', require('../ice/usercenter').usercenter.UserCenterServiceHandlerPrx,res => this.registeredRpc['UserCenterServiceHandler'] = res)
        new CommonRpc(communicator,'CloudStoreServiceHandler', require('../ice/cloudstore').cloudstore.CloudStoreServiceHandlerPrx,res => this.registeredRpc['CloudStoreServiceHandler'] = res)
        new CommonRpc(communicator,'OfflineTaskServiceHandler', require('../ice/offline').offline.OfflineTaskServiceHandlerPrx, res => this.registeredRpc['OfflineTaskServiceHandler'] = res)
        // new CommonRpc(communicator, 'UserCenterServiceHandler', require('../ice/usercenter').usercenter.UserCenterServiceHandlerPrx, )
    }


    getRpc(rpcName) {
        let data = this.registeredRpc[rpcName]
        if (!data) {
            logger.warn('Access not registered rpc %s', rpcName)
        }
        return data
    }

    get userFileService(){
        return this.getRpc('UserFileServiceHandler')
    }

    get userCenterService(){
        return this.getRpc('UserCenterServiceHandler')
    }

    get cloudStoreService(){
        return this.getRpc('CloudStoreServiceHandler')
    }

    get offlineTaskService(){
        return this.getRpc('OfflineTaskServiceHandler')
    }

}
module.exports = new Rpcs()