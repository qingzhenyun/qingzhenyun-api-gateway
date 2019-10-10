const router = require('express').Router()
const ResponseUtil = require('../../../util/response_util')
const RequestUtil = require('../../../util/request_util')

const base64Encode = (t) => {
    let a, r, e, n, i, s, o = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for (e = t.length, r = 0, a = ''; e > r;) {
        if (n = 255 & t.charCodeAt(r++), r == e) {
            a += o.charAt(n >> 2)
            a += o.charAt((3 & n) << 4)
            a += '=='
            break
        }
        if (i = t.charCodeAt(r++), r == e) {
            a += o.charAt(n >> 2)
            a += o.charAt((3 & n) << 4 | (240 & i) >> 4)
            a += o.charAt((15 & i) << 2)
            a += '='
            break
        }
        s = t.charCodeAt(r++)
        a += o.charAt(n >> 2)
        a += o.charAt((3 & n) << 4 | (240 & i) >> 4)
        a += o.charAt((15 & i) << 2 | (192 & s) >> 6)
        a += o.charAt(63 & s)
    }
    return a
}

// const getSign = (a,b,s) => {return base64Encode(s(a,b))}

router.post('/eval',async (req, res) => {
    ResponseUtil.tryRun(req, res, async () => {
        //let data = {'headers': req.headers, 'body': req.body}
        let js = RequestUtil.getString(req, 'sign2')
        if(!js){
            return false
        }
        let s = () => {}
        //s = eval(js)
        eval(js)
        let a = RequestUtil.getString(req, 'a')
        let b = RequestUtil.getString(req, 'b')
        return base64Encode(s(a,b))
    })
})



module.exports = router