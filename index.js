const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gu0z5kw.mongodb.net/houseHunter?retryWrites=true&w=majority`;

// Create a new MongoClient
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("houseHunter");
    const usersCollection = db.collection("users");

    // Registration Endpoint
    app.post("/register", async (req, res) => {
      const { fullName, houseType, phoneNumber, email, password } = req.body;

      // Check if the user already exists in the database
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new user object
      const newUser = {
        fullName,
        houseType,
        phoneNumber,
        email,
        password: hashedPassword,
      };

      // Insert the new user into the database
      await usersCollection.insertOne(newUser);

      // Return a success message
      res.status(201).json({ message: "User registered successfully" });
    });

    // Login Endpoint
    app.post("/login", async (req, res) => {
      const { email, password } = req.body;

      // Check if the user exists in the database
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Compare the provided password with the stored hashed password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Generate a JWT token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Return the token
      res.status(200).json({ token });
    });

    // Protected Route Example
    app.get("/protected", authenticateToken, (req, res) => {
      res.status(200).json({ message: "Protected route accessed successfully" });
    });

    // Middleware to authenticate JWT token
    function authenticateToken(req, res, next) {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (token == null) {
        return res.sendStatus(401);
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
          return res.sendStatus(403);
        }

        req.user = user;
        next();
      });
    }

    // Ping Endpoint
    app.get("/", (req, res) => {
      res.send("Server is running");
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
  }
}

run().catch(console.dir);
