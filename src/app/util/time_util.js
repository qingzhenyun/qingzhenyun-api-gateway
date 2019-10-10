class TimeUtil{
    static getCurrentTimeStamp() {
        return (new Date()).getTime()
    }
}
module.exports = TimeUtil