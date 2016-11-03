jstack.dataBinder = (function(){
	var dataBinder = function(){
		
	};
	dataBinder.prototype = {
		dotGet: function(key,data){
			return key.split('.').reduce(function(obj,i){
				if(typeof(obj)=='object'){
					return obj[i];
				}
			}, data);
		},
		dotSet: function(key,data,value){
			key.split('.').reduce(function(obj,k,index,array){
				if(array.length==index+1){
					obj[k] = value;
				}
				else{
					if(typeof(obj[k])!='object'){
						obj[k] = {};
					}					
					return obj[k];
				}
			}, data);
		},
		getKey: function(key){
			return key.replace( /\[(["']?)([^\1]+?)\1?\]/g, ".$2" ).replace( /^\./, "" );
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
		getValue: function(element){
			var elementType = element.tagName;
			var getter = this.getters[elementType] || this.defaultGetter;
			return getter(element);
		},
		register: function(controller,data){
			var self = this;
			controller.data('j-model',data);
			this.populate(controller, data);
		},
		populate: function(controller, data){
			var self = this;
			var data = data || controller.data('j-model');
			controller.find(':input[name]').each(function(){
				var key = self.getScopedInput(this);
				var value = self.dotGet(key,data);
				$(this).populateInput(value,{preventValEvent:true});
			});
			controller.find('[j-var]').each(function(){
				var $this = $(this);
				var varAttr = $this.attr('j-var');
				var key = self.getScoped(this,varAttr);
				var value = self.dotGet(key,data);
				$this.html(value);
			});
			controller.find(':attrStartsWith("j-var-")').each(function(){
				var $this = $(this);
				var attrs = $this.attrStartsWith('j-var-');
				$.each(attrs,function(k,varAttr){					
					var match = varAttr.match(/\${\s*[\w\.]+\s*}/g);
					if(match){
						$.each(match,function(i,x){
							var v = x.match(/[\w\.]+/)[0];
							var value = self.dotGet(v,data);
							if(typeof(value)=='undefined'||value===null||!value){
								value = '';
							}
							varAttr = varAttr.replace(new RegExp("\\$\\{"+v+"\\}",'g'),value);
						});
					}
					$this.attr(k.substr(6),varAttr);
				});
			});
		},
		observer: null,
		startObserver: function(){
			this.observer.observe(document.body, { subtree: true, childList: true, attribute: false, characterData: true });
		},
		stopObserver: function(){
			this.observer.disconnect();
		},
		eventListener: function(){
			var self = this;
			self.observer = new MutationObserver(function(mutations){
				self.triggerEvent('eventDOMChange',[mutations]);
			});
			self.startObserver();
			$(document.body).on('input val', ':input[name]', function(){
				self.triggerEvent('eventInputChange',[this]);
			});
		},
		timeouts: {},
		triggerEvent: function(methodName,args){
			var self = this;
			args = args || [];
			var method = self[methodName];
			if(self.timeouts[methodName]){
				clearTimeout(self.timeouts[methodName]);
			}
			self.timeouts[methodName] = setTimeout( function() {
				method.apply(self,args);
			}, 100);
		},
		eventDOMChange: function(mutations){
			this.update();
		},
		eventInputChange: function(input){
			var self = this;
			
			var controller = $(input).closest('[j-controller]');
			var data = controller.data('j-model');
			var name = $(input).attr('name');
			var value = self.getValue(input);
			var key = self.getScopedInput(input);
			self.dotSet(key,data,value);
			
			self.update();
		},
		update: function(){
			//console.log('update');
			this.stopObserver();
			this.updateRepeat();
			this.updateIf();
			this.updateController();
			this.startObserver();
		},
		updateController: function(){
			var self = this;
			$('[j-controller]').each(function(){
				var controller = $(this);
				self.populate(controller);
			});
		},
		updateIf: function(){
			var self = this;
			$('[j-if]').each(function(){
				var $this = $(this);
				var attrIf = $this.attr('j-if');
				
				var data = $this.closest('[j-controller]').data('j-model');
				var key = self.getScoped(this,attrIf);
				var value = self.dotGet(key,data);
				var contents = $this.data('j-if');
				if(!contents){
					contents = $this.contents();
					$this.data('j-if',contents);
				}
				
				if(value){
					contents.appendTo($this);
					$this.trigger('j-if:true');
				}
				else{
					contents.detach();
					$this.trigger('j-if:false');
				}
			});
		},
		updateRepeat: function(){
			var self = this;
			$('[j-repeat]').each(function(){
				var $this = $(this);
				
				var parent = $this.parent();
				parent.attr('j-repeat-list','true');
				var list = parent.data('j-repeat-list') || [];
				list.push(this);
				parent.data('j-repeat-list',list);
				
				$this.detach();
			});
			
			$('[j-repeat-list]').each(function(){
				var $this = $(this);
				var data = $this.closest('[j-controller]').data('j-model');
				var list = $this.data('j-repeat-list') || [];
				var scopes = [];
				
				//add
				$.each(list,function(i,original){
					var $original = $(original);
										
					var attrRepeat = $original.attr('j-repeat');
					var key = self.getScoped($this.get(0),attrRepeat);
					var value = self.dotGet(key,data);
					
					var i = 1;
					$.each(value,function(k,v){
						var scope = attrRepeat+'.'+k;
						var row = $this.find('[j-scope="'+scope+'"]');
						if(!row.length){
							row = $original.clone();
							row.attr('j-scope',scope);
							row.appendTo($this);
						}
						row.find('[j-index]').text(i);
						i++;
						scopes.push(scope);
					});
					
				});
				
				//remove
				$this.children('[j-scope]').each(function(){
					var scope = $(this).attr('j-scope');
					if(scopes.indexOf(scope)===-1){
						$(this).remove();
					}
				});
			});
		},
	};
	var o = new dataBinder();
	o.eventListener();
	return o;
})();