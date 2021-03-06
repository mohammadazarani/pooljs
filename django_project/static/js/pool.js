(function (context) {
	if(window && "WebSocket" in window) {

		if(typeof(Worker) !== "undefined") {
			function createWorker(foo) {
				var str = foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1];
				return new Worker(window.URL.createObjectURL(new Blob([str],{type:'text/javascript'})));
			}
			var workerPool = [];
			function fillPool() {
				while(workerPool.length < navigator.hardwareConcurrency) {
					var worker = createWorker(function(){
						var self = this;
						this.addEventListener("message", function(event) {
							var subprocess = event.data;
							var src = "var fn = " + subprocess.code;
							eval(src);
							self.postMessage(fn.apply(this, subprocess.args));
						}, false);
					});
					workerPool.push(worker);
				}
			}
			function resetPool() {
				for(var i=0;i<workerPool.length;i++){
					workerPool[i].terminate();
				}
				workerPool = [];
				fillPool();
			}
			var local_counter = 0;
			function balance(subprocess,callback) {
				var w = workerPool[local_counter % workerPool.length];
				w.onmessage = function(event){callback(event.data,false);};
				w.postMessage(subprocess);
				local_counter++;
			}
		}

		var WEBSOCKET_HOST = "pooljs.ir";
		var WEBSOCKET_PORT = 21212;
		var WEBSOCKET_ADDRESS = "wss://" + WEBSOCKET_HOST + ":" + WEBSOCKET_PORT;

		var subprocessCounter = 0; /* A counter as a generator for SubProcess ids */
		var sock = new WebSocket(WEBSOCKET_ADDRESS);
		var listeners = [];

		context.pool = {
			run: function(func, args = [], local = false) {
				if(!local) {
					var id = subprocessCounter++;
					var message = { type: "run",
													args: args,
													code: func.toString(),
													id: id };
					return { result: function(callback) { listeners[id] = callback; sock.send(JSON.stringify(message)); } };
				} else {
					resetPool();
					var message = { args: args,
													code: func.toString() };
					return { result: function(callback) { balance(message,callback); } };
				}
			},
			for: function(start, end, func, extraArgs = [], local = false) {
				if(!local) {
					var id = subprocessCounter++;
					var message = { type: "for",
													start: start,
													end: end,
													code: func.toString(),
													extraArgs: extraArgs,
													id: id };
					return { result: function(callback) { listeners[id] = callback; sock.send(JSON.stringify(message)); } };
				} else {
					resetPool();
					return { result: function(callback) {
						for(var i = start; i < end; i++) {
							var message = { args: [i].concat(extraArgs),
															code: func.toString() };
							balance(message,callback);
						}
					} };
				}
			},
			forEach: function(argsList, func, extraArgs = [], local = false) {
				if(!local) {
					var id = subprocessCounter++;
					var message = { type:"forEach",
													argsList:argsList,
													code:func.toString(),
													extraArgs:extraArgs,
													id:id };
					return { result: function(callback) { listeners[id] = callback; sock.send(JSON.stringify(message)); } };
				} else {
					resetPool();
					return { result: function(callback) {
						for(var i = 0; i < argsList.length; i++) {
							var message = { args: [argsList[i]].concat(extraArgs),
															code: func.toString() };
							balance(message,callback);
						}
					} };
				}
			},
			forGPU: function(start, end, glsl, extraArgs = [], local = false) {
				if(!local) {
					var id = subprocessCounter++;
					var message = { type: "forGPU",
													start: start,
													end: end,
													code: glsl,
													id: id };
					return { result: function(callback) { listeners[id] = callback; sock.send(JSON.stringify(message)); } };
				} else {
					alert("Local forGPU not implemented yet!")
				}
			},
			setBufferSize: function(size) {
				var message = { type: "set",
												property: "bufferSize",
												value: size };
				sock.send(JSON.stringify(message));
			},
			flush: function() {
				var message = { type: "flush" };
				sock.send(JSON.stringify(message));
			},
			info: function() {
				var message = { type: "info" };
				sock.send(JSON.stringify(message));
			},
			resetLocal: function() {
				resetPool();
			}
		}

		sock.onopen = function() {
			if("onopen" in context.pool) {
				context.pool.onopen();
			}
		};

		sock.onmessage = function(event) {
			var msg = JSON.parse(event.data);

			if(msg.type == "result") {
				if(msg.error && msg.results[0][1] in listeners)
					listeners[msg.results[0][1]](msg.results[0][0], true);
				else {
					for(var i=0; i < msg.results.length; i++)
						if(msg.results[i][1] in listeners)
							listeners[msg.results[i][1]](msg.results[i][0], false);
				}
			}

			else if(msg.type == "info") {
				if("oninfo" in context.pool) {
					context.pool.oninfo(msg.processorsCount, msg.subprocessesCount);
				}
			}

			else if(msg.type == "limit") {
				if("onlimit" in context.pool) {
					context.pool.onlimit(msg.remaining,msg.count,msg.countLimit);
				}
			}

			else if(msg.type == "busy") {
				if("onbusy" in context.pool) {
					context.pool.onbusy();
				}
			}
		};

		sock.onclose = function() {
		};

	}
}(this));
