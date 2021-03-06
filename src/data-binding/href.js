jstack.dataBindingElementCompiler.push({
	match(n){
		return n.hasAttribute('j-href');
	},
	callback(n,dataBinder,scope){
		let original = n.getAttribute('j-href');
		n.removeAttribute('j-href');

		let tokens = jstack.dataBinder.textTokenizer(original);
		if(tokens===false){
			n.setAttribute('href',jstack.route.baseLocation + "#" + original);
			return;
		}

		let currentData;
		let getData = function(){
			return dataBinder.compilerAttrRender(n,tokens,scope);
		};
		let render = function(){
			let data = getData();
			if(currentData===data) return;
			currentData = data;
			n.setAttribute('href',jstack.route.baseLocation + "#" + data);
		};
		
		dataBinder.addWatcher(n,render);
		
		render();
	},
});
