const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

const calls = [];

app.get('/start-proxette', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('*', async function (req, res) {
  const headers = req.headers;
  const body = req.body;
  const method = req.method;
  const uri = req.uri;
  const guid = uuidv4();

  const params = { guid, uri, method, headers, body };
  console.info({ params });

  calls[guid] = new Call(params);
  calls[guid].run();

  const response = await calls[guid].blocker;

  return response;
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('disconnect', () => console.log('user disconnected'));

  socket.on('trigger-answer', function ({ data, guid }) {
    calls[guid].setResponse(data);
  });
});


http.listen(process.env.PORT, function () {
  console.log(`listening on ${process.env.PORT}`);
});

class Call {
  constructor({ guid, uri, method, headers, body }) {
    this.guid = guid;
    this.headers = headers;
    this.body = body;
    this.uri = uri;
    this.method = method;
    this.data = null;
    this.callComplete = false;
  }

  run() {
    const { guid, uri, method, headers, body } = this;
    const options = { guid, uri, headers, method, body };
    io.emit('trigger-call', options);

    this.blocker = new Promise(resolve => {
      const handler = setInterval(() => {
        if (this.callComplete) {
          clearInterval(handler);
          resolve(this.data);
        }
      }, 100);
    });
  }

  setResponse(data) {
    this.data = data;
    this.callComplete = true;
  }
}
