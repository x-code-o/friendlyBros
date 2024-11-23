const mongoose = require("mongoose");

const registerSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Please enter the name"],

    },
    email: {
      type: String,
      required: [true, "Please add the contact email address"],
      unique: [true,"email already taken"]
      
    },
    password: {
      type: String,
      required: [true, "Please enter the password"],

    },
  
  },
  {
    timestamps:true,
  }
);

module.exports = mongoose.model("Register", registerSchema);
