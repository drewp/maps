function FirstAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

var Mode = Class.create({
    id: "",
    initialize: function(assistant) {
	this.assistant = assistant;
    },
    enter: function () {

    },
    exit: function () {

    }
});

var GetPositionMode = Class.create(Mode, {
    id: "getPosition",
    enter: function($super) {
	$super();

	var prefs = getPrefs();

	if (0) {
	    this.assistant.status("use fake position");
	    var this2 = this;
	    setTimeout(function () {
		this2.gpsSuccess({'alt':500, latitude:37.12345678, longitude:-122.12345678, errorCode: 0, timestamp: 0});
	    }, 1000);
	} else {
	    this.assistant.status("request position...");
	    this.assistant.controller.serviceRequest('palm://com.palm.location', {
		method:"getCurrentPosition",
		parameters:{accuracy: prefs.accuracy, maximumAge: prefs.maxCache}, 
		onSuccess: this.gpsSuccess.bind(this),
		onFailure: this.gpsFailed.bind(this),
	    });
	}
    },

    exit: function($super) {
	$super();

	// todo: cancel any gps activity
    },

    gpsSuccess: function(response) {
	// todo: if we're not in this mode anymore; disregard

	Mojo.Log.info("stash "+response);
	this.assistant.lastReponse = response;
	window.lastResponse = response; // crazy to pass via the window, but
					// this.assistant.lastResponse wasn't working

	this.updateTableWithGps();
	this.assistant.changeMode("sendPosition");
    },

    gpsFailed: function(response) {
	// todo: if we're not in this mode; disregard

	var msg = "GPS error " + response.errorCode;
	jQuery("#cur1").html(msg);
	var asst = this.assistant;
	asst.status(msg);
	setTimeout(function () {
	    asst.changeMode("wait"); // maybe wait shorter in this case?
	}, 1000);
    },

    updateTableWithGps: function() {

	function fmt(x, n) {
	    if (x == undefined) {
		return "?";
	    }
	    return Mojo.Format.formatNumber(x, n);
	}

	var r = this.assistant.lastReponse;
	var t = new Date(r.timestamp)

	jQuery('#prevtm').text(jQuery('#curtm').text());
	jQuery('#prev1').text(jQuery('#cur1').text());

	jQuery('#curtm').text(Mojo.Format.formatDate(t, {'time' : 'medium'}));
	jQuery("#cur1").text("..getting desc..");
	jQuery('#cur2').text("Lat " + fmt(r.latitude, 5) + " Long " + fmt(r.longitude, 5) + " Accuracy " + fmt(r.horizAccuracy, 2) + "m");
    },


});

var SendPositionMode = Class.create(Mode, {
    id: "sendPosition",

    enter: function($super) {
	$super();

	var gps = window.lastResponse;
	Mojo.Log.info("gps "+gps);

	if (!gps) {
	    var asst = this.assistant;
	    asst.status("no known position");
	    setTimeout(function () {
		asst.changeMode("wait");
	    }, 1000);
	    return;
	}

	var prefs = getPrefs();

	this.assistant.status("send to "+prefs.postUrl);


	var xhr = jQuery.ajax({
	    type: "POST",
	    url: prefs.postUrl,
	    data: JSON.stringify(jQuery.extend({user: prefs.foaf, 
						//sendOpts: jQuery("#sendOpts").serializeArray()
					       }, 
					       gps)),
	    contentType: 'text/json',
	    dataType: 'json',
	    timeout: 0,// below    5*1000,
	    success: this.sendSuccess.bind(this),
	    error: this.sendError.bind(this),
	});

	// seemed like jquery was having "Uncaught Error:
	// INVALID_STATE_ERR: DOM Exception 11" that I couldn't
	// detect, so here's my own alternate timeout system
	var asst = this.assistant;
	var t=this;
        setTimeout(function() {
	    try {
		if (xhr.readyState != 4) {
                    xhr.abort();
		    t.sendError(xhr, "timed out");
		}
            } catch(e) { 
		asst.status("abort error: "+e);
	    }
        }, 10000);
    },

    sendSuccess: function (msg) {
	jQuery("#cur1").text(msg ? msg['posName'] : "null response"); 
	this.assistant.status("sent");
	this.assistant.changeMode("wait");
    },

    sendError: function (xhr, status, error) {
	this.assistant.status(status + ", http result " + xhr.status);
	var asst = this.assistant;
	setTimeout(function () {
	    asst.changeMode("wait"); // wait shorter; retry send?
	}, 1000);
    }

});

