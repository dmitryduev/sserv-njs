/*
    node.js/socket.io-based web-server for monitoring status telemetry

    Dr. Dmitry A. Duev
    California Institute of Technology
 */

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ss = require('socket.io-stream');
var chokidar = require('chokidar');
var fs = require('fs'); // for reading local files
var nunjucks = require('nunjucks'); // template rendering
const exec = require('child_process').exec;

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

// get log file names for rendering the log page at init
function logNames(logs_config) {
    var path;
    var filelist = {};
    // iterate over specified sorts of logs
    for (var key in logs_config) {
        if (logs_config.hasOwnProperty(key)) {
            // get location
            path = logs_config[key]['location'];
            // get all files in the directory
            var cfiles = fs.readdirSync(path);
            // note
            // if type is 'dynamic', will watch changes in tail -f manner
            // if type is 'static' will just open log files in new window
            filelist[key] = {'type': logs_config[key]['type'],
                             'files': []};
            cfiles.forEach(function(file) {
                // file has right extension?
                var right_extension = false;
                for (var i = 0; i < logs_config[key]['extensions'].length; i++) {
                    right_extension = right_extension || file.endsWith(logs_config[key]['extensions'][i]);
                }
                // push to filelist if has right extension and not invisible
                if (right_extension && !file.startsWith('.')) {
                    filelist[key]['files'].push(file);
                }
            });
        }
    }

    return filelist;
}

// serve 'static' log files:
for (var key in config["logs"]) {
    if (config["logs"].hasOwnProperty(key)) {
        if (config["logs"][key]['type'] == 'static') {
            app.use('/' + key.replace(/\s+/g, '-').toLowerCase(), express.static(config["logs"][key]['location']));
            // console.log();
        }
    }
}

// serve 'dynamic' log files:
var watchers = {};
for (var key in config["logs"]) {
    if (config["logs"].hasOwnProperty(key)) {
        if (config["logs"][key]['type'] == 'dynamic') {
            // wildcards to watch over:
            var wildcards = [];
            for (var i = 0; i < config["logs"][key]['extensions'].length; i++) {
                wildcards.push(config["logs"][key]['location'] + '*.' + config["logs"][key]['extensions'][i]);
            }
            // Initialize watcher
            // console.log(wildcards);
            var watcher = chokidar.watch(wildcards, {
                ignored: /(^|[\/\\])\../,
                persistent: true
            });
            watchers[key] = watcher;
        }
    }
}
// Add event listeners for dynamic logs. see https://github.com/paulmillr/chokidar for examples
// io.on('connection', function(socket) {
    var dynamic_logs = {};
    for (var key in watchers) {
        // key: log group
        if (watchers.hasOwnProperty(key)) {
            // init container
            dynamic_logs[key] = {};
            // started watching or new log file appeared
            watchers[key].on('add', function (path, stats) {
                // console.log(path, ' added. Size:', stats.size);
                var log_name = path.replace(/^.*[\\\/]/, '');
                // console.log(log_name);
                var prev = stats.size;
                var curr = stats.size;
                dynamic_logs[key][log_name] = {'prev': prev, 'curr': curr};
                io.emit('add_log', {log_group: key.replace(/\s+/g, '-').toLowerCase(), log_name: log_name});
            });
            // log file changed
            watchers[key].on('change', function (path, stats) {
                // console.log(path, ' changed. Size:', stats.size);
                var log_name = path.replace(/^.*[\\\/]/, '');
                // new file size:
                dynamic_logs[key][log_name]['curr'] = stats.size;
                // current size less than previous? that's bad, fix that!
                if (dynamic_logs[key][log_name]['curr'] < dynamic_logs[key][log_name]['prev']) {
                    dynamic_logs[key][log_name]['prev'] = dynamic_logs[key][log_name]['curr'];
                }
                // no? stream the new stuff then!
                else {
                    // create read stream:
                    var rstream = fs.createReadStream(path, {encoding: 'utf8',
                                                             start: dynamic_logs[key][log_name]['prev'] - 1,
                                                             end: dynamic_logs[key][log_name]['curr'] - 1});
                    rstream.on('data', function (chunk) {
                        var lines = chunk.split("\n");
                        for (var i = 0; i < lines.length; i++) {
                            if (lines[i]) {
                                // emit socket.io event to be caught by log.html
                                io.emit('new_log_line', {log_group: key.replace(/\s+/g, '-').toLowerCase(),
                                    log_name: log_name, line: lines[i]});
                                // console.log(lines[i]);
                            }
                        }
                    });
                    // update previous file size once done:
                    dynamic_logs[key][log_name]['prev'] = dynamic_logs[key][log_name]['curr'];
                }
            });
            // log file deleted
            watchers[key].on('unlink', function (path) {
                // console.log(path, ' removed');
                var log_name = path.replace(/^.*[\\\/]/, '');
                io.emit('remove_log', {log_group: key.replace(/\s+/g, '-').toLowerCase(), log_name: log_name});
            });
        }
    }
