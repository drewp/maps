var toggleMap, reloadMap;
$(document).bind("pageinit", function () {

    var m = makeMap('mapArea', {useStomp:false, trailUri: "trails"});
    toggleMap = function (id, elem) {
        var check = $(elem).closest("li").find("input")[0];
        if (check.checked) {
            m.places.addPlaces(id);
        } else {
            m.places.removePlaces(id);
        }
    };
    reloadMap = function (id, elem) {
        var check = $(elem).closest("li").find("input")[0];
        check.checked = true
        m.places.reloadPlaces(id);
    };

    // "user prefs"
    $("input").each(function (i, elem) { 
        if (elem.getAttribute("onclick") == "toggleMap('Perttula', this)") {
            $(elem).click(); 
            toggleMap('Perttula', elem);
        } 
    });

    var socket = io.connect('/map/', {resource: "map/socket.io"});

    function recentPosMessage(update) {
        return ", velocity "+update.velocity+", altitude "+update.altitude;
    }

    var byUser = {};
    var people = updates.map(function (u) {
        var p = {
	    // fixed
            label: u.label,
	    user: u.user,

	    // from server
            lastSeen: ko.observable(u.lastSeen),
            recentPos: ko.observable(recentPosMessage(u)),

	    // to server
            visible: ko.observable(
		(u.user == me) || 
		    (me == 'http://bigasterisk.com/foaf.rdf#drewp' && u.user == 'http://bigasterisk.com/kelsi/foaf.rdf#kelsi') || 
		    (me == 'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' && u.user == 'http://bigasterisk.com/foaf.rdf#drewp')),
            follow: ko.observable(false),
            query: ko.observable("last 80 points"),
        };
	$.each([p.visible, p.follow, p.query], function (i, ui) {
	    ui.subscribe(function (n) { 
		updateWithNewQuery();
	    });
	});
	byUser[u.user] = p;
        return p;

    });
    
    ko.applyBindings({people: people});

    function gotNewTrails(r) {
	$.each(r.trailPoints, function (user, pts) {
	    var latest = pts[pts.length - 1];
	    byUser[user].lastSeen(mapShared.lastSeenFormat(latest.timestamp));
	    byUser[user].recentPos(recentPosMessage(latest));
	});
	m.gotNewTrails(r);
    }

    function updateWithNewQuery() {
	// the q sticks on the server for further updates
	$.getJSON("trails", {q: ko.toJSON(people)}, function (trails) {
	    gotNewTrails(trails);
	});
    }
    updateWithNewQuery();
    
    var stat = function (t) { $("#socketStat").text(t); };
    stat("startup");
    socket.on('reconnect_failed', function (r) { stat("reconnect failed"); });
    socket.on("error", function (r) { stat("error "+r); });
    socket.on("connecting", function (how) { stat("connected via "+how); });
    socket.on("disconnect", function () { stat("disconnected"); });
    socket.on("connect_failed", function (r) { stat("connect failed: "+r); })

    socket.of("").on("gotNewTrails", function (r) { 
	//gotNewTrails(r); 

	// someday this will arrive with the results of my query
	// according to the last time i called /trails, but right now
	// it's coming back with the vanilla query instead. This
	// workaround leads to an extra request and (small) data.
	updateWithNewQuery();
    });
});