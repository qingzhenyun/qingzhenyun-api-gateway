
const redis = require('redis')
const redis_config = require('../config/redis_config')
const bluebird = require('bluebird')
const logger = require('log4js').getLogger('RedisService')
bluebird.promisifyAll(redis)
class RedisService {
    constructor() {
        this.version = '0'
        let retry_strategy = options => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
                // End reconnecting on a specific error and flush all commands with
                // a individual error
                logger.error('The server refused the connection')
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
                // End reconnecting after a specific timeout and flush all commands
                // with a individual error
                logger.error('Retry time exhausted %d', options.total_retry_time)
            }
            if (options.attempt > 10) {
                // End reconnecting with built in error
                logger.error('Retry attempt exhausted, %d', options.attempt)
            }
            // reconnect after
            return Math.min(options.attempt * 100, 3000)
        }
        redis_config['retry_strategy'] = retry_strategy
        this._client = redis.createClient(redis_config)
        this._client.on('error', error => logger.error('Redis error %s', error))
        this._client.on('warning', warning => logger.warn('Redis warning %s', warning))
        this._client.on('ready', () => logger.info('Redis client ready.'))
        this._client.on('reconnecting', () => logger.info('Redis client reconnecting.'))
    }

    get client(){
        return this._client
    }
}

module.exports = new RedisService()