#!bin/node

var express = require('express');
var socketIo = require('socket.io');
var httpProxy = require('http-proxy');
var superagent = require('superagent');
var Connect = require('connect');
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var Mu = require('Mu');
Mu.templateRoot = './templates/';

var proxy = new httpProxy.RoutingProxy();

var app = express.createServer();
app.listen(9085);

console.log('users come to http://localhost:9085/');

var am = assetManager({
    'js' : {
        path: __dirname + "/",
        route: /\/bundle\.js/,
        dataType: 'js',
        files: [
            'sendpos/app/assistants/gury/gury.js',
            'sendpos/app/assistants/matrix.js/matrix.js',
            'sendpos/app/assistants/RTree/src/rtree.js',
            'sendpos/app/assistants/jquery.mousewheel.3.0.2/jquery.mousewheel.min.js',
            'parts/node/lib/node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js',
            'backgroundmap.js',
            'sendpos/app/assistants/canvasmap.js'
        ],
        debug: process.env.NODE_ENV != "production",
    },
    'css' : {
        path: __dirname + "/",
        route: /\/bundle\.css/,
        dataType: 'css',
        debug: process.env.NODE_ENV != "production",
        files: ["static/jquery-ui-1.8.17.custom/css/smoothness/jquery-ui-1.8.17.custom.css"]
    }
});
app.use(am);


var io = socketIo.listen(app);
io.configure(function () {
    io.set('transports', ['xhr-polling']);
    io.set('log level', 2);
});

io.sockets.on('connection', function (socket) {
    socket.join("mapUpdate");
});

app.get("/", function (req, res) { 
    res.header("content-type", "application/xhtml+xml");
    superagent.get("http://localhost:9084/places", function (mapIds) {
        var j = 0;
        mapIds = mapIds.body.mapIds.map(function (id) { j++; return {id: id, row: j} });
        var ctx = {
            bundleCss: am.cacheHashes['css'],
            bundleJs: am.cacheHashes['js'],
            mapIds: mapIds
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

