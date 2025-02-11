const express = require("express");
const passport = require("passport");
const session = require("express-session");
const cors = require("cors");
const { pool } = require("./db/db");
const http = require("http");
const { Server } = require("socket.io");
const friends = require("./routes/friends");
const user = require("./routes/getUser");

require("dotenv").config();
require("./middleware/auth");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/", friends);

// Configure CORS
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Initialize Socket.IO
const io = new Server(server, { cors: corsOptions });
let users = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", async (username) => {
    try {
      const res = await pool.query("SELECT status FROM users WHERE name = $1", [username]);

      if (res.rows.length > 0) {
        let currentStatus = res.rows[0].status;

        // Keep 'dnd' and 'idle' statuses, otherwise set to 'online'
        if (currentStatus !== "dnd" && currentStatus !== "idle") {
          currentStatus = "online";
          await updateStatus(username, "online");
        }

        users[username] = { socketId: socket.id, status: currentStatus };
        console.log(`${username} joined the chat with status: ${currentStatus}`);

        io.emit("status_update", { username, status: currentStatus });
      } else {
        console.log(`User ${username} not found in DB.`);
      }
    } catch (err) {
      console.error("Error fetching user status:", err);
    }
  });

  socket.on("status_change", async ({ username, status }) => {
    if (users[username]) {
      users[username].status = status;
      await updateStatus(username, status);
      io.emit("status_update", { username, status });
    }
  });

  socket.on("disconnect", async () => {
    const username = socket.username;
    if (username) {
      await updateStatus(username, "offline");
      delete users[username];
      io.emit("status_update", { username, status: "offline" });
      console.log(`${username} has disconnected.`);
    }
  });
});

const updateStatus = async (username, status) => {
  try {
    if (username) {
      await pool.query("UPDATE users SET status = $1 WHERE name = $2", [status, username]);
    }
  } catch (err) {
    console.error("Error updating status:", err);
  }
};

// Update status API
app.post("/update-status", async (req, res) => {
  const { user, status } = req.body;

  try {
    await pool.query("UPDATE users SET status = $1 WHERE name = $2", [status, user]);
    res.status(200).json({ success: true, message: "Status updated successfully" });

    console.log("Status updated successfully");
  } catch (err) {
    console.error(err.message);
  }
});

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "justafuckintoken",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use("/", user(io, users));

// Google OAuth routes
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/" }), (req, res) => {
  res.redirect("http://localhost:5173/dashboard");
});

// Check if user is authenticated
app.get("/auth/user", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const checkUsername = await pool.query(
        "SELECT user_id, name, status FROM users WHERE name = $1",
        [req.user.name]
      );

      if (checkUsername.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const userData = checkUsername.rows[0];
      await updateStatus(req.user.name, "online");

      res.status(200).json({
        success: true,
        user_id: userData.user_id,
        user: req.user,
        status: userData.status, // Include last known status
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  } else {
    res.status(401).send("Not authenticated");
  }
});

// Logout route
app.get("/auth/logout/:user", async (req, res) => {
  try {
    req.logout(async (err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ success: false, message: "Error during logout" });
      }

      // Update status to 'offline'
      const currentUser = req.params.user;
      await pool.query("UPDATE users SET status = $1 WHERE name = $2", ["offline", currentUser]);

      res.redirect("/");
    });
  } catch (err) {
    console.error("Error during logout process:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Start server
server.listen(process.env.PORT || 8000, () => {
  console.log(`Server running on port ${process.env.PORT || 8000}`);
});
