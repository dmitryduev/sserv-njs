**System monitoring interface with node.js/socket.io back-end.**

This is how to deploy it:

- Clone the repository:

```
	git clone https://github.com/dmitryduev/sserv-njs.git
```

- In server_status.js and config.json, replace the necessary absolute paths

- Compile png generating software:

```
	cd lib

	make
```

- Install node.js and npm if necessary

- Install node.js app dependencies:

```
	npm install
```

- Install pm2 process manager:

```
	npm install pm2 -g
```

- Run the server as a daemon:

```
	pm2 start server_status.js
```

- To monitor performance:

```
	pm2 monit
```
