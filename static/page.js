var toggleMap, reloadMap;
$(document).bind("ready", function () {
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

    var people = updates.map(function (u) {
        var p = {
            label: u.label,
            visible: ko.observable(true),
            follow: ko.observable(false),
            query: ko.observable("last 50 points"),
            lastSeen: ko.observable(u.timestamp),
            recentPos: ko.observable(recentPosMessage(u))
        };
        p.visible.subscribe(function (newValue) {
            console.log(p.user, newValue);
	    if (newValue) {
  		m.showUser(p.user);
	    } else {
		m.hideUser(p.user);
	    }
        });
        return p;

    });
    
    ko.applyBindings({people: people});
    
    var stat = function (t) { $("#socketStat").text(t); };
    stat("startup");
    socket.on('reconnect_failed', function (r) { stat("reconnect failed"); });
    socket.on("error", function (r) { stat("error "+r); });
    socket.on("connecting", function (how) { stat("connected via "+how); });
    socket.on("disconnect", function () { stat("disconnected"); });
    socket.on("connect_failed", function (r) { stat("connect failed: "+r); })

    socket.of("").on("gotNewTrails", function (r) { m.gotNewTrails(r); });
});
