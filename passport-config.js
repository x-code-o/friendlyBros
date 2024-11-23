const LocalStrategy= require("passport-local").Strategy
const bcrypt = require("bcrypt")
const registerModel = require("./models/registerModel");
const { use, authenticate } = require("passport");

function initiallize(passport,email,id){
    const authenticateUsers = async(email,password,done)=>{
        const user = await registerModel.findOne({email});
        // console.log({user})
        if(user == null){
            return done(null,false, {message:"no email found"})
        }
        try {
            // console.log("pass",password);
            // console.log("pass2",user.password);
            
            if(await bcrypt.compare(password,user.password)){
                return done(null,user)
            }else{
                return done(null,false,{message:"password incorrect"})
            }
        } catch (e) {
            console.log(e);
            return done(e)
        }

    }
    passport.use(new LocalStrategy({usernameField:"email"},authenticateUsers));
    passport.serializeUser((user,done)=>{
        done(null, user.id);
    })
    passport.deserializeUser(async (id, done) => {
        try {
          const user = await registerModel.findById(id)
        //console.log(user)
          done(null, user);
        } catch (err) {
          done(err);
        }
      });
      
}

module.exports = initiallize;