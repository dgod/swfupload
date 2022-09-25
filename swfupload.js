if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, 'find', {
    value: function(predicate) {
     // 1. Let O be ? ToObject(this value).
      if (this == null) {
        throw new TypeError('"this" is null or not defined');
      }

      var o = Object(this);

      // 2. Let len be ? ToLength(? Get(O, "length")).
      var len = o.length >>> 0;

      // 3. If IsCallable(predicate) is false, throw a TypeError exception.
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      // 4. If thisArg was supplied, let T be thisArg; else let T be undefined.
      var thisArg = arguments[1];

      // 5. Let k be 0.
      var k = 0;

      // 6. Repeat, while k < len
      while (k < len) {
        // a. Let Pk be ! ToString(k).
        // b. Let kValue be ? Get(O, Pk).
        // c. Let testResult be ToBoolean(? Call(predicate, T, « kValue, k, O »)).
        // d. If testResult is true, return kValue.
        var kValue = o[k];
        if (predicate.call(thisArg, kValue, k, o)) {
          return kValue;
        }
        // e. Increase k by 1.
        k++;
      }

      // 7. Return undefined.
      return undefined;
    },
    configurable: true,
    writable: true
  });
}


var SWFUpload;

if (SWFUpload == undefined) {
	SWFUpload = function (settings) {
		this.initSWFUpload(settings);
	};
}

SWFUpload.instances = {};
SWFUpload.movieCount = 0;
SWFUpload.version = "1.0.0";

SWFUpload.QUEUE_ERROR = {
	QUEUE_LIMIT_EXCEEDED	  		: -100,
	FILE_EXCEEDS_SIZE_LIMIT  		: -110,
	ZERO_BYTE_FILE			  		: -120,
	INVALID_FILETYPE		  		: -130
};
SWFUpload.UPLOAD_ERROR = {
	HTTP_ERROR				  		: -200,
	MISSING_UPLOAD_URL	      		: -210,
	IO_ERROR				  		: -220,
	SECURITY_ERROR			  		: -230,
	UPLOAD_LIMIT_EXCEEDED	  		: -240,
	UPLOAD_FAILED			  		: -250,
	SPECIFIED_FILE_ID_NOT_FOUND		: -260,
	FILE_VALIDATION_FAILED	  		: -270,
	FILE_CANCELLED			  		: -280,
	UPLOAD_STOPPED					: -290
};
SWFUpload.FILE_STATUS = {
	QUEUED		 : -1,
	IN_PROGRESS	 : -2,
	ERROR		 : -3,
	COMPLETE	 : -4,
	CANCELLED	 : -5
};
SWFUpload.BUTTON_ACTION = {
	SELECT_FILE  : -100,
	SELECT_FILES : -110,
	START_UPLOAD : -120
};
SWFUpload.CURSOR = {
	ARROW : -1,
	HAND : -2
};
SWFUpload.WINDOW_MODE = {
	WINDOW : "window",
	TRANSPARENT : "transparent",
	OPAQUE : "opaque"
};

SWFUpload.prototype.initSWFUpload = function (settings) {
	this.customSettings = {};
	this.settings = settings;
	this.eventQueue = [];
	this.movieName = "SWFUpload_" + SWFUpload.movieCount++;
	this.movieElement = null;
	this.fileQueue=[];
	this.fileID=10000;
	this.stats={
		in_progress:0,
		files_queued:0,
		successful_uploads:0,
		upload_errors:0,
		upload_cancelled:0,
		queue_errors:0
	};
	SWFUpload.instances[this.movieName] = this;
	this.initSettings();
	try{
		this.loadFlash();
	}catch(ex){
		delete SWFUpload.instances[this.movieName];
		throw ex;
	}
};

SWFUpload.completeURL = function(url) {
	if (typeof(url) !== "string" || url.match(/^https?:\/\//i) || url.match(/^\//)) {
		return url;
	}
	var currentURL = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":" + window.location.port : "");
	var indexSlash = window.location.pathname.lastIndexOf("/");
	var path;
	if (indexSlash <= 0) {
		path = "/";
	} else {
		path = window.location.pathname.substr(0, indexSlash) + "/";
	}
	
	return path + url;
};

