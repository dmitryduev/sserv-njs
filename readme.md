### System monitoring interface with node.js/socket.io-based back-end and bootstrap v4-based front-end for Robo-AO. 

#### Deployment

- Install node.js and npm if not in the system. The code now uses socket.io v2, which in turn requires a fairly
recent version of node.js (>4). In case that is not available on your system with the default package manager, install 
node.js manually. For example, on Fedora 21:
```bash
# remove old nodejs version:
yum remove nodejs
# get version 4.x from node's official repository:
curl --silent --location https://rpm.nodesource.com/setup_4.x | bash -
yum install -y nodejs
```  

- Install pm2 process manager:

```bash
npm install pm2 -g
```

- Clone the repository and install node.js app dependencies:

```bash
git clone https://github.com/dmitryduev/sserv-njs.git
cd sserv-njs
npm install
```

- Edit config.json - change settings including those for logs and telemetry files 
(paths could be both abs and rel) and description of their content

- Run the server as a daemon (from the cloned directory!):

```bash
pm2 start server_status.js -- config.json
```

By default, the server will run on port 8080. That could be changed in _config.json_.

- To monitor performance:

```bash
pm2 monit
```

- To set up pm2 to run/resurrect at system startup/reboot:

```bash
pm2 startup
```
The output of this command can be a recommendation of the line to copy/paste 
with all environment variables and options configured for you.

Once you started all the applications you want to manage, you can save the list across expected/unexpected 
server restart by typing this command:

```bash
pm2 save
```
It will save the process list with the corresponding environments into the dump file $PM2_HOME/.pm2/dump.pm2

For more details go [here](http://pm2.keymetrics.io/docs/usage/startup/#saving-current-process-list)

#### Description of config.json

##### The "status" section 

Each defined "system" may have "global" parameters and "subsystems" with their own parameters. 
The only mandatory parameter is "data-file", which points to the telemetry file. 
The format for both the global and subsystem parameters is the same:

```
"param name": [[position_1, position_2], {"color_code": [[range_1_1, range_1_2], [...]], ...}, 
               [bool, max_length, utc_local], bool]]
```

The first arg defines the parameter index (or index range, i.e. 
position_2 is not mandatory) in the telemetry file if you read 
it in with the python _string_.split() function following the python 
indexing convention (i.e., starting from zero).

For example, the following piece of code will set up two "good" _ranges_:

```
..."success": [[-83, -77], [10, 17]]...
```

and these will set up two good _values_:

```
..."success": [-83, -77]...
..."success": ["good", "awesome"]...
```

The second arg controls coloring. It could be an empty dict {}, then no coloring will be applied. 
Otherwise the following color codes are available:
```
    "success" - green
    "warning" - yellow
    "danger" - red
    "info" - blue
```
The range for each code is a list with either a (set of) interval(s) 
or a (set of) string(s). In the special case of the "Time stamp" param, 
the ranges are in seconds.

The 3rd arg controls plotting. The first value (boolean) in the list - display plot or not; 
second \[must be set if first value is true\] - how many points to display before starting to shift the plot 
(by default - 600, which corresponds to 10 minutes
if updated each second); third \[must be set if first value is true\] - display time stamps in UTC ("UTC", default) 
or local time ("local") 

4th arg - controls if the whole panel should turn red/yellow if this param turns red/yellow


Refer to the provided config.json for examples.

##### The "log" section

The user can choose to display the logs either "dynamically" or "statically". In the first case, new entries (lines) in 
log files from a directory will be streamed to the browser. In the second case, log files will simply be open in a new tab.