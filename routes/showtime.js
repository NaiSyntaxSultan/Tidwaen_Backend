const express = require('express');
const router = express.Router();

const { read, list, create, update, remove, } = require('../controllers/showtime');
// middleware
const { auth } = require('../middleware/auth');

// http://localhost:5000/api/showtime

router.get('/showtime', auth, list);

router.get('/showtime/:id', auth, read);

router.post('/showtime', auth, create);

router.put('/showtime/:id', auth, update);

router.delete('/showtime/:id', auth, remove);


module.exports = router;