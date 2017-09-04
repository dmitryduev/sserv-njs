/*
    node.js/socket.io-based web-server for monitoring status telemetry

    Dr. Dmitry A. Duev
    California Institute of Technology
 */

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs'); // for reading local files
var nunjucks = require('nunjucks'); // template rendering
const exec = require('child_process').exec;

var ncp = require('ncp').ncp;
ncp.limit = 8;

// flavicon
//var favicon = require('serve-favicon');
//app.use(favicon('public/robot-favicon.png'));

// configure nunjucks
nunjucks.configure('templates', {
    autoescape: true,
    express: app
});
// make it more pythonic
nunjucks.installJinjaCompat();

// serve static files:
app.use('/static', express.static('public'));

// get/parse config.json
var config_file = './config.json';
if (process.argv.length > 2) {
    if (process.argv[2][0] != '/' && process.argv[2][0] != '.') {
        config_file = './' + process.argv[2];
    }
    else {
        config_file = process.argv[2]
    }
}
var config = require(config_file);

// build a skeleton to make index.html from a template
function skeleton(config) {
    var skelet = {};
    //console.log(config);

    // iterate over systems:
    for (var system in config) {
        //console.log(system);
        // reserve a spot:
        skelet[system] = {'globals':{}, 'subs':{}};

        // iterate over sub-systems and global parameters:
        for (var key in config[system]) {
            // skip 'data-file' param
            if (key == 'data-file') continue;
            //console.log('\t', key, config[system][key] instanceof Array);
            // global param?
            if (config[system][key] instanceof Array) {
                skelet[system]['globals'][key] = [];
            }
            else {
                skelet[system]['subs'][key] = {};
                for (var key2 in config[system][key]) {
                    skelet[system]['subs'][key][key2] = [];
                }
            }

        }
    }
    //console.log(skelet);
    return skelet;
}


// Extract telemetry data
function fetch(config) {
    var data = {};

    // iterate over systems:
    for (var system in config) {
        //console.log(system);
        // status data file (one-liner):
        var status_file = config[system]['data-file'];
        try {
            var status_data = fs.readFileSync(status_file, 'utf8');

            // split line:
            var line = status_data.split(/[\s,]+/);
            // no money - no honey
            if (line.length<3) throw "Too short, Johnny";
            //console.log(line, line.length);

            // reserve a spot:
            data[system] = {'globals':{}, 'subs':{}};

            // iterate over sub-systems and global parameters:
            inner:  for (var key in config[system]) {
                // skip 'data-file' param
                if (key == 'data-file') continue inner;
                //console.log('\t', key, config[system][key] instanceof Array);
                // global param?
                var val = config[system][key];
                if (val instanceof Array) {
                    val[0].length == 1 ? data[system]['globals'][key] = line[val[0][0]] :
                        data[system]['globals'][key] =
                            line.slice(val[0][0],val[0][val[0].length-1]).join(" ");

                    var tmp = data[system]['globals'][key];
                    // get color:
                    var color_code = 'default';

                    // it's not str8forward with the Time stamp -
                    // deal with it separately
                    // config.json lists ranges in seconds WRT datetime.now()
                    // beware that it should all be in UTC!
                    if (key.toLowerCase().indexOf("time") != -1 && key.toLowerCase().indexOf("stamp") != -1) {
                        var then = Date.parse(data[system]['globals'][key] + " UTC");
                        var now = Date.now();
                        // time between now and then in seconds:
                        tmp = (then-now)*1e-3;
                        //console.log(parseFloat(tmp));
                    }

                    // for the rest of the global params it is str8forward
                    for (var code in config[system][key][1]) {
                        var rng = config[system][key][1][code];
                        if (rng[0] instanceof Array) {
                            // console.log(system, key, code, rng);
                            rng.forEach(function(rn, i, rng) {
                                // console.log(rn, tmp, parseFloat(tmp), rn[0]<= parseFloat(tmp), parseFloat(tmp) < rn[1]);
                                if (rn[0]<= parseFloat(tmp) && parseFloat(tmp) < rn[1]){
                                    color_code = code;
                                }
                            });
                        }
                        else {
                            if (rng.indexOf(tmp) != -1) {
                                color_code = code;
                            }
                        }
                    }

                    // get plotting switch:
                    var plot_switch = config[system][key][2][0];
                    var plot_length = 600;
                    var plot_time_scale = "UTC";
                    // number of points and time scale set?
                    if (config[system][key][2].length > 1) {
                        plot_length = config[system][key][2][1];
                        plot_time_scale = config[system][key][2][2];
                    }
                    // get 'critical' switch:
                    var critical_switch = config[system][key][3];
                    data[system]['globals'][key] = [data[system]['globals'][key],
                        color_code, plot_switch, plot_length, plot_time_scale, critical_switch];
                }
                else {
                    data[system]['subs'][key] = {};
                    for (var key2 in val) {
                        var val2 = config[system][key][key2];
                        //data[system]['subs'][key][key2] = [];
                        val2[0].length == 1 ? data[system]['subs'][key][key2] = line[val2[0][0]] :
                            data[system]['subs'][key][key2] =
                                line.slice(val2[0][0],val2[0][val2[0].length-1]).join(" ");

                        var tmp = data[system]['subs'][key][key2];
                        // get color:
                        var color_code = 'default';

                        for (var code in config[system][key][key2][1]) {
                            var rng = config[system][key][key2][1][code];
                            if (rng[0] instanceof Array) {
                                //console.log(key, code, rng);
                                rng.forEach(function(rn, i, rng) {
                                    if (rn[0]<= parseFloat(tmp) && parseFloat(tmp) < rn[1]){
                                        //console.log(code, parseFloat(tmp), rn);
                                        color_code = code;
                                    }
                                });
                            }
                            else {
                                if (rng.indexOf(tmp) != -1) {
                                    color_code = code;
                                }
                            }
                        }

                        // get plotting switch:
                        var plot_switch = config[system][key][key2][2][0];
                        var plot_length = 600;
                        var plot_time_scale = "UTC";
                        // number of points and time scale set?
                        if (config[system][key][key2][2].length > 1) {
                            plot_length = config[system][key][key2][2][1];
                            plot_time_scale = config[system][key][key2][2][2];
                        }
                        // get 'critical' switch:
                        var critical_switch = config[system][key][key2][3];
                        data[system]['subs'][key][key2] = [data[system]['subs'][key][key2],
                            color_code, plot_switch, plot_length, plot_time_scale, critical_switch];
                    }
                }

            }

        }
        catch(err) {
            // no money - no honey
            //console.log(err);
            continue;
        }

    }

    //console.log(data);
    //console.log(data['ADC']['globals']['Updating']);
    //console.log(data['ADC']['globals']['Time stamp']);

    return data;
}

