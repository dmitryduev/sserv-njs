**System monitoring interface with node.js/socket.io back-end.**

This is how to deploy it:

- Clone the repository:

	git clone https://github.com/dmitryduev/sserv-njs.git

- In index.js and config.json, replace the necessary absolute paths

- Install node.js and npm if necessary

- Install app dependencies (express and socket.io):

	npm install

- Install pm2 manager:

	npm install pm2 -g

- Run the server as a daemon:

	pm2 start index.js

- To monitor performance:

	pm2 monit
