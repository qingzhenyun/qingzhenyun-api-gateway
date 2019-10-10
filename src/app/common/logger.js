const log4js = require('log4js')
//if (!fs.existsSync(_log_store)) fs.mkdirSync(_log_store)
if (process.env.NODE_ENV === 'production') {
    log4js.configure({
        /*
        appenders: {
            evaluate: {
                type: 'dateFile',
                filename: Path.join(_log_store, 'engineer.log'),
                pattern: '_yyyy-MM-dd',
                maxLogSize: 1024 * 1024,
                alwaysIncludePattern: true,
                backups: 4
            }
        },
        categories: {
            default: {
                appenders: ['evaluate'],
                level: 'ERROR'
            }
        },
        */
        pm2: true
    })
} else {
    log4js.configure({
        /*
        appenders: {
            console: {
                type: 'console'
            },
            evaluate: {
                type: 'console',
                // filename: Path.join(_log_store, 'evluate.log'),
                pattern: '.yyyy-MM-dd',
                // maxLogSize: 1024 * 1024,
                alwaysIncludePattern: true,
                daysToKeep: 30
            }
        },
        replaceConsole: true,
        */
        appenders: {
            console: {
                type: 'console',
                layout: { type: 'basic' }
            }
        },
        categories: {
            default: {
                appenders: ['console'],
                level: 'INFO'
            }
        },

        pm2: false
    })
}
/*
log4js.configure({ appenders: [ { type: "console", layout: { type: "basic" } } ], replaceConsole: true })
*/
module.exports = log4js