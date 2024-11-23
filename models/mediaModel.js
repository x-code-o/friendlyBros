const mongoose = require("mongoose");

const mediaSchema = mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, "Please provide the filename"],
      unique: true,
    },
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
    },
    qrlocUrl: {
      type: String,
      required: [true, "QR URL is required"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"], // Store MIME type
    },
    uploadedBy: {
      type: String,
      required: [true, "Please specify who uploaded the file"],
    },
    message: {
      type: String,
      required: [true, "Message cannot be empty"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
    },
    mood: {
      type: String,
      enum: ["A", "B","C"], // Restrict values to "Happy" or "Sad"
      required: [true, "Mood is required"],
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt timestamps
  }
);

module.exports = mongoose.model("Media", mediaSchema);
