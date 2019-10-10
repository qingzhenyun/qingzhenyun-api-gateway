const router = require('express').Router()
//router.use('/test', require('./test'))
router.use('/user', require('./user'))
router.use('/files', require('./files'))
router.use('/preview', require('./preview'))
router.use('/store', require('./store'))
router.use('/offline', require('./offline'))
router.use('/common', require('./common'))
module.exports = router