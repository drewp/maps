function Coords(canMaxX, canMaxY, worldExtent, initialCenter, initialScale) {
    var self=this;

    this.canMinX = 0;
    this.canMinY = 0;
    this.canMaxX = canMaxX;
    this.canMaxY = canMaxY;
    this.worldExtent = worldExtent;

    function recalc() {
	var scl = self.canMaxX / 5 * Math.pow(self.scale, 2); // canvas units per world units
	var m = Matrix.scale(scl, -scl*2);
	var offCenter = m.transformPoint(self.center);
	var realCenter = Point(self.canMaxX / 2, self.canMaxY / 2);
	var fix = realCenter.subtract(offCenter);
	m =  Matrix.translation(fix.x, fix.y).concat(m);
	self._world2canvas = m;
	self._canvas2world = self._world2canvas.inverse();
    }

    this.setCenter = function (center) {
	self.center = center;
	recalc();
    }

    this.setScale = function (scale) {
	self.scale = scale;
	recalc();
    }

    this.toWorld = function (canvasPoint) {
	return self._canvas2world.transformPoint(canvasPoint);
    }
    this.toCanvas = function (worldPoint) {
	return self._world2canvas.transformPoint(worldPoint);
    }
    this.toWorldX = function (cx) {
	return self.toWorld(Point(cx, 0)).x;
    }
    this.viewAll = function (pts) {
	var r = findExtent(pts);
	self.setCenter(Point((r.minX + r.maxX) / 2, (r.minY + r.maxY) / 2));
	var diam = Math.max(r.maxX - r.minX, r.maxY - r.minY);
	self.setScale(Math.pow(5/diam, 1/2) * .6); // way wrong
    }

    self.center = initialCenter;
    self.scale = initialScale;
    recalc();
}

function dot(ctx, pt, r, width, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, 2*Math.PI, true);
    ctx.fill();
    if (stroke) {
	ctx.strokeStyle = stroke;
	ctx.stroke();
    }
}