SWFUpload.prototype.initSettings = function () {
	this.ensureDefault = function (settingName, defaultValue) {
		this.settings[settingName] = (this.settings[settingName] == undefined) ? defaultValue : this.settings[settingName];
	};
	// Upload backend settings
	this.ensureDefault("upload_url", "");
	this.ensureDefault("preserve_relative_urls", false);
	this.ensureDefault("file_post_name", "Filedata");
	this.ensureDefault("post_params", {});
	this.ensureDefault("use_query_string", false);
	this.ensureDefault("requeue_on_error", false);
	this.ensureDefault("http_success", []);
	this.ensureDefault("assume_success_timeout", 0);

	// File Settings
	this.ensureDefault("file_types", "*.*");
	this.ensureDefault("file_types_description", "All Files");
	this.ensureDefault("file_size_limit", 0);	// Default zero means "unlimited"
	this.ensureDefault("file_upload_limit", 0);
	this.ensureDefault("file_queue_limit", 0);
	
	// Button Settings
	this.ensureDefault("button_image_url", "");
	this.ensureDefault("button_width", 1);
	this.ensureDefault("button_height", 1);
	this.ensureDefault("button_text", "批量上传");
	this.ensureDefault("button_text_style", "color: #000000; font-size: 12px;");
	this.ensureDefault("button_text_top_padding", 0);
	this.ensureDefault("button_text_left_padding", 0);
	this.ensureDefault("button_action", SWFUpload.BUTTON_ACTION.SELECT_FILES);
	this.ensureDefault("button_disabled", false);
	this.ensureDefault("button_placeholder_id", "");
	this.ensureDefault("button_placeholder", null);
	this.ensureDefault("button_cursor", SWFUpload.CURSOR.ARROW);
	
	// Event Handlers
	this.settings.return_upload_start_handler = this.returnUploadStart;
	this.ensureDefault("swfupload_loaded_handler", null);
	this.ensureDefault("file_dialog_start_handler", null);
	this.ensureDefault("file_queued_handler", null);
	this.ensureDefault("file_queue_error_handler", null);
	this.ensureDefault("file_dialog_complete_handler", null);
	
	this.ensureDefault("upload_start_handler", null);
	this.ensureDefault("upload_progress_handler", null);
	this.ensureDefault("upload_error_handler", null);
	this.ensureDefault("upload_success_handler", null);
	this.ensureDefault("upload_complete_handler", null);
	
	this.ensureDefault("debug_handler", this.debugMessage);

	this.ensureDefault("custom_settings", {});

	// Other settings
	this.customSettings = this.settings.custom_settings;
	
	if (!this.settings.preserve_relative_urls) {
		this.settings.upload_url = SWFUpload.completeURL(this.settings.upload_url);
		this.settings.button_image_url = SWFUpload.completeURL(this.settings.button_image_url);
	}
	
	delete this.ensureDefault;
};

SWFUpload.prototype.loadFlash = function () {
	var targetElement, tempParent;
	if (document.getElementById(this.movieName) !== null) {
		throw "ID " + this.movieName + " is already in use. The Flash Object could not be added";
	}
	// Get the element where we will be placing the flash movie
	targetElement = document.getElementById(this.settings.button_placeholder_id) || this.settings.button_placeholder;
	if (targetElement == undefined) {
		throw "Could not find the placeholder element: " + this.settings.button_placeholder_id;
	}
	targetElement.insertAdjacentHTML("afterend",this.getFlashHTML());
	targetElement.parentNode.removeChild(targetElement);

	if (window[this.movieName] == undefined) {
		window[this.movieName] = this.getMovieElement();
	}
	
	var el=this.getMovieElement();
	el.disabled=this.settings.button_disabled;
	var fl=el.nextElementSibling;
	el.onclick=function(e){
		switch(this.settings.button_action){
			case SWFUpload.BUTTON_ACTION.SELECT_FILE:
				this.selectFile();
				break;
			case SWFUpload.BUTTON_ACTION .SELECT_FILES:
				this.selectFiles();
				break;
			case SWFUpload.BUTTON_ACTION.START_UPLOAD:
				this.startUpload();
				break;
		}
	}.bind(this);
	fl.onchange=function(e){
		this.addFiles(e.target.files);
	}.bind(this);
	this.flashReady();
};

