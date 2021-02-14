if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// IMPORTANT: I'm like 90% sure this can be made in a better, more efficient and secure way. Please send me feedback

const express = require("express");
const path = require("path");
var cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const bucketSession = uuidv4();

let bucket = {};

// Express app
const app = express();

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Socket IO
const http = require("http").Server(app);
const io = require("socket.io")(http);

io.on("connection", async (socket) => {
  // probably insecure
  const bucketId = await socket.handshake.headers.referer.split("/").pop();

  if (bucket[bucketId] != undefined) {
    bucket[bucketId] += 1;
  }

  io.emit(`count-${bucketId}`, bucket[bucketId]);

  socket.broadcast.emit(`autoupdate-${bucketId}`, true);

  socket.on("update", (obj) => {
    socket.broadcast.emit(obj.id, obj);
  });

  socket.on("disconnect", () => {
    bucket[bucketId] -= 1;
    io.emit(`count-${bucketId}`, bucket[bucketId]);
  });
});

// root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/public/index.html"));
});

app.get("/microbucket", (req, res) => {
  if (req.cookies.active_bucket) {
    return res.redirect(`/microbucket/${req.cookies.active_bucket}`);
  } else {
    res.sendFile(path.join(__dirname + "/public/index.html"));
  }
});

app.get("/microbucket/destroy/:bid", (req, res) => {
  res.clearCookie("active_bucket");
  delete bucket[req.params.bid];
  return res.redirect(`/microbucket`);
});

app.get("/microbucket/new", (req, res) => {
  let rand;
  do {
    rand = Math.round(Math.random() * 10000);
  } while (bucket.hasOwnProperty(rand));

  bucket[rand] = 0;
  res.cookie("active_bucket", rand);
  return res.redirect(`/microbucket/${rand}`);
});

app.get("/microbucket/:bid", (req, res) => {
  if (!bucket.hasOwnProperty(req.params.bid)) {
    if (req.params.bid > 0 && req.params.bid < 10000) {
      bucket[req.params.bid] = 0;
      res.cookie("active_bucket", req.params.bid);
      return res.sendFile(path.join(__dirname + "/public/bucket.html"));
    } else {
      return res.redirect("/microbucket/new");
    }
  }
  res.sendFile(path.join(__dirname + "/public/bucket.html"));
});

const port = process.env.PORT || 5000;
http.listen(port, function () {
  console.log(`HTTP Listening on *:${port}`);
});
