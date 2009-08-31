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
	"buttonLabel" : "TAP HERE",
	"buttonClass" : "",
	"disabled" : false
    };

	Mojo.Log.info("setup");

    this.controller.setupWidget("sendNow", this.buttonAttributes, this.buttonModel);

    Mojo.Event.listen(this.controller.get("sendNow"), Mojo.Event.tap, this.sendNow.bind(this));

//    jQuery("#currentPos").text("hello");
}

FirstAssistant.prototype.sendNow = function(event) {

    Mojo.Log.info("cb");

    var sendNowButton = this.controller.get("sendNow");
    Mojo.Log.info("cb2");

    var gpsSend = function (gpsResponse) {

	new Ajax.Request("http://bigasterisk.com/map/update", {
	    method: 'post',
	    contentType: 'text/json',
	    postBody: Object.toJSON(gpsResponse),
	    onComplete: function() {
		Mojo.Log.info("deact");
		sendNowButton.mojo.deactivate();
	    },
	});

/*
	Mojo.Log.info("loc suc3 %s ! ", globalok);
	jQuery('#currentPos');
	Mojo.Log.info("loc suc4");
	jQuery('#currentPos').text('hi post');
	Mojo.Log.info("loc suc5");
	Mojo.Log.info("loc suc6");
	jQuery.post('http://bigasterisk.com/', {});//gpsResponse);
	Mojo.Log.info("sent");
*/
    };

    Mojo.Log.info("cb3");
    sendNowButton.mojo.activate();
    Mojo.Log.info("send now");

    if (0) {
	gpsSend({'alt':500});
    } else {
	this.controller.serviceRequest('palm://com.palm.location', {
	    method:"getCurrentPosition",
	    parameters:{}, // default is medium accuracy
	    onSuccess: gpsSend,
	    onFailure: function (response) {
		Mojo.Log.info("loc err", response);
	    }
	});
    }

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
