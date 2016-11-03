/*
jstack fork of http://gwendall.github.io/way/

surikat modifs:
	lazy load init
	focus update
	bugfix loop with $.each
	add global jstack register
	remove "use strict" and fix the code with ;
	update to support new type html5 input types
	eventDOMChange to new MutationObserver standard
	set default data value by value attribute
	handle $.val() change event
	use jquery (add a framework dependency but jstack is built on jquery so...)
	enforcing synchro
*/
jstack.way = ( function() {

	var way, w, tagPrefix = "way";

	// EVENT EMITTER DEFINITION
	var EventEmitter = function() {
		this._watchers = {};
		this._watchersAll = {};

	};
	EventEmitter.prototype.constructor = EventEmitter;
	EventEmitter.prototype.watchAll = function( handler ) {
		this._watchersAll = this._watchersAll || [];
		if ( !_w.contains( this._watchersAll, handler ) ) { this._watchersAll.push( handler ); }
	};
	EventEmitter.prototype.watch = function( selector, handler ) {
		if ( !this._watchers ) { this._watchers = {}; }
		this._watchers[ selector ] = this._watchers[ selector ] || [];
		this._watchers[ selector ].push( handler );
	};
	EventEmitter.prototype.findWatcherDeps = function( selector ) {
		// Go up to look for parent watchers
		// ex: if "some.nested.value" is the selector, it should also trigger for "some"
		var result = [];
		var watchers = _w.keys( this._watchers );
		watchers.forEach( function( watcher ) {
			if ( startsWith( selector, watcher ) ) { result.push( watcher ); }
		} );
		return result;
	};
	EventEmitter.prototype.emitChange = function( selector /* , arguments */ ) {
		if ( !this._watchers ) { this._watchers = {}; }
		var self = this;
		// Send data down to the local watchers
		var deps = self.findWatcherDeps( selector );
		deps.forEach( function( item ) {
			if ( self._watchers[ item ] ) {
				self._watchers[ item ].forEach( function( handler ) {
					handler.apply( self, [ self.get( item ) ] );
				} );
			}
		} );
		// Send data down to the global watchers
		if ( !self._watchersAll || !_w.isArray( self._watchersAll ) ) { return; }
		self._watchersAll.forEach( function( watcher ) {
			if ( _w.isFunction( watcher ) ) { watcher.apply( self, [ selector, self.get( selector ) ] ); }
		} );
	};

	// WAY DEFINITION
	var WAY = function() {
		this.data = {};
		this._bindings = {};
		this.options = {
			timeoutInput: 50,
			timeoutDOM: 1500
		};
	};

	// Inherit from EventEmitter
	WAY.prototype = Object.create( EventEmitter.prototype );
	WAY.constructor = WAY;

	// DOM METHODS CHAINING
	WAY.prototype.dom = function( element ) {
		this._element = element;
		return this;
	};

	// DOM METHODS: DOM -> JSON
	WAY.prototype.toStorage = function( options, element ) {
		var self = this,
			element = element || self._element,
			options = options || self.dom( element ).getOptions(),
			data = self.dom( element ).toJSON( options ),
			scope = self.dom( element ).scope(),
			selector = scope ? scope + "." + options.data : options.data;
		if ( options.readonly ) { return false; }
		self.set( selector, data, options );

	};
	WAY.prototype.toJSON = function( options, element ) {
		var self = this,
			element = element || self._element,
			data = self.dom( element ).getValue(),
			options = options || self.dom( element ).getOptions();
		if ( _w.isArray( options.pick ) ) { data = selectNested( data, options.pick, true ); }
		if ( _w.isArray( options.omit ) ) { data = selectNested( data, options.omit, false ); }
		return data;
	};

	// DOM METHODS: JSON -> DOM
	WAY.prototype.fromStorage = function( options, element ) {
		var self = this,
			element = element || self._element,
			options = options || self.dom( element ).getOptions();

		if ( element.tagName == "INPUT" && element.type == "file" ) return;

		if ( options.writeonly ) { return false; }
		var scope = self.dom( element ).scope(),
			selector = scope ? scope + "." + options.data : options.data,
			data = self.get( selector );

		if ( typeof( data ) == "undefined" ) { //Set default data value by value attribute
			//if(!(element.tagName=='INPUT'&&element.type=='file')){
				data = $( element ).val();
				self.set( selector, data, options );
			//}
		}
		self.dom( element ).fromJSON( data, options );
	};
	WAY.prototype.fromJSON = function( data, options, element ) {
		var self = this,
			element = element || self._element,
			options = options || self.dom( element ).getOptions();
		if ( options.writeonly ) { return false; }
		if ( _w.isObject( data ) ) {
			if ( _w.isArray( options.pick ) ) { data = selectNested( data, options.pick, true ); }
			if ( _w.isArray( options.omit ) ) { data = selectNested( data, options.omit, false ); }
			var currentData = _w.isObject( self.dom( element ).toJSON() ) ? self.dom( element ).toJSON() : {};
			data = _w.extend( currentData, data );
		}
		self.dom( element ).setValue( data, options );
	};

	// DOM METHODS: GET - SET HTML
	WAY.prototype.getValue = function( element ) {
		var self = this,
			element = element || self._element;
		var getters = {
			"SELECT": function() {
				return $( element ).val();
			},
			"INPUT": function() {
				var type = $( element ).prop('type');
				if ( _w.contains( [ "checkbox", "radio" ], type ) ) {
					return $( element ).prop( "checked" ) ? $( element ).val() : null;
				} else if ( type == "file" ) {
					return element.files;
				} else if ( type != "submit" ) {
					return $( element ).val();
				}

			},
			"TEXTAREA": function() {
				return $( element ).val();
			}
		};
		var defaultGetter = function( a ) {
			return $( element ).html();
		};
		var elementType = element.tagName;
		var getter = getters[ elementType ] || defaultGetter;
		return getter();
	};
	WAY.prototype._transforms = {
		uppercase: function( data ) {
			return _w.isString( data ) ? data.toUpperCase() : data;
		},
		lowercase: function( data ) {
			return _w.isString( data ) ? data.toLowerCase() : data;
		},
		reverse: function( data ) {
			return data && data.split && _w.isFunction( data.split ) ? data.split( "" ).reverse().join( "" ) : data;
		}
	};
	WAY.prototype.registerTransform = function( name, transform ) {
		var self = this;
		if ( _w.isFunction( transform ) ) { self._transforms[ name ] = transform; }
	};
	WAY.prototype.setValue = function( data, options, element ) {
		var self = this,
			element = element || self._element,
			options = options || self.dom( element ).getOptions();
		options.transform = options.transform || [];
		options.transform.forEach( function( transformName ) {
			var transform = self._transforms[ transformName ] || function( data ) { return data; };
			data = transform( data );
		} );
		var setters = {
			"SELECT": function( a ) {
				if(!a&& $( element ).find('option:first-child[selected][disabled]') ){
					return;
				}
				$( element ).setVal( a ).trigger( 'val', ['way-prevent-update'] );
			},
			"INPUT": function( a ) {
				if ( !_w.isString( a ) ) { a = $.isEmptyObject( a ) ? "" : JSON.stringify( a ); }
				var type = element.type;
				if ( _w.contains( [ "checkbox", "radio" ], type ) ) {
					if ( a === $( element ).val() ) {
						$( element ).prop( "checked", true );
					} else {
						$( element ).prop( "checked", false );
					}
				} else if ( type == "file" ) {
					return;
				} else if ( type != "submit" ) {
					$( element ).setVal( a || "" ).trigger( 'val', ['way-prevent-update'] );
				}
			},
			"TEXTAREA": function( a ) {
				if ( !_w.isString( a ) ) { a = $.isEmptyObject( a ) ? "" : JSON.stringify( a ); }
				$( element ).setVal( a || "" ).trigger( 'val', ['way-prevent-update'] );
				
			},
			"PRE": function( a ) {
				if ( options.html ) {
					$( element ).html( a );
				} else {
					$( element ).text( a );
				}
			},
			"IMG": function( a ) {
				if ( !a ) {
					a = options.default || "";
					$( element ).attr( "src", a );
					return false;
				}
				var isValidImageUrl = function( url, cb ) {
					$( element ).addClass( "way-loading" );
					$( "<img>", {
						src: url,
						onerror: function() { cb( false ); },
						onload: function() { cb( true ); }
					} );
				};
				isValidImageUrl( a, function( response ) {
					$( element ).removeClass( "way-loading" );
					if ( response ) {
						$( element ).removeClass( "way-error" ).addClass( "way-success" );
					} else {
						if ( a ) {
							$( element ).addClass( "way-error" );
						} else {
							$( element ).removeClass( "way-error" ).removeClass( "way-success" );
						}
						a = options.default || "";
					}
					$( element ).attr( "src", a );
				} );
			}
		};
		var defaultSetter = function( a ) {
			var read = $( element ).html();
			if(!a){
				a = "";
			}
			if(read==a) return;
			if ( options.html ) {
				$( element ).html( a || "" );
			} else {
				$( element ).text( a || "" );
			}
		};
		var elementType = $( element ).get( 0 ).tagName;
		var setter = setters[ elementType ] || defaultSetter;
		if ( data === null || typeof( data ) == "undefined" ) data = "";
		setter( data );
	};
	WAY.prototype.setDefault = function( force, options, element ) {
		var self = this,
			element = element || self._element,
			force = force || false,
			options = options ? _w.extend( self.dom( element ).getOptions(), options ) : self.dom( element ).getOptions();
		// Should we just set the default value in the DOM, or also in the datastore?
		if ( !options.default ) { return false; }
		if ( force ) {
			self.set( options.data, options.default, options );
		} else {
			self.dom( element ).setValue( options.default, options );
		}
	};
	WAY.prototype.setDefaults = function() {
		var self = this,
			dataSelector = "[" + tagPrefix + "-default]";

		var elements = $( dataSelector ).get();
		$.each( elements, function( i, element ) {
			var options = self.dom( element ).getOptions(),
				selector = options.data || null,
				data = selector ? self.get( selector ) : null;
			if ( !data ) { self.dom( element ).setDefault(); }
		} );

	};

	// DOM METHODS: GET - SET BINDINGS

	// Scans the DOM to look for new bindings
	WAY.prototype.registerBindings = function() {
		//console.log('registerBindings');
		
		var self = this;
		
		self._bindings = {};

		//var selector = "["+tagPrefix+"-data]:not(.way-bound)";
		var selector = "["+tagPrefix+"-data]";

		var elements = $( selector ).get();
		$.each( elements, function( i, element ) {
			//$(element).addClass('way-bound');
			var options = self.dom( element ).getOptions(),
				scope = self.dom( element ).scope(),
				selector = scope ? scope + "." + options.data : options.data;

			self._bindings[ selector ] = self._bindings[ selector ] || [];
			if ( !_w.contains( self._bindings[ selector ], $( element ).get( 0 ) ) ) {
				self._bindings[ selector ].push( $( element ).get( 0 ) );
			}

		} );

	};
	WAY.prototype.updateBindings = function( selector ) {
		//console.log('updateBindings');
		
		var self = this;

		// Set bindings for the data selector
		var bindings = pickAndMergeParentArrays( self._bindings, selector );
		$.each(bindings,function(i, element ) {
			
			//if(!document.body.contains(element)){
				//bindings.splice(i,1);
				//return;
			//}
			
			var focused = ( $( element ).get( 0 ) === $( ":focus" ).get( 0 ) ) ? true : false;
			if ( !focused || element.getAttribute( "data-way-focus-nosync" ) != "true" //Surikat patch for focus don't break sync
			) {
				self.dom( element ).fromStorage();
			}
		} );
	};

	// DOM METHODS: GET - SET REPEATS
	WAY.prototype.registerRepeats = function() {
		//console.log('registerRepeats');
		
		// Register repeats
		var self = this;
		var selector = "[" + tagPrefix + "-repeat]";
		self._repeats = self._repeats || {};
		self._repeatsCount = self._repeatsCount || 0;
		
		var elements = $( selector ).get();
		$.each( elements, function( i, element ) {
			var options = self.dom( element ).getOptions();
			
			var scope = self.dom( element ).scope();
			options.repeat = (scope?scope+'.':'')+options.repeat;

			self._repeats[ options.repeat ] = self._repeats[ options.repeat ] || [];

			var wrapperAttr = tagPrefix + "-repeat-wrapper=\"" + self._repeatsCount + "\"",
					parent = $( element ).parent( "[" + wrapperAttr + "]" );
			if ( !parent.length ) {

				self._repeats[ options.repeat ].push( {
					id: self._repeatsCount,
					element: $( element ).clone( true ).removeAttr( tagPrefix + "-repeat" ).removeAttr( tagPrefix + "-filter" ).get( 0 ),
					selector: options.repeat,
					filter: options.filter
				} );

				//var wrapper = document.createElement( "div" );
				//var wrapper = document.createElement( $(element).parent().prop('tagName') );
				var wrapper = $(element).parent().get(0);
				
				$( wrapper ).attr( tagPrefix + "-repeat-wrapper", self._repeatsCount );
				$( wrapper ).attr( tagPrefix + "-scope", options.repeat );
				if ( options.filter ) { $( wrapper ).attr( tagPrefix + "-filter", options.filter ); }

				//$( element ).replaceWith( wrapper );
				
				self.updateRepeats( options.repeat );

				self._repeatsCount++;

			}

		} );

	};

	WAY.prototype.updateRepeats = function( selector ) {
		//console.log('updateRepeats');
		
		var self = this;
			self._repeats = self._repeats || {};
		var repeats = pickAndMergeParentArrays( self._repeats, selector );
		
		repeats.forEach( function( repeat ) {

			var wrapper = "[" + tagPrefix + "-repeat-wrapper=\"" + repeat.id + "\"]",
				data = self.get( repeat.selector ),
				items = [];

			repeat.filter = repeat.filter || [];
			$( wrapper ).empty();
			
			var i = 1;
			for ( var key in data ) {
				if ( !data.hasOwnProperty( key ) ) continue;
				$( repeat.element ).attr( tagPrefix + "-scope", key );
				var html = $( repeat.element ).get( 0 ).outerHTML;
				html = html.replace( /\$\$key/gi, key );
				html = html.replace( /\$\$i/gi, i );
				items.push( html );
				i++;
			}

			$( wrapper ).html( items.join( "" ) );
			//self.registerBindings();
			//self.updateBindings();

		} );
		
		self.registerBindings();
		self.updateBindings();
	};

	// DOM METHODS: FORMS
	WAY.prototype.updateForms = function() {
		//console.log('updateForms');
		
		// If we just parse the forms with form2js (see commits before 08/19/2014) and set the data with way.set(),
		// we reset the entire data for this pathkey in the datastore. It causes the bug
		// reported here: https://github.com/gwendall/way.js/issues/10
		// Solution:
		// 1. watch new forms with a [way-data] attribute
		// 2. remove this attribute
		// 3. attach the appropriate attributes to its child inputs
		// -> so that each input is set separately to way.js' datastore
		var self = this;
		var selector = "form[" + tagPrefix + "-data], form[" + tagPrefix + "-data-binded]";
		var elements = $( selector ).get();
		$.each( elements, function( i, form ) {
			var options = self.dom( form ).getOptions(),
				formDataSelector = options.data;
			
			$( form ).attr(tagPrefix + '-scope', options.data);
			
			if ( formDataSelector ) {
				$( form ).data( "formDataSelector", formDataSelector );
			}
			else {
				formDataSelector = $( form ).data( "formDataSelector" );
			}

			$( form ).removeAttr( tagPrefix + "-data" ).attr( tagPrefix + "-data-binded", true );

			// Reverse needed to set the right index for "[]" names
			var inputs = $( form ).find( "[name]:not([way-data])" ).reverse().get();
			$.each( inputs, function( ii, input ) {
				//If($(input).attr("type")=='file') return;
				var name = $( input ).attr( "name" );
				if ( endsWith( name, "[]" ) ) {
					var array = name.split( "[]" )[ 0 ],
							arraySelector = "[name^='" + array + "']",
							arrayIndex = $( form ).find( arraySelector ).get().length;
					name = array + "." + arrayIndex;
				}
				//var selector = formDataSelector + "." + name;
				var selector = name;
				options.data = selector;
				self.dom( input ).setOptions( options );
				//W.dom(input).removeAttr("name");

			} );

		} );

	};

	WAY.prototype.updateDependencies = function( selector ) {
		this.updateBindings( selector );
		this.updateRepeats( selector );
		this.updateForms( selector );
	};

	// DOM METHODS: OPTIONS PARSING
	WAY.prototype.setOptions = function( options, element ) {
		var self = this,
			element = self._element || element;
		for ( var k in options ) {
			if ( !options.hasOwnProperty( k ) ) continue;
			var attr = tagPrefix + "-" + k,
				value = options[ k ];
			$( element ).attr( attr, value );
		}
	};
	WAY.prototype.getOptions = function( element ) {
		var self = this,
			element = element || self._element,
			defaultOptions = {
				data: null,
				html: false,
				readonly: false,
				writeonly: false,
			};
		return _w.extend( defaultOptions, self.dom( element ).getAttrs( tagPrefix ) );

	};

	WAY.prototype.getAttrs = function( prefix, element ) {
		var self = this,
			element = element || self._element;

		var parseAttrValue = function( key, value ) {
			var attrTypes = {
				pick: "array",
				omit: "array",
				readonly: "boolean",
				writeonly: "boolean",
				json: "boolean",
				html: "boolean",
			};
			var parsers = {
				array: function( value ) {
					return value.split( "," );
				},
				boolean: function( value ) {
					if ( value === "true" ) { return true; }
					if ( value === "false" ) { return false; }
					return true;
				}
			};
			var defaultParser = function() { return value; };
			var valueType = attrTypes[ key ] || null;
			var parser = parsers[ valueType ] || defaultParser;
			return parser( value );
		};

		var attributes = {};
		var attrs = [].slice.call( $( element ).get( 0 ).attributes );
		attrs.forEach( function( attr ) {
			var include = ( prefix && startsWith( attr.name, prefix + "-" ) ) ? true : false;
			if ( include ) {
				var name = ( prefix ) ? attr.name.slice( prefix.length + 1, attr.name.length ) : attr.name;
				var value = parseAttrValue( name, attr.value );
				if ( _w.contains( [ "transform", "filter" ], name ) ) { value = value.split( "|" ); }
				attributes[ name ] = value;
			}
		} );
		return attributes;
	};

	// DOM METHODS: SCOPING
	WAY.prototype.scope = function( options, element ) {
		var self = this,
			element = element || self._element,
			scopeAttr = tagPrefix + "-scope",
			scopeBreakAttr = tagPrefix + "-scope-break",
			scopes = [],
			scope = "";

		var parentsSelector = "[" + scopeBreakAttr + "], [" + scopeAttr + "]";
		var elements = $( element ).parents( parentsSelector ).get();
		$.each( elements, function( i, el ) {
			if ( $( el ).attr( scopeBreakAttr ) ) { return false; }
			var attr = $( el ).attr( scopeAttr );
			scopes.unshift( attr );
		} );
		if ( $( element ).attr( scopeAttr ) ) { scopes.push( $( element ).attr( scopeAttr ) ); }
		if ( $( element ).attr( scopeBreakAttr ) ) { scopes = []; }
		scope = _w.compact( scopes ).join( "." );
		return scope;

	};

	// DATA METHODS //
	WAY.prototype.get = function( selector ) {
		var self = this;
		if ( selector !== undefined && !_w.isString( selector ) ) { return false; }
		if ( !self.data ) { return {}; }
		return selector ? _json.get( self.data, selector ) : self.data;
	};
	WAY.prototype.set = function( selector, value, options ) {
		if ( !selector ) { return false; }
		if ( selector.split( "." )[ 0 ] === "this" ) {
			console.log( "Sorry, \"this\" is a reserved word in way.js" );
			return false;
		}
		var self = this;
		options = options || {};
		if ( selector ) {
			if ( !_w.isString( selector ) ) { return false; }

			self.data = self.data || {};

			self.data = selector ? _json.set( self.data, selector, value ) : {};
			self.updateDependencies( selector );
			self.emitChange( selector, value );
		}
	};
	WAY.prototype.push = function( selector, value, options ) {
		if ( !selector ) return false;
		var self = this;
		options = options || {};
		if ( selector ) {
			self.data = selector ? _json.push( self.data, selector, value, true ) : {};
		}
		self.updateDependencies( selector );
		self.emitChange( selector, null );
	};
	WAY.prototype.remove = function( selector, options ) {
		var self = this;
		options = options || {};
		if ( selector ) {
			self.data = _json.remove( self.data, selector );
		} else {
			self.data = {};
		}
		self.updateDependencies( selector );
		self.emitChange( selector, null );
	};
	WAY.prototype.clear = function() {
		this.remove( null );
	};

	// MISC //
	var matchesSelector = function( el, selector ) {
		var matchers = [ "matches", "matchesSelector", "webkitMatchesSelector", "mozMatchesSelector", "msMatchesSelector", "oMatchesSelector" ],
			fn = null;
		var r = false;
		$.each( matchers, function( i, fn ) {
			if ( _w.isFunction( el[ fn ] ) ) {
				r = el[ fn ]( selector );
				return false;
			}
		} );
		return r;
	};
	var startsWith = function( str, starts ) {
		if ( starts === "" ) { return true; }
		if ( str === null || starts === null ) { return false; }
		str = String( str ); starts = String( starts );
		return str.length >= starts.length && str.slice( 0, starts.length ) === starts;
	};
	var endsWith = function( str, ends ) {
		if ( ends === "" ) { return true; }
		if ( str === null || ends === null ) { return false; }
		str = String( str ); ends = String( ends );
		return str.length >= ends.length && str.slice( str.length - ends.length, str.length ) === ends;
	};
	var cleanEmptyKeys = function( object ) {
		return _w.pick( object, _w.compact( _w.keys( object ) ) );
	};
	var filterStartingWith = function( object, string, type ) { // True: pick - false: omit
		var keys = _w.keys( object );
		keys.forEach( function( key ) {
			if ( type ) {
				if ( !startsWith( key, string ) ) { delete object[ key ]; }
			} else {
				if ( startsWith( key, string ) ) { delete object[ key ]; }
			}
		} );
		return object;
	};

	var selectNested = function( data, keys, type ) { // True: pick - false: omit
		// Flatten / unflatten to allow for nested picks / omits (doesn't work with regular pick)
		// ex:  data = {something:{nested:"value"}}
		//		keys = ['something.nested']
		var flat = _json.flatten( data );
		$.each( keys, function( i, key ) {
			flat = filterStartingWith( flat, key, type );
		} );
		var unflat = _json.unflatten( flat );
		// Unflatten returns an object with an empty property if it is given an empty object
		return cleanEmptyKeys( unflat );
	};

	var pickAndMergeParentArrays = function( object, selector ) {
		// Example:
		// object = { a: [1,2,3], a.b: [4,5,6], c: [7,8,9] }
		// fn(object, "a.b")
		// > [1,2,3,4,5,6]
		var keys = [];
		if ( selector ) {
			// Set bindings for the specified selector

			// (bindings that are repeat items)
			var split = selector.split( "." ),
					lastKey = split[ split.length - 1 ],
					isArrayItem = !isNaN( lastKey );

			if ( isArrayItem ) {
					split.pop();
					var key = split.join( "." );
					keys = object[ key ] ? _w.union( keys, object[ key ] ) : keys;
			}

			// (bindings with keys starting with, to include nested bindings)
			for ( var key in object ) {
				if ( !object.hasOwnProperty( key ) ) continue;
				if ( startsWith( key, selector ) ) { keys = _w.union( keys, object[ key ] ); }
			}

		} else {
			// Set bindings for all selectors
			for ( var key in object ) {
				if ( !object.hasOwnProperty( key ) ) continue;
				keys = _w.union( keys, object[ key ] );
			}
		}
		return keys;
	};

	var isPrintableKey = function( e ) {
		var keycode = e.keyCode;
		if ( !keycode ) { return true; }
		var valid =
			( keycode === 8 )					 || // Delete
			( keycode > 47 && keycode < 58 )   || // Number keys
			keycode === 32 || keycode === 13   || // Spacebar & return key(s) (if you want to allow carriage returns)
			( keycode > 64 && keycode < 91 )   || // Letter keys
			( keycode > 95 && keycode < 112 )  || // Numpad keys
			( keycode > 185 && keycode < 193 ) || // ;=,-./` (in order)
			( keycode > 218 && keycode < 223 );   // [\]' (in order)
		return valid;
	};

	var escapeHTML = function( str ) {
		return str && _w.isString( str ) ? str.replace( /&/g, "&amp;" ).replace( /</g, "&lt;" ).replace( />/g, "&gt;" ) : str;
	};

	// _w (strip of the required underscore methods)
	var _w = {};
	var
		slice            = Array.prototype.slice,
		concat           = Array.prototype.concat,
		toString         = Object.prototype.toString,
		hasOwnProperty   = Object.prototype.hasOwnProperty;

	var flatten = function( input, shallow, strict, output ) {
		if ( shallow && _w.every( input, _w.isArray ) ) {
			return concat.apply( output, input );
		}
		for ( var i = 0, length = input.length; i < length; i++ ) {
			var value = input[ i ];
			if ( !_w.isArray( value ) && !_w.isArguments( value ) ) {
				if ( !strict ) output.push( value );
			} else if ( shallow ) {
				Array.prototype.push.apply( output, value );
			} else {
				flatten( value, shallow, strict, output );
			}
		}
		return output;
	};
	var createCallback = function( func, context, argCount ) {
		if ( context === void 0 ) return func;
		switch ( argCount == null ? 3 : argCount ) {
			case 1: return function( value ) {
				return func.call( context, value );
			};
			case 2: return function( value, other ) {
				return func.call( context, value, other );
			};
			case 3: return function( value, index, collection ) {
				return func.call( context, value, index, collection );
			};
			case 4: return function( accumulator, value, index, collection ) {
				return func.call( context, accumulator, value, index, collection );
			};
		}
		return function() {
			return func.apply( context, arguments );
		};
	};

	_w.compact = function( array ) {
		return _w.filter( array, _w.identity );
	};

	_w.filter = function( obj, predicate, context ) {
		var results = [];
		if ( obj == null ) return results;
		predicate = _w.iteratee( predicate, context );
		_w.each( obj, function( value, index, list ) {
			if ( predicate( value, index, list ) ) results.push( value );
		} );
		return results;
	};

	_w.identity = function( value ) {
		return value;
	};

	_w.every = function( obj, predicate, context ) {
		if ( obj == null ) return true;
		predicate = _w.iteratee( predicate, context );
		var keys = obj.length !== +obj.length && _w.keys( obj ),
				length = ( keys || obj ).length,
				index, currentKey;
		for ( index = 0; index < length; index++ ) {
			currentKey = keys ? keys[ index ] : index;
			if ( !predicate( obj[ currentKey ], currentKey, obj ) ) return false;
		}
		return true;
	};

	_w.union = function() {
		return _w.uniq( flatten( arguments, true, true, [] ) );
	};

	_w.uniq = function( array, isSorted, iteratee, context ) {
		if ( array == null ) return [];
		if ( !_w.isBoolean( isSorted ) ) {
			context = iteratee;
			iteratee = isSorted;
			isSorted = false;
		}
		if ( iteratee != null ) iteratee = _w.iteratee( iteratee, context );
		var result = [];
		var seen = [];
		for ( var i = 0, length = array.length; i < length; i++ ) {
			var value = array[ i ];
			if ( isSorted ) {
				if ( !i || seen !== value ) result.push( value );
				seen = value;
			} else if ( iteratee ) {
				var computed = iteratee( value, i, array );
				if ( _w.indexOf( seen, computed ) < 0 ) {
					seen.push( computed );
					result.push( value );
				}
			} else if ( _w.indexOf( result, value ) < 0 ) {
				result.push( value );
			}
		}
		return result;
	};

	_w.pick = function( obj, iteratee, context ) {
		var result = {}, key;
		if ( obj == null ) return result;
		if ( _w.isFunction( iteratee ) ) {
			iteratee = createCallback( iteratee, context );
			for ( key in obj ) {
				if ( !obj.hasOwnProperty( key ) ) continue;
				var value = obj[ key ];
				if ( iteratee( value, key, obj ) ) result[ key ] = value;
			}
		} else {
			var keys = concat.apply( [], slice.call( arguments, 1 ) );
			obj = new Object( obj );
			for ( var i = 0, length = keys.length; i < length; i++ ) {
				key = keys[ i ];
				if ( key in obj ) result[ key ] = obj[ key ];
			}
		}
		return result;
	};

	_w.has = function( obj, key ) {
		return obj != null && hasOwnProperty.call( obj, key );
	};

	_w.keys = function( obj ) {
		if ( !_w.isObject( obj ) ) return [];
		if ( Object.keys ) return Object.keys( obj );
		var keys = [];
		for ( var key in obj ) if ( _w.has( obj, key ) ) keys.push( key );
		return keys;
	};

	_w.contains = function( obj, target ) {
		if ( obj == null ) return false;
		if ( obj.length !== +obj.length ) obj = _w.values( obj );
		return _w.indexOf( obj, target ) >= 0;
	};

	_w.sortedIndex = function( array, obj, iteratee, context ) {
		iteratee = _w.iteratee( iteratee, context, 1 );
		var value = iteratee( obj );
		var low = 0, high = array.length;
		while ( low < high ) {
			var mid = low + high >>> 1;
			if ( iteratee( array[ mid ] ) < value ) low = mid + 1; else high = mid;
		}
		return low;
	};

	_w.property = function( key ) {
		return function( obj ) {
			return obj[ key ];
		};
	};

	_w.iteratee = function( value, context, argCount ) {
		if ( value == null ) return _w.identity;
		if ( _w.isFunction( value ) ) return createCallback( value, context, argCount );
		if ( _w.isObject( value ) ) return _w.matches( value );
		return _w.property( value );
	};

	_w.pairs = function( obj ) {
		var keys = _w.keys( obj );
		var length = keys.length;
		var pairs = Array( length );
		for ( var i = 0; i < length; i++ ) {
			pairs[ i ] = [ keys[ i ], obj[ keys[ i ] ] ];
		}
		return pairs;
	};

	_w.matches = function( attrs ) {
		var pairs = _w.pairs( attrs ), length = pairs.length;
		return function( obj ) {
			if ( obj == null ) return !length;
			obj = new Object( obj );
			for ( var i = 0; i < length; i++ ) {
				var pair = pairs[ i ], key = pair[ 0 ];
				if ( pair[ 1 ] !== obj[ key ] || !( key in obj ) ) return false;
			}
			return true;
		};
	};

	_w.indexOf = function( array, item, isSorted ) {
		if ( array == null ) return -1;
		var i = 0, length = array.length;
		if ( isSorted ) {
			if ( typeof isSorted == "number" ) {
				i = isSorted < 0 ? Math.max( 0, length + isSorted ) : isSorted;
			} else {
				i = _w.sortedIndex( array, item );
				return array[ i ] === item ? i : -1;
			}
		}
		for ( ; i < length; i++ ) if ( array[ i ] === item ) return i;
		return -1;
	};

	_w.values = function( obj ) {
		var keys = _w.keys( obj );
		var length = keys.length;
		var values = Array( length );
		for ( var i = 0; i < length; i++ ) {
			values[ i ] = obj[ keys[ i ] ];
		}
		return values;
	};

	_w.extend = function( obj ) {
		if ( !_w.isObject( obj ) ) return obj;
		var source, prop;
		for ( var i = 1, length = arguments.length; i < length; i++ ) {
			source = arguments[ i ];
			for ( prop in source ) {
				if (hasOwnProperty.call( source, prop ) ) {
					obj[ prop ] = source[ prop ];
				}
			}
		}
		return obj;
	};

	_w.isArray = function( obj ) {
		return toString.call( obj ) === "[object Array]";
	};

	_w.isBoolean = function( obj ) {
		return obj === true || obj === false || toString.call( obj ) === "[object Boolean]";
	};

	_w.isUndefined = function( obj ) {
		return obj === void 0;
	};

	_w.isObject = function( obj ) {
		var type = typeof obj;
		return type === "function" || type === "object" && !!obj;
	};

	_w.each = function( obj, iteratee, context ) {
		if ( obj == null ) return obj;
		iteratee = createCallback( iteratee, context );
		var i, length = obj.length;
		if ( length === +length ) {
			for ( i = 0; i < length; i++ ) {
				iteratee( obj[ i ], i, obj );
			}
		} else {
			var keys = _w.keys( obj );
			for ( i = 0, length = keys.length; i < length; i++ ) {
				iteratee( obj[ keys[ i ] ], keys[ i ], obj );
			}
		}
		return obj;
	};

	_w.each( [ "Arguments", "Function", "String", "Number", "Date", "RegExp" ], function( name ) {
		_w[ "is" + name ] = function( obj ) {
			return toString.call( obj ) === "[object " + name + "]";
		};
	} );

	///////////////////////////////////////////////////////////
	// _json (strip of the required underscore.json methods) //
	///////////////////////////////////////////////////////////

	var deepJSON = function( obj, key, value, remove ) {

		var keys = key.replace( /\[(["']?)([^\1]+?)\1?\]/g, ".$2" ).replace( /^\./, "" ).split( "." ),
				root,
				i = 0,
				n = keys.length;

		// Set deep value
		if ( arguments.length > 2 ) {

			root = obj;
			n--;

			while ( i < n ) {
				key = keys[ i++ ];
				obj = obj[ key ] = _w.isObject( obj[ key ] ) ? obj[ key ] : {};
			}

			if ( remove ) {
				if ( _w.isArray( obj ) ) {
					obj.splice( keys[ i ], 1 );
				} else {
					delete obj[ keys[ i ] ];
				}
			} else {
				obj[ keys[ i ] ] = value;
			}

			value = root;

		// Get deep value
		} else {
			while ( ( obj = obj[ keys[ i++ ] ] ) != null && i < n ) {};
			value = i < n ? void 0 : obj;
		}

		return value;

	};

	var _json = {};

	_json.VERSION = "0.1.0";
	_json.debug = true;

	_json.exit = function( source, reason, data, value ) {

		if ( !_json.debug ) return;

		var messages = {};
		messages.noJSON = "Not a JSON";
		messages.noString = "Not a String";
		messages.noArray = "Not an Array";
		messages.missing = "Missing argument";

		var error = { source: source, data: data, value: value };
		error.message = messages[ reason ] ? messages[ reason ] : "No particular reason";
		console.log( "Error", error );
		return;

	};

	_json.is = function( json ) {

		return (toString.call( json ) == "[object Object]" );

	};

	_json.isStringified = function( string ) {

		var test = false;
		try {
			test = /^[\],:{}\s]*$/.test( string.replace( /\\["\\\/bfnrtu]/g, "@" ).
			replace( /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]" ).
			replace( /(?:^|:|,)(?:\s*\[)+/g, "" ) );
		} catch ( e ) {}
		return test;

	};

	_json.get = function( json, selector ) {

		if ( json == undefined ) return _json.exit( "get", "missing", "json", json );
		if ( selector == undefined ) return _json.exit( "get", "missing", "selector", selector );
		if ( !_w.isString( selector ) ) return _json.exit( "get", "noString", "selector", selector );
		return deepJSON( json, selector );

	};

	_json.set = function( json, selector, value ) {

		if ( json == undefined ) return _json.exit( "set", "missing", "json", json );
		if ( selector == undefined ) return _json.exit( "set", "missing", "selector", selector );
		if ( !_w.isString( selector ) ) return _json.exit( "set", "noString", "selector", selector );
		//Return value ? deepJSON(json, selector, value) : _json.remove(json, selector);
		 return deepJSON( json, selector, value ); // Now removes the property if the value is empty. Maybe should keep it instead? surikat answer: indeed

	};

	_json.remove = function( json, selector ) {

		if ( json == undefined ) return _json.exit( "remove", "missing", "json", json );
		if ( selector == undefined ) return _json.exit( "remove", "missing", "selector", selector );
		if ( !_w.isString( selector ) ) return _json.exit( "remove", "noString", "selector", selector );
		return deepJSON( json, selector, null, true );

	};

	_json.push = function( json, selector, value, force ) {

		if ( json == undefined ) return _json.exit( "push", "missing", "json", json );
		if ( selector == undefined ) return _json.exit( "push", "missing", "selector", selector );
		var array = _json.get( json, selector );
		if ( !_w.isArray( array ) ) {
			if ( force ) {
				array = [];
			} else {
				return _json.exit( "push", "noArray", "array", array );
			}
		}
		array.push( value );
		return _json.set( json, selector, array );

	};

	_json.unshift = function( json, selector, value ) {

		if ( json == undefined ) return _json.exit( "unshift", "missing", "json", json );
		if ( selector == undefined ) return _json.exit( "unshift", "missing", "selector", selector );
		if ( value == undefined ) return _json.exit( "unshift", "missing", "value", value );
		var array = _json.get( json, selector );
		if ( !_w.isArray( array ) ) return _json.exit( "unshift", "noArray", "array", array );
		array.unshift( value );
		return _json.set( json, selector, array );

	};

	_json.flatten = function( json ) {

		if ( json.constructor.name != "Object" ) return _json.exit( "flatten", "noJSON", "json", json );

		var result = {};
		function recurse ( cur, prop ) {
			if ( Object( cur ) !== cur ) {
				result[ prop ] = cur;
			} else if ( Array.isArray( cur ) ) {
				for ( var i = 0, l = cur.length; i < l; i++ ) {
					recurse( cur[ i ], prop ? prop + "." + i : "" + i );
					if ( l == 0 ) result[ prop ] = [];
				}
			} else {
				var isEmpty = true;
				for ( var p in cur ) {
					if ( !cur.hasOwnProperty( p ) ) continue;
					isEmpty = false;
					recurse( cur[ p ], prop ? prop + "." + p : p );
				}
				if ( isEmpty ) result[ prop ] = {};
			}
		}
		recurse( json, "" );
		return result;

	};

	_json.unflatten = function( data ) {

		if ( Object( data ) !== data || Array.isArray( data ) )
			return data;
		var result = {}, cur, prop, idx, last, temp;
		for ( var p in data ) {
			if ( !data.hasOwnProperty( p ) ) continue;
			cur = result, prop = "", last = 0;
			do {
				idx = p.indexOf( ".", last );
				temp = p.substring( last, idx !== -1 ? idx : undefined );
				cur = cur[ prop ] || ( cur[ prop ] = ( !isNaN( parseInt( temp ) ) ? [] : {} ) );
				prop = temp;
				last = idx + 1;
			} while ( idx >= 0 );
			cur[ prop ] = data[ p ];
		}
		return result[ "" ];

	};

	_json.prettyprint = function( json ) {

		return JSON.stringify( json, undefined, 2 );

	};

	// WATCH DOM EVENTS
	way = new WAY();
	var timeoutInput = null;
	var eventInputChange = function( e, param ) {
		if(param==='way-prevent-update') return;
		if ( timeoutInput ) { clearTimeout( timeoutInput ); }
		timeoutInput = setTimeout( function() {
			var element = $( e.target ).get( 0 );
			way.dom( element ).toStorage();
			$(element).trigger('change:model');
		}, way.options.timeout );
	};
	var eventClear = function( e ) {
		e.preventDefault();
		var options = way.dom( this ).getOptions();
		way.remove( options.data, options );
	};
	var eventPush = function( e ) {
		e.preventDefault();
		var options = way.dom( this ).getOptions();
		if ( !options || !options[ "action-push" ] ) { return false; }
		var split = options[ "action-push" ].split( ":" ),
				selector = split[ 0 ] || null,
				value = split[ 1 ] || null;
		way.push( selector, value, options );
	};
	var eventRemove = function( e ) {
		e.preventDefault();
		var options = way.dom( this ).getOptions();
		if ( !options || !options[ "action-remove" ] ) { return false; }
		way.remove( options[ "action-remove" ], options );
	};

	var timeoutDOM = null;
	var eventDOMChange = function(mutations) {		
		// We need to register dynamically added bindings so we do it by watching DOM changes
		// We use a timeout since "DOMSubtreeModified" gets triggered on every change in the DOM (even input value changes)
		// so we can limit the number of scans when a user is typing something
		if ( timeoutDOM ) { clearTimeout( timeoutDOM ); }
		timeoutDOM = setTimeout( function() {
			
			console.log('eventDOMChange');
			
			//way.setDefaults();
			
			way.updateForms();
			way.registerRepeats();
			way.registerBindings();
			
			way.updateBindings();
			//way.updateRepeats();

		}, way.options.timeoutDOM );

	};

	var setEventListeners = function() {
		
		var observer;
		if (typeof MutationObserver !== 'undefined'){
			observer = new MutationObserver(eventDOMChange);
		}
		else if (typeof WebKitMutationObserver !== 'undefined'){
			observer = new WebKitMutationObserver(eventDOMChange);
		}
		if (observer) {
			observer.observe(document.body, { subtree: true, childList: true, attribute: false, characterData: true });
		}
		else {
			document.body.bind('DOMSubtreeModified', eventDOMChange);
		}
		
		$(document.body).on("input change val", "["+tagPrefix+"-data]",eventInputChange);
		$(document.body).on("click","["+tagPrefix+"-clear]",eventClear);
		$(document.body).on("click","["+tagPrefix+"-action-remove]",eventRemove);
		$(document.body).on("click","["+tagPrefix+"-action-push]",eventPush);
	};

	setEventListeners();
	eventDOMChange();
	
	return way;
} )();