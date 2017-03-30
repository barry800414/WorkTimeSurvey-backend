const express = require('express');
const router = express.Router();
/* an example to import service
const LikeService = require('../../services/like_service');
*/

router.post('/:id/likes', function(req, res, next) {
    res.send('Yo! you are in POST /replies/:id/likes');
});

router.delete('/:id/likes', function(req, res, next) {
    res.send('Yo! you are in DELETE /replies/:id/likes');
});

module.exports = router;
