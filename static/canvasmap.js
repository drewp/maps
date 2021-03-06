function Coords(canMaxX, canMaxY, worldExtent, initialCenter, initialScale) {
    var self=this;


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
    this.toCanvasFast = function (worldPoint) {
	// doesn't return a full Point, just an obj with x and y
	var m = self._world2canvas;
	return {x: m.a*worldPoint.x + m.c*worldPoint.y + m.tx,
		y: m.b*worldPoint.x + m.d*worldPoint.y + m.ty};
    }
    this.toWorldX = function (cx) {
	return self.toWorld(Point(cx, 0)).x;
    }
    this.viewAll = function (pts) {
	console.log("framing these", pts);
	var r = findExtent(pts);
	self.setCenter(Point((r.minX + r.maxX) / 2, (r.minY + r.maxY) / 2));
	var diam = Math.max(r.maxX - r.minX, r.maxY - r.minY);
	if (diam == 0) {
	    diam = .3; // for when there's only one point to frame
	}
	self.setScale(Math.pow(5/diam, 1/2) * .6); // way wrong

/*
this should take an anim duration and do an animation to the new map settings
	    // coords.setScale(data.scale);
	    new centerPointSlide(coords, Point(data.center.longitude, data.center.latitude),
				 function () { 
				     dirtyCanvas();
				 });
**/

    }
    this.updateSize = function (newWidth, newHeight) {
	self.canMinX = 0;
	self.canMinY = 0;
	self.canMaxX = newWidth;
	self.canMaxY = newHeight;
	recalc();
    }
    self.center = initialCenter;
    self.scale = initialScale;
    self.updateSize(canMaxX, canMaxY);
    recalc();
}

function dot(ctx, pt, r, width, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, 2*Math.PI, true /* clockwise */);
    ctx.fill();
    if (stroke) {
	ctx.strokeStyle = stroke;
	ctx.stroke();
    }
}

function ageDot(ctx, pt, r, width, fill, ageFraction) {
    dot(ctx, pt, r, width, fill, 'black');
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, -Math.PI/2, -Math.PI/2+Math.PI*2*ageFraction, 
            false /* clockwise */);
    ctx.lineTo(pt.x, pt.y);
    ctx.fill();
    dot(ctx, pt, r*.4, 0, fill);
}

