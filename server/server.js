const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();
app.use(cors());

// =========================
// SERVER + SOCKET
// =========================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// =========================
// MONGODB CONNECTION
// =========================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// =========================
// USER MODEL
// =========================
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);

// =========================
// RUNTIME STORES
// =========================
let onlineUsers = {}; // socketId → { socketId, username }
let sessions = {};    // token → username

// =========================
// SOCKET CONNECTION
// =========================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  onlineUsers[socket.id] = {
    socketId: socket.id,
    username: null,
  };

  // =========================
  // REGISTER
  // =========================
  socket.on("register", async ({ username, password }) => {
    if (!username || !password) {
      socket.emit("auth_error", "Username and password required");
      return;
    }

    const existing = await User.findOne({ username });
    if (existing) {
      socket.emit("auth_error", "Username already exists");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash });

    socket.emit("register_success", "Registration successful");
  });

  // =========================
  // LOGIN
  // =========================
  socket.on("login", async ({ username, password }) => {
    const user = await User.findOne({ username });
    if (!user) {
      socket.emit("auth_error", "Invalid username or password");
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      socket.emit("auth_error", "Invalid username or password");
      return;
    }

    const alreadyOnline = Object.values(onlineUsers).some(
      (u) => u.username === username
    );
    if (alreadyOnline) {
      socket.emit("auth_error", "User already logged in");
      return;
    }

    const token = crypto.randomBytes(24).toString("hex");
    sessions[token] = username;

    onlineUsers[socket.id].username = username;

    socket.emit("login_success", { username, token });
    io.emit("online_users", Object.values(onlineUsers));
  });

  // =========================
  // AUTO LOGIN
  // =========================
  socket.on("auto_login", (token) => {
    const username = sessions[token];
    if (!username) return;

    onlineUsers[socket.id].username = username;
    socket.emit("login_success", { username, token });
    io.emit("online_users", Object.values(onlineUsers));
  });

  // =========================
  // LOGOUT
  // =========================
  socket.on("logout", (token) => {
    delete sessions[token];
    if (onlineUsers[socket.id]) {
      onlineUsers[socket.id].username = null;
    }
    socket.emit("logout_success");
    io.emit("online_users", Object.values(onlineUsers));
  });

  // =========================
  // PUBLIC CHAT
  // =========================
  socket.on("public_message", (msg) => {
    const user = onlineUsers[socket.id];
    if (!user || !user.username) return;

    io.emit("public_message", {
      from: user.username,
      message: msg,
    });
  });

  // =========================
  // PRIVATE CHAT
  // =========================
  socket.on("private_message", ({ toSocketId, message }) => {
    const fromUser = onlineUsers[socket.id];
    const toUser = onlineUsers[toSocketId];
    if (!fromUser || !toUser) return;

    io.to(toSocketId).emit("private_message", {
      from: fromUser.username,
      message,
      socketId: socket.id,
    });
  });

  // =========================
  // DISCONNECT
  // =========================
  socket.on("disconnect", () => {
    delete onlineUsers[socket.id];
    io.emit("online_users", Object.values(onlineUsers));
  });
});

// =========================
// START SERVER (RENDER SAFE)
// =========================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
