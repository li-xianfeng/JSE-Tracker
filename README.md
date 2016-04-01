#JSE-Tracker -- javascript异常捕获与上报

## Author
 [lixianfeng](https://github.com/li-xianfeng)
 
 
## Getting Started
> JSE-Tracker 须在jquery、zepto、requirejs、seajs之后，但需在页面主模块之前加载并初始化 

```javascript
JSE_Tracker.init({
    userId: !!window.userid?userid:"0",                       // userid
    responsibleFor: "lixianfeng912@gmail.com",                // 异常代码维护人e-mail(接收报警邮件)
    random:1,                                                 // 抽样上报, 1 意味着上报所有错误信息 
    ignore:[],                                                // ["ReferenceError: B is not defined at http://lxf.com/app.js"]
    submit:function(erStr){                                   // 错误上报方法
        if( $.browser.msie && ($.browser.version == "6.0")){
            alert(erStr);
            return;
        }
        console.log(erStr);
    }
});
