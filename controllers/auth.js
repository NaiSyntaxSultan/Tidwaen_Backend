const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    const { nickname, username, email, password } = req.body;
    try {
        // code
        // 1.validate เบื้องต้น
        if (!nickname || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please enter all fields'
            });
        }

        // 2.เช็คซ้ำ email หรือ username

        var [user] = await db.execute('SELECT user_id FROM users WHERE email = ? OR username = ? LIMIT 1', [email, username]);

        if (user.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already exists'
            });
        }
        // 3.Hash password
        const hash = await bcrypt.hash(password, 10);

        // 4.insert (ให้ DB ใส่ created_at เอง)
        const [result] = await db.execute(
            'INSERT INTO users (nickname, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [nickname, username, email, hash, 'user']
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: result.insertId,
                nickname,
                username,
                email
            }
        });


    } catch (err) {
        // code
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        // code


        // 1.หา user
        var [user] = await db.execute('SELECT user_id, username, email, password, role FROM users WHERE username = ? LIMIT 1', [username]);

        if (user.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User does not exist'
            });
        }

        user = user[0];
        // 2) เทียบรหัส
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // 3) payload + sign
        const payload = {
            user: {
                id: user.user_id,
                name: user.username,
                role: user.role
            }
        };

        const token = jwt.sign(payload, 'jwtsecret', { expiresIn: 360000 });

        return res.json({ 
            success: true, 
            token, 
            payload 
        });
    } catch (err) {
        // code
        console.log(err);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

