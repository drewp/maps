function SettingsAssistant() {
}

SettingsAssistant.prototype.setup = function() {
    var prefs = getPrefs();
    this.widgets = {};

    var urlFieldAttrs = {textCase: Mojo.Widget.steModeLowerCase,
			 autoReplace: false,
			 multiline: true,
			 focusMode: Mojo.Widget.focusSelectMode}

    this.controller.setupWidget("postUrl", urlFieldAttrs, this.widgets.postUrl={value: prefs.postUrl});
    this.controller.setupWidget("foaf", urlFieldAttrs, this.widgets.foaf={value: prefs.foaf});
    this.controller.setupWidget("maxCache", 
				{label: "Max cache",
				 choices: [{label: "No caching", value: 0},
					   {label: "5 sec", value: 5},
					   {label: "30 sec", value: 30}]},
				this.widgets.maxCache={value: prefs.maxCache});
    this.controller.setupWidget("accuracy", 
				{label: "Accuracy",
				 choices: [{label: "High (<100 m)", value: 1},
					   {label: "Medium (<350 m)", value: 2},
					   {label: "Low", value: 3}]},
				this.widgets.accuracy={value: prefs.accuracy});
}

SettingsAssistant.prototype.activate = function(event) {
}

SettingsAssistant.prototype.deactivate = function(event) {
    /* remove any event handlers you added in activate and do any
       other cleanup that should happen before this scene is
       popped or another scene is pushed on top */
    
    var prefs = {};
    for (k in this.widgets) {
	prefs[k] = this.widgets[k].value;
    }
    savePrefs(prefs);
}

SettingsAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}