SWFUpload.prototype.addFiles=function(files){
	var numFilesQueued=0;
	for(var i=0;i<files.length;i++){
		if(this.settings.file_upload_limit && this.stats.successful_uploads+this.fileQueue.length>=this.settings.file_upload_limit)
			break;
		if(this.settings.file_queue_limit && this.fileQueue.length>this.settings.file_queue_limit)
			break;
		var f=files[i];
		if(this.settings.file_size_limit && f.size>this.settings.file_size_limit)
			continue;
		if(this.checkFileType(f.name)!=true)
			continue;
		var t={
			file : f,
			size:f.size,
			name:f.name,
			params:[],
			id:this.fileID++,
			xhr:null,
			filestatus:SWFUpload.FILE_STATUS.QUEUED,
			type:f.type,
			index:this.fileQueue.length
		};
		this.fileQueue.push(t);
		numFilesQueued++;
		this.fileQueued(t);
	}
	this.updateStats();
	this.fileDialogComplete(files.length, numFilesQueued, this.fileQueue.length) ;
};

SWFUpload.prototype.checkFileType=function(name){
	if(this.settings.file_types=='*.*')
		return true;
	var arr=this.settings.file_types.split(';').map(function(e){
		return e.replace('*','')
	});
	return arr.find(function(e){
		return name.indexOf(e)>0;
	})?true:false;
};

SWFUpload.prototype.getFlashHTML = function () {
	var style='';
	style+='width:'+this.settings.button_width+'px;';
	style+='height:'+this.settings.button_height+'px;';
	style+='padding: '+this.settings.button_text_top_padding+'px '+this.settings.button_text_lef_padding+'px;';
	style+='cursor:'+(this.settings.button_cursor==-1?"auto":"pointer")+';';
	style+=this.settings.button_text_style;
	var s='<button type="button" id="'+this.movieName+'" style="'+style+'">'+this.settings.button_text+'</button>';

	s+='<input type="file" style="display:none">';
	return s;
};

SWFUpload.prototype.getMovieElement = function () {
	if (this.movieElement == undefined) {
		this.movieElement = document.getElementById(this.movieName);
	}
	if (this.movieElement === null) {
		throw "Could not find Flash element";
	}
	
	return this.movieElement;
};

SWFUpload.prototype.destroy = function () {
	try{
		this.cancelUpload(null, false);
		var movieElement = null;
		movieElement = this.getMovieElement();
		if (movieElement){
			try {
				movieElement.parentNode.removeChild(movieElement);
			} catch (ex) {}
		}
		window[this.movieName] = null;
		SWFUpload.instances[this.movieName] = null;
		delete SWFUpload.instances[this.movieName];
		this.movieElement = null;
		this.settings = null;
		this.customSettings = null;
		this.eventQueue = null;
		this.movieName = null;
	}catch(ex){
		return false;
	}
};

SWFUpload.prototype.addSetting = function (name, value, default_value) {
    if (value == undefined) {
        return (this.settings[name] = default_value);
    } else {
        return (this.settings[name] = value);
	}
};

SWFUpload.prototype.getSetting = function (name) {
    if (this.settings[name] != undefined) {
        return this.settings[name];
	}

    return "";
};

SWFUpload.prototype.selectFile = function () {
	var el=this.getMovieElement();
	var fl=el.nextElementSibling;
	fl.multiple=false;
	this.fileDialogStart();
	fl.click();
};

SWFUpload.prototype.selectFiles = function () {
	var el=this.getMovieElement();
	var fl=el.nextElementSibling;
	fl.multiple=true;
	this.fileDialogStart();
	fl.click();
};

