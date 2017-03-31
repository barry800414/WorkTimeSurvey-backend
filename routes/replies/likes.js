const express = require('express');
const router = express.Router();
const HttpError = require('../../libs/errors').HttpError;
const DuplicateKeyError = require('../../libs/errors').DuplicateKeyError;
const ObjectNotExistError = require('../../libs/errors').ObjectNotExistError;
const facebook = require('../../libs/facebook');
const ObjectId = require('mongodb').ObjectId;
const winston = require('winston');
const LikeService = require('../../services/like_service');
const ReplyService = require('../../services/reply_service');

/*
 * When developing, you can set environment to skip facebook auth
 */
if (! process.env.SKIP_FACEBOOK_AUTH) {
    router.post('/', function(req, res, next) {
        var access_token = req.body.access_token;

        facebook.accessTokenAuth(access_token).then(function(facebook) {
            winston.info("facebook auth success", {access_token: access_token, ip: req.ip, ips: req.ips});

            req.custom.facebook = facebook;
            next();
        }).catch(function(err) {
            winston.info("facebook auth fail", {access_token: access_token, ip: req.ip, ips: req.ips});

            next(new HttpError("Unauthorized", 401));
        });
    });
}

router.post('/:id/likes', (req, res, next) => {
    winston.info(req.originalUrl, {query: req.query, ip: req.ip, ips: req.ips});

    const id =  req.params.id;
    if(typeof id === 'undefined'){
        next(new HttpError('id error', 422));
        return;
    }

    const author = {};
    if (req.custom && req.custom.facebook) {
        author.id = req.custom.facebook.id,
        author.name = req.custom.facebook.name,
        author.type = "facebook";
    } else {
        author.id = "-1";
        author.type = "test";
    }

    const reply_service = new ReplyService(req.db);
    const like_service = new LikeService(req.db);

    reply_service.checkIdExist(id).then(value => {
        return like_service.createLikeToReply(id, author);
    }).then(value => {
        winston.info("user likes a reply successfully", {id: value, ip: req.ip, ips: req.ips});
        res.send({success: true});
    }).catch(reason => {
        if(reason instanceof DuplicateKeyError) {
            next(new HttpError(reason.message, 403));
        } else if (reason instanceof ObjectNotExistError) {
            next(new HttpError(reason.message, 404));
        } else {
            next(new HttpError("Internal Server Error", 500));
        }
    })

});

router.delete('/:id/likes', function(req, res, next) {
    res.send('Yo! you are in DELETE /replies/:id/likes');
});

module.exports = router;
