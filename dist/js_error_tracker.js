/*!
 * @module jse-tracker
 * @author lixianfeng
 * @License MIT 
 * @date 2016/3/28
 */
var JSE_Tracker = (function(global) {
    if (global.JSE_Tracker) return global.JSE_Tracker;

    var _config = {
        // userId: !!window.userid?userid:"0",                  // userid
        // responsibleFor: "lixianfeng912@gmail.com",           // responsible developer's e-mail(receive alarm mail)
        // submit:function(errorStr){console.log(errorStr)},    // subimit'handler for errorStr
        random:1,                                               // the rate of random sample, 1 means submit every error 
        ignore:[]                                               // ["ReferenceError: B is not defined at http://lxf.com/app.js"]
    };

    var _getUAtype = function() {
        return $.browser.chrome ? 'chrome' : ( ($.browser.msie) ? 'IE' : ( ($.browser.mozilla) ? 'firefox' : ( ($.browser.safari) ? 'safari' : ( ($.browser.opera) ? 'opera' : 'unknown') )));
    };

    var _errorMsg = {
        "clientErrorLocation": location.href || "unknown",
        "browserType": _getUAtype() + '|' + $.browser.version + '|' + window.navigator.platform + '|' +(navigator.userAgent || "unknown"),
        "clientErrorMsg": "unknown",
        "clientErrorUrl": "unknown",
        "clientErrorDate": "unknown",
        "clientErrorLine": "unknown",
        "clientErrorColum": 'unknown',
        "clientErrorStack": 'unknown'
    };

    if(typeof Array.prototype.indexOf === 'undefined'){
        Array.prototype.indexOf = function(child) {
            for(var index in this){
                if(this[index] === child)return index;
            }
            return -1;
        };
    }
    
    if(typeof String.prototype.trim === 'undefined'){
        String.prototype.trim = function() {
            return this.replace(/(^\s*)|(\s*$)/g,"");
        };
    }
    

    var _isOBJ = function(obj) {
        var type = typeof obj;
        return type === "object" && !!obj;
    };

    // merge
    var _merge = function(org, obj) {
        var key;
        for (key in obj) {
            org[key] = obj[key];
        }
        return org;
    };

    // function or not
    var _isFunction = function(foo) {
        return typeof foo === 'function';
    };

    // simple clone 
    var _simpleClone = function(targetObj) {
        var key, newObj = {};
        for (key in targetObj) {
            newObj[key] = targetObj[key];
        }
        return newObj;
    };

    var _getTimeStr = function (){
        var currentDate = new Date();
        return currentDate.toLocaleDateString() + '——' + currentDate.toLocaleTimeString();
    };

    var _getInitErrorObj = function() {
        var errorOption = _simpleClone(_errorMsg);
        errorOption.clientErrorDate = _getTimeStr();
        return errorOption;
    };

    // get error info from try-catch obj
    var _processTryError = function(error){
        var errorObj = _getInitErrorObj(),
            errorStack = error.stack,
            splitAt = errorStack.indexOf('@') > -1?'@':'at',
            stackArr = errorStack.split(splitAt);

        errorObj.clientErrorStack = errorStack;
        errorObj.clientErrorMsg = !!error.message?error.message:stackArr[0].trim();

        //file name
        if(!error.fileName){
            var originalUrl = /(.+\.js)/.exec(stackArr[1])[1];
            if( originalUrl.indexOf('http') > -1){
                originalUrl = /(http.+)$/.exec(originalUrl)[1]; // AbsolutePath
            }else{
                originalUrl = /^(.+)[^\/]*$/.exec(location.href)[1] + '/' + originalUrl; // RelativePath
            }
            errorObj.clientErrorUrl = originalUrl;
        }else{
            errorObj.clientErrorUrl = error.fileName;
        }

        //row and clo
        var lineAndColStr = /\.js:([^\)]+)/.exec(stackArr[1])[1];
        var lineAndColArr = lineAndColStr.split(':');

        errorObj.clientErrorLine = !!error.lineNumber?error.lineNumber:parseInt(lineAndColArr[0]);
        
        if( !!error.columnNumber ){
            errorObj.clientErrorColum = error.columnNumber;
        }else if( lineAndColArr[1] ){
            errorObj.clientErrorColum = parseInt(lineAndColArr[1]);
        }

        return errorObj;
    };

    var _errorToString = function(errorObj) {
        var index, errorStr = '';
        for( index in errorObj){
            errorStr += encodeURIComponent(index) + '=' + encodeURIComponent(errorObj[index]) + '&';
        }
        return errorStr.trim().substring(0,errorStr.length-1);
    };

    var _toSubmitList = [];
    var _timer = null;
    var _submit = function(errorStr) {
        if(_config.submit && typeof _config.submit === 'function'){
            _config.submit(errorStr);
            return;
        }
        //default submit handler
        try{
            if(window.clickLog){
                window.clickLog(errorStr);
            }else{
                _toSubmitList.push(errorStr);
                if(!_timer){
                    _timer = setInterval(function(){
                        if(window.clickLog){
                            for(var i=0,len=_toSubmitList.length; i<len; i++){
                                window.clickLog(_toSubmitList[i]);
                            }
                            _toSubmitList = [];
                            clearInterval(_timer);
                            _timer = null;
                        }
                    },2000);
                }
            }
        } catch(e) {
            window.console && console.error && console.error(e)
        };
    };

    var _send = function(errorObj) {
        var errorMsg = errorObj.clientErrorMsg + ' at ' + errorObj.clientErrorUrl;
        //ignore and sampling
        if( _config.ignore.indexOf(errorMsg) > -1 || Math.random() >= _config.random )return;
        _submit(_errorToString(errorObj));
    };

    var _currentErrorMsg = null;

    //try-catch handler
    var _catchHandler = function(e) {
        if(e.stack){
            var errorObj = _processTryError(e);
            _send(errorObj);
            // errorTips for console
            // throw error would caused executing try-catch twice in the Modern browser includes IE10 sometimes(their catch-error-obj includes stack info)
            // so show the error tips for developers by console.error
            var errorTip = e.stack? e.stack:e.message;
            if(window.console){
                if(console.error){
                    console.error(errorTip);
                }else if(console.log){
                    console.log('JSE_Tracker:',errorTip);
                }
            }
        }else{
            // catch-error-obj just includes message in <IE10, 
            // so throw it to window.error to get filename&row 
            _currentErrorMsg = e.message.toString();                // record e.message for window.onerror                                         
            throw e;                                                // trigger onerror handler and show error in console
        }
    };

    var wrap = function(foo, args) {
        return function() {
            try {
                return foo.apply(this, args || arguments);
            } catch (e) {
                _catchHandler(e);
            }
        };
    };

    var wrapArgs = function(foo) {
        return function() {
            var arg, args = [];
            for (var i = 0, l = arguments.length; i < l; i++) {
                arg = arguments[i];
                _isFunction(arg) && (arg = wrap(arg));
                args.push(arg);
            }
            return foo.apply(this, args);
        };
    };

    var wrapTimeout = function(foo) { 
        return function(cb, timeout) {
            // for setTimeout(string, delay)
            if (typeof cb === 'string') {
                try {
                    cb = new Function(cb);
                } catch (e) {
                    _catchHandler(e);
                }
            }
            var args = [].slice.call(arguments, 2);
            // for setTimeout(function, delay, param1, ...);
            cb = wrap(cb, args.length && args);
            return foo(cb, timeout);
        };
    };

    /**
     * makeArgsTry
     * wrap a function's arguments with try & catch
     * @param {Function} foo
     * @param {Object} self
     * @returns {Function}
     */
    var makeArgsTry = function(foo, self) {
        return function() {
            var arg, tmp, args = [];
            for (var i = 0, l = arguments.length; i < l; i++) {
                arg = arguments[i];
                _isFunction(arg) && (tmp = wrap(arg)) &&
                    (arg.tryWrap = tmp) && (arg = tmp);
                args.push(arg);
            }
            return foo.apply(self || this, args);
        };
    };

    /**
     * makeObjTry
     * wrap a object's all value with try & catch
     * @param {Function} foo
     * @param {Object} self
     * @returns {Function}
     */
    var makeObjTry = function(obj) {
        var key, value;
        for (key in obj) {
            value = obj[key];
            if (_isFunction(value)) obj[key] = wrap(value);
        }
        return obj;
    };


    var JsMonitor = {};

    JsMonitor.onerrorMonitor = function() {
        // rewrite window.onerror
        var oldErrorHandler = global.onerror;

        global.onerror = function(message, url, line, column, error){
            if(typeof oldErrorHandler === 'function') {
                oldErrorHandler.apply(this, arguments);
            }

            var stack = '', errorObj = _getInitErrorObj();

            errorObj.clientErrorUrl = url ? url : location.href;
            errorObj.clientErrorLine = line;
            errorObj.clientErrorColum = column || (window.event && window.event.errorCharacter) || -1;

            errorObj.clientErrorMsg = (_currentErrorMsg !== null)? _currentErrorMsg : message;
            _currentErrorMsg = null;
            
            if (!!error && !!error.stack){
                stack = error.stack.toString();
            }else if (!!arguments.callee){
                //get degraded stack info by callee
                var ext = [];
                var f = arguments.callee.caller, c = 3;
                var count = 1;
                while (f && (--c>0)) {
                    count++;
                    ext.push(f.toString());
                    if (f  === f.caller) {
                        break;//avoiding infinite loops
                    }
                    f = f.caller;
                }
                stack = ext.join("||");
            }
            errorObj.clientErrorStack = stack;
            _send(errorObj);

            return false;
        };
    };

    var tryCatcher = JsMonitor.tryCatchMonitor = {};

    /**
     * wrap amd or commonjs of function  ,exp :  define , require ,
     * @returns {Function}
     */
    tryCatcher.monitorModules = function() {
        var _require = global.require,
            _define = global.define;
        if (_define && _define.amd && _require) {
            global.require = wrapArgs(_require);
            _merge(global.require, _require);
            global.define = wrapArgs(_define);
            _merge(global.define, _define);
        }

        if (global.seajs && _define) {
            global.define = function() {
                var arg, args = [];
                for (var i = 0, l = arguments.length; i < l; i++) {
                    arg = arguments[i];
                    if (_isFunction(arg)) {
                        arg = wrap(arg);
                        //seajs should use toString parse dependencies , so rewrite it
                        arg.toString = (function(orgArg) {
                            return function() {
                                return orgArg.toString();
                            };
                        }(arguments[i]));
                    }
                    args.push(arg);
                }
                return _define.apply(this, args);
            };

            global.seajs.use = wrapArgs(global.seajs.use);

            _merge(global.define, _define);
        }

        return tryCatcher;
    };

    /**
     * wrap jquery async function ,exp : event.add , event.remove , ajax
     * @returns {Function}
     */
    tryCatcher.monitorJquery = function() {
        var _$ = global.$;

        if (!_$ || !_$.event) {
            return tryCatcher;
        }

        var _add, _remove;
        if(_$.zepto){
            _add = _$.fn.on, _remove = _$.fn.off;

            _$.fn.on  = makeArgsTry(_add);
            _$.fn.off  = function() {
                var arg, args = [];
                for (var i = 0, l = arguments.length; i < l; i++) {
                    arg = arguments[i];
                    _isFunction(arg) && arg.tryWrap && (arg = arg.tryWrap);
                    args.push(arg);
                }
                return _remove.apply(this, args);
            };

        }else if(window.jQuery){
            _add = _$.event.add, _remove = _$.event.remove;

            _$.event.add = makeArgsTry(_add);
            _$.event.remove = function() {
                var arg, args = [];
                for (var i = 0, l = arguments.length; i < l; i++) {
                    arg = arguments[i];
                    _isFunction(arg) && arg.tryWrap && (arg = arg.tryWrap);
                    args.push(arg);
                }
                return _remove.apply(this, args);
            };
        }

        var _ajax = _$.ajax;

        if (_ajax) {
            _$.ajax = function(url, setting) {
                if (!setting) {
                    setting = url;
                    url = undefined;
                }
                makeObjTry(setting);
                if (url) return _ajax.call(_$, url, setting);
                return _ajax.call(_$, setting);
            };
        }

        return tryCatcher;
    };

    /**
     * wrap async of function in window , exp : setTimeout , setInterval
     * @returns {Function}
     */
    tryCatcher.monitorSystem = function() {
        global.setTimeout = wrapTimeout(global.setTimeout);
        global.setInterval = wrapTimeout(global.setInterval);
        return tryCatcher;
    };

    /**
     * wrap custom of function ,
     * @param obj - obj or  function
     * @returns {Function}
     */
    tryCatcher.monitorCustom = function(obj) {
        if (_isFunction(obj)) {
            return wrap(obj);
        } else {
            return makeObjTry(obj);
        }
    };

    /**
     * run monitorJquery() and monitorModules() and monitorSystem()
     * @returns {Function}
     */
    tryCatcher.monitorAll = function() {
        tryCatcher.monitorJquery().monitorModules().monitorSystem();
        return tryCatcher;
    };


    JsMonitor.init = function(config) {
        if (_isOBJ(config)) {
            for (var key in config) {
                _config[key] = config[key];
            }
        }
        //only the two configurations are useful
        _config['userid'] && (_errorMsg['userid'] = _config['userid']);
        _config['responsibleFor'] && (_errorMsg['responsibleFor'] = _config['responsibleFor']);
        
        JsMonitor.onerrorMonitor();
        tryCatcher.monitorAll();
    };

    var report = {
        init: JsMonitor.init,

        monitorCustom: tryCatcher.monitorCustom, //wramp custom function by try-catch   
        
        catcherHandler: _catchHandler,           //process try-catch error-obj
        
        __onerror__: global.onerror
    };

    return report;

}(window));