function findExtent(placeLocs) {
    var worldExtent = {};
    jQuery.each(placeLocs, function (i, place) {
	if (place.longitude) {
	    place = ['', [place.latitude, place.longitude]]; // sic
	}
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

	var worldSpacing = .02; /*deg*/
	ctx.strokeStyle = "#aaa";

	var count = (coords.toWorldX(coords.canMaxX) - coords.toWorldX(coords.canMinX)) / worldSpacing;
	var canvasSpacing = (coords.canMaxX - coords.canMinX) / count;
	if (canvasSpacing < 1.5) {
	    worldSpacing *= 100;
	    ctx.strokeStyle = "#a5a";
	} else if(canvasSpacing < 2.5) {
	    worldSpacing *= 50;
	    ctx.strokeStyle = "#aa5";
	} else if(canvasSpacing < 10) {
	    worldSpacing *= 5;
	    ctx.strokeStyle = "#5aa";
	}

	ctx.lineWidth=.2;
	ctx.beginPath();
	for (var wx = coords.worldExtent.minX; wx < coords.worldExtent.maxX; wx += worldSpacing /*deg*/) {
	    var cx = coords.toCanvas(Point(wx, 0)).x;
	    if (cx > 0 && cx < coords.canMaxX) {
		ctx.moveTo(cx, coords.canMinY);
		ctx.lineTo(cx, coords.canMaxY);
	    }
	}
	for (var wy = coords.worldExtent.minY; wy < coords.worldExtent.maxY; wy += worldSpacing / 2 /*deg*/) {
	    var cy = coords.toCanvas(Point(0, wy)).y;
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
    jQuery.each(places, function (i, pl) {
	var box = {x: pl[1][1], y: pl[1][0], w: .0001, h:.0001};

	placeCenters.insert(box, {label: pl[0], order: i, worldPoint: Point(pl[1][1], pl[1][0])});
    });

    function searchVisiblePlaces(coords) {
	var wmin = coords.toWorld(
	    Point(coords.canMinX - 200, // display text even when the point is off left
		  coords.canMaxY));
	var wmax = coords.toWorld(Point(coords.canMaxX, coords.canMinY));
	var worldView = {x: wmin.x, y: wmin.y, w: wmax.x - wmin.x, h: wmax.y - wmin.y};
	return placeCenters.search(worldView);
    }

    function selectPosition(placeLabels, cp, width, boxHeight) {
	// todo: if the label overlaps with another label or with a
	// trail, try other positions in a circle around the
	// point. This will look good when the label animates into
	// something and it spins out of the way
	var box;
	var found = false;
	var foundDist = 0;
	jQuery.each([0, 2, -2, 4, -4], function (dist, ypush) {
	    if (found) { 
		return;
	    }
	    box = {x:cp.x+5, y: cp.y + 3 + ypush, w: width, h: boxHeight};
	    if (!placeLabels.search(box).length) {
		found = true;
		foundDist = dist;
	    }
	});
	if (!found) {
	    return null;
	}
	box.foundDist = foundDist;
	return box;
    }

    this.draw = function (ctx, canvas) {

	var visiblePlaces = searchVisiblePlaces(coords);

	placeLabels = new RTree(); // canvas rectangles I've drawn -> place obj

	visiblePlaces.sort(function (a,b) { return a.order - b.order });

	jQuery.each(visiblePlaces, function(i, place) {	
	    var cp = coords.toCanvas(place.worldPoint);

	    var name = place.label;
	    var width = ctx.measureText(name).width;
	    
	    dot(ctx, cp, 2, .4, 'black', 'white');

	    // might look good for the labels closest to people were drawn bigger
	    var fontSize = 10;

	    var box = selectPosition(placeLabels, cp, width, fontSize);
	    if (!box) {
		return;
	    }
	    
	    ctx.fillStyle = "rgba(0,0,0,"+(.7 - box.foundDist / 8)+")";

	    ctx.font = ""+fontSize+"px sans-serif";
	    ctx.textAlign = "left";
	    ctx.textBaseline = "alphabetic";

	    ctx.fillText(name, box.x, box.y);

	    placeLabels.insert(box, place);
	});
    }
}

function Trails(coords, trailPoints) {
    function getControlPoints(x0,y0,x1,y1,x2,y2,t){
	// from http://scaledinnovation.com/analytics/splines/splines.html
	/*
	  Copyright 2010 by Robin W. Spencer
	  
	  This program is free software: you can redistribute it and/or modify
	  it under the terms of the GNU General Public License as published by
	  the Free Software Foundation, either version 3 of the License, or
	  (at your option) any later version.
	  
	  This program is distributed in the hope that it will be useful,
	  but WITHOUT ANY WARRANTY; without even the implied warranty of
	  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	  GNU General Public License for more details.
	  
	  You can find a copy of the GNU General Public License
	  at http://www.gnu.org/licenses/.
	  
	*/

	//  x0,y0,x1,y1 are the coordinates of the end (knot) pts of this segment
	//  x2,y2 is the next knot -- not connected here but needed to calculate p2
	//  p1 is the control point calculated here, from x1 back toward x0.
	//  p2 is the next control point, calculated here and returned to become the 
	//  next segment's p1.
	//  t is the 'tension' which controls how far the control points spread.
	
	//  Scaling factors: distances from this knot to the previous and following knots.
	var d01=Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
	var d12=Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));
	
	var fa=(d01+d12) ? t*d01/(d01+d12) : 0;
	var fb=t-fa;
	
	var p1x=x1+fa*(x0-x2);
	var p1y=y1+fa*(y0-y2);
	
	var p2x=x1-fb*(x0-x2);
	var p2y=y1-fb*(y0-y2);  
	
	return [p1x,p1y,p2x,p2y]
    }

    function makeCvs(canvasPoints) {
	var cvs = []; // flattened [x,y,x,y,...]
	for (var i=0; i<canvasPoints.length-2; i+=1) {
	    cvs = cvs.concat(
		getControlPoints(canvasPoints[i].x, canvasPoints[i].y,
				 canvasPoints[i+1].x, canvasPoints[i+1].y,
				 canvasPoints[i+2].x, canvasPoints[i+2].y,
				 .5));
	}
	return cvs;
    }

    function quadraticCurveToViaBez(ctx, currentX, currentY, cpx, cpy, x, y) {
	// from https://developer.mozilla.org/en/Canvas_tutorial/Drawing_shapes
	var cp1x = currentX + 2.0/3.0*(cpx - currentX);
	var cp1y = currentY + 2.0/3.0*(cpy - currentY);
	var cp2x = cp1x + (x - currentX)/3.0;
	var cp2y = cp1y + (y - currentY)/3.0;

	ctx.bezierCurveTo( cp1x, cp1y, cp2x, cp2y, x, y );
    }

    function drawCurve(ctx, canvasPoints, cvs) {
	// adapted from
	// http://scaledinnovation.com/analytics/splines/splines.html
	// but my canvasPoints are objects with x,y, not unpacked
	// coordinate pairs
	var n = canvasPoints.length;
	ctx.beginPath();
        ctx.moveTo(canvasPoints[0].x,canvasPoints[0].y);
        quadraticCurveToViaBez(ctx, canvasPoints[0].x,canvasPoints[0].y,
			       cvs[0],cvs[1], 
			       canvasPoints[1].x,canvasPoints[1].y);
        ctx.stroke();
        ctx.closePath();

	for(var i=2; i<n*2-5; i+=2){
	    ctx.beginPath();
	    ctx.moveTo(canvasPoints[i/2].x, canvasPoints[i/2].y);
	    ctx.bezierCurveTo(cvs[2*i-2], cvs[2*i-1], 
			      cvs[2*i], cvs[2*i+1],
			      canvasPoints[i/2+1].x,
			      canvasPoints[i/2+1].y);
	    ctx.stroke();
	    ctx.closePath();
	}

	ctx.beginPath();
        ctx.moveTo(canvasPoints[n-1].x, canvasPoints[n-1].y);
        quadraticCurveToViaBez(ctx, 
			       canvasPoints[n-1].x, canvasPoints[n-1].y,
			       cvs[2*n*2-10], cvs[2*n*2-9],
			       canvasPoints[n-2].x, canvasPoints[n-2].y);
        ctx.stroke();
        ctx.closePath();
    }
 
    var self = this;
    self.currentPositions = [];
    self.allVisiblePositions = [];

    this.draw = function(ctx, canvas) {
	self.currentPositions = [];
	self.allVisiblePositions = [];
	jQuery.each(trailPoints, function (name, pts) {
	    var initial = name.replace(/.*#(.).*/,"$1").toUpperCase();

	    var settings = {
		K: {
		    trailStroke: "rgba(200,0,0,.2)",
		    dotFill: 'pink'
		},
		D: {
		    trailStroke: "rgba(0,200,0,.2)",
		    dotFill: 'lightgreen'
		}
	    }[initial]

	    var dotArgs = [];
	    var canvasPoints = []; // Point objects

	    jQuery.each(pts, function (i, pt) {
		var p = Point(pt.longitude, pt.latitude);
		self.allVisiblePositions.push(pt);
		var cp = coords.toCanvas(p);
		canvasPoints.push(cp);
		dotArgs.push([cp, 3, 1, 'rgba(0,100,0,.6)', null]);
	    });

	    ctx.strokeStyle = settings.trailStroke;
	    ctx.lineWidth=5;
	    drawCurve(ctx, canvasPoints, makeCvs(canvasPoints));

	    jQuery.each(dotArgs, function (i, a) {
		dot(ctx, a[0], a[1], a[2], a[3], a[4]);
	    });

	    var lastPoint = pts[pts.length - 1]
	    self.currentPositions.push(lastPoint);
	    var cp = coords.toCanvas(Point(lastPoint.longitude, lastPoint.latitude));

	    dot(ctx, cp, 10, 1, settings.dotFill, 'black');
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

function centerPoint(coords, pt, redraw) {
    var startTime = 1 * new Date();
    var endTime = startTime + 2000;
    var centerStart = coords.center;
    
    function loop() {
	var t = 1 * new Date();
	var f = (t - startTime) / (endTime - startTime);

	var cur = centerStart.add(pt.subtract(centerStart).scale(f));
	coords.setCenter(cur);
	redraw();
	
	if (f < 1) {
	    requestAnimFrame(loop);
	}
    }
    loop();
}

function startStomp(onMessage) {
    var stomp = new STOMPClient();
    stomp.onconnectedframe = function () {

	stomp.subscribe('view');
	jQuery.post("updateTrails")
    };
    stomp.onmessageframe = function(frame) {

	var data = JSON.parse(frame.body);
	onMessage(data);
    };


    stomp.connect('localhost', 61614);
    return stomp;
}

function getPosition(canvas, e) { // from inside gury.js, except I return Point
    var left = 0, top = 0;
    
    if (canvas.offsetParent) {
        while (canvas) {
            left += canvas.offsetLeft;
            top += canvas.offsetTop;
            canvas = canvas.offsetParent;
        }
    }
    
    return Point(e.pageX - left, e.pageY - top);
}

function zoomAbout(canvas, coords, factor, anchorCanvas) {
    /*
      change scale by this factor, keeping the given canvas position anchored
    */
    var anchorWorld = coords.toWorld(anchorCanvas);
    coords.setScale(coords.scale * factor);

    var newWorld = coords.toWorld(anchorCanvas);
    var fix = anchorWorld.subtract(newWorld);
    coords.setCenter(coords.center.add(fix));
}

function setupBackgroundDrawing(g) {
    /*
      let everyone call dirtyCanvas when they've made a change, so we
      can avoid slow draws piling up (especially on the phone version)
    */
    var drawScheduled = false;
    function maybeDraw() {
	if (drawScheduled) {
	    g.draw();
	    drawScheduled = false;
	}
    }
    function dirtyCanvas() {
	drawScheduled = true;
	setTimeout(maybeDraw, 1);
    }
    return dirtyCanvas;
}

function setupDragZoom(g, coords, dirtyCanvas, useScaleSlider) {
    var dragStartWorld;
    function onMove(e) {
	var pos = getPosition(g.canvas, e);
	var currentWorld = coords.toWorld(pos);
	coords.setCenter(coords.center.add(dragStartWorld.subtract(currentWorld)));
	dirtyCanvas();
	return false;
    }
    jQuery(g.canvas).mousedown(function (e) {
	var pos = getPosition(g.canvas, e);
	dragStartWorld = coords.toWorld(pos);
	g.canvas.onmousemove = onMove;
    }).mouseup(function (e) {
	g.canvas.onmousemove = null;
    }).mouseout(function (e) {
	g.canvas.onmousemove = null;
    }).bind('mousewheel', function (event, delta) {
	var mouseCanvas = getPosition(g.canvas, event);
	zoomAbout(g.canvas, coords, Math.pow(1.3, delta), mouseCanvas);
	if (useScaleSlider) {
	    jQuery("#scale").slider({value: coords.scale});
	}
	dirtyCanvas();
	return false;
    });
}

function setupPinch(g, coords, dirtyCanvas) {
    var scaleStart;
    var dragStartWorld;
    return {
	pinchStart: function(x, y, scale) {
	    // i bet they're passing me screen x/y, so this is only right if the page scroll offsets are 0
	    var pos = getPosition(g.canvas, {pageX: x, pageY: y});
	    dragStartWorld = coords.toWorld(pos);
	    scaleStart = coords.scale;
	},
	pinchChange: function(x, y, scale) {
	    var pos = getPosition(g.canvas, {pageX: x, pageY: y});
	    var currentWorld = coords.toWorld(pos);
	    coords.setCenter(coords.center.add(dragStartWorld.subtract(currentWorld)));
	    coords.setScale(scaleStart * scale);
	    dirtyCanvas();
	}
    }   
}

function makeMap(id) {
    var $ = jQuery;
    var useScaleSlider = !window.Mojo;
    var useStomp = !window.Mojo;
    var worldExtent = findExtent(placeLoc);

    var coords = new Coords($("#"+id).width(), $("#"+id).height(), 
			    worldExtent,
			    Point(-122.346, 37.547), 7.849);

    var trailPoints = {};

    g = $g(id);
    var dirtyCanvas = setupBackgroundDrawing(g);

    var trails = new Trails(coords, trailPoints);
    g.size(coords.canMaxX, coords.canMaxY)
	.add(new Grid(coords))
    	.add('places', new Places(coords, placeLoc)) // should be getting these from server
	.add(trails);
    dirtyCanvas();

    setupDragZoom(g, coords, dirtyCanvas, useScaleSlider);
    var pinch = setupPinch(g, coords, dirtyCanvas);

    if (useScaleSlider) {
	$("#scale").slider({
	    min: .1, max: 30, step: .001, 
	    value: coords.scale, 
	    slide: function (ev, ui) {
		coords.setScale(ui.value);
		    //$("#paramDisplay").text(JSON.stringify(coords));
		dirtyCanvas();
		return true;
	    }});
    }

    function gotNewTrails(data) {
	$.extend(trailPoints, data.trailPoints);

	coords.setScale(data.scale);
	new centerPoint(coords, Point(data.center.longitude, data.center.latitude),
			function () { 
			    dirtyCanvas();
			});
    }
    function pollTrails() {
	$.getJSON("https://bigasterisk.com/map/SECRET/trails", gotNewTrails);
    }
    if (useStomp) {
	startStomp(gotNewTrails);
    } else {
	pollTrails();
    }
    
    return {
	showPeople: function () {
	    coords.viewAll(trails.currentPositions);
	    dirtyCanvas();
	},
	showTrails: function () {
	    coords.viewAll(trails.allVisiblePositions);
	    dirtyCanvas();
	},
	pollTrails: pollTrails,
	pinchStart: pinch.pinchStart,
	pinchChange: pinch.pinchChange
    }
}