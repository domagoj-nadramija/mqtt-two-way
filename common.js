if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

function getConfig(protocol) {
    if (protocol == "mqtt") return {
        "broker": process.env.BROKER,
        "dataTopic": process.env.DATA_TOPIC,
        "commandRequestTopic": process.env.CMD_REQ_TOPIC,
        "commandResponseTopic": process.env.CMD_RESP_TOPIC,
        "registerTopic": process.env.REGISTER_TOPIC
    };
    if (protocol == "tcp") return {
        "server": {
            "host": process.env.SERVER_HOST,
            "port": process.env.SERVER_PORT
        }
    };

}

// dummy function pretending to store data
function storeData(data) {
  console.log("Storing data...");
}

// dummy function pretending to execute a command
function execute(command) {
  switch (command) {
    case "PING":
      return "PONG";
    default:
      return "ERROR_UNKNOWN_COMMAND";
  }
}

module.exports = { getConfig, storeData, execute}
