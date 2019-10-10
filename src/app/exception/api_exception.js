class ApiException extends Error {
    constructor(message, status, code, supress) {
        super(message)
        this._code = code ? code : 'INTERNAL_SERVER_ERROR'
        this._status = status ? (typeof (status) === 'number' ? status : 500) : 500
        this._success = false
        this._supress = supress == false ? false : true
    }
    get success() {
        return this._success
    }
    get code() {
        return this._code
    }
    get status() {
        return this._status
    }
    get supress() {
        return this._supress
    }

}

module.exports = ApiException