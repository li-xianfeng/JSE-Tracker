/*!
 * @module error-report
 * @author lixianfeng
 * @date 2016/3/28
 */
/*!
 * @module error_monitor
 * @author lixianfeng
 * @date @DATE 2016/3/21
 */
var JSE_Tracker = (function(global) {
    if (global.JSE_Tracker) return global.JSE_Tracker;

    var _config = {
        // "client": "pc", 
        // "58clientPdType": "post",
        // submit:function(errorStr){},//配置则生效
        random:1,  //抽样上报 0 ~ 1 ,1为百分百上报
        ignore:[]//["ReferenceError: B is not defined at http://lxf.com/bj-report/app.js"]
    };

    var _getUAtype = function() { 
        if($.browser.chrome)return 'chrome';
        if($.browser.msie) return 'IE';
        if($.browser.mozilla) return 'mozilla';
        if($.browser.safari) return 'safari'; 
        if($.browser.opera)  return 'opera';
        return 'unknown';
    };

    var _errorMsg = {
        "from": "58clientErrorReport",
        "client": "pc",
        "58clientPdType": "post",
        "clientErrorLocation": location.href || "unknown",
        "resultState": "failed",
        // "userId": !!window.userid?userid:"0",
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
        // trim
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
    var _simpleExtend = function(targetObj) {
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

    //获取初始化错误信息对象
    var _getInitErrorObj = function() {
        var errorOption = _simpleExtend(_errorMsg);
        errorOption.clientErrorDate = _getTimeStr();
        return errorOption;
    };

    // 从try-catch中获取错误信息数据
    var _processTryError = function(error){
        var errorObj = _getInitErrorObj(),
            errorStack = error.stack,
            splitAt = errorStack.indexOf('@') > -1?'@':'at',
            stackArr = errorStack.split(splitAt);

        errorObj.clientErrorStack = errorStack;
        //获取文件错误信息
        errorObj.clientErrorMsg = !!error.message?error.message:stackArr[0].trim();

        //获取文件名
        if(!error.fileName){
            var originalUrl = /(.+\.js)/.exec(stackArr[1])[1];
            if( originalUrl.indexOf('http') > -1){
                originalUrl = /(http.+)$/.exec(originalUrl)[1]; //绝对路径
            }else{
                originalUrl = /^(.+)[^\/]*$/.exec(location.href)[1] + '/' + originalUrl; //相对路径
            }
            errorObj.clientErrorUrl = originalUrl;
        }else{
            errorObj.clientErrorUrl = error.fileName;
        }

        //获取行数列数s
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
        // return $.param(errorObj)
    };

    var _toSubmitList = [];
    var _timer = null;
    var _submit = function(errorStr) {
        if(_config.submit && typeof _config.submit === 'function'){
            _config.submit(errorStr);
            return;
        }
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
    // var _dontHandleError = false; //告诉onerror不要处理错误

    //try-catch错误处理
    var _catchHandler = function(e) {
        // IE10以下catch error对象没有stack，但是抛出异常让window.error捕获能拿到文件名和行数
        if(e.stack){
            var errorObj = _processTryError(e);
            _send(errorObj);
            //显示错误信息
            var errorTip = e.stack? e.stack:e.message;
            if(window.console){
                if(console.error){
                    console.error(errorTip);
                }else if(console.log){
                    console.log('JSE_Tracker:',errorTip);
                }
            }
        }else{
            _currentErrorMsg = e.message.toString();
            throw e;
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

            errorObj.clientErrorUrl = url ? url : localtion.href;
            errorObj.clientErrorLine = line;
            errorObj.clientErrorColum = column || (window.event && window.event.errorCharacter) || -1;

            errorObj.clientErrorMsg = (_currentErrorMsg !== null)? _currentErrorMsg : message;
            _currentErrorMsg = null;
            
            if (!!error && !!error.stack){
                //如果浏览器有堆栈信息
                //直接使用
                stack = error.stack.toString();
            }else if (!!arguments.callee){
                //尝试通过callee拿堆栈信息
                var ext = [];
                var f = arguments.callee.caller, c = 10;
                //这里只拿三层堆栈信息
                var count = 1;
                while (f && (--c>0)) {
                    // console.log(count);
                    count++;
                    // console.log(f);
                    ext.push(f.toString());
                    // console.log(f.caller);
                    if (f  === f.caller) {
                        break;//如果有环
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

    //tryCatcher功能
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
        if(window.jQuery){
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
        //只允许配置这两项信息
        _config['client'] && (_errorMsg['client'] = _errorMsg['client']);
        _config['58clientPdType'] && (_errorMsg['58clientPdType'] = _config['58clientPdType']);
        
        JsMonitor.onerrorMonitor();
        tryCatcher.monitorAll();
    };

    var report = {
        init: JsMonitor.init,

        monitorCustom: tryCatcher.monitorCustom, //try-catch监听器   
        
        catcherHandler: _catchHandler,  //处理try-catch捕获的错误并提交
        
        __onerror__: global.onerror
    };

    return report;

}(window));