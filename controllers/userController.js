const registerModel = require("../models/registerModel");
const passport = require("passport");
const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const bucket = require("../config/firebaseConfig");
const Media = require("../models/mediaModel");
const Audio = require("../models/audioModel");
const generateQRCode = require("../controllers/qrcode");
const axios = require("axios");
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const { Mixer, Track } = require('audio-mixer');

const getFileUrl = async (fileName) => {
    try {
      // Retrieve the file from Firebase Storage
      const file = bucket.file(fileName);
      
      // Get the download URL for the file
      const [url] = await file.getSignedUrl({
        action: 'read', // We want to allow reading the file
        expires: '03-09-2491', // URL will expire on this date (long term URL)
      });
  
      return url; // Return the public URL of the file
    } catch (error) {
      console.error('Error retrieving file URL:', error);
      throw new Error('Failed to retrieve file URL');
    }
  };


//@desc fetch recordings
//@route GET /fetch-record
//@access private  
const FetchAudio = asyncHandler(async (req, res) => {
    const { username } = req.query; // Get the username from query parameters
  
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required." });
    }
  
    try {
      // Find the audio files related to the username
      const files = await Audio.find({ username: username });
  
      if (files.length === 0) {
        return res.status(404).json({ success: false, error: "No files found for this user." });
      }
  
      // Respond with the audio file details (audioname, audiourl, etc.)
      return res.json({
        success: true,
        files: files.map(file => ({
          name: file.audioname, // The audio file name
          url: file.audiourl     // The URL of the audio file
        }))
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: "Server error while fetching files." });
    }
  });
  

//@desc register a user
//@route POST /register
//@access public
const registerUser = asyncHandler( async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await registerModel.findOne({ $or: [{ username }, { email }] });
    
        if (existingUser) {
            if (existingUser.email === email) {
                req.flash("error", "Email is already in use.");
            }
            if (existingUser.username === username) {
                req.flash("error", "Username is already in use.");
            }
            return res.redirect("/register"); 
        }

        const hashPassword = await bcrypt.hash(password, 10);
        const register = await registerModel.create({
            username,
            email,
            password: hashPassword
        });

        console.log("User registered:", register);
        res.redirect('/login');
    } catch (e) {
        console.log("Error during registration:", e);
        res.redirect("/register");
    }
});

//@desc Save audio
//@route POST /upload
//@access private
// Apply the `upload.single('audio')` middleware to handle the file upload
const RecordUser = asyncHandler(async (req, res) => {
    try {
      console.log('Incoming form data:', req.body); // Logs form data (e.g., username)
      console.log('File uploaded:', req.file); // Logs the uploaded file
  
      // Check if the file and username are provided
      if (!req.file || !req.body.username) {
        return res.status(400).json({ error: 'No file or username provided.' });
      }
  
      // Create a new Audio document in MongoDB
      const newAudio = new Audio({
        audioname: req.body.audioname,
        username: req.body.username,
        audiourl: ` `, // Placeholder for the Firebase file URL
      });
      console.log('Audio document create:', newAudio);
      // Save audio metadata to MongoDB
      const savedAudio = await newAudio.save();
      console.log('Audio document saved:', savedAudio);
      // Prepare the file for Firebase Storage
      const firebaseFileName = `record/${savedAudio._id}.wav`;
      const blob = bucket.file(firebaseFileName);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype, // Ensure correct content type for the file
        },
      });
  
      // Handle errors during file upload to Firebase
      blobStream.on('error', (error) => {
        console.error('Error uploading to Firebase:', error);
        res.status(500).json({ error: 'Failed to upload file to Firebase' });
      });
  
      // After the file is uploaded successfully, update the MongoDB document
      blobStream.on('finish', async () => {
        // Get the public URL of the uploaded file on Firebase Storage
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${firebaseFileName}`;
        getFileUrl(firebaseFileName).then((fileUrl) => {
            console.log('File URL:', fileUrl);
            savedAudio.audiourl = fileUrl;
        });
        await savedAudio.save(); // Save the URL to MongoDB
  
        console.log('Saved Media after file upload:', savedAudio);
  
        // Send the success response with file URL
        res.status(200).json({
          success: true, 
          message: 'File uploaded successfully!',
          fileUrl: publicUrl, // Include the public URL in the response
        });
      });
  
      // Stream the file's buffer to Firebase Storage
      blobStream.end(req.file.buffer);
  
    } catch (error) {
      console.error('Error during file upload:', error);
      res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
  });


//@desc Save audio local
//@route POST /upload-local
//@access private
  const LocalUser = asyncHandler(async (req, res) => {
    try {
      console.log('Incoming form data:', req.body); // Logs form data (e.g., username)
      console.log('File uploaded:', req.file); // Logs the uploaded file
  
      const audioname = req.file.originalname;

      const firebaseFileName = `local/${audioname}`;
      const blob = bucket.file(firebaseFileName);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: req.file.mimetype, // Ensure correct content type for the file
        },
      });
  
      // Handle errors during file upload to Firebase
      blobStream.on('error', (error) => {
        console.error('Error uploading to Firebase:', error);
        res.status(500).json({ error: 'Failed to upload file to Firebase' });
      });
  
      // After the file is uploaded successfully, update the MongoDB document
      blobStream.on('finish', async () => {
        // Get the public URL of the uploaded file on Firebase Storage
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${firebaseFileName}`;
        const audiourl = await getFileUrl(firebaseFileName);
  
        // Send the success response with file URL
        res.status(200).json({
          success: true, 
          message: 'File uploaded successfully!',
          fileUrl: audiourl, // Include the public URL in the response
        });
      });
  
      // Stream the file's buffer to Firebase Storage
      blobStream.end(req.file.buffer);
  
    } catch (error) {
      console.error('Error during file upload:', error);
      res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
  });


