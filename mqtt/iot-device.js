const mqtt = require("mqtt");
const fs = require("fs");

const deviceId = "test-device-mqtt-0001";

// when command request is received, output the command to stdout and send command response on command response topic

const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"));

console.log(`STARTING MQTT IOT DEVICE <${deviceId}>`);

const dataTopic = config.dataTopic.replace("<deviceId>", deviceId);
const cmdRespTopic = config.commandResponseTopic.replace("<deviceId>", deviceId);
const registerTopic = config.registerTopic.replace("<deviceId>", deviceId);
const cmdReqTopic = config.commandRequestTopic.replace("<deviceId>", deviceId);
const subscribeTopics = [cmdReqTopic];

const client = mqtt.connect(config.broker, {
  clean: false,
  clientId: `${deviceId}-mqtt-client`,
  will: {
    qos: 2,
    retain: true,
    topic: registerTopic,
    payload: "SIGN_OUT"
  }
});

client.on("connect", (connack) => {
  console.log("CONNECTED TO MQTT BROKER");
  console.log(`SUBSCRIBING TO TOPICS ${subscribeTopics}`);
  client.subscribe(subscribeTopics, { qos: 2 }, function (err) {
    if (!err) {
      console.log("SUCCESSFULLY SUBSCRIBED");
    }
  });
  client.publish(registerTopic, "SIGN_IN", { qos: 2, retain: true });

  // this simulates the device collecting and sending sensor data
  const dataSendInterval = setInterval(() => {
    const data = JSON.stringify({
      deviceId,
      messageType: "DATA",
      temp: 23.6,
      lat: 48.015722,
      lng: -88.625528,
    });
    console.log(`SENDING DATA: ${data}`);
    client.publish(dataTopic, data, { qos: 2 });
  }, 5000);
});

client.on("message", (topic, message) => {
  console.log(`RECEIVED COMMAND "${message.toString()}"`);
  const command = JSON.parse(message);
  const commandResult = execute(command.command);
  const commandResp = JSON.stringify({
    deviceId,
    messageType: "commandResp",
    commandResult,
    ...command,
  });
  console.log(`SENDING COMMAND RESPONSE ${commandResp}`);
  client.publish(cmdRespTopic, commandResp, { qos: 2 });
});

// dummy function pretending to execute a command
function execute(command) {
  switch (command) {
    case "PING":
      return "PONG";
    default:
      return "ERROR_UNKNOWN_COMMAND";
  }
}
