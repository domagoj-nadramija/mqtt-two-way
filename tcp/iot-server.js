const net = require("net");
const fs = require("fs");
const { v4: uuidv4 } = require('uuid');

const config = JSON.parse(fs.readFileSync(__dirname+"/config.json"));

console.log(`Starting TCP IoT server on port ${config.server.port}`);

const server = net.createServer((socket) => {
  const connPort = socket.remotePort;
  console.log(`New connection from ${connPort}`);

  // this simulates the user or an automated system sending commands to the device
  const commandSendInterval = setInterval(() => {
    const command = JSON.stringify({ uuid: uuidv4(), command: "GET_STATUS" });
    console.log(`Sending command ${command} to ${connPort}`);
    socket.write(command);
  }, 10000);

  socket.on("data", (data) => {
    console.log(`Got data from ${connPort}:`, data.toString());
    try {
        JSON.parse(data);
    } catch (error) {
        console.warn("Data is not valid JSON and will be dropped");
        return;
    }
    console.log("Data is valid JSON and will be stored");
    storeData(data);
  });
  socket.on("close", () => {
    console.log(`Closing connection to ${connPort}`);
    clearInterval(commandSendInterval);
  });
  socket.on("error", (error) => {
    console.log(`Error with connection to ${connPort}:`, error.code);
    clearInterval(commandSendInterval);
  });
});

server.listen(config.server.port, "127.0.0.1");

function storeData (data) {}