//@desc login a user
//@route POST /login
//@access public
const loginUser = passport.authenticate("local",{
    successRedirect:"/",
    failureRedirect:'/login',
    failureFlash: true 
});

//@desc home page
//@route GET /
//@access private
const homePage = asyncHandler( async(req, res) => {
    res.render("index.ejs",{name: req.user.username});
});

//@desc login page
//@route GET /login
//@access public
const loginPage = asyncHandler( async (req, res) => {
    res.render("login.ejs");
});

//@desc register page
//@route GET /register
//@access public
const registerPage = (req, res) => {
    res.render("register.ejs");
}

//@desc delete the session or logout
//@route DELETE /register
//@access private
const logout = (req,res) => {
    req.logout(req.user, err => {
        if (err) return next(err);
        res.redirect("/");
    });
}

//@desc upload a image 
//@route POST /upload
//@access public
const UploadUser = asyncHandler(async (req, res) => {
    try {
        console.log('Incoming form data:', req.body);

        // Create the media object without file URL and QR code URL
        const newMedia = new Media({
            filename: req.file.originalname,
            uploadedBy: req.body.uploadedBy,
            message: req.body.message,
            username: req.body.username,
            mood: req.body.mood,
            fileUrl: ` `, 
            qrlocUrl: ` `,
            mimeType: req.file.mimetype, // Temporary placeholder, updated after Firebase upload
        });
        console.log("Media document created:", newMedia);

        // Save media data to MongoDB
        const savedMedia = await newMedia.save();
        console.log("Media document saved:", savedMedia);

        // Use the MongoDB ObjectId as the filename in Firebase
        const firebaseFileName = `${savedMedia._id}`;

        // Upload the main file to Firebase Storage
        const blob = bucket.file(firebaseFileName);
        const blobStream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype, // Ensure correct content type for the file
            },
        });

        blobStream.on('error', (error) => {
            console.error('Error uploading to Firebase:', error);
            res.status(500).json({ error: 'Failed to upload file to Firebase' });
        });

        blobStream.on('finish', async () => {
            // Get the public URL of the uploaded file
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${firebaseFileName}`;
            // Get the signed URL for Firebase storage
            getFileUrl(firebaseFileName).then((fileUrl) => {
                console.log('File URL:', fileUrl);
                savedMedia.fileUrl = fileUrl;
            });

            await savedMedia.save(); // Save the updated file URL in MongoDB

            console.log("Saved Media after file upload:", savedMedia);
            
            // Generate the QR code URL
            const useUrl = `${process.env.NGROK_URL}/media/${savedMedia._id}`;
            try {
                const qrCodeUrl = await generateQRCode(useUrl);

                // Download the QR code image from the generated URL
                const qrImageResponse = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });
                const qrImageBuffer = Buffer.from(qrImageResponse.data, 'binary'); // Convert response to buffer
                const qrFileName = `qrs/${savedMedia._id}.jpg`; // Save QR code in the 'qrs' folder in Firebase

                // Create a reference for the QR code file in Firebase
                const qrBlob = bucket.file(qrFileName);
                const qrBlobStream = qrBlob.createWriteStream({
                    metadata: {
                        contentType: 'image/jpeg', // QR code is an SVG file
                    },
                });

                qrBlobStream.on('error', (error) => {
                    console.error('Error uploading QR code to Firebase:', error);
                    res.status(500).json({ error: 'Failed to upload QR code to Firebase' });
                });

                qrBlobStream.on('finish', async () => {
                    // Get the Firebase URL for the QR code file
                    getFileUrl(qrFileName).then((qrFileUrl) => {
                        console.log('QR Code URL:', qrFileUrl);
                        savedMedia.qrlocUrl = qrFileUrl; // Save the QR code URL in MongoDB
                    });

                    // Save the media document with the QR code URL
                    await savedMedia.save();
                    console.log("Saved Media after QR code URL update:", savedMedia);

                    // Send the response with file URL and QR code URL
                    res.status(200).json({
                        message: 'File uploaded successfully!',
                        fileUrl: savedMedia.fileUrl,
                        qrCodeUrl: savedMedia.qrlocUrl, // Include the saved QR code URL
                        mediaId: savedMedia._id,
                    });
                });
                qrBlobStream.end(qrImageBuffer);
                // Stream the QR code buffer to Firebase

            } catch (error) {
                console.error("Error during QR code generation:", error);
                res.status(500).json({ error: 'Error generating QR code' });
            }
        });

        // Stream the file's buffer to Firebase
        blobStream.end(req.file.buffer);

    } catch (error) {
        console.error('Error during file upload:', error);
        res.status(500).json({ error: 'An error occurred while uploading the file' });
    }
});

//@desc mix audio based on mood, set mood volume to 20, and adjust length to match audioUrl
//@route POST /mix-audio
//@access private


const mixAudio = asyncHandler(async (req, res) => {
    const { audioUrl, mood } = req.body;  // Extract the audio URL and mood audio

    if (!audioUrl || !mood) {
        return res.status(400).json({ error: 'Audio URL and mood audio are required' });
    }

    console.log("Audio URL:", audioUrl);
    console.log("Mood Audio URL:", mood);

    try {
        // Fetch the audio file (audioUrl)
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
            throw new Error('Failed to fetch audio URL');
        }
        const audioBuffer = await audioResponse.buffer();

        // Fetch the mood audio (mood)
        const moodResponse = await fetch(mood);
        if (!moodResponse.ok) {
            throw new Error('Failed to fetch mood audio');
        }
        const moodBuffer = await moodResponse.buffer();

        // Set up audio mixer
        const audioMixer = new Mixer({
            channels: 2,          // Stereo
            bitDepth: 16,
            sampleRate: 44100,
            bufferSize: 1024
        });

        // Add audio tracks to mixer using the correct method
        const track1 = new Track({ buffer: audioBuffer, volume: 1.0 });
        const track2 = new Track({ buffer: moodBuffer, volume: 0.2 });

        audioMixer.addTrack(track1);
        audioMixer.addTrack(track2);

        // Pipe mixed audio to response
        const tempOutputPath = path.join(__dirname, 'temp_mixed_audio.mp3');
        audioMixer.pipe(fs.createWriteStream(tempOutputPath));

        audioMixer.on('end', () => {
            console.log('Audio mix complete');

            // Read the mixed audio file into a buffer
            fs.readFile(tempOutputPath, (err, mixedBuffer) => {
                if (err) {
                    console.error('Error reading mixed audio file:', err);
                    return res.status(500).json({ error: 'Error reading mixed audio file' });
                }

                // Clean up temporary file
                fs.unlinkSync(tempOutputPath);

                // Set headers to send the audio as a response
                res.setHeader('Content-Type', 'audio/mpeg');
                res.setHeader('Content-Disposition', 'attachment; filename=mixed_audio.mp3');
                
                // Send the mixed audio buffer directly in the response
                res.status(200).send(mixedBuffer);
            });
        });

        audioMixer.start();

    } catch (error) {
        console.error('Error mixing audio:', error);
        res.status(500).json({ error: 'Error mixing audio' });
    }
});



//@desc display media 
//@route GET /medis/:id
//@access public
const mediapage = asyncHandler(async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) {
            return res.status(404).send('Media not found');
        }

        // Predefined URLs for mood-based audio
        const sadUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fsad-emotional-and-dramatic-piano-237661.mp3?alt=media&token=0aeea0ab-beab-4d12-95ae-c1e180d10e4e`;
        const happyUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fhappy-mood-126767.mp3?alt=media&token=393cc16f-953e-47e1-9ed0-c59dc88d448b`;
        const birthUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fbirthday-wishes-happy-cheerful-positive-music-262452.mp3?alt=media&token=09f2949c-6008-4f8d-bede-a7034f7b7f4c`;
        
        let hiddenAudioUrl;
        // Determine the hidden audio URL based on mood
        if(media.mood === "A"){
            hiddenAudioUrl =  happyUrl;
        }else if(media.mood === "B"){
            hiddenAudioUrl =  sadUrl;
        }else{
            hiddenAudioUrl =  birthUrl;
        }
        // Volume for hidden audio is set to 25% (managed entirely by the browser)
        const volume = 0.2; // Backend-controlled volume

        // Render the page
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${media.filename}</title>
                <style>
                    body { text-align: center; padding: 20px; }
                    h1 { margin-bottom: 20px; }
                </style>
                <script>
                    document.addEventListener('DOMContentLoaded', () => {
                        const primaryAudio = document.getElementById('primaryAudio');
                        const hiddenAudio = document.getElementById('hiddenAudio');

                        // Set initial volume for hidden audio
                        hiddenAudio.volume = ${volume};

                        // Synchronize play and pause between the two audio elements
                        primaryAudio.addEventListener('play', () => {
                            hiddenAudio.currentTime = 0; // Reset hidden audio
                            hiddenAudio.play();
                        });

                        primaryAudio.addEventListener('pause', () => {
                            hiddenAudio.pause();
                        });

                        // Synchronize playback duration
                        primaryAudio.addEventListener('timeupdate', () => {
                            // Restart hidden audio if it's shorter
                            if (primaryAudio.currentTime > hiddenAudio.duration) {
                                hiddenAudio.currentTime = 0;
                                hiddenAudio.play();
                            }

                            // Stop hidden audio if primary audio ends
                            if (primaryAudio.currentTime >= primaryAudio.duration) {
                                hiddenAudio.pause();
                            }
                        });
                    });
                </script>
            </head>
            <body>
                <h1>${media.uploadedBy || 'Friend'}’s Message for You</h1>
                <p>${media.message || "Enjoy this media!"}</p>

                <!-- Visible audio element -->
                <audio controls src="${media.fileUrl}" id="primaryAudio" style="max-width: 100%;"></audio>

                <!-- Hidden audio element -->
                <audio src="${hiddenAudioUrl}" id="hiddenAudio" style="display: none;"></audio>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Error fetching media:", error);
        res.status(500).send('Internal Server Error');
    }
});





