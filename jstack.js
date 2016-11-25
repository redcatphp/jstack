jstackClass = function(){
	this.config = {
		templatesPath: 'view-js/',
		controllersPath: 'controller-js/',
		defaultController: function(){
			$.extend(true,this,{data:{}});
		},
		defaultTarget: '[j-app]',
		debug: $js.dev,
	};
	this.controllers = {};
};
jstackClass.prototype.extend = function(c,parent){
	c.prototype = Object.create(parent.prototype);
};
jstack = new jstackClass();
//     proxy-observe v0.0.18
//     Copyright (c) 2015, 2016 Simon Y. Blackwell, AnyWhichWay
//     MIT License - http://opensource.org/licenses/mit-license.php
// modified by surikat: add fullObserve
(function() {
	"use strict";
	// Creates and returns a Proxy wrapping a target so that all changes can be trapped and forwarded to
	// a callback. The callback takes an array of changes just like the traditional original Chrome Object.observe
	// {object:<object changed>,name:<field changed>,type:add|update|delete|reconfigure|preventExtensions|setPrototype,oldValue:<old value if update | delete>}
	// The acceptlist can be add|update|delete|reconfigure|preventExtensions|setPrototype.
	// v 0.0.10 to support pausing and restarting observation two additional constructor arguments are available to Object.observe:
	// pausable - create the Observer so it can be paused
	// pause - create observer in paused state
	// if pausable is true then an additional method deliver(ignorePrevious) is available to start delivery
	// to pause delivery set a property called pause on the function deliver to true
	// pausable is optional to reduce the chance of shadowing a property or method on any existing code called deliver
	if(!Object.observe && typeof(Proxy)==="function") {
		function Observer(target,callback,acceptlist,pausable,pause,delay) {
	    	var me = this, proxy;
	    	function deliver(ignorePrevious,delay) {
	    		deliver.delay = delay;
	    		if(!deliver.pause) {
	        		if(me.changeset.length>0) {
	        			if(!ignorePrevious) {
		    	    		var changes = me.changeset.filter(function(change) { return !acceptlist || acceptlist.indexOf(change.type)>=0; });
		        			if(changes.length>0) {
		        				callback(changes);
		        			}
	        			}
	        			me.changeset = [];
	        		}
	    		}
	    	}
	    	deliver.pause = pause;
	    	deliver.delay = delay;
		    me.get = function(target, property) {
		    	if(property==="__observer__") {
		    		return me;
		    	}
		    	if(property==="unobserve") {
		    		return function() {
		    			Object.unobserve(target);
		    			return target;
		    		};
		    	}
		    	if(property==="deliver") {
		    		return deliver;
		    	}
		    	return target[property];
		    }
	    	me.target = target;
	    	me.changeset = [];
	    	if(!me.target.__observerCallbacks__) {
	    		// __observerCallbacks__ is used as an index to get at the proxy which is the observer, so we can unobserve
	    		Object.defineProperty(target,"__observerCallbacks__",{enumerable:false,configurable:true,writable:false,value:[]});
	    		Object.defineProperty(target,"__observers__",{enumerable:false,configurable:true,writable:false,value:[]});
	    	}
	    	me.target.__observerCallbacks__.push(callback);
	    	me.target.__observers__.push(this);
	    	proxy = new Proxy(target,me);
	    	deliver(false,delay);
	    	return proxy;
	    }
		Observer.prototype.deliver = function() {
			return this.get(null,"deliver");
		}
	    Observer.prototype.set = function(target, property, value) { // , receiver
	    	var oldvalue = target[property];
	    	var type = (oldvalue===undefined ? "add" : "update");
	    	target[property] = value;
	    	if(target.__observers__.indexOf(this)>=0 && (!this.acceptlist || this.acceptlist.indexOf(type)>=0)) {
	        	var change = {object:target,name:property,type:type},
	        		start = this.changeset.length === 0,
	        		deliver = this.deliver();
	        	if(type==="update") {
	        		change.oldValue = oldvalue;
	        	}
	        	this.changeset.push(change);
	        	if(start) {
	        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
	        	}
	    	}
	    	return true;
	    };
	    Observer.prototype.deleteProperty = function(target, property) {
	    	var oldvalue = target[property];
	    	//if(typeof(oldvalue)!=="undefined") {
		    	delete target[property];
		    	if(target.__observers__.indexOf(this)>=0 && !this.acceptlist || this.acceptlist.indexOf("delete")>=0) {
		        	var change = {object:target,name:property,type:"delete",oldValue:oldvalue},
		        		start = this.changeset.length === 0,
		        		deliver = this.deliver();
		        	this.changeset.push(change);
		        	if(start) {
		        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
		        	}
		    	}
	    	//}
	    	return true;
	    };
	    Observer.prototype.defineProperty = function(target, property, descriptor) {
	    	Object.defineProperty(target, property, descriptor);
	    	if(target.__observers__.indexOf(this)>=0 && !this.acceptlist || this.acceptlist.indexOf("reconfigure")>=0) {
	        	var change = {object:target,name:property,type:"reconfigure"},
        			start = this.changeset.length === 0,
        			deliver = this.deliver();
	        	this.changeset.push(change);
	        	if(start) {
	        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
	        	}
	    	}
	    	return true;
	    };
	    Observer.prototype.setPrototypeOf = function(target, prototype) {
	    	var oldvalue = Object.getPrototypeOf(target);
	    	Object.setPrototypeOf(target, prototype);
	    	if(target.__observers__.indexOf(this)>=0 && !this.acceptlist || this.acceptlist.indexOf("setPrototype")>=0) {
	        	var change = {object:target,name:"__proto__",type:"setPrototype",oldValue:oldvalue},
    				start = this.changeset.length === 0,
    				deliver = this.deliver();
	        	this.changeset.push(change);
	        	if(start) {
	        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
	        	}
	    	}
	    	return true;
	    };
	    Observer.prototype.preventExtensions = function(target) {
	        Object.preventExtensions(target);
	    	if(target.__observers__.indexOf(this)>=0 && !this.acceptlist || this.acceptlist.indexOf("preventExtensions")>=0) {
	        	var change = {object:target,type:"preventExtensions"},
					start = this.changeset.length === 0,
					deliver = this.deliver();
	        	this.changeset.push(change);
	        	if(start) {
	        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
	        	}
	    	}
	    	return true;
	    };
	    Object.observe = function(object,callback,acceptlist,pausable,pause,delay) {
	    	return new Observer(object,callback,acceptlist,pausable,pause,delay);
	    };
	    Object.unobserve = function(object,callback) {
	    	if(object.__observerCallbacks__) {
	    		if(!callback) {
	    			object.__observerCallbacks__.splice(0,object.__observerCallbacks__.length);
	    			object.__observers__.splice(0,object.__observers__.length);
	    			return;
	    		}
	    		object.__observerCallbacks__.forEach(function(observercallback,i) {
	    			if(callback===observercallback) {
	    				object.__observerCallbacks__.splice(i,1);
	    				delete object.__observers__[i].callback;
	    				object.__observers__.splice(i,1);
	    			}
	    		});
	    	}
	    };
	    Array.observe = function(object,callback,acceptlist,pausable,pause,delay) {
	    	if(!(object instanceof Array) && !Array.isArray(object)) {
	    		throw new TypeError("First argument to Array.observer is not an Array");
	    	}
	    	var arrayproxy = new Proxy(object,{get: function(target,property) {
	    		if(property==="unobserve") {
		    		return function(callback) {
		    			if(callback) {
		    				return Object.unobserve(target,callback);
		    			}
		    			return target.unobserve();
		    		};
		    	}
	    		if(property==="splice") {
	    			return function(start,end) {
	    				if(typeof(start)!=="number" || typeof(end)!=="number") {
	    					throw new TypeError("First two arguments to Array splice are not number, number");
	    				}
	    	    		var removed = this.slice(start,start+end),
	    	    			addedCount = (arguments.length > 1 ? arguments.length-2 : 0),
	    	    			change =  {object:object,type:"splice",index:start,removed:removed,addedCount:addedCount};
	    	    		target.splice.apply(target,arguments);
	    	    		if(acceptlist.indexOf("splice")>=0) {
	    	    			var start = proxy.__observer__.changeset.length === 0,
	    	        			deliver = proxy.__observer__.deliver();
	    	    			proxy.__observer__.changeset.push(change);
	    	    			if(start) {
	    		        		deliver(false,(typeof(deliver.delay)==="number" ? deliver.delay : 10));
	    		        	}
	    	    		}
	    	    	}
	    		}
	    		if(property==="push") {
	    			 return function(item) {
	    		    	return this.splice(this.length,0,item);
	    		    }
	    		}
	    		if(property==="pop") {
	    			 return function() {
	    		    	return this.splice(this.length-1,1);
	    		    }
	    		}
	    		if(property==="unshift") {
	    			 return function(item) {
    		    		return this.splice(0,0,item);
    		    	}
	    		}
	    		if(property==="shift") {
	    			return function() {
	    	    		return this.splice(0,1);
	    	    	}
	    		}
	    		return target[property];
	    	}});
	    	var proxy = Object.observe(arrayproxy,function(changeset) { 
	    		var changes = changeset.filter(function(change) { return change.name!=="length" && change.name!=="add" && (!acceptlist || acceptlist.indexOf(change.type)>=0); });
	    		if(changes.length>0) {
	    			callback(changes);
	    		}
	    	},acceptlist,pausable,pause,delay);
	    	return proxy;
	    };
	    Array.unobserve = function(object,callback) {
		  return object.unobserve(callback);
	    }
	}
	Object.deepObserve = function(object,callback,full,parts) {
		parts = (parts ? parts : []);
		var keys = Object.keys(object);
		keys.forEach(function(key) {
			if(object[key] instanceof Object) {
				var newparts = parts.slice(0);
				newparts.push(key);
				object[key] = Object.deepObserve(object[key],callback,full,newparts);
			}
		});
		var observed = Object.observe(object,function(changeset) {
			var changes = [];
			//function recurse(name,rootObject,oldObject,newObject,path) {
			function recurse(name,rootObject,oldObject,newObject,path,skey) {
				if(newObject instanceof Object) {
					
					if(full){
						newObject = Object.deepObserve(newObject,callback,true,parts);
						//rootObject[path.split('.').pop()] = newObject;
						rootObject[skey] = newObject;
					}
					
					var newkeys = Object.keys(newObject);
					newkeys.forEach(function(key) {
						if(!oldObject || (oldObject[key]!==newObject[key])) {
							var oldvalue = (oldObject && oldObject[key]!==undefined ? oldObject[key] : undefined),
								change = (oldvalue===undefined ? "add" : "update"),
								keypath = path + "." + key;
							changes.push({name:name,object:rootObject,type:change,oldValue:oldvalue,newValue:newObject[key],keypath:keypath});
							recurse(name,rootObject,oldvalue,newObject[key],keypath,key);
						}
					});
				} else if(oldObject instanceof Object) {
					var oldkeys = Object.keys(oldObject);
					oldkeys.forEach(function(key) {
						var change = (newObject===null ? "update" : "delete"),
							keypath = path + "." + key;
						changes.push({name:name,object:rootObject,type:change,oldValue:oldObject[key],newValue:newObject,keypath:keypath});
						//recurse(name,rootObject,oldObject[key],undefined,keypath);
						recurse(name,rootObject,oldObject[key],undefined,keypath,key);
					});
				}
			}
			changeset.forEach(function(change) {
				//var keypath = (parts.length>0 ? parts.join(".") + "." : "") + change.name;change.oldValue
				var keypath = (parts.length>0 ? parts.join(".") + "." : "") + change.name;
				changes.push({name:change.name,object:change.object,type:change.type,oldValue:change.oldValue,newValue:change.object[change.name],keypath:keypath});
				//recurse(change.name,change.object,change.oldValue,change.object[change.name],keypath);
				recurse(change.name,change.object,change.oldValue,change.object[change.name],keypath,change.name);
			});
			callback(changes);
		});
		return observed;
	};

	Object.fullObserve = function(object,userCallback,strict){
		var callback = function(changes){
			var realChanges = [];
			changes.forEach(function(change){
				if(!strict){
					if(change.oldValue===null || change.oldValue===undefined) change.oldValue = '';
					if(change.newValue===null || change.newValue===undefined) change.newValue = '';
					if(change.newValue==change.oldValue) return;
				}
				else{
					if(change.newValue===change.oldValue) return;
				}
				realChanges.push( change );
			});
			if(realChanges.length){
				userCallback(realChanges);
			}
		};
		return Object.deepObserve(object,callback,true);
	};
})();
jstack.controller = function(controller,element){
	
	if(typeof(controller)=='object'){
		jstack.controllers[controller.name] = function(element){
			
			var self = this;
			
			$.extend(true,this,controller);
			
			
			this.ready = $.Deferred();
			this.element = element;
			element.data('jController',this);
			
			
			this.setDataArguments = [];
			this.setDataCall = function(){
				return this.setData.apply( this, this.setDataArguments );
			};
			
			
			this.dataBinder = (function(){
				var dataBinder = this;
				this.updateWait = 100;
				this.updateDeferStateObserver = null;
				this.updateTimeout = null;
				this.runUpdate = function(){						
					if(dataBinder.updateDeferStateObserver){
						dataBinder.updateDeferStateObserver.then(function(){
							dataBinder.triggerUpdate();
						});
						return;
					}
					else{
						dataBinder.updateDeferStateObserver = $.Deferred();
					}
					
					jstack.dataBinder.update(self.element);
					
					self.element.trigger('j:mutation');
					
					dataBinder.updateDeferStateObserver.resolve();
					dataBinder.updateDeferStateObserver = false;
					
					this.updateTimeout = false;
					
				};
				this.triggerUpdate = function(){
					if(this.updateTimeout){
						if(this.updateTimeout!==true){
							clearTimeout(this.updateTimeout);
						}
						this.updateTimeout = setTimeout(this.runUpdate, this.updateWait);
					}
					else{
						this.updateTimeout = true;
						this.runUpdate();
					}
				};
				return this;
			})();
			
			
		};
		return jstack.controllers[controller.name];
	}

	
	controller = jstack.controllers[controller] || jstack.config.defaultController;
	
	controller = new controller(element);
	
	var name = controller.name;
	
	var dependencies = [];
	
	if(controller.dependencies&&controller.dependencies.length){		
		var dependenciesJsReady = $.Deferred();
		$js(controller.dependencies,function(){
			dependenciesJsReady.resolve();
		});
		dependencies.push(dependenciesJsReady);
	}
	
	
	var dependenciesData = controller.dependenciesData;
	if(dependenciesData){
		if(typeof(dependenciesData)=='function'){
			controller.dependenciesData = dependenciesData = controller.dependenciesData();
		}
		if(dependenciesData&&dependenciesData.length){
			var dependenciesDataRun = [];
			for(var i = 0, l = dependenciesData.length; i < l; i++){
				var dependencyData = dependenciesData[i];
				if(typeof(dependencyData)=='function'){
					dependencyData = dependencyData.call(controller);
				}
				
					
				if($.type(dependencyData)=='object'){
					if('abort' in dependencyData){
						var ddata = dependencyData;
						dependencyData = $.Deferred();
						(function(dependencyData){
							ddata.then(function(ajaxReturn){
								dependencyData.resolve(ajaxReturn);
							});
						})(dependencyData);
					}
				}
				if(!($.type(dependencyData)=='object'&&('then' in dependencyData))){
					var ddata = dependencyData;
					dependencyData = $.Deferred();
					dependencyData.resolve(ddata);
				}
					

				dependenciesDataRun.push(dependencyData);
			}
			var resolveDeferred = $.when.apply($, dependenciesDataRun).then(function(){
				for(var i = 0, l = arguments.length; i < l; i++){
					controller.setDataArguments.push(arguments[i]);
				}
			});
			dependencies.push(resolveDeferred);
		}
	}
 	
	controller.data = controller.data || {};
	
	controller.data = Object.fullObserve(controller.data,function(change){
		controller.dataBinder.triggerUpdate();
	});
	
	$.when.apply($, dependencies).then(function(){
		controller.ready.resolve();
	});
	
	return controller;
};
jstack.url = (function(){
	var Url = function(){};
	var recursiveArrayToObject = function(o){
		var params = {};
		for(var k in o){
			if(o.hasOwnProperty(k)){
				if(o[k] instanceof Array)
					params[k] = recursiveArrayToObject(o[k]);
				else
					params[k] = o[k];
			}
		}
		return params;
	};
	Url.prototype.params = new Array();
	Url.prototype.getQuery = function(url) {
		var str = url;
		var strpos = str.indexOf('?');
		if (strpos == -1) return '';
		str = str.substr(strpos + 1, str.length);
		strpos = str.indexOf('#');
		if(strpos == -1) return str;
		return str.substr(0,strpos);
	};
	Url.prototype.getPath = function(url) {
		var strpos = url.indexOf('?');
		if (strpos == -1) return url;
		return url.substr(0, strpos);
	};
	Url.prototype.buildParamFromString =  function(param){
		var p = decodeURIComponent(param);
		var strpos = p.indexOf('=');
		if(strpos == -1 ){
			if(p!==''){
				this.params[p] = '';
				this.params.length++;
			}
			return true;
		}
		var name = p.substr(0,strpos);
		var value = p.substr(strpos+1,p.length);
		var openBracket = name.indexOf('[');
		var closeBracket = name.indexOf(']');
		if(openBracket == -1 || closeBracket == -1){
			if(!(openBracket == -1 && closeBracket == -1)){
				name = name.replace(new RegExp('[\\[\\]]'),'_');
			}
			this.params[name] = value;
			return true;
		}
		var matches = name.match(new RegExp('\\[.*?\\]','g'));
		name = name.substr(0,openBracket);
		p = 'this.params';
		var key = name;
		for(var i in matches){
			if(!matches.hasOwnProperty(i)) continue;
			p += '[\''+key+'\']';
			if(eval(p) == undefined || typeof(eval(p)) != 'object'){
				eval(p +'= new Array();');
			}
			key = matches[i].substr(1,matches[i].length-2);
			if(key == ''){
				key = eval(p).length;
			}
		}
		p += '[\''+key+'\']';
		eval(p +'= \''+value+'\';');
	};
	Url.prototype.parseQuery = function(queryString){
		var str = queryString;
		str = str.replace(new RegExp('&'), '&');
		this.params = new Array();
		this.params.length = 0;
		str = str.split('&');		
		var p = '';
		var startPos = -1;
		var endPos = -1;
		var arrayName = '';
		var arrayKey = '';
		for ( var i = 0; i < str.length; i++) {
			this.buildParamFromString(str[i]);
		}
		
		return recursiveArrayToObject(this.params);
	};
	Url.prototype.buildStringFromParam = function(object,prefix){
		var p = '';
		var value ='';
		if(prefix != undefined){
			p = prefix;
		}
		if(typeof(object) == 'object'){
			for(var name in object){
				value = object[name];
				name = p == '' ? name : '['+name+']';
				if(typeof(value) == 'object')
				{
					this.buildStringFromParam(value,p+name);
				}
				else
				{
					this.params[this.params.length] = p+name+'='+value;
				}
			}
		}
	};
	Url.prototype.buildQuery = function(params) {
		this.params = new Array();
		this.buildStringFromParam(params);
		return this.params.join('&');
	};
	Url.prototype.getParams = function(str){
		return this.parseQuery(this.getQuery(str));
	};
	Url.prototype.getParamsFromHash = function(){
		return this.getParams(document.location.hash);
	};
	return new Url();
})();
jstack.uniqid = function( prefix, more_entropy ) {
  //  discuss at: http://phpjs.org/functions/uniqid/
  // original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
  //  revised by: Kankrelune (http://www.webfaktory.info/)
  //        note: Uses an internal counter (in php_js global) to avoid collision
  //        test: skip
  //   example 1: uniqid();
  //   returns 1: 'a30285b160c14'
  //   example 2: uniqid('foo');
  //   returns 2: 'fooa30285b1cd361'
  //   example 3: uniqid('bar', true);
  //   returns 3: 'bara20285b23dfd1.31879087'

  if ( typeof prefix === "undefined" ) {
    prefix = "";
  }

  var retId;
  var formatSeed = function( seed, reqWidth ) {
    seed = parseInt( seed, 10 )
      .toString( 16 ); // To hex str
    if ( reqWidth < seed.length ) {
      // So long we split
      return seed.slice( seed.length - reqWidth );
    }
    if ( reqWidth > seed.length ) {
      // So short we pad
      return Array( 1 + ( reqWidth - seed.length ) )
        .join( "0" ) + seed;
    }
    return seed;
  };

  // BEGIN REDUNDANT
  if ( !this.php_js ) {
    this.php_js = {};
  }
  // END REDUNDANT
  if ( !this.php_js.uniqidSeed ) {
    // Init seed with big random int
    this.php_js.uniqidSeed = Math.floor( Math.random() * 0x75bcd15 );
  }
  this.php_js.uniqidSeed++;

  // Start with prefix, add current milliseconds hex string
  retId = prefix;
  retId += formatSeed( parseInt( new Date()
    .getTime() / 1000, 10 ), 8 );
  // Add seed hex string
  retId += formatSeed( this.php_js.uniqidSeed, 5 );
  if ( more_entropy ) {
    // For more entropy we add a float lower to 10
    retId += ( Math.random() * 10 )
      .toFixed( 8 )
      .toString();
  }

  return retId;
};
String.prototype.camelCase = function() {
	return this.replace( /(\_[a-z])/g, function( $1 ) {return $1.toUpperCase().replace( "_", "" );} );
};
String.prototype.camelCaseDash = function() {
	return this.replace( /(\-[a-z])/g, function( $1 ) {return $1.toUpperCase().replace( "-", "" );} );
};
String.prototype.lcfirst = function() {
	return this.charAt( 0 ).toLowerCase() + this.substr( 1 );
};
String.prototype.escapeRegExp = function() {
	//return this.replace( /([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1" );
	return this.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};
