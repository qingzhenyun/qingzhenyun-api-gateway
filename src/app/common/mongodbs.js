const config = require('../config/mongodb_config')
const logger = require('log4js').getLogger('Mongodbs')
const MongoClient = require('mongodb').MongoClient
//const client = await MongoClient.connect(connectionString,{ useNewUrlParser: true })

const data = { 'client' : null, 'mainDb' : null, 'init' : () => {}}
MongoClient.connect(config.connectionString, { useNewUrlParser: true }).then(client => {
    logger.info('MongoDB connect ok.')
    data.client = client
    data.mainDb = client.db(config.defaultDb)
}).catch(err => {
    logger.error('Connect MongoDb failed. %s', err)
})

module.exports = data