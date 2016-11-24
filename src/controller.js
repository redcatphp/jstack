jstack.controller = function(controller,element){
	
	if(typeof(controller)=='object'){
		jstack.controllers[controller.name] = function(){
			
			$.extend(true,this,controller);
			
			this.setDataArguments = [];
			this.setDataCall = function(){
				return this.setData.apply( this, this.setDataArguments );
			};
			
		};
		return jstack.controllers[controller.name];
	}

	
	controller = jstack.controllers[controller] || jstack.config.defaultController;
	
	controller = new controller();
	
	controller.ready = $.Deferred();
	
	controller.element = element;
	
	element.data('jController',controller);
	
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
		//console.log('change',change);
		jstack.dataBinder.triggerUpdate();
	});
	
	$.when.apply($, dependencies).then(function(){
		controller.ready.resolve();
	});
	
	return controller;
};