SWFUpload.prototype.startUpload = function (fileID) {
	if(fileID)
		var f=this.fileQueue.find(function(f){
			return f.id==fileID
		});
	else
		var f=this.fileQueue.find(function(f){
			return f.filestatus==SWFUpload.FILE_STATUS.QUEUED
		});
	if(!f){
		this.uploadError(null,SWFUpload.UPLOAD_ERROR.SPECIFIED_FILE_ID_NOT_FOUND,"文件不存在");
		return;
	}
	if(f.xhr!=null){
		return;
	}
	if(!this.settings.upload_url){
		this.uploadError(f,SWFUpload.UPLOAD_ERROR.MISSING_UPLOAD_URL,"");
		return;
	}
	var url=this.settings.upload_url;
	if(this.settings.use_query_string){
		var params=new URLSearchParams();
		if(this.settings.post_params) for(var k in this.settings.post_params){
			params.append(k, this.settings.post_params[k]);
		}
		if(f.params) for(var k in f.params){
			params.append(k, f.params[k]);
		}
		var query=params.toString();
		if(query){
			if(url.indexOf('?')>0)
				url+='&'+query;
			else
				url+='?'+query;
		}
	}
	f.filestatus=SWFUpload.UPLOAD_IN_PROGRESS;
	f.xhr=new XMLHttpRequest();
	f.xhr.open('POST',url);
	f.xhr.responseType='text';
	f.xhr.open('POST',this.settings.upload_url);
	f.xhr.onerror=function(e){
		f.xhr=null;
		if(f.filestatus!=SWFUpload.FILE_STATUS.ERROR){
			if(this.settings.requeue_on_error)
				f.filestatus=SWFUpload.FILE_STATUS.QUEUED;
			else
				f.filestatus=SWFUpload.FILE_STATUS.ERROR;
			this.updateStats();
			this.uploadError(null,SWFUpload.UPLOAD_ERROR.UPLOAD_FAILED,"");
		}else{
			this.updateStats();
		}
	}.bind(this);
	f.xhr.onload=function(e){
		f.xhr=null;
		f.filestatus=SWFUpload.FILE_STATUS.COMPLETE;
		this.updateStats();
		this.uploadSuccess(f,e.target.responseText,e.target.statusCode);
		this.uploadComplete(f);
	}.bind(this);
	f.xhr.upload.onprogress=function(e){
		this.uploadProgress(f,e.loaded,e.total);
	}.bind(this);
	var form=new FormData();
	if(!this.use_query_string){
		if(this.settings.post_params) for(var k in this.settings.post_params){
			form.append(k, this.settings.post_params[k]);
		}
		if(f.params) for(var k in f.params){
			params.append(k, f.params[k]);
		}
	}
	form.append(this.settings.file_post_name,f.file,f.file.name);
	f.xhr.send(form);
	this.updateStats();
	this.uploadStart();
};

SWFUpload.prototype.cancelUpload = function (fileID, triggerErrorEvent) {
	if (triggerErrorEvent !== false) {
		triggerErrorEvent = true;
	}
	var f=this.getFile(fileID);
	if(!f){
		if(triggerErrorEvent)
			this.uploadError(null,SWFUpload.UPLOAD_ERROR.SPECIFIED_FILE_ID_NOT_FOUND,"文件不存在");
		return;
	}
	if(!f.xhr){
		return;
	}
	f.filestatus=SWFUpload.FILE_STATUS.ERROR;
	f.xhr.abort();
	this.stats.upload_cancelled++;
	if(triggerErrorEvent)
		this.uploadError(f,SWFUpload.UPLOAD_ERROR.FILE_CANCELLED,"");
};

SWFUpload.prototype.stopUpload = function () {
	for(var i=0;i<this.fileQueue.length;i++){
		var f=this.fileQueue[i];
		if(f.filestatus!=SWFUpload.FILE_STATUS.IN_PROGRESS)
			continue;
		f.filestatus=SWFUpload.FILE_STATUS.ERROR;
		if(f.xhr)
			f.xhr.abort();
		this.uploadError(f,SWFUpload.UPLOAD_ERROR.FILE_STOPPED,"");
	}
};

SWFUpload.prototype.getStats = function () {
	return JSON.parse(JSON.stringify(this.stats));
};

SWFUpload.prototype.setStats = function (statsObject) {
	Object.assign(this.stats,statsObject);
};

SWFUpload.prototype.getFile = function (fileID) {
	if(!fileID)
		return this.fileQueue[0];
	if(fileID<10000)
		return this.fileQueue[fileID];
	for(var i=0;i<this.fileQueue.length;i++){
		var p=this.fileQueue[i];
		if(p.id==fileID)
			return p;
	}
};

SWFUpload.prototype.addFileParam = function (fileID, name, value) {
	var p=this.getFile(fileID);
	if(!p)
		return;
	if(!p.params)
		p.params={};
	p.params[name]=value;
};

SWFUpload.prototype.removeFileParam = function (fileID, name) {
	if(!name)
		return;
	var p=this.getFile(fileID);
	if(!p)
		return;
	if(!p.params)
		return;
	delete p.params[name];
};

SWFUpload.prototype.setUploadURL = function (url) {
	this.settings.upload_url = url.toString();
};

SWFUpload.prototype.setPostParams = function (paramsObject) {
	this.settings.post_params = paramsObject;
};

SWFUpload.prototype.addPostParam = function (name, value) {
	this.settings.post_params[name] = value;
};