var WaitMode = Class.create(Mode, {
    id: "wait",
    enter: function ($super) {
	$super();
	this.running = true;
	var prefs = getPrefs();
	var nowMilli = new Date().getTime();
	this.timerDone = nowMilli + prefs.waitMilli;
	this.updateWait();
	/*    this.controller.serviceRequest('palm://com.palm.power/timeout', {
	method: "set",
	parameters: {
	    "wakeup" : true,
	    "key" : "sendpos",
	    "uri": "palm://com.palm.appManager/open",
	    "in" : "00:05:00",
	    "params" : 
         "{'id': 'com.bigasterisk.sendpos', 'params': {'what': 'timedUpdate'}}"
	}
    });
*/    
    },
    exit: function () {
	var prefs = getPrefs();
	this.running = false;
	this.updateWaitMin(prefs.waitMilli);
    },

    updateWait: function() {

	if(!this.running) { 
	    return;
	}

	var nowMilli = new Date().getTime();
	var prefs = getPrefs();

	var milliLeft = this.timerDone - nowMilli;
	milliLeft = (milliLeft > 0) ? milliLeft : 0;
	this.updateWaitMin(milliLeft);

	if (milliLeft > 0) {
	    setTimeout(this.updateWait.bind(this), 1000);
	} else {
	    this.updateWaitMin(prefs.waitMilli);
	    this.assistant.status("time up");
	    this.assistant.changeMode('getPosition');
	}
    },
    updateWaitMin: function (milli) {
	jQuery("#nextMin").text(Mojo.Format.formatNumber(milli / 1000.0 / 60, 2));
    }

});








FirstAssistant.prototype.setup = function() {
    var prefs = getPrefs();

    this.lastResponse = undefined; // gps record passed from getPosition to sendPosition

    this.currentMode = undefined;
    this.changeMode('getPosition');
    var asst = this;
    jQuery("#wait").click(function () { asst.changeMode('wait') });
    jQuery("#getPosition").click(function () { asst.changeMode('getPosition') });
    jQuery("#sendPosition").click(function () { asst.changeMode('sendPosition') });

    new WaitMode(this).exit();

/*

    this.buttonAttributes = {
	type: Mojo.Widget.activityButton
    };

    this.buttonModel = {
	"buttonLabel" : "Send current position",
	"buttonClass" : "",
	"disabled" : false
    };
    this.controller.setupWidget("sendNow", this.buttonAttributes, this.buttonModel);
    Mojo.Event.listen(this.controller.get("sendNow"), Mojo.Event.tap, this.sendNow.bind(this));

*/
    this.controller.setupWidget("settings", {type: Mojo.Widget.defaultButton}, 
				{buttonLabel: "Settings"});
    var stageController = this.controller.stageController;
    Mojo.Event.listen(this.controller.get("settings"), Mojo.Event.tap, 
		      function (event) { stageController.pushScene("settings") });

    var canvas = document.getElementById("map");
    var context = canvas.getContext('2d');
    context.fillText("K", 50, 50);
    context.fillText("D", 150, 80);
    context.fillText("home", 30, 60);
    context.fillText("drew work", 140, 50);
    
    context.beginPath();
    context.lineWidth = .5;
    context.moveTo(50, 50);
    context.lineTo(150, 80);
    context.stroke();
    context.closePath();

/*
    this.controller.serviceRequest('palm://com.palm.power/timeout', {
	method: "clear",
	parameters: {
	    "key" : "sendpos"
	}
    });
*/
 //   this.getPosition();
}

FirstAssistant.prototype.changeMode = function (newModeName) {
    if (this.currentMode != undefined) { 
	Mojo.Log.info("exiting "+this.currentMode.id);
	this.currentMode.exit();
    }
    if (newModeName == 'getPosition') { 
	this.currentMode = new GetPositionMode(this);
    } else if (newModeName == 'sendPosition') {
	this.currentMode = new SendPositionMode(this);
    } else if (newModeName == 'wait') {
	this.currentMode = new WaitMode(this);
    } else {
	Mojo.Log.error("unknown mode "+newModeName);
	return;
    }
    Mojo.Log.info("entering "+this.currentMode.id);

    jQuery(".step").removeClass("current");
    jQuery("#"+this.currentMode.id).addClass("current");


    this.currentMode.enter();
}

FirstAssistant.prototype.status = function (msg) {
    // only Mode.initialize passes _state
    Mojo.Log.info(msg);
    jQuery("#status").prepend(jQuery("<div>").text(msg)).find(":gt(2)").remove();

    // Mojo.Controller.getAppController().showBanner({ messageText: msg }, {}, null);
}






FirstAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
}


FirstAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
}

FirstAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}
