(function (context){
	
	var WEBSOCKET_HOST = "127.0.0.1";
	var WEBSOCKET_PORT = 12121;
	var WEBSOCKET_ADDRESS = "ws://" + WEBSOCKET_HOST + ":" + WEBSOCKET_PORT;
	
	if(window && "WebSocket" in window && typeof(Worker) !== "undefined") {
		function createWorker(foo){
			var str = foo.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1];
			return new Worker(window.URL.createObjectURL(new Blob([str],{type:'text/javascript'})));
		}
		
		var workerPool = [];
		for(var i = 0; i < navigator.hardwareConcurrency; i++){
			var worker = createWorker(function(){
				var self = this;
				this.addEventListener("message", function(event) {
					var task = event.data;
					var src = "var fn = " + task.code;
					eval(src);
					var task_result = {"id":task.id,"result":fn()};
					self.postMessage(task_result);
				}, false);
			});
			workerPool.push(worker);
		}
		
		
		
		var sock = new WebSocket(WEBSOCKET_ADDRESS);
		
		function response(event){
			var task_result = event.data;
			sock.send(JSON.stringify(task_result));
		}
		
		function balance(task){
			var w = workerPool[Math.floor(Math.random()*workerPool.length)];
			w.onmessage = response;
			w.postMessage(task);
		}
		
		context.worker = {}
		
		sock.onopen = function(){
		};
		sock.onmessage = function(event){
			var task = JSON.parse(event.data);
			if(context.worker.onnewjob)
				context.worker.onnewjob(task);
			balance(task);
		};
		sock.onclose = function(){
		};
		
		
		
	} else {
		alert("Your browser doesn't support Raisin!");
	}
}(this));