SWFUpload.prototype.removePostParam = function (name) {
	delete this.settings.post_params[name];
};

SWFUpload.prototype.setFileTypes = function (types, description) {
	this.settings.file_types = types;
	this.settings.file_types_description = description;
};

SWFUpload.prototype.setFileSizeLimit = function (fileSizeLimit) {
	this.settings.file_size_limit = fileSizeLimit;
};

SWFUpload.prototype.setFileUploadLimit = function (fileUploadLimit) {
	this.settings.file_upload_limit = fileUploadLimit;
};

SWFUpload.prototype.setFileQueueLimit = function (fileQueueLimit) {
	this.settings.file_queue_limit = fileQueueLimit;
};

SWFUpload.prototype.setFilePostName = function (filePostName) {
	this.settings.file_post_name = filePostName;
};

SWFUpload.prototype.setUseQueryString = function (useQueryString) {
	this.settings.use_query_string = useQueryString;
};

SWFUpload.prototype.setRequeueOnError = function (requeueOnError) {
	this.settings.requeue_on_error = requeueOnError;
};

SWFUpload.prototype.setHTTPSuccess = function (http_status_codes) {
	if (typeof http_status_codes === "string") {
		http_status_codes = http_status_codes.replace(" ", "").split(",");
	}
	
	this.settings.http_success = http_status_codes;
};

SWFUpload.prototype.setAssumeSuccessTimeout = function (timeout_seconds) {
	this.settings.assume_success_timeout = timeout_seconds;
};

SWFUpload.prototype.setDebugEnabled = function (debugEnabled) {
	this.settings.debug_enabled = debugEnabled;
};

SWFUpload.prototype.setButtonDimensions = function (width, height) {
	this.settings.button_width = width;
	this.settings.button_height = height;
	
	var movie = this.getMovieElement();
	if (movie != undefined) {
		movie.style.width = width + "px";
		movie.style.height = height + "px";
	}
};

SWFUpload.prototype.setButtonText = function (html) {
	this.settings.button_text = html;
	var movie = this.getMovieElement();
	if (movie != undefined) {
		movie.innerHTML=html;
	}
};

SWFUpload.prototype.setButtonTextPadding = function (left, top) {
	this.settings.button_text_top_padding = top;
	this.settings.button_text_left_padding = left;
	var movie = this.getMovieElement();
	if (movie != undefined) {
		movie.style.padding=top+'px '+left+'px';
	}
};

SWFUpload.prototype.setButtonTextStyle = function (css) {
	this.settings.button_text_style = css;
	var movie = this.getMovieElement();
	if (movie != undefined) {
		movie.style.cssText+=css;
	}
};

SWFUpload.prototype.setButtonDisabled = function (isDisabled) {
	this.settings.button_disabled = isDisabled;
	var movie = this.getMovieElement();
	if (movie != undefined) {
		movie.disabled=isDisabled;
	}
};

SWFUpload.prototype.setButtonAction = function (buttonAction) {
	this.settings.button_action = buttonAction;
};

SWFUpload.prototype.setButtonCursor = function (cursor) {
	this.settings.button_cursor = cursor;
	var movie = this.getMovieElement();
	if (movie != undefined) {
		if(cursor==SWFUpload.CURSOR.ARROW)
			movie.style.cursor="auto";
		else
			movie.style.cursor="pointer";
	}
};

SWFUpload.prototype.queueEvent = function (handlerName, argumentArray) {
	if (argumentArray == undefined) {
		argumentArray = [];
	} else if (!(argumentArray instanceof Array)) {
		argumentArray = [argumentArray];
	}
	var self = this;
	if (typeof this.settings[handlerName] === "function") {
		// Queue the event
		this.eventQueue.push(function () {
			this.settings[handlerName].apply(this, argumentArray);
		});
		
		// Execute the next queued event
		setTimeout(function () {
			self.executeNextEvent();
		}, 0);
		
	} else if (this.settings[handlerName] !== null) {
		throw "Event handler " + handlerName + " is unknown or is not a function";
	}
};

SWFUpload.prototype.executeNextEvent = function () {
	var  f = this.eventQueue ? this.eventQueue.shift() : null;
	if (typeof(f) === "function") {
		f.apply(this);
	}
};

SWFUpload.prototype.flashReady = function () {
	this.queueEvent("swfupload_loaded_handler");
};

SWFUpload.prototype.fileDialogStart = function () {
	this.queueEvent("file_dialog_start_handler");
};