// });

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
        }

    }

    return data;
}


// run status page
app.get('/', function(req, res){
    // make skeleton:
    var skelet = skeleton(config['status']);
    // console.log(skelet);
    //res.sendFile('/Users/dmitryduev/web/sserv-njs/templates/index.html');
    // create html from a template and send it to user:
    // console.log(config['external_links']);
    res.render('status.html', {logo: config['settings']['logo'], skelet: skelet,
                               logo_font_family: config['settings']['logo-font-family'],
                               external_links: config['external_links']});
});

// run image page
app.get('/image', function(req, res){
    res.render('image.html', {logo: config['settings']['logo'],
                              logo_font_family: config['settings']['logo-font-family'],
                              external_links: config['external_links']});
});

// run log page
app.get('/log', function(req, res){
    // get file names:
    var log_names = logNames(config['logs']);
    // console.log(log_names);
    res.render('log.html', {logo: config['settings']['logo'],
                            logo_font_family: config['settings']['logo-font-family'],
                            log_names: log_names, max_log_lines: config['settings']['max_dynamic_log_lines'],
                            external_links: config['external_links']});
});



// start listening
http.listen(config['settings']['port'], function(){
    console.log('listening on *:' + config['settings']['port']);
});


// Extract and stream telemetry data

// telemetry streaming loop
function Loop() {
    // extract telemetry:
    var data = fetch(config['status']);
    //io.emit('telemetry', JSON.stringify(data));
    io.emit('telemetry', data);
    //socket.volatile.emit
    //socket.broadcast.emit
    setTimeout(function() {Loop()}, config['settings']['telemetry_update_ms']);
}

Loop();

// Stream images

// generate png files
var cmd = config['images']['generate_cmd'];

// telemetry streaming loop
function LoopImg() {
    // generate png files, then stream 'em
    exec(cmd, function(error, stdout, stderr) {
        // command output is in stdout
        //console.log(stdout);
        //console.log(stderr);
        //console.log(error);
        if (error == null) {
            fs.readFile(config['images']['location'] + '/dm.png', function(err, buf){
                // io.emit('dm', { image: true, buffer: buf.toString('base64') });
                io.emit('dm', { image: true, buffer: buf });
            });
            fs.readFile(config['images']['location'] + '/wfs.png', function(err, buf){
                // io.emit('wfs', { image: true, buffer: buf.toString('base64') });
                io.emit('wfs', { image: true, buffer: buf });
            });
            fs.readFile(config['images']['location'] + '/vicd.png', function(err, buf){
                // io.emit('vicd', { image: true, buffer: buf.toString('base64') });
                io.emit('vicd', { image: true, buffer: buf });
                // console.log('sent!')
            });
        }
    });
    setTimeout(function() {LoopImg()}, config['settings']['images_update_ms']);
}

LoopImg();
