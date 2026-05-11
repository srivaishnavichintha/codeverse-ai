const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect);

router.get('/', notificationController.getNotifications);
router.put('/read-all', notificationController.markAllAsRead);

module.exports = router;