//@desc upload a image 
//@route GET /upload
//@access public
const UploadPage = (req, res) => {
    const name = req.user ? req.user.username : 'Guest';  
    console.log("User name:", name);
    res.render('upload.ejs', { name });  // Pass the name to upload.ejs
};

//@desc record audio 
//@route GET /upload
//@access public
const RecordPage = (req, res) => {
    const name = req.user ? req.user.username : 'Guest';  
    console.log("User name:", name);
    res.render('record.ejs', { name });  
};

//@desc create image
//@route GET /imaage
//@access public
const ImagePage = (req, res) => {
    const name = req.user ? req.user.username : 'Guest';  
    console.log("User name:", name);
    res.render('model.ejs', { name });  
};

const Generate = async (req, res) => {
    const text = req.body.text; // Assuming the text is sent as part of the request body

    if (!text) {
        return res.status(400).json({ error: 'Text input is required.' });
    }

    try {
        // Call the DeepAI API
        const response = await fetch('https://api.deepai.org/api/text2img', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': '6ef65cd6-451f-44b6-bd06-5ca2c16fbbc9'
            },
            body: JSON.stringify({ text : text })
        });

        const data = await response.json();

        if (response.ok) {
            return res.status(200).json({ imageUrl: data.output_url });
        } else {
            return res.status(500).json({ error: data.error || 'Failed to generate image.' });
        }
    } catch (error) {
        console.error('Error generating image:', error);
        return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
}

//@desc previous uploaded data 
//@route GET /upload
//@access private
const NotesPage = async (req, res) => {
    const name = req.user ? req.user.username : 'Guest';  // Retrieve the username from the session, or default to 'Guest'
    console.log("User name:", name);

    try {
        // Fetch media entries from MongoDB where the uploadedBy field matches the username
        const mediaEntries = await Media.find({ username : name }).exec();

        // Render the page with media entries and the username
        res.render('uploadenote.ejs', { name, mediaEntries });
    } catch (error) {
        console.error('Error fetching media entries:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
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
};
