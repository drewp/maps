var toggleMap, reloadMap;
$(document).bind("pageinit", function () {

    var styles = _.object(updates.map(function (m) { return [m.user, m]; }));

    var m = makeMap('mapArea', {
	useStomp:false, 
	trailUri: "trails", 
	styles: styles
    });
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

    var startMap = {
        'http://bigasterisk.com/foaf/john' : 'Tulloch',
        'http://bigasterisk.com/foaf/karin' : 'Tulloch',
	'http://bigasterisk.com/foaf.rdf#drewp' : 'Perttula',
        'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' : 'Perttula'
    }[me];
    console.log("me:", me, startMap);

    $("input").each(function (i, elem) { 
        if (elem.getAttribute("onclick") == "toggleMap('"+startMap+"', this)") {
            $(elem).click(); 
            toggleMap(startMap, elem);
        } 
    });

    var socket = io.connect('/map/', {resource: "map/socket.io"});

    function recentPosMessage(update) {
        return ", velocity "+update.velocity+", altitude "+update.altitude;
    }

    var byUser = {};
    var people = updates.map(function (u) {

	var initialMode = "off";
	if (
	    (u.user == me) || 
		(me == 'http://bigasterisk.com/foaf.rdf#drewp' && u.user == 'http://bigasterisk.com/kelsi/foaf.rdf#kelsi') || 
                (me == 'http://bigasterisk.com/foaf/john' && u.user == 'http://bigasterisk.com/foaf.rdf#drewp') || 
		(me == 'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' && u.user == 'http://bigasterisk.com/foaf.rdf#drewp')) {
	    initialMode = "frame";
	}

        var p = {
	    // fixed
            label: u.label,
	    user: u.user,

	    // from server
            lastSeen: ko.observable(u.lastSeen),
            recentPos: ko.observable(recentPosMessage(u)),

	    // to server
	    mode: ko.observable(initialMode), // or visible or frame

            query: ko.observable("last 80 points"),
        };
	p.isVisible = ko.computed(function () {
	    return p.mode() == "visible" || p.mode() == "frame";
	});

	byUser[u.user] = p;
        return p;

    });
    
    var model = {
        people: people, 
        pointsToFrame: ko.observableArray([
		['home',{longitude: -122,latitude:37}]
        ]),
    }

    ko.applyBindings(model);

    function gotNewTrails(r) {
	$.each(r.trailPoints, function (user, pts) {
	    var latest = pts[pts.length - 1];
	    byUser[user].lastSeen(mapShared.lastSeenFormat(latest.timestamp));
	    byUser[user].recentPos(recentPosMessage(latest));
	});
	m.gotNewTrails(r, 
                       people
                       .filter(function (p) { return p.mode() == "frame"; })
                       .map(function (p) { return p.user; }), 
                       model.pointsToFrame());
    }

    var updateWithNewQuery = ko.computed(function () {
	// the q sticks on the server for further updates
	var q = ko.toJSON(people.filter(function (p) { return p.isVisible(); }));
	$.getJSON("trails", {q: q}, function (trails) {
	    gotNewTrails(trails);
	});
    });

    
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

    $("#controls-collapse").hide();
    $(".controls h1").click(function () {
	$("#controls-collapse").toggle();
    });

});
