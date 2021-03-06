function StageAssistant() {
}

StageAssistant.prototype.setup = function() {
    this.controller.pushScene("first");
}

function getPrefs() {
    var prefs = new Mojo.Model.Cookie('com.bigasterisk.sendpos.prefs').get();
    if (!prefs) {
	prefs = {
	    postUrl: "http://bigasterisk.com/map/update",
	    foaf: "",
	    maxCache: 5,
	    accuracy: 1
	};
    }
	prefs.waitMilli = 30 * 1000;
    return prefs;
}
function savePrefs(prefs) {
    var cookie = new Mojo.Model.Cookie('com.bigasterisk.sendpos.prefs'); 
    cookie.put(prefs);
}