String.prototype.replaceAllRegExp = function(find, replace){
  return this.replace( new RegExp( find, "g" ), replace );
};
String.prototype.replaceAll = function(find, replace){
	find = find.escapeRegExp();
	return this.replaceAllRegExp(find, replace);
};
String.prototype.snakeCase = function() {
	return this.replace( /([A-Z])/g, function( $1 ) {return "_" + $1.toLowerCase();} );
};
String.prototype.snakeCaseDash = function() {
	return this.replace( /([A-Z])/g, function( $1 ) {return "-" + $1.toLowerCase();} );
};
(function(){

function trim ( str, charlist ) {
  //  discuss at: http://locutusjs.io/php/trim/
  // original by: Kevin van Zonneveld (http://kvz.io)
  // improved by: mdsjack (http://www.mdsjack.bo.it)
  // improved by: Alexander Ermolaev (http://snippets.dzone.com/user/AlexanderErmolaev)
  // improved by: Kevin van Zonneveld (http://kvz.io)
  // improved by: Steven Levithan (http://blog.stevenlevithan.com)
  // improved by: Jack
  //    input by: Erkekjetter
  //    input by: DxGx
  // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
  //   example 1: trim('    Kevin van Zonneveld    ')
  //   returns 1: 'Kevin van Zonneveld'
  //   example 2: trim('Hello World', 'Hdle')
  //   returns 2: 'o Wor'
  //   example 3: trim(16, 1)
  //   returns 3: '6'

  var whitespace = [
    " ",
    "\n",
    "\r",
    "\t",
    "\f",
    "\x0b",
    "\xa0",
    "\u2000",
    "\u2001",
    "\u2002",
    "\u2003",
    "\u2004",
    "\u2005",
    "\u2006",
    "\u2007",
    "\u2008",
    "\u2009",
    "\u200a",
    "\u200b",
    "\u2028",
    "\u2029",
    "\u3000"
  ].join( "" );
  var l = 0;
  var i = 0;
  str += "";

  if ( charlist ) {
    whitespace = ( charlist + "" ).replace( /([\[\]\(\)\.\?\/\*\{\}\+\$\^:])/g, "$1" );
  }

  l = str.length;
  for ( i = 0; i < l; i++ ) {
    if ( whitespace.indexOf( str.charAt( i ) ) === -1 ) {
      str = str.substring( i );
      break;
    }
  }

  l = str.length;
  for ( i = l - 1; i >= 0; i-- ) {
    if ( whitespace.indexOf( str.charAt( i ) ) === -1 ) {
      str = str.substring( 0, i + 1 );
      break;
    }
  }

  return whitespace.indexOf( str.charAt( 0 ) ) === -1 ? str : "";
}


function ltrim ( str, charlist ) {
  //  discuss at: http://locutusjs.io/php/ltrim/
  // original by: Kevin van Zonneveld (http://kvz.io)
  //    input by: Erkekjetter
  // improved by: Kevin van Zonneveld (http://kvz.io)
  // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
  //   example 1: ltrim('    Kevin van Zonneveld    ')
  //   returns 1: 'Kevin van Zonneveld    '

  charlist = !charlist ? " \\s\u00A0" : ( charlist + "" )
    .replace( /([\[\]\(\)\.\?\/\*\{\}\+\$\^:])/g, "$1" );

  var re = new RegExp( "^[" + charlist + "]+", "g" );

  return ( str + "" )
    .replace( re, "" );
}

function rtrim ( str, charlist ) {
  //  discuss at: http://locutusjs.io/php/rtrim/
  // original by: Kevin van Zonneveld (http://kvz.io)
  //    input by: Erkekjetter
  //    input by: rem
  // improved by: Kevin van Zonneveld (http://kvz.io)
  // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
  // bugfixed by: Brett Zamir (http://brett-zamir.me)
  //   example 1: rtrim('    Kevin van Zonneveld    ')
  //   returns 1: '    Kevin van Zonneveld'

  charlist = !charlist ? " \\s\u00A0" : ( charlist + "" )
    .replace( /([\[\]\(\)\.\?\/\*\{\}\+\$\^:])/g, "\\$1" );

  var re = new RegExp( "[" + charlist + "]+$", "g" );

  return ( str + "" ).replace( re, "" );
}


String.prototype.trim = function( charlist ) {
	return trim( this, charlist );
};
String.prototype.ltrim = function( charlist ) {
	return ltrim( this, charlist );
};
String.prototype.rtrim = function( charlist ) {
	return rtrim( this, charlist );
};

})();
String.prototype.ucfirst = function() {
	return this.charAt( 0 ).toUpperCase() + this.substr( 1 );
};
jstack.reflection = {};
jstack.reflection.arguments = function( f ) {
	var args = f.toString().match( /^\s*function\s+(?:\w*\s*)?\((.*?)\)\s*{/ );
	var r = {};
	if ( args && args[ 1 ] ) {
		args = args[ 1 ];
		args = args.replace( /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, "" );
		args = args.trim().split( /\s*,\s*/ );
		for ( var i = 0; i < args.length; i++ ) {
			var arg = args[ i ];
			var idf = arg.indexOf( "=" );
			if ( idf === -1 ) {
				r[ arg ] = undefined;
			} else {
				r[ arg.substr( 0, idf ) ] = eval( arg.substr( idf + 1 ).trim() );
			}
		}
	}
	return r;
};
$.arrayCompare = function (a, b) {
	return $(a).not(b).get().length === 0 && $(b).not(a).get().length === 0;
};
$.fn.attrStartsWith = function(s) {
	var attrs = {};
	this.each(function(index){
		$.each(this.attributes, function(index, attr){
			if(attr.name.indexOf(s)===0){
			   attrs[attr.name] = attr.value;
			}
		});
	});
	return attrs;
};
$.attrsToObject = function( k, v, r ) {
	if(!r) r = {};
	var s = k.split('--');
	if ( typeof( r ) == "undefined" ) r = {};
	var ref = r;
	var l = s.length - 1;
	$.each( s, function( i, key ) {
	key = $.camelCase(key);
		if ( i == l ) {
			ref[ key ] = v;
		}
		else {
			if ( !ref[ key ] ) ref[ key ] = {};
			ref = ref[ key ];
		}
	} );
	return r;
};
$.fn.changeVal = function( v ) {
	return $( this ).val( v ).trigger( "change" );
};
$.fn.childrenHeight = function( outer, marginOuter, filterVisible ) {
	var topOffset = bottomOffset = 0;
	if ( typeof( outer ) == "undefined" ) outer = true;
	if ( typeof( marginOuter ) == "undefined" ) marginOuter = true;
	if ( typeof( filterVisible ) == "undefined" ) filterVisible = true;
	var children = this.children();
	if(filterVisible){
		children = children.filter(':visible');
	}
	children.each( function( i, e ) {
		var $e = $( e );
		var eTopOffset = $e.offset().top;
		var eBottomOffset = eTopOffset + ( outer ? $e.outerHeight(marginOuter) : $e.height() );
		
		if ( eTopOffset < topOffset )
			topOffset = eTopOffset;
		if ( eBottomOffset > bottomOffset )
			bottomOffset = eBottomOffset;
	} );
	return bottomOffset - topOffset - this.offset().top;
};
$.fn.dataAttrConfig = function(prefix){
	if(!prefix){
		prefix = 'data-';
	}
	var substr = prefix.length;
	var attrData = this.attrStartsWith(prefix);
	var data = {};
	$.each(attrData,function(k,v){
		$.attrsToObject( k.substr(substr), v, data );
	});
	return data;
};
$.fn.findExclude = function (Selector, Mask, Parent) {
	var result = $([]);
	$(this).each(function (Idx, Elem) {
		$(Elem).find(Selector).each(function (Idx2, Elem2) {
			var el = $(Elem2);
			if(Parent)
				el = el.parent();
			var closest = el.closest(Mask);
			if (closest[0] == Elem || !closest.length) {
				result =  result.add(Elem2);
			}
		});
	});
	return result;
};
$.fn.hasHorizontalScrollBar = function() {
	return this.get( 0 ) ? this.get( 0 ).scrollWidth > this.innerWidth() : false;
};
$.fn.hasVerticalScrollBar = function() {
	return this.get( 0 ) ? this.get( 0 ).scrollHeight > this.innerHeight() : false;
};
(function(){

var findForks = {
	"nth-level": function( selector, param ) {
		param = parseInt( param, 10 );
		var a = [];
		var $this = this;
		this.each( function() {
			var level = param + $( this ).parents( selector ).length;
			$this.find( selector ).each( function() {
				if ( $( this ).parents( selector ).length == param - 1 ) {
					a.push( this );
				}
			} );
		} );
		return $( a );
	}
};

$.fn.findOrig = $.fn.find;
$.fn.find = function( selector ) {

	if ( typeof( selector ) == "string" ) {
		var fork, THIS = this;
		$.each( findForks, function( k, v ) {
			var i = selector.indexOf( ":" + k );
			if ( i !== -1 ) {
				var l = k.length;
				var selectorPart = selector.substr( 0, i );
				var param = selector.substr( i + l + 2, selector.length - i - l - 3 );
				fork = findForks[ k ].call( THIS, selectorPart, param );
				return false;
			}
		} );
		if ( fork ) return fork;
	}

	return this.findOrig( selector );
};

})();
$.on = function(event,selector,callback){
	return $(document).on(event,selector,callback);
};

$.off = function(event,selector,callback){
	return $(document).off(event,selector,callback);
};

$.one = function(event,selector,callback){
	return $(document).one(event,selector,callback);
};
$.extend( $.expr[ ":" ], {
	scrollable: function( element ) {
		var vertically_scrollable, horizontally_scrollable;
		if ( $( element ).css( "overflow" ) == "scroll" || $( element ).css( "overflowX" ) == "scroll" || $( element ).css( "overflowY" ) == "scroll" ) return true;

		vertically_scrollable = ( element.clientHeight < element.scrollHeight ) && (
		$.inArray( $( element ).css( "overflowY" ), [ "scroll", "auto" ] ) != -1 || $.inArray( $( element ).css( "overflow" ), [ "scroll", "auto" ] ) != -1 );

		if ( vertically_scrollable ) return true;

		horizontally_scrollable = ( element.clientWidth < element.scrollWidth ) && (
		$.inArray( $( element ).css( "overflowX" ), [ "scroll", "auto" ] ) != -1 || $.inArray( $( element ).css( "overflow" ), [ "scroll", "auto" ] ) != -1 );
		return horizontally_scrollable;
	},
	parents: function( a, i, m ) {
		return $( a ).parents( m[ 3 ] ).length < 1;
	},
	
	attrStartsWith: function (el, _, b) {
		for (var i = 0, atts = el.attributes, n = atts.length; i < n; i++) {
			if(atts[i].nodeName.toLowerCase().indexOf(b[3].toLowerCase()) === 0) {
				return true; 
			}
		}
		return false;
	},
	attrEndsWith: function (el, _, b) {
		for (var i = 0, atts = el.attributes, n = atts.length; i < n; i++) {
		  var att = atts[i].nodeName.toLowerCase(),
			  str = b[3].toLowerCase();
			if(att.length >= str.length && att.substr(att.length - str.length) === str) {
				return true; 
			}
		}
		
		return false;
	},
	
} );
$.fn.removeClassPrefix = function(prefix) {
	this.each(function(i, el) {
		var classes = el.className.split(" ").filter(function(c) {
			return c.lastIndexOf(prefix, 0) !== 0;
		});
		el.className = $.trim(classes.join(" "));
	});
	return this;
};
$.fn.requiredId = function(){
	var id = this.attr('id');
	if(this.length>1){
		return this.each(function(){
			$(this).requiredId();
		});
	}
	if(!id){
		id = jstack.uniqid('uid-');
		this.attr('id', id);
	}
	return id;
};
$.fn.reverse = function(){
	return $(this.get().reverse());
};
$.fn.setVal = $.fn.val;
$.fn.val = function() {
	var returnValue = $.fn.setVal.apply( this, arguments );
	if ( arguments.length ) {
		this.trigger( "val" );
	}
	return returnValue;
};
$.fn.populateInput = function( value, config ) {
	config = $.extend({
		addMissing: false,
		preventValEvent: false,
		push: false,
	},config);
	var setValue;
	if(config.preventValEvent){
		setValue = function(input,val){
			input.setVal(val);
		};
	}
	else{
		setValue = function(input,val){
			input.val(val);
		};
	}
	var populateSelect = function( input, value ) {
		var isSelect2 = input.hasClass('select2-hidden-accessible');
		if(input[0].hasAttribute('data-preselect')&&!isSelect2){
			if(config.push){
				var v = input.data('preselect') || [];
				if(typeof(v)!='object'){
					v = [v];
				}
				if(v.indexOf(value)===-1){
					v.push(value);
				}
				input.data('preselect',v);
			}
			else{
				input.data('preselect',value);
			}
			return;
		}
		
		//if(input.hasClass('select2-hidden-accessible')){
			//if(config.push){
				//var v = input.val();
				//if(v===null){
					//v = [];
				//}
				//if(typeof(v)!='object'){
					//v = [v];
				//}
				//if(v.indexOf(value)===-1){
					//v.push(value);
				//}
				//console.log(input,value);
				//setValue(input,value);
			//}
			//else{
				//setValue(input,value);
			//}
			//if(!config.preventValEvent){
				//input.trigger('change');
			//}
			//return;
		//}
		
		var found = false;
		$( "option", input ).each( function() {
			if ( $( this ).val() == value ) {
				$( this ).prop( "selected", true );
				found = true;
			}
			else{
				if(!config.push){
					$( this ).prop( "selected", false );
				}
			}
		} );
		if ( !found && config.addMissing ) {
			var optionValue;
			var optionText;
			if(typeof(value)=='object'){
				optionValue = value.value;
				optionText = value.text;
			}
			else{
				optionValue = value;
			}
			if(typeof(optionText)=='undefined'){
				optionText = optionValue;
			}
			if(!optionValue){
				optionValue = optionText;
			}
			input.append( '<option value="' + optionValue + '" selected="selected">' + optionText + "</option>" );
		}
		
		if(isSelect2&&!config.preventValEvent){
			input.trigger('change');
		}
		
	};
	return this.each(function(){
		var input = $(this);
		if(input.data('j:populate:prevent')) return;
		if ( input.is( "select" ) ) {
			if ( value instanceof Array ) {
				if(input.attr('name').substr(-2)=='[]'||input.prop('multiple')){
					populateSelect( input, value );
				}
				else{
					for ( var i = 0, l = value.length; i < l; i++ ) {
						populateSelect( input, value[ i ] );
					}
				}
			}
			else {
				populateSelect( input, value );
			}
		}
		else if ( input.is( "textarea" ) ) {
			setValue(input, value);
		}
		else {
			switch ( input.attr( "type" ) ){
				case "file":
				
				return;
				default:
				case "number":
				case "range":
				case "email":
				case "data":
				case "text":
				case "hidden":
					setValue(input, value);
				break;
				case "radio":
					if ( input.length >= 1 ) {
						$.each( input, function( index ) {
							var elemValue = $( this ).attr( "value" );
							var elemValueInData = singleVal = value;
							if ( elemValue === value ) {
								$( this ).prop( "checked", true );
							}
							else {
								if(!config.push){
									$( this ).prop( "checked", false );
								}
							}
						} );
					}
				break;
				case "checkbox":
					if ( input.length > 1 ) {
						$.each( input, function( index ) {
							var elemValue = $( this ).attr( "value" );
							var elemValueInData = undefined;
							var singleVal;
							for ( var i = 0; i < value.length; i++ ) {
								singleVal = value[ i ];
								if ( singleVal === elemValue ){
									elemValueInData = singleVal;
								};
							}

							if ( elemValueInData ) {
								$( this ).prop( "checked", true );
							}
							else {
								if(!config.push){
									$( this ).prop( "checked", false );
								}
							}
						} );
					}
					else if ( input.length == 1 ) {
						$ctrl = input;
						if ( value ) {
							$ctrl.prop( "checked", true );
						}
						else {
							$ctrl.prop( "checked", false );
						}

					}
				break;
			}
		}
	});
};
$.fn.populateForm = function( data, config ) {
	config = $.extend({
		addMissing: false,
		not: false,
		notContainer: false
	},config);
	var $this = this;
	
	var assignValue = function(key, value){
		if(value===null){
			value = '';
		}
		var inputs = $this.find(':input[name="'+key+'"]');
		if(config.addMissing&&!inputs.length){
			$this.append('<input type="hidden" name="'+key+'" value="'+value+'">');
		}
		inputs.each(function(){
			var input = $(this);
			if(config.not&&input.is(config.not)) return;
			if(config.notContainer&&input.closest(config.notContainer).length) return;
			input.populateInput(value, config);
		});
	};
	var assignValueMulti = function(key, value){
		var inputs = $this.find(':input[name="'+key+'"],:input[name="'+key+'[]"]');
		inputs.each(function(){
			var input = $(this);
			if(config.not&&input.is(config.not)) return;
			if(config.notContainer&&input.closest(config.notContainer).length) return;
			input.populateInput(value, config);
		});	
	};
	
	var assignValueRecursive = function(key, value){
		assignValueMulti(key,value);
		$.each(value,function(k,v){
			var keyAssign = key+'['+k+']';
			if(typeof(v)=='object'&&v!=null){
				assignValueRecursive(keyAssign, v);
			}
			else{
				assignValue(keyAssign, v);
			}
		});
	};
	
	$.each(data, function(key, value){
		if(typeof(value)=='object'&&value!=null){
			assignValueRecursive(key, value);
		}
		else{
			assignValue(key, value);
		}
	});
	
	return this;
};
$.fn.populate = function( value, config ){
	return this.each(function(){
		var el = $(this);
		if(el.is('form')){
			el.populateForm(value, config);
		}
		else{
			el.populateInput(value, config);
		}
	});
};
$.fn.populateReset = function(){
	return this.each(function(){
		var el = $(this);
		if(el.is('form')){
			el.find(':input[name]').populateReset();
		}
		else{
			var type = el.prop('type');
			if(type=="checkbox"||type=="radio"){
				el.prop('checked',this.defaultChecked);
			}
			else{
				el.populateInput(this.defaultValue,{preventValEvent:true});
			}
			el.trigger('input');
		}
	});
};
$.fn.outerHTML = function(){
	if (this.length){
		var div = $('<tmpl style="display:none;"></tmpl>');
		var clone = $(this[0].cloneNode(false)).html(this.html()).appendTo(div);
		var outer = div.html();
		div.remove();
		return outer;
	}
	else{
		return null;
	}
};
$.fn.loadJml = function(url,data){
	var self = this;
	return jstack.jml(url,data).then(function(content){
		self.append(content);
	});
};
$.fn.hasAttr = function(attr){
	return this[0].hasAttribute(attr);
};
jstack.template = {};
jstack.template.templateVarSubstitutions = {};
( function( w, j ) {

	var separatorStart = "<%";
	var separatorEnd = "%>";
	var separatorStartE = "<\%";
	var separatorEndE = "\%>";

	var cache = {};
	var reg1 = eval( "/'(?=[^" + separatorEndE + "]*" + separatorEndE + ")/g" );
	var reg2 = eval( "/" + separatorStartE + "=(.+?)" + separatorEndE + "/g" );
	
	j.template.parse = function( html, data, id ) {
		var fn;
		if ( id && cache[ id ] ) {
			fn = cache[ id ];
		} else {
			var substitutions = j.template.templateVarSubstitutions;
			html = html.html();
			for ( var k in substitutions ) {
				if ( substitutions.hasOwnProperty( k ) ) {
					html = html.replace( new RegExp(k, 'g'), separatorStart + substitutions[ k ] + separatorEnd );
				}
			}
			var logUndefined = jstack.config.debug?'console.log(tmplException.message);':'';
			var compile = "var tmplString=''; with(tmplObj){ tmplString += '" + html
				.replace( /[\r\t\n]/g, " " )
				.replace( reg1, "\t" )
				.split( "'" ).join( "\\'" )
				.split( "\t" ).join( "'" )
				.replace( reg2, "'; try{ tmplString += $1 }catch(tmplException){ "+logUndefined+" }; tmplString += '" )
				.split( separatorStart ).join( "';" )
				.split( separatorEnd ).join( "tmplString += '" ) +
				"';} return tmplString;";
			try {
				fn = new Function( "tmplObj", compile );
				if ( id ) cache[ id ] = fn;
			}
			catch ( e ) {
				if ( jstack.config.debug ) {
					console.log( e );
					console.log( compile );
					console.log( html );
				}
			}
		}
		return data ? fn( data ) : fn;
	};

} )( window, jstack );
jstack.template.compile = function( el, cacheId, templatesPath ) {
	var defer = $.Deferred();
	$.when.apply( $, jstack.template.directiveCompile( el, templatesPath ) ).then( function() {
		var templateProcessor = function( data ) {
			return jstack.template.directiveCompileLoaded( $( "<tmpl>" + jstack.template.parse( el, data, cacheId ) + "</tmpl>" ) ).contents();
		};
		defer.resolve( templateProcessor );
	} );
	return defer;
};
jstack.template.directives = {};
jstack.template.directive = function( id, fn ) {
	if ( fn ) {
		jstack.template.directives[ id ] = fn;
	}
	return jstack.template.directives[ id ];
};
jstack.template.directiveCompileLoaded = function( el ) {
	el.find( "*" ).each( function() {
		var self = $( this );
		$.each( this.attributes, function() {
			var key = this.name;
			if ( key.substr( 0, 9 ) == "j-loaded-" ) {
				self.attr( key.substr( 9 ), this.value );
				self.removeAttr( key );
			}
		} );
	} );
	return el;
};
jstack.template.directiveCompile = function( el, templatesPath ) {
	var deferreds = [];
	$.each( jstack.template.directives, function( k, d ) {
		el.find( "[j-" + k + "]," + k + "[j]" ).each( function() {
			var ctag = this.tagName == k.toUpperCase();
			var self = $( this );
			var val = ctag ? self.attr( "j" ) : self.attr( "j-" + k );
			var deferred = d( val, self, templatesPath );
			if ( deferred ) {
				deferreds.push( deferred );
			}
			if ( ctag ) {
				self.removeAttr( "j" );
				if ( deferred ) {
					deferred.then( function() {
						self.replaceWith( self.html() );
					} );
				} else {
					self.replaceWith( self.html() );
				}
			} else {
				self.removeAttr( "j-" + k );
			}
		} );
	} );
	return deferreds;
};

jstack.template.jmlInject = function( el, jq, snippet ) {
	return el.each( function() {
		var $this = $( this );
		var uid = jstack.uniqid( "tmpl" );
		jstack.template.templateVarSubstitutions[ uid ] = snippet;
		$this[ jq ]( uid );
	} );
};
jstack.template.directive( "foreach", function( val, el ) {
	var sp;
	if ( val.indexOf( " as " ) !== -1 ) {
		sp = val.split( " as " );
		jstack.template.jmlInject( el, "before", "$.each(" + sp[ 0 ] + ", function(i," + sp[ 1 ] + "){" );
	} else {
		sp = val.split( " in " );
		jstack.template.jmlInject( el, "before", "$.each(" + sp[ 1 ] + ", function(" + sp[ 0 ] + "){" );
	}
	jstack.template.jmlInject( el, "after", "});" );
} );

jstack.template.directive( "href", function( val, el ) {
	href = jstack.route.baseLocation + "#" + val;
	el.attr( "href", href );
} );

jstack.template.directive( "src", function( val, el ) {
	el.attr( "j-loaded-src", val );
} );

jstack.template.directive( "include", function( val, el, templatesPath ) {
	var ext = val.split( "." ).pop();
	var include = templatesPath + val;
	if ( ext != "jml" ) {
		include += ".jml";
	}
	var deferred = $.Deferred();
	jstack.template.get( include ).then( function( html ) {
		var inc = $( "<tmpl>" + html + "</tmpl>" );
		$.when.apply( $, jstack.template.directiveCompile( inc, templatesPath ) ).then( function() {
			el.html( inc.contents() );
			deferred.resolve();
		} );
	} );
	return deferred;
} );

jstack.template.directive( "extend", function( val, el, templatesPath ) {
	var extend = templatesPath + val;
	var ext = val.split( "." ).pop();
	if ( ext != "jml" && ext != "xjml" ) {
		extend += ".xjml";
	}
	var deferred = $.Deferred();
	jstack.template.get( extend ).then( function( html ) {
		var inc = $( "<tmpl>" + html + "</tmpl>" );
		$.when.apply( $, jstack.template.directiveCompile( inc, templatesPath ) ).then( function() {
			el.find( ">*" ).each( function() {
				var $this = $( this );
				var selector = $this.attr( "selector" );
				if ( !selector ) selector = $this.attr( "j" );
				var method = this.tagName.toLowerCase();
				var contents = $this.contents();
				var target = inc.find( selector );
				if ( contents.length ) {
					target[ method ]( $this.contents() );
				} else {
					target[ method ]();
				}
			} );
			el.replaceWith( inc.contents() );
			deferred.resolve();
		} );
	} );
	return deferred;
} );
(function(){
	var templates = {};
	var requests = {};
	jstack.template.get = function( templatePath ) {
		if ( !requests[ templatePath ] ) {
			if ( $js.dev ) {
				var ts = ( new Date().getTime() ).toString();
				var url = templatePath;
				if ( url.indexOf( "_t=" ) === -1 )
					url += ( url.indexOf( "?" ) < 0 ? "?" : "&" ) + "_t=" + ts;
			}
			requests[ templatePath ] = $.Deferred();
			$.ajax( {
				url:url,
				cache:true,
				success:function( tpl ) {
					var substitutions = {};
					var html = "";
					var sp = tpl.split( "<%" );
					for ( var i = 0, l = sp.length; i < l; i++ ) {
						if ( i ) {
							var sp2 = sp[ i ].split( "%>" );
							for ( var i2 = 0, l2 = sp2.length; i2 < l2; i2++ ) {
								if ( i2 % 2 ) {
									html += sp2[ i2 ];
								} else {
									var uid = jstack.uniqid( "tmpl" );
									html += uid;
									substitutions[ uid ] = sp2[ i2 ];
								}
							}
						} else {
							html += sp[ i ];
						}
					}
					$.extend( jstack.template.templateVarSubstitutions, substitutions );
					templates[ templatePath ] = html;
					requests[ templatePath ].resolve( templates[ templatePath ], templatePath );
				}
			} );
		}
		return requests[ templatePath ];
	};

})();
jstack.jml = function( url, data ) {
	var cacheId = url;
	var defer = $.Deferred();
	var templatesPath = url.split('/');
	templatesPath.pop();
	templatesPath = templatesPath.join('/')+'/';
	
	templatesPath = jstack.config.templatesPath+templatesPath;
	url = jstack.config.templatesPath+url;
	
	if ( !data ) data = {};
	jstack.template.get( url ).then( function( html ) {
		var el = $('<tmpl>'+html+'</tmpl>');
		jstack.template.compile( el, cacheId, templatesPath ).then( function( templateProcessor ) {
			defer.resolve( templateProcessor( data ) );
		} );
	} );
	
	return defer;
};
(function(){

jstack.component = {};

var loadComponent = function(){
	var el = this;
	var component = $(el).attr('j-component');
	var config = $(el).dataAttrConfig('j-data-');
	var paramsData = $(el).attr('j-params-data');
	var load = function(){
		var o;
		var c = jstack.component[component];
		if(paramsData){
			var params = [];
			params.push(el);
			 o = new (Function.prototype.bind.apply(c, params));
		}
		else{
			o = new c(el,config);
		}
		$(el).data('j:component',o);			
	};
	if(jstack.component[component]){
		load();
	}
	else{					
		$js('jstack.'+component,load);
	}
};

var loadJqueryComponent = function(){
	var el = this;
	var component = $(el).attr('jquery-component');
	var config = $(el).dataAttrConfig('j-data-');
	var paramsData = $(el).attr('j-params-data');
	var params = [];
	if(paramsData){
		var keys = [];
		for (var k in config) {
			if (config.hasOwnProperty(k)) {
				keys.push(k);
			}
		}
		keys.sort();
		for(var i=0,l=keys.length;i<l;i++){
			params.push(config[keys[i]]);
		}
	}
	else if(!$.isEmptyObject(config)){
		params.push(config);
	}
	var load = function(){
		$(el).data('j:component',$.fn[component].apply($(el), params));
	};
	if($.fn[component]){
		load();
	}
	else{					
		$js('jstack.jquery.'+component,load);
	}
};

$.on('j:load','[j-component]',loadComponent);
$.on('j:load','[jquery-component]',loadJqueryComponent);
$.on('j:unload','[j-component]',function(){
	var o = $(this).data('j:component');
	if(o&&typeof(o.unload)=='function'){
		o.unload();
	}
});

$('[j-component]').each(function(){
	if( !$(this).data('j:component') ){
		loadComponent.call(this);
	}
});
$('[jquery-component]').each(function(){
	if( !$(this).data('j:component') ){
		loadJqueryComponent.call(this);
	}
});

//use j:load event to make loader definition helper
jstack.loader = function(selector,handler,unloader){
	$.on('j:load',selector,function(){
		handler.call(this);
	});
	if(typeof(unloader)=='function'){
		$.on('j:unload',selector,function(){
			unloader.call(this);
		});
	}
	$(selector).each(function(){
		handler.call(this);
	});
};


//define preloaders
jstack.preloader = {
	'[j-if]':function(){
		jstack.dataBinder.loaders.jIf.call(this);
	},
	'[j-switch]':function(){
		jstack.dataBinder.loaders.jSwitch.call(this);
	},
	'[j-repeat]':function(){
		jstack.dataBinder.loaders.jRepeat.call(this);
		jstack.dataBinder.loaders.jRepeatList.call($(this).data('parent')[0]);
	},
	'[j-repeat-list]':function(){
		jstack.dataBinder.loaders.jRepeatList.call(this);
	},
	
	':input[name]':function(){
		jstack.dataBinder.inputToModel(this,'j:default',true);
		jstack.dataBinder.loaders.inputWithName.call(this);
	},
	':input[j-val]':function(){
		jstack.dataBinder.loaders.inputWithJval.call(this);
	},
	'[j-var]':function(){
		jstack.dataBinder.loaders.jVar.call(this);
	},
	':attrStartsWith("j-var-")':function(){
		jstack.dataBinder.loaders.jVarAttr.call(this);
	},
};

//define loaders
jstack.loader(':attrStartsWith("j-on-")',function(){
	var $this = $(this);
	var attrs = $this.attrStartsWith('j-on-');
	$.each(attrs,function(k,v){
		var event = k.substr(5);
		$this.removeAttr(k);
		$this.on(event,function(e){
			var controller = jstack.dataBinder.getControllerObject(this);
			if(typeof(controller.methods)!='object'||typeof(controller.methods[v])!='function'){
				throw new Error('Call to undefined method "'+v+'" by '+k+' and expected in controller '+controller.name);
			}
			var method = controller.methods[v];
			if(typeof(method)!='function'){
				return;
			}
			var r = method.call(controller,e,this);
			if(r===false){
				return false;
			}
		});
	});
});



})();
jstack.route = ( function( w, url ) {

	var routes = [];
	var map = {};

	var Route = function( path, name ) {
		this.name = name;
		this.path = path;
		this.keys = [];
		this.fns = [];
		this.params = {};
		this.regex = pathToRegexp( this.path, this.keys, false, false );

	};

	Route.prototype.addHandler = function( fn ) {
		this.fns.push( fn );
	};

	Route.prototype.removeHandler = function( fn ) {
		for ( var i = 0, c = this.fns.length; i < c; i++ ) {
			var f = this.fns[ i ];
			if ( fn == f ) {
				this.fns.splice( i, 1 );
				return;
			}
		}
	};

	Route.prototype.run = function( params ) {
		for ( var i = 0, c = this.fns.length; i < c; i++ ) {
			var defer = this.fns[ i ].apply( this, params );
			if($.type(defer)=='object'&&'then' in defer){
				defer.then(function(){
					$(document).trigger('j:route:loaded');
				});
			}
			else{
				$(document).trigger('j:route:loaded');
			}
		}
	};

	Route.prototype.match = function( path, params ) {
		var m = this.regex.exec( path );

		if ( !m ) return false;

		for ( var i = 1, len = m.length; i < len; ++i ) {
			var key = this.keys[ i - 1 ];

			var val = ( "string" == typeof m[ i ] ) ? decodeURIComponent( m[ i ] ) : m[ i ];

			if ( key ) {
				this.params[ key.name ] = val;
			}
			params.push( val );
		}

		return true;
	};

	Route.prototype.toURL = function( params ) {
		var path = this.path;
		for ( var param in params ) {
			path = path.replace( "/:" + param, "/" + params[ param ] );
		}
		path = path.replace( /\/:.*\?/g, "/" ).replace( /\?/g, "" );
		if ( path.indexOf( ":" ) != -1 ) {
			throw new Error( "missing parameters for url: " + path );
		}
		return path;
	};

	var pathToRegexp = function( path, keys, sensitive, strict ) {
		if ( path instanceof RegExp ) return path;
		if ( path instanceof Array ) path = "(" + path.join( "|" ) + ")";
		path = path
			.concat( strict ? "" : "/?" )
			.replace( /\/\(/g, "(?:/" )
			.replace( /\+/g, "__plus__" )
			.replace( /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function( _, slash, format, key, capture, optional ) {
				keys.push( { name: key, optional: !!optional } );
				slash = slash || "";
				return "" + ( optional ? "" : slash ) + "(?:" + ( optional ? slash : "" ) + ( format || "" ) + ( capture || ( format && "([^/.]+?)" || "([^/]+?)" ) ) + ")" + ( optional || "" );
			} )
			.replace( /([\/.])/g, "\\$1" )
			.replace( /__plus__/g, "(.+)" )
			.replace( /\*/g, "(.*)" );
		return new RegExp( "^" + path + "$", sensitive ? "" : "i" );
	};

	var addHandler = function( path, fn ) {
		var s = path.split( " " );
		var name = ( s.length == 2 ) ? s[ 0 ] : null;
		path = ( s.length == 2 ) ? s[ 1 ] : s[ 0 ];

		if ( !map[ path ] ) {
			map[ path ] = new Route( path, name );
			routes.push( map[ path ] );
		}
		
		routes = routes.sort(function(a,b){
			if(a.path=='*'){
				return true;
			}
			return routes.indexOf(a) > routes.indexOf(b);
		});
		
		map[ path ].addHandler( fn );
	};

	var routie = function( path, fn, extendParams ) {
		if ( typeof fn == "function" ) {
			addHandler( path, fn );
		} else if ( typeof path == "object" ) {
			for ( var p in path ) {
				addHandler( p, path[ p ] );
			}
		} else if ( typeof fn === "undefined" ) {
			routie.navigate( path );
		} else if ( typeof fn === "object" ) {
			var params = {};
			if ( extendParams ) {
				$.extend( params, getParams() );
			}
			$.extend( params, url.getParams( path ), fn );
			var query = url.buildQuery( params );
			if ( query )
				query = "?" + query;
			path = url.getPath( path );
			routie.navigate( path + query );
		}
	};

	routie.lookup = function( name, obj ) {
		for ( var i = 0, c = routes.length; i < c; i++ ) {
			var route = routes[ i ];
			if ( route.name == name ) {
				return route.toURL( obj );
			}
		}
	};

	routie.remove = function( path, fn ) {
		var route = map[ path ];
		if ( !route )
			return;
		route.removeHandler( fn );
	};

	routie.removeAll = function() {
		map = {};
		routes = [];
	};

	routie.navigate = function( path, options ) {
		options = options || {};
		var silent = options.silent || false;

		if ( silent ) {
			removeListener();
		}
		setTimeout( function() {
			w.location.hash = path;
			if ( silent ) {
				setTimeout( function() {
					addListener();
				}, 1 );
			}

		}, 1 );
	};

	var getHash2 = function() {
		var h2 = "";
		var h = w.location.hash.substring( 1 );
		var i = h.indexOf( "#" );
		if ( i !== -1 ) {
			h2 = h.substr( i + 1 );
		}
		return h2;
	};
	var getHash = function() {
		var h = w.location.hash.substring( 1 );
		var i = h.indexOf( "#" );
		if ( i !== -1 ) {
			h = h.substr( 0, i );
		}
		return h;
	};

	var checkRoute = function( hash, route ) {
		var params = [];
		if ( route.match( hash, params ) ) {
			route.run( params );
			return true;
		}
		return false;
	};

	var hashLoad = function( hash ) {
		for ( var i = 0, c = routes.length; i < c; i++ ) {
			var route = routes[ i ];
			if ( checkRoute( hash, route ) ) {
				return;
			}
		}
	};
	routie.load = hashLoad;

	var currentHash;
	var hashChanged = function() {
		var h = getHash();
		if ( h != currentHash ) {
			currentHash = h;
			$(document).trigger( "j:route:load" );
			hashLoad( currentHash );
		}
		else {
			$(document).trigger("j:subroute:change" );
		}
	};
	routie.reload = hashChanged;

	var rootClick = function( e ) {
		var self = $( this );
		var href = self.attr( "href" );
		if ( !href ) return;
		if ( "/" + href == w.location.pathname ) {
			e.preventDefault();
			jstack.route( "" );
			return false;
		}
		if ( href.substr( 0, 2 ) == "##" ) {
			e.preventDefault();
			subHashchange( href.substr( 2 ) );
		}
	};

	var mainHashchange = function( h ) {
		var newhash = h + "#" + getHash2();
		w.location.hash = newhash;
	};
	var subHashchange = function( h ) {
		var newhash = currentHash + "#" + h;
		w.location.hash = newhash;
	};

	var addListener = function() {
		if ( w.addEventListener ) {
			w.addEventListener( "hashchange", hashChanged, false );
		} else {
			w.attachEvent( "onhashchange", hashChanged );
		}
		$( document ).on( "click", "a", rootClick );
		routie.reload();
	};

	var removeListener = function() {
		if ( w.removeEventListener ) {
			w.removeEventListener( "hashchange", hashChanged );
		} else {
			w.detachEvent( "onhashchange", hashChanged );
		}
		$( document ).off( "click", "a", rootClick );
	};

	routie.start = addListener;
	routie.stop = removeListener;

	var getQuery = function() {
		return url.getQuery( getHash() );
	};
	var getPath = function() {
		return url.getPath( getHash() );
	};

	var getParams = function() {
		return url.getParams( getHash() );
	};
	var getParam = function( k ) {
		return getParams()[ k ];
	};
	var getSubParams = function() {
		return url.getParams( "?" + getHash2() );
	};
	var getSubParam = function( k ) {
		return getSubParams()[ k ];
	};

	routie.getHash = getHash;
	routie.getHash2 = getHash2;
	routie.getParams = getParams;
	routie.getParam = getParam;
	routie.getSubParams = getSubParams;
	routie.getSubParam = getSubParam;
	routie.getQuery = getQuery;
	routie.getPath = getPath;

	routie.setMainHash = mainHashchange;
	routie.setSubHash = subHashchange;

	var base = document.getElementsByTagName( "base" )[ 0 ];
	if ( base ) {
		routie.baseHref = base.href;
	} else {
		var location = window.location;
		var path = location.pathname;
		path = path.split( "/" );
		path.pop();
		path = path.join( "/" ) || "/";
		var inlineAuth = location.username ? location.username + ( location.password ? ":" + location.password : "" ) + "@" : "";
		
		var port;
		if(location.port){
			port = (location.protocol=='https'&&location.port!="443") || location.port!="80" ? ":" + location.port : "";
		}
		else{
			port = '';
		}
		routie.baseHref = location.protocol + "//" + inlineAuth + location.host + port + path;
	}

	var basePath = w.location.href;
	basePath = basePath.split( "/" );
	basePath = basePath[ 0 ] + "//" + basePath[ 2 ];
	basePath = routie.baseHref.substr( basePath.length );
	routie.basePath = basePath;

	var baseLocation = w.location.href.substr( routie.baseHref.length );
	var p = baseLocation.indexOf( "#" );
	if ( p > -1 ) {
		baseLocation = baseLocation.substr( 0, p );
	}
	routie.baseLocation = baseLocation;

	return routie;

} )( window, jstack.url );
jstack.dataBinder = (function(){
	var dataBinder = function(){
		
	};
	dataBinder.prototype = {
		dotGet: function(key,data,defaultValue){
			return key.split('.').reduce(function(obj,i){
				if(typeof(obj)=='object'&&obj!==null){
					return typeof(obj[i])!='undefined'?obj[i]:defaultValue;
				}
				else{
					return defaultValue;
				}
			}, data);
		},
		dotSet: function(key,data,value,isDefault){
			if(typeof(data)!='object'){
				return;
			}
			key.split('.').reduce(function(obj,k,index,array){
				if(array.length==index+1){
					if(isDefault&&obj[k]){
						value = obj[k];
					}
					if(!isDefault||!obj[k]){
						obj[k] = value;
					}
				}
				else{
					if(typeof(obj[k])!='object'||obj[k]===null){
						obj[k] = {};
					}					
					return obj[k];
				}
			}, data);
			return value;
		},
		dotDel: function(key,data,value){
			key.split('.').reduce(function(obj,k,index,array){
				if(typeof(obj)!='object'){
					return;
				}
				if(array.length==index+1){
					if(typeof(obj[k])!='undefined'){
						delete obj[k];
					}
				}
				else{
					return obj[k];
				}
			}, data);
		},
		getKey: function(key){
			return key.replace( /\[(["']?)([^\1]+?)\1?\]/g, ".$2" ).replace( /^\./, "" );
		},
		getValue: function(el,varKey,defaultValue){
			var self = this;
			var data = self.getControllerData(el);
			var key = self.getScoped(el,varKey);
			return self.dotGet(key,data,defaultValue);
		},
		getValueEval: function(el,varKey,defaultValue){
			var self = this;
			var scopeValue = self.getScopeValue(el);
			if(typeof(varKey)=='undefined'){
				varKey = 'undefined';
			}
			else if(varKey===null){
				varKey = 'null';
			}
			else if(varKey.trim()==''){
				varKey = 'undefined';
			}
			else{
				varKey = varKey.replace(/[\r\t\n]/g,'');
				varKey = varKey.replace(/(?:^|\b)(this)(?=\b|$)/g,'$this');
			}
			var logUndefined = jstack.config.debug?'console.log(jstackException.message);':'';
			var func = new Function( "$scope, $controller, $this, $default, $parent", "try{ with($scope){var $return = "+varKey+"; return typeof($return)=='undefined'?$default:$return;} }catch(jstackException){"+logUndefined+"}" );
			var controllerData = self.getControllerData(el);
			
			var parent;
			parent = function(depth){
				if(!depth) depth = 1;
				depth += 1;
				var parentEl = el;
				for(var i=0;i<depth;i++){
					parentEl = self.getParentScope(parentEl);
				}
				var scopeV = self.getScopeValue(parentEl);
				return scopeV;
			};
			
			return func(scopeValue, controllerData, el, defaultValue, parent);
		},
		getAttrValueEval: function(el,attr,defaultValue){
			var self = this;
			var attrKey = $(el).attr(attr);
			return self.getValueEval(el,attrKey,defaultValue);
		},
		getAttrValue: function(el,attr,defaultValue){
			var self = this;
			var attrKey = $(el).attr(attr);
			return self.getValue(el,attrKey,defaultValue);
		},
		getScopeValue: function(el){
			var self = this;
			var scope = $(el).closest('[j-scope]');
			if(!scope.length){
				return self.getControllerData(el);
			}
			return self.getAttrValue(scope,'j-scope',{});
		},
		getScope: function(input){
			return $(input).parents('[j-scope]')
				.map(function() {
					return $(this).attr('j-scope');
				})
				.get()
				.reverse()
				.join('.')
			;
		},
		getScopedInput: function(input){
			var name = $(input).attr('name');
			var key = this.getKey(name);
			return this.getScoped(input,key);
		},
		getScoped: function(input,suffix){
			if(suffix.substr(0,1)==='.'){
				return suffix.substr(1);
			}
			var scope = this.getScope(input);
			if(scope){
				scope += '.';
			}
			scope += suffix;
			return scope;
		},
		getters: {
			SELECT: function(element){
				return $( element ).val();
			},
			INPUT: function(element) {
				var type = $( element ).prop('type');
				if ( type=="checkbox" || type=="radio" ) {
					return $( element ).prop( "checked" ) ? $( element ).val() : null;
				}
				else if ( type == "file" ) {
					return element.files;
				}
				else if ( type != "submit" ) {
					return $( element ).val();
				}
			},
			TEXTAREA: function(element){
				return $( element ).val();
			}
		},
		defaultGetter: function(element){
			return $( element ).html();
		},
		getInputVal: function(element){
			var elementType = element.tagName;
			var getter = this.getters[elementType] || this.defaultGetter;
			return getter(element);
		},
		inputToModel: function(el,eventName,isDefault){
			var input = $(el);
			if(input.closest('[j-unscope]').length) return;
			
			var self = this;
			
			var data = self.getControllerData(el);
			var name = input.attr('name');
			
			var performInputToModel = function(value){
				var key = self.getScopedInput(el);
				value = self.dotSet(key,data,value,isDefault);
				if(filteredValue!=value){
					value = filteredValue;
					input.populateInput(value,{preventValEvent:true});
				}
				
				input.trigger(eventName,[value]);
				
			};
			
			var value = self.getInputVal(el);
			var filteredValue = self.filter(el,value);
			
			if(typeof(filteredValue)=='object'&&filteredValue!==null&&typeof(filteredValue.promise)=='function'){
				filteredValue.then(function(value){
					performInputToModel(value);
				});
				return;
			}
			else{
				performInputToModel(filteredValue);
			}
			
		},
		eventListener: function(){
			var self = this;
			var validNodeEvent = function(n,excludeRepeat){
				if((n.nodeType == Node.TEXT_NODE) && (n instanceof Text)){
					return false;
				}
				if(excludeRepeat){
					var jn = $(n);
					if(jn.attr('j-repeat')||jn.closest('[j-repeat]').length){
						return false;
					}
				}
				return true;
			};
			
			var observer = new MutationObserver(function(mutations){
				//console.log(mutations);
				//console.log('mutations');
								
				var events = $._data(document,'events');			
				var eventsLoad = events['j:load'] || [];
				var eventLoad = $.Event('j:load');
				var eventsUnload = events['j:unload'] || [];
				var eventUnload = $.Event('j:unload');
				$.each(mutations,function(i,mutation){
					$.each(mutation.addedNodes,function(ii,node){
						
						//self.update($(node).andSelf());
						
						var nodes = $(node).add($(node).find('*'));
						
						nodes.each(function(iii,n){
							if(!validNodeEvent(n)) return;
							
							$.each(jstack.preloader,function(selector,callback){
								if($(n).is(selector)){
									callback.call(n);
								}
							});
							
							if(!$.contains(document.body,n)) return;
							
							$.each(eventsLoad,function(type,e){
								if(e.selector&&$(n).is(e.selector)){
									e.handler.call(n,eventLoad);
								}
							});
							
						});
						
					});
					$.each(mutation.removedNodes,function(ii,node){
						var nodes = $(node).add($(node).find('*'));
						nodes.each(function(iii,n){
							if(!validNodeEvent(n,true)) return;
							
							$.each(eventsUnload,function(type,e){
								if(e.selector&&$(n).is(e.selector)){
									e.handler.call(n,eventUnload);
								}
							});
							
						});
					});
				});
				
			});
			observer.observe(document, { subtree: true, childList: true, attribute: false, characterData: true });
			
			$(document.body).on('input', ':input[name]', function(e){
				//console.log('input user');
				self.inputToModel(this,'j:input');
			});
			$(document.body).on('val', ':input[name][j-val-event]', function(e){
				self.inputToModel(this,'j:input');
			});
			$(document.body).on('j:update', ':input[name]', function(e){
				$(this).data('j:populate:prevent',true);
				self.inputToModel(this,'j:input');
				$(this).one('j:input',function(){
					$(this).data('j:populate:prevent',false);
				});
			});
		},
		filter:function(el,value){
			var self = this;
			var filter = self.getFilter(el);
			if(typeof(filter)=='function'){
				value = filter(value);
			}
			return value;
		},
		getFilter:function(el){
			var self = this;
			el = $(el);
			var filter = el.data('j-filter');
			if(!filter){
				var attrFilter = el.attr('j-filter');
				if(attrFilter){
					var method = self.getValue(el,attrFilter);
					el.data('j-filter',method);
				}
			}
			return filter;
		},
		getControllerData:function(input){
			return this.getController(input).data('jModel');
		},
		getParentScope:function(el){
			var parent = $(el).parent().closest('[j-scope]');
			if(!parent.length){
				parent = this.getController(el);
			}
			return parent;
		},
		getController:function(input){
			var controller = $(input).closest('[j-controller]');
			if(!controller.length){
				controller = $(document.body);
				controller.attr('j-controller','');
				if(!controller.data('jModel')){
					controller.data('jModel',{});
				}
			}
			return controller;
		},
		getControllerObject:function(input){
			return this.getController(input).data('jController');
		},		
		update: function(element){
			var self = this;
			//console.log('update');
			
			$('[j-if]',element).each(self.loaders.jIf);
			$('[j-switch]',element).each(self.loaders.jSwitch);
			$('[j-repeat]',element).each(self.loaders.jRepeat);
			$('[j-repeat-list]',element).each(self.loaders.jRepeatList);
			
			$(':input[name]',element).each(self.loaders.inputWithName);
			$(':input[j-val]',element).each(self.loaders.inputWithJval);
			$('[j-var]',element).each(self.loaders.jVar);
			$(':attrStartsWith("j-var-")',element).each(self.loaders.jVarAttr);
			
		},
		loaders:{
			jIf: function(){
				var $this = $(this);
				var value = jstack.dataBinder.getAttrValueEval(this,'j-if');
				
				var contents = $this.data('jIf');
				if(typeof(contents)=='undefined'){
					contents = $this.contents();
					$this.data('jIf',contents);
				}
				
				if(value){
					if($this.is(':empty')){
						contents.appendTo($this);
						$this.trigger('j-if:true');
					}
				}
				else{
					if(!$this.is(':empty')){
						contents.detach();
						$this.trigger('j-if:false');
					}
				}
			},
			jSwitch: function(){
				var $this = $(this);
				var value = jstack.dataBinder.getAttrValueEval(this,'j-switch');
				var cases = $this.data('jSwitch');
				if(typeof(cases)=='undefined'){
					cases = $this.find('[j-case],[j-case-default]');
					$this.data('jSwitch',cases);
				}
				
				var state = $this.data('jSwitchState');
				if(state===value){
					return;
				}
				$this.data('jSwitchState',value);
				
				var found = false;
				cases.filter('[j-case]').each(function(){
					var jcase = $(this);
					var caseVal = jcase.attr('j-case');
					if(caseVal==value){
						jcase.appendTo($this);
						jcase.trigger('j-switch:true');
						found = true;
					}
					else{
						jcase.detach();
						jcase.trigger('j-switch:false');
					}
				});
				cases.filter('[j-case-default]').each(function(){
					var jcase = $(this);
					if(found){
						jcase.detach();
						jcase.trigger('j-switch:false');
					}
					else{
						jcase.appendTo($this);
						jcase.trigger('j-switch:true');
					}
				});
			},
			jRepeat: function(){
				var $this = $(this);
				
				var parent = $this.parent();
				parent.attr('j-repeat-list','true');
				var list = parent.data('jRepeatList') || [];
				list.push(this);
				parent.data('jRepeatList',list);
				$this.data('parent',parent);
				$this.detach();
				
			},
			jRepeatList: function(){
				var $this = $(this);
				//var data = jstack.dataBinder.getControllerData(this);
				var list = $this.data('jRepeatList') || [];
				var scopes = [];
				
				//add
				$.each(list,function(i,original){
					var $original = $(original);
										
					var attrRepeat = $original.attr('j-repeat');
					
					var value = jstack.dataBinder.getValue($this[0],attrRepeat);
					//var value = jstack.dataBinder.getValueEval($this[0],attrRepeat); //add j-repeat-eval in future
					
					var i = 1;
					$.each(value,function(k,v){
						var scope = attrRepeat+'.'+k;
						var row = $this.children('[j-scope="'+scope+'"]');
						if(!row.length){
							row = $original.clone();
							row.removeAttr('j-repeat');
							row.attr('j-scope',scope);
							row.attr('j-scope-id',k);
							row.appendTo($this);
						}
						row.find('[j-index]').text(i);
						scopes.push(scope);
						i++;
					});
					
				});
				
				//remove
				$this.children('[j-scope]').each(function(){
					var scope = $(this).attr('j-scope');
					if(scopes.indexOf(scope)===-1){
						$(this).remove();
					}
				});
			},
			
			inputWithName: function(){
				var input = $(this);
				if(input.closest('[j-unscope]').length) return;
				var defaultValue = jstack.dataBinder.getInputVal(this);
				var value = jstack.dataBinder.getAttrValue(this,'name',defaultValue);
				if(input.data('j:populate:prevent')) return;
				input.populateInput(value,{preventValEvent:true});
				input.trigger('j:val',[value]);
			},
			inputWithJval: function(){
				var el = $(this);
				var type = el.prop('type');
				//var value = jstack.dataBinder.getAttrValueEval(this,'j-val',jstack.dataBinder.getInputVal(this));
				var value = jstack.dataBinder.getAttrValueEval(this,'j-val');
				var name = el.attr('name');
				if(typeof(value)=='undefined'){
					var defaultValue;
					if(type=="checkbox"||type=="radio"){
						defaultValue = this.defaultChecked;
					}
					else{
						defaultValue = this.defaultValue;
					}
					value = defaultValue;
				}
				if(name){
					jstack.dataBinder.dotSet(jstack.dataBinder.getKey(name),jstack.dataBinder.getScopeValue(this),value);
				}
				if(el.data('j:populate:prevent')) return;
				el.populateInput(value,{preventValEvent:true});
				el.trigger('j:val',[value]);
			},
			jVar:function(){
				var value = jstack.dataBinder.getAttrValueEval(this,'j-var');
				$(this).html(value);
			},
			jVarAttr: function(){
				var $this = $(this);
				var attrs = $this.attrStartsWith('j-var-');
				$.each(attrs,function(k,varAttr){
					var value = jstack.dataBinder.getValueEval($this,varAttr);
					$this.attr(k.substr(6),value);
				});
			},
			
		},
	};
	var o = new dataBinder();
	o.eventListener();
	return o;
})();
$.on('reset','form[j-scope]',function(){
	$(this).populateReset();
});
( function( $, j ) {
	var hasOwnProperty2 = function(o,k){
		var v = o[k];
		return v!==Object[k]&&v!==Object.__proto__[k]&&v!==Array[k]&&v!==Array.__proto__[k];
	};
	var toParamsPair = function( data ) {
		var pair = [];
		var params = $.param( data ).split( "&" );
		for ( var i = 0; i < params.length; i++ ) {
			var x = params[ i ].split( "=" );
			var val = x[ 1 ] !== null ? decodeURIComponent( x[ 1 ] ) : "";
			pair.push( [ decodeURIComponent( x[ 0 ] ), val ] );
		}
		return pair;
	};

	var recurseExtractFiles = function( data, files, prefix, deepness ) {
		if ( !prefix )
			prefix = "";
		for ( var k in data ) {
			if ( !data.hasOwnProperty( k ) ) continue;
			var key = prefix + k;
			var value = data[ k ];
			if ( value instanceof FileList ) {
				if ( value.length == 1 ) {
					files[ key ] = value[ 0 ];
				} else {
					files[ key ] = [];
					for ( var i = 0; i < value.length; i++ ) {
						files[ key ].push( value[ i ] );
					}
				}
				delete( data[ k ] );
			} else if ( value instanceof $ ) {
				data[ k ] = value.jsonml();
			} else if ( value instanceof HTMLCollection || value instanceof HTMLElement ) {
				data[ k ] = $( value ).jsonml();
			} else if ( typeof( value ) == "object" ) {
				recurseExtractFiles( value, files, key + "_", deepness + 1 );
			}
		}
	};
	
	var recurseCleanNull = function(o){
		for(var k in o){
			if(hasOwnProperty2(o,k)){
				if(typeof(o[k])=='undefined'||o[k]===null){
					o[k] = '';
				}
				else if(typeof(o[k])=='object'){
					o[k] = recurseCleanNull(o[k]);
				}
			}
		}
		return o;
	};

	j.ajax = function() {
		var settings, files = {};
		if ( arguments.length == 2 ) {
			settings = arguments[ 1 ] || {};
			settings.url = arguments[ 0 ];
		} else {
			settings = arguments[ 0 ];
		}

		if ( settings.data ) {
			recurseExtractFiles( settings.data, files );
		}
		if ( !$.isEmptyObject( files ) ) {
			var haveFiles;
			var fd = new FormData();
			var params = toParamsPair( settings.data );
			for ( var i = 0; i < params.length; i++ ) {
				fd.append( params[ i ][ 0 ], params[ i ][ 1 ] );
			}
			for ( var k in files ) {
				if ( files.hasOwnProperty( k ) ) {
					var file = files[ k ];
					if ( file instanceof Array ) {
						for ( var i = 0; i < file.length; i++ ) {
							if ( typeof( file[ i ] ) != "undefined" ) {
								fd.append( k + "[]", file[ i ] );
								haveFiles = true;
							}
						}
					} else {
						if ( typeof( file ) != "undefined" ) {
							fd.append( k, file );
							haveFiles = true;
						}
					}
				}
			}
			if ( haveFiles ) {
				settings.type = "POST";
				settings.processData = false;
				settings.contentType = false;
				settings.data = fd;
			}
		}
		settings.data = recurseCleanNull(settings.data);
		return $.ajax( settings );
	};

	j.post = function( url, data, success, dataType ) {
		return j.ajax( {
			type: "POST",
			url: url,
			data: data,
			success: success,
			dataType: dataType
		} );
	};

} )( jQuery, jstack );
jstack.mvc = function(config){
	
	if(typeof(arguments[0])=='string'){
		config = {
			view: arguments[0],
			controller: typeof(arguments[1])=='string'?arguments[1]:arguments[0]
		};
	}
	
	if(!config.controller){
		config.controller = config.view;
	}
	if(!config.target){
		config.target = jstack.config.defaultTarget;
	}
	
	var target = $(config.target);
	var controller = config.controller;
	
	
	//var templatesPath = jstack.config.templatesPath;
	//var templatePath = templatesPath+config.view+'.jml';
	
	var templatesPath = config.view.split('/');
	templatesPath.pop();
	templatesPath = templatesPath.join('/')+'/';
	templatesPath = jstack.config.templatesPath+templatesPath;
	var templatePath = jstack.config.templatesPath+config.view+'.jml';
	
	var controllerPath = jstack.config.controllersPath+config.controller;
	
	var controllerReady = $.Deferred();
	var viewReady = $.Deferred();
	var processor;
	
	if(jstack.controllers[config.controller]){
		controllerReady.resolve();
	}
	else{
		$js.onExists(controllerPath,controllerReady.resolve,controllerReady.resolve);
	}
	
	jstack.template.get(templatePath).then(function(html){
		var cacheId = config.view + "#" + config.controller;
		jstack.template.compile($('<tmpl>'+html+'</tmpl>'),cacheId,templatesPath).then(function(templateProcessor){
			processor = function(data){
				var processedTemplate = templateProcessor( data );
				target.data('jModel',data);
				target.attr('j-controller',controller);
				target.html( processedTemplate );
			};
			viewReady.resolve();
		} );
	});

	
	var ready = $.Deferred();
	$.when( controllerReady, viewReady ).then( function() {
		
		var ctrl = jstack.controller(config.controller,target);
		
		ctrl.ready.then(function(){
		
			if($.type(config.data)=='object'){
				$.extend(ctrl.data,config.data);
			}
			
			
			
			ctrl.render = function(data){
				
				if(data&&data!==ctrl.data){
					$.extend(ctrl.data,data);
				}
				
				processor(ctrl.data);
				
				if(ctrl.domReady){
					ctrl.domReady();
				}
				
				ready.resolve(target,ctrl);
			};
			
			if(ctrl.setData){
				var setDataReturn = ctrl.setDataCall();
				if(setDataReturn===false){
					return;
				}
				if($.type(setDataReturn)=='object'&&setDataReturn!==ctrl.data){
					$.extend(ctrl.data,setDataReturn);
				}
			}
			ctrl.render();
		
		});
		
	} );

	return ready;
};
jstack.viewReady = function(el){
	if(typeof(arguments[0])=='string'){
		var selector = '[j-view="'+arguments[0]+'"]';
		if(typeof(arguments[1])=='object'){
			el = $(arguments[1]).find(selector);
		}
		else{
			el = $(selector);
		}
	}
	
	el = $(el);
	var ready = el.data('jViewReady');
	if(!ready){
		ready = $.Deferred();
		el.data('jViewReady',ready);
	}
	return ready;
};
$.on('j:load','[j-view]:not([j-view-loaded])',function(){
	
	var el = $(this);
	el.attr('j-view-loaded',true);
	
	var view = el.attr('j-view');
	
	var controller;
	if(el[0].hasAttribute('j-controller')){
		controller = el.attr('j-controller');
	}
	else{
		controller = view;
	}
	
	var data = el.data('jModel') || {};
	if(el.hasAttr('j-model-inherit')){
		var parent = el.parent().closest('[j-controller]');
		if(parent.length){
			var inheritProp = el.attr('j-model-inherit');
			var parentData = parent.data('jModel') || {};
			if(inheritProp){
				data[inheritProp] = parentData;
			}
			else{
				data = $.extend({},parentData,data);
			}
		}
	}
	
	
	var ready = jstack.viewReady(this);
	var mvc = jstack.mvc({
		view:view,
		controller:controller,
		target:this,
		data:data,
	});
	mvc.then(function(){
		ready.resolve();
	});
});
(function(){

	jstack.app = function(el,app){
		if(!app){
			app = el.attr('j-app');
		}
		jstack.config.templatesPath += app+'/';
		jstack.config.controllersPath += app+'/';
		
		jstack.route('*', function(path){
			path = jstack.url.getPath(path);
			return jstack.mvc(path);
		});
	};

	var el = $('[j-app]');
	if(el.length){
		jstack.app(el);
	}
	
}());