// run status page
app.get('/', function(req, res){
    // make skeleton:
    var skelet = skeleton(config);
    //console.log(skelet);
    // create html from a template and send it to user:
    //res.sendFile('/Users/dmitryduev/web/sserv-njs/templates/index.html');
    res.render('status.html', {skelet:skelet});
});

// run image page
app.get('/image', function(req, res){
    res.render('image.html');
});

// io.on('connection', function(socket){
    // console.log('a user connected');
    // socket.on('disconnect', function(){
    //     console.log('user disconnected');
    // });
    /*
    socket.on('chat message', function(msg){
        console.log('message: ' + msg);
        io.emit('chat message', msg);
    });
    */
// });


// start listening
http.listen(8080, function(){
    console.log('listening on *:8080');
});


// Copy telemetry data from NFS to local disk
// mkdir telemetry if doesn't exist
// if (!fs.existsSync('telemetry')){
//     fs.mkdirSync('telemetry');
// }

function cpLoop(source, destination) {
    ncp(source, destination, function (err) {
        if (err) {
            return console.error(err);
        }
        // console.log('done!');
    });
    setTimeout(function() {cpLoop(source, destination)}, 700);
}
// cpLoop('/Users/dmitryduev/web/sserv/telemetry/', 'telemetry/');
// cpLoop('/home/roboao/Status/', 'telemetry/');

// Extract and stream telemetry data

// telemetry streaming loop
function Loop() {
    // extract telemetry:
    var data = fetch(config);
    //io.emit('telemetry', JSON.stringify(data));
    io.emit('telemetry', data);
    //socket.volatile.emit
    //socket.broadcast.emit
    setTimeout(function() {Loop()}, 900);
}

Loop();

// Stream images

// generate png files
var cmd = '/home/roboao/Work/dima/sserv-njs/lib/png2 /home/roboao/Work/dima/sserv-njs/public /home/roboao/Status';
// var cmd = 'ls';

// telemetry streaming loop
function LoopImg() {
    // generate png files, then stream 'em
    exec(cmd, function(error, stdout, stderr) {
        // command output is in stdout
        //console.log(stdout);
        //console.log(stderr);
        //console.log(error);
        if (error == null) {
            fs.readFile('public/dm.png', function(err, buf){
                // io.emit('dm', { image: true, buffer: buf.toString('base64') });
                io.emit('dm', { image: true, buffer: buf });
            });
            fs.readFile('public/wfs.png', function(err, buf){
                // io.emit('wfs', { image: true, buffer: buf.toString('base64') });
                io.emit('wfs', { image: true, buffer: buf });
            });
            fs.readFile('public/vicd.png', function(err, buf){
                // io.emit('vicd', { image: true, buffer: buf.toString('base64') });
                io.emit('vicd', { image: true, buffer: buf });
                // console.log('sent!')
            });
        }
    });
    setTimeout(function() {LoopImg()}, 900);
}

LoopImg();
