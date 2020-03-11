const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

const calls = [];

app.get('/joyride', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

const handler = async function (req, res) {
  const originalUrl = req.originalUrl;
  const body = req.body;
  const method = req.method;
  const protocol = req.protocol;
  const guid = uuidv4();
  const { host, ...headers } = req.headers;

  const params = { guid, host, originalUrl, method, protocol, headers, body };
  console.info({ params });

  calls[guid] = new Call(params);
  calls[guid].run();

  const response = await calls[guid].blocker;

  return response;
};

app.get('*', handler);
app.post('*', handler);
app.head('*', handler);
app.put('*', handler);
app.delete('*', handler);
app.options('*', handler);
app.patch('*', handler);

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('disconnect', () => console.log('user disconnected'));

  socket.on('trigger-answer', function ({ data, guid }) {
    calls[guid].setResponse(data);
  });
});

const port = process.env.PORT || 5000;
http.listen(port, function () {
  console.log(`listening on ${port}`);
});

class Call {
  constructor({ guid, host, originalUrl, protocol, method, headers, body }) {
    this.guid = guid;
    this.headers = headers;
    this.body = body;
    this.originalUrl = originalUrl;
    this.host = host;
    this.protocol = protocol;
    this.method = method;
    this.data = null;
    this.callComplete = false;
  }

  run() {
    const { guid, host, originalUrl, protocol, method, headers, body } = this;
    const options = { guid, host, protocol, originalUrl, method, headers, body };
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
