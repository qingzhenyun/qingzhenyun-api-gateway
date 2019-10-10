const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')

// Internal task
router.post('/time', (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        return (new Date()).getTime()
    })
})
module.exports = router