const logger = require('./src/app/common/logger').getLogger('server')
const http = require('http')
const program = require('commander')
const app = require('./src/app/app')

program.version('0.1.0')
    .option('-p, --port <n>', 'Port, Default 3000')
    //    .option('-k, --appkey [value]', 'Message app key, Default None')
    //    .option('-i, --appid [value]', 'Message app id, Default None')
    .parse(process.argv)

let port = normalizePort(process.env.PORT || program.port || '3000')

app.set('port', port)
logger.info('Starting server on %d.', port)

let server = http.createServer(app)
server.listen(port)
server.on('error', onError)
server.on('listening', onListening)
function normalizePort(val) {
    var port = parseInt(val, 10)

    if (isNaN(port)) {
        // named pipe
        return val
    }

    if (port >= 0) {
        // port number
        return port
    }

    return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error
    }

    var bind = typeof port === 'string' ?
        'Pipe ' + port :
        'Port ' + port

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error(bind + ' requires elevated privileges')
            process.exit(1)
            return
        case 'EADDRINUSE':
            logger.error(bind + ' is already in use')
            process.exit(1)
            return
        default:
            throw error
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address()
    var bind = typeof addr === 'string' ?
        'pipe ' + addr :
        'port ' + addr.port
    logger.info('Listening on %s', bind)
}