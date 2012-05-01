if (typeof module !== 'undefined' && module.exports) {
    var moment = require('moment');
}

var mapShared = {
    lastSeenFormat: function (t) {
	var t = moment(t);
	var now = moment();
	var out = t.from(now);

	if (t.diff(now, 'hours') > -20) {
            out += " (" + t.format("HH:mm") + ")";
	} 
	return out;
    }
};    
if (typeof module !== 'undefined' && module.exports) {
    module.exports = mapShared;
}
