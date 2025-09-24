const jwt = require('jsonwebtoken');

exports.auth = async (req, res, next) => {
    try {
        // code
        const token = req.headers["authtoken"];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token, authorization denied'
            });
        }
        const decoded = jwt.verify(token, 'jwtsecret');
        req.user = decoded.user;
        next();

    } catch (err) {
        // code
        console.log(err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}