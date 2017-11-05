var express     = require("express");
var router      = express.Router();
var Campground  = require("../models/campgrounds");
var middleware  = require("../middleware");
var geocoder    = require("geocoder");


// ---------------------------------------------------------
//                     CAMPGROUNDS INDEX ROUTE
// ---------------------------------------------------------
router.get("/", function(req, res){
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}, function(err, allCampgrounds){
        if (err) {
           console.log(err);
        } else {
            if (allCampgrounds.length < 1) {
                req.flash("error", "No campgrounds found");
                res.redirect("/campgrounds");
            } else {
                res.render("campgrounds/index", {campgrounds: allCampgrounds});
            }
        }
    });
    } else {
        Campground.find({}, function(err, allCampgrounds){
           if (err) {
               console.log(err);
           } else {
               res.render("campgrounds/index", {campgrounds: allCampgrounds});
           }
        });
    }
});

// ---------------------------------------------------------
//                     NEW CAMPGROUND ROUTE
// ---------------------------------------------------------
router.get("/new", middleware.isLoggedIn, function(req, res) {
    res.render("campgrounds/new");
});

// ---------------------------------------------------------
//                     CREATE NEW CAMPGROUND ROUTE
// ---------------------------------------------------------
router.post("/", middleware.isLoggedIn, function(req, res){
    var name = req.body.name;
    var price = req.body.price;
    var image = req.body.image;
    var desc = req.body.description;
    var author = {
        id: req.user._id,
        username: req.user.username
    };
    geocoder.geocode(req.body.location, function (err, data) {
        if (err){
            console.log(err);
        } else {
            var lat = data.results[0].geometry.location.lat;
            var lng = data.results[0].geometry.location.lng;
            var location = data.results[0].formatted_address;
            var newCampground = {name: name, price: price, image: image, description: desc, author: author, location: location, lat: lat, lng: lng};
            Campground.create(newCampground, function(err, newlyCreated){
                if (err){
                    console.log(err);
                } else {
                    req.flash("success", "Successfully added " + newlyCreated.name);
                    res.redirect("/campgrounds"); 
                }
            });   
        }
    });
});

// ---------------------------------------------------------
//                     CAMPGROUND DETAILS ROUTE
// ---------------------------------------------------------
router.get("/:id", function(req, res) {
   Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
      if (err || !foundCampground) {
            req.flash("error", "Campground not found");
            res.redirect("back");
      } else {
            res.render("campgrounds/show", {campground: foundCampground});
      }
   });
});

// ---------------------------------------------------------
//                    EDIT CAMPGROUND ROUTE
// ---------------------------------------------------------
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res) {
    Campground.findById(req.params.id, function(err, foundCampground){
        if (err || !foundCampground){
            req.flash("error", "Campground not found")
            res.redirect("back");
        } else {
            res.render("campgrounds/edit", {campground: foundCampground});    
        }
        
    });
});

// ---------------------------------------------------------
//                    UPDATE CAMPGROUND ROUTE
// ---------------------------------------------------------
router.put("/:id", middleware.checkCampgroundOwnership, function(req, res){
    geocoder.geocode(req.body.campground.location, function (err, data) {
        var lat = data.results[0].geometry.location.lat;
        var lng = data.results[0].geometry.location.lng;
        var location = data.results[0].formatted_address;
        var newData = {name: req.body.campground.name, image: req.body.campground.image, description: req.body.campground.description, cost: req.body.campground.cost, location: location, lat: lat, lng: lng};
        Campground.findByIdAndUpdate(req.params.id, {$set: newData}, function(err, campground){
            if(err){
                req.flash("error", err.message);
                res.redirect("back");
            } else {
                req.flash("success", campground.name + " successfully updated");
                res.redirect("/campgrounds/" + campground._id);
            }
        });
    });
});

// ---------------------------------------------------------
//                    DELETE CAMPGROUND ROUTE
// ---------------------------------------------------------
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground) {
        req.flash("success", foundCampground.name + " deleted successfully");
        Campground.findByIdAndRemove(req.params.id, function(err){
         res.redirect("/campgrounds");
        });
    });
});

// ---------------------------------------------------------
//                    SAFE ESCAPED REGEX
// ---------------------------------------------------------
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;