jstack.ready = function(callback){
	var when = $.Deferred();
	
	var defers = [ jstack.dataBinder.updateDeferStateObserver ];
	if(jstack.dataBinder.loadingMutation>0){
		var deferMutation = $.Deferred();
		jstack.dataBinder.deferMutation.push(function(){
			deferMutation.resolve();
		});
		defers.push(deferMutation);
	}
	$.when.apply($,defers).then(function(){
		when.resolve();
	});

	if(callback){
		when.then(function(){
			callback();
		});
	}
	return when.promise();
};

jstack.dataBinder = (function(){
	var dataBinder = function(){

	};
	dataBinder.prototype = {
		dotGet: function(key,data,defaultValue){
			if(typeof(data)!='object'||data===null){
				return;
			}
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
			if(typeof(data)!='object'||data===null){
				return;
			}
			key.split('.').reduce(function(obj,k,index,array){
				if(array.length==index+1){
					if(isDefault){
						if(obj[k]){
							value = obj[k];
						}
					}
					else{						
						if(!obj[k]){
							obj[k] = value;
						}
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
			if(typeof(data)!='object'||data===null){
				return;
			}
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
			return key.replace( /\[(["']?)([^\1]+?)\1?\]/g, ".$2" ).replace( /^\./, "" ).replace(/\[\]/g, '.');
		},
		getClosestFormNamespace:function(p){
			while(p){
				if(p.tagName&&p.tagName.toLowerCase()=='form'){
					if(p.hasAttribute('j-name')){
						return p.getAttribute('j-name');
					}
					break;
				}
				p = p.parentNode;
			}
		},
		getValue: function(el,varKey,defaultValue){
			var data = this.getControllerData(el);

			var key = '';

			var ns = this.getClosestFormNamespace(el.parentNode);
			if(ns){
				key += ns+'.';
			}

			key += varKey;

			return this.dotGet(key,data,defaultValue);
		},
		getParentsForId: function(el){
			var a = [];
			var n = el;
			while(n){
				if(n.nodeType===Node.COMMENT_NODE&&n.nodeValue.split(' ')[0]==='j:for:id'){
					a.push(n);
					n = n.parentNode;
				}
				if(n){
					if(n.previousSibling){
						n = n.previousSibling;
					}
					else{
						n = n.parentNode;
					}
				}
				if(n===document.body) break;
			}
			return a;
		},
		getValueEval: function(el,varKey){

			var controllerEl = $(this.getController(el));
			var controller = controllerEl.data('jController');
			var scopeValue = controllerEl.data('jModel');

			//if(!document.contains(el)){
				//return;
			//}

			scopeValue = scopeValue ? JSON.parse(JSON.stringify(scopeValue)) : {}; //clone Proxy
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


			var forCollection = this.getParentsForId(el).reverse();

			for(let i = 0, l = forCollection.length; i<l; i++){
				let forid = forCollection[i];

				let parentFor = $(forid);
				let parentForList = parentFor.parentComment('j:for');

				if(!parentForList.length) continue;

				let jforCommentData = parentForList.dataComment();
				let value = jforCommentData.value;
				
				let forRow = parentFor.dataComment('j:for:row');
				
				if(!forRow){
					console.log(varKey, el, parentFor, parentFor.dataComment());
				}
				
				let index = jforCommentData.index;
				let key = jforCommentData.key;
				if(index){
					scopeValue[index] = forRow.index;
				}
				if(key){
					scopeValue[key] = forRow.key;
				}
				scopeValue[value] = forRow.value;
			}

			var params = [ '$controller', '$this', '$scope' ];
			var args = [ controller, el, scopeValue ];
			$.each(scopeValue,function(param,arg){
				params.push(param);
				args.push(arg);
			});

			params.push("return "+varKey+";");

 			var value;
 			try{
				var func = Function.apply(null,params);
				value = func.apply(null,args);
 			}

			catch(jstackException){
				if(jstack.config.debug){
					var warn = [jstackException.message, ", expression: "+varKey, "element", el];
					if(el.nodeType==Node.COMMENT_NODE){
						warn.push($(el).parent().get());
					}
					console.warn.apply(console,warn);
				}
			}

			return typeof(value)=='undefined'?'':value;
		},
		getScopedInput: function(input){
			var name = input.getAttribute('name');
			var key = this.getKey(name);
			if(key.substr(-1)=='.'&&input.type=='checkbox'){
				var index;
				$(this.getController(input.parentNode)).find(':checkbox[name="'+name+'"]').each(function(i){
					if(this===input){
						index = i;
						return false;
					}
				});
				key += index;
			}
			var scopeKey = '';
			var ns = this.getClosestFormNamespace(input.parentNode);
			if(ns){
				scopeKey += ns+'.';
			}
			scopeKey += key;
			return scopeKey;
		},
		getters: {
			select: function(el){
				return $(el).val();
			},
			/*
			input: function(element) {
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
			*/
			input: function(el) {
				switch(el.type){
					case 'checkbox':
						var $el = $(el);
						return $el.prop('checked')?$el.val():'';
					break;
					case 'radio':
						var form;
						var p = el.parentNode;
						while(p){
							if(p.tagName&&p.tagName.toLowerCase()=='form'){
								form = p;
								break;
							}
							p = p.parentNode;
						}
						if(form){
							var checked = $(form).find('[name="'+el.getAttribute('name')+'"]:checked');
							return checked.length?checked.val():'';
						}
						return '';
					break;
					case 'file':
						return el.files;
					break;
					case 'submit':
					break;
					default:
						return $(el).val();
					break;
				}
			},
			textarea: function(el){
				return $(el).val();
			},
			'j-select': function(el){
				el = $(el);
				var multiple = el[0].hasAttribute('multiple');
				var data = el.data('preselect');
				if(!data){
					if(multiple){
						data = [];
					}
					el.children().each(function(){
						if(this.hasAttribute('selected')){
							var val = this.value;
							if(multiple){
								data.push(val);
							}
							else{
								data = val;
								return false;
							}
						}
					});
				}
				return data;
			},
		},
		defaultGetter: function(element){
			return $( element ).html();
		},
		getInputVal: function(element){
			var nodeName = element.tagName.toLowerCase();
			var getter = this.getters[nodeName] || this.defaultGetter;
			return getter(element);
		},
		inputToModel: function(el,eventType,triggeredValue){
			var input = $(el);

			var self = this;

			var data = this.getControllerData(el);
			var name = el.getAttribute('name');

			var performInputToModel = function(){
				var key = self.getScopedInput(el);
				if(filteredValue!=value){
					value = filteredValue;
					input.populateInput(value,{preventValEvent:true});
				}

				var oldValue = self.dotGet(key,data);

				value = self.dotSet(key,data,value);
				input.trigger('j:input',[value]);

				if(eventType=='j:update'){
					input.trigger('j:input:update',[value]);
				}
				else{
					input.trigger('j:input:user',[value]);
				}

				if(oldValue!==value){
					input.trigger('j:change',[value,oldValue]);
				}
			};

			var value;
			if(typeof(triggeredValue)!=='undefined'){
				value = triggeredValue;
			}
			else{
				value = this.getInputVal(el);
			}
			
			var filteredValue = this.filter(el,value);


			if(typeof(filteredValue)=='object'&&filteredValue!==null&&typeof(filteredValue.promise)=='function'){
				filteredValue.then(function(val){
					filteredValue = val;
					performInputToModel();
				});
			}
			else{
				performInputToModel();
			}

		},
		watchersPrimary: 0,
		watchers: {},
		addWatcher: function(render, level){
			if(!level) level = 0;
			if(!this.watchers[level]) this.watchers[level] = {};
			this.watchers[level][++this.watchersPrimary] = render;
		},
		checkRemoved: function(ancestor){
			let parentComment = $(ancestor).parentComment('j:if');
			if(!parentComment){
				return true;
			}
			return parentComment.data('j:if:state')!==false;
		},
		runWatchers: function(){
			var self = this;
			//console.log('update');
			$.each(this.watchers,function(level,couch){
				$.each(couch,function(primary,render){
					var el = render();
					if(el&&self.checkRemoved(el)){
						delete couch[primary];
					}
				});
			});

		},

		updateDeferQueued: false,
		updateDeferInProgress: false,
		updateDeferStateObserver: null,
		update: function(){
			//console.log('update');
			var self = this;
			if(this.updateDeferQueued){
				return;
			}
			if(this.updateDeferInProgress){
				this.updateDeferQueued = true;
			}
			else{
				this.updateDeferInProgress = true;
				if(!this.updateDeferStateObserver){
					this.updateDeferStateObserver = $.Deferred();
				}
				setTimeout(function(){
					self.runWatchers();
					if(self.updateDeferQueued){
						self.updateDeferInProgress = false;
						self.updateDeferQueued = false;
						self.update();
					}
					else{
						self.updateDeferStateObserver.resolve();
						self.updateDeferStateObserver = null;
						self.updateDeferInProgress = false;
					}
				},10);
				
			}
		},

		compileNode: function(node,compilerJloads){
			var self = this;

			jstack.walkTheDOM(node,function(n){
				if(!document.body.contains(n)) return false;

				if(self.observe(n)===false){
					return false;
				}

				var $n = $(n);

				if((n.nodeType == Node.TEXT_NODE) && (n instanceof Text)){
					var renders = jstack.dataBinder.compilerText.call(n);
					if(renders){
						for(var i = 0, l=renders.length;i<l;i++){
							self.addWatcher(renders[i],99);
							renders[i]();
						}
					}
					return;
				}

				if(n.nodeType!=Node.ELEMENT_NODE) return;

				var once = n.hasAttribute('j-once');
				if(once){
					jstack.walkTheDOM(n,function(el){
						if(el.nodeType==Node.ELEMENT_NODE){
							el.setAttribute('j-once-element','true');
						}
					});
					n.removeAttribute('j-once');
				}
				else{
					once = n.hasAttribute('j-once-element');
					if(once){
						n.removeAttribute('j-once-element');
					}
				}

				$.each(self.compilers,function(k,compiler){
					var matchResult = compiler.match.call(n);
					if(matchResult){
						var render = compiler.callback.call(n,matchResult);
						if(render){
							if(!once){
								self.addWatcher(render, compiler.level);
							}
							render();
							
							//if(!document.contains(n)){
								//return false;
							//}
							
						}
					}
				});

				if(!document.body.contains(n)) return false;


				compilerJloads.push(function(){
					if(!document.body.contains(n)) return;
					if(n.hasAttribute('j-cloak')){
						n.removeAttribute('j-cloak');
					}
					if($n.data('j:load:state')){
						return;
					}
					$n.data('j:load:state',true);
					jstack.trigger(n,'load');
				});

			});

		},
		loadingMutation: 0,
		deferMutation: [],		
		loadMutations: function(mutations){
			//console.log('mutations',mutations);

			var self = this;

			let compilerJloads = [];
			
			$.each(mutations,function(i,mutation){
				$.each(mutation.addedNodes,function(ii,node){
					self.compileNode(node,compilerJloads);
				});

				$.each(mutation.removedNodes,function(ii,node){
					jstack.walkTheDOM(node,function(n){
						if(n.nodeType!==Node.ELEMENT_NODE || !$(n).data('j:load:state')){
							return false;
						}
						jstack.trigger(n,'unload');
					});
				});
			});

			setTimeout(function(){
				self.loadingMutation--;
				
				if(self.loadingMutation==0){
					while(self.deferMutation.length){
						self.deferMutation.pop()();
					}
				}
				
				for(let i = 0, l=compilerJloads.length;i<l;i++){
					compilerJloads[i]();
				}
				
			});

		},
		noChildListNodeNames: {area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, keygen:1, link:1, menuitem:1, meta:1, param:1, source:1, track:1, wbr:1, script:1, style:1, textarea:1, title:1, math:1, svg:1, canvas:1},
		inputPseudoNodeNames: {input:1 ,select:1, textarea:1},		
		observe: function(n){
			if(n.nodeType!=Node.ELEMENT_NODE) return;
			if(n.hasAttribute('j-escape')){
				return false;
			}
			if(this.noChildListNodeNames[n.tagName.toLowerCase()]){
				return;
			}

			var self = this;
			var mutationObserver = new MutationObserver(function(m){
				//console.log(m);
				self.loadingMutation++;
				setTimeout(function(){
					self.loadMutations(m);
				});
			});
			mutationObserver.observe(n, {
				subtree: false,
				childList: true,
				characterData: true,
				attributes: false,
				attributeOldValue: false,
				characterDataOldValue: false,
			});
			$(n).data('j:observer',mutationObserver);
		},
		eventListener: function(){
			var self = this;

			jstack.walkTheDOM(document.body,function(el){
				return self.observe(el);
			});

			$(document.body).on('input change j:update', ':input[name]', function(e,value){
				if(this.type=='file') return;
				if(e.type=='input'&&(this.nodeName.toLowerCase()=='select'||this.type=='checkbox'||this.type=='radio'))
					return;
				let el = this;
				setTimeout(function(){
					self.inputToModel(el,e.type,value);
				});
			});
		},
		filter:function(el,value){
			var filter = this.getFilter(el);
			if(typeof(filter)=='function'){
				value = filter(value);
			}
			return value;
		},
		getFilter:function(el){
			$el = $(el);
			var filter = $el.data('j-filter');
			if(!filter){
				var attrFilter = el.getAttribute('j-filter');
				if(attrFilter){
					var method = this.getValue(el,attrFilter);
					$el.data('j-filter',method);
				}
			}
			return filter;
		},
		getControllerData:function(el){
			return $(this.getController(el)).data('jModel');
		},
		getController:function(p){

			let controller;
			
			while(p){
				if(p.hasAttribute&&p.hasAttribute('j-controller')){
					controller = p;
					break;
				}
				p = p.parentNode;
			}
			

			if(!controller){
				controller = document.body;
				controller.setAttribute('j-controller','')
				$(controller).data('jModel',{});
			}

			return controller;
		},
		getControllerObject:function(el){
			return $(this.getController(el)).data('jController');
		},

		inputPseudoNodeNamesExtended: {input:1 ,select:1, textarea:1, button:1, 'j-input':1, 'j-select':1},
		compilers:{
			jFixedController:{
				level: 0,
				match: function(){
					return this.hasAttribute('j-fixed-controller');
				},
				callback: function(){
					this.removeAttribute('j-fixed-controller');
					let controllerData = $(jstack.dataBinder.getController(this)).data();
					$(this).data({
						jController:controllerData.jController,
						jModel:controllerData.jModel,
					});
					this.setAttribute('j-controller','__fixed');
				}
			},
			jFor:{
				level: 1,
				match:function(){
					return this.hasAttribute('j-for');
				},
				callback:function(){
					var el = this;
					var $this = $(this);
					var jfor = $('<!--j:for-->');
					var jforClose = $('<!--/j:for-->');
					$this.replaceWith(jfor);
					jforClose.insertAfter(jfor);

					var attrFor = el.getAttribute('j-for');
					el.removeAttribute('j-for');
					attrFor = attrFor.trim();
					var index, key, value, myvar;

					var p = new RegExp('(\\()(.*)(,)(.*)(,)(.*)(\\))(\\s+)(in)(\\s+)(.*)',["i"]);
					var m = p.exec(attrFor);
					if (m != null){
						index = m[2].trim();
						key = m[4].trim();
						value = m[6];
						myvar = m[11].trim();
					}
					else{
						var p = new RegExp('(\\()(.*)(,)(.*)(\\))(\\s+)(in)(\\s+)(.*)',["i"]);
						var m = p.exec(attrFor);
						if (m != null){
							key = m[2].trim();
							value = m[4];
							myvar = m[9].trim();
						}
						else{
							var p = new RegExp('(.*)(\\s+)(in)(\\s+)(.*)',["i"]);
							var m = p.exec(attrFor);
							if (m != null){
								value = m[1];
								myvar = m[5].trim();
							}
							else{
								throw new Error('Malformed for clause: '+attrFor);
							}
						}
					}

					var currentData;
					var getData = function(){
						return jstack.dataBinder.getValueEval(jfor[0],myvar);
					};

					//parentForList
					jfor.dataComment({
						value:value,
						key:key,
						index:index,
					});

					
					let isTemplate = el.tagName.toLowerCase()=='template';
					
					var content = this.content;

					var render = function(){
						if(!document.body.contains(jfor[0])) return jfor[0];

						var data = getData();
						if(currentData===data) return;
						currentData = data;
						
						if(!data){
							data = [];
						}
						
						let domRows = {};
						
						$.each(jfor.commentChildren(),function(k,v){
							if(v.nodeType===Node.COMMENT_NODE&&this.nodeValue.split(' ')[0] == 'j:for:id'){
								let row = $(v);
								let data = row.dataComment('j:for:row');
								if(data&&data.key){									
									let key = data.key;
									domRows[key] = row;
								}
							}
						});
						
						//add
						let index = 1;
						$.each(data,function(k,v){
							let row = domRows[k];
							delete domRows[k];
							let create;
							if(!row){
								row = $('<!--j:for:id-->');
								create = true;
							}
							row.dataComment('j:for:row',{
								'value':v,
								'index':index,
								'key':k,
							});
							//console.log(row.dataComment());
							if(create){
								row.insertBefore(jforClose);
								
								let addRow;
								if(isTemplate){
									addRow = $(document.importNode(content, true));
								}
								else{
									addRow = $this.clone();
									addRow.attr('j-for-id',k);
								}
								addRow.insertBefore(jforClose);
								
								$('<!--/j:for:id-->').insertBefore(jforClose);
							}
							index++;
						});

						//remove
						$.each(domRows,function(k,row){
							row.commentChildren().remove();
							row.remove();
						});
						
					};

					return render;


				},
			},
			jIf:{
				level: 2,
				match:function(){
					return this.hasAttribute('j-if')&&document.contains(this);
				},
				callback:function(){
					var el = this;
					var $this = $(this);
					var jif = $('<!--j:if-->');
					$this.before(jif);

					var jelseifEl = $this.nextUntil('[j-if]','[j-else-if]');
					var jelseEl = $this.nextUntil('[j-if]','[j-else]');

					if(this.tagName.toLowerCase()=='template'){
						$this = $(jstack.fragmentToHTML(this));
						$(el).detach();
					}

					var lastBlock;
					if(jelseEl.length){
						lastBlock = jelseEl;
					}
					else if(jelseifEl.length){
						lastBlock = jelseifEl.last();
					}
					else{
						lastBlock = jif;
					}
					$('<!--/j:if-->').insertAfter(lastBlock);

					var myvar = el.getAttribute('j-if');
					el.removeAttribute('j-if');
					var currentData;
					var getData = function(){
						return Boolean(jstack.dataBinder.getValueEval(jif[0],myvar));
					};

					var getData2;
					var currentData2 = null;
					if(jelseifEl.length){
						var myvar2 = [];
						var newJelseifEl = [];
						jelseifEl.each(function(){
							myvar2.push( this.getAttribute('j-else-if') );
							this.removeAttribute('j-else-if');
							if(this.tagName.toLowerCase()=='template'){
								$( '<div>'+jstack.fragmentToHTML(this)+'</div>' ).contents().each(function(){
									newJelseifEl.push(this);
								});
							}
							else{
								newJelseifEl.push(node);
							}
						});
						jelseifEl = $(newJelseifEl);

						getData2 = function(){
							var data = false;
							for(var i=0, l=myvar2.length;i<l;i++){
								if( Boolean(jstack.dataBinder.getValueEval(jif[0],myvar2[i])) ){
									data = i;
									break;
								}
							}
							return data;
						};
					}

					if(jelseEl.length){
						var newJelseEl = [];
						jelseEl.each(function(){
							this.removeAttribute('j-else');
							if(this.tagName.toLowerCase()=='template'){
								$( '<div>'+jstack.fragmentToHTML(this)+'</div>' ).contents().each(function(){
									newJelseEl.push(this);
								});
							}
							else{
								newJelseEl.push(this);
							}
						});
						jelseEl = $(newJelseEl);
					}

					var render = function(){
						if(!document.body.contains(jif[0])) return jif[0];

						var data = getData();
						var data2 = null;
						if(getData2){
							data2 = data?false:getData2();
						}
						if( currentData===data && data2===currentData2 ) return;
						currentData = data;
						currentData2 = data2;

						$this.data('j:if:state',data);
						if(data){
							$this.insertAfter(jif);

							if(jelseifEl.length){
								jelseifEl.data('j:if:state',false);
								jelseifEl.detach();
							}
							if(jelseEl.length){
								jelseEl.data('j:if:state',false);
								jelseEl.detach();
							}
						}
						else{
							$this.detach();

							if(jelseifEl.length){
								jelseifEl.data('j:if:state',false);
								if(data2===false){
									jelseifEl.detach();
								}
								else{
									var jelseifElMatch = $(jelseifEl[data2]);
									jelseifElMatch.data('j:if:state',true);
									jelseifElMatch.insertAfter(jif);
								}
							}
							if(jelseEl.length){
								if(data2===false||data2===null){
									jelseEl.data('j:if:state',true);
									jelseEl.insertAfter(jif);
								}
								else{
									jelseEl.data('j:if:state',false);
									jelseEl.detach();
								}
							}
						}
					};

					return render;
				},
			},
			jSwitch:{
				level: 3,
				match:function(){
					return this.hasAttribute('j-switch');
				},
				callback:function(){
					var el = this;
					var $this = $(this);
					var myvar = this.getAttribute('j-switch');
					this.removeAttribute('j-switch');

					var cases = $this.find('[j-case],[j-case-default]');

					var currentData;
					var getData = function(){
						return Boolean(jstack.dataBinder.getValueEval(el,myvar));
					};
					var render = function(){
						if(!document.body.contains(el)) return el;

						var data = getData();
						if(currentData===data) return;
						currentData = data;

						var found = false;
						cases.filter('[j-case]').each(function(){
							var jcase = $(this);
							var caseVal = this.getAttribute('j-case');
							if(caseVal==data){
								jcase.appendTo($this);
								found = true;
							}
							else{
								jcase.detach();
							}
						});
						cases.filter('[j-case-default]').each(function(){
							var jcase = $(this);
							if(found){
								jcase.detach();
							}
							else{
								jcase.appendTo($this);
							}
						});

					};

					return render;
				},
			},
			jShow:{
				level: 4,
				match:function(){
					return this.hasAttribute('j-show');
				},
				callback:function(){
					var el = this;
					var $this = $(this);

					var myvar = this.getAttribute('j-show');
					this.removeAttribute('j-show');
					var currentData;
					var getData = function(){
						return Boolean(jstack.dataBinder.getValueEval(el,myvar));
					};

					var render = function(){
						if(!document.body.contains(el)) return el;

						var data = getData();
						if(currentData===data) return;
						currentData = data;

						if(data){
							$this.show();
						}
						else{
							$this.hide();
						}
					};

					return render;
				},
			},
			jHref:{
				level: 5,
				match:function(){
					return this.hasAttribute('j-href');
				},
				callback:function(){

					var el = this;
					var $this = $(this);

					var original = this.getAttribute('j-href');
					this.removeAttribute('j-href');

					var tokens = jstack.dataBinder.textTokenizer(original);
					if(tokens===false){
						el.setAttribute('href',jstack.route.baseLocation + "#" + original);
						return;
					}

					var currentData;
					var getData = jstack.dataBinder.createCompilerAttrRender(el,tokens);
					var render = function(){
						if(!document.body.contains(el)) return el;

						var data = getData();
						if(currentData===data) return;
						currentData = data;
						el.setAttribute('href',jstack.route.baseLocation + "#" + data);
					};

					return render;
				},
			},
			jTwoPoints:{
				level: 6,
				match:function(){
					var r;
					for (var i = 0, atts = this.attributes, n = atts.length; i < n; i++) {
						var att = atts[i];
						if(att.name.substr(0,1) === ':') {
							if(!r){
								r = {};
							}
							r[att.name] = att.value;
						}
					}
					return r;
				},
				callback:function(attrs){
					var el = this;
					var $this = $(this);
					var attrsVars = {};
					var attrsVarsCurrent = {};
					var propAttrs = ['selected','checked'];
					var nodeName = this.nodeName.toLowerCase();
					$.each(attrs,function(k,v){
						var tokens = jstack.dataBinder.textTokenizer(v);
						var key = k.substr(1);
						if(tokens===false){
							el.setAttribute(key,v);
						}
						else{
							attrsVars[key] = tokens;
						}
						el.removeAttribute(k);
					});
					var render = function(){
						if(!document.body.contains(el)||attrsVars.length==0) return el;
						$.each(attrsVars,function(k,v){
							var value = jstack.dataBinder.compilerAttrRender(el,v);
							if(attrsVarsCurrent[k]===value) return;
							attrsVarsCurrent[k] = value;

							if(propAttrs.indexOf(k)!==-1){
								$this.prop(k,value);
							}
							else if(typeof(value) === "boolean"){
								if(value){
									el.setAttribute(k,k);
								}
								else{
									el.removeAttribute(k);
								}
							}
							else{
								el.setAttribute(k,value);
							}

						});
					};
					return render;
				},
			},
			jInputFile:{
				level: 8,
				match: function(){
					return this.hasAttribute('name')&&this.tagName.toLowerCase()=='input'&&this.type=='file';
				},
				callback:function(){
					$(this).on('input change', function(e){
						jstack.dataBinder.inputToModel(this,e.type);
					});
				}
			},
			jInput:{
				level: 8,
				match: function(){
					return document.body.contains(this) && this.hasAttribute('name')&&jstack.dataBinder.inputPseudoNodeNamesExtended[this.tagName.toLowerCase()]&&this.type!='file';
				},
				callback:function(matched){
					var el = this;
					var $el = $(this);

					var currentData;

					//default to model					
					var key = jstack.dataBinder.getScopedInput(el);
					var val = jstack.dataBinder.getInputVal(el);
					let controllerData = jstack.dataBinder.getControllerData(el);
					controllerData = jstack.getObserverTarget( controllerData );
					jstack.dataBinder.dotSet(key,controllerData,val,true);

					var getData = function(){
						var defaultValue = jstack.dataBinder.getInputVal(el);
						var key = jstack.dataBinder.getKey( el.getAttribute('name') );
						return jstack.dataBinder.getValue(el,key,defaultValue);
					};

					var render = function(){
						if(!document.body.contains(el)) return el;

						var data = getData();
						if(currentData===data) return;
						currentData = data;

						if($el.data('j:populate:prevent')) return;
						$el.populateInput(data,{preventValEvent:true});
						$el.trigger('j:val',[data]);
					};
					return render;
				},
			},
		},
		compilerAttrRender: function(el,tokens){
			var r = '';
			for(var i = 0, l = tokens.length; i<l; i++){
				var token = tokens[i];
				if(token.substr(0,2)=='{{'){
					token = jstack.dataBinder.getValueEval(el,token.substr(2,token.length-4));
				}
				r += token?token:'';
			}
			return r;
		},
		createCompilerAttrRender: function(el,tokens){
			return function(){
				return jstack.dataBinder.compilerAttrRender(el,tokens);
			};
		},
		createCompilerTextRender: function(text,token){
			var currentData;
			return function(){
				if(!document.body.contains(text[0])) return text[0];
				var data = jstack.dataBinder.getValueEval(text[0],token);
				if(currentData===data) return;
				currentData = data;
				text.commentChildren().remove();
				text.after(data);
			};
		},
		compilerText:function(){
			if(!this.textContent) return;
			var textString = this.textContent.toString();
			var tokens = jstack.dataBinder.textTokenizer(textString);
			if(tokens===false) return;

			var el = this;
			var $this = $(this);
			var renders = [];

			var last = $this;

			for(var i = 0, l = tokens.length; i < l; i++){
				var token = tokens[i];

				if(token.substr(0,2)!='{{'){
					token = document.createTextNode(token);
					last.after(token);
					last = token;
					continue;
				}

				var text = $('<!--j:text-->');
				var textClose = $('<!--/j:text-->');
				text.insertAfter(last);
				textClose.insertAfter(text);
				last = textClose;

				token = token.substr(2,token.length-4);
				renders.push(jstack.dataBinder.createCompilerTextRender(text,token));
			};
			$this.remove();

			return renders;
		},
		textTokenizer:function(text){
			var tagRE = /\{\{((?:.|\n)+?)\}\}/g;
			if (!tagRE.test(text)) {
				return false;
			}
			var tokens = [];
			var lastIndex = tagRE.lastIndex = 0;
			var match, index;
			while ((match = tagRE.exec(text))) {
				index = match.index;
				// push text token
				if (index > lastIndex) {
					tokens.push(text.slice(lastIndex, index));
				}
				// tag token
				var exp = match[1].trim();
				tokens.push("{{" + exp + "}}");
				lastIndex = index + match[0].length;
			}
			if (lastIndex < text.length) {
				tokens.push(text.slice(lastIndex));
			}
			return tokens;
		},
	};
	var o = new dataBinder();
	o.eventListener();
	return o;
})();
$.on('reset','form',function(){
	$(this).populateReset();
});