function findExtent(placeLocs) {
    var worldExtent = {};
    jQuery.each(placeLocs, function (i, place) {
	if (place.longitude) {
	    place = ['', [place.latitude, place.longitude]]; // sic
	} else if (place.x) {
	    place = ['', [place.y, place.x]];
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
    if (_.isEmpty(worldExtent)) {
	return {minX: 0, maxX: 0, minY: 0, maxY: 0};
    }
    return worldExtent;
}

function Borders(coords) {
    /*
      mostly for debugging that the canvas edge is against the window wall
    */
    this.draw = function (ctx, canvas) {
	ctx.strokeStyle = "#aaa";
	ctx.lineWidth = 8;
	ctx.beginPath();
	ctx.moveTo(20, 20);
	ctx.lineTo(coords.canMaxX - 20, 20);
	ctx.lineTo(coords.canMaxX - 20, coords.canMaxY - 20);
	ctx.lineTo(20, coords.canMaxY - 20);
	ctx.closePath();
	ctx.stroke();
    };
}

function Grid(coords) {
    this.draw = function (ctx, canvas) {

	var worldSpacing = 1/60/60; /*deg. 1/60 of deg latitude is a nautical mile*/
	ctx.strokeStyle = "#aaa";

	var count = (coords.toWorldX(coords.canMaxX) - coords.toWorldX(coords.canMinX)) / worldSpacing;
	var canvasSpacing = (coords.canMaxX - coords.canMinX) / count;

        if (canvasSpacing < 0.03) {
            worldSpacing *= 60*60;
            ctx.strokeStyle = "#55a";
        } else if (canvasSpacing < 1.0) {
	    worldSpacing *= 60*5;
	    ctx.strokeStyle = "#a5a";
	} else if(canvasSpacing < 2.5) {
	    worldSpacing *= 60;
	    ctx.strokeStyle = "#aa5";
	} else if(canvasSpacing < 25) {
	    worldSpacing *= 10;
	    ctx.strokeStyle = "#5aa";
	}

	ctx.lineWidth = .3;
	ctx.beginPath();
	for (var wx = coords.worldExtent.minX; wx < coords.worldExtent.maxX; wx += worldSpacing /*deg*/) {
	    var cx = coords.toCanvas(Point(wx, 0)).x;
	    if (cx > 0 && cx < coords.canMaxX) {
		ctx.moveTo(cx, coords.canMinY);
		ctx.lineTo(cx, coords.canMaxY);
	    }
	}
	for (var wy = coords.worldExtent.minY; wy < coords.worldExtent.maxY; wy += worldSpacing /*deg*/) {
	    var cy = coords.toCanvas(Point(0, wy)).y;
	    if (cy > 0 && cy < coords.canMaxY) {
		ctx.moveTo(coords.canMinX, cy);
		ctx.lineTo(coords.canMaxX, cy);
	    }
	}
	ctx.stroke();
    };
}

function RadialGrid(center, coords) {
    this.draw = function (ctx, canvas) {
	ctx.lineWidth = 2;

	for (var ring=0; ring<10; ring++) {
	    var worldSpacing=.02 * (ring+1); /*deg longitude*/
	    var opacity = 1 - ring/(10+1);
	    ctx.strokeStyle = "rgba(47,110,56,"+Math.pow(opacity, 2)+")";
	    ctx.beginPath();
	    var c = coords.toCanvas(center);
	    var r = coords.toCanvas({x: center.x + worldSpacing, y: center.y});
	    ctx.arc(c.x, c.y, r.x - c.x, 0, Math.PI*2, true);
	    ctx.closePath();
	    ctx.stroke();
	}
    };
}

function PlaceDraw(opts, coords, places) {

    function searchVisiblePlaces(coords) {
	var wmin = coords.toWorld(
	    Point(coords.canMinX - 200, // display text even when the point is off left
		  coords.canMaxY));
	var wmax = coords.toWorld(Point(coords.canMaxX, coords.canMinY));
	var worldView = {x: wmin.x, y: wmin.y, w: wmax.x - wmin.x, h: wmax.y - wmin.y};
	return places.search(worldView);
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

    function drawLabel(ctx, opts, box, name) {
	ctx.fillStyle = "rgba("+opts.placeColorRgb+","+(.7 - box.foundDist / 8)+")";

	// might look good for the labels closest to people were drawn bigger
	ctx.font = ""+opts.placeFontSize+"px sans-serif";
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";

	ctx.fillText(name, box.x, box.y);
    }

    this.draw = function (ctx, canvas) {

	var visiblePlaces = searchVisiblePlaces(coords);

	placeLabels = new RTree(); // canvas rectangles I've drawn -> place obj

	visiblePlaces.sort(function (a,b) { return a.order - b.order });

	// this is a bottleneck, and maybe could be split into web workers
	jQuery.each(visiblePlaces, function(i, place) {	
	    var cp = coords.toCanvasFast(place.worldPoint);

	    var name = place.label;
	    var width = ctx.measureText(name).width;
	    
	    dot(ctx, cp, 2, .4, 'black', 'white');

	    var box = selectPosition(placeLabels, cp, width, opts.placeFontSize);
	    if (!box) {
		return;
	    }
	    drawLabel(ctx, opts, box, name);
	    placeLabels.insert(box, place);
	});

    }
}

function Trails(coords, styles, trailPoints) {
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

	if (n < 2) {
	    return;
	}

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
	jQuery.each(trailPoints.points, function (name, pts) {
            var settings = styles[name];

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
	});
    }
}


function distHaversine(lon1, lat1, lon2, lat2) {
    // http://www.movable-type.co.uk/scripts/latlong.html
    var R = 6371; // km
    var rad = Math.PI / 180;
    var dLat = (lat2-lat1) * rad;
    var dLon = (lon2-lon1) * rad;
    var lat1 = lat1 * rad;
    var lat2 = lat2 * rad;

    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d; // km
}

function PersonMarkers(coords, styles, trailPoints) {
    var self = this;

    function drawDistances(ctx, markers) {

        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(150,150,250,1)";

        for (var i=0; i < markers.length; i++) {
            for (var j=i+1; j < markers.length; j++) {
                var m1=markers[i], m2=markers[j];

                var box = Math.max(Math.abs(m1.canvasPoint.x - m2.canvasPoint.x), 
                                   Math.abs(m1.canvasPoint.y - m2.canvasPoint.y));
                if (box < 20) {
                    continue;
                }

                ctx.beginPath();
		ctx.moveTo(m1.canvasPoint.x, m1.canvasPoint.y);
		ctx.lineTo(m2.canvasPoint.x, m2.canvasPoint.y);
                ctx.stroke();

                var km = distHaversine(m1.point.x, m1.point.y,
                                       m2.point.x, m2.point.y);
                var miles = km * 0.621371192;
	        ctx.fillStyle = "black";
	        ctx.font = "10px sans-serif";

                ctx.fillText(miles.toFixed(2) + " mi", 
                             (m1.canvasPoint.x + m2.canvasPoint.x) / 2,
                             (m1.canvasPoint.y + m2.canvasPoint.y) / 2);
            }
        }
    }
    function ageFraction(secs) {
        return Math.pow(secs/86400, .5)
    }
    function ageLabel(secs) {
        if (secs < 60) {
            return '' + Math.round(secs) + 's';
        }
        if (secs < 60 * 60) {
            return '' + Math.round(secs / 60) + 'm';
        }
        if (secs < 60 * 60 * 10) {
            return '' + Math.round(secs / 3600) + 'h';
        }
        return '10h+';
    }
    function drawMarkers(ctx, markers) {
        $.each(markers, function (i, m) {
	    ageDot(ctx, m.canvasPoint, 14, 1, m.settings.dotFill, 
                   ageFraction(m.ageSecs));
            // when you hover or poke the dot, it would be nice to
            // pint the exact time and other stats
	    ctx.fillStyle = "black";
	    ctx.font = "16px sans-serif";
	    ctx.fillText(m.settings.initial, 
			 m.canvasPoint.x-6*m.settings.initial.length, 
			 m.canvasPoint.y+6);
	    ctx.font = "12px sans-serif";
            ctx.fillText(ageLabel(m.ageSecs), m.canvasPoint.x + 15,
                         m.canvasPoint.y + 4);
        });
    }

    this.draw = function(ctx, canvas) {
        var markers = [];
	jQuery.each(trailPoints.points, function (name, pts) {
            var settings = styles[name];

            if (pts.length >= 1) {
	        var lastPoint = pts[pts.length - 1];
                var ageSecs = ((+new Date()) - lastPoint.t_ms) / 1000;
                var p = Point(lastPoint.longitude, lastPoint.latitude);
	        var cp = coords.toCanvas(p);
                markers.push({point: p, canvasPoint: cp, settings: settings, 
                              ageSecs: ageSecs});
            }
        });
        drawDistances(ctx, markers);
        drawMarkers(ctx, markers);
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

function centerPointSlide(coords, pt, redraw) {
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


    function down(e) {
	var pos = getPosition(g.canvas, e);
	dragStartWorld = coords.toWorld(pos);
	$(g.canvas).bind("vmousemove", onMove);
    }
    function up(e) {
	$(g.canvas).unbind("vmousemove", onMove);
    }

    function getWheelDelta(event) {
	var oe = event.originalEvent;
	return oe.wheelDeltaY ? (oe.wheelDeltaY / 120) : (oe.detail / -3);
    }

    jQuery(g.canvas).
	bind("vmousedown", down).
	bind("vmouseup", up).
	bind("mouseout", function (e) {
	    g.canvas.onmousemove = null;
	}).bind('mousewheel', function (event, delta) {
	    var mouseCanvas = getPosition(g.canvas, event.originalEvent);

	    zoomAbout(g.canvas, coords, 
		      Math.pow(1.3, getWheelDelta(event)), 
		      mouseCanvas);
	    if (useScaleSlider) {
		var s = jQuery("#scale");
		s.val(coords.scale).slider("refresh");
	    }
	    dirtyCanvas();
	    return false;
	});
//	bind('touchstart', down).
//	bind('touchend', up);
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

function makeMap(id, _opts) {
    var $ = jQuery;
    var opts = {
	useScaleSlider: !window.Mojo,
	useStomp: !window.Mojo,
	startCenter: Point(-122.346, 37.547),
	startZoom: 7.849,
	motion: "auto",
	grid: true,
	radialGrid: false,
	placeFontSize: 10,
	placeColorRgb: "0,0,0",
	styles: {}, // user uri : styles
    };
    $.extend(opts, _opts || {});

    var worldExtent = findExtent([]);

    var canvas = $("#"+id);
    var canvasCell = $("#mapAreaSize");
    var coords = new Coords(window.innerWidth, window.innerHeight,
			    worldExtent,
			    opts.startCenter, opts.startZoom);
    window.addEventListener('resize', function() { 
	canvas[0].width = window.innerWidth;
	canvas[0].height = window.innerHeight;
	coords.updateSize(canvas[0].width, canvas[0].height);
	dirtyCanvas();
    }, false);

	
    var trailPoints = {points: {}}; // 'points' : {user : updates},
                                    // always maintained to the
                                    // current set we want to show

    g = $g(id);
    var dirtyCanvas = setupBackgroundDrawing(g);

    function redrawLoop() {
	/* keep redrawing so the wedges grow correctly */
	setTimeout(function ()  {
	    requestAnimFrame(function () {
		dirtyCanvas();
		redrawLoop();
	    });
	}, 5000);
    }
    redrawLoop();

    var trails = new Trails(coords, opts.styles, trailPoints);
    var personMarkers = new PersonMarkers(coords, opts.styles, trailPoints);
    g.size(coords.canMaxX, coords.canMaxY);
    g.add(new Borders(coords));
    if (opts.grid) {
	g.add(new Grid(coords));
    }
    if (opts.radialGrid) {
	g.add(new RadialGrid(opts.startCenter, coords));
    }

    var places = new Places();
    $(window).bind("locationsChanged", dirtyCanvas);

    g.add('places', new PlaceDraw(opts, coords, places));
    g.add(trails);
    g.add(personMarkers);
    dirtyCanvas();

    setupDragZoom(g, coords, dirtyCanvas, opts.useScaleSlider);
    var pinch = setupPinch(g, coords, dirtyCanvas);

    if (opts.useScaleSlider) {
	var s = $("#scale");
	s.val(coords.scale).slider({
	    orientation: "vertical", 

	}).slider("refresh");
	
	s.bind("change", function (ev) {
	    coords.setScale($(ev.target).val());
	    //$("#paramDisplay").text(JSON.stringify(coords));
	    dirtyCanvas();
	    return true;
	});
    }

    function gotNewTrails(data, usersToFrame, pointsToFrame) {

	trailPoints.points = data.trailPoints;

        var toView = [];
        (usersToFrame || []).forEach(function(u) {
            if (data.trailPoints[u].length >= 1) {
                toView.push(_.last(data.trailPoints[u]));
            }
        });
        (pointsToFrame || []).forEach(function(p) {
            toView.push(p);
        });
        
	coords.viewAll(toView);
	dirtyCanvas();
    }

    if (opts.useStomp) {
	startStomp(gotNewTrails);
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
        gotNewTrails: gotNewTrails,
	pinchStart: pinch.pinchStart,
	pinchChange: pinch.pinchChange,
        places: places
    }
}
