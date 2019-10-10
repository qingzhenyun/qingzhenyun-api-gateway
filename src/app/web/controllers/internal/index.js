const router = require('express').Router()
router.use('/store', require('./store'))
router.use('/preview', require('./preview'))
router.use('/offline', require('./offline'))
router.use('/util', require('./util'))
module.exports = router