const express = require("express")
const connectDb = require("./config/dbConnection");
const bcrypt = require("bcrypt");
const registerModel = require("./models/registerModel");
const initiallizePassport = require("./passport-config")
const dotenv = require("dotenv").config();
const serverless = require("serverless-http");
const flash = require("express-flash");
const session = require("express-session");
const passport = require("passport");
const methodOverride = require("method-override")
const errorhandler = require("./middleware/errorhandler");
const cors = require('cors');

connectDb();
const app = express();
const router = express.Router();



initiallizePassport(
    passport,
    email => users.find(user => user.email === email),
    id => users.find(user => user.id === id)
);



app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(session(
    {
        secret: "tejas",
        resave: false,
        saveUninitialized:true
    }
));
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(require("./routes/userRoute"));

router.get("/", (req, res) => {
    res.send("App is running..");
});

// app.use("/.netlify/functions/app", router);
// module.exports.handler = serverless(app);
app.use(cors({
    origin: 'http://localhost:3000/', // Adjust for the frontend's URL
    methods: ['GET', 'POST'],
    credentials: true,
}));
app.use(errorhandler);
app.listen(3000, () => console.log("Server is running on port 3000"));