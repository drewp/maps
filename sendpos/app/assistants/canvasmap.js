
function dot(ctx, pt, r, width, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, 2*Math.PI, true);
    ctx.fill();
    ctx.stroke();
}

function findExtent(placeLocs) {
    var worldExtent = {};
    $.each(placeLocs, function (i, place) {
	if (worldExtent.minX == undefined || place[1][1] < worldExtent.minX) {
	    worldExtent.minX = place[1][1];
	}
	if (worldExtent.maxX == undefined || place[1][1] > worldExtent.maxX) {
	    worldExtent.maxX = place[1][1];
	}
	if (worldExtent.minY == undefined || place[1][0] < worldExtent.minY) {
	    worldExtent.minY = place[1][0];
	}
	if (worldExtent.maxY == undefined || place[1][0] > worldExtent.maxY) {
	    worldExtent.maxY = place[1][0];
	}
    });
    return worldExtent;
}

function Grid(coords) {
    this.draw = function (ctx, canvas) {
	ctx.strokeStyle = "#888";
	ctx.lineWidth=.5;
	ctx.beginPath();
	for (var wx = coords.worldExtent.minX; wx < coords.worldExtent.maxX; wx += .02 /*deg*/) {
	    var cx = coords.world2canvas.transformPoint(Point(wx, 0)).x;
	    if (cx > 0 && cx < coords.canMaxX) {
		ctx.moveTo(cx, coords.canMinY);
		ctx.lineTo(cx, coords.canMaxY);
	    }
	}
	for (var wy = coords.worldExtent.minY; wy < coords.worldExtent.maxY; wy += .01 /*deg*/) {
	    var cy = coords.world2canvas.transformPoint(Point(0, wy)).y;
	    if (cy > 0 && cy < coords.canMaxY) {
		ctx.moveTo(coords.canMinX, cy);
		ctx.lineTo(coords.canMaxX, cy);
	    }
	}
	ctx.stroke();
    };
}

function Places(coords, places) {


    placeCenters = new RTree(); // place center points -> place obj
    $.each(places, function (i, pl) {

	var box = {x: pl[1][1], y: pl[1][0], 
		   w: .0001, h:.0001 // these will be the text extent of the label
		  };

	placeCenters.insert(box, pl);
	pl.worldPoint = Point(pl[1][1], pl[1][0]);
    });

    function searchVisiblePlaces(coords) {
	var c2w = coords.getCanvas2world();
	var wmin = c2w.transformPoint(Point(coords.canMinX, coords.canMaxY));
	var wmax = c2w.transformPoint(Point(coords.canMaxX, coords.canMinY));
	var worldView = {x: wmin.x, y: wmin.y, w: wmax.x - wmin.x, h: wmax.y - wmin.y};
	return placeCenters.search(worldView);
    }

    this.draw = function (ctx, canvas) {

	var visiblePlaces = searchVisiblePlaces(coords);

	placeLabels = new RTree(); // canvas rectangles I've drawn -> place obj

	$.each(visiblePlaces, function(i, place) {	
	    // run these in importance order, use rtree to suppress
	    // any that would intersect with more-important ones. but
	    // if the label overlaps with another label or with a
	    // trail, try other positions in a circle around the
	    // point. This will look good when the label animates into
	    // something and it spins out of the way


	    var cp = coords.world2canvas.transformPoint(place.worldPoint);

	    var name = place[0];
	    var width = ctx.measureText(name).width;
	    
	    dot(ctx, cp, 3, 1, 'black', 'red');

	    var box = {x:cp.x+5, y: cp.y+5, w: width, h: 12};
	    if (placeLabels.search(box).length) {
		return;
	    }
	    
	    ctx.fillStyle = "black";
	    ctx.font = "12px sans-serif";
	    ctx.fillText(name, cp.x+5, cp.y+5);

	    placeLabels.insert(box, place);
	});
    }
}

