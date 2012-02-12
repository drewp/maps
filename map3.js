#!bin/node

var express = require('express');
var socketIo = require('socket.io');
var httpProxy = require('http-proxy');
var superagent = require('superagent');
var moment = require('moment');
var fs = require('fs');
var async = require('async');
var Connect = require('connect');
var mongodb = require("mongodb");
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var Mu = require('Mu');
Mu.templateRoot = './templates/';

var proxy = new httpProxy.RoutingProxy();

var app = express.createServer();
app.listen(9085);

console.log('users come to http://localhost:9085/');

var prod = process.env.NODE_ENV == "production";
var am = assetManager({
    'js' : {
        path: __dirname + "/",
        route: /\/bundle\.js/,
        dataType: 'javascript',
        files: [
            'sendpos/app/assistants/gury/gury.js',
            'sendpos/app/assistants/matrix.js/matrix.js',
            'sendpos/app/assistants/RTree/src/rtree.js',
            'sendpos/app/assistants/jquery.mousewheel.3.0.2/jquery.mousewheel.min.js',
            'parts/node/lib/node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js',
            process.env.NODE_ENV != "production" ? 'static/knockout-2.0.0.debug.js' : 'static/knockout-2.0.0.js',
            'backgroundmap.js',
            'sendpos/app/assistants/canvasmap.js'
        ],
        debug: !prod,
	postManipulate: [
	    function (file, path, index, isLast, callback) {
		    // minifier bug lets '++new Date' from
		    // socket.io.js into the result, which is a parse error.
		callback(null, file.replace(/\+\+new Date/mig, 
					    '\+\(\+new Date)'));
	    }
	]
    },
    'css' : {
        path: __dirname + "/",
        route: /\/bundle\.css/,
        dataType: 'css',
        debug: !prod,
        files: ["static/jquery-ui-1.8.17.custom/css/smoothness/jquery-ui-1.8.17.custom.css"]
    }
});
app.use(am);


var io = socketIo.listen(app);
io.configure(function () {
    io.set('resource', '/socket.io');
    io.set('transports', ['xhr-polling']);
    io.set('log level', 2);
});

io.sockets.on('connection', function (socket) {
    socket.join("mapUpdate");
});

function readConfig() {
    return JSON.parse(fs.readFileSync("priv.json", 'utf8'));
}

function getMapCollection(cb) {
    var config = readConfig();

    var m = config.mongo;
    var client = new mongodb.Db(m.db, new mongodb.Server(m.host, m.port, {}));
    client.open(function (err, pClient) {
        if (err) throw err;
        client.collection(m.collection, function (err, mongo) {
            if (err) throw err;
            cb(mongo);
        });
    });
}

function lastUpdates(cb) {
    getMapCollection(function (map) {
        map.ensureIndex({user: 1, timestamp: -1}, {}, function (err, done) {
            if (err) throw err;

            map.distinct('user', function (err, users) {
                if (err) throw err;
                users = users.filter(function (u) { return u && u != "?"; });

                async.map(users, function (u, cb2) {
                    map.findOne({user: u}, {sort: {timestamp:-1}}, cb2);
                }, function (err, updates) {
                    cb(updates);
                });
            });
        });
    });
}

function getLabelForUri(uri) { 
    var config = readConfig();
    return config.foafNames[uri] || uri;
}

app.get("/", function (req, res) { 
    res.header("content-type", "application/xhtml+xml");
    superagent.get("http://localhost:9084/places", function (mapIds) {
        lastUpdates(function (updates) {

            updates.forEach(function (u) { 
                u.label = getLabelForUri(u.user);
                var t = moment(u.timestamp);
                var now = moment();
                u.lastSeen = t.from(now);
                console.log(now, u.lastSeen, t.diff(now, 'hours'));
                if (t.diff(now, 'hours') > -20) {
                    u.lastSeen += " (" + t.format("HH:mm") + ")";
                    u.recent = true;
                } else {
                    u.recent = false;
                }
            });

            var j = 0;
            mapIds = mapIds.body.mapIds.map(function (id) { j++; return {id: id, row: j} });
            var ctx = {
                bundleCss: am.cacheHashes['css'],
                bundleJs: am.cacheHashes['js'],
                mapIds: mapIds,
                updates: updates,
                updatesJson: JSON.stringify(updates)
            };
            Mu.render('index', ctx, {cached: process.env.NODE_ENV == "production"}, 
                      function (err, output) {
                          if (err) {
                              throw err;
                          }
                          output.addListener('data', 
                                             function (c) { res.write(c); })
                              .addListener('end', function () { res.end(); });
                      });
        });
    });
});

app.get("/places", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9084});
});

app.get("/history", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/gmap", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});
app.get("/trails", function (req, res) {
    proxy.proxyRequest(req, res, {host: 'localhost', port: 9033});
});

// security trap- don't allow "/static/../secretfile" to work
app.get("/static/(bundle.js)", express.static(__dirname));
app.get("/images/*", express.static(__dirname + "/static/jquery-ui-1.8.17.custom/css/smoothness"));

var internal = express.createServer();
internal.listen(9086);
internal.use(express.bodyParser());
console.log('internal connections to http://localhost:9086/');

internal.post("/gotNewTrails", function (req, res) {
    io.sockets.in("mapUpdate").emit("gotNewTrails", req.body);
    res.send("");
});

