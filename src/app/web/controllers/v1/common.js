const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')


// Internal task
router.get('/time', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        return (new Date()).toISOString()
    })
})

module.exports = router