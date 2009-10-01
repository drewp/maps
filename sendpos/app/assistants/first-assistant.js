function FirstAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

FirstAssistant.prototype.setup = function() {
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

    this.controller.setupWidget("settings", {type: Mojo.Widget.defaultButton}, 
				{buttonLabel: "Settings"});
    var stageController = this.controller.stageController;
    Mojo.Event.listen(this.controller.get("settings"), Mojo.Event.tap, 
		      function (event) { stageController.pushScene("settings") });
}

function updateTableWithGps(gpsResponse) {
    $('coord').update("" + Mojo.Format.formatNumber(gpsResponse.latitude, 5) + " " + 
		      Mojo.Format.formatNumber(gpsResponse.longitude, 5));
    var t = new Date(gpsResponse.timestamp)
    $('lastSendTime').update(Mojo.Format.formatDate(t, {'date' : 'medium', 'time' : 'full'}));
    $('accuracy').update("" + gpsResponse.horizAccuracy + "m horiz; " +
			 gpsResponse.vertAccuracy+"m vert");
}

FirstAssistant.prototype.sendNow = function(event) {
    var assistant = this;
    var prefs = getPrefs();
    var sendNowButton = this.controller.get("sendNow");

    var gpsSend = function (gpsResponse) {
	updateTableWithGps(gpsResponse);
	$('ajaxStatus').update("send...");
	var postBody = Object.toJSON(new Hash(gpsResponse).merge({user: prefs.foaf}));
	new Ajax.Request(prefs.postUrl, {
	    method: 'post',
	    contentType: 'text/json',
	    postBody: postBody,
	    onComplete: function(transport) {
		assistant.finishSendButton(transport.responseText);
	    },
	});
    };

    sendNowButton.mojo.activate();
    $('ajaxStatus').update("request position...");
    $('coord').update("...");
    $('accuracy').update("...");

    if (0) {
	gpsSend({'alt':500});
    } else {
	this.controller.serviceRequest('palm://com.palm.location', {
	    method:"getCurrentPosition",
	    parameters:{accuracy: prefs.accuracy, maximumAge: prefs.maxCache}, 
	    onSuccess: gpsSend,
	    onFailure: function (response) {
		$('coord').update("GPS error " + response.errorCode);
		assistant.finishSendButton("failed");
	    }
	});
    }

}

FirstAssistant.prototype.finishSendButton = function (statusLine) {
    this.controller.get("sendNow").mojo.deactivate();
    $('ajaxStatus').update(statusLine);
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
