/**
 * Created by vseereer on 11/19/15.
 */

var proxy = require('express-http-proxy');
var url =  require('url');
var path = require('path');
var express = require('express');
var app = express();

app.use('/api', proxy('http://ctao-sdn-03', {
    port: 8181,
    forwardPath: function(req, res) {
        return url.parse(req.url).path;
    }
}));

app.use('/api2', proxy('http://localhost', {
    port: 8282,
    forwardPath: function(req, res) {
        return url.parse(req.url).path;
    }
}));

app.use(
    "/", //the URL throught which you want to access to you static content
    express.static(__dirname) //where your static content is located in your filesystem
);
app.listen(8000); //the port you want to use

console.log('Serving IoT VizConf @ 8000');
