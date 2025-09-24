const express = require('express');
const router = express.Router();

const { read, list, create, confirm, cancel, remove, myHistory, historyByUser } = require('../controllers/booking');
// middleware
const { auth } = require('../middleware/auth');

// http://localhost:5000/api/booking

router.get('/booking', auth, list);
router.get('/booking/:id', auth, read);
router.post('/booking', auth, create);
router.post('/booking/:id/confirm', auth, confirm);
router.post('/booking/:id/cancel',  auth, cancel);
router.delete('/booking/:id', auth, remove);

// ประวัติของผู้ใช้เอง
router.get('/me/booking', auth, myHistory);
// ประวัติของผู้ใช้ตาม user_id
router.get('/users/:id/booking', auth, historyByUser);


module.exports = router;