const net = require("net");
const fs = require("fs");

const DEVICE_ID = "test-device-tcp-0001";

console.log(`Starting TCP IoT device <${DEVICE_ID}>`);

const config = JSON.parse(fs.readFileSync(__dirname+"/config.json"));

console.log(`Will connect to ${config.server.host}:${config.server.port}`)

const client = new net.Socket();

client.connect(config.server.port, config.server.host, function () {
  console.log("Connected to server");
  client.write(JSON.stringify({ device_id: DEVICE_ID, message_type: "SIGNUP"}));
  // this simulates the device collecting and sending sensor data
  const dataSendInterval = setInterval(() => {
    const data = JSON.stringify({ device_id: DEVICE_ID, message_type: "DATA", temp: 23.6, lat: 48.015722, lng: -88.625528});
    console.log(`Sending data ${data} to server`);
    client.write(data);
  }, 5000);

  client.on("data", (data) => {
	command = data.toString();
	console.log("Received command: " + command);
	execute(command);
	const commandResp = JSON.stringify({ device_id: DEVICE_ID, message_type: "COMMAND_RESP", command: command, success: true});
	console.log(`Sending command response ${commandResp} to server`);
	client.write(commandResp);
  });

  client.on("close", () => {
	console.log("Connection closed");
	clearInterval(dataSendInterval);
  });
  
  client.on("error", (error) => {
	console.log(`Error during connection: ${error.code}`);
	clearInterval(dataSendInterval);
  });
});

function execute(command) {}