SWFUpload.prototype.fileQueued = function (file) {
	this.updateStats();
	this.queueEvent("file_queued_handler", file);
};

SWFUpload.prototype.fileQueueError = function (file, errorCode, message) {
	this.queueEvent("file_queue_error_handler", [file, errorCode, message]);
};

SWFUpload.prototype.fileDialogComplete = function (numFilesSelected, numFilesQueued, numFilesInQueue) {
	this.queueEvent("file_dialog_complete_handler", [numFilesSelected, numFilesQueued, numFilesInQueue]);
};

SWFUpload.prototype.uploadStart = function (file) {
	this.queueEvent("return_upload_start_handler", file);
};


SWFUpload.prototype.returnUploadStart = function (file) {
	var returnValue;
	if (typeof this.settings.upload_start_handler === "function") {
		returnValue = this.settings.upload_start_handler.call(this, file);
	} else if (this.settings.upload_start_handler != undefined) {
		throw "upload_start_handler must be a function";
	}

	// Convert undefined to true so if nothing is returned from the upload_start_handler it is
	// interpretted as 'true'.
	if (returnValue === undefined) {
		returnValue = true;
	}
	
	returnValue = !!returnValue;
	
	return returnValue;
};

SWFUpload.prototype.updateStats=function(){
	this.stats.files_queued=this.fileQueue.reduce(function(a,c){
		if(c.filesatus==SWFUpload.FILE_STATUS.QUEUED)
			return a+1;
	},0);
	this.stats.files_errors=this.fileQueue.reduce(function(a,c){
		if(c.filesatus==SWFUpload.FILE_STATUS.ERROR)
			return a+1;
	},0);
	for(var i=0;i<this.fileQueue.length;i++){
		var f=this.fileQueue[i];
		if(f.filestatus==SWFUpload.FILE_STATUS.IN_PROGRESS){
			this.stats.in_progress=1;
			break;
		}
	}
};

SWFUpload.prototype.uploadProgress = function (file, bytesComplete, bytesTotal) {
	this.queueEvent("upload_progress_handler", [file, bytesComplete, bytesTotal]);
};

SWFUpload.prototype.uploadError = function (file, errorCode, message) {
	this.queueEvent("upload_error_handler", [file, errorCode, message]);
};

SWFUpload.prototype.uploadSuccess = function (file, serverData, responseReceived) {
	this.stats.successful_uploads++;
	this.queueEvent("upload_success_handler", [file, serverData, responseReceived]);
};

SWFUpload.prototype.uploadComplete = function (file) {
	this.queueEvent("upload_complete_handler", file);
};

SWFUpload.prototype.debug = function (message) {
	this.queueEvent("debug_handler", message);
};

SWFUpload.prototype.debugMessage = function (message) {
	if (this.settings.debug) {
		var exceptionMessage, exceptionValues = [];

		// Check for an exception object and print it nicely
		if (typeof message === "object" && typeof message.name === "string" && typeof message.message === "string") {
			for (var key in message) {
				if (message.hasOwnProperty(key)) {
					exceptionValues.push(key + ": " + message[key]);
				}
			}
			exceptionMessage = exceptionValues.join("\n") || "";
			exceptionValues = exceptionMessage.split("\n");
			exceptionMessage = "EXCEPTION: " + exceptionValues.join("\nEXCEPTION: ");
			SWFUpload.Console.writeLine(exceptionMessage);
		} else {
			SWFUpload.Console.writeLine(message);
		}
	}
};


SWFUpload.Console = {};
SWFUpload.Console.writeLine = function (message) {
	var console, documentForm;

	try {
		console = document.getElementById("SWFUpload_Console");

		if (!console) {
			documentForm = document.createElement("form");
			document.getElementsByTagName("body")[0].appendChild(documentForm);

			console = document.createElement("textarea");
			console.id = "SWFUpload_Console";
			console.style.fontFamily = "monospace";
			console.setAttribute("wrap", "off");
			console.wrap = "off";
			console.style.overflow = "auto";
			console.style.width = "700px";
			console.style.height = "350px";
			console.style.margin = "5px";
			documentForm.appendChild(console);
		}

		console.value += message + "\n";

		console.scrollTop = console.scrollHeight - console.clientHeight;
	} catch (ex) {
		alert("Exception: " + ex.name + " Message: " + ex.message);
	}
};
