const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
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
        // await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("houseHunter");
        const usersCollection = db.collection("users");

        const houseCollection = client.db("houseHunter").collection("houses");
        const bookingCollection = client.db("houseHunter").collection("bookings");

        // Registration Endpoint
        app.post("/register", async (req, res) => {
            const { fullName, role, phoneNumber, email, password } = req.body;

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
                role,
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

        // Get all users endpoint
        app.get("/users", async (req, res) => {
            try {
                const users = await usersCollection.find().toArray();
                res.status(200).json(users);
            } catch (error) {
                console.error("Error retrieving users", error);
                res.status(500).json({ message: "Failed to retrieve users" });
            }
        });

        // Owner Verify
        app.get('/users/owner/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { owner: user?.role === 'owner' }
            res.send(result);
        })

        // Renter Verify
        app.get('/users/renter/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { renter: user?.role === 'renter' }
            res.send(result);
        })

        // Add House API
        app.post('/houses', async (req, res) => {
            const houses = req.body;
            console.log(houses);
            const result = await houseCollection.insertOne(houses);
            res.send(result);
        })

        // Modal API for Booking
        app.post("/bookings", async (req, res) => {
            const bookingData = req.body;
            const result = await bookingCollection.insertOne(bookingData);
            res.send(result);
        });

        // Get the count of bookings for a specific user email
        app.get("/bookings/count", async (req, res) => {
            const userEmail = req.query.email;

            try {
                const count = await bookingCollection.countDocuments({ email: userEmail });
                res.status(200).json({ count });
            } catch (error) {
                console.error("Error retrieving bookings count:", error);
                res.status(500).json({ message: "Failed to retrieve bookings count" });
            }
        });

        // Fetching All Houses for Homepage api
        app.get("/houses", async (req, res) => {
            const result = await houseCollection.find().toArray();
            res.send(result);
        })

        // Fetching All Houses for Homepage API with Search
        app.get("/allhouses", async (req, res) => {
            const { search } = req.query;

            try {
                let query = {};

                if (search) {
                    // Apply search filter based on the search query
                    query = {
                        $or: [
                            { houseName: { $regex: search, $options: "i" } },
                            { ownerEmail: { $regex: search, $options: "i" } },
                        ],
                    };
                }

                const result = await houseCollection.find(query).toArray();
                res.status(200).json(result);
            } catch (error) {
                console.error("Error fetching houses:", error);
                res.status(500).json({ message: "Failed to retrieve houses" });
            }
        });



        /// Get House Details to Manage House
        app.get("/manage-house", async (req, res) => {
            const ownerEmail = req.query.ownerEmail;
            if (!ownerEmail) {
                res.send([]);
                return;
            }
            try {
                const query = { ownerEmail: ownerEmail };
                const result = await houseCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching house details:", error);
                res.status(500).send("Internal Server Error");
            }
        });

        // Manage Delete House
        app.delete('/manage-house/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await houseCollection.deleteOne(query);
            res.send(result);
        })

        // Update House API
        app.put('/houses/:id', async (req, res) => {
            const id = req.params.id;
            const updatedHouseData = req.body;

            try {
                const query = { _id: new ObjectId(id) };
                const update = { $set: updatedHouseData };

                const result = await houseCollection.updateOne(query, update);

                if (result.modifiedCount > 0) {
                    res.status(200).json({ success: true, message: 'House updated successfully' });
                } else {
                    res.status(404).json({ success: false, message: 'House not found' });
                }
            } catch (error) {
                console.error("Error updating house:", error);
                res.status(500).json({ success: false, message: 'Failed to update house' });
            }
        });

        // Fetch bookings for a specific user
        app.get("/bookings", async (req, res) => {
            const email = req.query.email;

            try {
                const query = { email: email };
                const bookings = await bookingCollection.find(query).toArray();
                res.status(200).json(bookings);
            } catch (error) {
                console.error("Error fetching bookings:", error);
                res.status(500).json({ message: "Failed to retrieve bookings" });
            }
        });

        // Delete a booking by ID
        app.delete("/bookings/:id", async (req, res) => {
            const bookingId = req.params.id;

            try {
                const query = { _id: new ObjectId(bookingId) };
                const result = await bookingCollection.deleteOne(query);
                res.status(200).json({ message: "Booking deleted successfully" });
            } catch (error) {
                console.error("Error deleting booking:", error);
                res.status(500).json({ message: "Failed to delete booking" });
            }
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
