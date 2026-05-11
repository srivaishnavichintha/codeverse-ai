const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.status(200).json({
      success: true,
      unreadCount,
      notifications
    });
  } catch (err) {
    next(err);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.status(200).json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
};