function Trails(coords, trailPoints) {
    this.draw = function(ctx, canvas) {

	$.each(trailPoints, function (name, pts) {

	    ctx.strokeStyle = "#000000";
	    ctx.lineWidth=3;
	    ctx.beginPath();

	    var dotArgs = [];

	    $.each(pts, function (i, pt) {
		var cp = coords.world2canvas.transformPoint(Point(pt.longitude, pt.latitude));

		if (i == 0) {
		    ctx.moveTo(cp.x, cp.y);
		} else {
		    ctx.lineTo(cp.x, cp.y);
		}
		dotArgs.push([cp, 3, 1, 'green', 'black']);
	    });
	    ctx.stroke();

	    $.each(dotArgs, function (i, a) {
		dot(ctx, a[0], a[1], a[2], a[3], a[4]);
	    });

	    var lastPoint = pts[pts.length - 1]
	    var cp = coords.world2canvas.transformPoint(Point(lastPoint.longitude, lastPoint.latitude));

	    var initial = name.replace(/.*#(.).*/,"$1").toUpperCase();

	    dot(ctx, cp, 10, 1, {K: 'pink', D: 'lightgreen'}[initial], 'black');

	    ctx.fillStyle = "black";
	    ctx.font = "16px sans-serif";
	    ctx.fillText(initial, cp.x-6, cp.y+6);

	});


    }
}

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       || 
        window.webkitRequestAnimationFrame || 
        window.mozRequestAnimationFrame    || 
        window.oRequestAnimationFrame      || 
        window.msRequestAnimationFrame     || 
        function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
        };
})();

function centerPoint(params, pt, redraw) {

    var startTime = 1 * new Date();
    var endTime = startTime + 2000;
    var centerStart = Point(params.cx, params.cy);
    
    function loop() {
	var t = 1 * new Date();
	var f = (t - startTime) / (endTime - startTime);

	var cur = centerStart.add(pt.subtract(centerStart).scale(f));
	params.cx = cur.x;
	params.cy = cur.y;
	redraw();
	
	if (f < 1) {
	    requestAnimFrame(loop);
	}
    }
    loop();
}

function xformFromParams(params, diameter) {
    var scl = diameter/5*Math.pow(params.scale, 2);
    return Matrix.scale(scl, -scl*2, Point(params.cx, params.cy))
	.translate(diameter*.625/scl, -diameter*.25/scl);
}

$(function() {
    var params = {"cx":-122.346,"cy":37.547,"scale":7.849};

    var worldExtent = findExtent(placeLoc);

    coords = {
	worldExtent: worldExtent,
	world2canvas: null,
	recalc: function (params) { 
	    this.world2canvas = xformFromParams(params, this.canMaxX);
	},
	getCanvas2world: function () { return this.world2canvas.inverse(); },
	canMinX: 0, canMaxX: $("#mapArea").width(),
	canMinY: 0, canMaxY: $("#mapArea").height(),
    };
    coords.recalc(params);


    var trailPoints = {};

    g = $g('mapArea');
    g.size(coords.canMaxX, coords.canMaxY)
	.add(new Grid(coords))
	.add(new Places(coords, placeLoc)) // should be getting these from server
	.add(new Trails(coords, trailPoints))
	.draw();

    $("#scale").slider({min: 1, max: 20, step: .001});
    $("#cx").slider({min: -125, max: -120, step: .001});
    $("#cy").slider({min:37, max: 38, step: .001});

    $.each(["scale", "cx", "cy"], function(i,v) {
	$("#"+v).slider({value: params[v]});
	$("#"+v).slider({slide: function (ev, ui) {
	    params[v] = ui.value;
	    $("#paramDisplay").text(JSON.stringify(params));

	    coords.recalc(params);
	    g.draw();
	    return true;
	}});
    });


    var stomp = new STOMPClient();
    stomp.onconnectedframe = function () {
	stomp.subscribe('view');
	$.post("updateTrails")
    };
    stomp.onmessageframe = function(frame) {
	var data = JSON.parse(frame.body);
	$.extend(trailPoints, data.trailPoints);

	coords.scale = data.scale;
	new centerPoint(params, Point(data.center.longitude, data.center.latitude),
			function () { 
			    coords.recalc(params);
			    g.draw();
			});
    };
    stomp.connect('localhost', 61614);


});