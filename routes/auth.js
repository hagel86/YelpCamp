var express     = require("express");
var router      = express.Router();
var passport    = require("passport");
var User        = require("../models/user");
var middleware  = require("../middleware");
var Campground  = require("../models/campgrounds");
var async       = require("async");
var nodemailer  = require("nodemailer");
var crypto      = require("crypto");


// ---------------------------------------------------------
//                    INDEX ROUTE
// ---------------------------------------------------------
router.get("/", function(req, res){
    res.render("landing");
});


// ---------------------------------------------------------
//                     REGISTER ROUTES
// ---------------------------------------------------------
router.get("/register", function(req, res) {
    if(req.user) {
        req.flash("error", "You need to logout before you can do that");
        return res.redirect("/campgrounds");
    }
   res.render("register");
});

router.post("/register", function(req, res) {
    var newUser = new User ({username:  req.body.username.toLowerCase(),
                            firstName:  req.body.firstName,
                            lastName:   req.body.lastName,
                            email:      req.body.email,
                            avatar:     req.body.profilePicture
    });
    if(req.body.adminCode == process.env.ADMINCODE) {
        newUser.isAdmin = true;
    }
    User.register(newUser, req.body.password, function(err, user){
       if (err){
           req.flash("error", err.message);
           return res.redirect("register");
       }
       passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to YelpCamp " + user.username);
            res.redirect("/campgrounds") ;
       });
   });
});

// ---------------------------------------------------------
//                     LOGIN FORM ROUTE
// ---------------------------------------------------------
router.get("/login", function(req, res) {
    if(req.user) {
        req.flash("error", "You are already logged in.");
        return res.redirect("/campgrounds");
    }
    res.render("login");
});

router.post("/login", passport.authenticate("local", {
        successRedirect: "/campgrounds",
        failureRedirect: "/login",
        failureFlash: true
    }), function(req, res) {
});

// ---------------------------------------------------------
//                     LOGOUT ROUTE
// ---------------------------------------------------------
router.get("/logout", function(req, res) {
    req.flash("success", "Come back soon " + req.user.username + "!")
    req.logout();
    res.redirect("/campgrounds");
});

// ---------------------------------------------------------
//                     FORGOT PASSWORD ROUTE
// ---------------------------------------------------------
router.get("/forgot", function(req, res) {
  res.render("forgot");
});

router.post("/forgot", function(req, res, next) {
    
    console.log("password: " + process.env.GMAILPW);
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString("hex");
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash("error", "No account with that email address exists.");
          return res.redirect("/forgot");
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: "Gmail", 
        auth: {
          user: "rossoneri8622@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: "rossoneri8622@gmail.com",
        subject: "YelpCamp Password Reset",
        text: "You are receiving this because you (or someone else) has requested the reset of the password for your account.\n\n" +
          "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
          "http://" + req.headers.host + "/reset/" + token + "\n\n" +
          "If you did not request this, please ignore this email and your password will remain unchanged.\n"
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
        done(err, "done");
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect("/login");
  });
});

router.get("/reset/:token", function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot");
    }
    res.render("reset", {token: req.params.token});
  });
});

router.post("/reset/:token", function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash("error", "Password reset token is invalid or has expired.");
          return res.redirect("back");
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect("back");
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: "Gmail", 
        auth: {
          user: "rossoner8622@gmail.com",
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: "learntocodeinfo@mail.com",
        subject: "Your password has been changed",
        text: "Hello,\n\n" +
          "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash("success", "Success! Your password has been changed.");
        done(err);
      });
    }
  ], function(err) {
    res.redirect("/campgrounds");
  });
});

// ---------------------------------------------------------
//                     USER PROFILE ROUTE
// ---------------------------------------------------------
router.get("/users/:id", function(req, res) {
   User.findById(req.params.id, function(err, foundUser){
      if (err || !foundUser) {
          req.flash("error", "User not found");
          res.redirect("/campgrounds");
      } else {
          Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds){
              if (err){
                    res.redirect("/campgrounds");
              } else {
                res.render("users/show", {user: foundUser, campgrounds: campgrounds});            
              }
          });
        }
    });
});

module.exports = router;