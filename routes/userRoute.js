const express = require("express")
const registerModel = require("../models/registerModel");
const passport = require("passport");
const bcrypt = require("bcrypt");
const router = express.Router();
const multer = require('multer');

// Set up storage for Multer (in-memory storage here for simplicity)
const storage = multer.memoryStorage();

// Configure multer to handle file uploads
const upload = multer({ storage: storage });
  
const {
    registerUser,
    loginUser,
    homePage,
    registerPage,
    loginPage,
    logout,
    UploadPage,
    UploadUser, 
    mediapage,
    NotesPage,
    RecordPage,
    RecordUser,
    FetchAudio,
    LocalUser,
    mixAudio,
    ImagePage,
    Generate
} = require("../controllers/userController")

//router.get("/upload",UploadUser);
router.post('generto',upload.none(), Generate)
router.get('/imagepage', ImagePage);
router.post("/mix-audio",upload.none(), mixAudio);
router.post("/upload", upload.single('file'), UploadUser);
router.post("/save-audio", upload.single('audio'), RecordUser); 
router.post("/upload-local", upload.single('audio'), LocalUser); // Handle file upload and other fields
router.get("/uploadnote",NotesPage);
router.get('/fetch-recorded-files',FetchAudio);
router.get("/record",RecordPage);
router.get("/upload",UploadPage);
router.post("/register",checkNotAuthenticated,registerUser);
router.post("/login", checkNotAuthenticated, loginUser, (req, res) => {
    if (req.user) {
        req.session.name = req.user.name; // Store username in session
    }
    res.redirect("/");  // Redirect to home page after successful login
});
router.get("/", checkAuthenticated,homePage);
router.get('/login', checkNotAuthenticated,loginPage);
router.get('/register',checkNotAuthenticated,registerPage);
router.delete("/logout",logout);
router.get('/media/:id',mediapage);

function checkAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return next()
    }
    res.redirect("/login")
}

function checkNotAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return res.redirect("/")
    }
    next()
}


module.exports = router;