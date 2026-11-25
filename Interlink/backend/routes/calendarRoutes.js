const express = require("express");
const router = express.Router();
const calendarController = require("../controllers/calendarController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Apply verifyToken to all calendar routes
router.use(verifyToken);

// Feed & Availability
router.get("/feed", calendarController.getCalendarFeed);
router.post("/availability", calendarController.checkAvailability);

// Calendars management
router.get("/calendars", calendarController.getCalendars);
router.post("/calendars", calendarController.createCalendar);
router.put("/calendars/:id", calendarController.updateCalendar);
router.delete("/calendars/:id", calendarController.deleteCalendar);

// Calendar sharing
router.get("/calendars/:id/shares", calendarController.getShares);
router.post("/calendars/:id/shares", calendarController.addShare);
router.delete("/calendars/:id/shares/:shareId", calendarController.removeShare);

// Events management
router.post("/events", calendarController.createEvent);
router.get("/events/:id", calendarController.getEventById);
router.put("/events/:id", calendarController.updateEvent);
router.delete("/events/:id", calendarController.deleteEvent);
router.post("/events/:id/rsvp", calendarController.respondRSVP);

module.exports = router;
