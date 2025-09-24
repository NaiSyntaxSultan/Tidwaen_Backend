const express = require('express');
const router = express.Router();

const { read, list, create, update, remove, search } = require('../controllers/movie');
// middleware
const { auth } = require('../middleware/auth');

// http://localhost:5000/api/movie
router.get('/movie/search', auth, search);

router.get('/movie', auth, list);

router.get('/movie/:id', auth, read);

router.post('/movie', auth, create);

router.put('/movie/:id', auth, update);

router.delete('/movie/:id', auth, remove);


module.exports = router;