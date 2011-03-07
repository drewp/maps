
function dot(ctx, pt, r, width, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, 2*Math.PI, true);
    ctx.fill();
    
    // combine these? i dont have my docs with me
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, 2*Math.PI, true);
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
	for (var wx = coords.worldExtent.minX; wx < coords.worldExtent.maxX; wx += .1 /*deg*/) {
	    var cx = coords.world2canvas.transformPoint(Point(wx, 0)).x;
	    ctx.moveTo(cx, coords.canMinY);
	    ctx.lineTo(cx, coords.canMaxY);
	}
	for (var wy = coords.worldExtent.minY; wy < coords.worldExtent.maxY; wy += .1 /*deg*/) {
	    var cy = coords.world2canvas.transformPoint(Point(0, wy)).y;
	    ctx.moveTo(coords.canMinX, cy);
	    ctx.lineTo(coords.canMaxX, cy);
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

	    var wp = Point(place[1][1], place[1][0])
	    var cp = coords.world2canvas.transformPoint(wp);

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
	    ctx.lineWidth=5;
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
	    ctx.fillStyle = "black";
	    ctx.font = "12px sans-serif";
	    ctx.fillText(name, cp.x+5, cp.y+5);

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

function xformFromParams(params) {
    var scl = 400/5*Math.pow(params.scale, 2);
    return Matrix.scale(scl, -scl, Point(params.cx, params.cy)).translate(200/scl, -200/scl);
}

$(function() {
    var params = {"cx":-122.346,"cy":37.547,"scale":7.849};

    var worldExtent = findExtent(placeLoc);

    coords = {
	worldExtent: worldExtent,
	world2canvas: xformFromParams(params),
	getCanvas2world: function () { return this.world2canvas.inverse(); },
	canMinX: 0, canMaxX: 400,
	canMinY: 0, canMaxY: 400,
    };

    // from http://strd6.com/2010/06/matrix-js-demo/
    $.extend($('#mapArea').get(0).getContext('2d'), {
        withTransform: function(matrix, block) {
	    this.save();
	    
	    this.transform(
		matrix.a, matrix.b, matrix.c, matrix.d,
		matrix.tx, matrix.ty
	    );
	    
	    try {
		block();
	    } finally {
		this.restore();
	    }
        }
    });

    var trailPoints = {};

    g = $g('mapArea');
    g.size(400, 400)
	.add(new Grid(coords))
	.add(new Places(coords, placeLoc))
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

	    coords.world2canvas = xformFromParams(params);
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
			    coords.world2canvas = xformFromParams(params);
			    g.draw();
			});
    };
    stomp.connect('localhost', 61614);


});