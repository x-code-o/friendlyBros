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
        const oneUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2FMain%20agar%20kahoon.mp3?alt=media&token=7b5fff8d-8cca-4702-8c14-d62d85c1c25b`;
        const twoUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2FTera%20yaar%20hoon%20mai.mp3?alt=media&token=be61d93b-14f4-4d51-a909-101cfa2b5a20`;
        const threeUrl = `https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2FTere%20jaisa%20yaar%20kaha.mp3?alt=media&token=f6f745fb-b40a-4f19-8ba2-487fd5d28f80`;
        const fourUrl =`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2FTu%20hai%20toh.mp3?alt=media&token=658a6e88-d3fc-403e-9672-fb967c3a1fed`;
        const fiveUrl=`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2FTu%20hi%20yaar%20mera.mp3?alt=media&token=a51ae28b-6462-4f01-bf9d-1e8069ceec05`;
        const sixUrl=`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fold%20song%20mashup.mp3?alt=media&token=f751cf76-11af-4cf7-a587-8fa987da5834`;
        const sevenUrl=`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fthousand%20years.mp3?alt=media&token=614aed54-0b1f-49ee-b9b9-0744dd18bc37`;
        const eightUrl=`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Ftumse%20mil%20ke.mp3?alt=media&token=c6f6389c-4c8a-42a8-8b3c-3f5bddf03e90`;
        const nineUrl=`https://firebasestorage.googleapis.com/v0/b/alumini8-3fd16.appspot.com/o/my-storage%2Fzara%20zara.mp3?alt=media&token=5f312d51-48bb-437a-8938-e4718f44c404`;
        
        let hiddenAudioUrl;
        // Determine the hidden audio URL based on mood
        if (media.mood === "A") {
            hiddenAudioUrl = oneUrl;
        } else if (media.mood === "B") {
            hiddenAudioUrl = twoUrl;
        } else if (media.mood === "C") {
            hiddenAudioUrl = threeUrl;
        } else if (media.mood === "D") {
            hiddenAudioUrl = fourUrl;
        } else if (media.mood === "E") {
            hiddenAudioUrl = fiveUrl;
        } else if (media.mood === "F") {
            hiddenAudioUrl = sixUrl;
        } else if (media.mood === "G") {
            hiddenAudioUrl = sevenUrl;
        } else if (media.mood === "H") {
            hiddenAudioUrl = eightUrl;
        } else {
            hiddenAudioUrl = nineUrl;
        }
        
        // Render the page
        res.send(`
          <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${media.filename}</title>
    <style>
        body {
    text-align: center;
    padding: 20px;
    background-image: url('https://res.cloudinary.com/dsjt220g8/image/upload/v1732521279/paper-texture_1_vjtlc6.jpg'); /* Replace with your image URL */
    background-size: cover; /* Ensures the image covers the entire screen */
    background-repeat: no-repeat; /* Prevents the image from repeating */
    background-position: center; /* Centers the image */
    background-attachment: fixed; /* Keeps the background fixed during scrolling */
    color: white; /* Optional: makes text visible on a potentially dark background */
}

h1, p {
    font-weight: bold;
    font-style: italic;
}

#loadingIndicator {
    font-weight: bold;
    font-style: italic;
}

#mediaPreview {
    font-weight: bold;
    font-style: italic;
}
    </style>
    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            const primaryAudio = document.getElementById('primaryAudio');
            const loadingIndicator = document.getElementById('loadingIndicator');
            const mediaPreview = document.getElementById('mediaPreview');
            const audioPreview = document.getElementById('audioPreview');
            const audioUrl = "${media.fileUrl}";
            const hiddenAudioUrl = "${hiddenAudioUrl}"; // Dynamically set based on mood
            
            try {
                // Request to fetch both the main audio and the mood audio
                const [audioResponse, moodResponse] = await Promise.all([
                    fetch(audioUrl),
                    fetch(hiddenAudioUrl),
                ]);

                if (!audioResponse.ok || !moodResponse.ok) {
                    throw new Error("Failed to fetch audio files.");
                }

                const [audioBlob, moodBlob] = await Promise.all([
                    audioResponse.blob(),
                    moodResponse.blob(),
                ]);

                const [audioArrayBuffer, moodArrayBuffer] = await Promise.all([
                    audioBlob.arrayBuffer(),
                    moodBlob.arrayBuffer(),
                ]);

                // Decode the audio files into audio buffers
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const [audioBuffer, moodBuffer] = await Promise.all([
                    audioContext.decodeAudioData(audioArrayBuffer),
                    audioContext.decodeAudioData(moodArrayBuffer),
                ]);

                // Create two audio buffers and set their playback rates
                const audioSource = audioContext.createBufferSource();
                const moodSource = audioContext.createBufferSource();

                audioSource.buffer = audioBuffer;
                moodSource.buffer = moodBuffer;

                // Create gain nodes for volume control
                const audioGainNode = audioContext.createGain();
                const moodGainNode = audioContext.createGain();

                audioGainNode.gain.value = 1.0; // 100% volume for main audio
                moodGainNode.gain.value = 0.15; // 15% volume for mood audio
                
                // Connect the sources to the gain nodes and the context destination
                audioSource.connect(audioGainNode);
                moodSource.connect(moodGainNode);

                audioGainNode.connect(audioContext.destination);
                moodGainNode.connect(audioContext.destination);

                // Check if main audio is longer than mood audio
                if (audioBuffer.duration > moodBuffer.duration) {
                    // Initialize OfflineAudioContext before creating sources
                    const offlineContext = new OfflineAudioContext(2, audioBuffer.sampleRate * audioBuffer.duration, audioBuffer.sampleRate);

                    // Loop the mood audio until its length matches the main audio
                    const loopedMoodBuffer = await loopAudio(moodBuffer, audioBuffer.duration);

                    // Create and configure offline sources
                    const offlineAudioSource = offlineContext.createBufferSource();
                    const offlineMoodSource = offlineContext.createBufferSource();
                    
                    offlineAudioSource.buffer = audioBuffer;
                    offlineMoodSource.buffer = loopedMoodBuffer;

                    // Create gain nodes for volume control
                    const offlineAudioGainNode = offlineContext.createGain();
                    const offlineMoodGainNode = offlineContext.createGain();

                    offlineAudioGainNode.gain.value = 1.0; // Full volume for main audio
                    offlineMoodGainNode.gain.value = 0.15; // Reduced volume for mood audio

                    // Connect sources to gain nodes
                    offlineAudioSource.connect(offlineAudioGainNode);
                    offlineMoodSource.connect(offlineMoodGainNode);

                    // Connect gain nodes to the offline context destination
                    offlineAudioGainNode.connect(offlineContext.destination);
                    offlineMoodGainNode.connect(offlineContext.destination);

                    // Start offline sources for rendering
                    offlineAudioSource.start();
                    offlineMoodSource.start();

                    // Render the mixed audio in the offline context
                    const mixedAudioBuffer = await offlineContext.startRendering();

                    // Convert the mixed audio buffer into a blob
                    const mixedAudioBlob = await bufferToWave(mixedAudioBuffer);
                    const mixedAudioUrl = URL.createObjectURL(mixedAudioBlob);

                    // Set the mixed audio URL to the audio preview element
                    audioPreview.src = mixedAudioUrl;
                    audioPreview.pause(); // Explicitly pause the audio to ensure it doesn't play automatically
                    audioPreview.currentTime = 0;

                    // Update UI
                    loadingIndicator.style.display = "none"; // Hide loading indicator
                    mediaPreview.style.display = "block"; // Show the audio preview
                } else {
                    const NewContext = new OfflineAudioContext(2, audioBuffer.sampleRate * audioBuffer.duration, audioBuffer.sampleRate);
          
                    // Create and configure offline sources
                    const NewAudioSource = NewContext.createBufferSource();
                    const NewMoodSource = NewContext.createBufferSource();
                    
                    NewAudioSource.buffer = audioBuffer;
                    NewMoodSource.buffer = moodBuffer;

                    // Create gain nodes for volume control
                    const NewAudioGainNode = NewContext.createGain();
                    const NewMoodGainNode = NewContext.createGain();

                    NewAudioGainNode.gain.value = 1.0; // Full volume for main audio
                    NewMoodGainNode.gain.value = 0.15; // Reduced volume for mood audio

                    // Connect sources to gain nodes
                    NewAudioSource.connect(NewAudioGainNode);
                    NewMoodSource.connect(NewMoodGainNode);

                    // Connect gain nodes to the offline context destination
                    NewAudioGainNode.connect(NewContext.destination);
                    NewMoodGainNode.connect(NewContext.destination);

                    // Start offline sources for rendering
                    NewAudioSource.start();
                    NewMoodSource.start();

                    const mixededAudioBuffer = await NewContext.startRendering();
                    // Use previous mixing logic for shorter or equal length
                    const mixedAudioBlob = await bufferToWave(mixededAudioBuffer);
                    const mixedAudioUrl = URL.createObjectURL(mixedAudioBlob);

                    audioPreview.src = mixedAudioUrl;
                    audioPreview.pause(); // Explicitly pause the audio to ensure it doesn't play automatically
                    audioPreview.currentTime = 0;
                    loadingIndicator.style.display = "none"; // Hide loading indicator
                    mediaPreview.style.display = "block"; // Show the audio preview
                }
            } catch (error) {
                console.error("Error mixing audio:", error);
                alert("Error mixing audio. Please try again.");
            }
        });

        async function loopAudio(moodBuffer, targetDuration) {
            const loopedBuffer = audioContext.createBuffer(
                moodBuffer.numberOfChannels,
                moodBuffer.length * Math.ceil(targetDuration / moodBuffer.duration),
                moodBuffer.sampleRate
            );

            for (let i = 0; i < loopedBuffer.numberOfChannels; i++) {
                const channelData = loopedBuffer.getChannelData(i);
                for (let j = 0; j < channelData.length; j++) {
                    channelData[j] = moodBuffer.getChannelData(i)[j % moodBuffer.length];
                }
            }
            return loopedBuffer;
        }

        // Convert AudioBuffer to a WAV blob for playback
        function bufferToWave(buffer) {
            const waveHeader = new ArrayBuffer(44);
            const view = new DataView(waveHeader);
            let offset = 0;
            
            const numChannels = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const numFrames = buffer.length;
            const bitsPerSample = 16;

            const byteRate = sampleRate * numChannels * bitsPerSample / 8;
            const blockAlign = numChannels * bitsPerSample / 8;
            const dataSize = numFrames * numChannels * bitsPerSample / 8;

            // RIFF header
            writeString(view, offset, 'RIFF');
            offset += 4;
            view.setUint32(offset, 36 + dataSize, true);
            offset += 4;
            writeString(view, offset, 'WAVE');
            offset += 4;

            // fmt chunk
            writeString(view, offset, 'fmt ');
            offset += 4;
            view.setUint32(offset, 16, true);
            offset += 4;
            view.setUint16(offset, 1, true); // PCM format
            offset += 2;
            view.setUint16(offset, numChannels, true);
            offset += 2;
            view.setUint32(offset, sampleRate, true);
            offset += 4;
            view.setUint32(offset, byteRate, true);
            offset += 4;
            view.setUint16(offset, blockAlign, true);
            offset += 2;
            view.setUint16(offset, bitsPerSample, true);
            offset += 2;

            // data chunk
            writeString(view, offset, 'data');
            offset += 4;
            view.setUint32(offset, dataSize, true);
            offset += 4;

            // Write the audio data
            const bufferData = buffer.getChannelData(0);
            const audioData = new Int16Array(numFrames * numChannels);
            for (let i = 0; i < numFrames; i++) {
                audioData[i * 2] = bufferData[i] * 0x7FFF; // Left channel
                audioData[i * 2 + 1] = bufferData[i] * 0x7FFF; // Right channel
            } 
            // Write the data to the array buffer
            const audioBuffer = new ArrayBuffer(dataSize);
            const audioView = new DataView(audioBuffer);
            for (let i = 0; i < audioData.length; i++) {
                audioView.setInt16(i * 2, audioData[i], true);
            }

            const mixedBlob = new Blob([waveHeader, audioBuffer], { type: 'audio/wav' });
            return mixedBlob;
        }

        // Helper function to write strings into a DataView
        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

    </script>
</head>
<body>
    <h1>${media.uploadedBy || 'Friend'}’s Message for You</h1>
    <p>${media.message || "Enjoy this media!"}</p>

    <!-- Audio preview element for the final mixed audio -->
    <audio controls id="audioPreview" style="max-width: 100%;"></audio>
    
    <!-- Loading indicator and media preview (hidden by default) -->
    <div id="loadingIndicator" style="display: block;">Loading...</div>
    <div id="mediaPreview" style="display: none;">
        <!-- Here the audio will be shown -->
    </div>
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
