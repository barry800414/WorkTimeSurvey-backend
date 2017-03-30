const express = require('express');
const router = express.Router();

router.post('/:id/replies', function(req, res, next) {
    res.send('Yo! you are in POST /experiences/:id/replies');
});

router.get('/:id/replies', function(req, res, next) {
    res.send('Yo! you are in GET /experiences/:id/replies');
});

module.exports = router;
