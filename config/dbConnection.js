const mongoose = require('mongoose');

const connectDb = async()=>{
  try{
  await mongoose.connect(process.env.CONNECTION_STRING)
    console.log("db connected");
  }
  catch(error){
    console.log(error);
    process.exit(1);
  }
} 
module.exports = connectDb;